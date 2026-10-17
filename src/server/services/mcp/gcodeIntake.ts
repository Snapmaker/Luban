/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
/**
 * How a G-code program reaches the MCP when it is too big for one tool
 * argument (#237): a file in an allow-listed inbox directory, or a chunked
 * upload the server reassembles and hashes. Plus the program IDENTITY - size,
 * SHA-256, line counts, first and last motion lines - that the confirm page
 * and the tool results carry so the operator can tell a staged program is
 * the complete file and not a truncation.
 *
 * Pure: node's crypto/path only, with the filesystem injected, so every
 * rule here is unit-tested in tests/gcodeIntake.test.ts without the server.
 * The inbox directories themselves (Luban's data dir, the configured extra)
 * are resolved in jobs.ts.
 */
import crypto from 'crypto';
import * as fs from 'fs';
import path from 'path';

import {
    GCODE_UPLOAD_IDLE_EXPIRY_MS,
    MAX_GCODE_PROGRAM_BYTES,
    MAX_GCODE_UPLOAD_CHUNK_BYTES,
    MAX_OPEN_GCODE_UPLOADS,
} from './procedureLimits';
import { lineHasMotion } from './validator';

/** A refusal from the intake rules; tools re-throw it as McpToolError. */
export class GcodeIntakeError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'GcodeIntakeError';
    }
}

// ---------------------------------------------------------------------------
// Program identity
// ---------------------------------------------------------------------------

export interface ProgramLine {
    /** 1-based. */
    line: number;
    text: string;
}

export interface ProgramIdentity {
    /** UTF-8 bytes of exactly the text that was staged / validated. */
    bytes: number;
    /** Hex SHA-256 of those bytes - compare with `sha256sum` on the file you generated. */
    sha256: string;
    /** Same convention as the validation report: text.split(newline).length, so a trailing newline counts one empty line. */
    lineCount: number;
    motionLineCount: number;
    firstMotion: ProgramLine | null;
    lastMotion: ProgramLine | null;
    /** The last non-blank line of the file - where a truncation shows first. */
    lastLine: ProgramLine | null;
}

export function sha256Hex(text: string | Buffer): string {
    return crypto.createHash('sha256').update(typeof text === 'string' ? Buffer.from(text, 'utf8') : text).digest('hex');
}

/** Everything a reader needs to tell this program from a truncated copy of it. */
export function describeProgramIdentity(text: string): ProgramIdentity {
    const lines = text.split(/\r?\n/);
    let motionLineCount = 0;
    let firstMotion: ProgramLine | null = null;
    let lastMotion: ProgramLine | null = null;
    let lastLine: ProgramLine | null = null;
    lines.forEach((raw, index) => {
        const trimmed = raw.trim();
        if (!trimmed) {
            return;
        }
        lastLine = { line: index + 1, text: trimmed };
        if (lineHasMotion(raw)) {
            motionLineCount += 1;
            if (!firstMotion) {
                firstMotion = { line: index + 1, text: trimmed };
            }
            lastMotion = { line: index + 1, text: trimmed };
        }
    });
    return {
        bytes: Buffer.byteLength(text, 'utf8'),
        sha256: sha256Hex(text),
        lineCount: lines.length,
        motionLineCount,
        firstMotion,
        lastMotion,
        lastLine,
    };
}

/** Where a staged program came from; on the job record and the confirm page. */
export type ProgramSource =
    | { kind: 'inline' }
    | { kind: 'path'; path: string; inbox: string }
    | { kind: 'upload'; upload_id: string; chunks: number }
    | { kind: 'server' };

export function describeProgramSource(source: ProgramSource): string {
    switch (source.kind) {
        case 'path':
            return `file ${source.path} (inbox: ${source.inbox})`;
        case 'upload':
            return `chunked upload ${source.upload_id} (${source.chunks} chunk${source.chunks === 1 ? '' : 's'}, SHA-256 verified)`;
        case 'server':
            return 'emitted by the server';
        default:
            return 'inline gcode argument';
    }
}

// ---------------------------------------------------------------------------
// gcode_path: allow-listed inbox directories
// ---------------------------------------------------------------------------

export interface InboxRoot {
    /** 'inbox' for Luban's own mcp-jobs-inbox, 'extra' for the configured directory. */
    name: string;
    /** Absolute directory path as configured (not yet realpath'd). */
    dir: string;
}

/** The slice of fs the path rules need, injectable so symlink escapes are testable on every platform. */
export interface PathFs {
    /** Canonical path with every symlink resolved; throws when the path does not exist. */
    realpath(p: string): string;
    isFile(p: string): boolean;
}

export const nodePathFs: PathFs = {
    realpath: (p) => fs.realpathSync.native(p),
    isFile: (p) => {
        try {
            return fs.statSync(p).isFile();
        } catch (err) {
            return false;
        }
    },
};

export type InboxPathResolution =
    | { ok: true; path: string; root: InboxRoot; relative: string }
    | { ok: false; reason: string };

function inside(rootReal: string, candidateReal: string): boolean {
    const rel = path.relative(rootReal, candidateReal);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function listRoots(roots: InboxRoot[]): string {
    return roots.length ? roots.map((root) => `${root.name}: ${root.dir}`).join('; ') : 'none configured';
}

/**
 * Resolve a gcode_path argument against the allow-listed roots.
 *
 * Refused outright: an empty path, a NUL byte, any `..` segment (with either
 * separator). A relative path is looked up in each root in order; an
 * absolute path must lie lexically inside one of them. The file and its
 * root are then realpath'd and the file must STILL be inside the root, so a
 * symlink (or junction) in the inbox pointing elsewhere is refused even
 * though its lexical path looked fine. Only a regular file is accepted.
 */
export function resolveInboxPath(requested: unknown, roots: InboxRoot[], fsLike: PathFs = nodePathFs): InboxPathResolution {
    if (typeof requested !== 'string' || !requested.trim()) {
        return { ok: false, reason: 'gcode_path must be a non-empty path string.' };
    }
    const wanted = requested.trim();
    if (wanted.includes('\0')) {
        return { ok: false, reason: 'gcode_path contains a NUL byte.' };
    }
    if (wanted.split(/[\\/]+/).some((segment) => segment === '..')) {
        return { ok: false, reason: `gcode_path must not contain ".." segments (${wanted}). Give a path inside the inbox: ${listRoots(roots)}.` };
    }
    if (!roots.length) {
        return { ok: false, reason: 'No inbox directory is available: the MCP jobs inbox could not be created and no extra directory is configured.' };
    }

    const absolute = path.isAbsolute(wanted);
    const candidates: Array<{ root: InboxRoot; full: string }> = absolute
        ? roots.filter((root) => inside(path.resolve(root.dir), path.resolve(wanted))).map((root) => ({ root, full: path.resolve(wanted) }))
        : roots.map((root) => ({ root, full: path.resolve(root.dir, wanted) }));

    if (!candidates.length) {
        return {
            ok: false,
            reason: `gcode_path ${wanted} is outside every allow-listed inbox directory (${listRoots(roots)}). Write the file into one of `
                + 'those directories (or configure it in Settings -> MCP Server -> Job files) and pass the path relative to it.',
        };
    }

    const missing: string[] = [];
    for (const { root, full } of candidates) {
        let fileReal: string;
        let rootReal: string;
        try {
            rootReal = fsLike.realpath(root.dir);
        } catch (err) {
            missing.push(`${root.name} directory ${root.dir} does not exist`);
            continue;
        }
        try {
            fileReal = fsLike.realpath(full);
        } catch (err) {
            missing.push(`${full} not found`);
            continue;
        }
        if (!inside(rootReal, fileReal)) {
            return {
                ok: false,
                reason: `gcode_path ${wanted} resolves to ${fileReal}, outside the ${root.name} directory ${rootReal} - a symlink or junction `
                    + 'inside the inbox must not point out of it. Copy the file into the inbox instead.',
            };
        }
        if (!fsLike.isFile(fileReal)) {
            return { ok: false, reason: `gcode_path ${wanted} is not a regular file (${fileReal}).` };
        }
        return { ok: true, path: fileReal, root, relative: path.relative(rootReal, fileReal) };
    }
    return {
        ok: false,
        reason: `gcode_path ${wanted} was not found: ${missing.join('; ')}. The allow-listed directories are ${listRoots(roots)}; `
            + 'write the file there first (the path is read by the Luban server, on its machine).',
    };
}

// ---------------------------------------------------------------------------
// Chunked upload
// ---------------------------------------------------------------------------

export interface UploadRecord {
    upload_id: string;
    name: string;
    total_bytes: number;
    /** Declared by the client at begin, lower-cased hex. */
    sha256: string;
    chunks: string[];
    /** Per-chunk byte length and SHA-256, for idempotent repeats of a seq. */
    chunkDigests: Array<{ bytes: number; sha256: string }>;
    received_bytes: number;
    /** Running hash, fed in seq order. */
    hash: crypto.Hash;
    finished: boolean;
    /** Filled by finish(): the verified text (chunks joined). */
    text: string | null;
    created_at: number;
    touched_at: number;
}

export interface UploadStatus {
    upload_id: string;
    name: string;
    total_bytes: number;
    sha256: string;
    received_bytes: number;
    remaining_bytes: number;
    chunks: number;
    /** The seq the next append must carry. */
    next_seq: number;
    finished: boolean;
    /** Epoch ms after which the upload is dropped unless touched again. */
    expires_at: number;
}

export interface UploadStoreOptions {
    maxBytes?: number;
    chunkMaxBytes?: number;
    idleExpiryMs?: number;
    maxOpen?: number;
    now?: () => number;
    newId?: () => string;
}

const SHA256_RE = /^[0-9a-fA-F]{64}$/;

/**
 * Reassembles a program sent as ordered text chunks and verifies it against
 * the byte count and SHA-256 the client declared up front, so a client that
 * cannot share a filesystem with the server (a remote agent) can still hand
 * over an 870 KB CAM file without emitting it in one argument.
 *
 * Rules: chunks arrive in seq order starting at 0; a repeat of an already
 * received seq is accepted as a no-op when its content matches (idempotent
 * retries) and refused when it differs; a gap is refused. finish() checks
 * the byte count and hash and makes the text available to validate_gcode
 * (peek) and submit_gcode_job (take, which removes the upload). Anything
 * untouched for idleExpiryMs is swept on the next call.
 */
export class GcodeUploadStore {
    private uploads = new Map<string, UploadRecord>();

    private readonly maxBytes: number;

    private readonly chunkMaxBytes: number;

    private readonly idleExpiryMs: number;

    private readonly maxOpen: number;

    private readonly now: () => number;

    private readonly newId: () => string;

    public constructor(options: UploadStoreOptions = {}) {
        this.maxBytes = options.maxBytes ?? MAX_GCODE_PROGRAM_BYTES;
        this.chunkMaxBytes = options.chunkMaxBytes ?? MAX_GCODE_UPLOAD_CHUNK_BYTES;
        this.idleExpiryMs = options.idleExpiryMs ?? GCODE_UPLOAD_IDLE_EXPIRY_MS;
        this.maxOpen = options.maxOpen ?? MAX_OPEN_GCODE_UPLOADS;
        this.now = options.now || (() => Date.now());
        this.newId = options.newId || (() => crypto.randomBytes(8).toString('hex'));
    }

    public get limits(): { maxBytes: number; chunkMaxBytes: number; idleExpiryMs: number; maxOpen: number } {
        return { maxBytes: this.maxBytes, chunkMaxBytes: this.chunkMaxBytes, idleExpiryMs: this.idleExpiryMs, maxOpen: this.maxOpen };
    }

    /** Drop uploads nobody has touched for idleExpiryMs; returns how many went. */
    public sweep(): number {
        const cutoff = this.now() - this.idleExpiryMs;
        let dropped = 0;
        for (const [id, record] of this.uploads) {
            if (record.touched_at < cutoff) {
                this.uploads.delete(id);
                dropped += 1;
            }
        }
        return dropped;
    }

    public begin(args: { name?: unknown; total_bytes?: unknown; sha256?: unknown }): UploadStatus {
        this.sweep();
        if (typeof args.name !== 'string' || !args.name.trim()) {
            throw new GcodeIntakeError('name must be a non-empty string.');
        }
        const total = Number(args.total_bytes);
        if (!Number.isInteger(total) || total <= 0) {
            throw new GcodeIntakeError('total_bytes must be a positive integer: the UTF-8 byte count of the whole program you will send.');
        }
        if (total > this.maxBytes) {
            throw new GcodeIntakeError(`total_bytes ${total} exceeds the ${this.maxBytes}-byte program limit (MAX_GCODE_PROGRAM_BYTES, the server's `
                + 'request-body cap). Split the job into separate programs.');
        }
        if (typeof args.sha256 !== 'string' || !SHA256_RE.test(args.sha256.trim())) {
            throw new GcodeIntakeError('sha256 must be the 64-hex-character SHA-256 of the UTF-8 bytes of the whole program.');
        }
        if (this.uploads.size >= this.maxOpen) {
            throw new GcodeIntakeError(`${this.uploads.size} uploads are already open (limit ${this.maxOpen}); finish or let them expire `
                + `(${Math.round(this.idleExpiryMs / 60000)} min idle) before beginning another.`);
        }
        let id = this.newId();
        while (this.uploads.has(id)) {
            id = this.newId();
        }
        const at = this.now();
        const record: UploadRecord = {
            upload_id: id,
            name: args.name.trim(),
            total_bytes: total,
            sha256: args.sha256.trim().toLowerCase(),
            chunks: [],
            chunkDigests: [],
            received_bytes: 0,
            hash: crypto.createHash('sha256'),
            finished: false,
            text: null,
            created_at: at,
            touched_at: at,
        };
        this.uploads.set(id, record);
        return this.status(record);
    }

    private require(uploadId: unknown): UploadRecord {
        this.sweep();
        const record = typeof uploadId === 'string' ? this.uploads.get(uploadId) : undefined;
        if (!record) {
            throw new GcodeIntakeError(`Unknown upload_id ${String(uploadId)}: it was never begun, was already submitted, or expired `
                + `(${Math.round(this.idleExpiryMs / 60000)} min idle). Call begin_gcode_upload again.`);
        }
        return record;
    }

    /** Ordered, idempotent on a repeated seq with identical content. */
    public append(uploadId: unknown, seq: unknown, text: unknown): UploadStatus & { accepted: boolean; duplicate: boolean } {
        const record = this.require(uploadId);
        if (record.finished) {
            throw new GcodeIntakeError(`Upload ${record.upload_id} is already finished and verified; submit it or begin a new one.`);
        }
        const index = Number(seq);
        if (!Number.isInteger(index) || index < 0) {
            throw new GcodeIntakeError('seq must be a non-negative integer, starting at 0 and increasing by 1 per chunk.');
        }
        if (typeof text !== 'string' || text.length === 0) {
            throw new GcodeIntakeError('text must be a non-empty string: the next slice of the program, split on a line boundary.');
        }
        const bytes = Buffer.from(text, 'utf8');
        if (bytes.length > this.chunkMaxBytes) {
            throw new GcodeIntakeError(`Chunk ${index} is ${bytes.length} bytes; the limit per chunk is ${this.chunkMaxBytes} (MAX_GCODE_UPLOAD_CHUNK_BYTES). Send smaller chunks.`);
        }
        record.touched_at = this.now();
        if (index < record.chunks.length) {
            const seen = record.chunkDigests[index];
            const digest = sha256Hex(bytes);
            if (seen.bytes === bytes.length && seen.sha256 === digest) {
                return { ...this.status(record), accepted: true, duplicate: true };
            }
            throw new GcodeIntakeError(`Chunk ${index} of upload ${record.upload_id} was already received with DIFFERENT content `
                + `(${seen.bytes} bytes then, ${bytes.length} now). A seq cannot be replaced; begin a new upload.`);
        }
        if (index > record.chunks.length) {
            throw new GcodeIntakeError(`Chunk ${index} is out of order: upload ${record.upload_id} expects seq ${record.chunks.length} next `
                + `(${record.chunks.length} received). Send the chunks in sequence.`);
        }
        if (record.received_bytes + bytes.length > record.total_bytes) {
            throw new GcodeIntakeError(`Chunk ${index} would bring upload ${record.upload_id} to ${record.received_bytes + bytes.length} bytes, past the `
                + `${record.total_bytes} declared at begin. The declared total_bytes or the chunks are wrong; begin a new upload with the right size.`);
        }
        record.chunks.push(text);
        record.chunkDigests.push({ bytes: bytes.length, sha256: sha256Hex(bytes) });
        record.received_bytes += bytes.length;
        record.hash.update(bytes);
        return { ...this.status(record), accepted: true, duplicate: false };
    }

    /** Verify byte count and SHA-256; the text becomes available to peek/take. */
    public finish(uploadId: unknown): UploadStatus & { identity: ProgramIdentity } {
        const record = this.require(uploadId);
        record.touched_at = this.now();
        if (record.finished && record.text !== null) {
            return { ...this.status(record), identity: describeProgramIdentity(record.text) };
        }
        if (record.received_bytes !== record.total_bytes) {
            throw new GcodeIntakeError(`Upload ${record.upload_id} is incomplete: ${record.received_bytes} of ${record.total_bytes} bytes received `
                + `in ${record.chunks.length} chunk${record.chunks.length === 1 ? '' : 's'}. Send the rest (next seq ${record.chunks.length}) before finishing; `
                + 'if the file really is this long, the total_bytes declared at begin was wrong - begin a new upload.');
        }
        const text = record.chunks.join('');
        // Hash the joined text, not the running hash: a chunk boundary that
        // split a multi-byte character re-encodes differently once joined,
        // and the joined text is what gets staged.
        const digest = sha256Hex(text);
        if (digest !== record.sha256) {
            this.uploads.delete(record.upload_id);
            throw new GcodeIntakeError(`Upload ${record.upload_id} failed verification: SHA-256 of the ${record.received_bytes} received bytes is ${digest}, `
                + `not the ${record.sha256} declared at begin. The upload has been discarded; check the hash is over the UTF-8 bytes of the exact `
                + 'text you sent (same line endings) and that every chunk was split on a line boundary, then begin again.');
        }
        record.finished = true;
        record.text = text;
        return { ...this.status(record), identity: describeProgramIdentity(text) };
    }

    /** The verified text of a finished upload, left in place (validate_gcode). */
    public peek(uploadId: unknown): { record: UploadRecord; text: string } {
        const record = this.require(uploadId);
        if (!record.finished || record.text === null) {
            throw new GcodeIntakeError(`Upload ${record.upload_id} is not finished: ${record.received_bytes} of ${record.total_bytes} bytes received. `
                + 'Call finish_gcode_upload first; it verifies the byte count and SHA-256.');
        }
        record.touched_at = this.now();
        return { record, text: record.text };
    }

    /** The verified text, and the upload is removed (submit_gcode_job staged it). */
    public take(uploadId: unknown): { record: UploadRecord; text: string } {
        const found = this.peek(uploadId);
        this.uploads.delete(found.record.upload_id);
        return found;
    }

    public status(record: UploadRecord): UploadStatus {
        return {
            upload_id: record.upload_id,
            name: record.name,
            total_bytes: record.total_bytes,
            sha256: record.sha256,
            received_bytes: record.received_bytes,
            remaining_bytes: record.total_bytes - record.received_bytes,
            chunks: record.chunks.length,
            next_seq: record.chunks.length,
            finished: record.finished,
            expires_at: record.touched_at + this.idleExpiryMs,
        };
    }

    /** Every open upload (get_stored_state). */
    public list(): UploadStatus[] {
        this.sweep();
        return [...this.uploads.values()].map((record) => this.status(record));
    }
}
