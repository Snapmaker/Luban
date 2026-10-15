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
// channel signature changes. The holder releases in `finally`. If it could not
// restore the work frame, it hands the lease over to a RECOVERY hold. That hold
// refuses everything except no-motion frame recovery, homing, position queries,
// spindle off and job stop/pause, until the frame-uncertainty latch clears
// (tools/machine.ts calls endRecovery).
import { AsyncLocalStorage } from 'async_hooks';

interface Holder {
    id: number;
    owner: string;
    acquiredAt: number;
    expiresAt: number;
}

// What a recovery hold still admits: every line one of these. No axis motion
// except homing, which the operator may need in order to recover.
const RECOVERY_LINE = /^(G90|G53|G54|G28[\sA-Z0-9.]*|M5|M114|M400|M503(\s+S\d*)?|home|stop job|pause job);?$/i;

export function isRecoveryCommand(what: string): boolean {
    const lines = what.split('\n').map((line) => line.trim()).filter(Boolean);
    return lines.length > 0 && lines.every((line) => RECOVERY_LINE.test(line));
}

export class GcodeLease {
    private holder: Holder | null = null;

    private recovery: { reason: string; since: number } | null = null;

    private nextId = 1;

    private context = new AsyncLocalStorage<number>();

    private refused = 0;

    private lastRefusal: { at: number; what: string } | null = null;

    private expired = 0;

    private current(now: number): Holder | null {
        if (this.holder && now >= this.holder.expiresAt) {
            this.expired += 1;
            this.holder = null;
        }
        return this.holder;
    }

    /** Take the lease (ttlMs may be Infinity). Throws when someone else holds an unexpired one. */
    public acquire(owner: string, ttlMs: number, now: number = Date.now()): number {
        const held = this.current(now);
        if (held) {
            throw new Error(`Machine commands are reserved by ${held.owner}.`);
        }
        if (this.recovery) {
            throw new Error(`The work frame must be recovered first (${this.recovery.reason}).`);
        }
        const id = this.nextId;
        this.nextId += 1;
        this.holder = { id, owner, acquiredAt: now, expiresAt: now + ttlMs };
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

    /** Refuse all but recovery commands, from everyone, until endRecovery(). Releases `id` if given. */
    public holdForRecovery(reason: string, id?: number, now: number = Date.now()): void {
        if (id !== undefined) { this.release(id); }
        this.recovery = { reason, since: now };
    }

    public endRecovery(): void {
        this.recovery = null;
    }

    /** Run `fn` as the holder `id`: its commands (and their awaits) are admitted. */
    public async runAs<T>(id: number, fn: () => Promise<T>): Promise<T> {
        return this.context.run(id, fn);
    }

    /** null when this caller may command the machine, else the refusal text. */
    public refusal(what: string, now: number = Date.now()): string | null {
        const held = this.current(now);
        if (held && this.context.getStore() === held.id) { return null; }
        let reason: string | null = null;
        if (held) {
            reason = `machine commands are reserved by ${held.owner} until it restores the work frame. Stop or release the pendant first.`;
        } else if (this.recovery && !isRecoveryCommand(what)) {
            reason = `the controller may still be in the machine workspace (${this.recovery.reason}). Only Restore work frame, `
                + 'homing, position queries and job stop are accepted until a verified position clears it.';
        }
        if (!reason) { return null; }
        this.refused += 1;
        this.lastRefusal = { at: now, what: what.slice(0, 80) };
        return `Refused "${what.slice(0, 80)}": ${reason}`;
    }

    public status(now: number = Date.now()) {
        const held = this.current(now);
        return { held: held ? { owner: held.owner, ageMs: now - held.acquiredAt, expiresInMs: held.expiresAt - now } : null,
            recovery: this.recovery,
            refused: this.refused,
            lastRefusal: this.lastRefusal,
            expired: this.expired };
    }
}

export const gcodeLease = new GcodeLease();
