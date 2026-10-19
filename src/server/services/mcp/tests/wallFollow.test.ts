import { strict as assert } from 'assert';

import { alongUnit, fitWallLine, wallFollowStations } from '../wallFollow';

// The pocket's +X wall from pass 2 (job f84f2a263333): +X marches at Y 155..161 stopped at X 196.85 (one 196.95).
const PX_WALL = [
    { x: 196.95, y: 155 }, { x: 196.85, y: 156 }, { x: 196.85, y: 157 }, { x: 196.85, y: 158 },
    { x: 196.85, y: 159 }, { x: 196.85, y: 160 }, { x: 196.85, y: 161 },
];

export const tests: Array<[string, () => void]> = [
    ['the step-along direction defaults to the march direction turned +90 degrees; a given one is made perpendicular', () => {
        assert.deepEqual(alongUnit({ x: 1, y: 0 }, null), { x: 0, y: 1 }, 'marching +X into a wall, step +Y along it');
        assert.deepEqual(alongUnit({ x: 0, y: -1 }, null), { x: 1, y: 0 });
        assert.deepEqual(alongUnit({ x: 1, y: 0 }, { x: 0, y: -1 }), { x: 0, y: -1 }, 'the caller picks the other way');
        // A skewed along keeps only its component perpendicular to the march.
        assert.deepEqual(alongUnit({ x: 1, y: 0 }, { x: 3, y: -4 }), { x: 0, y: -1 });
        assert.equal(alongUnit({ x: 1, y: 0 }, { x: 5, y: 0 }), null, 'parallel to the march: no wall direction in it');
    }],

    ['stations lie on the start line step_mm apart along the wall', () => {
        const st = wallFollowStations({ x: 190, y: 155 }, { x: 0, y: 1 }, 2, 4);
        assert.deepEqual(st.map((s) => s.start), [{ x: 190, y: 155 }, { x: 190, y: 157 }, { x: 190, y: 159 }, { x: 190, y: 161 }]);
        assert.deepEqual(st.map((s) => s.label), ['w1', 'w2', 'w3', 'w4']);
        assert.equal(wallFollowStations({ x: 0, y: 0 }, { x: 1, y: 0 }, 5, 1).length, 1);
    }],

    ['the line fit of a straight wall: direction along the step, normal toward the probe, residuals show the one odd point', () => {
        const fit = fitWallLine(PX_WALL, { x: 1, y: 0 }, { x: 0, y: 1 });
        assert.ok(fit);
        assert.equal(fit!.points, 7);
        assert.ok(Math.abs(fit!.direction.y) > 0.999 && fit!.direction.y > 0, 'along +Y');
        assert.ok(fit!.normal.x < -0.999, 'normal points -X, against the +X march (out of the material)');
        // The one 196.95 contact at the near end yaws the fit by ~0.5 deg - a real reading of the data.
        assert.ok(Math.abs(fit!.angleDeg) > 89, `angle ${fit!.angleDeg}`);
        assert.ok(fit!.yawFromAlongDeg !== null && fit!.yawFromAlongDeg < 1, `yaw ${fit!.yawFromAlongDeg}`);
        // 196.95 sits further along the march (into the material) than the others: the largest, NEGATIVE
        // residual (-0.054 once the fit has absorbed part of it as yaw).
        assert.ok(fit!.residualsMm[0] < -0.04, `first residual ${fit!.residualsMm[0]}`);
        assert.equal(fit!.maxAbsMm, Math.abs(fit!.residualsMm[0]));
        assert.ok(fit!.rmsMm < 0.05);
        assert.equal(fitWallLine([PX_WALL[0]], { x: 1, y: 0 }), null, 'one point is no line');
    }],

    ['a yawed wall and a wall curving away read as yaw and as a residual trend', () => {
        // The -X face of the piece: X 137.25 at Y 245, 137.85 at Y 165 (yaw ~0.43 deg).
        const yawed = fitWallLine([{ x: 137.85, y: 165 }, { x: 137.55, y: 205 }, { x: 137.25, y: 245 }], { x: -1, y: 0 }, { x: 0, y: 1 });
        assert.ok(yawed && Math.abs(yawed.yawFromAlongDeg! - 0.43) < 0.02, `yaw ${yawed && yawed.yawFromAlongDeg}`);
        assert.ok(yawed!.normal.x > 0.999, 'normal +X against a -X march');
        // The pass-2 chuck corner: the long wall then four points bending toward the probe.
        const corner = [
            { x: -46.3, y: -28.35 }, { x: -47.3, y: -28.35 }, { x: -48.3, y: -28.35 }, { x: -49.3, y: -28.35 },
            { x: -50.3, y: -28.25 }, { x: -51.3, y: -28.12 }, { x: -52.3, y: -27.82 }, { x: -53.3, y: -27.38 }, { x: -54.3, y: -26.22 },
        ];
        const fit = fitWallLine(corner, { x: 0, y: -1 }, { x: -1, y: 0 });
        assert.ok(fit);
        // A straight line through a wall that curves at one end yaws (12 deg here) and the residuals BOW:
        // both ends toward the probe (positive), the middle away (negative) - the signature of a corner
        // inside the run, and the reason a wall fit is never trusted without its residuals.
        const res = fit!.residualsMm;
        assert.ok(res[res.length - 1] > 0.7, `corner point residual ${res[res.length - 1]}`);
        assert.ok(res[0] > 0.3 && res[4] < -0.2 && res[5] < -0.2, `bow ${JSON.stringify(res)}`);
        assert.ok(fit!.maxAbsMm > 0.7);
        assert.ok(fit!.yawFromAlongDeg! > 10, `yaw ${fit!.yawFromAlongDeg}`);
        // The straight run alone fits flat: residuals within a few hundredths, no yaw to speak of.
        const straight = fitWallLine(corner.slice(0, 4), { x: 0, y: -1 }, { x: -1, y: 0 });
        assert.ok(straight && straight.maxAbsMm < 0.01 && straight.yawFromAlongDeg! < 0.1);
    }],
];
