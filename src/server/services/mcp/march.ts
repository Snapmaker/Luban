import { mcpBroadcast } from './index';
import {
    DescentIo,
    LinkDescentResult,
    SteppedBlock,
    SteppedIo,
    SteppedTraverseResult,
    linkDescentCore,
    releaseRetreatPatience,
    steppedTraverseCore,
} from './marchCore';
import { GPIO_SENSOR_DELAY_MS, releaseTimeoutFor, standoffReleaseWindowFor } from './procedureLimits';
import { probeFeedService } from './probeFeed';
import {
    COARSE_FEED,
    FINE_FEED,
    MAX_RETREAT_MM,
    ProcedureAbort,
    TRAVEL_FEED,
    descendInSegments,
    moveMachineSettled,
    marchInSegments,
    senseAfter,
    senseReleaseAfter,
} from './probing';
import { TRAVERSE_Z_TOLERANCE_MM } from './traversePlan';

// Shared sensor-gated motion primitives (mcp/48, operator request 2026-09-06):
//
//  - marchToContact(): the proven coarse -> release -> fine -> confirm march
//    every runner carries a copy of (probe_vector, probe_sequence, tool
//    setter, surface scans), with the same numbers, as one function. A miss
//    (limit reached without contact) is RETURNED, not thrown: the caller
//    decides (a measurement of "nothing within N mm" is usually fine).
//
//  - steppedTraverse(): a move between two points close to a surface as a
//    TOUCH-PROBING move: 1 mm steps with the probe channel expected, and a
//    contact means "the surface is closer here" - back off one step, retreat
//    `liftMm` along the retreat direction (up, for a top; away from the face,
//    for a side; back along the path, in a pocket), continue. The result is a
//    step profile of the surface between the points (gentle for a slope, one
//    big lift for the wall of a hole, one bump for a projection on a side)
//    instead of the fixed "last contact + N mm" clearance whose only answer
//    to a contact was to abort. Retreats are capped: for a top, at the
//    traverse height, above which a plain move finishes (law 2); for a side,
//    at the approved start line, where a further contact is a fault
//    (something stands where the operator approved empty space); in a
//    pocket (steppedTraverseWall, issue #167) the FIRST contact ends the
//    link as BLOCKED after one retreat along the path just travelled.
//
//  The algorithms live in marchCore.ts against a small IO interface so they
//  are unit-tested on a fake machine; this file binds them to the engine.

export type Xyz = { x: number; y: number; z: number };

export interface MarchParams {
    coarseStepMm: number;
    fineStepMm: number;
    backoffMm: number;
    sensorDelayMs: number;
    confirmPasses: number;
}

export interface MarchContact {
    /** Distance along the unit vector from the start (median of the confirm passes). */
    s: number;
    point: Xyz;
    passContacts: number[];
    spreadMm: number;
    coarseContactS: number;
}

export type Announce = (phase: string, note?: string) => void;

export function makeAnnounce(tool: string, phases: { phase: string; note?: string }[]): Announce {
    return (phase: string, note?: string) => {
        phases.push({ phase, note });
        mcpBroadcast('mcp:activity', { tool, phase, note });
    };
}

const r3 = (v: number) => Number(v.toFixed(3));

export function pointAlong(start: Xyz, unit: Xyz, s: number): Xyz {
    return { x: r3(start.x + unit.x * s), y: r3(start.y + unit.y * s), z: r3(start.z + unit.z * s) };
}

function wordsAlong(start: Xyz, unit: Xyz, s: number): { x?: number; y?: number; z?: number } {
    const p = pointAlong(start, unit, s);
    const words: { x?: number; y?: number; z?: number } = {};
    if (Math.abs(unit.x) > 1e-9) {
        words.x = p.x;
    }
    if (Math.abs(unit.y) > 1e-9) {
        words.y = p.y;
    }
    if (Math.abs(unit.z) > 1e-9) {
        words.z = p.z;
    }
    return words;
}

/**
 * March from `start` along `unit` (unit vector, dz <= 0) up to `maxTravelMm`
 * on the probe channel. Returns the contact, or null when the limit was
 * reached without one (the probe is then AT the limit: the caller retreats).
 * Throws ProcedureAbort on an inconsistent probe (stuck, lost re-contact).
 * The expected-contact set is the caller's: set it before, clear it after
 * the retreat.
 */
export async function marchToContact(
    tag: string,
    name: string,
    start: Xyz,
    unit: Xyz,
    maxTravelMm: number,
    params: MarchParams,
    announce: Announce
): Promise<MarchContact | null> {
    const releaseTimeoutMs = releaseTimeoutFor(params.sensorDelayMs);
    const move = async (tool: string, s: number, feed: number) => {
        await moveMachineSettled(tool, wordsAlong(start, unit, s), feed);
    };
    let s = 0;
    let coarseContactS: number | null = null;
    while (maxTravelMm - s > 1e-9) {
        // The coarse step is the logical advance; the physical moves that make
        // it up are <= MARCH_SEGMENT_MM, each sensor-checked (probing.ts).
        const advance = await marchInSegments(
            async (v) => move(`${tag}:coarse:${name}`, v, COARSE_FEED),
            s, Math.min(s + params.coarseStepMm, maxTravelMm), 'probe', params.sensorDelayMs
        );
        s = advance.s;
        if (advance.sensed.contact) {
            coarseContactS = s;
            announce(`coarse-contact-${name}`, `${s.toFixed(3)} mm along`);
            break;
        }
    }
    if (coarseContactS === null) {
        return null;
    }
    // The first step back lands on ground the march sensed free: a probe
    // still triggered there is answered by the next step, not by the full
    // timeout (releaseRetreatPatience, #185); the step that decides the
    // fault keeps the timeout.
    const releaseWindowMs = standoffReleaseWindowFor(params.sensorDelayMs);
    const contactS: number = coarseContactS;
    const canRetreat = (at: number) => at > 1e-9 && contactS - at < MAX_RETREAT_MM + 1e-9;
    let released = false;
    let retreatStep = 0;
    while (canRetreat(s)) {
        const t0 = Date.now();
        retreatStep += 1;
        s = Math.max(s - params.coarseStepMm, 0);
        await move(`${tag}:release:${name}`, s, COARSE_FEED);
        const patience = releaseRetreatPatience(retreatStep, canRetreat(s));
        const sensed = await senseReleaseAfter('probe', t0, patience === 'window' ? releaseWindowMs : releaseTimeoutMs);
        if (!sensed.contact) {
            released = true;
            break;
        }
    }
    if (!released) {
        // Say what was actually done (T8, job 8088e3a6aff5: a 0.1 mm retreat
        // to the march start was reported as "5 mm back - stuck probe").
        const retreated = r3(coarseContactS - s);
        const atStart = s <= 1e-9;
        throw new ProcedureAbort(`March "${name}": still triggered after retreating ${retreated} mm from the coarse contact`
            + `${atStart ? ' back to the march start (the last point known free)' : ` (cap ${MAX_RETREAT_MM} mm)`}`
            + ` - ${atStart ? 'the start itself now reads contact: a rub on the surface beside the march, a stuck probe or a feed fault' : 'stuck probe or feed fault'}.`);
    }
    let fineContactS: number | null = null;
    while (maxTravelMm - s > 1e-9) {
        const t0 = Date.now();
        s = Math.min(s + params.fineStepMm, maxTravelMm);
        await move(`${tag}:fine:${name}`, s, FINE_FEED);
        const sensed = await senseAfter('probe', t0, params.sensorDelayMs);
        if (sensed.contact) {
            fineContactS = s;
            break;
        }
    }
    if (fineContactS === null) {
        throw new ProcedureAbort(`March "${name}": fine approach lost the contact.`);
    }
    const passContacts: number[] = [];
    const cycleLimit = Math.min(fineContactS + Math.max(0.5, params.backoffMm), maxTravelMm);
    let reference = fineContactS;
    for (let pass = 1; pass <= params.confirmPasses; pass++) {
        const t0 = Date.now();
        s = Math.max(reference - params.backoffMm, 0);
        await move(`${tag}:backoff:${name}`, s, FINE_FEED);
        const lifted = await senseReleaseAfter('probe', t0, releaseTimeoutMs);
        if (lifted.contact) {
            throw new ProcedureAbort(`March "${name}": hysteresis exceeds the backoff ${params.backoffMm} mm.`);
        }
        let passContact: number | null = null;
        while (cycleLimit - s > 1e-9) {
            const t1 = Date.now();
            s = Math.min(s + params.fineStepMm, cycleLimit);
            await move(`${tag}:confirm:${name}`, s, FINE_FEED);
            const sensed = await senseAfter('probe', t1, params.sensorDelayMs);
            if (sensed.contact) {
                passContact = s;
                break;
            }
        }
        if (passContact === null) {
            throw new ProcedureAbort(`March "${name}": confirm pass ${pass} lost the contact.`);
        }
        passContacts.push(r3(passContact));
        reference = passContact;
    }
    const sorted = [...passContacts].sort((a, b) => a - b);
    const measuredS = sorted[Math.floor((sorted.length - 1) / 2)];
    const spreadMm = r3(sorted[sorted.length - 1] - sorted[0]);
    const point = pointAlong(start, unit, measuredS);
    announce(`measured-${name}`, `(${point.x}, ${point.y}, ${point.z}) spread ${spreadMm}`);
    return { s: measuredS, point, passContacts, spreadMm, coarseContactS };
}

/** Move along the march vector to distance `s` from its start (0 = the start; the probe may still be in contact: keep it expected). */
export async function retreatAlong(tag: string, name: string, start: Xyz, unit: Xyz, s: number): Promise<void> {
    await moveMachineSettled(`${tag}:retreat:${name}`, wordsAlong(start, unit, s), TRAVEL_FEED);
}

export { STEPPED_HOP_STEP_MM, STEPPED_HOP_FEED } from './marchCore';
export type { SteppedBlock, SteppedTraverseResult } from './marchCore';

/** The real machine behind the pure traverse / descent cores (marchCore.ts). */
function machineIo(sensorDelayMs: number = GPIO_SENSOR_DELAY_MS.default): SteppedIo & DescentIo {
    let contactsBeforeMove = probeFeedService.contactCount('probe');
    const move = async (tool: string, words: { x?: number; y?: number; z?: number }, feed: number) => {
        contactsBeforeMove = probeFeedService.contactCount('probe');
        await moveMachineSettled(tool, words, feed);
    };
    return {
        move,
        moveZ: async (tool, z, feed) => move(tool, { z }, feed),
        descendFast: async (tool, fromZ, toZ) => {
            await descendInSegments(tool, fromZ, toZ, 'probe', sensorDelayMs);
        },
        sense: async (t0, delayMs) => (await senseAfter('probe', t0, delayMs)).contact
            || probeFeedService.contactCount('probe') > contactsBeforeMove,
        senseRelease: async (t0, timeoutMs) => (await senseReleaseAfter('probe', t0, timeoutMs)).contact,
        setExpectedContact: () => probeFeedService.setExpectedContact(['probe']),
        clearExpectedContact: () => probeFeedService.clearExpectedContact(),
        now: () => Date.now(),
    };
}

export interface SteppedTraverseParams {
    /** Unit vector of the retreat on contact: (0,0,1) over a top, away from the face along a side. */
    retreatUnit: Xyz;
    /** Retreat per contact (mm). */
    liftMm: number;
    /** Total retreat allowed from the start plane (mm): traverse height minus z over a top; the start line along a side. */
    maxLiftTotalMm: number;
    /**
     * At the cap: 'plain-move' finishes with one plain move (law 2, at the
     * traverse height); 'stop-lifting' keeps stepping and a further contact is
     * a fault; 'block' ends the traverse as blocked (marchCore.ts).
     */
    onMax: 'plain-move' | 'stop-lifting' | 'block';
    /** 'retry' (default, a top) or 'block' (a wall: the first contact ends the link) - see marchCore.ts. */
    onContact?: 'retry' | 'block';
    /** Never retreat behind the traverse start (a reverse-vector retreat). */
    capRetreatAtStart?: boolean;
    extraBackoffMm?: number;
    backtrackMm?: number;
    sensorDelayMs: number;
    /** Give up after this many lifts on one traverse (default 60). */
    maxLifts?: number;
}

/**
 * Touch-probing traverse from `from` to `to` (see the file header). Both are
 * full machine points; the traverse direction is `to - from`. The
 * expected-contact set includes 'probe' while it runs and is cleared on
 * return. Returns the arrival position, which lies on the line through `to`
 * along retreatUnit (or the back-off point on the path when `blocked`).
 */
export async function steppedTraverse(
    tag: string,
    name: string,
    from: Xyz,
    to: Xyz,
    params: SteppedTraverseParams,
    announce: Announce
): Promise<SteppedTraverseResult> {
    return steppedTraverseCore(machineIo(params.sensorDelayMs), tag, name, from, to, {
        ...params,
        releaseTimeoutMs: releaseTimeoutFor(params.sensorDelayMs),
        travelFeed: TRAVEL_FEED,
    }, announce);
}

/** Convenience for travel over a top: horizontal from -> to at toolhead Z `z`, lifting toward the traverse height on contact. */
export async function steppedTraverseZ(
    tag: string,
    name: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    z: number,
    params: { liftMm: number; maxZ: number; sensorDelayMs: number; onMax?: 'plain-move' | 'block'; extraBackoffMm?: number; backtrackMm?: number },
    announce: Announce
): Promise<{ z: number; position: Xyz; lifts: SteppedTraverseResult['lifts']; steps: number; toppedOut: boolean; blocked: SteppedBlock | null; clearTailMm?: number }> {
    const result = await steppedTraverse(tag, name, { x: from.x, y: from.y, z }, { x: to.x, y: to.y, z }, {
        retreatUnit: { x: 0, y: 0, z: 1 },
        liftMm: params.liftMm,
        maxLiftTotalMm: Math.max(0, r3(params.maxZ - z)),
        onMax: params.onMax || 'plain-move',
        extraBackoffMm: params.extraBackoffMm,
        backtrackMm: params.backtrackMm,
        sensorDelayMs: params.sensorDelayMs,
    }, announce);
    return {
        z: result.position.z,
        position: result.position,
        lifts: result.lifts,
        steps: result.steps,
        toppedOut: result.toppedOut,
        blocked: result.blocked,
        clearTailMm: result.clearTailMm,
    };
}

/**
 * Travel along a WALL (inside a pocket, along a boss): horizontal from -> to
 * at toolhead Z `z` as a stepped traverse whose retreat on contact is the
 * REVERSE travel vector - the path just travelled is the only direction
 * proven clear - and which ends BLOCKED on the first contact (issue #167).
 * Never lifts in Z. `retreatMm` is the retreat beyond the 1 mm back-off,
 * capped so the head never goes behind `from`.
 */
export async function steppedTraverseWall(
    tag: string,
    name: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    z: number,
    params: { retreatMm: number; sensorDelayMs: number },
    announce: Announce
): Promise<SteppedTraverseResult> {
    const d = { x: to.x - from.x, y: to.y - from.y };
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) {
        return { position: { x: to.x, y: to.y, z }, liftTotalMm: 0, lifts: [], steps: 0, toppedOut: false, blocked: null };
    }
    return steppedTraverse(tag, name, { x: from.x, y: from.y, z }, { x: to.x, y: to.y, z }, {
        retreatUnit: { x: r3(-d.x / len), y: r3(-d.y / len), z: 0 },
        liftMm: params.retreatMm,
        maxLiftTotalMm: params.retreatMm,
        onMax: 'block',
        onContact: 'block',
        capRetreatAtStart: true,
        sensorDelayMs: params.sensorDelayMs,
    }, announce);
}

/**
 * A link's guarded descent (marchCore.linkDescentCore on the real machine):
 * fast <= 5 mm segments to `guardMm` above the target, then 1 mm
 * sensor-checked steps at the coarse feed. `judge` says what a contact means
 * (camLinks.judgeLinkDescentContact); `mayBlock` whether it can ever say
 * 'block' - only then is the contact sensed serially instead of latched.
 */
export async function linkDescent(
    tag: string,
    label: string,
    fromZ: number,
    toZ: number,
    params: { sensorDelayMs: number; guardMm: number; judge: (contactZ: number) => 'abort' | 'block'; mayBlock: boolean },
    announce: Announce
): Promise<LinkDescentResult> {
    return linkDescentCore(machineIo(params.sensorDelayMs), tag, label, fromZ, toZ, {
        guardMm: params.guardMm,
        sensorDelayMs: params.sensorDelayMs,
        releaseTimeoutMs: releaseTimeoutFor(params.sensorDelayMs),
        guardFeed: COARSE_FEED,
        travelFeed: TRAVEL_FEED,
        onContact: params.judge,
        mayBlock: params.mayBlock,
        toleranceMm: TRAVERSE_Z_TOLERANCE_MM,
    }, announce);
}
