// The camera model: where the camera is, what it sees, and whether any of
// that can still be believed.
//
// Operator law (2026-09-19): the camera is NOT a rig constant. It can sit
// differently after every power cycle, be knocked, be re-aimed, or be a
// different camera entirely. So camera geometry is SESSION STATE, and nothing
// may turn a pixel into a machine coordinate - or a machine coordinate into a
// viewing pose - until a model has been solved and verified in this power
// cycle.
//
// What this replaces: a 2x2 pixel->mm matrix keyed by machine Y
// (calibration.ts), with no pose, no perspective, no field of view and no
// validity state. It could not answer "where must the toolhead go to see
// this?", which is the question that cost the 2026-09-19 session three
// approvals of trial and error, an assumed offset of "90-150 mm toward -X"
// taken from a skill, and a sign that turned out to be the other way.
//
// Pure: no server imports, unit-tested in tests/cameraModel.test.ts.

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

/** Row-major 3x3. Columns are the camera's axes expressed in machine axes. */
export type Matrix3 = [
    [number, number, number],
    [number, number, number],
    [number, number, number],
];

/**
 * Identity of the camera the model was solved for. A different device, a
 * different resolution, or a reference frame that no longer looks like the one
 * the model was solved against, all mean the model is about a different
 * camera than the one plugged in now.
 */
export interface CameraFingerprint {
    deviceId: string | null;
    width: number;
    height: number;
    /** Perceptual hash of a frame taken at the reference pose, when one was taken. */
    referenceFrameHash: string | null;
}

export interface CameraExtrinsics {
    /** Optical centre relative to the toolhead control point, in machine axes, mm. */
    offset: Vec3;
    /** Camera axes in machine axes. */
    rotation: Matrix3;
}

export interface CameraIntrinsics {
    fx: number;
    fy: number;
    cx: number;
    cy: number;
    /** Radial distortion, fitted only when the targets span enough of the frame; null otherwise. */
    k1: number | null;
}

export interface ModelResiduals {
    rmsPx: number;
    maxPx: number;
    /** The same error in millimetres on the plane the fit was scaled against. */
    rmsMm: number;
    nPoints: number;
    nPoses: number;
}

export type CameraModelState = 'verified' | 'unverified' | 'superseded';

export interface CameraModel {
    id: string;
    solvedAt: number;
    fingerprint: CameraFingerprint;
    /** The connection this was solved on: a machine reboot invalidates it, like the work origin. */
    boundTo: { connectionEpoch: number; machineIdentifier: string | null };
    extrinsics: CameraExtrinsics;
    intrinsics: CameraIntrinsics;
    /** Machine Z band the poses actually covered: outside it the model extrapolates. */
    validBandZ: [number, number];
    /**
     * Fraction of the frame width/height the fit genuinely constrains. Shrinks
     * when k1 could not be estimated, and pixels outside it are flagged rather
     * than silently converted.
     */
    centralRegion: number;
    residuals: ModelResiduals;
    solvedFrom: { surveyId: string | null; targets: string[]; poses: Vec3[] };
    verification: { at: number; pose: Vec3; residualPx: number; residualMm: number } | null;
    state: CameraModelState;
    /**
     * The machine the model was stored for (cameraModelStore.ts): the mounting
     * is one machine's rig, so the model serves that machine only. Models
     * stored before scoping are the A350's (machineCapability's legacy rule)
     * with legacyScope true.
     */
    machineIdentifier?: string;
    legacyScope?: boolean;
}

/** What the live session looks like, for judging a stored model against it. */
export interface CameraModelContext {
    fingerprint: CameraFingerprint | null;
    connectionEpoch: number;
    machineIdentifier: string | null;
    now: number;
}

export interface ModelJudgement {
    usable: boolean;
    state: CameraModelState;
    reasons: string[];
    /** What to do about it, named as a tool. */
    remedy: 'none' | 'verify_camera_model' | 'camera_bootstrap';
}

export function fingerprintMatches(a: CameraFingerprint, b: CameraFingerprint): boolean {
    if (a.width !== b.width || a.height !== b.height) {
        return false;
    }
    // A null device id on either side is "unknown", not "different": some
    // capture paths (an MJPEG URL) do not name a device at all.
    if (a.deviceId !== null && b.deviceId !== null && a.deviceId !== b.deviceId) {
        return false;
    }
    return true;
}

export function describeFingerprint(f: CameraFingerprint): string {
    return `${f.deviceId || 'unnamed device'} ${f.width}x${f.height}`;
}

export const NO_MODEL_REASON = 'No camera model has been solved on this machine. Nothing can turn a pixel into a '
    + 'machine coordinate, or a machine coordinate into a viewing pose, until one exists: run camera_bootstrap. '
    + 'Plain captures are unaffected - a frame finds things, it clears nothing.';

/**
 * Whether a stored model may still be used, and why not when it may not.
 *
 * Evidence, not age: a model is bound to the camera it was solved for and the
 * connection it was solved on. A machine reboot forgets the work origin for
 * the same reason it must forget this - nothing guarantees the camera came
 * back where it was.
 */
export function judgeCameraModel(model: CameraModel | null, ctx: CameraModelContext): ModelJudgement {
    if (!model) {
        return { usable: false, state: 'unverified', reasons: [NO_MODEL_REASON], remedy: 'camera_bootstrap' };
    }
    const reasons: string[] = [];
    if (model.state === 'superseded') {
        reasons.push('This model has been superseded by a later solve; it is kept only so "was the camera moved '
            + 'between these two jobs" stays answerable.');
        return { usable: false, state: 'superseded', reasons, remedy: 'camera_bootstrap' };
    }
    if (ctx.fingerprint && !fingerprintMatches(model.fingerprint, ctx.fingerprint)) {
        reasons.push(`The camera does not match the one this model was solved for (model: ${describeFingerprint(model.fingerprint)}; `
            + `live: ${describeFingerprint(ctx.fingerprint)}). A different camera, or the same one at a different `
            + 'resolution, has a different geometry entirely.');
        return { usable: false, state: 'unverified', reasons, remedy: 'camera_bootstrap' };
    }
    if (model.boundTo.connectionEpoch !== ctx.connectionEpoch) {
        reasons.push('The machine has reconnected since this model was solved. The camera may have been knocked, '
            + 're-aimed or replaced in between, and nothing about it survives a power cycle on trust.');
        return { usable: false, state: 'unverified', reasons, remedy: 'verify_camera_model' };
    }
    if (model.boundTo.machineIdentifier !== null && ctx.machineIdentifier !== null
        && model.boundTo.machineIdentifier !== ctx.machineIdentifier) {
        reasons.push(`Solved on ${model.boundTo.machineIdentifier}, connected to ${ctx.machineIdentifier}.`);
        return { usable: false, state: 'unverified', reasons, remedy: 'camera_bootstrap' };
    }
    if (model.state !== 'verified' || !model.verification) {
        reasons.push('This model has not passed a verification against a pose that was not in its own fit.');
        return { usable: false, state: 'unverified', reasons, remedy: 'verify_camera_model' };
    }
    return { usable: true, state: 'verified', reasons, remedy: 'none' };
}

/** A Z outside the band the poses covered is extrapolation, and says so. */
export function withinValidBand(model: CameraModel, z: number, toleranceMm: number = 1): boolean {
    return z >= model.validBandZ[0] - toleranceMm && z <= model.validBandZ[1] + toleranceMm;
}
