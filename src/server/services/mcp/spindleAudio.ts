// Records the chosen microphone for the duration of a file job: one ffmpeg
// process, one input, two outputs - a FLAC file under the app data dir for
// later analysis, and a raw mono 16 kHz float stream on stdout that feeds
// the live tracker (spindleTracker.ts) a chunk at a time.
//
// ffmpeg is the capture path already used for the camera (v4l2/dshow), so
// nothing new is installed: `-f pulse` / `-f alsa` on Linux, `-f dshow` on
// Windows. Measured on snapcnclaptop (Celeron N4020) 2026-09-29: pulse ->
// FLAC + f32le pipe costs ~5-8 % of one core, 55 MB RSS, ~170 kbit/s on
// disk for room noise (a spindle is louder and compresses less).
//
// Stopping writes `q` to ffmpeg's stdin so it finalises the FLAC header
// (a SIGKILL would leave the file's duration unset), then waits briefly
// and kills it if it lingers. Nothing here touches the machine.

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs-extra';

import logger from '../../lib/logger';
import { AudioSource, ffmpegInputArgs } from './audioSelection';
import { SAMPLE_RATE } from './spindleTracker';

const log = logger('service:mcp:spindle-audio');
const STOP_GRACE_MS = 4000;

/** utime + stime of a process from /proc (Linux); null elsewhere. */
export function readChildCpuMs(pid: number | undefined): number | null {
    if (!pid || process.platform !== 'linux') {
        return null;
    }
    try {
        const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
        const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
        const ticks = Number(fields[11]) + Number(fields[12]);
        const hz = 100; // CLK_TCK on every Linux this runs on
        return Number.isFinite(ticks) ? Math.round((ticks * 1000) / hz) : null;
    } catch (err) {
        return null;
    }
}

export interface RecorderStats {
    device: string;
    filePath: string;
    startedAt: number | null;
    firstChunkAt: number | null;
    endedAt: number | null;
    samples: number;
    bytesOnDisk: number;
    exitCode: number | null;
    error: string | null;
    /** Child CPU time (user + system) over the recording, ms - Linux /proc only. */
    cpuMs: number | null;
}

/**
 * Emits 'pcm' (Float32Array of mono samples), 'error' (string) and 'exit'
 * (code). The audio-time origin is the first chunk's arrival minus its own
 * duration; the caller aligns frames to wall-clock with `firstChunkAt`.
 */
export class AudioRecorder extends EventEmitter {
    public readonly stats: RecorderStats;

    private child: ChildProcess | null = null;

    private leftover: Buffer = Buffer.alloc(0);

    private stopping = false;

    private readonly ffmpeg: string;

    private readonly source: AudioSource;

    public constructor(ffmpeg: string, source: AudioSource, filePath: string) {
        super();
        this.ffmpeg = ffmpeg;
        this.source = source;
        this.stats = {
            device: source.entry,
            filePath,
            startedAt: null,
            firstChunkAt: null,
            endedAt: null,
            samples: 0,
            bytesOnDisk: 0,
            exitCode: null,
            error: null,
            cpuMs: null,
        };
    }

    public start(): void {
        const args = [
            '-hide_banner', '-loglevel', 'error',
            ...ffmpegInputArgs(this.source),
            '-ac', '1', '-ar', String(SAMPLE_RATE), '-c:a', 'flac', '-y', this.stats.filePath,
            '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', '-c:a', 'pcm_f32le', 'pipe:1',
        ];
        this.stats.startedAt = Date.now();
        let child: ChildProcess;
        try {
            child = spawn(this.ffmpeg, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
        } catch (err) {
            this.fail(`Failed to spawn ${this.ffmpeg}: ${(err as Error).message}`);
            return;
        }
        this.child = child;
        let stderr = '';
        child.stderr?.on('data', (chunk: Buffer) => {
            stderr = `${stderr}${chunk.toString()}`.slice(-2000);
        });
        child.stdout?.on('data', (chunk: Buffer) => this.onPcm(chunk));
        child.on('error', (err) => this.fail(`ffmpeg error: ${err.message}`));
        child.on('exit', (code) => {
            this.stats.exitCode = code;
            this.stats.endedAt = Date.now();
            if (!this.stopping && code !== 0) {
                this.fail(`ffmpeg exited with code ${code}${stderr ? `: ${stderr.trim().split('\n').slice(-3).join(' | ')}` : ''}`);
            }
            this.child = null;
            this.emit('exit', code);
        });
        log.info(`recording ${this.source.entry} -> ${this.stats.filePath}`);
    }

    public get running(): boolean {
        return !!this.child;
    }

    /** Ask ffmpeg to finish cleanly; resolves once it has exited (or been killed). */
    public async stop(): Promise<RecorderStats> {
        const child = this.child;
        if (!child) {
            await this.measureFile();
            return this.stats;
        }
        this.stopping = true;
        this.stats.cpuMs = readChildCpuMs(child.pid);
        await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
                log.warn('ffmpeg did not exit on q; killing it');
                try { child.kill('SIGKILL'); } catch (err) { /* already gone */ }
            }, STOP_GRACE_MS);
            child.once('exit', () => {
                clearTimeout(timer);
                resolve();
            });
            try {
                child.stdin?.write('q\n');
                child.stdin?.end();
            } catch (err) {
                try { child.kill('SIGTERM'); } catch (e) { /* already gone */ }
            }
        });
        await this.measureFile();
        return this.stats;
    }

    private async measureFile(): Promise<void> {
        try {
            const stat = await fs.stat(this.stats.filePath);
            this.stats.bytesOnDisk = stat.size;
        } catch (err) {
            this.stats.bytesOnDisk = 0;
        }
    }

    private onPcm(chunk: Buffer): void {
        if (this.stats.firstChunkAt === null) {
            this.stats.firstChunkAt = Date.now();
        }
        const data = this.leftover.length ? Buffer.concat([this.leftover, chunk]) : chunk;
        const usable = data.length - (data.length % 4);
        this.leftover = data.subarray(usable);
        if (!usable) {
            return;
        }
        // Copy into an aligned Float32Array (a Buffer slice may not be 4-aligned).
        const samples = new Float32Array(usable / 4);
        const view = new DataView(data.buffer, data.byteOffset, usable);
        for (let i = 0; i < samples.length; i++) {
            samples[i] = view.getFloat32(i * 4, true);
        }
        this.stats.samples += samples.length;
        this.emit('pcm', samples);
    }

    private fail(message: string): void {
        if (!this.stats.error) {
            this.stats.error = message;
            log.warn(message);
            this.emit('error', message);
        }
    }
}
