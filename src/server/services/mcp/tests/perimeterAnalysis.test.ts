import { strict as assert } from 'assert';

import {
    CORNER_ARC_SPAN_CONFIDENT_DEG, PerimeterCorner, analyseTrace, anchoredLength, arcSpanDeg, localNormals, segmentPerimeter,
} from '../perimeterAnalysis';
import {
    ReleasePatience, TraceIo, TracePoint, TracePointKind, TraceResult, emptyTraceCounts, tracePerimeter,
} from '../perimeterTrace';
import { RELEASE_TIMEOUT_MIN_MS, releaseTimeoutFor, standoffReleaseWindowFor } from '../procedureLimits';
import { isProcedureAbort } from '../procedureAbort';
import { Xy } from '../wallFollow';
import {
    T8B_KINDS, T8B_KNOWN, T8B_TIP_CENTRES, T8B_TIP_RADIUS_MM,
} from './fixtures/traceT8b';

// Issue #183: the T8 rerun's crawl measured the QuadEink back pocket to ~0.1
// mm (job d677bd88d31a), and the result misreported it. Every test here runs
// the reporting on the REAL 814 tip-centre points (tests/fixtures/traceT8b.ts).

const KIND: { [k: string]: TracePointKind } = { f: 'first', b: 'bump', t: 'tangent-contact', r: 'rub' };
const TIPS: Xy[] = T8B_TIP_CENTRES.map(([x, y]) => ({ x, y }));
const R = T8B_TIP_RADIUS_MM;
const PARAMS = { wallSide: 'right' as const, tipRadiusMm: R, fineStepMm: 0.1, coarseStepMm: 1, turnStepDeg: 10, lineToleranceMm: 0.1 };
const TOL = PARAMS.lineToleranceMm * 1.5;

/** The real trace as the crawl returned it, with a deliberately WRONG crawl normal (the analysis must not use it). */
function t8bTrace(): TraceResult {
    const perimeter: TracePoint[] = TIPS.map((tip, index) => ({
        index, tipCentre: tip, surface: null, normal: { x: 0, y: 1 }, kind: KIND[T8B_KINDS[index]], confirmed: false, spreadMm: null, alongMm: 0, stepMm: 0.1,
    }));
    return {
        perimeter,
        closed: true,
        ending: { kind: 'closed', note: 'perimeter closed after 309.277 mm, heading turned 361.121 deg' },
        lengthMm: 309.277,
        headingTurnDeg: 361.121,
        counts: emptyTraceCounts(),
        position: TIPS[TIPS.length - 1],
        firstWall: { point: TIPS[0], spreadMm: 0 },
        standoffMm: 0.2,
    };
}

const analysis = analyseTrace(t8bTrace(), PARAMS);

const angleDeg = (a: Xy, b: Xy) => (Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))) * 180) / Math.PI;

/**
 * The straights right after each corner, where the crawl heading's normal trailed the wall by 30-90 deg for tens of
 * points (t8b_summary.txt anomaly B), limited to where the tip-centre path is on the straight (past the arc).
 */
const AFTER_CORNER: { name: string; from: number; to: number; axis: 'x' | 'y'; sign: 1 | -1; lo: number; hi: number; known: number }[] = [
    { name: 'chuck end after the chuck +X corner', from: 143, to: 216, axis: 'y', sign: 1, lo: 150, hi: 191.5, known: T8B_KNOWN.surfaceChuckY },
    { name: '-X wall after the chuck -X corner', from: 286, to: 372, axis: 'x', sign: -1, lo: 158, hi: 242.5, known: T8B_KNOWN.surfaceXMinus },
    { name: 'free end after the free -X lobe', from: 560, to: 601, axis: 'y', sign: -1, lo: 151, hi: 188, known: T8B_KNOWN.surfaceFreeY },
    { name: '+X wall after the free +X lobe', from: 721, to: 782, axis: 'x', sign: 1, lo: 153.5, hi: 240, known: T8B_KNOWN.surfaceXPlus },
];

/** Whole straights (away from the corners and lobes) and the known surfaces. */
const WALLS: { name: string; axis: 'x' | 'y'; sign: 1 | -1; known: number; select: (p: Xy) => boolean }[] = [
    { name: '+X', axis: 'x', sign: 1, known: T8B_KNOWN.surfaceXPlus, select: (p) => p.x > 196 && p.y > 154 && p.y < 240 },
    { name: '-X', axis: 'x', sign: -1, known: T8B_KNOWN.surfaceXMinus, select: (p) => p.x < 143 && p.y > 154 && p.y < 240 },
    { name: 'chuck', axis: 'y', sign: 1, known: T8B_KNOWN.surfaceChuckY, select: (p) => p.y > 246.5 && p.x > 150 && p.x < 190 },
    { name: 'free', axis: 'y', sign: -1, known: T8B_KNOWN.surfaceFreeY, select: (p) => p.y < 146.5 && p.x > 152 && p.x < 188 },
];

function cornerNear(corners: PerimeterCorner[], at: Xy): PerimeterCorner {
    const c = corners.find((k) => {
        const mid = TIPS[k.fitIndices[Math.floor(k.fitIndices.length / 2)]];
        return mid && Math.hypot(mid.x - at.x, mid.y - at.y) < 8;
    });
    assert.ok(c, `no corner near (${at.x}, ${at.y}): ${JSON.stringify(corners.map((k) => [k.from, k.to, k.shape]))}`);
    return c as PerimeterCorner;
}

export const tests: Array<[string, () => Promise<void> | void]> = [
    ['#183 item 1: normals come from the local wall, not the crawl heading - surfaces on the straights right after each corner sit on the wall', () => {
        const report: string[] = [];
        for (const s of AFTER_CORNER) {
            let n = 0;
            let sumErr = 0;
            for (let i = s.from; i <= s.to; i++) {
                const pt = analysis.perimeter[i];
                const along = s.axis === 'x' ? pt.tipCentre.y : pt.tipCentre.x;
                if (along < s.lo || along > s.hi) {
                    continue;
                }
                n += 1;
                const wallNormal = s.axis === 'x' ? { x: s.sign, y: 0 } : { x: 0, y: s.sign };
                // The crawl's normal here was up to 90 deg off; the local one is within the 0.1 mm zig-zag's few degrees.
                assert.ok(angleDeg(pt.normal, wallNormal) < 5, `${s.name}: point ${i} normal ${JSON.stringify(pt.normal)}`);
                const surface = pt.surface as Xy;
                const axisSurface = (s.axis === 'x' ? pt.tipCentre.x : pt.tipCentre.y) + s.sign * R;
                const v = s.axis === 'x' ? surface.x : surface.y;
                // The surface is the tip centre + r along the WALL normal: what the normal adds is under 0.01 mm
                // (it was up to ~0.5 mm), so what is left is the contact itself.
                assert.ok(Math.abs(v - axisSurface) < 0.01, `${s.name}: point ${i} surface ${v} vs ${axisSurface}`);
                sumErr += (v - s.known) * s.sign;
            }
            assert.ok(n >= 25, `${s.name}: ${n} points`);
            report.push(`${s.name}: ${n} pts, mean ${(sumErr / n).toFixed(3)}`);
        }
        // Over each whole straight the surfaces sit within 0.15 mm of the known walls (+ = the pocket reads larger).
        for (const w of WALLS) {
            const pts = analysis.perimeter.filter((pt) => w.select(pt.tipCentre));
            assert.ok(pts.length > 40, `${w.name}: ${pts.length} points`);
            const mean = pts.reduce((acc, pt) => acc + ((w.axis === 'x' ? (pt.surface as Xy).x : (pt.surface as Xy).y) - w.known) * w.sign, 0) / pts.length;
            assert.ok(Math.abs(mean) < 0.15, `${w.name} wall: mean surface error ${mean.toFixed(3)} mm (${report.join('; ')})`);
        }
        assert.equal(analysis.normals.source, 'local-fit');
        assert.equal(analysis.normals.crawlNormalKept, 0);
    }],

    ['#183 item 1: the normal points INTO the material for either wall side, and a straight synthetic wall gets its exact normal', () => {
        const wall: Xy[] = [];
        for (let k = 0; k <= 30; k++) {
            wall.push({ x: k * 0.1, y: k % 2 ? 0.1 : 0 });
        }
        // Walking +X with the material on the right = below: normal (0, -1).
        const right = localNormals(wall, 'right', 1, false);
        assert.ok(right.every((nrm) => nrm && angleDeg(nrm, { x: 0, y: -1 }) < 5), JSON.stringify(right.slice(0, 3)));
        const left = localNormals(wall, 'left', 1, false);
        assert.ok(left.every((nrm) => nrm && angleDeg(nrm, { x: 0, y: 1 }) < 5));
    }],

    ['#183 item 2: collinear runs merge - the real pocket reports FOUR straight walls, each on its known surface', () => {
        const lines = analysis.segments.filter((s) => s.kind === 'line');
        assert.equal(lines.length, 4, JSON.stringify(analysis.segments.map((s) => [s.kind, s.from, s.to])));
        // The +X wall runs through the closure seam (the trace started on it): one wall, not two.
        assert.ok(lines.some((l) => l.from > l.to), 'the wall through the closure seam is one wall');
        // The per-point medians of the same data (t8b_summary.txt): +X 198.050, -X 141.008, chuck 248.505, free 144.582.
        const own: { [k: string]: number } = { '+X': 198.05, '-X': 141.008, chuck: 248.505, free: 144.582 };
        for (const w of WALLS) {
            const line = lines.find((l) => {
                if (l.kind !== 'line' || !l.surface) {
                    return false;
                }
                const nrm = l.surface.normal;
                return angleDeg(nrm, w.axis === 'x' ? { x: w.sign, y: 0 } : { x: 0, y: w.sign }) < 5;
            });
            assert.ok(line && line.kind === 'line' && line.surface, `no line for the ${w.name} wall`);
            const v = w.axis === 'x' ? line.surface.point.x : line.surface.point.y;
            assert.ok(Math.abs(v - own[w.name]) < 0.1, `${w.name}: surface line ${v} vs the points' median ${own[w.name]}`);
            // -X reads 0.19 outboard of the known 141.2: that is the contacts themselves (the tip-centre medians agree).
            assert.ok(Math.abs(v - w.known) < 0.2, `${w.name}: surface line ${v} vs known ${w.known}`);
            assert.ok(line.merged >= 2, `${w.name} was split before #183 (merged ${line.merged})`);
        }
    }],

    ['#183 item 3: a corner circle is fitted only to points off BOTH walls - the chuck +X corner lands on the known r 4.68', () => {
        const chuckPlusX = cornerNear(analysis.corners, T8B_KNOWN.chuckXPlusCentre);
        assert.equal(chuckPlusX.shape, 'arc');
        const c = chuckPlusX.center as Xy;
        const off = Math.hypot(c.x - T8B_KNOWN.chuckXPlusCentre.x, c.y - T8B_KNOWN.chuckXPlusCentre.y);
        assert.ok(off < 0.5, `chuck +X centre (${c.x}, ${c.y}) is ${off.toFixed(3)} mm from the known centre (was 2.12 mm)`);
        const dr = (chuckPlusX.radiusPhysicalMm as number) - T8B_KNOWN.chuckXPlusRadiusPhysicalMm;
        assert.ok(Math.abs(dr) < 0.5, `chuck +X physical r ${chuckPlusX.radiusPhysicalMm} vs 4.68 (was 6.71)`);
        // Residuals are reported, one per fitted point, and small on a true arc.
        assert.ok(chuckPlusX.residualsMm && chuckPlusX.residualsMm.length === chuckPlusX.fitIndices.length);
        assert.ok((chuckPlusX.rmsResidualMm as number) < TOL && (chuckPlusX.maxResidualMm as number) < TOL);
        // Every fitted point is off both adjacent wall lines by more than the tolerance, except the wall-to-arc
        // transition points the fit was extended over (#185) - at most extendedPoints of them.
        const lines = analysis.segments.filter((s) => s.kind === 'line');
        const plusX = lines.find((l) => l.kind === 'line' && l.surface && l.surface.normal.x > 0.9);
        const chuck = lines.find((l) => l.kind === 'line' && l.surface && l.surface.normal.y > 0.9);
        let onAWall = 0;
        for (const i of chuckPlusX.fitIndices) {
            for (const l of [plusX, chuck]) {
                if (l && l.kind === 'line') {
                    const res = (TIPS[i].x - l.fit.point.x) * l.fit.normal.x + (TIPS[i].y - l.fit.point.y) * l.fit.normal.y;
                    if (Math.abs(res) <= TOL) {
                        onAWall += 1;
                    }
                }
            }
        }
        assert.ok(onAWall <= chuckPlusX.extendedPoints, `${onAWall} fitted points on a wall line, ${chuckPlusX.extendedPoints} extended`);
        assert.ok(chuckPlusX.onWallPoints >= 1, 'the wall tails were left out of the fit');
        const chuckMinusX = cornerNear(analysis.corners, { x: 145.2, y: 243.9 });
        assert.equal(chuckMinusX.shape, 'arc');
        assert.ok(Math.abs((chuckMinusX.radiusPhysicalMm as number) - 4.42) < 0.5, `chuck -X r ${chuckMinusX.radiusPhysicalMm} (own sector fit 4.42)`);
        assert.ok(analysis.corners.every((k) => Math.abs((k.interiorAngleDeg as number) - 90) < 3), 'four square corners');
    }],

    ['#185 item 1: the fit takes the wall-to-arc transition points the circle explains better than the wall - longer spans, the chuck +X centre closer to the known', () => {
        // Without the extension the chuck +X fit was 39 points over ~60 deg (r 4.76, centre 0.15 mm off); with it the
        // transition points on the +X and chuck walls that sit on the circle join the fit.
        const chuckPlusX = cornerNear(analysis.corners, T8B_KNOWN.chuckXPlusCentre);
        assert.ok(chuckPlusX.extendedPoints >= 1, `chuck +X extended by ${chuckPlusX.extendedPoints} points`);
        assert.ok((chuckPlusX.arcSpanDeg as number) >= CORNER_ARC_SPAN_CONFIDENT_DEG, `chuck +X span ${chuckPlusX.arcSpanDeg} deg`);
        assert.equal(chuckPlusX.lowConfidence, false);
        const c = chuckPlusX.center as Xy;
        const off = Math.hypot(c.x - T8B_KNOWN.chuckXPlusCentre.x, c.y - T8B_KNOWN.chuckXPlusCentre.y);
        assert.ok(off < 0.15, `chuck +X centre ${off.toFixed(3)} mm from the known (was 0.15)`);
        assert.ok(Math.abs((chuckPlusX.radiusPhysicalMm as number) - T8B_KNOWN.chuckXPlusRadiusPhysicalMm) < 0.1, `chuck +X r ${chuckPlusX.radiusPhysicalMm} vs 4.68 (was 4.76)`);
        // The extension never exceeds the arc a tangent circle can subtend between the two walls (90 deg + the tolerance band).
        assert.ok((chuckPlusX.arcSpanDeg as number) <= 96, `span ${chuckPlusX.arcSpanDeg} within the 90 deg corner`);
        // The fit indices may run into the adjacent walls' ranges, by at most the extended points, and stay in trace order.
        const lines = analysis.segments.filter((s): s is Extract<typeof s, { kind: 'line' }> => s.kind === 'line');
        const inWall = chuckPlusX.fitIndices.filter((i) => lines.some((l) => (l.from <= l.to ? i >= l.from && i <= l.to : i >= l.from || i <= l.to)));
        assert.ok(inWall.length >= 1 && inWall.length <= chuckPlusX.extendedPoints, `${inWall.length} fit points inside wall ranges (extended ${chuckPlusX.extendedPoints})`);
        assert.ok(chuckPlusX.fitIndices.every((i, k) => k === 0 || i > chuckPlusX.fitIndices[k - 1]), 'fit indices in trace order');
        // The chuck -X corner (T8c's 61 deg slice read 0.36 small): the span is now well past the confidence line.
        const chuckMinusX = cornerNear(analysis.corners, { x: 145.2, y: 243.9 });
        assert.ok((chuckMinusX.arcSpanDeg as number) >= 80 && chuckMinusX.extendedPoints >= 5, `chuck -X span ${chuckMinusX.arcSpanDeg} deg, extended ${chuckMinusX.extendedPoints}`);
        assert.equal(chuckMinusX.lowConfidence, false);
        assert.ok((chuckMinusX.rmsResidualMm as number) <= TOL, 'the extended fit still holds its points within the tolerance');
        // Irregular lobes carry no span and are never flagged.
        for (const lobe of analysis.corners.filter((k) => k.shape === 'irregular')) {
            assert.equal(lobe.arcSpanDeg, null);
            assert.equal(lobe.lowConfidence, false);
            assert.equal(lobe.extendedPoints, 0);
        }
    }],

    ['#185 item 1: a synthetic R3 corner - the full arc fits over ~90 deg; the same corner with only a 60 deg slice of arc is flagged LOW CONFIDENCE', () => {
        // Tip-centre path with the material on the right: wall A along +X at y = 0, an internal corner arc about (-3, 3)
        // r 3 from the tangent (-3, 0) to the tangent (0, 3), wall B along +Y at x = 0.
        const C = { x: -3, y: 3 };
        const R3 = 3;
        const build = (arcFromDeg: number, arcToDeg: number): Xy[] => {
            const pts: Xy[] = [];
            const start = { x: C.x + R3 * Math.cos((arcFromDeg * Math.PI) / 180), y: C.y + R3 * Math.sin((arcFromDeg * Math.PI) / 180) };
            const end = { x: C.x + R3 * Math.cos((arcToDeg * Math.PI) / 180), y: C.y + R3 * Math.sin((arcToDeg * Math.PI) / 180) };
            for (let k = 0; -15 + k * 0.1 < start.x - 1e-9; k++) {
                pts.push({ x: Number((-15 + k * 0.1).toFixed(3)), y: 0 });
            }
            const stepDeg = (0.1 / R3) * (180 / Math.PI);
            for (let k = 0; arcFromDeg + k * stepDeg <= arcToDeg + 1e-9; k++) {
                const a = ((arcFromDeg + k * stepDeg) * Math.PI) / 180;
                pts.push({ x: Number((C.x + R3 * Math.cos(a)).toFixed(3)), y: Number((C.y + R3 * Math.sin(a)).toFixed(3)) });
            }
            for (let k = 1; end.y + k * 0.1 <= 15; k++) {
                pts.push({ x: 0, y: Number((end.y + k * 0.1).toFixed(3)) });
            }
            return pts;
        };
        const tol = 0.15;
        const full = segmentPerimeter(build(-90, 0), tol, 4, 1.25, 4, { wallSide: 'right' });
        assert.equal(full.corners.length, 1, JSON.stringify(full.segments.map((s) => [s.kind, s.from, s.to])));
        const whole = full.corners[0];
        assert.equal(whole.shape, 'arc');
        // The greedy wall extension had absorbed the first acos(1 - tol / r) = 18 deg of arc at each end (a 54 deg
        // slice); the changepoint gives them back to the arc.
        assert.ok(whole.extendedPoints >= 10, `extended ${whole.extendedPoints}`);
        assert.ok((whole.arcSpanDeg as number) >= 85 && (whole.arcSpanDeg as number) <= 96, `full arc span ${whole.arcSpanDeg}`);
        assert.equal(whole.lowConfidence, false);
        assert.ok(Math.abs((whole.radiusTipCentreMm as number) - R3) < 0.02, `r ${whole.radiusTipCentreMm}`);
        assert.ok(Math.hypot((whole.center as Xy).x - C.x, (whole.center as Xy).y - C.y) < 0.02);
        assert.ok(Math.abs((whole.interiorAngleDeg as number) - 90) < 0.5);

        // Only the middle 60 deg of the arc exists; the walls run straight to where it starts (ledges within the
        // tolerance of the wall lines). The circle through the slice is right, but a 60 deg sagitta carries it.
        const slice = segmentPerimeter(build(-75, -15), tol, 4, 1.25, 4, { wallSide: 'right' });
        assert.equal(slice.corners.length, 1, JSON.stringify(slice.segments.map((s) => [s.kind, s.from, s.to])));
        const part = slice.corners[0];
        assert.equal(part.shape, 'arc');
        assert.ok((part.arcSpanDeg as number) >= 55 && (part.arcSpanDeg as number) < CORNER_ARC_SPAN_CONFIDENT_DEG, `slice span ${part.arcSpanDeg}`);
        assert.equal(part.lowConfidence, true, 'a fit under 70 deg is low confidence');
        assert.ok(Math.abs((part.radiusTipCentreMm as number) - R3) < 0.05, `slice r ${part.radiusTipCentreMm}`);
        // The ledge points on the wall lines stay with the walls (the line explains them exactly).
        assert.ok(part.fitIndices.every((i) => {
            const q = build(-75, -15)[i];
            return Math.hypot(q.x - C.x, q.y - C.y) > R3 - 0.01 && Math.hypot(q.x - C.x, q.y - C.y) < R3 + 0.01;
        }), 'every fitted point is on the arc');

        // arcSpanDeg sums signed turns about the centre: a zig-zag along the arc does not inflate it.
        const zig = [0, 10, 5, 20, 15, 30].map((deg) => ({ x: C.x + R3 * Math.cos((deg * Math.PI) / 180), y: C.y + R3 * Math.sin((deg * Math.PI) / 180) }));
        assert.ok(Math.abs(arcSpanDeg(zig, [0, 1, 2, 3, 4, 5], C) - 30) < 1e-6);
    }],

    ['#183 item 4: the free-end lobes are IRREGULAR - no single radius, a polyline and line / arc pieces within the tolerance', () => {
        assert.equal(analysis.corners.length, 4);
        const lobes = analysis.corners.filter((k) => k.shape === 'irregular');
        assert.equal(lobes.length, 2, JSON.stringify(analysis.corners.map((k) => [k.shape, k.rmsResidualMm])));
        for (const lobe of lobes) {
            const mid = TIPS[lobe.fitIndices[Math.floor(lobe.fitIndices.length / 2)]];
            assert.ok(mid.y < 155, `lobe at the free end (${mid.x}, ${mid.y})`);
            assert.equal(lobe.radiusTipCentreMm, null);
            assert.equal(lobe.radiusPhysicalMm, null);
            assert.equal(lobe.center, null);
            // Honest fit quality: what one circle would have done (T8: rms 1.26 / 0.95).
            assert.ok(lobe.singleArc && lobe.singleArc.rmsResidualMm > TOL, JSON.stringify(lobe.singleArc));
            assert.ok(lobe.polyline && lobe.polyline.length >= 4, `polyline ${lobe.polyline && lobe.polyline.length} vertices`);
            assert.ok(lobe.pieces && lobe.pieces.length >= 2, `pieces ${JSON.stringify(lobe.pieces)}`);
            const pieces = lobe.pieces || [];
            assert.ok(pieces.every((p) => p.maxResidualMm <= TOL + 1e-9), 'every piece holds its points within the tolerance');
            assert.equal(pieces[0].from, lobe.from);
            assert.equal(pieces[pieces.length - 1].to, lobe.to, 'the pieces cover the whole lobe');
            for (let k = 1; k < pieces.length; k++) {
                assert.equal(pieces[k].from, pieces[k - 1].to, 'consecutive pieces share their joining point');
            }
            assert.ok(pieces.some((p) => p.kind === 'arc'), 'the bends are arcs');
        }
    }],

    ['#183 item 6: both perimeter lengths - tip-centre (the crawl\'s 309.3) and surface (~2 pi r longer)', () => {
        assert.equal(analysis.lengths.tipCentreMm, 309.277);
        assert.equal(anchoredLength(TIPS, 0.2), 309.277, 'the anchored rule reproduces the crawl\'s own length');
        const surface = analysis.lengths.surfaceMm as number;
        const offset = 2 * Math.PI * R;
        assert.ok(surface - 309.277 > offset - 0.5 && surface - 309.277 < offset + 1, `surface ${surface} vs tip + 2 pi r ${(309.277 + offset).toFixed(3)}`);
        assert.ok(Math.abs((analysis.lengths.surfaceFromTurnMm as number) - (309.277 + R * (361.121 * Math.PI) / 180)) < 0.01);
    }],

    ['#183 segmentation on a partial (open) trace: no seam merge, the walls it has are still fitted', () => {
        const open = segmentPerimeter(TIPS.slice(0, 300), TOL, 4, R, 4, { mergeAngleDeg: 10, wallSide: 'right' });
        const lines = open.segments.filter((s) => s.kind === 'line');
        assert.ok(lines.length >= 2 && lines.length <= 3, JSON.stringify(open.segments.map((s) => [s.kind, s.from, s.to])));
        assert.ok(lines.every((l) => l.from <= l.to));
        assert.ok(open.corners.length >= 1 && open.corners[0].shape === 'arc');
    }],

    ['#183 item 5: standoff retreat steps short of the last point known free wait only the window; the fault test keeps the full timeout', async () => {
        // Window vs timeout on the real machine (T8: GPIO, sensor_delay 50).
        assert.equal(standoffReleaseWindowFor(50), 500);
        assert.equal(releaseTimeoutFor(50), RELEASE_TIMEOUT_MIN_MS);
        assert.ok(standoffReleaseWindowFor(300) < releaseTimeoutFor(300));
        assert.ok(standoffReleaseWindowFor(5000) <= releaseTimeoutFor(5000));

        // A straight wall at y = 0 (free for y > 0), crawled along +X. The probe stays triggered until the tip is
        // TWO fine steps off the wall - the T8 case the 3.5 s waits came from.
        const calls: { patience: ReleasePatience; released: boolean }[] = [];
        let pos: Xy = { x: 0, y: 5 };
        const touching = (p: Xy) => p.y <= 0;
        const io: TraceIo = {
            step: async (p) => { pos = p; return touching(p); },
            move: async (p) => { pos = p; },
            march: async (from) => { pos = { x: from.x, y: 0 }; return { point: pos, spreadMm: 0 }; },
            confirm: async (from) => { pos = { x: from.x, y: 0 }; return { point: pos, spreadMm: 0 }; },
            released: async (patience) => {
                const released = pos.y > 0.15;
                calls.push({ patience, released });
                return released;
            },
        };
        const params = {
            fineStepMm: 0.1,
            coarseStepMm: 1,
            turnStepDeg: 10,
            bumpMm: 0.1,
            bumpCapSteps: 3,
            lineToleranceMm: 0.1,
            straightPoints: 6,
            maxPerimeterMm: 5,
            maxSteps: 5000,
            bounds: { x0: -1, y0: -1, x1: 20, y1: 10 },
            keepOut: [],
            wallSide: 'right' as const,
            confirmAt: new Set(['first' as const]),
            accuracyEveryMm: null,
            majorTurnDeg: 45,
            tipRadiusMm: 1.25,
            confirmTravelMm: 0.3,
        };
        const result = await tracePerimeter(io, { x: 0, y: 5 }, { x: 0, y: -1 }, 10, params, () => undefined);
        assert.equal(result.ending.kind, 'budget', result.ending.note);
        const stillIn = calls.filter((c) => !c.released);
        assert.ok(stillIn.length > 10, `${stillIn.length} retreat steps found the probe still in the wall`);
        // Every one of them was answered by the next step back, not by the 3.5 s timeout.
        assert.ok(stillIn.every((c) => c.patience === 'window'), JSON.stringify(stillIn.slice(0, 5)));

        // A probe that NEVER releases: the retreat steps short of the cap use the window, the step past the last
        // point known free waits the full timeout, and then the crawl aborts - the safety check is unchanged.
        const stuck: ReleasePatience[] = [];
        const stuckIo: TraceIo = { ...io, released: async (patience) => { stuck.push(patience); return false; } };
        let error: unknown = null;
        try {
            await tracePerimeter(stuckIo, { x: 0, y: 5 }, { x: 0, y: -1 }, 10, params, () => undefined);
        } catch (err) {
            error = err;
        }
        assert.ok(isProcedureAbort(error) && /still reads triggered after retreating/.test((error as Error).message), String(error));
        assert.equal(stuck[stuck.length - 1], 'timeout', 'the step past the last point known free waits the full timeout');
        assert.deepEqual(stuck.slice(0, -1), stuck.slice(0, -1).map(() => 'window'));
        assert.equal(stuck.length, params.bumpCapSteps + 1);
    }],
];
