#!/usr/bin/env python3
"""
board_metrology.py — recover metric scale on a gridded CNC wasteboard from ONE
oblique webcam frame, with no calibration target and no known camera pose.

Validated on a Snapmaker A350 (640x480 USB webcam, hand-drawn 1 cm grid, ~36 deg
camera tilt). Every number it prints was cross-checked against an independent
measurement in the session that produced this file.

Pipeline
--------
1. board_mask()      tan-colour mask so line detection never sees metalwork
2. grid_segments()   flat-field -> Canny -> HoughLinesP, split into two families
3. vanishing_points()  SVD null-space of each family's homogeneous line coords
4. rectify()         affine rectification from the line at infinity
5. metric_from_rect_object()  solve the ONE remaining anisotropy factor by
                     asserting a known-rectangular object really is rectangular
   ...or metric_from_pitch()  if you trust a directly measured grid pitch
6. camera_from_vps() focal length + plane normal + standoff (needs orthogonal VPs)

Usage
-----
    python3 board_metrology.py frame.jpg --quad 421,114 530,133 508,193 409,174

Dependencies: numpy, opencv-python, scipy
"""

import argparse
import numpy as np
import cv2
from scipy.optimize import minimize_scalar
from scipy.signal import find_peaks


# ---------------------------------------------------------------- masking ----

def board_mask(bgr, hue=(8, 34), sat_min=40, val_min=100):
    """Tan/MDF colour mask. Widen `hue` for darker or painted boards; a plywood
    board with heavy grain may need sat_min lowered to ~25."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H, S, V = hsv[:, :, 0].astype(int), hsv[:, :, 1].astype(int), hsv[:, :, 2].astype(int)
    m = ((H > hue[0]) & (H < hue[1]) & (S > sat_min) & (V > val_min)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    return m


def flat_field(bgr, sigma=13):
    """Divide out illumination. Essential: raw Canny on a webcam frame finds
    shading gradients and wood grain, not grid lines."""
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    g = cv2.fastNlMeansDenoising(g, None, 9, 7, 21).astype(float)
    f = np.clip(g / (cv2.GaussianBlur(g, (0, 0), sigma) + 1e-6) * 128, 0, 255).astype(np.uint8)
    return cv2.createCLAHE(2.5, (8, 8)).apply(f)


# ------------------------------------------------------------ grid finding ---

def grid_segments(bgr, min_len=28, thresh=28):
    """Return (segments, angles_deg). Angles are mod 180."""
    mask = board_mask(bgr)
    flat = cv2.bitwise_and(flat_field(bgr), flat_field(bgr), mask=mask)
    e = cv2.Canny(flat, 20, 60)
    e = cv2.bitwise_and(e, e, mask=cv2.erode(mask, np.ones((7, 7), np.uint8)))
    segs = cv2.HoughLinesP(e, 1, np.pi / 720, threshold=thresh,
                           minLineLength=min_len, maxLineGap=4)
    if segs is None:
        raise RuntimeError("no grid segments — loosen thresh/min_len or check board_mask")
    segs = segs[:, 0].astype(float)
    ang = np.degrees(np.arctan2(segs[:, 3] - segs[:, 1], segs[:, 2] - segs[:, 0])) % 180
    return segs, ang


def split_families(segs, ang, gap=45):
    """Two families ~90 deg apart in the world are typically 70-110 deg apart in
    the image. Histogram the angles and take the two dominant modes.

    Families are returned sorted by mode angle so the assignment is DETERMINISTIC
    across frames — otherwise a pitch you measured for 'family A' silently lands
    on the other axis and every downstream number is wrong by the anisotropy.
    """
    hist, edges = np.histogram(ang, bins=36, range=(0, 180))
    order = np.argsort(hist)[::-1]
    modes = []
    for i in order:
        c = edges[i] + 2.5
        if all(min(abs(c - m), 180 - abs(c - m)) > gap / 2 for m in modes):
            modes.append(c)
        if len(modes) == 2:
            break
    modes.sort()
    fams = []
    for m in modes:
        d = np.minimum(np.abs(ang - m), 180 - np.abs(ang - m))
        fams.append(segs[d < gap / 2])
    return fams


def vanishing_point(S):
    """Null vector of the stacked homogeneous line coordinates."""
    L = []
    for x1, y1, x2, y2 in S:
        l = np.cross([x1, y1, 1], [x2, y2, 1])
        L.append(l / np.linalg.norm(l[:2]))
    _, _, Vt = np.linalg.svd(np.array(L))
    v = Vt[-1]
    return v / (v[2] if abs(v[2]) > 1e-12 else 1.0)


# ------------------------------------------------------------ rectification --

def rectify(vA, vB):
    """Homography sending both vanishing points to infinity and the two grid
    directions to the image axes. Scale along each axis is still arbitrary."""
    linf = np.cross(vA, vB)
    linf = linf / linf[2]
    Hp = np.array([[1, 0, 0], [0, 1, 0], linf])

    def d(v):
        p = Hp @ v
        return p[:2] / np.linalg.norm(p[:2])

    dA, dB = d(vA), d(vB)
    orth = np.degrees(np.arccos(abs(dA @ dB)))
    Ha = np.eye(3)
    Ha[:2, :2] = np.linalg.inv(np.array([[dA[0], dB[0]], [dA[1], dB[1]]]))
    return Ha @ Hp, orth


def apply_H(H, pts):
    p = np.hstack([np.asarray(pts, float), np.ones((len(pts), 1))])
    q = (H @ p.T).T
    return q[:, :2] / q[:, 2:3]


def metric_from_rect_object(H, quad):
    """Solve the anisotropy s (y-scale relative to x) that makes a quad that is
    KNOWN to be rectangular in the world actually rectangular after rectification.

    This is the trick that rescues a single uncalibrated frame. Any milled stock,
    machine table, or clamp with square corners will do. CROSS-CHECK the answer
    against a directly measured grid pitch — if they disagree, one of the two
    vanishing points is under-constrained (usually the family with fewer lines).
    """
    R = apply_H(H, quad)

    def cost(s):
        Q = R.copy()
        Q[:, 1] *= s
        c = 0.0
        for i in range(4):
            a = Q[(i - 1) % 4] - Q[i]
            b = Q[(i + 1) % 4] - Q[i]
            c += (a @ b / (np.linalg.norm(a) * np.linalg.norm(b))) ** 2
        return c

    return minimize_scalar(cost, bounds=(0.2, 5), method="bounded").x


def rect_roi(bgr, H, shrink=0.25):
    """Bounding box, in rectified coords, of the central part of the board mask.
    Warping the whole frame wastes pixels on background and metalwork."""
    m = board_mask(bgr)
    ys, xs = np.nonzero(m)
    pts = np.stack([xs, ys], 1).astype(float)
    R = apply_H(H, pts)
    lo = np.percentile(R, shrink * 100, axis=0)
    hi = np.percentile(R, 100 - shrink * 100, axis=0)
    return int(lo[0]), int(lo[1]), int(hi[0]), int(hi[1])


def radon_pitch(bgr, H, roi, axis):
    """Measure grid pitch (rectified units per line) along one rectified axis.
    Independent of any object in the scene — this is what validates the
    anisotropy solved from a rectangular object.

    axis=0 collapses rows -> spacing of lines running along rectified y.
    Returns (median_spacing, peak_positions).
    """
    T = np.array([[1, 0, -roi[0]], [0, 1, -roi[1]], [0, 0, 1]], float)
    w, h = max(roi[2] - roi[0], 8), max(roi[3] - roi[1], 8)
    out = cv2.warpPerspective(bgr, T @ H, (w, h), flags=cv2.INTER_LANCZOS4)
    g = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).astype(float)
    v = (g / (cv2.GaussianBlur(g, (0, 0), 16) + 1e-6)).mean(axis=axis)
    v = v - cv2.GaussianBlur(v.reshape(-1, 1), (0, 0), 10).ravel()
    pk, _ = find_peaks(-v, prominence=v.std() * 0.6, distance=5)
    d = np.diff(pk)
    if len(d) == 0:
        return float("nan"), []
    # grid lines are often alternately bold; the median rejects the doubled gaps
    # left by a missed faint line better than the mean does
    return float(np.median(d)), pk.tolist()


# ------------------------------------------------------------------ camera ---

def camera_from_vps(vA, vB, principal_point):
    """Focal length from an orthogonal vanishing-point pair, then the board
    plane's normal in camera frame. Assumes square pixels, principal point at
    image centre, NO lens distortion — all three are approximations on a cheap
    webcam, so treat the standoff as +-15%."""
    p = np.asarray(principal_point, float)
    f2 = -((vA[:2] - p) @ (vB[:2] - p))
    if f2 <= 0:
        raise ValueError("VP pair not orthogonal under this principal point")
    f = float(np.sqrt(f2))
    K = np.array([[f, 0, p[0]], [0, f, p[1]], [0, 0, 1]])
    Ki = np.linalg.inv(K)
    DA = Ki @ vA; DA /= np.linalg.norm(DA)
    DB = Ki @ vB; DB /= np.linalg.norm(DB)
    N = np.cross(DA, DB); N /= np.linalg.norm(N)
    tilt = float(np.degrees(np.arccos(abs(N[2]))))
    return f, N, tilt, Ki


def standoff_mm(Ki, N, at_px, along_vp, px_per_cm):
    """Perpendicular camera-to-board distance, from the known metric scale."""
    def world(px, D):
        x = Ki @ np.array([px[0], px[1], 1.0])
        return (D / (N @ x)) * x

    c = np.asarray(at_px, float)
    d = along_vp[:2] - c
    d = d / np.linalg.norm(d)
    L = np.linalg.norm(world(c + d * px_per_cm, 1.0) - world(c, 1.0))
    return 10.0 / L


def top_face_correction(D_mm, height_mm):
    """An elevated top face images larger than its footprint. Multiply measured
    top-face dimensions by this to get the footprint on the board plane."""
    return (D_mm - height_mm) / D_mm


# -------------------------------------------------------------------- main ---

def solve(path, quad, grid_cm=1.0, patch=None):
    bgr = cv2.imread(path)
    if bgr is None:
        raise FileNotFoundError(path)
    h, w = bgr.shape[:2]

    segs, ang = grid_segments(bgr)
    A, B = split_families(segs, ang)
    print(f"grid segments: {len(segs)}  familyA={len(A)}  familyB={len(B)}")
    if min(len(A), len(B)) < 5:
        print("  WARNING: a family has <5 lines. Its vanishing point is weak and "
              "the rectification will be anisotropically wrong. Re-shoot with more "
              "bare board in frame before trusting anything below.")
    vA, vB = vanishing_point(A), vanishing_point(B)
    H, orth = rectify(vA, vB)
    print(f"VP A {vA[:2].round(1)}  VP B {vB[:2].round(1)}")
    print(f"families {orth:.1f} deg apart after rectification "
          f"({'OK' if abs(orth - 90) < 6 else 'SUSPECT - expect ~90'})")

    # --- two independent routes to the same anisotropy ---------------------
    s_obj = metric_from_rect_object(H, quad)
    if patch is not None:
        c = np.array([[patch[0], patch[1]], [patch[2], patch[1]],
                      [patch[2], patch[3]], [patch[0], patch[3]]], float)
        R = apply_H(H, c)
        roi = (int(R[:, 0].min()), int(R[:, 1].min()),
               int(R[:, 0].max()), int(R[:, 1].max()))
    else:
        print("  NOTE: no --patch given; measuring pitch over the whole board. "
              "Screws, seams and shadow gradients add spurious minima. Pass a "
              "clean bare-board rectangle for a reliable pitch.")
        roi = rect_roi(bgr, H)
    px, _ = radon_pitch(bgr, H, roi, 0)
    py, _ = radon_pitch(bgr, H, roi, 1)
    s_pitch = px / py if py and not np.isnan(py) else float("nan")
    print(f"anisotropy from object rectangularity : {s_obj:.3f}")
    print(f"anisotropy from measured grid pitch   : {s_pitch:.3f}  "
          f"(rect pitches {px:.1f} / {py:.1f})")

    # harmonic check: peak-finders often lock onto 2x the true pitch
    ratio = s_pitch / s_obj if s_obj else float("nan")
    if not np.isnan(ratio) and not (0.8 < ratio < 1.25):
        for k, label in ((2.0, "px doubled"), (0.5, "py doubled")):
            if 0.8 < ratio / k < 1.25:
                print(f"  NOTE: routes differ by ~{k}x - likely {label} "
                      f"(a harmonic of the true pitch). Halve it and re-run.")
                break
        else:
            print("  DISAGREEMENT: the two routes do not reconcile. Do NOT use "
                  "these numbers; fix the weak vanishing point first.")
    else:
        print("  routes agree - metric rectification is trustworthy")

    s = s_obj
    pitch_x = px                      # rectified units per grid line, x
    units_per_cm = pitch_x / grid_cm

    Q = apply_H(H, quad)
    Q = np.stack([Q[:, 0] / units_per_cm * 10,
                  Q[:, 1] / (units_per_cm / s) * 10], 1)   # mm
    L = [float(np.linalg.norm(Q[i] - Q[(i + 1) % 4])) for i in range(4)]
    long_, short_ = np.mean([L[0], L[2]]), np.mean([L[1], L[3]])
    print("object sides (mm):", [round(x, 1) for x in L])
    print(f"  long  pair mean {long_:.1f} mm")
    print(f"  short pair mean {short_:.1f} mm")
    print("  (opposite sides should agree within a few mm; a large gap means a "
          "corner was mis-picked or an edge is occluded)")

    # --- MANDATORY sanity check: implied field of view vs the known bed -----
    J = np.zeros((2, 2))
    c0 = np.mean(quad, axis=0)
    for i in range(2):
        d = np.zeros(2); d[i] = 1e-3
        J[:, i] = (apply_H(H, [c0 + d])[0] - apply_H(H, [c0 - d])[0]) / 2e-3
    Ji = np.linalg.inv(J)
    img_px_per_cm = units_per_cm * np.linalg.norm(Ji[:, 0])
    print(f"implied scale at object: {img_px_per_cm:.1f} image px per cm "
          f"-> frame spans ~{w / img_px_per_cm * 10:.0f} mm")
    print("  COMPARE THAT TO THE BED. If the frame obviously covers the whole "
          "bed and this says otherwise, the pitch peak-finder locked onto the "
          "wrong harmonic - fix it before believing any dimension above.")

    try:
        f, N, tilt, Ki = camera_from_vps(vA, vB, (w / 2, h / 2))
        D = standoff_mm(Ki, N, np.mean(quad, axis=0), vA, units_per_cm)
        print(f"focal {f:.0f} px  tilt {tilt:.1f} deg  standoff {D:.0f} mm")
        print(f"PARALLAX {np.tan(np.radians(tilt)):.2f} mm per mm of tool height "
              "- this is why open-loop moves cannot be verified from a high Z")
        for hh in (15, 25, 40):
            k = top_face_correction(D, hh)
            print(f"  if {hh} mm thick -> footprint {long_*k:.0f} x {short_*k:.0f} mm")
    except Exception as exc:
        print("camera solve skipped:", exc)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--quad", nargs=4, required=True,
                    help="four x,y image corners of a known-rectangular object, in order")
    ap.add_argument("--grid-cm", type=float, default=1.0,
                    help="physical size of one grid square in cm (default 1.0)")
    ap.add_argument("--patch", default=None,
                    help="x0,y0,x1,y1 image rect of CLEAN bare board, for pitch")
    a = ap.parse_args()
    quad = np.array([[float(v) for v in p.split(",")] for p in a.quad])
    patch = [float(v) for v in a.patch.split(',')] if a.patch else None
    solve(a.image, quad, a.grid_cm, patch)
