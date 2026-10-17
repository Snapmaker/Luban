// The stepped-traverse and link-descent algorithms of march.ts / probeCam.ts,
// written against a small IO interface so they run under ts-node against a
// fake machine (tests/marchCore.test.ts). march.ts binds them to the real
// engine (moveMachineSettled, senseAfter, the probe feed). No server imports.
//
// Why the split (issue #167, job f84f2a263333, 2026-09-21): a stepped link
// inside a pocket touched the wall, retreated +Z twice, climbed onto the rim
// and the guarded descent at the destination then met the top face - which
// the runner called a CRASH. None of that path had a test, because the
// traverse lived inside a module that imports the machine.

import { ProcedureAbort } from './procedureAbort';

export type Xyz = { x: number; y: number; z: number };
export type Words = { x?: number; y?: number; z?: number };

const r3 = (v: number) => Number(v.toFixed(3));

/** What the stepped traverse needs from the machine. */
export interface SteppedIo {
    move(tag: string, words: Words, feed: number): Promise<void>;
    /** Contact sensed within `delayMs` after a step issued at `t0`. */
    sense(t0: number, delayMs: number): Promise<boolean>;
    /** True when the probe STILL reads contact after `timeoutMs` (a release that never came). */
    senseRelease(t0: number, timeoutMs: number): Promise<boolean>;
    setExpectedContact(): void;
    clearExpectedContact(): void;
    now(): number;
}

export type Announce = (phase: string, note?: string) => void;

export const STEPPED_HOP_STEP_MM = 1;
export const STEPPED_HOP_FEED = 300;

/** How long a release retreat step waits on a probe still reading contact: the short standoff window, or the full release timeout. */
export type RetreatPatience = 'window' | 'timeout';

/**
 * The march's release retreat (marchToContact) after a coarse contact (#185,
 * T8c job 96cf38d16b74): the FIRST step back lands on the previous step's end,
 * which the march sensed free a moment ago, so a probe still reading contact
 * there is the switch's own hysteresis or a late reading and the next step
 * back answers it - two of T8c's nine confirm cycles waited the full 3.5 s on
 * that step and the next 0.1 mm released at once (7.0 s of the lap). It
 * waits only the standoff window (#183, procedureLimits.ts), as the crawl's
 * own standoff does. Every later step is past the last point known free,
 * and the last step the retreat can make (back at the start, or at the
 * retreat cap) is the one whose answer is the stuck-probe fault: those keep
 * the full release timeout.
 */
export function releaseRetreatPatience(stepIndex: number, canStepAgain: boolean): RetreatPatience {
    return stepIndex === 1 && canStepAgain ? 'window' : 'timeout';
}

export interface SteppedTraverseParams {
    /** Unit vector of the retreat on contact: (0,0,1) over a top, away from the face along a side, the REVERSE travel vector in a pocket. */
    retreatUnit: Xyz;
    /** Retreat per contact (mm). */
    liftMm: number;
    /** Total retreat allowed from the start plane (mm): traverse height minus z over a top; the start line along a side. */
    maxLiftTotalMm: number;
    /**
     * At the cap: 'plain-move' finishes with one plain move (law 2, at the
     * traverse height); 'stop-lifting' keeps stepping and a further contact is
     * a fault; 'block' ends the traverse as BLOCKED (the head stays where the
     * back-off left it - a lift past the cap would leave the pocket, #167).
     */
    onMax: 'plain-move' | 'stop-lifting' | 'block';
    /**
     * 'retry' (default): after a retreat try the same step again - right over a
     * TOP, where a lateral contact means the surface is higher here. 'block':
     * the first contact ends the traverse - right in a POCKET, where a lateral
     * contact means a WALL and the only proven-clear direction is the path
     * just travelled (issue #167). The destination is then BLOCKED.
     */
    onContact?: 'retry' | 'block';
    /**
     * Never retreat behind the traverse start (the retreat runs along the
     * reverse travel vector, and only the path from `from` is proven clear).
     */
    capRetreatAtStart?: boolean;
    /** Extra top-link backoff, bounded by the staged probe-ball radius. */
    extraBackoffMm?: number;
    /** Proven collinear incoming corridor at this SAME Z, behind from. */
    backtrackMm?: number;
    sensorDelayMs: number;
    releaseTimeoutMs: number;
    /** Give up after this many lifts on one traverse (default 60). */
    maxLifts?: number;
    travelFeed: number;
}

export interface SteppedBlock {
    /** Tip-centre position at the contact (machine). */
    contact: Xyz;
    /** Unit travel vector the traverse was following. */
    travelUnit: Xyz;
    /** Where the head retreated to, and how (the hop-back plus the lift, along retreatUnit). */
    retreatUnit: Xyz;
    retreatMm: number;
    /** Distance along the traverse from `from` at the contact. */
    sAlongMm: number;
}

export interface SteppedTraverseResult {
    /** Where the toolhead arrived: `to` displaced by the total retreat along retreatUnit, or the back-off point when blocked. */
    position: Xyz;
    /** Total retreat from the start plane (mm). */
    liftTotalMm: number;
    lifts: { x: number; y: number; z: number; liftMm: number }[];
    steps: number;
    toppedOut: boolean;
    /** Verified straight trailing corridor at the arrival height. */
    clearTailMm?: number;
    /** Set when the traverse did NOT reach `to`: the contact that stopped it. */
    blocked: SteppedBlock | null;
}

/**
 * Touch-probing traverse from `from` to `to` (see march.ts for the law behind
 * it). Both are full machine points; the traverse direction is `to - from`.
 * The expected-contact set includes the probe while it runs and is cleared on
 * return. Returns the arrival position, which lies on the line through `to`
 * along retreatUnit - or, when blocked, the back-off point on the path.
 */
export async function steppedTraverseCore(
    io: SteppedIo,
    tag: string,
    name: string,
    from: Xyz,
    to: Xyz,
    params: SteppedTraverseParams,
    announce: Announce
): Promise<SteppedTraverseResult> {
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const length = Math.hypot(d.x, d.y, d.z);
    const lifts: SteppedTraverseResult['lifts'] = [];
    let liftTotal = 0;
    let steps = 0;
    if (length < 1e-9) {
        return { position: { ...to }, liftTotalMm: 0, lifts, steps, toppedOut: false, blocked: null };
    }
    const u = { x: d.x / length, y: d.y / length, z: d.z / length };
    const ru = params.retreatUnit;
    const onContact = params.onContact || 'retry';
    const at = (s: number): Xyz => ({
        x: r3(from.x + u.x * s + ru.x * liftTotal),
        y: r3(from.y + u.y * s + ru.y * liftTotal),
        z: r3(from.z + u.z * s + ru.z * liftTotal),
    });
    const words = (p: Xyz): Words => {
        const w: Words = {};
        if (Math.abs(u.x) > 1e-9 || Math.abs(ru.x) > 1e-9) {
            w.x = p.x;
        }
        if (Math.abs(u.y) > 1e-9 || Math.abs(ru.y) > 1e-9) {
            w.y = p.y;
        }
        if (Math.abs(u.z) > 1e-9 || Math.abs(ru.z) > 1e-9) {
            w.z = p.z;
        }
        return w;
    };
    const maxLifts = params.maxLifts ?? 60;
    let liftingStopped = false;
    const top = ru.x === 0 && ru.y === 0 && ru.z === 1 && Math.abs(u.z) < 1e-9;
    const extraBackoff = top ? Math.floor(Math.max(0, params.extraBackoffMm || 0) * 1000) / 1000 : 0;
    // A lift invalidates the old plane's clearance history. Never back into
    // unvisited space at the new height, even if its XY projection is familiar.
    let planeStart = top ? -Math.floor(Math.max(0, params.backtrackMm || 0) * 1000) / 1000 : 0;
    io.setExpectedContact();
    try {
        let s = 0;
        while (length - s > 1e-9) {
            const next = Math.min(s + STEPPED_HOP_STEP_MM, length);
            const p = at(next);
            const t0 = io.now();
            await io.move(`${tag}:hop:${name}`, words(p), STEPPED_HOP_FEED);
            steps += 1;
            const contact = await io.sense(t0, params.sensorDelayMs);
            if (!contact) {
                s = next;
                continue;
            }
            // The surface is closer here: back off one step along the path
            // (the one direction proven clear), wait for the release.
            const standardBackS = s;
            let back = at(s);
            const t1 = io.now();
            await io.move(`${tag}:hop-back:${name}`, words(back), STEPPED_HOP_FEED);
            let stillTriggered = await io.senseRelease(t1, params.releaseTimeoutMs);
            // Make room for the ball before rising beside a steep shoulder.
            // Only retrace a verified path, in <=0.25 mm increments, up to
            // one ball radius beyond the ordinary backoff. No guessed side step.
            const backLimit = r3(Math.max(planeStart, s - extraBackoff));
            while (s - backLimit > 1e-9) {
                s = r3(Math.max(backLimit, s - 0.25));
                back = at(s);
                const tb = io.now();
                await io.move(`${tag}:hop-back-extra:${name}`, words(back), STEPPED_HOP_FEED);
                stillTriggered = await io.senseRelease(tb, params.releaseTimeoutMs);
            }
            const backedMm = r3(next - s);
            if (standardBackS - s > 1e-9) {
                announce(`hop-back-extra-${name}`, `${r3(standardBackS - s)} mm additional retreat along the verified path (ball-radius cap ${extraBackoff} mm)`);
            }
            if (stillTriggered) {
                throw new ProcedureAbort(`Stepped traverse "${name}": probe still triggered after backing off ${backedMm} mm `
                    + `at (${back.x}, ${back.y}, ${back.z}); verified retreat exhausted - holding.`);
            }
            const blockedHere = (retreatMm: number): SteppedTraverseResult => ({
                position: at(s),
                liftTotalMm: r3(liftTotal),
                lifts,
                steps,
                toppedOut: liftingStopped,
                blocked: {
                    contact: p,
                    travelUnit: { x: r3(u.x), y: r3(u.y), z: r3(u.z) },
                    retreatUnit: { ...ru },
                    retreatMm: r3(retreatMm),
                    sAlongMm: r3(next),
                },
            });
            if (liftingStopped) {
                if (params.onMax === 'block') {
                    announce(`hop-blocked-${name}`, `contact at (${p.x}, ${p.y}, ${p.z}) with the retreat at its cap ${params.maxLiftTotalMm} mm - destination BLOCKED`);
                    return blockedHere(backedMm);
                }
                throw new ProcedureAbort(`Stepped traverse "${name}": contact at (${p.x}, ${p.y}, ${p.z}) with the retreat already at its cap `
                    + `${params.maxLiftTotalMm} mm - something stands where the approved plan has empty space.`);
            }
            if (lifts.length >= maxLifts) {
                throw new ProcedureAbort(`Stepped traverse "${name}": ${maxLifts} retreats without clearing the surface - stopping.`);
            }
            let room = params.maxLiftTotalMm - liftTotal;
            if (params.capRetreatAtStart) {
                room = Math.min(room, s);
            }
            const lift = Math.min(params.liftMm, room);
            if (lift <= 1e-9) {
                liftingStopped = true;
                if (params.onMax === 'plain-move') {
                    io.clearExpectedContact();
                    await io.move(`${tag}:hop-top:${name}`, words(at(length)), params.travelFeed);
                    return { position: at(length), liftTotalMm: r3(liftTotal), lifts, steps, toppedOut: true, blocked: null };
                }
                if (params.onMax === 'block') {
                    announce(`hop-blocked-${name}`, `contact at (${p.x}, ${p.y}, ${p.z}) with no retreat left (cap ${params.maxLiftTotalMm} mm) - destination BLOCKED`);
                    return blockedHere(backedMm);
                }
                throw new ProcedureAbort(`Stepped traverse "${name}": contact at (${p.x}, ${p.y}, ${p.z}) with no retreat left (cap ${params.maxLiftTotalMm} mm).`);
            }
            const liftBefore = liftTotal;
            const liftTarget = r3(liftTotal + lift);
            announce(`hop-lift-${name}`, `surface closer at (${p.x}, ${p.y}, ${p.z}): retreat ${r3(lift)} mm along `
                + `(${r3(ru.x)}, ${r3(ru.y)}, ${r3(ru.z)}) (total ${liftTarget})`);
            if (top) {
                // A rise can catch the side of the ball. Sense each segment,
                // including transient contact, BEFORE issuing any next XY step.
                while (liftTarget - liftTotal > 1e-9) {
                    liftTotal = r3(Math.min(liftTarget, liftTotal + 0.5));
                    const tl = io.now();
                    await io.move(`${tag}:hop-lift:${name}`, words(at(s)), STEPPED_HOP_FEED);
                    if (await io.sense(tl, params.sensorDelayMs)) {
                        throw new ProcedureAbort(`Stepped traverse "${name}": contact during lift at (${at(s).x}, ${at(s).y}, ${at(s).z}) - holding before further travel.`, { holdPosition: true });
                    }
                }
                planeStart = s;
            } else {
                liftTotal = liftTarget;
                await io.move(`${tag}:hop-lift:${name}`, words(at(s)), params.travelFeed);
            }
            lifts.push({ x: p.x, y: p.y, z: p.z, liftMm: r3(liftTotal - liftBefore) });
            if (onContact === 'block') {
                // A wall: the retreat along the path is the whole answer; the
                // destination is blocked and the caller carries on from here.
                announce(`hop-blocked-${name}`, `wall at (${p.x}, ${p.y}, ${p.z}) - retreated ${r3(backedMm + lift)} mm along the path; destination BLOCKED`);
                return blockedHere(backedMm + lift);
            }
            if (liftTotal >= params.maxLiftTotalMm - 1e-9) {
                if (params.onMax === 'plain-move') {
                    // The caller has checked the full staged path against obstacles.
                    io.clearExpectedContact();
                    await io.move(`${tag}:hop-top:${name}`, words(at(length)), params.travelFeed);
                    return { position: at(length), liftTotalMm: liftTotal, lifts, steps, toppedOut: true, blocked: null };
                }
                liftingStopped = true;
            }
        }
        return { position: at(length), liftTotalMm: liftTotal, lifts, steps, toppedOut: liftingStopped, blocked: null, clearTailMm: r3(length - planeStart) };
    } finally {
        io.clearExpectedContact();
    }
}

// ---------------------------------------------------------------- link descent

/** What a link's guarded descent needs from the machine. */
export interface DescentIo {
    /** Fast descent in <= 5 mm segments under the crash guard (probing.descendInSegments). */
    descendFast(tag: string, fromZ: number, toZ: number): Promise<void>;
    moveZ(tag: string, z: number, feed: number): Promise<void>;
    sense(t0: number, delayMs: number): Promise<boolean>;
    senseRelease(t0: number, timeoutMs: number): Promise<boolean>;
    setExpectedContact(): void;
    clearExpectedContact(): void;
    now(): number;
}

export interface LinkDescentParams {
    /** The last `guardMm` above the target run as 1 mm sensor-checked steps. */
    guardMm: number;
    sensorDelayMs: number;
    releaseTimeoutMs: number;
    /** Feed of the guarded 1 mm steps. */
    guardFeed: number;
    travelFeed: number;
    /**
     * What a contact during the guarded steps means. 'abort': something is
     * where the program says nothing is (a raise-mode link into declared
     * free space) - throw, the abort path raises. 'block': the station this
     * descent was reaching is BLOCKED (issue #167: the stepped link climbed
     * onto the rim and the descent met the top) - back off 1 mm, lift back to
     * the Z the descent started from, report; the run continues.
     */
    onContact: (contactZ: number) => 'abort' | 'block';
    /**
     * Whether `onContact` can answer 'block' at all for this descent (known
     * before any contact: the link style and the stated top decide it). When
     * it can, the guarded steps run with the contact EXPECTED so the verdict
     * is made here, serially, instead of by the async crash latch.
     */
    mayBlock: boolean;
    /** The heartbeat's float noise (TRAVERSE_Z_TOLERANCE_MM). */
    toleranceMm: number;
}

export interface LinkDescentResult {
    /** null = reached the target; otherwise the Z of the contact that blocked it. */
    contactZ: number | null;
    /** Z the head is at afterwards: the target, or the Z the descent started from when blocked. */
    z: number;
    blocked: boolean;
}

/**
 * A link's descent to its programmed Z: fast segments to `guardMm` above the
 * target, then 1 mm steps with a sensor read after each. The judgement of a
 * contact is the caller's (`onContact`); when it says 'block' the contact is
 * EXPECTED for the guarded steps (so the async crash guard does not latch and
 * force-close the connection with the tip on the work - the serial read after
 * every 1 mm step is the guard here) and the head lifts straight back up the
 * column it came down: first 1 mm (release check), then to `fromZ`.
 */
export async function linkDescentCore(
    io: DescentIo,
    tag: string,
    label: string,
    fromZ: number,
    toZ: number,
    params: LinkDescentParams,
    announce: Announce
): Promise<LinkDescentResult> {
    if (fromZ < toZ - params.toleranceMm) {
        throw new ProcedureAbort(`${label}: the toolhead is at Z${fromZ}, BELOW the descent target Z${toZ} - a descent never rises.`);
    }
    const guardTop = toZ + params.guardMm;
    io.clearExpectedContact();
    if (fromZ > guardTop + params.toleranceMm) {
        await io.descendFast(`${tag}:descend:${label}`, fromZ, guardTop);
    }
    let gz = Math.min(Math.max(fromZ, toZ), guardTop);
    if (params.mayBlock) {
        io.setExpectedContact();
    }
    try {
        while (gz - toZ > 1e-9) {
            const t0 = io.now();
            gz = Math.max(r3(gz - 1), toZ);
            await io.moveZ(`${tag}:descend-guard:${label}`, gz, params.guardFeed);
            const contact = await io.sense(t0, params.sensorDelayMs);
            if (!contact) {
                continue;
            }
            if (params.onContact(gz) === 'abort') {
                throw new ProcedureAbort(`UNEXPECTED CONTACT at Z${gz.toFixed(3)} during the guarded descent (${label}) - something is where the program says nothing is. Machine held.`);
            }
            // Blocked station: straight back up the column, 1 mm first.
            const contactZ = gz;
            const backZ = r3(Math.min(gz + 1, fromZ));
            const t1 = io.now();
            await io.moveZ(`${tag}:descend-back:${label}`, backZ, params.guardFeed);
            const stillTriggered = await io.senseRelease(t1, params.releaseTimeoutMs);
            if (stillTriggered) {
                throw new ProcedureAbort(`${label}: probe still triggered after lifting ${r3(backZ - contactZ)} mm off the contact at Z${contactZ.toFixed(3)}.`);
            }
            io.clearExpectedContact();
            if (fromZ > backZ + params.toleranceMm) {
                await io.moveZ(`${tag}:descend-unwind:${label}`, r3(fromZ), params.travelFeed);
            }
            announce(`${label}-descent-blocked`, `contact at Z${contactZ.toFixed(3)} on the way down to Z${toZ} - station BLOCKED, back at Z${r3(fromZ)}`);
            return { contactZ, z: r3(fromZ), blocked: true };
        }
        return { contactZ: null, z: toZ, blocked: false };
    } finally {
        io.clearExpectedContact();
    }
}
