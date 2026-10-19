// The camera model's arithmetic: pixels to machine coordinates, machine
// coordinates to a viewing pose, and the field of view that makes an
// overlapping survey computable.
//
// Everything works in MACHINE coordinates, which is what makes one rigid
// transform enough on this machine. The gantry carries X and Z and the
// platform carries Y, so in world space the camera never moves in Y - but the
// machine frame is the tool relative to the work, and in that frame the camera
// centre is simply the toolhead position plus a fixed offset. That is also why
// the thing this replaces had to be keyed by machine Y: a 2x2 pixel/mm matrix
// is this model linearised at one Y and one Z.
//
// Conventions:
//   - `rotation` is row-major, and its COLUMNS are the camera's axes expressed
//     in machine axes. So p_machine = C + R . p_camera, and p_camera =
//     R^T . (M - C). The camera looks along its own +Z.
//   - the camera centre C = toolhead machine position + extrinsics.offset.
//   - a pinhole projection: u = cx + fx * x/z, v = cy + fy * y/z, with z > 0
//     in front of the camera.
//
// Pure: no server imports, unit-tested in tests/cameraGeometry.test.ts.
import { CameraModel, Matrix3, Vec3, withinValidBand } from './cameraModel';

export class CameraModelError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'CameraModelError';
    }
}

function add(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(v: Vec3, k: number): Vec3 {
    return { x: v.x * k, y: v.y * k, z: v.z * k };
}

/** R . v, with R row-major. */
function apply(r: Matrix3, v: Vec3): Vec3 {
    return {
        x: (r[0][0] * v.x) + (r[0][1] * v.y) + (r[0][2] * v.z),
        y: (r[1][0] * v.x) + (r[1][1] * v.y) + (r[1][2] * v.z),
        z: (r[2][0] * v.x) + (r[2][1] * v.y) + (r[2][2] * v.z),
    };
}

/** R^T . v - the inverse rotation, since R is orthonormal. */
function applyTranspose(r: Matrix3, v: Vec3): Vec3 {
    return {
        x: (r[0][0] * v.x) + (r[1][0] * v.y) + (r[2][0] * v.z),
        y: (r[0][1] * v.x) + (r[1][1] * v.y) + (r[2][1] * v.z),
        z: (r[0][2] * v.x) + (r[1][2] * v.y) + (r[2][2] * v.z),
    };
}

/** The camera's own optical axis, in machine axes: the third column of R. */
export function opticalAxis(model: CameraModel): Vec3 {
    const r = model.extrinsics.rotation;
    return { x: r[0][2], y: r[1][2], z: r[2][2] };
}

/** Where the camera's optical centre sits when the toolhead is at `toolhead`. */
export function cameraCentre(model: CameraModel, toolhead: Vec3): Vec3 {
    return add(toolhead, model.extrinsics.offset);
}

/**
 * Every conversion goes through here first. A model that has not been verified
 * in this power cycle does not convert anything: the caller is expected to
 * have judged it (judgeCameraModel) and this is the backstop.
 */
function assertUsable(model: CameraModel, what: string): void {
    if (model.state !== 'verified') {
        throw new CameraModelError(`Refusing to ${what}: the camera model is ${model.state}. `
            + 'Run verify_camera_model, or camera_bootstrap if it cannot be verified. Plain captures need no model.');
    }
}

/** Whether a pixel is inside the part of the frame the fit actually constrains. */
export function inCentralRegion(model: CameraModel, pixel: Pixel): boolean {
    const halfW = (model.fingerprint.width * model.centralRegion) / 2;
    const halfH = (model.fingerprint.height * model.centralRegion) / 2;
    const midU = model.fingerprint.width / 2;
    const midV = model.fingerprint.height / 2;
    return Math.abs(pixel.u - midU) <= halfW && Math.abs(pixel.v - midV) <= halfH;
}

/** pixelToMachine without the central-region gate - corners are the point here. */
function rayToPlane(model: CameraModel, toolhead: Vec3, pixel: Pixel, planeZ: number): Vec3 {
    const { fx, fy, cx, cy } = model.intrinsics;
    const dir = apply(model.extrinsics.rotation, { x: (pixel.u - cx) / fx, y: (pixel.v - cy) / fy, z: 1 });
    const centre = cameraCentre(model, toolhead);
    if (Math.abs(dir.z) < 1e-9) {
        throw new CameraModelError('A frame corner\'s ray runs parallel to the Z plane: this camera cannot frame that plane.');
    }
    const t = (planeZ - centre.z) / dir.z;
    if (t <= 0) {
        throw new CameraModelError(`The plane Z ${planeZ} lies behind the camera.`);
    }
    return add(centre, scale(dir, t));
}

export interface Pixel {
    u: number;
    v: number;
}

/** Where a machine point lands in the frame, with the toolhead at `toolhead`. */
export function machineToPixel(model: CameraModel, toolhead: Vec3, point: Vec3): Pixel & { behind: boolean; inCentralRegion: boolean } {
    assertUsable(model, 'project a machine point into the frame');
    const cam = applyTranspose(model.extrinsics.rotation, sub(point, cameraCentre(model, toolhead)));
    if (Math.abs(cam.z) < 1e-9) {
        throw new CameraModelError('The point lies in the camera\'s own plane; it has no projection.');
    }
    const { fx, fy, cx, cy } = model.intrinsics;
    const u = cx + ((fx * cam.x) / cam.z);
    const v = cy + ((fy * cam.y) / cam.z);
    return { u, v, behind: cam.z <= 0, inCentralRegion: inCentralRegion(model, { u, v }) };
}

/**
 * The ray through a pixel, intersected with a stated Z plane.
 *
 * `planeZ` is an ARGUMENT, never a guess. A single frame cannot say how far
 * away what it sees is, and assuming one plane for a feature on another is
 * what made a bracket-derived calibration read about 4x wrong on the board.
 */
export function pixelToMachine(model: CameraModel, toolhead: Vec3, pixel: Pixel, planeZ: number): Vec3 & { extrapolated: boolean } {
    assertUsable(model, 'turn a pixel into a machine coordinate');
    if (!inCentralRegion(model, pixel)) {
        throw new CameraModelError(`Pixel (${pixel.u.toFixed(1)}, ${pixel.v.toFixed(1)}) is outside the region this model `
            + `constrains (the central ${Math.round(model.centralRegion * 100)}% of the frame`
            + `${model.intrinsics.k1 === null ? ', widened only by fitting lens distortion, which these targets did not support' : ''}). `
            + 'Re-frame so the feature is nearer the centre rather than trusting the edge.');
    }
    const { fx, fy, cx, cy } = model.intrinsics;
    const dirCam: Vec3 = { x: (pixel.u - cx) / fx, y: (pixel.v - cy) / fy, z: 1 };
    const dir = apply(model.extrinsics.rotation, dirCam);
    const centre = cameraCentre(model, toolhead);
    if (Math.abs(dir.z) < 1e-9) {
        throw new CameraModelError('That pixel\'s ray runs parallel to the Z plane; it never meets it.');
    }
    const t = (planeZ - centre.z) / dir.z;
    if (t <= 0) {
        throw new CameraModelError(`The plane Z ${planeZ} lies behind the camera along that ray.`);
    }
    const point = add(centre, scale(dir, t));
    return { ...point, extrapolated: !withinValidBand(model, toolhead.z) };
}


export interface ViewPose {
    /** Where the TOOLHEAD goes. */
    toolhead: Vec3;
    /** Distance from the camera to the point, along the optical axis. */
    standoffMm: number;
    /** True when the toolhead Z asked for is outside the band the model was solved over. */
    extrapolated: boolean;
}

/**
 * The toolhead position that puts a machine point in the centre of the frame,
 * at a given toolhead Z.
 *
 * This is the question the 2026-09-19 session could not ask. It guessed the
 * pose from a remembered "the camera looks -X, 90-150 mm", moved 30 mm the
 * wrong way to find out, and spent three operator approvals establishing a
 * sign.
 */
export function viewPose(model: CameraModel, point: Vec3, toolheadZ: number): ViewPose {
    assertUsable(model, 'plan a viewing pose');
    const axis = opticalAxis(model);
    if (Math.abs(axis.z) < 1e-6) {
        throw new CameraModelError('This camera looks along the bed, not across it: no toolhead Z centres a point on it.');
    }
    const offset = model.extrinsics.offset;
    const t = (point.z - toolheadZ - offset.z) / axis.z;
    if (t <= 0) {
        throw new CameraModelError(`At toolhead Z ${toolheadZ} that point is behind the camera. `
            + 'Choose a toolhead Z above it.');
    }
    return {
        toolhead: {
            x: point.x - (axis.x * t) - offset.x,
            y: point.y - (axis.y * t) - offset.y,
            z: toolheadZ,
        },
        standoffMm: t,
        extrapolated: !withinValidBand(model, toolheadZ),
    };
}

export interface FieldOfView {
    widthMm: number;
    heightMm: number;
    mmPerPixel: number;
    extrapolated: boolean;
}

/**
 * How much of a stated Z plane one frame covers, with the toolhead at
 * `toolhead`. This is what makes an overlapping survey computable: a pitch is
 * only "seamless" relative to a field of view, and until now nothing knew it.
 *
 * Measured across the frame's own corners, so a tilted camera reports the
 * footprint it really has rather than a figure from the optical axis alone.
 */
export function fovAt(model: CameraModel, toolhead: Vec3, planeZ: number): FieldOfView {
    assertUsable(model, 'compute a field of view');
    const { width, height } = model.fingerprint;
    const corners: Pixel[] = [
        { u: 0, v: 0 },
        { u: width, v: 0 },
        { u: 0, v: height },
        { u: width, v: height },
    ];
    const points = corners.map((pixel) => rayToPlane(model, toolhead, pixel, planeZ));
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const widthMm = Math.max(...xs) - Math.min(...xs);
    const heightMm = Math.max(...ys) - Math.min(...ys);
    return {
        widthMm,
        heightMm,
        mmPerPixel: widthMm / width,
        extrapolated: !withinValidBand(model, toolhead.z),
    };
}

/**
 * The legacy 2x2: the machine XY move (mm) that cancels a pixel delta, at this
 * pose and depth plane. Regenerated on demand from the model so visual_servo
 * and every stored calibration keep working unchanged - the matrix was always
 * this model linearised at one point, it just had no model to be derived from.
 */
export function jacobianAt(model: CameraModel, toolhead: Vec3, planeZ: number): [[number, number], [number, number]] {
    assertUsable(model, 'derive a pixel-to-machine matrix');
    const centre: Pixel = { u: model.intrinsics.cx, v: model.intrinsics.cy };
    const step = 10; // pixels: big enough to be numerically clean, small enough to stay local
    const at = (u: number, v: number) => rayToPlane(model, toolhead, { u, v }, planeZ);
    const base = at(centre.u, centre.v);
    const du = at(centre.u + step, centre.v);
    const dv = at(centre.u, centre.v + step);
    // A feature at +du pixels is at +(du - base) mm, so cancelling it means
    // moving the camera the same way: the sign is the forward map's.
    return [
        [(du.x - base.x) / step, (dv.x - base.x) / step],
        [(du.y - base.y) / step, (dv.y - base.y) / step],
    ];
}
