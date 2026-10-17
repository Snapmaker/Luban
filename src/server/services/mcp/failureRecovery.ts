/* eslint-disable camelcase */
// Evidence keys are snake_case: they are serialised straight into tool results.
//
// Modal cleanup after a FAILED tool call (#221).
//
// Why this exists: a failed operation can stop after selecting `G53` (machine
// workspace) or `G91` (relative distance) and before handing the controller
// back its normal `G90`/`G54`. Luban then refuses ordinary jogging, the
// position of record goes incoherent, and - worse - an agent may read a later
// command's coordinate or distance mode wrongly. Every tool call goes through
// ToolRegistry.call(), so that is where the hook runs, still inside the call's
// ownership gate: it reads a per-call "modal ledger" of what was actually sent
// and decides, with stated reasons, whether a no-motion restore is warranted
// and permitted.
//
// What it never does: retry the failed command, send an axis word, turn the
// failure into a success, set or clear the position of record, or talk to a
// connection generation the operation did not start on.
//
// Pure apart from node's async_hooks: no Luban server imports. The runtime
// pieces (send, connection, position) are injected, and unit-tested with fakes
// in tests/failureRecovery.test.ts.
import { AsyncLocalStorage } from 'async_hooks';

import { isProcedureStopped } from './procedureAbort';
import { DISTANCE_MODE_WARNING, WorkspaceVerification, describeFrameLatch, verifyWorkFrame } from './frameRecovery';
import { FrameLatch, getFrameLatch, latchFrameUncertain, noteFrameRestored } from './positionOfRecord';

// The workspace-verification rule is restore_work_frame's (frameRecovery.ts),
// shared so the two can never drift.
export { FRAME_VERIFY_MIN_BEAT_DELAY_MS, FRAME_VERIFY_MIN_OFFSET_MM } from './frameRecovery';

// The frame-uncertainty latch (positionOfRecord.ts) is shared with the USB
// pendant's queued runs and the restart carry-over: ONE record that G53 may be
// selected. This hook raises it before its own G54 (a lost reply still counts),
// marks the restore acknowledged, and leaves the clearing to getPositionSnapshot
// (tools/machine.ts) - the same path restore_work_frame uses - so a verified
// cleanup also releases the pendant's held crash guard and the lease's hold.

/** The explicit no-motion recovery an agent or operator can run afterwards. */
export const MANUAL_RECOVERY = 'restore_work_frame';

/**
 * Thrown by the injected send when nothing could go out (no channel, or a
 * channel without a direct path): the command is NOT SENT, not indeterminate.
 */
export class NotSentError extends Error {
    public readonly notSent: true = true;

    public constructor(message: string) {
        super(`NOT SENT: ${message}`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

// Transport failures: the payload may or may not have reached the controller.
// SSTP reports them as "Controller request failed (ECONNRESET|ETIMEDOUT|
// REQUEST_ERROR|transport error): ..."; a plain HTTP status code from the
// controller itself stays a rejection.
const INDETERMINATE_REPLY = new RegExp(
    'ECONN[A-Z]*|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|ENOTFOUND|EPIPE|REQUEST_ERROR|transport[ _]error'
    + '|connection changed during command execution',
    'i',
);

export type Workspace = 'G53' | 'G54' | 'G55' | 'G56' | 'G57' | 'G58' | 'G59';
export type DistanceMode = 'G90' | 'G91';
export type ModalWord = Workspace | DistanceMode;

/**
 * accepted: result 0. rejected: the controller refused a line - SSTP runs a
 * batch line by line and stops at the first failure, so the lines before it
 * DID run. indeterminate: transport error / connection changed mid-command -
 * it may or may not have run. not-sent: a queued item cancelled before it
 * reached the controller. pending: no reply yet (still queued or executing).
 */
export type SendOutcome = 'pending' | 'accepted' | 'rejected' | 'indeterminate' | 'not-sent';

/** Classify an executeGcode reply. executeGcode resolves {result 0|-1, text}; it does not reject. */
export function classifyReply(reply: { result: number; text?: string } | null | undefined): SendOutcome {
    if (!reply) {
        return 'indeterminate';
    }
    if (reply.result === 0) {
        return 'accepted';
    }
    const text = String(reply.text || '');
    if (/Cancelled after an earlier command failed|Machine connection ended before command execution/i.test(text)) {
        return 'not-sent';
    }
    if (INDETERMINATE_REPLY.test(text)) {
        return 'indeterminate';
    }
    return 'rejected';
}

export interface LedgerEntry {
    gcode: string;
    modal: ModalWord[];
    /** Connection generation the payload went out on. */
    connection: string;
    outcome: SendOutcome;
}

/**
 * The workspace/distance words in a payload, in order. Comments (`;...` and
 * `(...)`) are ignored; decimal subcodes (`G90.1` arc mode) are not distance
 * modes and are skipped.
 */
export function modalWords(gcode: string): ModalWord[] {
    const words: ModalWord[] = [];
    for (const rawLine of String(gcode).split(/\r?\n/)) {
        const line = rawLine.replace(/\([^)]*\)/g, ' ').replace(/;.*$/, '');
        const re = /G0*(\d+)(\.\d+)?/gi;
        let match: RegExpExecArray | null = re.exec(line);
        while (match) {
            const code = Number(match[1]);
            if (!match[2] && ((code >= 53 && code <= 59) || code === 90 || code === 91)) {
                words.push(`G${code}` as ModalWord);
            }
            match = re.exec(line);
        }
    }
    return words;
}

export class ModalLedger {
    public readonly entries: LedgerEntry[] = [];

    public closed = false;

    public readonly tool: string;

    public readonly mutating: boolean;

    /** The connection generation when the call began (null when no machine was connected). */
    public readonly startConnection: string | null;

    /**
     * A detached runner's ledger names the tool call that launched it: while
     * that call is still open (waiting on the runner) it is the same
     * operation, not "another" one.
     */
    public readonly owner: ModalLedger | null;

    public constructor(tool: string, mutating: boolean, startConnection: string | null = null, owner: ModalLedger | null = null) {
        this.tool = tool;
        this.mutating = mutating;
        this.startConnection = startConnection;
        this.owner = owner;
    }

    /** Record a send as it leaves; settle it with the reply. Ignored once closed. */
    public record(connection: string, gcode: string): (outcome: SendOutcome) => void {
        if (this.closed) {
            return () => undefined;
        }
        const entry: LedgerEntry = { gcode, modal: modalWords(gcode), connection, outcome: 'pending' };
        this.entries.push(entry);
        return (outcome: SendOutcome) => {
            entry.outcome = outcome;
        };
    }
}

// Per-call context: sends made anywhere inside a tool handler land on that
// call's ledger without threading it through every procedure. Detached
// runners outlive the call; their later sends hit a CLOSED ledger and are
// ignored (the job they belong to is "another operation" from then on).
const storage = new AsyncLocalStorage<ModalLedger>();
const openLedgers = new Set<ModalLedger>();

export async function runWithLedger<T>(ledger: ModalLedger, fn: () => Promise<T>): Promise<T> {
    openLedgers.add(ledger);
    return storage.run(ledger, fn);
}

/** Close a call's ledger: later (stray) sends are no longer attributed to it. */
export function closeLedger(ledger: ModalLedger): void {
    ledger.closed = true;
    openLedgers.delete(ledger);
}

/**
 * `M220 S<n>` is a modal override too, and it PERSISTS on the controller after
 * the run that sent it (the pendant's queued jogs assert `M220 S100` because
 * this build's M220 reports nothing). It is noted from every direct send, with
 * or without a ledger, so failure_recovery evidence and the pendant status can
 * both show it.
 */
export interface FeedOverride {
    gcode: string;
    at: number;
    connection: string;
    /**
     * True when the whole payload was accepted. SSTP runs a payload line by
     * line and stops at the first failure, and its reply does not say which
     * line failed, so an M220 in a payload that was rejected or went
     * indeterminate MAY have run: recorded with certain=false and `note`.
     */
    certain: boolean;
    note: string | null;
}

let feedOverride: FeedOverride | null = null;
const FEED_OVERRIDE_WORD = /(?:^|\n)\s*(M220\s+S\d+(?:\.\d+)?)\s*;?\s*(?:\n|$)/i;

export function getFeedOverride(): FeedOverride | null {
    return feedOverride ? { ...feedOverride } : null;
}

/** Forget the noted override (tests, or after the operator restores the touchscreen speed). */
export function clearFeedOverride(): void {
    feedOverride = null;
}

const FEED_OVERRIDE_UNCERTAIN = 'the payload carrying it was not fully accepted; SSTP runs lines in order, stops at the first '
    + 'failure and does not report which line failed, so the override may or may not be in force';

function feedOverrideWarning(override: FeedOverride): string {
    const when = `at ${new Date(override.at).toISOString()} (connection ${override.connection})`;
    if (!override.certain) {
        return `${override.gcode} was sent ${when} but ${FEED_OVERRIDE_UNCERTAIN}. If it ran it PERSISTS: the controller keeps a feed `
            + 'override for later file jobs too, so a reduced touchscreen speed % would be overridden until it is set again.';
    }
    return `${override.gcode} was sent ${when} and PERSISTS: the controller keeps that feed override for later file jobs too, so a `
        + 'reduced touchscreen speed % is overridden until it is set again.';
}

/** Called by the direct send path for every payload; the ledger part is a no-op outside a tool call. */
export function recordModalSend(connection: string, gcode: string): (outcome: SendOutcome) => void {
    const ledger = storage.getStore();
    const settle = ledger ? ledger.record(connection, gcode) : () => undefined;
    const override = FEED_OVERRIDE_WORD.exec(String(gcode));
    if (!override) {
        return settle;
    }
    const word = override[1].replace(/\s+/g, ' ').toUpperCase();
    return (outcome: SendOutcome) => {
        settle(outcome);
        if (outcome === 'accepted') {
            feedOverride = { gcode: word, at: Date.now(), connection, certain: true, note: null };
        } else if (outcome === 'rejected' || outcome === 'indeterminate') {
            // The M220 line may have run before the line that failed (or it was
            // the failed line itself); a certain record of the same word already
            // in force is not downgraded by that doubt.
            if (!(feedOverride && feedOverride.certain && feedOverride.gcode === word)) {
                feedOverride = { gcode: word, at: Date.now(), connection, certain: false, note: FEED_OVERRIDE_UNCERTAIN };
            }
        }
    };
}

/** The ledger of the tool call (or detached runner) this code is running in, or null. */
export function currentLedger(): ModalLedger | null {
    return storage.getStore() || null;
}

/**
 * Run `fn` attributed to no ledger. AsyncLocalStorage otherwise carries the
 * launching call's ledger into anything started from it: a background
 * runner, or cleanup sent after one ends, would land on that call (and a
 * still-pending send would make a successful call look exposed). A runner
 * that should be judged gets its OWN ledger via runWithLedger instead.
 */
export async function detachFromLedger<T>(fn: () => Promise<T>): Promise<T> {
    return storage.exit(fn);
}

/** Other mutating operations still in progress, excluding `self` (and the call that launched it). */
export function otherMutatingOperations(self: ModalLedger | null): string[] {
    const own = self ? [self, self.owner] : [];
    return [...openLedgers].filter((l) => !own.includes(l) && l.mutating).map((l) => l.tool);
}

export interface Exposure {
    /** The call may have left G53, G91, or a mode it cannot account for. */
    exposed: boolean;
    /** Modes at the end of the call, assuming it began in G90/G54; 'unknown' where an unfinished payload carried that word. */
    state: { workspace: Workspace | 'unknown'; distance: DistanceMode | 'unknown' };
    pending_payloads: number;
    connections: string[];
    reasons: string[];
    /**
     * G53 may be the active workspace (it is, or an unknown workspace may be
     * G53). Absent means "cannot tell", treated as possible. An unknown
     * workspace that only a G55-G59 selection could explain is NOT restored
     * to G54: that selection was deliberate.
     */
    g53_possible?: boolean;
    /** File jobs only: which prefixes of the program may have been parsed when it ended. */
    file_window?: { from_line: number; to_line: number; total_lines: number; basis: string };
}

/**
 * Could the call have changed workspace or distance mode? Accepted payloads
 * are replayed in order; a rejected, indeterminate or pending payload makes
 * every mode it names unknown (part of it may have run). Not-sent payloads
 * changed nothing. G55-G59 accepted are deliberate selections, not exposure.
 */
export function assessExposure(entries: LedgerEntry[]): Exposure {
    let workspace: Workspace | 'unknown' = 'G54';
    let distance: DistanceMode | 'unknown' = 'G90';
    let pending = 0;
    let g53Possible = false;
    const reasons: string[] = [];
    for (const entry of entries) {
        if (entry.outcome === 'not-sent') {
            continue;
        }
        if (entry.outcome === 'pending') {
            pending += 1;
        }
        const known = entry.outcome === 'accepted';
        for (const word of entry.modal) {
            if (word === 'G90' || word === 'G91') {
                distance = known ? word : 'unknown';
            } else {
                workspace = known ? word : 'unknown';
                // An accepted selection settles it; one that may or may not have run only adds a possibility.
                g53Possible = known ? word === 'G53' : g53Possible || word === 'G53';
            }
        }
        if (!known && entry.modal.length) {
            reasons.push(`a ${entry.outcome} payload carried ${entry.modal.join('/')}: part of it may have run`);
        }
    }
    if (workspace === 'G53' || distance === 'G91') {
        reasons.push(`the last accepted payload left ${workspace === 'G53' ? 'G53' : ''}${workspace === 'G53' && distance === 'G91' ? '/' : ''}`
            + `${distance === 'G91' ? 'G91' : ''} selected`);
    }
    return {
        exposed: workspace === 'G53' || workspace === 'unknown' || distance === 'G91' || distance === 'unknown',
        state: { workspace, distance },
        pending_payloads: pending,
        connections: [...new Set(entries.filter((e) => e.outcome !== 'not-sent').map((e) => e.connection))],
        reasons,
        g53_possible: g53Possible,
    };
}

/** G53 is, or may be, the active workspace. */
function g53Exposed(exposure: Exposure): boolean {
    return exposure.state.workspace === 'G53' || (exposure.state.workspace === 'unknown' && exposure.g53_possible !== false);
}

/**
 * The commands to send, each its own call (SACP runs a multi-line payload in
 * parallel; SSTP would skip G54 after a failed G90). G54 only when G53 is or
 * may be active - a deliberate G55-G59, even one whose outcome is unknown, is
 * left alone (and warned about).
 */
export function restoreCommands(exposure: Exposure): string[] {
    const commands = ['G90'];
    if (g53Exposed(exposure)) {
        commands.push('G54');
    }
    return commands;
}

/** `connection-lost`: a file job whose machine state became unreadable before it was seen to end. */
export type FailureKind = 'thrown' | 'error-result' | 'timeout' | 'stopped' | 'connection-lost';

/**
 * The texts the server itself raises for a stop, a trip or an unexpected
 * contact: the latch messages (probeFeed: "CRASH ALARM latched ...",
 * "OVERTRAVEL ALARM latched ..."), the guarded-descent abort ("UNEXPECTED
 * CONTACT ..."), and the cooperative stop (procedureAbort: "Stopped on request
 * ..."). Upper-case markers match anywhere (a runner may wrap them); the stop
 * texts only as a prefix. Ordinary words such as "stopped" or "cancel" are
 * NOT markers: a timeout that quotes `machineStatus: stopped` is a timeout.
 */
const STOP_MARKERS = /CRASH ALARM|OVERTRAVEL ALARM|UNEXPECTED CONTACT/;
const STOP_PREFIXES = /^\s*(?:Stopped on request|Procedure stopped by stop_gcode_job)/;

function safeMessage(thrown: unknown): string {
    try {
        const err = thrown as { message?: unknown } | null;
        return String(err?.message ?? thrown);
    } catch (e) {
        return '';
    }
}

/**
 * Classify a failure from what the handler threw or returned. A stop, a
 * probe trip or an overtravel is `stopped`: the controller is in a state the
 * operator must look at, so nothing is sent after it. Only real markers count
 * (above); a latch set without one is still caught, from the real state, by
 * the authority guard before any send (skip_reason authority-closed).
 */
export function classifyFailure(threw: boolean, thrown: unknown, result: unknown): FailureKind | null {
    if (threw) {
        const message = safeMessage(thrown);
        if (isProcedureStopped(thrown) || STOP_MARKERS.test(message) || STOP_PREFIXES.test(message)) {
            return 'stopped';
        }
        if (/timed? ?out|timeout/i.test(message)) {
            return 'timeout';
        }
        return 'thrown';
    }
    if (!result || typeof result !== 'object') {
        return null;
    }
    const r = result as { ok?: unknown; error?: unknown; isError?: unknown; cancelled?: unknown; aborted?: unknown };
    if (r.cancelled === true || r.aborted === true) {
        return 'stopped';
    }
    if (r.ok === false || r.isError === true || (typeof r.error === 'string' && r.error.length > 0)) {
        return 'error-result';
    }
    return null;
}

export type SkipReason =
    | 'call-succeeded-with-modal-exposure'
    | 'job-completed-with-modal-exposure'
    | 'recovery-unavailable'
    | 'restore-tool-itself'
    | 'workspace-selection-unknown'
    | 'authority-closed'
    | 'not-applicable'
    | 'nothing-sent'
    | 'no-modal-change'
    | 'stopped-or-tripped'
    | 'disconnected'
    | 'connection-replaced'
    | 'commands-in-flight'
    | 'manual-control-active'
    | 'another-operation-active'
    | 'machine-not-idle';

export interface PositionReading {
    reliability: string;
    frame: string;
    /** Beat time the judged position rests on. */
    reportedAt: number | null;
    originOffset: { x: number; y: number; z: number };
    machineStatus: string | null;
    /**
     * The raw reported position, read AS a machine position, is outside the
     * travel: only then is a work-frame reading the sole possible one.
     */
    rawImpossibleAsMachine: boolean;
}

export interface RecoveryDeps {
    /** Connection generation now; null when no machine is connected. Never throws. */
    connectionId(): string | null;
    send(label: string, gcode: string): Promise<{ result: number; text?: string }>;
    settle(): Promise<void>;
    /** Only called while connected. */
    readPosition(): PositionReading | null;
    reliableForMotion(reliability: string): boolean;
    jobRunning(): boolean;
    manualControl(): boolean;
    /**
     * Who holds the exclusive gcode lease (machine/gcodeLease.ts) right now -
     * the USB pendant's queued run between its G53 and its closing G54 - or
     * null. Cleanup inside that window would be read in the wrong frame. The
     * lease's recovery HOLD is the frame latch, which this module reads itself.
     */
    leaseHolder(): string | null;
    /**
     * Why command authority is closed (crash/overtravel latch, unexpected
     * contact, a procedure stop request), or null. Read from the real state,
     * not from the error text; re-checked before every cleanup send.
     */
    authorityClosed(): string | null;
    now(): number;
}

export interface CommandEvidence {
    gcode: string;
    outcome: SendOutcome | 'not-sent';
    reply: string | null;
}

export interface RecoveryEvidence {
    status: 'attempted' | 'skipped' | 'failed';
    failure_kind: FailureKind | 'none';
    /** Set only when the hook itself threw. */
    hook_error?: string;
    tool: string;
    /** Set when the evidence belongs to a job (file job or detached procedure runner). */
    job_id?: string;
    exposure: Exposure;
    skip_reason: SkipReason | null;
    explanation: string;
    commands: CommandEvidence[];
    connection: { at_start: string | null; operation: string[]; at_cleanup: string | null };
    resulting_modes: { workspace: string; distance: string; workspace_verified: boolean; distance_verified: false } | null;
    position: {
        reliability: string | null;
        frame: string | null;
        trustworthy: boolean;
        note: string;
        /** The shared frame-uncertainty latch after this evidence was judged; motion and pendant arming are refused while set. */
        frame_uncertain: FrameLatch | null;
    };
    /** The last accepted `M220 S<n>` on the direct path; it persists on the controller. */
    feed_override: FeedOverride | null;
    recovery_action: string | null;
    warnings: string[];
}

// One wording for "G90 is never verified" (frameRecovery.ts), shared with the
// get_position side so the two statements cannot drift.
const MODE_WARNING = DISTANCE_MODE_WARNING;

/** The injected send reported that nothing went out (NotSentError, matched by its message prefix). */
function notSentError(error: string, reply: unknown): boolean {
    return reply === null && /^NOT SENT: /.test(error);
}

function safe<T>(fn: () => T, fallback: T): T {
    try {
        return fn();
    } catch (err) {
        return fallback;
    }
}

/**
 * What the cleanup decision needs to know about the operation that failed:
 * a tool call (its ledger), a detached runner (its own ledger), or a file job
 * (its exposure inferred from the program text).
 */
interface OperationContext {
    tool: string;
    jobId?: string;
    mutating: boolean;
    startConnection: string | null;
    exposure: Exposure;
    /** Anything reached (or may have reached) the controller. */
    sentSomething: boolean;
    /** The ledger this operation's sends were recorded on (excluded from "another operation"). */
    self: ModalLedger | null;
}

function ledgerContext(ledger: ModalLedger): OperationContext {
    return {
        tool: ledger.tool,
        mutating: ledger.mutating,
        startConnection: ledger.startConnection,
        exposure: assessExposure(ledger.entries),
        sentSomething: ledger.entries.some((e) => e.outcome !== 'not-sent'),
        self: ledger,
    };
}

/** Why cleanup may not be sent right now; null when it may. Re-checked before EVERY cleanup send. */
function authorityProblem(ctx: OperationContext, deps: RecoveryDeps): [SkipReason, string] | null {
    const { exposure } = ctx;
    const now = safe(() => deps.connectionId(), null);
    if (!now) {
        return ['disconnected', 'The machine is disconnected: command authority closed with the connection.'];
    }
    const foreign = [ctx.startConnection, ...exposure.connections].filter((c) => c !== now);
    if (foreign.length) {
        return ['connection-replaced', `The operation started on connection ${ctx.startConnection} and sent on `
            + `${exposure.connections.join(', ')}, but the current connection is ${now}: a reconnected controller has its `
            + 'own state, and cleanup aimed at the old one would land on the new one.'];
    }
    const closed = safe(() => deps.authorityClosed(), 'the safety latch state could not be read');
    if (closed) {
        return ['authority-closed', `Command authority is closed: ${closed}. The operator must inspect the machine first.`];
    }
    if (safe(() => deps.manualControl(), true)) {
        return ['manual-control-active', 'The USB pendant owns manual control.'];
    }
    const lease = safe(() => deps.leaseHolder(), 'an unreadable lease');
    if (lease) {
        return ['another-operation-active', `Another operation holds command authority: the gcode lease is held by ${lease}, `
            + 'which may have the machine workspace selected until it restores G54 itself. Cleanup sent now would land inside '
            + 'its window and be read in the wrong frame.'];
    }
    const others = otherMutatingOperations(ctx.self);
    const jobRunning = safe(() => deps.jobRunning(), true);
    if (others.length || jobRunning) {
        return ['another-operation-active', `Another operation owns the controller (${[...others, ...(jobRunning ? ['a running job'] : [])]
            .join(', ')}); cleanup would be injected into its command stream.`];
    }
    return null;
}

/** The evidence fields every outcome shares: the noted feed override and its warning. */
function sharedEvidence(): { feed_override: FeedOverride | null; warnings: string[] } {
    const override = getFeedOverride();
    return { feed_override: override, warnings: override ? [feedOverrideWarning(override)] : [] };
}

function skeleton(ctx: OperationContext, failureKind: FailureKind | 'none', deps: RecoveryDeps | null): RecoveryEvidence {
    const { exposure } = ctx;
    const shared = sharedEvidence();
    return {
        status: 'skipped',
        failure_kind: failureKind,
        tool: ctx.tool,
        ...(ctx.jobId ? { job_id: ctx.jobId } : {}),
        exposure,
        skip_reason: null,
        explanation: '',
        commands: [],
        connection: { at_start: ctx.startConnection, operation: exposure.connections, at_cleanup: deps ? safe(() => deps.connectionId(), null) : null },
        resulting_modes: null,
        position: { reliability: null, frame: null, trustworthy: false, note: 'not read', frame_uncertain: getFrameLatch() },
        feed_override: shared.feed_override,
        recovery_action: null,
        warnings: shared.warnings,
    };
}

/**
 * The frame latch is the one record that G53 may be selected. Evidence that
 * leaves G53 possible and unverified raises it when nothing else has (the
 * pendant, a restart, an earlier call), reports it, and marks the position
 * untrustworthy while it stands. A verified cleanup never clears it here: the
 * position snapshot does, exactly as for restore_work_frame.
 */
function reportFrameLatch(evidence: RecoveryEvidence, now: number): RecoveryEvidence {
    const unverified = g53Exposed(evidence.exposure) && !(evidence.resulting_modes && evidence.resulting_modes.workspace_verified);
    if (unverified && !getFrameLatch()) {
        let how: string;
        if (evidence.status === 'attempted') {
            how = 'its cleanup was accepted but is not verified';
        } else if (evidence.status === 'failed') {
            how = 'its cleanup failed';
        } else {
            how = `its cleanup was skipped (${evidence.skip_reason})`;
        }
        latchFrameUncertain(`${evidence.tool}${evidence.job_id ? ` (job ${evidence.job_id})` : ''} may have left the machine workspace `
            + `(G53) selected and ${how}.`, now);
    }
    const latch = getFrameLatch();
    evidence.position.frame_uncertain = latch;
    if (latch) {
        evidence.position.trustworthy = false;
        if (unverified) {
            evidence.recovery_action = MANUAL_RECOVERY;
            evidence.warnings.push(describeFrameLatch(latch));
        }
    }
    return evidence;
}

/** Record a skip on `evidence`, with the manual recovery and warnings wherever the controller may be left exposed. */
function skipped(evidence: RecoveryEvidence, reason: SkipReason, explanation: string): RecoveryEvidence {
    const { exposure } = evidence;
    evidence.skip_reason = reason;
    evidence.explanation = explanation;
    if (reason !== 'not-applicable' && reason !== 'nothing-sent' && reason !== 'no-modal-change') {
        evidence.recovery_action = MANUAL_RECOVERY;
        evidence.warnings.push(`Modal cleanup was SKIPPED (${reason}): the controller may still be in `
            + `${exposure.state.workspace}/${exposure.state.distance}. When the controller is idle, no job is starting or `
            + `running (${MANUAL_RECOVERY} refuses then) and you own it, call ${MANUAL_RECOVERY} (no motion) and then `
            + 'get_position before any motion.', MODE_WARNING);
    }
    return evidence;
}

/** Why the next cleanup send may not go out: the authority guards, then the machine's own status (re-checked per send). */
function sendProblem(ctx: OperationContext, deps: RecoveryDeps): [SkipReason, string] | null {
    const problem = authorityProblem(ctx, deps);
    if (problem) {
        return problem;
    }
    const status = safe(() => deps.readPosition()?.machineStatus ?? null, null);
    return status === 'idle' ? null : ['machine-not-idle', `The heartbeat machine status is ${status === null ? 'unknown' : status}, not idle.`];
}

const WORKSPACE_TEXT: Record<WorkspaceVerification, string> = {
    verified: 'G54 (a post-cleanup status report is only possible in the work frame)',
    'consistent-unverified': 'G54 accepted, consistent with work frame, unverified (the report would also fit the machine frame)',
    'unverifiable-zero-offset': 'G54 accepted, workspace unverifiable: the work offset is ~0 so both frames read alike',
    'machine-frame': 'G54 accepted, but a status report after it still reads as the MACHINE frame',
    'no-fresh-beat': 'G54 accepted, workspace unverified (no status report judged after the cleanup yet)',
};

async function decideAndRecover(ctx: OperationContext, failureKind: FailureKind, deps: RecoveryDeps): Promise<RecoveryEvidence> {
    const { exposure } = ctx;
    const evidence = skeleton(ctx, failureKind, deps);
    const skip = (reason: SkipReason, explanation: string): RecoveryEvidence => skipped(evidence, reason, explanation);
    if (!ctx.mutating) {
        return skip('not-applicable', 'Read-only tool.');
    }
    if (!ctx.sentSomething) {
        return skip('nothing-sent', 'The call sent nothing to the controller, so its modes are unchanged.');
    }
    if (!exposure.exposed) {
        return skip('no-modal-change', 'Every payload that reached the controller left it in G90 and a work workspace.');
    }
    if (ctx.tool === MANUAL_RECOVERY) {
        return skip('restore-tool-itself', `${MANUAL_RECOVERY} is itself the recovery: its own failure is reported, never `
            + 'retried automatically.');
    }
    if (failureKind === 'stopped') {
        return skip('stopped-or-tripped', 'The call ended in a stop, probe trip or overtravel: the controller state needs '
            + 'the operator, so nothing is sent automatically.');
    }
    if (exposure.pending_payloads > 0) {
        return skip('commands-in-flight', `${exposure.pending_payloads} payload(s) never got a reply and may still be `
            + 'queued: a restore sent now could run BEFORE them and be undone by them.');
    }
    const unknownSelection = exposure.state.workspace === 'unknown' && !g53Exposed(exposure)
        ? 'The workspace is unknown: a G55-G59 selection may or may not have run. It was a deliberate selection, so it is '
            + 'not reset to G54 - read get_position (originOffset) to see which workspace is active before work-frame motion.'
        : null;
    if (unknownSelection && exposure.state.distance === 'G90') {
        evidence.warnings.push(unknownSelection);
        return skip('workspace-selection-unknown', 'Only a G55-G59 selection is in doubt and the distance mode is G90: '
            + 'there is nothing to restore.');
    }
    // The frame latch already set (by the pendant, a restart, or an earlier
    // call) means a recovery hold is in force: its restore is the operator's
    // or the agent's one restore_work_frame, never a second G90/G54 from here.
    const prior = getFrameLatch();
    if (prior) {
        return skip('another-operation-active', 'Another operation holds command authority: the frame-uncertainty latch is already '
            + `set (${prior.reason}) and its recovery hold admits only ${MANUAL_RECOVERY}, Luban's UI Home and queries. A second cleanup `
            + `would duplicate that restore, so nothing was sent; call ${MANUAL_RECOVERY} once the controller is idle.`);
    }
    const problem = sendProblem(ctx, deps);
    if (problem) {
        return skip(problem[0], problem[1]);
    }
    if (unknownSelection) {
        evidence.warnings.push(unknownSelection);
    }

    evidence.status = 'attempted';
    const commands = restoreCommands(exposure);
    evidence.explanation = `Restoring ${commands.join(' then ')} as separate commands with no axis words.`;
    const sentG54 = commands.includes('G54');
    if (sentG54) {
        // Raised BEFORE the sends, as the pendant does before its G53: a lost
        // reply to the G54 still leaves the machine workspace possible.
        latchFrameUncertain(`${ctx.tool}${ctx.jobId ? ` (job ${ctx.jobId})` : ''} failed after it may have selected the machine `
            + 'workspace (G53); the failed-call cleanup is restoring G90 then G54.', safe(() => deps.now(), Date.now()));
    }
    const label = `failure-recovery:${ctx.tool}`;
    let ok = true;
    let lastReplyAt = 0;
    for (const gcode of commands) {
        const blocked = ok ? sendProblem(ctx, deps) : null;
        if (!ok || blocked) {
            evidence.commands.push({ gcode, outcome: 'not-sent', reply: blocked ? `blocked: ${blocked[0]}` : null });
            ok = false;
            continue;
        }
        let reply: { result: number; text?: string } | null = null;
        let error: string | null = null;
        try {
            // eslint-disable-next-line no-await-in-loop
            reply = await deps.send(label, gcode);
        } catch (err) {
            error = String((err as Error)?.message || err);
        }
        lastReplyAt = safe(() => deps.now(), 0);
        const outcome = error !== null && notSentError(error, reply) ? 'not-sent' : classifyReply(reply);
        evidence.commands.push({ gcode, outcome, reply: error || reply?.text || null });
        ok = outcome === 'accepted';
        if (ok && gcode === 'G54') {
            // The same acknowledgement restore_work_frame records: G54 synchronizes
            // the planner, and a verified position after it clears the latch.
            noteFrameRestored(lastReplyAt);
        }
    }
    if (!ok) {
        evidence.status = 'failed';
        evidence.recovery_action = MANUAL_RECOVERY;
        evidence.warnings.push(`Modal cleanup INCOMPLETE: ${evidence.commands.map((c) => `${c.gcode}=${c.outcome}`).join(', ')}. `
            + `The controller's workspace and distance mode are unknown. Call ${MANUAL_RECOVERY} (no motion) when the `
            + 'controller is idle, then get_position, before any motion.', MODE_WARNING);
        return evidence;
    }

    // Verify the workspace from a status report taken AFTER the cleanup reply,
    // with restore_work_frame's rule (frameRecovery.verifyWorkFrame): a fresh
    // beat (>= one poll period after the reply), a work offset beyond 0.5 mm,
    // a work-frame judgement AND the raw report impossible as a machine
    // position. The distance mode has no status field: never claimed
    // verified. Nothing here sets or clears the position of record; reading
    // the position runs the snapshot that clears the frame latch once the
    // beat after the restore verifies it (tools/machine.ts).
    await deps.settle().catch(() => undefined);
    const reading = safe(() => deps.connectionId(), null) ? safe(() => deps.readPosition(), null) : null;
    const verification = verifyWorkFrame(reading, lastReplyAt);
    const workspaceVerified = sentG54 && verification === 'verified';
    const workspaceText = sentG54 ? WORKSPACE_TEXT[verification] : `${exposure.state.workspace} kept (deliberate selection), not re-verified`;
    evidence.resulting_modes = {
        workspace: workspaceText,
        distance: 'G90 accepted, distance mode unverified',
        workspace_verified: workspaceVerified,
        distance_verified: false,
    };
    if (reading) {
        // A `verified` reliability is a controller echo of a move, and its
        // frame label is 'machine-frame' by construction (machinePosition.ts):
        // that label says nothing about the workspace, and the echo is not
        // invalidated by an ordinary delayed heartbeat. Any other reading is
        // trustworthy only in a frame proven by the cleanup's own verification
        // (or when G54 was not touched). awaiting-resync / stale stay named.
        const echo = reading.reliability === 'verified';
        const reliable = deps.reliableForMotion(reading.reliability);
        let note = verification === 'no-fresh-beat'
            ? 'no status report after the cleanup yet: this judgement predates it'
            : 'judged from a status report taken after the cleanup';
        if (echo) {
            note = 'The position of record was a verified echo taken before the cleanup. The cleanup sends voided that echo '
                + 'record (each send bumps the gcode sequence), but they carried no axis words, so the position is physically '
                + 'still valid. Re-read get_position before motion: it will rest on the next status report.';
        }
        evidence.position = {
            reliability: reading.reliability,
            frame: reading.frame,
            trustworthy: reliable && (echo || (reading.frame !== 'machine-frame' && (!sentG54 || workspaceVerified))),
            note,
            frame_uncertain: getFrameLatch(),
        };
    } else {
        evidence.position.note = 'position could not be read after the cleanup';
    }
    if ((sentG54 && !workspaceVerified) || !evidence.position.trustworthy) {
        evidence.recovery_action = MANUAL_RECOVERY;
        evidence.warnings.push('The cleanup commands were accepted but restoration is NOT verified'
            + `${reading ? ` (position ${reading.reliability}, frame ${reading.frame})` : ''}. Read get_position; if it is `
            + `not coherent, call ${MANUAL_RECOVERY} (no motion) or query_firmware_position.`);
    }
    evidence.warnings.push(MODE_WARNING);
    return evidence;
}

/** decideAndRecover plus the shared frame-latch report, for every operation kind. */
async function recoverOperation(ctx: OperationContext, failureKind: FailureKind, deps: RecoveryDeps): Promise<RecoveryEvidence> {
    const evidence = await decideAndRecover(ctx, failureKind, deps);
    return reportFrameLatch(evidence, safe(() => deps.now(), Date.now()));
}

/**
 * The hook proper. Called once, after the handler has failed and its ledger
 * has been closed, while the call still holds the ownership gate. Never
 * throws: the original failure is what the caller reports; this only adds
 * evidence.
 */
export async function recoverAfterFailure(ledger: ModalLedger, failureKind: FailureKind, deps: RecoveryDeps): Promise<RecoveryEvidence> {
    return recoverOperation(ledgerContext(ledger), failureKind, deps);
}

/**
 * A call that SUCCEEDED but left G53, G91 or an unknown mode behind. Nothing
 * is sent (a success is never second-guessed with commands), but the agent is
 * told, because the next relative or machine-frame program would inherit it.
 */
export function exposureAfterSuccess(ledger: ModalLedger, deps: RecoveryDeps | null = null): RecoveryEvidence | null {
    if (!ledger.mutating) {
        return null;
    }
    const exposure = assessExposure(ledger.entries);
    // A payload still pending belongs to something that outlives the call (it
    // is judged by its own job when that ends), and a running job owns the
    // modes: a success reports only what it settled itself.
    if (!exposure.exposed || exposure.pending_payloads > 0 || (deps && safe(() => deps.jobRunning(), false))) {
        return null;
    }
    const shared = sharedEvidence();
    return reportFrameLatch({
        status: 'skipped',
        failure_kind: 'none',
        tool: ledger.tool,
        exposure,
        skip_reason: 'call-succeeded-with-modal-exposure',
        explanation: 'The call succeeded but its last payloads left a non-default or unknown mode; nothing was sent.',
        commands: [],
        connection: { at_start: ledger.startConnection, operation: exposure.connections, at_cleanup: null },
        resulting_modes: null,
        position: { reliability: null, frame: null, trustworthy: false, note: 'not read', frame_uncertain: null },
        feed_override: shared.feed_override,
        recovery_action: MANUAL_RECOVERY,
        warnings: [`The controller may still be in ${exposure.state.workspace}/${exposure.state.distance} after this call. `
            + `Call ${MANUAL_RECOVERY} (no motion) before ordinary jogging, and declare G90/G91 and the workspace in every `
            + 'later program.', MODE_WARNING, ...shared.warnings],
    }, deps ? safe(() => deps.now(), Date.now()) : Date.now());
}

/** Evidence when the hook itself failed: whatever it sent, modes and position are unknown. */
export function hookFailureEvidence(ledger: ModalLedger, failureKind: FailureKind, err: unknown): RecoveryEvidence {
    const exposure = safe(() => assessExposure(ledger.entries), {
        exposed: true,
        state: { workspace: 'unknown', distance: 'unknown' },
        pending_payloads: 0,
        connections: [],
        reasons: ['exposure could not be assessed'],
    } as Exposure);
    const shared = safe(() => sharedEvidence(), { feed_override: null, warnings: [] });
    const evidence: RecoveryEvidence = {
        status: 'failed',
        failure_kind: failureKind,
        tool: ledger.tool,
        exposure,
        skip_reason: null,
        explanation: 'The cleanup hook itself failed.',
        hook_error: String((err as Error)?.message || err),
        commands: [],
        connection: { at_start: ledger.startConnection, operation: exposure.connections, at_cleanup: null },
        resulting_modes: null,
        position: { reliability: null, frame: null, trustworthy: false, note: 'unknown: the cleanup hook failed', frame_uncertain: null },
        feed_override: shared.feed_override,
        recovery_action: MANUAL_RECOVERY,
        warnings: ['The modal cleanup hook failed part way: cleanup commands may or may not have been sent. The workspace, '
            + `distance mode and position are UNKNOWN. Call ${MANUAL_RECOVERY} (no motion) when the controller is idle, then `
            + 'get_position, before any motion.', MODE_WARNING, ...shared.warnings],
    };
    return safe(() => reportFrameLatch(evidence, Date.now()), evidence);
}

/** True when the evidence is worth showing (a no-op skip is not). */
export function evidenceIsRelevant(evidence: RecoveryEvidence | null): evidence is RecoveryEvidence {
    return !!evidence && !['not-applicable', 'nothing-sent', 'no-modal-change'].includes(String(evidence.skip_reason));
}

/** Appended to a thrown error's text, after the original message, so the evidence reaches the agent. */
export function describeEvidence(evidence: RecoveryEvidence): string {
    return `failure_recovery: ${JSON.stringify(evidence)}`;
}

// ---------------------------------------------------------------------------
// Jobs that end outside the tool call that started them.
//
// A detached procedure runner sends through the direct path like any tool,
// but after the starting call's ledger has closed: it gets its own ledger
// (finishDetachedLedger). A FILE job runs on the controller's own
// interpreter, so nothing it does passes through a ledger at all: its
// exposure is inferred from the program text (fileModalExposure) and judged
// by how the job ended (recoverAfterJobEnd).
// ---------------------------------------------------------------------------

/**
 * A detached runner's ledger has ended: close it and judge it exactly as the
 * registry judges a tool call (same exposure, same guards, same evidence).
 * Cleanup runs attributed to no ledger, so it never lands on the call that
 * launched the runner. Never throws; null when there is nothing to report.
 */
export async function finishDetachedLedger(
    ledger: ModalLedger,
    outcome: { threw: boolean; thrown?: unknown },
    deps: RecoveryDeps | null,
    jobId?: string,
): Promise<RecoveryEvidence | null> {
    closeLedger(ledger);
    const kind = outcome.threw ? classifyFailure(true, outcome.thrown, undefined) : null;
    let evidence: RecoveryEvidence | null;
    if (!kind) {
        evidence = exposureAfterSuccess(ledger);
    } else if (!deps) {
        const ctx = { ...ledgerContext(ledger), jobId };
        evidence = ctx.mutating && ctx.sentSomething && ctx.exposure.exposed
            ? skipped(skeleton(ctx, kind, null), 'recovery-unavailable', 'No cleanup runtime is attached, so nothing was sent.')
            : null;
    } else {
        const ctx = { ...ledgerContext(ledger), jobId };
        evidence = await detachFromLedger(async () => recoverOperation(ctx, kind, deps))
            .catch((err) => hookFailureEvidence(ledger, kind, err));
    }
    if (evidence && jobId) {
        evidence.job_id = jobId;
    }
    return evidenceIsRelevant(evidence) ? evidence : null;
}

/**
 * Lines a stop can flush unparsed from the controller's command queue: the
 * last `currentLine` seen is trusted as parsed only this many lines back.
 */
export const FILE_JOB_QUEUE_MARGIN_LINES = 16;

/** What the status polls established about how far a file job got. */
export interface FileLineEvidence {
    /** Highest `currentLine` (1-based parser line) seen while the job ran; null = never read. */
    lastLine: number | null;
    /** The controller's `totalLines`, when it reported one (a mismatch with the file widens the margin). */
    totalLines: number | null;
    /** Highest progress seen, as a fraction 0..1; null = never read. */
    lastProgress: number | null;
    /** The program ran to its end (a normal completion, no stop seen). */
    ranToEnd: boolean;
}

interface ProgramModes {
    workspace: Workspace;
    distance: DistanceMode;
}

/**
 * The modes a file job may have left the controller in, from its program text.
 *
 * Modal words take effect when the controller PARSES a line, and its parser
 * runs far ahead of the cutter (executionModel.ts: the whole file within
 * seconds), so after a stop or failure every line past the last reading may
 * already have been parsed: the candidates are the modes after each prefix
 * from the last line known parsed to the END of the file. One candidate is a
 * known mode; several make that mode 'unknown'. No reading at all puts the
 * whole file in play. A completed run leaves the modes of the full file.
 * Starts from G90/G54 like assessExposure: a file that names no mode changed
 * nothing.
 */
export function fileModalExposure(program: string, evidence: FileLineEvidence): Exposure {
    const lines = String(program).split(/\r?\n/);
    const total = lines.length;
    const after: ProgramModes[] = [{ workspace: 'G54', distance: 'G90' }];
    let modes = after[0];
    for (const line of lines) {
        for (const word of modalWords(line)) {
            modes = word === 'G90' || word === 'G91' ? { ...modes, distance: word } : { ...modes, workspace: word };
        }
        after.push(modes);
    }
    let from = 0;
    let basis = 'no line or progress reading: the position in the file is unknown, so every prefix is possible';
    if (evidence.ranToEnd) {
        from = total;
        basis = 'the program ran to its end';
    } else {
        const mismatch = evidence.totalLines && evidence.totalLines > 0 ? Math.abs(evidence.totalLines - total) : 0;
        const bounds: Array<[number, string]> = [];
        if (evidence.lastLine !== null && Number.isFinite(evidence.lastLine) && evidence.lastLine > 0) {
            bounds.push([evidence.lastLine - FILE_JOB_QUEUE_MARGIN_LINES - mismatch, `parser line ${evidence.lastLine}`
                + ` less ${FILE_JOB_QUEUE_MARGIN_LINES} queued${mismatch ? ` and ${mismatch} for a totalLines mismatch` : ''}`]);
        }
        // Progress is only a fallback: its scale (fraction or percent) is inferred, the line is exact.
        if (!bounds.length && evidence.lastProgress !== null && Number.isFinite(evidence.lastProgress) && evidence.lastProgress > 0) {
            const fraction = Math.min(evidence.lastProgress, 1);
            bounds.push([Math.floor(fraction * total) - Math.max(FILE_JOB_QUEUE_MARGIN_LINES, Math.ceil(total * 0.05)),
                `progress ${(fraction * 100).toFixed(1)} % less a 5 % margin`]);
        }
        if (bounds.length) {
            const best = bounds.reduce((a, b) => (b[0] > a[0] ? b : a));
            from = Math.max(0, Math.min(total, best[0]));
            basis = `${best[1]}; every line after it may already have been parsed (the parser runs ahead of the cutter)`;
        }
    }
    const candidates = after.slice(from);
    const workspaces = [...new Set(candidates.map((m) => m.workspace))];
    const distances = [...new Set(candidates.map((m) => m.distance))];
    const workspace: Workspace | 'unknown' = workspaces.length === 1 ? workspaces[0] : 'unknown';
    const distance: DistanceMode | 'unknown' = distances.length === 1 ? distances[0] : 'unknown';
    const reasons: string[] = [];
    if (workspace === 'unknown' || distance === 'unknown') {
        const possible = [...(workspace === 'unknown' ? workspaces : []), ...(distance === 'unknown' ? distances : [])];
        reasons.push(`the job may have ended anywhere after line ${from} of ${total}, where the controller could be in ${possible.join('/')}`);
    }
    if (workspace === 'G53' || distance === 'G91') {
        const left = [workspace === 'G53' ? 'G53' : '', distance === 'G91' ? 'G91' : ''].filter(Boolean).join('/');
        reasons.push(`the program ${evidence.ranToEnd ? 'leaves' : 'had'} ${left} selected`);
    }
    return {
        exposed: workspace === 'G53' || workspace === 'unknown' || distance === 'G91' || distance === 'unknown',
        state: { workspace, distance },
        pending_payloads: 0,
        connections: [],
        reasons,
        g53_possible: workspaces.includes('G53'),
        file_window: { from_line: from, to_line: total, total_lines: total, basis },
    };
}

/**
 * How a file job ended, for the cleanup policy:
 *  - completed: ran to its end; nothing is ever sent (a warning when it left G53/G91).
 *  - stopped: stop_gcode_job by the agent or operator; the stop closes command authority.
 *  - authority-closed: a crash/overtravel latch or other safety stop was set when it ended.
 *  - connection-lost: machine state became unreadable; the job was never seen to end.
 *  - failed: the job failed on its own (a rejected line, a controller error) - the only
 *    case that may get the automatic G90/G54, under exactly the call hook's guards.
 */
export type JobEndCategory = 'completed' | 'stopped' | 'authority-closed' | 'connection-lost' | 'failed';

export interface JobEndInput {
    jobId: string;
    /** Shown as the evidence's tool, e.g. `file-job:<name>`. */
    tool: string;
    category: JobEndCategory;
    /** Why it ended, in words (the job's ending reason). */
    reason: string;
    exposure: Exposure;
    /** Connection generation captured when the job started; null when unknown. */
    startConnection: string | null;
    /** For `failed`: how it failed (default error-result). */
    failureKind?: FailureKind;
}

/**
 * The job-end counterpart of the call hook. Never throws; null when the job
 * cannot have left a non-preferred mode. Everything except `failed` is
 * reported and skipped; `failed` runs the same guarded cleanup as a failed
 * tool call (same connection generation as at job start, no other operation,
 * job or pendant, idle, no latch, nothing in flight, nothing retried).
 */
export async function recoverAfterJobEnd(input: JobEndInput, deps: RecoveryDeps | null): Promise<RecoveryEvidence | null> {
    if (!input.exposure.exposed) {
        return null;
    }
    const ctx: OperationContext = {
        tool: input.tool,
        jobId: input.jobId,
        mutating: true,
        startConnection: input.startConnection,
        // The file ran on the connection it was started on: a different one now is a replaced controller.
        exposure: { ...input.exposure, connections: input.startConnection ? [input.startConnection] : [] },
        sentSomething: true,
        self: null,
    };
    const kind = input.failureKind || 'error-result';
    const clock = (): number => (deps ? safe(() => deps.now(), Date.now()) : Date.now());
    try {
        if (input.category === 'failed') {
            if (!deps) {
                return reportFrameLatch(skipped(skeleton(ctx, kind, null), 'recovery-unavailable',
                    `The job failed (${input.reason}) and no cleanup runtime is attached, so nothing was sent.`), clock());
            }
            if (!input.startConnection) {
                return reportFrameLatch(skipped(skeleton(ctx, kind, deps), 'connection-replaced', `The job failed (${input.reason}), but its `
                    + 'connection generation at start was not captured, so the current connection cannot be proven to be the '
                    + 'one it ran on.'), clock());
            }
            return await detachFromLedger(async () => recoverOperation(ctx, kind, deps));
        }
        if (input.category === 'completed') {
            const evidence = skeleton(ctx, 'none', deps);
            evidence.skip_reason = 'job-completed-with-modal-exposure';
            evidence.explanation = 'The job completed, but its program leaves a non-default or unknown mode; nothing was sent.';
            evidence.recovery_action = MANUAL_RECOVERY;
            evidence.warnings.push(`The controller may still be in ${ctx.exposure.state.workspace}/${ctx.exposure.state.distance} `
                + `after this job. Call ${MANUAL_RECOVERY} (no motion) before ordinary jogging, and declare G90/G91 and the `
                + 'workspace in every later program.', MODE_WARNING);
            return reportFrameLatch(evidence, clock());
        }
        if (input.category === 'stopped') {
            return reportFrameLatch(skipped(skeleton(ctx, 'stopped', deps), 'stopped-or-tripped', `The job was stopped (${input.reason}). `
                + 'A stop closes command authority: the controller state needs the operator, so nothing is sent automatically.'), clock());
        }
        if (input.category === 'authority-closed') {
            return reportFrameLatch(skipped(skeleton(ctx, 'stopped', deps), 'authority-closed', `Command authority is closed (${input.reason}). `
                + 'The operator must inspect the machine first; nothing is sent automatically.'), clock());
        }
        const now = deps ? safe(() => deps.connectionId(), null) : null;
        return reportFrameLatch(skipped(skeleton(ctx, 'connection-lost', deps), now && now !== input.startConnection ? 'connection-replaced' : 'disconnected',
            `The machine state became unreadable while the job ran (${input.reason}); the job was never seen to end, so `
            + 'command authority is not established and nothing is sent.'), clock());
    } catch (err) {
        const evidence = skeleton(ctx, kind, null);
        evidence.status = 'failed';
        evidence.hook_error = String((err as Error)?.message || err);
        evidence.explanation = 'The job-end cleanup hook itself failed.';
        evidence.recovery_action = MANUAL_RECOVERY;
        evidence.warnings.push('The modal cleanup hook failed part way: cleanup commands may or may not have been sent. The '
            + `workspace, distance mode and position are UNKNOWN. Call ${MANUAL_RECOVERY} (no motion) when the controller is `
            + 'idle, then get_position, before any motion.', MODE_WARNING);
        return evidence;
    }
}
