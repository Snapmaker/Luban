// Exclusive gcode lease for a run that changes controller modal state across
// several requests (the USB pendant's queued G53 window). While it is held,
// every command from anyone else is refused at the channels (executeGcode and
// the SSTP job/override endpoints) and at the ConnectionManager entry points,
// so nothing can land between the run's G53 and its closing G54 and be read in
// the wrong frame. A UI "go to work origin" (G0 X0 Y0, G0 Z0) inside that
// window would be a machine-frame plunge, and a UI G54/G91/G92 would shift the
// run's next G1.
//
// The holder's own commands are recognised by async context (runAs), so no
// channel signature changes. The holder releases in `finally`.
//
// The RECOVERY HOLD is the frame-uncertainty latch (mcp/positionOfRecord.ts),
// read directly: there is no second state to fall out of step with it. While
// the latch is set, everyone is refused everything except no-motion frame
// recovery, Luban's own UI Home sequence, position queries, spindle off and
// job stop/pause, and no new lease is granted. (The MCP `home` tool and the
// pendant page's Home go through requireReliableMachine, which refuses on any
// latch: the routes out are restore_work_frame and the UI Home button.) The hold ends exactly when the latch clears - after an
// acknowledged restore AND a verified position (tools/machine.ts
// getPositionSnapshot) - whoever raised it: the pendant, the failed-call
// cleanup hook, or a Luban restart. `holdForRecovery` therefore re-raises the
// latch when none is set (2026-10-05 review: a hold that outlived its latch
// could never clear).
import { AsyncLocalStorage } from 'async_hooks';

import { getFrameLatch, latchFrameUncertain } from '../mcp/positionOfRecord';

interface Holder {
    id: number;
    owner: string;
    acquiredAt: number;
    expiresAt: number;
    /** Per-request transport timeout the holder accepts while it holds the lease (ms); null = channel default. */
    requestTimeoutMs: number | null;
}

/** The latch the hold reads; injectable so test fixtures can bind their own copy. */
export interface FrameLatchBinding {
    get(): { reason: string; since: number; restoredAt: number | null } | null;
    raise(reason: string, now?: number): void;
}

const realLatch: FrameLatchBinding = { get: getFrameLatch, raise: latchFrameUncertain };

// What a recovery hold still admits, one of these per line. No axis motion.
const RECOVERY_LINE = /^(G90|G54|M5|M114|M400|M503(\s+S\d*)?|home|stop job|pause job);?$/i;

// Homing is admitted too - the operator may need it to recover - but ONLY as
// the whole `G53` / `G28` / `G54` sequence Luban's Home button and the MCP
// `home` tool send: a bare `G53` would select the machine workspace with
// nothing to hand it back, and a bare `G28` leaves the controller in an
// unselected workspace (observed: derived machine Y 464 / Z 656 on the A350).
const HOME_SEQUENCE: readonly RegExp[] = [/^G53;?$/i, /^G28[\sA-Z0-9.]*;?$/i, /^G54;?$/i];

/** True for exactly the three-line home sequence, in order. */
export function isHomeSequence(lines: string[]): boolean {
    return lines.length === HOME_SEQUENCE.length && lines.every((line, index) => HOME_SEQUENCE[index].test(line));
}

/**
 * Whether a payload may pass a recovery hold. `homing` admits the sequence's
 * lines one request at a time: ConnectionManager.goHome sends them as three
 * separate requests inside runAsHomeSequence.
 */
export function isRecoveryCommand(what: string, options: { homing?: boolean } = {}): boolean {
    const lines = what.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) { return false; }
    if (isHomeSequence(lines)) { return true; }
    return lines.every((line) => RECOVERY_LINE.test(line) || (options.homing === true && HOME_SEQUENCE.some((re) => re.test(line))));
}

export class GcodeLease {
    private holder: Holder | null = null;

    private nextId = 1;

    private context = new AsyncLocalStorage<number>();

    private homing = new AsyncLocalStorage<boolean>();

    private refused = 0;

    private lastRefusal: { at: number; what: string } | null = null;

    private expired = 0;

    private latch: FrameLatchBinding;

    public constructor(latch: FrameLatchBinding = realLatch) {
        this.latch = latch;
    }

    private current(now: number): Holder | null {
        if (this.holder && now >= this.holder.expiresAt) {
            this.expired += 1;
            this.holder = null;
        }
        return this.holder;
    }

    /** The recovery hold: the frame-uncertainty latch, as the lease reports it. */
    public recoveryHold(): { reason: string; since: number } | null {
        const latch = this.latch.get();
        return latch ? { reason: latch.reason, since: latch.since } : null;
    }

    /**
     * Take the lease (ttlMs may be Infinity). Throws when someone else holds an
     * unexpired one, or while the recovery hold is in force. `requestTimeoutMs`
     * shortens every transport request made while the lease is held, so a hung
     * request cannot keep the hold-time Restore waiting for the channel's own
     * (300 s) timeout.
     */
    public acquire(owner: string, ttlMs: number, now: number = Date.now(), requestTimeoutMs: number | null = null): number {
        const held = this.current(now);
        if (held) {
            throw new Error(`Machine commands are reserved by ${held.owner}.`);
        }
        const hold = this.recoveryHold();
        if (hold) {
            throw new Error(`The work frame must be recovered first (${hold.reason}).`);
        }
        const id = this.nextId;
        this.nextId += 1;
        this.holder = { id, owner, acquiredAt: now, expiresAt: now + ttlMs, requestTimeoutMs };
        return id;
    }

    /** Extend the holder's lease; false when it is no longer held by `id`. */
    public renew(id: number, ttlMs: number, now: number = Date.now()): boolean {
        const held = this.current(now);
        if (!held || held.id !== id) { return false; }
        held.expiresAt = now + ttlMs;
        return true;
    }

    public release(id: number): void {
        if (this.holder && this.holder.id === id) { this.holder = null; }
    }

    /**
     * Hand the lease over to the recovery hold: releases `id` if given and makes
     * sure the frame-uncertainty latch is set (re-raising it with `reason` when
     * a verified beat had already cleared it). Nothing but recovery passes until
     * the latch clears again.
     */
    public holdForRecovery(reason: string, id?: number, now: number = Date.now()): void {
        if (id !== undefined) { this.release(id); }
        if (!this.latch.get()) { this.latch.raise(reason, now); }
    }

    /** Run `fn` as the holder `id`: its commands (and their awaits) are admitted. */
    public async runAs<T>(id: number, fn: () => Promise<T>): Promise<T> {
        return this.context.run(id, fn);
    }

    /** Run a UI home (`G53`, `G28`, `G54` as separate requests) so its lines pass a recovery hold. */
    public async runAsHomeSequence<T>(fn: () => Promise<T>): Promise<T> {
        return this.homing.run(true, fn);
    }

    /** True while someone holds the lease (the caller included). */
    public isHeld(now: number = Date.now()): boolean {
        return this.current(now) !== null;
    }

    /** The transport timeout a request should use now: the holder's while the lease is held, else `defaultMs`. */
    public requestTimeoutMs(defaultMs: number, now: number = Date.now()): number {
        const held = this.current(now);
        return held && held.requestTimeoutMs !== null ? Math.min(defaultMs, held.requestTimeoutMs) : defaultMs;
    }

    /** null when this caller may command the machine, else the refusal text. */
    public refusal(what: string, now: number = Date.now()): string | null {
        const held = this.current(now);
        if (held && this.context.getStore() === held.id) { return null; }
        let reason: string | null = null;
        if (held) {
            reason = `machine commands are reserved by ${held.owner} until it restores the work frame. Stop or release the pendant first.`;
        } else {
            const hold = this.recoveryHold();
            if (hold && !isRecoveryCommand(what, { homing: this.homing.getStore() === true })) {
                reason = `the controller may still be in the machine workspace (${hold.reason}). Only Restore work frame `
                    + '(restore_work_frame or the pendant page\'s button), Luban\'s own UI Home button (its whole G53/G28/G54 '
                    + 'sequence), position queries, spindle off and job stop are accepted until a verified position clears it. '
                    + 'The MCP home tool and the pendant page\'s Home are refused while the frame is uncertain, and a re-home is '
                    + 'not the remedy.';
            }
        }
        if (!reason) { return null; }
        this.refused += 1;
        this.lastRefusal = { at: now, what: what.slice(0, 80) };
        return `Refused "${what.slice(0, 80)}": ${reason}`;
    }

    public status(now: number = Date.now()) {
        const held = this.current(now);
        return { held: held
            ? { owner: held.owner, ageMs: now - held.acquiredAt, expiresInMs: held.expiresAt - now, requestTimeoutMs: held.requestTimeoutMs }
            : null,
        recovery: this.recoveryHold(),
        refused: this.refused,
        lastRefusal: this.lastRefusal,
        expired: this.expired };
    }
}

export const gcodeLease = new GcodeLease();
