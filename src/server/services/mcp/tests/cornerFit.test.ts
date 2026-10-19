import { strict as assert } from 'assert';

import {
    bisectorReachFor,
    centreDistanceFor,
    cornerGeometry,
    fitCircle,
    radialStations,
    radiusFromBisectorContact,
    splitWallRun,
} from '../cornerFit';
import { CHUCK_PX_CORNER_RUN, LOBE_MX_RUN, LOBE_PX_RUN } from './fixtures/pocketPass2';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

export const tests: Array<[string, () => void]> = [
    ['Kasa fit: an exact circle, the chuck corner (r 3.86, residuals 0.05), and collinear points as null', () => {
        const exact = [0, 60, 120, 200, 300].map((d) => ({ x: 10 + 4 * Math.cos((d * Math.PI) / 180), y: -3 + 4 * Math.sin((d * Math.PI) / 180) }));
        const fit = fitCircle(exact);
        assert.ok(fit && near(fit.radius, 4, 1e-3) && near(fit.center.x, 10, 1e-3) && near(fit.center.y, -3, 1e-3));
        assert.ok(fit!.maxResidual < 1e-3);
        const chuck = fitCircle(CHUCK_PX_CORNER_RUN.slice(5));
        assert.ok(chuck, 'four points fit');
        assert.ok(near(chuck!.radius, 3.865, 0.01), `r ${chuck!.radius}`);
        assert.ok(near(chuck!.center.x, -50.98, 0.02) && near(chuck!.center.y, -24.24, 0.02));
        assert.ok(chuck!.maxResidual < 0.06);
        assert.equal(fitCircle([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]), null, 'collinear');
        assert.equal(fitCircle([{ x: 0, y: 0 }, { x: 1, y: 1 }]), null, 'too few');
    }],

    ['a wall run with a corner splits into two straight runs and the arc between; the chuck corner is not the r 5 assumed', () => {
        // Along -X: four straight points, then the wall curves (+Y marches, so the march direction is -Y).
        const split = splitWallRun(CHUCK_PX_CORNER_RUN, 0.06, { x: 0, y: -1 });
        assert.deepEqual(split.lineA && split.lineA.indices, [0, 1, 2, 3], 'exactly the four straight points - the fifth is 0.1 off the line');
        assert.ok(split.corner, 'a corner was found');
        assert.equal(split.offLinePoints, 3);
        assert.deepEqual(split.corner!.indices, [3, 4, 5, 6, 7], 'the off-line points plus the tangent point of each straight run');
        assert.ok(split.corner!.arc, 'and fitted');
        // What the data says: the wall leaves the line gently (these five points fit an r ~8.9 arc within
        // 0.03 mm) before the tight r 3.86 of its last four points - one radius does not describe it.
        assert.ok(split.corner!.arc!.radius > 8 && split.corner!.arc!.radius < 10, `corner radius ${split.corner!.arc!.radius}`);
        assert.ok(split.corner!.arc!.maxResidual < 0.05);
        // A straight wall alone: one line, no corner.
        const straight = splitWallRun(CHUCK_PX_CORNER_RUN.slice(0, 4), 0.06, { x: 0, y: -1 });
        assert.equal(straight.corner, null);
        assert.equal(straight.offLinePoints, 0);
        assert.equal(straight.lineA!.indices.length, 4);
    }],

    ['plate (6) lobes: the run is straight wall - lobe - end wall, and the lobe is an IRREGULAR round: the arc fit reports it (rms ~0.5 mm)', () => {
        for (const [name, run, dir] of [['px', LOBE_PX_RUN, { x: 1, y: 0 }], ['mx', LOBE_MX_RUN, { x: -1, y: 0 }]] as [string, { x: number; y: number }[], { x: number; y: number }][]) {
            const split = splitWallRun(run, 0.15, dir);
            assert.ok(split.lineA && split.lineA.indices.length >= 7, `${name}: long wall run ${split.lineA && split.lineA.indices.length}`);
            assert.ok(split.lineB && split.lineB.indices.length >= 8, `${name}: end wall run ${split.lineB && split.lineB.indices.length}`);
            assert.ok(split.corner && split.offLinePoints >= 5, `${name}: lobe points ${split.offLinePoints}`);
            const arc = split.corner!.arc;
            assert.ok(arc, `${name}: an arc is fitted`);
            // The lobe is not a circle: a large residual is the honest answer, and it is REPORTED, never hidden.
            assert.ok(arc!.maxResidual > 0.5, `${name}: max residual ${arc!.maxResidual}`);
            assert.ok(arc!.rmsResidual > 0.3, `${name}: rms ${arc!.rmsResidual}`);
            // The radius a circle picks for an irregular round is whatever minimises the misfit (r ~3 for the +X
            // lobe, more for the -X one): a number to report WITH its residuals, never on its own.
            assert.ok(arc!.radius > 1 && arc!.radius < 12, `${name}: radius ${arc!.radius}`);
            // The long wall's normal faces the probe (against the march).
            assert.ok(split.lineA!.fit.normal.x * dir.x < -0.99);
        }
    }],

    ['internal corner geometry: apex, bisector into the free space, interior angle; the radius one bisector contact implies', () => {
        // Pocket corner: +X wall at x = 196.85 (free side -X), end wall at y = 145.9 (free side +Y).
        const g = cornerGeometry(
            { point: { x: 196.85, y: 160 }, normal: { x: -1, y: 0 } },
            { point: { x: 180, y: 145.9 }, normal: { x: 0, y: 1 } }
        );
        assert.ok(g);
        assert.deepEqual(g!.apex, { x: 196.85, y: 145.9 });
        assert.ok(near(g!.bisector.x, -0.707, 1e-3) && near(g!.bisector.y, 0.707, 1e-3), 'bisector into the pocket');
        assert.equal(g!.interiorAngleDeg, 90);
        // A tangent arc of tip-centre radius 5 in a 90 deg corner: centre 7.071 from the apex, mid-point 2.071.
        assert.equal(centreDistanceFor(5, 90), 7.071);
        assert.equal(bisectorReachFor(5, 90), 2.071);
        assert.equal(radiusFromBisectorContact(2.071, 90), 5);
        assert.equal(radiusFromBisectorContact(0, 90), 0, 'a contact at the apex is a sharp corner');
        // Parallel walls have no corner.
        assert.equal(cornerGeometry({ point: { x: 0, y: 0 }, normal: { x: 1, y: 0 } }, { point: { x: 5, y: 0 }, normal: { x: -1, y: 0 } }), null);
        // A 120 deg corner: shallower, the arc's mid-point sits closer to the apex for the same radius.
        assert.ok(bisectorReachFor(5, 120) < bisectorReachFor(5, 90));
    }],

    ['radial stations sweep from wall A\'s tangent point to wall B\'s through the apex direction', () => {
        const a = { point: { x: 196.85, y: 160 }, normal: { x: -1, y: 0 } };
        const b = { point: { x: 180, y: 145.9 }, normal: { x: 0, y: 1 } };
        const g = cornerGeometry(a, b)!;
        const st = radialStations(a, b, g.bisector, 5);
        assert.deepEqual(st.map((s) => s.azimuthDeg), [0, 337.5, 315, 292.5, 270], 'from +X (toward wall A) via -45 deg (the apex) to -Y (toward wall B)');
        assert.deepEqual(st[2].unit, { x: 0.707, y: -0.707 });
        assert.equal(radialStations(a, b, g.bisector, 1)[0].azimuthDeg, 315, 'a single station takes the apex direction');
    }],
];
