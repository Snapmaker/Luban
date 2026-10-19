import { strict as assert } from 'assert';

import {
    CameraFingerprint,
    CameraModel,
    CameraModelContext,
    NO_MODEL_REASON,
    fingerprintMatches,
    judgeCameraModel,
    withinValidBand,
} from '../cameraModel';

const FINGERPRINT: CameraFingerprint = {
    deviceId: 'usb-Sonix_Technology_Co.__Ltd._USB_2.0_Camera',
    width: 1280,
    height: 720,
    referenceFrameHash: 'abc123',
};

function model(over: Partial<CameraModel> = {}): CameraModel {
    return {
        id: 'aa11bb22',
        solvedAt: 1_000,
        fingerprint: { ...FINGERPRINT },
        boundTo: { connectionEpoch: 7, machineIdentifier: 'Snapmaker 2.0 A350' },
        extrinsics: {
            offset: { x: -110, y: 0, z: -40 },
            rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        },
        intrinsics: { fx: 900, fy: 900, cx: 640, cy: 360, k1: null },
        validBandZ: [320, 328],
        centralRegion: 0.6,
        residuals: { rmsPx: 1.2, maxPx: 3.1, rmsMm: 0.4, nPoints: 24, nPoses: 8 },
        solvedFrom: { surveyId: 'f00d', targets: ['tool-setter', 'rotary-axis'], poses: [] },
        verification: { at: 2_000, pose: { x: 200, y: 150, z: 328 }, residualPx: 1.8, residualMm: 0.6 },
        state: 'verified',
        ...over,
    };
}

function ctx(over: Partial<CameraModelContext> = {}): CameraModelContext {
    return {
        fingerprint: { ...FINGERPRINT },
        connectionEpoch: 7,
        machineIdentifier: 'Snapmaker 2.0 A350',
        now: 3_000,
        ...over,
    };
}

export const tests: Array<[string, () => void]> = [
    // D2: the camera is session state. Every one of these is a way it stops
    // being the camera the model was solved for.
    ['a verified model on the same camera and the same connection is usable', () => {
        const j = judgeCameraModel(model(), ctx());
        assert.equal(j.usable, true);
        assert.equal(j.state, 'verified');
        assert.equal(j.remedy, 'none');
    }],

    ['no model at all names the bootstrap, and says plain captures still work', () => {
        const j = judgeCameraModel(null, ctx());
        assert.equal(j.usable, false);
        assert.equal(j.remedy, 'camera_bootstrap');
        assert.equal(j.reasons[0], NO_MODEL_REASON);
        assert.ok(/Plain captures are unaffected/.test(j.reasons[0]));
    }],

    ['a reconnect makes it unverified - nothing about a camera survives a power cycle on trust', () => {
        const j = judgeCameraModel(model(), ctx({ connectionEpoch: 8 }));
        assert.equal(j.usable, false);
        assert.equal(j.state, 'unverified');
        assert.equal(j.remedy, 'verify_camera_model', 'a check is enough - the camera may well be where it was');
        assert.ok(/knocked, re-aimed or replaced/.test(j.reasons.join(' ')));
    }],

    ['a different camera, or the same one at another resolution, needs a full bootstrap', () => {
        const other = judgeCameraModel(model(), ctx({ fingerprint: { ...FINGERPRINT, deviceId: 'usb-Generic_Webcam' } }));
        assert.equal(other.usable, false);
        assert.equal(other.remedy, 'camera_bootstrap');

        const resized = judgeCameraModel(model(), ctx({ fingerprint: { ...FINGERPRINT, width: 640, height: 480 } }));
        assert.equal(resized.usable, false);
        assert.equal(resized.remedy, 'camera_bootstrap');
    }],

    ['an unnamed device is unknown, not different', () => {
        assert.equal(fingerprintMatches(FINGERPRINT, { ...FINGERPRINT, deviceId: null }), true,
            'an MJPEG URL names no device; that is not evidence of a different camera');
        assert.equal(fingerprintMatches(FINGERPRINT, { ...FINGERPRINT, deviceId: 'other' }), false);
        assert.equal(fingerprintMatches(FINGERPRINT, { ...FINGERPRINT, height: 1080 }), false);
        assert.equal(fingerprintMatches(FINGERPRINT, { ...FINGERPRINT, referenceFrameHash: 'zzz' }), true,
            'the hash is evidence for a verification pass, not an identity test on its own');
    }],

    ['a model that never passed verification is not usable, however good its own residuals', () => {
        const j = judgeCameraModel(model({ state: 'unverified', verification: null }), ctx());
        assert.equal(j.usable, false);
        assert.equal(j.remedy, 'verify_camera_model');
        assert.ok(/not in its own fit/.test(j.reasons.join(' ')),
            'agreeing with the data it was fitted to demonstrates nothing');
    }],

    ['a superseded model is kept but never used', () => {
        const j = judgeCameraModel(model({ state: 'superseded' }), ctx());
        assert.equal(j.usable, false);
        assert.equal(j.state, 'superseded');
        assert.ok(/was the camera moved/.test(j.reasons.join(' ')), 'says why it is kept at all');
    }],

    ['a model solved on another machine is not this machine\'s model', () => {
        const j = judgeCameraModel(model(), ctx({ machineIdentifier: 'Snapmaker 2.0 A250' }));
        assert.equal(j.usable, false);
        assert.equal(j.remedy, 'camera_bootstrap');
    }],

    ['the valid Z band is the band the poses covered, with a millimetre of slack', () => {
        const m = model();
        assert.equal(withinValidBand(m, 328), true);
        assert.equal(withinValidBand(m, 320), true);
        assert.equal(withinValidBand(m, 324), true);
        assert.equal(withinValidBand(m, 318.5), false, 'below the band is extrapolation');
        assert.equal(withinValidBand(m, 260), false);
    }],
];
