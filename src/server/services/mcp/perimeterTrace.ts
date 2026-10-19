/* eslint-disable camelcase */
// confirm_at values and the wall side are MCP tool argument vocabulary (snake_case).
//
// The unknown-pocket PERIMETER TRACER (operator spec, 2026-09-22 01:25 BST):
// "a survey of the corners and all the internal walls of the pocket, ideally
// just doing 0.1 millimeter bumping in the corners (or where non-straight
// paths / deviations are detected) so there's no retreat wastage, except
// when it encounters an inability to step forwards, in which case it should
// change the approach angle and try 0.1 mm in that direction after
// retreating back the 0.1 mm it had attempted when making unexpected
// contact."
//
// The crawl, in TIP-CENTRE space, with the probe EXPECTED on every move:
//   0. (runner) law 2 to the start, a point KNOWN to be inside the pocket;
//      march `dir` to the first wall; back off bump_mm along the normal.
//   1. Step fine_step along the tangent (the normal turned so the wall stays
//      on the chosen side, default the RIGHT - right hand on the wall walks
//      an internal perimeter counter-clockwise).
//   2. Tangent step CONTACTS -> retreat exactly the attempted step along its
//      reverse, turn the tangent AWAY from the wall by turn_step, try again
//      (internal corners and inward curves at fine resolution). A full 360
//      of failed turns aborts.
//   3. Tangent step is FREE -> bump toward the wall along the inward normal
//      in fine steps until contact (cap bump_cap_steps); the contact is a
//      perimeter point and the head backs off the one step that touched. If
//      the wall has fallen away past the cap, turn the tangent TOWARD the
//      wall by turn_step (outward curves, external corners).
//   4. Straightness: a running total-least-squares line over the last
//      straight_points contacts; while its max residual is under
//      line_tolerance the tangent step is coarse_step; back to fine_step the
//      moment a step contacts, a bump needs more than one step or the
//      residual grows.
//   5. Closure: heading turned 360 and the tip centre within one coarse step
//      of the first wall point. Otherwise the crawl STOPS (partial polyline,
//      clear ending) on the perimeter budget, max_steps, the bounds or a
//      keep-out.
//   Confirm cycles (lift-and-retest, the expensive part) only where they buy
//   accuracy (operator addendum): the FIRST wall contact, the contact after
//   a MAJOR direction change, any UNEXPECTED contact, and optional accuracy
//   points EVERY accuracy_every_mm. A routine bump is one sensed contact.
//
// Pure: no server imports. The runner (probeTracePerimeter.ts) binds the IO
// to the engine; tests run it on a synthetic pocket (tests/perimeterTrace.test.ts).

import { ProcedureAbort, isProcedureAbort } from './procedureAbort';
import { WallLineFit, Xy, fitWallLine } from './wallFollow';

const r3 = (v: number) => Number(v.toFixed(3));

export type ConfirmAt = 'first' | 'turns' | 'unexpected' | 'every';
export const CONFIRM_AT_VALUES: ConfirmAt[] = ['first', 'turns', 'unexpected', 'every'];
export type WallSide = 'right' | 'left';

export interface TraceBounds {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

/** What the crawl needs from the machine. Every move runs with the probe EXPECTED; a stop request or a fault throws. */
export interface TraceIo {
    /** Sensor-checked move to `p` at the crawl feed; true = contact sensed. The head is AT `p` afterwards (the probe deflected if it touched). */
    step(p: Xy): Promise<boolean>;
    /** Plain move to a point already proven free (a retreat along the path just travelled). */
    move(p: Xy): Promise<void>;
    /** The initial sensor-gated march (coarse / release / fine / confirm) from `from` along `unit` up to `travelMm`; the head ends AT the contact. */
    march(from: Xy, unit: Xy, travelMm: number): Promise<{ point: Xy; spreadMm: number } | null>;
    /**
     * A lift-and-retest confirm cycle from the free point `from` along `unit`
     * (a few fine steps of travel); the head ends AT the refined contact.
     * `{ stuck: true }` when the cycle ended with the probe still reading
     * contact after its own retreat to `from` (T8: a rub, not a fault - the
     * crawl retreats along the normal and carries on unconfirmed).
     */
    confirm(from: Xy, unit: Xy, travelMm: number): Promise<ConfirmOutcome>;
    /**
     * True when the probe reads RELEASED where the head stands. Returns the
     * moment the release is read either way; `patience` is only how long a
     * probe still reading contact is waited on before answering false:
     * 'window' = the short standoff window (the crawl will step further back
     * anyway), 'timeout' = the full release timeout (the answer decides a
     * fault or a rub).
     */
    released(patience: ReleasePatience): Promise<boolean>;
}

/**
 * #183 (T8 rerun, job d677bd88d31a): every standoff retreat step waited the
 * full 3.5 s release timeout while the tip was still in the wall - 30 waits,
 * 105 s - although the next 0.1 mm step released it at once. Steps short of
 * the last point known free now wait only the window; the full timeout still
 * guards the step past it (the stuck-probe fault) and the rub test.
 */
export type ReleasePatience = 'window' | 'timeout';

export type ConfirmOutcome = { point: Xy; spreadMm: number } | { stuck: true } | null;

export function isStuck(outcome: ConfirmOutcome): outcome is { stuck: true } {
    return !!outcome && (outcome as { stuck?: unknown }).stuck === true;
}

export interface TraceParams {
    fineStepMm: number;
    coarseStepMm: number;
    turnStepDeg: number;
    bumpMm: number;
    /** Fine steps toward the wall before "the wall has fallen away". */
    bumpCapSteps: number;
    lineToleranceMm: number;
    /** Contacts the straightness line is fitted over. */
    straightPoints: number;
    maxPerimeterMm: number;
    maxSteps: number;
    bounds: TraceBounds;
    /** Keep-out boxes (machine XY) the tip centre may not enter at the crawl height. */
    keepOut: (TraceBounds & { name: string })[];
    wallSide: WallSide;
    confirmAt: Set<ConfirmAt>;
    accuracyEveryMm: number | null;
    /** Accumulated turn since the last confirm above this = a major direction change. */
    majorTurnDeg: number;
    tipRadiusMm: number | null;
    /** Travel of a confirm cycle beyond the free point (fine steps). */
    confirmTravelMm: number;
}

/**
 * first = the march; bump = a normal bump contact; tangent-contact = a
 * blocked step (a corner); rub = a graze along the wall whose retreat did not
 * release the probe (the wall came to the tip).
 */
export type TracePointKind = 'first' | 'bump' | 'tangent-contact' | 'rub';

export interface TracePoint {
    index: number;
    /** Tip-centre contact (machine XY at the crawl Z). */
    tipCentre: Xy;
    /** tipCentre + tip radius INTO the material along `normal`; null without a stored tip. */
    surface: Xy | null;
    /**
     * Unit normal INTO the material at the contact. The crawl records its
     * heading's normal (which trails the wall after a corner); the reported
     * result carries the local-geometry normal instead (perimeterAnalysis.ts
     * refineNormals, #183).
     */
    normal: Xy;
    kind: TracePointKind;
    /** True when a lift-and-retest cycle refined this point (spreadMm then holds its spread). */
    confirmed: boolean;
    spreadMm: number | null;
    /** Perimeter length walked when the point was taken. */
    alongMm: number;
    /** Tangent step in force when it was taken. */
    stepMm: number;
}

/** 'aborted' travels on a ProcedureAbort's `partial`: the perimeter so far is never lost. */
export type TraceEndingKind = 'closed' | 'budget' | 'max-steps' | 'bounds' | 'keep-out' | 'aborted';

export interface TraceCounts {
    fineSteps: number;
    coarseSteps: number;
    bumps: number;
    turns: number;
    retreats: number;
    confirms: number;
    /** Confirm cycles that ended with the probe still triggered and were skipped (a rub, not a fault). */
    confirmsSkipped: number;
    tangentContacts: number;
    /** Tangent steps whose retreat did not release the probe: the wall came to the tip; the standoff was repaired. */
    rubs: number;
    /** Fine retreat steps made to reach a RELEASED reading after contacts. */
    releaseSteps: number;
}

/** A zero count set - the crawl's own, and the empty result an abort before the crawl reports. */
export function emptyTraceCounts(): TraceCounts {
    return {
        fineSteps: 0,
        coarseSteps: 0,
        bumps: 0,
        turns: 0,
        retreats: 0,
        confirms: 0,
        confirmsSkipped: 0,
        tangentContacts: 0,
        rubs: 0,
        releaseSteps: 0,
    };
}

export interface TraceResult {
    perimeter: TracePoint[];
    closed: boolean;
    ending: { kind: TraceEndingKind; note: string };
    lengthMm: number;
    headingTurnDeg: number;
    counts: TraceCounts;
    /** Where the head is at the end (free point, crawl Z). */
    position: Xy;
    /** The measured first wall (null only when the first march found nothing). */
    firstWall: { point: Xy; spreadMm: number } | null;
    /** The release-verified standoff in force at the end: how far the tip centre parks off the last contact. */
    standoffMm: number;
}

export function rotate(v: Xy, deg: number): Xy {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // `|| 0` turns a -0 into 0 so deepEqual and text never show "-0".
    return { x: r3(v.x * c - v.y * s) || 0, y: r3(v.x * s + v.y * c) || 0 };
}

/** Signed angle from `a` to `b` in degrees (counter-clockwise positive). */
export function turnBetween(a: Xy, b: Xy): number {
    return r3((Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y) * 180) / Math.PI);
}

/** The tangent for a wall on `side`: right-hand wall -> the tangent is the inward normal turned +90 (counter-clockwise). */
export function tangentFor(normalIn: Xy, side: WallSide): Xy {
    return rotate(normalIn, side === 'right' ? 90 : -90);
}

export function normalFor(tangent: Xy, side: WallSide): Xy {
    return rotate(tangent, side === 'right' ? -90 : 90);
}

export function insideBounds(p: Xy, b: TraceBounds): boolean {
    return p.x >= Math.min(b.x0, b.x1) && p.x <= Math.max(b.x0, b.x1) && p.y >= Math.min(b.y0, b.y1) && p.y <= Math.max(b.y0, b.y1);
}

function inKeepOut(p: Xy, boxes: TraceParams['keepOut']): string | null {
    const hit = boxes.find((b) => insideBounds(p, b));
    return hit ? hit.name : null;
}

const dist = (a: Xy, b: Xy) => Math.hypot(a.x - b.x, a.y - b.y);

class TraceStop {
    public readonly kind: TraceEndingKind;

    public readonly note: string;

    public constructor(kind: TraceEndingKind, note: string) {
        this.kind = kind;
        this.note = note;
    }
}

/**
 * Run the crawl. Throws ProcedureAbort - with the partial TraceResult attached
 * as `partial` (ending kind 'aborted') - when no wall is found from the
 * start, when a full turn of tangent steps all contact (the tip is boxed in)
 * or when the probe stays triggered after retreating to the last point known
 * free; every other ending is returned with the partial perimeter.
 */
export async function tracePerimeter(
    io: TraceIo,
    start: Xy,
    dir: Xy,
    maxTravelMm: number,
    params: TraceParams,
    announce: (phase: string, note?: string) => void
): Promise<TraceResult> {
    const p = params;
    const counts: TraceCounts = emptyTraceCounts();
    const perimeter: TracePoint[] = [];
    const surfaceOf = (tip: Xy, n: Xy): Xy | null => (p.tipRadiusMm === null
        ? null
        : { x: r3(tip.x + n.x * p.tipRadiusMm), y: r3(tip.y + n.y * p.tipRadiusMm) });
    // The perimeter LENGTH is measured from the CONTACTS, along a polyline
    // that only moves its anchor on once the next contact is two fine steps
    // away. A sum of the tangent steps under-read a lap by a tenth - the
    // standoff re-references the head to each new contact, so a curve is
    // partly walked by the bumps, not by the steps - and the raw contact-to-
    // contact polyline over-read it by 5 %, because the contacts sit on the
    // fine-step grid and zig-zag a step across it. The budget, the closure and
    // the confirm cadence all use this length.
    let length = 0;
    let sinceAccuracy = 0;
    let sinceTurnMm = 0;
    let anchor: Xy | null = null;
    const record = (tip: Xy, n: Xy, kind: TracePointKind, confirmed: boolean, spread: number | null, stepMm: number) => {
        if (!anchor) {
            anchor = tip;
        } else {
            const d = dist(anchor, tip);
            if (d >= 2 * p.fineStepMm - 1e-9) {
                length += d;
                sinceAccuracy += d;
                sinceTurnMm += d;
                anchor = tip;
            }
        }
        perimeter.push({
            index: perimeter.length, tipCentre: tip, surface: surfaceOf(tip, n), normal: n, kind, confirmed, spreadMm: spread, alongMm: r3(length), stepMm,
        });
    };
    let n: Xy = { x: r3(dir.x), y: r3(dir.y) };
    let t = tangentFor(n, p.wallSide);
    let pos: Xy = { ...start };
    let firstWall: { point: Xy; spreadMm: number } | null = null;
    let heading = 0;
    let standoffSteps = 0;

    const result = (ending: { kind: TraceEndingKind; note: string }): TraceResult => ({
        perimeter,
        closed: ending.kind === 'closed',
        ending,
        lengthMm: r3(length),
        headingTurnDeg: r3(heading),
        counts,
        position: pos,
        firstWall,
        standoffMm: r3(standoffSteps * p.fineStepMm),
    });
    const abort = (message: string): ProcedureAbort => new ProcedureAbort(message, result({ kind: 'aborted', note: message }));

    // ---- first wall (the normal coarse / release / fine / confirm march)
    const first = await io.march(start, dir, maxTravelMm);
    if (!first) {
        throw abort(`No wall within ${maxTravelMm} mm of the start along (${dir.x}, ${dir.y}) - the start is not inside a pocket this size, or dir points along it.`);
    }
    firstWall = first;
    counts.confirms += 1; // the march's own confirm cycles
    record(first.point, n, 'first', true, first.spreadMm, p.fineStepMm);
    pos = first.point;

    /**
     * RELEASE-VERIFIED STANDOFF (T8, job 8088e3a6aff5): parking one bump step
     * off the contact coordinate left the tip 0.05 mm inside a wavy wooden
     * wall, and the next advance rubbed. From the contact, retreat along the
     * inward normal one fine step at a time until the probe READS released,
     * then one more; `knownFreeSteps` says how many steps back the last point
     * known free lies - staying triggered one step past it is a fault, and
     * the message states the retreat actually made.
     */
    const standOff = async (from: Xy, knownFreeSteps: number, what: string): Promise<void> => {
        const cap = knownFreeSteps + 1;
        for (let k = 1; k <= cap; k++) {
            pos = { x: r3(from.x - n.x * p.fineStepMm * k), y: r3(from.y - n.y * p.fineStepMm * k) };
            await io.move(pos);
            counts.retreats += 1;
            counts.releaseSteps += 1;
            // Short of the cap a probe still in contact is answered by the
            // next step back, not by waiting; AT the cap the answer is a
            // fault, so it gets the full release timeout.
            if (await io.released(k < cap ? 'window' : 'timeout')) {
                pos = { x: r3(from.x - n.x * p.fineStepMm * (k + 1)), y: r3(from.y - n.y * p.fineStepMm * (k + 1)) };
                await io.move(pos);
                counts.retreats += 1;
                standoffSteps = k + 1;
                return;
            }
        }
        throw abort(`${what}: the probe still reads triggered after retreating ${r3(cap * p.fineStepMm)} mm along (${r3(-n.x)}, ${r3(-n.y)}) from the contact at `
            + `(${from.x}, ${from.y}) - one fine step past the last point known free. A stuck probe or feed fault, or the wall moved. `
            + 'Recovery: raise straight up (move_z to the traverse height); the tip is at most one fine step into the wall.');
    };
    await standOff(first.point, p.bumpCapSteps, 'first wall');
    announce('first-wall', `(${first.point.x}, ${first.point.y}) spread ${first.spreadMm}; standoff ${r3(standoffSteps * p.fineStepMm)} mm; crawling with the wall on the ${p.wallSide}`);

    let turnedWithoutProgress = 0;
    let turnSinceConfirm = 0;
    // sinceTurnMm (above): perimeter walked since the last turn - a block or a
    // receding wall after a long straight run is a NEW feature (unexpected,
    // worth a confirm cycle); the same event a few steps after a turn is the
    // crawl following the curve it is already in.
    let steps = 0;
    let straight = false;
    // The straightness window spans straightPoints coarse steps of perimeter:
    // six fine points span 0.6 mm and an R5 arc is "straight" over that.
    const straightSpanMm = p.straightPoints * p.coarseStepMm;
    let recent: { q: Xy; along: number }[] = [{ q: first.point, along: 0 }];
    const awaySign = p.wallSide === 'right' ? 1 : -1;
    let ending: { kind: TraceEndingKind; note: string } | null = null;

    const checkPlace = (q: Xy): void => {
        if (!insideBounds(q, p.bounds)) {
            throw new TraceStop('bounds', `the next step (${q.x}, ${q.y}) would leave the bounds X ${p.bounds.x0}..${p.bounds.x1} Y ${p.bounds.y0}..${p.bounds.y1}`);
        }
        const ko = inKeepOut(q, p.keepOut);
        if (ko) {
            throw new TraceStop('keep-out', `the next step (${q.x}, ${q.y}) would enter keep-out "${ko}"`);
        }
    };

    /**
     * A lift-and-retest cycle from the free point `from` along `unit`. A
     * cycle that ends with the probe stuck is NOT a fault by itself (T8: the
     * "stuck probe" was a rub on wavy wood): the head retreats along the
     * inward normal until released, the point stays unconfirmed, the crawl
     * goes on; only a retreat that never releases aborts.
     */
    const confirmCycle = async (from: Xy, unit: Xy, contact: Xy): Promise<{ point: Xy; spreadMm: number } | null> => {
        counts.confirms += 1;
        const outcome = await io.confirm(from, unit, p.confirmTravelMm);
        if (isStuck(outcome)) {
            counts.confirms -= 1;
            counts.confirmsSkipped += 1;
            announce('confirm-skipped', `confirm cycle at (${from.x}, ${from.y}) ended with the probe still triggered - a rub, not a fault: retreating to a released standoff`);
            await standOff(contact, p.bumpCapSteps + standoffSteps, 'confirm cycle');
            return null;
        }
        await io.move(from);
        counts.retreats += 1;
        pos = from;
        turnSinceConfirm = 0;
        sinceAccuracy = 0;
        return outcome;
    };

    const wantsConfirm = (unexpected: boolean): boolean => {
        if (unexpected && p.confirmAt.has('unexpected')) {
            return true;
        }
        if (p.confirmAt.has('turns') && turnSinceConfirm >= p.majorTurnDeg - 1e-9) {
            return true;
        }
        if (p.confirmAt.has('every') && p.accuracyEveryMm !== null && sinceAccuracy >= p.accuracyEveryMm - 1e-9) {
            return true;
        }
        return false;
    };

    try {
        for (;;) {
            if (steps >= p.maxSteps) {
                throw new TraceStop('max-steps', `${p.maxSteps} steps taken`);
            }
            if (length >= p.maxPerimeterMm - 1e-9) {
                throw new TraceStop('budget', `${r3(length)} mm of perimeter walked (max_perimeter_mm ${p.maxPerimeterMm})`);
            }
            const stepMm = straight ? p.coarseStepMm : p.fineStepMm;
            const q: Xy = { x: r3(pos.x + t.x * stepMm), y: r3(pos.y + t.y * stepMm) };
            checkPlace(q);
            steps += 1;
            const hit = await io.step(q);
            if (hit) {
                // Retreat exactly the attempted step. If the probe still reads
                // triggered there, this was a RUB - the wall came to us along
                // the tangent (wavy wood) - not a block: repair the standoff
                // along the normal and carry on; a block is a contact from
                // which the retreat releases.
                const before = pos;
                await io.move(before);
                counts.retreats += 1;
                if (!(await io.released('timeout'))) {
                    counts.rubs += 1;
                    record(q, n, 'rub', false, null, stepMm);
                    await standOff(before, standoffSteps + p.bumpCapSteps, 'rub along the wall');
                    straight = false;
                    recent = [];
                    continue;
                }
                // Blocked ahead: turn away from the wall, try again. The FIRST
                // block after free progress is the unexpected event (a corner
                // begins); the turns inside the corner are the crawl at work.
                counts.tangentContacts += 1;
                let refined: { point: Xy; spreadMm: number } | null = null;
                if (wantsConfirm(sinceTurnMm >= straightSpanMm - 1e-9)) {
                    refined = await confirmCycle(before, t, q);
                }
                record(refined ? refined.point : q, t, 'tangent-contact', !!refined, refined ? refined.spreadMm : null, stepMm);
                t = rotate(t, awaySign * p.turnStepDeg);
                n = normalFor(t, p.wallSide);
                heading += awaySign * p.turnStepDeg;
                turnedWithoutProgress += p.turnStepDeg;
                turnSinceConfirm += p.turnStepDeg;
                sinceTurnMm = 0;
                counts.turns += 1;
                straight = false;
                recent = [];
                if (turnedWithoutProgress >= 360 - 1e-9) {
                    throw abort(`Boxed in at (${pos.x}, ${pos.y}): a full turn of ${p.fineStepMm} mm steps all met material.`);
                }
                continue;
            }
            // Free: advance.
            if (straight) {
                counts.coarseSteps += 1;
            } else {
                counts.fineSteps += 1;
            }
            pos = q;
            turnedWithoutProgress = 0;

            // Bump toward the wall in fine steps until contact. The wall is
            // expected standoffSteps away; bumpCapSteps beyond that it has
            // fallen away.
            let contactAt: Xy | null = null;
            let bumpsNeeded = 0;
            let free = pos;
            const bumpCap = standoffSteps + p.bumpCapSteps;
            for (let k = 1; k <= bumpCap; k++) {
                const b: Xy = { x: r3(pos.x + n.x * p.fineStepMm * k), y: r3(pos.y + n.y * p.fineStepMm * k) };
                checkPlace(b);
                counts.bumps += 1;
                steps += 1;
                if (await io.step(b)) {
                    contactAt = b;
                    bumpsNeeded = k;
                    break;
                }
                free = b;
            }
            if (contactAt) {
                // The wall is expected standoffSteps away: FURTHER than that and
                // it has receded (an outward curve) - not straight any more.
                // Nearer is the normal state, not an event: the standoff is a
                // floor (the step that released plus one), the crawl crabs a
                // little, and a wall that keeps coming blocks the advance,
                // which is what turns the crawl. Calling "nearer" a curve
                // suppressed the straight runs entirely and with them the
                // re-alignment onto the fitted wall, so the crawl crabbed 40
                // deg off a straight wall for its whole length.
                const receded = bumpsNeeded > standoffSteps + 1;
                const unexpected = receded && sinceTurnMm >= straightSpanMm - 1e-9;
                let refined: { point: Xy; spreadMm: number } | null = null;
                await standOff(contactAt, bumpsNeeded, 'bump');
                if (wantsConfirm(unexpected)) {
                    refined = await confirmCycle(pos, n, contactAt);
                }
                const tip = refined ? refined.point : contactAt;
                record(tip, n, 'bump', !!refined, refined ? refined.spreadMm : null, stepMm);
                recent.push({ q: tip, along: length });
                // Keep the ONE entry that still spans the window: dropping
                // every entry older than the cut-off left recent[0] inside it,
                // so "the window is straightSpanMm long" could never be true
                // once the contact-to-contact spacing stopped being exactly
                // the step (it stopped when length became the polyline through
                // the contacts), and no straight run was ever declared.
                while (recent.length > 1 && recent[1].along <= length - straightSpanMm + 1e-9) {
                    recent.shift();
                }
                if (receded) {
                    straight = false;
                    recent = [{ q: tip, along: length }];
                } else if (recent.length >= p.straightPoints && length - recent[0].along >= straightSpanMm - 1e-9) {
                    const fit: WallLineFit | null = fitWallLine(recent.map((e) => e.q), n, t);
                    straight = !!fit && fit.maxAbsMm <= p.lineToleranceMm + 1e-9;
                    if (straight && fit) {
                        // Align the crawl with the wall it has proven straight:
                        // the quantised tangent may sit a turn step off it.
                        const aligned = fit.direction.x * t.x + fit.direction.y * t.y >= 0
                            ? fit.direction
                            : { x: -fit.direction.x, y: -fit.direction.y };
                        heading += turnBetween(t, aligned);
                        t = { x: r3(aligned.x) || 0, y: r3(aligned.y) || 0 };
                        n = normalFor(t, p.wallSide);
                    }
                } else {
                    straight = false;
                }
            } else {
                // The wall fell away: stand where the bumps ended and turn toward it.
                pos = free;
                t = rotate(t, -awaySign * p.turnStepDeg);
                n = normalFor(t, p.wallSide);
                heading -= awaySign * p.turnStepDeg;
                turnSinceConfirm += p.turnStepDeg;
                sinceTurnMm = 0;
                counts.turns += 1;
                straight = false;
                recent = [];
            }

            // Closure: a full turn of heading (within one turn step - the re-alignments onto fitted walls are
            // not quantised) and back within a coarse step plus the standoff of the first wall point.
            if (Math.abs(heading) >= 360 - p.turnStepDeg - 1e-6 && length > 2 * p.coarseStepMm
                && dist(pos, first.point) <= p.coarseStepMm + standoffSteps * p.fineStepMm + 1e-9) {
                ending = { kind: 'closed', note: `perimeter closed after ${r3(length)} mm, heading turned ${r3(heading)} deg` };
                break;
            }
        }
    } catch (err) {
        if (err instanceof TraceStop) {
            ending = { kind: err.kind, note: err.note };
        } else {
            // A fault from the machine (a stop request, an engine abort): the
            // perimeter so far travels with it - never lost on the abort path.
            if (isProcedureAbort(err) && !err.partial) {
                err.partial = result({ kind: 'aborted', note: err.message });
            }
            throw err;
        }
    }
    const end = ending || { kind: 'budget' as TraceEndingKind, note: 'stopped' };
    announce(`trace-${end.kind}`, `${end.note}; ${perimeter.length} point(s), ${counts.confirms} confirm cycle(s), ${counts.rubs} rub(s)`);
    return result(end);
}

// ---------------------------------------------------------------- segmentation

// What the result reports from the points (normals from local geometry,
// merged walls, corner fits off both walls, irregular lobes, lengths) lives
// in perimeterAnalysis.ts (#183); re-exported here for the existing callers.
export { segmentPerimeter } from './perimeterAnalysis';
export type { CornerShape, PerimeterCorner, PerimeterPiece, PerimeterSegment, SegmentOptions } from './perimeterAnalysis';

// ---------------------------------------------------------------- estimate

/**
 * Wall-clock estimate for the confirm page, calibrated on T8c (job
 * 96cf38d16b74, 2026-09-22, GPIO, sensor_delay 50, build e110d8017; issue
 * #185 - the lap the estimate is checked against, result.timing.byKind):
 * 876 contacts in 1489 s. One contact costs the advance, ~1.7 bumps and ~2
 * standoff retreats (release-verified, #182), each a command batch at ~270
 * ms of transport + controller overhead plus its 50 ms sensor window: 1.5 s
 * per contact, i.e. 15 s per mm at 0.1 mm steps and 1.5 s per mm at 1 mm
 * (T8's 0.9 s predated the standoff's extra retreat and bump). The
 * first-wall march ran 1.0 s per 1 mm coarse step (F100 motion + overhead);
 * a confirm cycle (3 passes over 0.3 mm) about 4 s (9 cycles, ~36 s). Worst
 * case is the whole budget at fine steps; best case coarse steps on every
 * straight EXCEPT the straightness window - after the first wall and after
 * every corner the crawl walks straight_points coarse steps' worth of wall
 * at fine steps before a run is proven straight (T8c: 50-61 fine contacts
 * each, 315 of the 645 fine points). The law-2 descent to z_machine is not
 * in the figure (T8c: 68 s for 125 mm).
 */
export const TRACE_CYCLE_SECONDS = 1.5;
export const TRACE_MARCH_SECONDS_PER_MM = 1.0;
export const TRACE_CONFIRM_SECONDS = 4;
/** A closed lap turns the heading once round: the turn the 'turns' confirm cadence is spread over. */
export const TRACE_LAP_TURN_DEG = 360;

export interface TraceEstimateInput {
    maxPerimeterMm: number;
    fineStepMm: number;
    coarseStepMm: number;
    accuracyEveryMm: number | null;
    expectedCorners: number;
    /** The first-wall march travel (coarse 1 mm steps). */
    maxTravelMm?: number;
    confirmAt: Iterable<ConfirmAt>;
    turnStepDeg: number;
    majorTurnDeg: number;
    /** Contacts the straightness line needs; the window spans this many coarse steps, walked at fine steps. */
    straightPoints: number;
}

export interface TraceConfirmEstimate {
    /** Confirm cycles expected over the lap: the first wall's, the corners', the accuracy points'. */
    total: number;
    /** Per expected corner: the first block of the corner ('unexpected') plus one per major_turn_deg of turning inside it ('turns'). */
    perCorner: number;
    /** From 'turns' alone when there are no corners to anchor the count (a round pocket: one per major_turn_deg of the lap). */
    fromTurns: number;
    accuracy: number;
}

/**
 * How many confirm cycles the crawl will run (#185: T8c ran 9 against an
 * estimate of 5 - "1 + one per corner" ignored the 'turns' cadence). The
 * first-wall march always confirms. With confirm_at 'unexpected' the first
 * blocked step of each corner confirms and resets the turn counter; with
 * 'turns' a contact confirms once the heading has turned major_turn_deg
 * since the last confirm - inside a corner of C degrees walked in
 * turn_step_deg blocks that is one more cycle per ceil(major / step) blocks
 * after the first: a 90 deg corner at 10 deg steps and major 45 confirms
 * twice (blocks 1 and 6), so a four-corner pocket runs 1 + 4 x 2 = 9. The
 * corners share the lap's 360 deg of turn (an n-corner pocket has n corners
 * of 360 / n whatever its aspect ratio); with no corners expected the
 * 'turns' cadence runs over the lap's turn itself. Accuracy points are the
 * budget over accuracy_every_mm (an upper bound: every other confirm cycle
 * resets that counter too).
 */
export function expectedConfirmCycles(p: TraceEstimateInput): TraceConfirmEstimate {
    const at = new Set(p.confirmAt);
    const corners = Math.max(0, Math.round(p.expectedCorners));
    const turnStep = Math.max(1e-6, p.turnStepDeg);
    const major = Math.max(turnStep, p.majorTurnDeg);
    const blocksPerMajorTurn = Math.max(1, Math.ceil(major / turnStep - 1e-9));
    const lapTurnsOnly = Math.floor(TRACE_LAP_TURN_DEG / major + 1e-9);
    let perCorner = 0;
    let fromTurns = 0;
    if (corners > 0 && at.has('unexpected')) {
        const blocksPerCorner = Math.ceil(TRACE_LAP_TURN_DEG / corners / turnStep - 1e-9);
        perCorner = 1 + (at.has('turns') ? Math.floor((blocksPerCorner - 1) / blocksPerMajorTurn) : 0);
    } else if (at.has('turns')) {
        fromTurns = lapTurnsOnly;
    }
    const accuracy = at.has('every') && p.accuracyEveryMm ? Math.ceil(p.maxPerimeterMm / p.accuracyEveryMm) : 0;
    return { total: 1 + corners * perCorner + fromTurns + accuracy, perCorner, fromTurns, accuracy };
}

export function estimateTraceTime(p: TraceEstimateInput): {
    worstMinutes: number;
    bestMinutes: number;
    worstCycles: number;
    /** Best case: coarse steps everywhere except the straightness windows (requalifyMm at fine steps). */
    bestCycles: number;
    /** Wall walked at fine steps before each straight run is proven: (1 + expected corners) x straight_points coarse steps. */
    requalifyMm: number;
    confirmCycles: number;
    confirms: TraceConfirmEstimate;
    approachSeconds: number;
} {
    const worstCycles = Math.ceil(p.maxPerimeterMm / p.fineStepMm);
    const windowMm = p.straightPoints * p.coarseStepMm;
    const requalifyMm = r3(Math.min(p.maxPerimeterMm, (1 + Math.max(0, Math.round(p.expectedCorners))) * windowMm));
    const bestCycles = Math.ceil(requalifyMm / p.fineStepMm) + Math.ceil((p.maxPerimeterMm - requalifyMm) / p.coarseStepMm);
    const confirms = expectedConfirmCycles(p);
    const confirmSeconds = confirms.total * TRACE_CONFIRM_SECONDS;
    const approachSeconds = Math.round((p.maxTravelMm || 0) * TRACE_MARCH_SECONDS_PER_MM);
    return {
        worstCycles,
        bestCycles,
        requalifyMm,
        confirmCycles: confirms.total,
        confirms,
        approachSeconds,
        worstMinutes: Math.round((worstCycles * TRACE_CYCLE_SECONDS + confirmSeconds + approachSeconds) / 60),
        bestMinutes: Math.round((bestCycles * TRACE_CYCLE_SECONDS + confirmSeconds + approachSeconds) / 60),
    };
}
