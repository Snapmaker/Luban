"""
Independent 6 mm cutter-sweep connectivity check for the neck-cut reassessment eval.

Frame: local "B0-pose" coordinates, NOT machine coordinates, NOT the operator's CAD frame.
  X: cross-section width direction (B0 outside faces at physical X137.85 / 201.95 -> local X in
     [-32.05, +32.05], 64.1 mm wide)
  Z: cross-section height direction (B0 side silhouette 36.3-36.4 mm -> local Z in [-18.2,+18.2])
  Y: axial (feed) direction = machine Y, kept as machine Y for traceability (250..262 window)

Built ONLY from the measurement table in docs/skills-evals/cnc-neck-cut-reassessment.md and the
raw probe_measurements_20260927.json contacts (both read before this script was written). This is
an independently-derived model, not a copy of the prior agent's neck_cut_fixture_plan.FCStd.

Existing (already-cut) grooves, from measured contacts:
  B0 top groove:   depth 9.15 mm below the Y250 rim (avg of the 9.1/9.2 mm readings quoted in the
                   brief and in README_previous_proposal.md). CONFIRMED CONTACT from Y254.0-259.0
                   (job 7685888d887d); rim (uncut) confirmed Y250.0-253.0; transition ~253.0-253.5.
                   The scan aborted past Y259.0 on a rising wall -- the far edge is UNKNOWN, and is
                   modelled as unknown, not extrapolated as either open or solid.
  B180 bottom groove: depth 6.2 mm below the Y250 rim (204.5-198.3). CONFIRMED CONTACT Y254.0-258.0
                   (job f8f12d4a4b3e); rim (uncut) confirmed Y245-253.5 AND Y259.0-263.0 (returns to
                   204.6/207.x) -- this groove is bounded on BOTH ends by measurement.
  Jointly-confirmed axial band (both grooves present): Y253.75 - Y258.75 (transitions placed at
  the midpoint of each measured step). This 5.0 mm band is the only part of the neck whose reduced
  cross-section is measured from both faces; it is treated as the working "neck band" below. This
  is intentionally SHORTER than the prior agent's assumed Y251-261 (10 mm) cutter extent -- see
  critique.md and plan.md "Remaining measurements" for the consequence.

  Web height in that band: H = 36.4 - 9.15 - 6.2 = 21.05 mm (cf. independently measured B90/B270
  side opening of 21.3 mm at Y256 -- 0.25 mm apart, i.e. mutually corroborating, not identical
  measurements of the same thing).

Round 1 (B90 + B270, one of the four indexed cuts each): narrows the web from the full 64.1 mm
  width to an intermediate width W1, cutting in from both X edges over the neck band. W1 chosen
  here (26 mm, i.e. 19.05 mm removed per side) -- NOT the prior agent's 24 mm-per-side/16.1 mm
  final width -- to keep the per-side depth of cut comfortably under the tool's stated >25 mm
  usable flute (19.05 mm vs the prior plan's 24 mm) while leaving enough width for two 8 mm
  corner/rib features plus a 6 mm-tool-clearable centre pocket. This is a planning choice, stated
  and computed, not a rediscovery of the prior number.

Round 2 (four-corner-tab variant): B0 + B180 cut a centred X pocket through both faces (meeting in
  the middle), THEN B90 + B270 make a second, shallower pass that splits each remaining edge strip
  into a top tab and a bottom tab (four setups total, all four B indices revisited).
Round 2 (two-C variant): B0 + B180 cut the SAME centred X pocket; the edge strips are left full
  height (two setups total; B90/B270 are not revisited in round 2).

All pocket/slot walls are modelled as the true round-cutter-radius sweep (a straight tool centre
path over a rectangular footprint clears a rectangle with the four internal corners rounded to the
tool radius) -- not a mid-plane sketch with square corners.
"""
import numpy as np
from scipy import ndimage

# ---- measured / evidence-derived constants (mm) -----------------------------------------------
X_OUT = 64.1                      # B0 outside width at Y245 (physical X137.85-201.95)
Z_OUT = 36.4                      # side silhouette at Y245 (B0/B180 orientations)
TOP_DEPTH = (9.1 + 9.2) / 2       # B0 groove depth below Y250 rim
BOT_DEPTH = 204.5 - 198.3         # B180 groove depth below rim (6.2 mm)

Y_BAND0, Y_BAND1 = 253.75, 258.75  # jointly-confirmed neck band (both grooves present)
CUTTER_R = 3.0                     # 6 mm endmill

W1 = 26.0                          # round-1 intermediate width (my choice, see module docstring)
TX = 8.0                           # corner tab / C-rib X width (each edge)
TZ = 6.0                           # corner tab Z height (top and bottom), four-tab variant only

X_HALF = X_OUT / 2.0
Z_HALF = Z_OUT / 2.0
H = Z_OUT - TOP_DEPTH - BOT_DEPTH  # web height in the neck band

# ---- voxel grid ----------------------------------------------------------------------------
res = 0.2  # mm
xs = np.arange(-X_HALF - 2, X_HALF + 2 + res, res)
ys = np.arange(Y_BAND0 - 1.0, Y_BAND1 + 1.0 + res, res)
zs = np.arange(-Z_HALF - 2, Z_HALF + 2 + res, res)
X, Y, Z = np.meshgrid(xs, ys, zs, indexing="ij")


def rounded_rect_mask(px, py, x0, x1, y0, y1, r):
    """True where (px,py) lies within the round-tool sweep that clears rectangle [x0,x1]x[y0,y1]."""
    dx = np.maximum(0.0, np.maximum(x0 + r - px, px - (x1 - r)))
    dy = np.maximum(0.0, np.maximum(y0 + r - py, py - (y1 - r)))
    return (dx * dx + dy * dy) <= r * r


def base_web():
    """Round-1 intermediate web: W1 (X) x H (Z) rectangle over the neck band, full stock elsewhere
    outside the band (not modelled here -- we only need the neck band itself)."""
    in_band = (Y >= Y_BAND0) & (Y <= Y_BAND1)
    in_x = np.abs(X) <= W1 / 2.0
    in_z = np.abs(Z) <= H / 2.0
    return in_band & in_x & in_z



# The finishing passes (round 2) are cut across the whole neck band AND run out into the solid
# enclosure/tenon material beyond it (normal milling practice, also needed for tool lead-in/out).
# That means their rounded-corner Y-extent falls OUTSIDE our modelled band -- inside the band the
# pockets/slots are uniform in Y. Model that by extending the cut's own Y footprint well past the
# band edges (round-tripping through un-modelled solid stock we don't need to represent).
CUT_Y0, CUT_Y1 = Y_BAND0 - 15.0, Y_BAND1 + 15.0


def four_tab_solid():
    mat = base_web()
    # Step (a): B0 (+Z) and B180 (-Z) cut a centred X pocket clean through, over the WHOLE band.
    pocket_x0, pocket_x1 = -(W1 / 2.0 - TX), (W1 / 2.0 - TX)
    pocket = rounded_rect_mask(X, Y, pocket_x0, pocket_x1, CUT_Y0, CUT_Y1, CUTTER_R)
    mat = mat & ~pocket
    # Step (b): B90/B270 split each remaining edge strip at mid-height.
    gap_z0, gap_z1 = -(H / 2.0 - TZ), (H / 2.0 - TZ)
    split = rounded_rect_mask(Y, Z, CUT_Y0, CUT_Y1, gap_z0, gap_z1, CUTTER_R)
    in_left_strip = (X >= -(W1 / 2.0)) & (X <= -(W1 / 2.0 - TX))
    in_right_strip = (X >= (W1 / 2.0 - TX)) & (X <= (W1 / 2.0))
    mat = mat & ~(split & (in_left_strip | in_right_strip))
    return mat


def two_c_solid():
    mat = base_web()
    pocket_x0, pocket_x1 = -(W1 / 2.0 - TX), (W1 / 2.0 - TX)
    pocket = rounded_rect_mask(X, Y, pocket_x0, pocket_x1, CUT_Y0, CUT_Y1, CUTTER_R)
    mat = mat & ~pocket
    return mat


def analyse(mat, label):
    print(f"\n=== {label} ===")
    struct = ndimage.generate_binary_structure(3, 1)  # 6-connectivity
    labels, n = ndimage.label(mat, structure=struct)
    print(f"voxel-connected components: {n}")
    # Sample well inside each end of the band (half a resolution step in) to dodge float rounding
    # at the exact boundary; the uniform per-Y cross-sections below independently confirm there is
    # no gap between these sample lines and the true band edges.
    y_idx0 = np.argmin(np.abs(ys - (Y_BAND0 + res)))
    y_idx1 = np.argmin(np.abs(ys - (Y_BAND1 - res)))
    results = []
    for lab in range(1, n + 1):
        comp = labels == lab
        touches_lo = comp[:, y_idx0, :].any()
        touches_hi = comp[:, y_idx1, :].any()
        vol = comp.sum() * res**3
        xs_present = X[comp]
        zs_present = Z[comp]
        results.append(dict(
            label=lab, spans_band=bool(touches_lo and touches_hi), volume_mm3=float(vol),
            x_range=(float(xs_present.min()), float(xs_present.max())) if comp.any() else None,
            z_range=(float(zs_present.min()), float(zs_present.max())) if comp.any() else None,
        ))
        print(f"  component {lab}: spans full band={touches_lo and touches_hi} "
              f"volume={vol:.1f} mm3 x_range={results[-1]['x_range']} z_range={results[-1]['z_range']}")

    # cross-section area and min ligament width at several Y stations
    print("  cross-section area by Y (mm2), per component count:")
    min_area = None
    min_area_y = None
    for y_target in [Y_BAND0 + 0.1, 254.0, 255.5, 256.0, 257.0, 258.0, Y_BAND1 - 0.1]:
        yi = np.argmin(np.abs(ys - y_target))
        slice_mat = mat[:, yi, :]
        area = slice_mat.sum() * res * res
        slab_labels, slab_n = ndimage.label(slice_mat, structure=ndimage.generate_binary_structure(2, 1))
        print(f"    Y={ys[yi]:.2f}: area={area:.2f} mm2  islands={slab_n}")
        if min_area is None or area < min_area:
            min_area = area
            min_area_y = ys[yi]
    print(f"  thinnest sampled cross-section: {min_area:.2f} mm2 at Y={min_area_y:.2f}")

    total_spanning_area = sum(r["volume_mm3"] for r in results if r["spans_band"]) / (Y_BAND1 - Y_BAND0)
    print(f"  spanning components: {sum(1 for r in results if r['spans_band'])}  "
          f"mean cross-section of spanning material ~ {total_spanning_area:.1f} mm2")
    return results


if __name__ == "__main__":
    print(f"web H={H:.2f} mm (36.4 - {TOP_DEPTH:.2f} - {BOT_DEPTH:.2f}); "
          f"neck band Y{Y_BAND0}-{Y_BAND1} (L={Y_BAND1-Y_BAND0:.2f} mm); W1={W1} mm; "
          f"TX={TX} mm; TZ={TZ} mm; cutter r={CUTTER_R} mm")
    analyse(base_web(), "round-1 intermediate web (before round 2)")
    r4 = analyse(four_tab_solid(), "round-2: four corner tabs")
    r2c = analyse(two_c_solid(), "round-2: two C-shaped ribs")
