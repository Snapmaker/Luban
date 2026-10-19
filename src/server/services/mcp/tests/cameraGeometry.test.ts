import { strict as assert } from 'assert';

import { CameraModel, Matrix3 } from '../cameraModel';
import {
    CameraModelError,
    cameraCentre,
    fovAt,
    jacobianAt,
    machineToPixel,
    opticalAxis,
    pixelToMachine,
    viewPose,
} from '../cameraGeometry';

// A camera on the toolhead looking straight down: its +Z is machine -Z, its
// image x is machine +X, its image y is machine -Y. Columns of R are the
// camera's axes in machine axes.
const DOWN: Matrix3 = [
    [1, 0, 0],
    [0, -1, 0],
    [0, 0, -1],
];

// Tilted 20 degrees about machine Y, so the view leans toward -X: the case
// the old flat pixels-per-mm number could not express at all.
const TILT = (20 * Math.PI) / 180;
// Ry(TILT) . DOWN, so its columns stay an orthonormal camera frame.
const TILTED: Matrix3 = [
    [Math.cos(TILT), 0, -Math.sin(TILT)],
    [0, -1, 0],
    [-Math.sin(TILT), 0, -Math.cos(TILT)],
];

function model(over: Partial<CameraModel> = {}): CameraModel {
    return {
        id: 'cam1',
        solvedAt: 0,
        fingerprint: { deviceId: 'cam', width: 1280, height: 720, referenceFrameHash: null },
        boundTo: { connectionEpoch: 1, machineIdentifier: 'Snapmaker 2.0 A350' },
        extrinsics: { offset: { x: -110, y: 0, z: -40 }, rotation: DOWN },
        intrinsics: { fx: 900, fy: 900, cx: 640, cy: 360, k1: null },
        validBandZ: [320, 328],
        centralRegion: 1,
        residuals: { rmsPx: 1, maxPx: 2, rmsMm: 0.3, nPoints: 24, nPoses: 8 },
        solvedFrom: { surveyId: null, targets: [], poses: [] },
        verification: { at: 1, pose: { x: 0, y: 0, z: 328 }, residualPx: 1, residualMm: 0.3 },
        state: 'verified',
        ...over,
    };
}

const TOOLHEAD = { x: 200, y: 150, z: 328 };

export const tests: Array<[string, () => void]> = [
    // D3: the arithmetic the 2026-09-19 session did not have.
    ['a pixel and a machine point are inverses of each other on a stated plane', () => {
        const m = model();
        const point = { x: 120, y: 175, z: 60 };
        const px = machineToPixel(m, TOOLHEAD, point);
        assert.equal(px.behind, false);
        const back = pixelToMachine(m, TOOLHEAD, px, 60);
        assert.ok(Math.abs(back.x - point.x) < 1e-6, `${back.x}`);
        assert.ok(Math.abs(back.y - point.y) < 1e-6, `${back.y}`);
        assert.equal(back.z, 60);
    }],

    ['the same pixel means different machine points on different planes - hence the argument', () => {
        const m = model();
        const px = { u: 900, v: 200 };
        const low = pixelToMachine(m, TOOLHEAD, px, 0);
        const high = pixelToMachine(m, TOOLHEAD, px, 100);
        assert.ok(Math.abs(low.x - high.x) > 10, 'parallax: a plane is never guessed');
    }],

    ['a viewing pose puts the point dead centre - whatever direction the camera looks', () => {
        for (const rotation of [DOWN, TILTED]) {
            const m = model({ extrinsics: { offset: { x: -110, y: 0, z: -40 }, rotation } });
            const target = { x: 170, y: 90, z: 55 };
            const pose = viewPose(m, target, 328);
            const px = machineToPixel(m, pose.toolhead, target);
            assert.ok(Math.abs(px.u - m.intrinsics.cx) < 1e-6, `u ${px.u}`);
            assert.ok(Math.abs(px.v - m.intrinsics.cy) < 1e-6, `v ${px.v}`);
            assert.ok(pose.standoffMm > 0);
        }
    }],

    ['the pose accounts for the offset, and the sign is the model\'s, not a memory', () => {
        // This camera sits 110 mm toward -X of the toolhead, so the toolhead
        // goes to +X of what it looks at. The 2026-09-19 session assumed the
        // opposite and burned three approvals discovering it.
        const m = model();
        const pose = viewPose(m, { x: 170, y: 90, z: 55 }, 328);
        assert.ok(Math.abs(pose.toolhead.x - 280) < 1e-6, `${pose.toolhead.x}`);
        assert.ok(Math.abs(pose.toolhead.y - 90) < 1e-6, `${pose.toolhead.y}`);
        assert.equal(pose.toolhead.z, 328);

        const mirrored = model({ extrinsics: { offset: { x: 110, y: 0, z: -40 }, rotation: DOWN } });
        assert.ok(Math.abs(viewPose(mirrored, { x: 170, y: 90, z: 55 }, 328).toolhead.x - 60) < 1e-6);
    }],

    ['the field of view is a real footprint, and it is what makes an overlap computable', () => {
        const m = model();
        const fov = fovAt(m, TOOLHEAD, 60);
        // standoff 328 - 40 - 60 = 228 mm; 1280 px / 900 px focal -> 324 mm.
        assert.ok(Math.abs(fov.widthMm - ((1280 / 900) * 228)) < 1e-6, `${fov.widthMm}`);
        assert.ok(Math.abs(fov.heightMm - ((720 / 900) * 228)) < 1e-6, `${fov.heightMm}`);
        assert.ok(Math.abs(fov.mmPerPixel - (228 / 900)) < 1e-9);
        // A 30% overlap pitch falls straight out of it.
        assert.ok(Math.abs((fov.widthMm * 0.7) - 227) < 1, `${fov.widthMm * 0.7}`);
    }],

    ['a tilted camera reports the footprint it really has', () => {
        const m = model({ extrinsics: { offset: { x: -110, y: 0, z: -40 }, rotation: TILTED } });
        const straight = fovAt(model(), TOOLHEAD, 60);
        const tilted = fovAt(m, TOOLHEAD, 60);
        assert.ok(tilted.widthMm > straight.widthMm, 'a leaning view covers more ground, not the same');
    }],

    ['a Z outside the band the poses covered is flagged as extrapolation, not refused', () => {
        const m = model();
        const high = { x: 200, y: 150, z: 300 };
        assert.equal(fovAt(m, high, 60).extrapolated, true);
        assert.equal(fovAt(m, TOOLHEAD, 60).extrapolated, false);
        assert.equal(viewPose(m, { x: 170, y: 90, z: 55 }, 300).extrapolated, true);
    }],

    ['nothing converts through an unverified model', () => {
        const m = model({ state: 'unverified' });
        assert.throws(() => machineToPixel(m, TOOLHEAD, { x: 1, y: 1, z: 1 }), CameraModelError);
        assert.throws(() => pixelToMachine(m, TOOLHEAD, { u: 640, v: 360 }, 60), CameraModelError);
        assert.throws(() => viewPose(m, { x: 1, y: 1, z: 1 }, 328), CameraModelError);
        assert.throws(() => fovAt(m, TOOLHEAD, 60), CameraModelError);
        assert.throws(() => jacobianAt(m, TOOLHEAD, 60), CameraModelError);
        assert.throws(() => machineToPixel(m, TOOLHEAD, { x: 1, y: 1, z: 1 }), /verify_camera_model/);
    }],

    ['a pixel outside the region the fit constrains is refused, not silently converted', () => {
        const m = model({ centralRegion: 0.5 });
        assert.doesNotThrow(() => pixelToMachine(m, TOOLHEAD, { u: 640, v: 360 }, 60));
        assert.throws(() => pixelToMachine(m, TOOLHEAD, { u: 40, v: 20 }, 60), /outside the region this model constrains/);
        assert.throws(() => pixelToMachine(m, TOOLHEAD, { u: 40, v: 20 }, 60), /lens distortion/,
            'and says why the region is small');
    }],

    ['a point behind the camera is reported, never projected as if it were in front', () => {
        const m = model();
        const above = machineToPixel(m, TOOLHEAD, { x: 200, y: 150, z: 400 });
        assert.equal(above.behind, true);
        assert.throws(() => viewPose(m, { x: 170, y: 90, z: 400 }, 328), /behind the camera/);
    }],

    ['the legacy 2x2 comes back out of the model', () => {
        const m = model();
        const j = jacobianAt(m, TOOLHEAD, 60);
        const mmPerPx = fovAt(m, TOOLHEAD, 60).mmPerPixel;
        // Looking down with image x along +X and image y along -Y.
        assert.ok(Math.abs(j[0][0] - mmPerPx) < 1e-9, `${j[0][0]} vs ${mmPerPx}`);
        assert.ok(Math.abs(j[0][1]) < 1e-9);
        assert.ok(Math.abs(j[1][0]) < 1e-9);
        assert.ok(Math.abs(j[1][1] + mmPerPx) < 1e-9, 'image y runs against machine Y on this rig');
    }],

    ['the camera centre and optical axis are read straight off the model', () => {
        const m = model();
        assert.deepEqual(cameraCentre(m, TOOLHEAD), { x: 90, y: 150, z: 288 });
        assert.deepEqual(opticalAxis(m), { x: 0, y: 0, z: -1 });
    }],
];
