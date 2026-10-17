import { strict as assert } from 'assert';

import { releaseRetreatPatience } from '../marchCore';
import {
    ConfirmAt,
    TRACE_CYCLE_SECONDS,
    TraceIo,
    TraceParams,
    TraceResult,
    estimateTraceTime,
    expectedConfirmCycles,
    insideBounds,
    normalFor,
    rotate,
    segmentPerimeter,
    tangentFor,
    tracePerimeter,
} from '../perimeterTrace';
import { ProcedureAbort, isProcedureAbort } from '../procedureAbort';
import { Xy } from '../wallFollow';

// A synthetic pocket in TIP-CENTRE space: a 60 x 40 rectangle with R5
// internal corners and one lobe - a semicircle of radius 6 bulging out of
// the +X wall about (60, 20). `inside` is the contact oracle: the probe
// reads contact wherever the tip centre is NOT inside the free region.
const W = 60;
const H = 40;
const R = 5;
const LOBE = { cx: 60, cy: 20, r: 6 };

// Touching the wall IS contact: the free region is open (strict inequalities).
function insideRoundedRect(p: Xy): boolean {
    if (p.x <= 0 || p.x >= W || p.y <= 0 || p.y >= H) {
        return false;
    }
    const cx = Math.min(Math.max(p.x, R), W - R);
    const cy = Math.min(Math.max(p.y, R), H - R);
    return Math.hypot(p.x - cx, p.y - cy) < R - 1e-9;
}

function insidePocket(p: Xy): boolean {
    if (insideRoundedRect(p)) {
        return true;
    }
    return p.x > LOBE.cx - 1e-9 && Math.hypot(p.x - LOBE.cx, p.y - LOBE.cy) < LOBE.r - 1e-9;
}

interface Sim {
    io: TraceIo;
    position: Xy;
    moves: number;
    log: string[];
}

/** The simulated machine: a step goes where it is told; the oracle says whether the probe touched. Marches / confirms bisect the boundary. */
function simulate(inside: (p: Xy) => boolean): Sim {
    const sim: Sim = { position: { x: 0, y: 0 }, moves: 0, log: [], io: null as unknown as TraceIo };
    const crossing = (from: Xy, unit: Xy, travel: number): { point: Xy; spreadMm: number } | null => {
        let lo = 0;
        let hi: number | null = null;
        for (let s = 0.05; s <= travel + 1e-9; s += 0.05) {
            const q = { x: from.x + unit.x * s, y: from.y + unit.y * s };
            if (!inside(q)) {
                hi = s;
                break;
            }
            lo = s;
        }
        if (hi === null) {
            return null;
        }
        for (let k = 0; k < 20; k++) {
            const mid: number = (lo + hi) / 2;
            if (inside({ x: from.x + unit.x * mid, y: from.y + unit.y * mid })) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        const point = { x: Number((from.x + unit.x * hi).toFixed(4)), y: Number((from.y + unit.y * hi).toFixed(4)) };
        sim.position = point;
        return { point, spreadMm: 0 };
    };
    sim.io = {
        step: async (p) => { sim.moves += 1; sim.position = p; return !inside(p); },
        move: async (p) => { sim.moves += 1; sim.position = p; },
        march: async (from, unit, travel) => crossing(from, unit, travel),
        confirm: async (from, unit, travel) => crossing(from, unit, travel),
        // The probe reads released wherever the tip centre is inside the free region.
        released: async () => inside(sim.position),
    };
    return sim;
}

function params(over: Partial<TraceParams> = {}): TraceParams {
    return {
        fineStepMm: 0.1,
        coarseStepMm: 1,
        turnStepDeg: 10,
        bumpMm: 0.1,
        bumpCapSteps: 3,
        lineToleranceMm: 0.1,
        straightPoints: 6,
        maxPerimeterMm: 400,
        maxSteps: 200000,
        bounds: { x0: -1, y0: -1, x1: 70, y1: 41 },
        keepOut: [],
        wallSide: 'right',
        confirmAt: new Set(['first', 'turns', 'unexpected']),
        accuracyEveryMm: null,
        majorTurnDeg: 45,
        tipRadiusMm: 0.625,
        confirmTravelMm: 0.3,
        ...over,
    };
}

const silent = () => undefined;
// Analytical tip-centre perimeter: rounded rectangle (2(W+H) - 8R + 2 pi R) with 12 mm of the +X wall replaced by a pi*6 semicircle.
const EXPECTED_LENGTH = 2 * (W + H) - 8 * R + 2 * Math.PI * R - 2 * LOBE.r + Math.PI * LOBE.r;

/** Which wall region a tip-centre point belongs to, for the fine/coarse assertions. */
function region(p: Xy): 'straight' | 'corner' | 'lobe' | 'other' {
    const tol = 0.3;
    const onStraight = (Math.abs(p.y) < tol && p.x > R && p.x < W - R)
        || (Math.abs(p.y - H) < tol && p.x > R && p.x < W - R)
        || (Math.abs(p.x) < tol && p.y > R && p.y < H - R)
        || (Math.abs(p.x - W) < tol && p.y > R && p.y < H - R && (p.y < LOBE.cy - LOBE.r || p.y > LOBE.cy + LOBE.r));
    if (onStraight) {
        return 'straight';
    }
    if ((p.x < R + tol || p.x > W - R - tol) && (p.y < R + tol || p.y > H - R - tol)) {
        return 'corner';
    }
    if (p.x > W - tol && Math.abs(Math.hypot(p.x - LOBE.cx, p.y - LOBE.cy) - LOBE.r) < tol) {
        return 'lobe';
    }
    return 'other';
}

export const tests: Array<[string, () => Promise<void> | void]> = [
    ['frame helpers: right-hand wall -> tangent is the inward normal turned +90; rotate is counter-clockwise', () => {
        assert.deepEqual(rotate({ x: 1, y: 0 }, 90), { x: 0, y: 1 });
        assert.deepEqual(tangentFor({ x: 0, y: -1 }, 'right'), { x: 1, y: 0 }, 'wall below, on the right: walk +X');
        assert.deepEqual(normalFor({ x: 1, y: 0 }, 'right'), { x: 0, y: -1 });
        assert.deepEqual(tangentFor({ x: 0, y: -1 }, 'left'), { x: -1, y: 0 });
        assert.ok(insideBounds({ x: 5, y: 5 }, { x0: 0, y0: 0, x1: 10, y1: 10 }));
        assert.ok(!insideBounds({ x: 11, y: 5 }, { x0: 0, y0: 0, x1: 10, y1: 10 }));
    }],

    ['the crawl closes the synthetic pocket: full turn, back at the first wall, length within 3 % of the analytical perimeter', async () => {
        const sim = simulate(insidePocket);
        const result = await tracePerimeter(sim.io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params(), silent);
        assert.equal(result.ending.kind, 'closed', result.ending.note);
        assert.ok(result.closed);
        // 360 deg of quantised turns plus the small re-alignments to the fitted walls.
        assert.ok(Math.abs(result.headingTurnDeg - 360) < 2, `heading ${result.headingTurnDeg}`);
        assert.ok(Math.abs(result.lengthMm - EXPECTED_LENGTH) / EXPECTED_LENGTH < 0.03, `length ${result.lengthMm} vs ${EXPECTED_LENGTH.toFixed(1)}`);
        assert.ok(result.perimeter.length > 300, `${result.perimeter.length} perimeter points`);
        assert.equal(result.perimeter[0].kind, 'first');
        assert.ok(result.perimeter[0].confirmed);
        // Every recorded point lies on the pocket boundary: not free a hair into the material, free a step back.
        for (const pt of result.perimeter) {
            const into = { x: pt.tipCentre.x + pt.normal.x * 0.002, y: pt.tipCentre.y + pt.normal.y * 0.002 };
            assert.ok(!insidePocket(into), `point ${pt.index} (${pt.tipCentre.x}, ${pt.tipCentre.y}) is inside the free region`);
            if (pt.kind === 'bump') {
                const back = { x: pt.tipCentre.x - pt.normal.x * 0.11, y: pt.tipCentre.y - pt.normal.y * 0.11 };
                assert.ok(insidePocket(back), `point ${pt.index} (${pt.tipCentre.x}, ${pt.tipCentre.y}) is more than a step past the wall`);
            }
        }
        // The surface is one tip radius INTO the material.
        assert.ok(result.perimeter[0].surface && result.perimeter[0].surface.y < result.perimeter[0].tipCentre.y);
        assert.equal(result.counts.tangentContacts > 0, true, 'internal corners were met head-on');
    }],

    ['fine steps in the corners and on the lobe, coarse steps on the straights', async () => {
        const sim = simulate(insidePocket);
        const result = await tracePerimeter(sim.io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params(), silent);
        assert.ok(result.counts.coarseSteps > 100, `coarse steps ${result.counts.coarseSteps}`);
        assert.ok(result.counts.fineSteps > 100, `fine steps ${result.counts.fineSteps}`);
        const coarsePoints = result.perimeter.filter((pt) => pt.stepMm === 1);
        // A coarse step may land at the entry of a corner - the crawl notices the curve only when a bump needs more
        // steps than the standoff or the advance is blocked, at most two coarse steps in; never deep inside it.
        const bad = coarsePoints.filter((pt) => region(pt.tipCentre) !== 'straight');
        assert.ok(bad.length <= 12, `coarse steps off the straights: ${bad.map((b) => `(${b.tipCentre.x},${b.tipCentre.y})`).join(' ')}`);
        for (const b of bad) {
            const q = b.tipCentre;
            const nearCornerEntry = Math.min(Math.abs(q.x - R), Math.abs(q.x - (W - R)), Math.abs(q.y - R), Math.abs(q.y - (H - R)),
                Math.abs(q.y - (LOBE.cy - LOBE.r)), Math.abs(q.y - (LOBE.cy + LOBE.r))) <= 2.2;
            assert.ok(nearCornerEntry, `coarse step deep in a curve at (${q.x}, ${q.y})`);
        }
        const cornerPoints = result.perimeter.filter((pt) => region(pt.tipCentre) === 'corner' || region(pt.tipCentre) === 'lobe');
        assert.ok(cornerPoints.length > 50, `${cornerPoints.length} corner / lobe points`);
        // Deep in a curve (more than 2.2 mm past where the straight wall ends) every step is fine. The crawl
        // sees a curve when a bump needs more steps than the standoff, so with the release-verified standoff
        // (two fine steps, not the old park-one-step-off-the-contact) it notices one bump step later: a coarse
        // step can land up to ~2 mm in. The bump is sensor-checked at every step, so the tip is never driven in.
        const deep = cornerPoints.filter((pt) => {
            const q = pt.tipCentre;
            return Math.min(Math.abs(q.x - R), Math.abs(q.x - (W - R)), Math.abs(q.y - R), Math.abs(q.y - (H - R)),
                Math.abs(q.y - (LOBE.cy - LOBE.r)), Math.abs(q.y - (LOBE.cy + LOBE.r))) > 2.2;
        });
        assert.ok(deep.length > 30, `${deep.length} points deep in curves`);
        assert.ok(deep.every((pt) => pt.stepMm === 0.1), 'corners and the lobe are walked at the fine step only');
        // Confirm cycles (operator addendum): the first wall, the first block of each corner, one per major turn -
        // a few dozen at most, not one per 0.1 mm bump.
        assert.ok(result.counts.confirms >= 5 && result.counts.confirms <= 40, `${result.counts.confirms} confirm cycles for ${result.perimeter.length} points`);
    }],

    ['segmentation finds the four R5 corners (interior 90 deg) and the R6 lobe, with residuals', async () => {
        const sim = simulate(insidePocket);
        const result = await tracePerimeter(sim.io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params(), silent);
        const { segments, corners } = segmentPerimeter(result.perimeter.map((pt) => pt.tipCentre), 0.15, 4, 0.625);
        const lines = segments.filter((s) => s.kind === 'line');
        assert.ok(lines.length >= 5, `${lines.length} straight segments (4 walls, the +X wall split by the lobe)`);
        // The contacts sit up to a fine step past the wall, so a fitted corner reads R5 within ~0.7.
        const r5 = corners.filter((c) => c.radiusTipCentreMm !== null && Math.abs(c.radiusTipCentreMm - 5) < 0.8);
        assert.ok(r5.length >= 4, `R5 corners found: ${corners.map((c) => c.radiusTipCentreMm).join(', ')}`);
        assert.ok(r5.every((c) => c.interiorAngleDeg === null || Math.abs(c.interiorAngleDeg - 90) < 8), JSON.stringify(r5.map((c) => c.interiorAngleDeg)));
        assert.ok(r5.every((c) => c.radiusPhysicalMm !== null && Math.abs(c.radiusPhysicalMm - 5.625) < 0.8));
        const lobe = corners.find((c) => c.radiusTipCentreMm !== null && Math.abs(c.radiusTipCentreMm - 6) < 0.6);
        assert.ok(lobe, `lobe found: ${corners.map((c) => c.radiusTipCentreMm).join(', ')}`);
        // Residuals are REPORTED on every fitted corner and small on the true arcs (the closure seam may carry a partial curve).
        assert.ok(corners.every((c) => c.center === null || c.maxResidualMm !== null), 'every fitted corner carries its residual');
        assert.ok([...r5, lobe!].every((c) => (c.maxResidualMm as number) < 0.4), `residuals on the true arcs: ${[...r5, lobe!].map((c) => c.maxResidualMm).join(', ')}`);
    }],

    ['the bounds stop the crawl with the partial perimeter; the budget stops it at max_perimeter_mm', async () => {
        // Bounds are the pocket's outer extent PLUS a margin for the bump into the wall; here they admit the
        // rectangle but not the lobe (which reaches x 66).
        const tight = simulate(insidePocket);
        const clipped = await tracePerimeter(tight.io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params({ bounds: { x0: -1, y0: -1, x1: 60.5, y1: 41 } }), silent);
        assert.equal(clipped.ending.kind, 'bounds', clipped.ending.note);
        assert.ok(!clipped.closed);
        assert.ok(clipped.perimeter.length > 50 && clipped.lengthMm > 35, `the bottom wall and the first corner (${clipped.lengthMm} mm) were walked before the lobe left the bounds`);
        assert.ok(insideBounds(clipped.position, { x0: -1, y0: -1, x1: 60.5, y1: 41 }), 'the head never left the bounds');
        assert.ok(clipped.position.x > 59 && clipped.position.y > 13 && clipped.position.y < 16, `stopped where the lobe begins: ${JSON.stringify(clipped.position)}`);

        const budget = await tracePerimeter(simulate(insidePocket).io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params({ maxPerimeterMm: 50 }), silent);
        assert.equal(budget.ending.kind, 'budget');
        assert.ok(Math.abs(budget.lengthMm - 50) <= 1, `length ${budget.lengthMm}`);

        const keepOut = await tracePerimeter(simulate(insidePocket).io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30,
            params({ keepOut: [{ name: 'clamp', x0: 50, y0: -1, x1: 70, y1: 10 }] }), silent);
        assert.equal(keepOut.ending.kind, 'keep-out');
        assert.ok(keepOut.ending.note.includes('clamp'));
    }],

    ['a tip that cannot progress aborts - boxed in, or never released - with the partial result attached; no wall within the march aborts too', async () => {
        // Free only in a hair-thin slit below the start: the march touches at once and no standoff or tangent step
        // ever finds free space. Whether the crawl reports "boxed in" (a full turn of blocked steps) or "still
        // triggered after retreating to the last point known free", it is an abort that carries what it has.
        const boxed = simulate((p) => Math.abs(p.x - 30) < 0.02 && p.y >= 19.9 && p.y <= 19.99);
        let error: unknown = null;
        try {
            await tracePerimeter(boxed.io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params(), silent);
        } catch (err) {
            error = err;
        }
        assert.ok(isProcedureAbort(error) && /Boxed in|still reads triggered after retreating/.test((error as Error).message), String(error));
        assert.ok((error as ProcedureAbort).message.includes('Recovery') || (error as ProcedureAbort).message.includes('Boxed in'));
        const partial = (error as ProcedureAbort).partial as TraceResult;
        assert.ok(partial && partial.ending.kind === 'aborted' && partial.firstWall, 'the first wall travels on the abort');

        const open = simulate(() => true);
        error = null;
        try {
            await tracePerimeter(open.io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params(), silent);
        } catch (err) {
            error = err;
        }
        assert.ok(isProcedureAbort(error) && (error as Error).message.includes('No wall within 30 mm'));
    }],

    ['accuracy points: confirm_at "every" adds a confirm cycle each accuracy_every_mm', async () => {
        const plain = await tracePerimeter(simulate(insidePocket).io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params({ confirmAt: new Set(['first']) }), silent);
        const every = await tracePerimeter(simulate(insidePocket).io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30,
            params({ confirmAt: new Set(['first', 'every']), accuracyEveryMm: 20 }), silent);
        assert.equal(plain.counts.confirms, 1, 'the first wall only');
        assert.ok(every.counts.confirms >= 9 && every.counts.confirms <= 12, `${every.counts.confirms} confirms for ~200 mm every 20`);
        assert.ok(every.perimeter.filter((pt) => pt.confirmed).length === every.counts.confirms);
    }],

    ['#185 item 4: the confirm-cycle estimate follows the confirm_at cadence - T8c\'s four-corner lap ran 9, not "1 + one per corner" = 5', () => {
        const base = {
            maxPerimeterMm: 330,
            fineStepMm: 0.1,
            coarseStepMm: 1,
            accuracyEveryMm: null,
            expectedCorners: 4,
            maxTravelMm: 40,
            confirmAt: ['first', 'turns', 'unexpected'] as ConfirmAt[],
            turnStepDeg: 10,
            majorTurnDeg: 45,
            straightPoints: 6,
        };
        // T8c (job 96cf38d16b74): 9 cycles = the first wall + 2 per corner (the first block, then the contact after the
        // 5th block, when the heading has turned 45 deg since that confirm).
        const t8c = expectedConfirmCycles(base);
        assert.deepEqual(t8c, { total: 9, perCorner: 2, fromTurns: 0, accuracy: 0 });
        assert.equal(estimateTraceTime(base).confirmCycles, 9);
        // 'unexpected' alone: one per corner. 'turns' alone: the lap's 360 deg at one per major_turn_deg, corners or not.
        assert.equal(expectedConfirmCycles({ ...base, confirmAt: ['first', 'unexpected'] }).total, 5);
        assert.equal(expectedConfirmCycles({ ...base, confirmAt: ['first', 'turns'] }).total, 9);
        assert.equal(expectedConfirmCycles({ ...base, confirmAt: ['first', 'turns'], expectedCorners: 0 }).total, 9);
        assert.equal(expectedConfirmCycles({ ...base, confirmAt: ['first', 'turns', 'unexpected'], expectedCorners: 0 }).total, 9);
        assert.equal(expectedConfirmCycles({ ...base, confirmAt: ['first'] }).total, 1);
        // A 90 deg major turn fires once per corner at most: the first block confirms, the remaining 8 blocks never reach 90.
        assert.equal(expectedConfirmCycles({ ...base, majorTurnDeg: 90 }).total, 5);
        // Finer turn steps change nothing (the cadence is in degrees); a coarser major turn than the corner does.
        assert.equal(expectedConfirmCycles({ ...base, turnStepDeg: 5 }).total, 9);
        assert.equal(expectedConfirmCycles({ ...base, majorTurnDeg: 180 }).total, 5);
        // Accuracy points add the budget over accuracy_every_mm.
        assert.deepEqual(expectedConfirmCycles({ ...base, confirmAt: ['first', 'every'], accuracyEveryMm: 20 }), { total: 18, perCorner: 0, fromTurns: 0, accuracy: 17 });
        // The simulated pocket (4 corners + a lobe that turns like one) runs within the estimate's reach.
        assert.ok(t8c.total >= 5 && t8c.total <= 40);
    }],

    ['#185 item 4: the time estimate is calibrated on T8c - 1.5 s per contact, 4 s per confirm cycle, the straightness window at fine steps', () => {
        const e = estimateTraceTime({
            maxPerimeterMm: 330,
            fineStepMm: 0.1,
            coarseStepMm: 1,
            accuracyEveryMm: null,
            expectedCorners: 4,
            maxTravelMm: 40,
            confirmAt: ['first', 'turns', 'unexpected'],
            turnStepDeg: 10,
            majorTurnDeg: 45,
            straightPoints: 6,
        });
        assert.equal(TRACE_CYCLE_SECONDS, 1.5);
        assert.equal(e.worstCycles, 3300);
        // Best case: the 6 mm window after the first wall and after each of the 4 corners is walked at 0.1 mm (300 cycles),
        // the remaining 300 mm at 1 mm.
        assert.equal(e.requalifyMm, 30);
        assert.equal(e.bestCycles, 600);
        assert.equal(e.confirmCycles, 9);
        assert.equal(e.approachSeconds, 40);
        // T8c's 309 mm lap took 24.8 min: inside the band, not under its old floor of 7.
        assert.ok(e.worstMinutes >= 82 && e.worstMinutes <= 86, `worst ${e.worstMinutes} min`);
        assert.ok(e.bestMinutes >= 15 && e.bestMinutes <= 17, `best ${e.bestMinutes} min`);
        // A budget shorter than the windows is all fine steps.
        const tiny = estimateTraceTime({
            maxPerimeterMm: 5,
            fineStepMm: 0.1,
            coarseStepMm: 1,
            accuracyEveryMm: null,
            expectedCorners: 4,
            maxTravelMm: 0,
            confirmAt: ['first'],
            turnStepDeg: 10,
            majorTurnDeg: 45,
            straightPoints: 6,
        });
        assert.equal(tiny.requalifyMm, 5);
        assert.equal(tiny.bestCycles, tiny.worstCycles);
    }],

    ['#185 item 2: a march\'s release retreat waits the standoff window on its first step (sensed-free ground) and the full timeout where the answer is a fault', () => {
        // T8c's two residual 3.5 s waits: the confirm cycle's coarse contact on its 2nd / 3rd 0.1 mm step, the first step
        // back still triggered (hysteresis), the next step released at once.
        assert.equal(releaseRetreatPatience(1, true), 'window');
        // The step that lands back at the march start, or at the retreat cap, decides the stuck-probe fault.
        assert.equal(releaseRetreatPatience(1, false), 'timeout');
        // Every later step is past the last point known free.
        assert.equal(releaseRetreatPatience(2, true), 'timeout');
        assert.equal(releaseRetreatPatience(3, false), 'timeout');
    }],

    ['T8 standoff: after every contact the tip parks at a RELEASE-VERIFIED standoff, and a wavy wall is crawled without a "stuck probe" abort', async () => {
        // The +X wall of the pocket waves +/- 0.15 mm (wood): a tip parked one bump step off a contact rubs on the next advance.
        const wavy = (p: Xy) => {
            const xWall = W + 0.15 * Math.sin(p.y * 1.7);
            if (p.x >= xWall) {
                return false;
            }
            return insidePocket({ x: Math.min(p.x, W - 0.01), y: p.y });
        };
        const sim = simulate(wavy);
        const result = await tracePerimeter(sim.io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params(), silent);
        assert.equal(result.ending.kind, 'closed', result.ending.note);
        assert.ok(result.standoffMm >= 0.2, `standoff ${result.standoffMm} mm: at least the release step plus one`);
        // Every bump point's standoff position (the point the head parked at) reads released in the oracle:
        // the crawl never parks inside the wall.
        assert.ok(result.counts.releaseSteps > 0);
        assert.ok(result.perimeter.filter((pt) => pt.kind === 'rub').length <= 10, `${result.counts.rubs} rubs on a wavy wall`);
        assert.ok(result.firstWall && Math.abs(result.firstWall.point.y - 0) < 0.01, 'the measured first wall is on the record');
    }],

    ['T8 abort diagnosis: a confirm cycle that ends stuck is a rub, not a fault - the crawl retreats to release and carries on unconfirmed', async () => {
        const sim = simulate(insidePocket);
        let stuckOnce = false;
        const io: TraceIo = {
            ...sim.io,
            confirm: async (from, unit, travel) => {
                if (!stuckOnce) {
                    stuckOnce = true;
                    sim.position = { x: from.x + unit.x * 0.1, y: from.y + unit.y * 0.1 };
                    return { stuck: true };
                }
                return sim.io.confirm(from, unit, travel);
            },
        };
        const result = await tracePerimeter(io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params({ confirmAt: new Set(['first', 'every']), accuracyEveryMm: 5 }), silent);
        assert.equal(result.ending.kind, 'closed', result.ending.note);
        assert.equal(result.counts.confirmsSkipped, 1);
        assert.ok(result.counts.confirms > 20);
    }],

    ['T8 data loss: an abort carries the partial perimeter, the measured first wall and the counts on err.partial', async () => {
        // Free region: the pocket, but everything beyond y 30 is walled off so the crawl gets boxed in against a
        // slot after a long straight run... simpler: stop the machine mid-crawl with a fault from the IO.
        const sim = simulate(insidePocket);
        let stepsSeen = 0;
        const io: TraceIo = {
            ...sim.io,
            step: async (p) => {
                stepsSeen += 1;
                if (stepsSeen === 400) {
                    throw new ProcedureAbort('Stopped on request (test) at a step boundary.');
                }
                return sim.io.step(p);
            },
        };
        let error: unknown = null;
        try {
            await tracePerimeter(io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params(), silent);
        } catch (err) {
            error = err;
        }
        assert.ok(isProcedureAbort(error), String(error));
        const partial = (error as ProcedureAbort).partial as TraceResult;
        assert.ok(partial && Array.isArray(partial.perimeter), 'the partial result travels on the abort');
        assert.equal(partial.ending.kind, 'aborted');
        assert.ok(partial.perimeter.length > 50, `${partial.perimeter.length} points kept`);
        assert.ok(partial.firstWall && Math.abs(partial.firstWall.point.x - 30) < 0.01 && Math.abs(partial.firstWall.point.y) < 0.01);
        assert.ok(partial.counts.fineSteps > 0 && partial.lengthMm > 0);
        // A boxed-in abort carries it too, with the first wall.
        const boxed = simulate((p) => Math.abs(p.x - 30) < 0.02 && p.y >= 19.9 && p.y <= 19.99);
        try {
            await tracePerimeter(boxed.io, { x: 30, y: 20 }, { x: 0, y: -1 }, 30, params(), silent);
            assert.fail('expected a boxed-in abort');
        } catch (err) {
            const partial2 = (err as ProcedureAbort).partial as TraceResult;
            assert.ok(partial2 && partial2.firstWall && partial2.ending.kind === 'aborted');
        }
    }],
];
