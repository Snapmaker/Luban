#!/usr/bin/env python3
"""Solve a camera model from a Luban MCP bootstrap frame set.

The camera is not a rig constant.  It can sit differently after every power
cycle, be knocked, be re-aimed, or be a different camera entirely, so its
geometry is solved fresh rather than remembered.  `camera_bootstrap` on the
MCP surface captures the frames and writes an `index.json` that carries, per
frame, the toolhead machine position it was taken at, plus the machine
coordinates of every target whose position the machine already knows (the tool
setter's centre and plate top; the rotary axis line and its named ends).

This script turns that into a model:

    camera_bootstrap.py <directory>                  # detect, solve, print
    camera_bootstrap.py <directory> --marks marks.json
    camera_bootstrap.py --self-test                  # no machine, no frames

`--marks` is a plain mapping of frame file name -> target name -> [u, v],
for when automatic detection fails or you would rather point at the pixel
yourself.  Detection and hand marks may be mixed; hand marks win.

The unknowns are the camera's offset from the toolhead (3), its orientation
(3), and a pinhole's fx, fy, cx, cy (4).  Every observation of a known 3D
point in a frame gives two equations, so a dozen observations over poses that
differ in X, Y and Z is comfortably over-determined - which is the point: a
fit that only agrees with one view has demonstrated nothing.

Output is the JSON `set_camera_model` takes, plus the residuals you must
report with it.  Store it, then prove it with `verify_camera_model` against a
pose that was NOT in this set.

Requires numpy and scipy.  OpenCV is used for detection only; without it,
pass --marks.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys

import numpy as np

try:
    from scipy.optimize import least_squares
except ImportError:  # pragma: no cover - the message is the point
    print('scipy is required: pip install scipy', file=sys.stderr)
    raise

try:
    import cv2
except ImportError:
    cv2 = None


# --------------------------------------------------------------------------
# The model, as arithmetic
# --------------------------------------------------------------------------

def rotation_from_rodrigues(r):
    """3x3 rotation from a 3-vector (axis * angle).  Columns are the camera's
    axes in machine axes, matching cameraGeometry.ts."""
    theta = np.linalg.norm(r)
    if theta < 1e-12:
        return np.eye(3)
    k = r / theta
    kx = np.array([[0.0, -k[2], k[1]], [k[2], 0.0, -k[0]], [-k[1], k[0], 0.0]])
    return np.eye(3) + (math.sin(theta) * kx) + ((1.0 - math.cos(theta)) * (kx @ kx))


def rodrigues_from_rotation(m):
    """Inverse of the above.

    The half-turn case is not an edge case here: a camera looking straight
    down at a bed IS a half-turn from the identity (trace -1), so the naive
    axis/2sin(theta) form divides by zero on the most ordinary mounting there
    is. Handled explicitly.
    """
    cos = max(-1.0, min(1.0, (np.trace(m) - 1.0) / 2.0))
    theta = math.acos(cos)
    if theta < 1e-9:
        return np.zeros(3)
    if math.pi - theta < 1e-6:
        # R + I = 2 k k^T at a half turn: read the axis off the diagonal and
        # take the signs from whichever off-diagonal pair is largest.
        diagonal = np.clip((np.diag(m) + 1.0) / 2.0, 0.0, None)
        k = np.sqrt(diagonal)
        largest = int(np.argmax(k))
        if k[largest] > 1e-9:
            if largest == 0:
                k[1] = (m[0, 1] + m[1, 0]) / (4.0 * k[0])
                k[2] = (m[0, 2] + m[2, 0]) / (4.0 * k[0])
            elif largest == 1:
                k[0] = (m[0, 1] + m[1, 0]) / (4.0 * k[1])
                k[2] = (m[1, 2] + m[2, 1]) / (4.0 * k[1])
            else:
                k[0] = (m[0, 2] + m[2, 0]) / (4.0 * k[2])
                k[1] = (m[1, 2] + m[2, 1]) / (4.0 * k[2])
        norm = np.linalg.norm(k)
        return theta * (k / norm if norm > 1e-12 else np.array([1.0, 0.0, 0.0]))
    axis = np.array([m[2, 1] - m[1, 2], m[0, 2] - m[2, 0], m[1, 0] - m[0, 1]])
    return (theta / (2.0 * math.sin(theta))) * axis


def project(params, toolhead, point):
    """Where `point` (machine mm) lands in the frame with the toolhead there."""
    offset = params[0:3]
    rot = rotation_from_rodrigues(params[3:6])
    fx, fy, cx, cy = params[6:10]
    centre = toolhead + offset
    cam = rot.T @ (point - centre)
    if cam[2] <= 1e-6:
        # Behind the camera: push the residual out rather than dividing by ~0.
        return np.array([1e6, 1e6])
    return np.array([cx + (fx * cam[0] / cam[2]), cy + (fy * cam[1] / cam[2])])


def residuals(params, observations):
    out = []
    for obs in observations:
        predicted = project(params, obs['toolhead'], obs['point'])
        out.extend(predicted - obs['pixel'])
    return np.array(out)


# --------------------------------------------------------------------------
# Solving
# --------------------------------------------------------------------------

def initial_guess(observations, width, height):
    """A deliberately crude start: the camera somewhere near the toolhead,
    looking down, with a focal length of about the frame width.

    The one thing NOT guessed is the direction the camera looks - the search
    stage measured that, and its sign is the whole reason that stage exists.
    """
    # Point the optical axis along machine -Z (looking at the bed).
    down = np.array([[1.0, 0.0, 0.0], [0.0, -1.0, 0.0], [0.0, 0.0, -1.0]])
    offset = np.zeros(3)
    if observations:
        # The targets seen, minus the poses they were seen from, is roughly
        # where the camera must be looking - including its sign.
        deltas = [obs['point'][:2] - obs['toolhead'][:2] for obs in observations]
        offset[0:2] = np.mean(deltas, axis=0)
        offset[2] = -40.0
    return np.concatenate([offset, rodrigues_from_rotation(down), [width, width, width / 2.0, height / 2.0]])


def solve(observations, width, height):
    if len(observations) < 6:
        raise SystemExit(
            f'{len(observations)} observations is not a solve: 10 unknowns need at least 5 sightings, and a fit '
            'that agrees with one view has demonstrated nothing. Capture more poses, or mark more targets.')
    poses = {tuple(np.round(obs['toolhead'], 3)) for obs in observations}
    if len(poses) < 3:
        raise SystemExit(
            f'Only {len(poses)} distinct poses. The offset and the focal length trade off against each other from a '
            'single standoff - the Z sweep exists precisely to separate them. Include poses at different heights.')

    guess = initial_guess(observations, width, height)
    fit = least_squares(residuals, guess, args=(observations,), method='lm', max_nfev=20000)
    errors = residuals(fit.x, observations).reshape(-1, 2)
    per_point = np.linalg.norm(errors, axis=1)
    return fit.x, per_point, poses


def model_json(params, per_point, poses, observations, width, height, band, survey_id, targets):
    offset = params[0:3]
    rot = rotation_from_rodrigues(params[3:6])
    fx, fy, cx, cy = params[6:10]

    # Millimetres per pixel at the median standoff, so the pixel residual can
    # be reported as a distance as well.
    standoffs = []
    for obs in observations:
        centre = obs['toolhead'] + offset
        standoffs.append(abs(np.dot(rot[:, 2], obs['point'] - centre)))
    mm_per_px = float(np.median(standoffs) / fx)

    # How much of the frame the targets actually covered.  Claiming more than
    # that is claiming the corners were constrained when they were not.
    us = [obs['pixel'][0] for obs in observations]
    vs = [obs['pixel'][1] for obs in observations]
    spread_u = (max(us) - min(us)) / width
    spread_v = (max(vs) - min(vs)) / height
    central = float(min(1.0, max(0.3, min(spread_u, spread_v) * 1.1)))

    return {
        'offset': {'x': round(float(offset[0]), 3), 'y': round(float(offset[1]), 3), 'z': round(float(offset[2]), 3)},
        'rotation': [[round(float(v), 6) for v in row] for row in rot],
        'intrinsics': {
            'fx': round(float(fx), 3), 'fy': round(float(fy), 3),
            'cx': round(float(cx), 3), 'cy': round(float(cy), 3),
            # Never fitted here: these targets are a handful of points, not a
            # checkerboard, and a distortion term fitted from them would be
            # noise wearing a physical name.  central_region carries the cost.
            'k1': None,
        },
        'valid_band_z': [round(float(band[0]), 3), round(float(band[1]), 3)],
        'central_region': round(central, 3),
        'residuals': {
            'rms_px': round(float(np.sqrt(np.mean(per_point ** 2))), 3),
            'max_px': round(float(np.max(per_point)), 3),
            'rms_mm': round(float(np.sqrt(np.mean(per_point ** 2)) * mm_per_px), 4),
            'n_points': int(len(per_point)),
            'n_poses': int(len(poses)),
        },
        'survey_id': survey_id,
        'targets': sorted(targets),
    }


# --------------------------------------------------------------------------
# Detection (optional; hand marks always win)
# --------------------------------------------------------------------------

def detect_setter_disc(path, diameter_hint_px=None):
    """The tool setter is a small gold/brass disc: mask by hue, then fit a
    circle.  Returns (u, v, radius_px) or None.

    Deliberately conservative - a wrong detection is worse than none, because
    it becomes a correspondence the fit believes.
    """
    if cv2 is None:
        return None
    image = cv2.imread(path)
    if image is None:
        return None
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    # Gold/brass: warm hue, decent saturation, bright.
    mask = cv2.inRange(hsv, (10, 60, 90), (40, 255, 255))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    mask = cv2.GaussianBlur(mask, (9, 9), 2)
    circles = cv2.HoughCircles(
        mask, cv2.HOUGH_GRADIENT, dp=1.5, minDist=80,
        param1=100, param2=25,
        minRadius=int((diameter_hint_px or 20) * 0.25),
        maxRadius=int((diameter_hint_px or 200) * 1.5),
    )
    if circles is None:
        return None
    best = max(circles[0], key=lambda c: c[2])
    return float(best[0]), float(best[1]), float(best[2])


# --------------------------------------------------------------------------
# Wiring
# --------------------------------------------------------------------------

def load_observations(directory, marks_path):
    with open(os.path.join(directory, 'index.json'), encoding='utf-8') as handle:
        index = json.load(handle)
    marks = {}
    if marks_path:
        with open(marks_path, encoding='utf-8') as handle:
            marks = json.load(handle)

    targets = {t['name']: t for t in index['targets']}
    observations = []
    seen = set()
    for frame in index['frames']:
        if frame.get('holdout', False):
            continue  # Never let independent verification frames enter the fit.
        name = os.path.basename(frame['file'])
        toolhead = np.array([frame['machine']['x'], frame['machine']['y'], frame['machine']['z']], dtype=float)
        hand = marks.get(name, {})
        for target_name, target in targets.items():
            pixel = hand.get(target_name)
            if pixel is None and target_name == 'tool-setter':
                found = detect_setter_disc(os.path.join(directory, name))
                pixel = [found[0], found[1]] if found else None
            if pixel is None:
                continue
            point = np.array([target['machine']['x'], target['machine']['y'], target['machine']['z']], dtype=float)
            observations.append({'toolhead': toolhead, 'point': point, 'pixel': np.array(pixel, dtype=float)})
            seen.add(target_name)
    return index, observations, sorted(seen)


def self_test():
    """Recover a known model from synthetic sightings of it."""
    truth_offset = np.array([-110.0, 5.0, -40.0])
    tilt = math.radians(12)
    truth_rot = np.array([
        [math.cos(tilt), 0.0, -math.sin(tilt)],
        [0.0, -1.0, 0.0],
        [-math.sin(tilt), 0.0, -math.cos(tilt)],
    ])
    truth = np.concatenate([truth_offset, rodrigues_from_rotation(truth_rot), [900.0, 900.0, 640.0, 360.0]])

    points = [np.array(p, dtype=float) for p in ([170, 90, 55], [170, 260, 55], [285, 150, 12])]
    observations = []
    for z in (328.0, 324.0, 320.0):
        for x, y in ((280.0, 150.0), (250.0, 200.0), (300.0, 110.0)):
            toolhead = np.array([x, y, z])
            for point in points:
                pixel = project(truth, toolhead, point)
                if 0 <= pixel[0] <= 1280 and 0 <= pixel[1] <= 720:
                    observations.append({'toolhead': toolhead, 'point': point, 'pixel': pixel})

    params, per_point, poses = solve(observations, 1280, 720)
    offset_error = np.linalg.norm(params[0:3] - truth_offset)
    print(f'self-test: {len(observations)} observations over {len(poses)} poses')
    print(f'  clean:  offset error {offset_error:.4f} mm, rms {np.sqrt(np.mean(per_point ** 2)):.4f} px')
    if offset_error > 0.5 or np.max(per_point) > 0.5:
        raise SystemExit('self-test FAILED: the solver did not recover the model it was given')

    # And again with the marks a pixel or two off, which is what hand-marking
    # and circle-fitting actually deliver. A solver that only works on exact
    # input is not a solver for this.
    rng = np.random.default_rng(7)
    noisy = [dict(obs, pixel=obs['pixel'] + rng.normal(0.0, 1.5, 2)) for obs in observations]
    params, per_point, _ = solve(noisy, 1280, 720)
    noisy_error = np.linalg.norm(params[0:3] - truth_offset)
    print(f'  noisy:  offset error {noisy_error:.3f} mm, rms {np.sqrt(np.mean(per_point ** 2)):.3f} px'
          ' (marks jittered by 1.5 px)')
    if noisy_error > 5.0:
        raise SystemExit('self-test FAILED: 1.5 px of mark noise moved the offset more than 5 mm')
    print('  ok')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('directory', nargs='?', help='a camera_bootstrap frame set (holds index.json)')
    parser.add_argument('--marks', help='JSON: {frame file: {target name: [u, v]}}')
    parser.add_argument('--out', help='write the set_camera_model payload here')
    parser.add_argument('--self-test', action='store_true', help='check the solver against a model it is given')
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return

    if not args.directory:
        parser.error('a frame set directory is required (or --self-test)')

    index, observations, seen = load_observations(args.directory, args.marks)
    zs = [obs['toolhead'][2] for obs in observations]
    width = 1280
    height = 720
    if cv2 is not None and index['frames']:
        first = cv2.imread(os.path.join(args.directory, os.path.basename(index['frames'][0]['file'])))
        if first is not None:
            height, width = first.shape[:2]

    params, per_point, poses = solve(observations, width, height)
    payload = model_json(
        params, per_point, poses, observations, width, height,
        (min(zs), max(zs)), index.get('bootstrapId'), seen,
    )
    text = json.dumps(payload, indent=2)
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as handle:
            handle.write(text)
    print(text)
    print('', file=sys.stderr)
    print('Store with set_camera_model, then prove it with verify_camera_model against a pose that is NOT in this '
          'set. A model that has only agreed with its own fit has demonstrated nothing.', file=sys.stderr)
    if payload['residuals']['rms_px'] > 5:
        print(f"WARNING: rms {payload['residuals']['rms_px']} px is high - check the marks before trusting this.",
              file=sys.stderr)


if __name__ == '__main__':
    main()
