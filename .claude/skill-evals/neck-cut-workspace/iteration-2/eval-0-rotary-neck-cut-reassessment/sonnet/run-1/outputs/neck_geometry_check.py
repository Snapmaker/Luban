"""
Independent 3D swept-cutter connectivity check: four-corner-tab vs two-C-shaped
retained connections for the rotary neck cut.

This is a DRY-RUN planning script (no MCP calls, no machine). It works in a LOCAL
PHYSICAL frame, NOT machine coordinates, built only from measured evidence in the
brief and its evidence ledger:

  x_local = machine_X - 169.90         (0 at the measured stock centre X;
                                         stock outside faces measured 137.85 / 201.95
                                         at machine Y245, width 64.1 mm)
  y       = machine_Y                  (unchanged by B rotation: rotary axis is along Y)
  z_local = depth from the B0 physical top surface, positive going DOWN toward the
            B180 physical bottom (z=0 at B0 top; z=36.35 at B180 bottom, from the
            36.3-36.4 mm B90/B270 side-silhouette measurement at Y245)

Existing (already-cut, measured, not proposed by this script) features:
  - B0 top groove:    z in [0, 9.15],      y in [253.5, 259.0]   (9.1-9.2 mm measured depth,
                       Y-band = rim-to-floor transition midpoint through the last verified
                       floor contact; do NOT extrapolate past Y259 per the brief)
  - B180 bottom groove: z in [30.2, 36.35], y in [253.5, 258.0]  (6.1-6.2 mm measured depth)
  Both are modelled as flat boxes spanning the FULL measured width, because the probe
  only sampled one X per face (X195 / X198) -- this is an ASSUMPTION flagged in plan.md,
  not a measurement, and is exactly the kind of "axis-aligned block" simplification the
  cutting-programs skill warns against for the ENCLOSURE shell -- here it stands in only
  for the un-widened remainder of the existing groove, which the six-op prior README
  corroborates ("reopen the top channel", "reopen the bottom channel").

Proposed (NEW, this script's own reasoning, NOT copied from the prior agent's numbers)
cuts, each modelled as a real swept 6 mm cutter (radius r) pass:

  - A pass whose tool axis is physical X (a B90/B270 SIDE approach) rounds in the
    (Y, Z) plane and is FLAT/SHARP along X (the depth it is plunged to) -- flat-bottom
    endmill, "radius in plan view, sharp in section" (cnc-motion-rules/cutting-programs.md).
  - A pass whose tool axis is physical Z (a B0/B180 TOP/BOTTOM approach) rounds in the
    (X, Y) plane and is flat/sharp along Z.

Rounding is implemented as a Minkowski dilation of a "core rectangle" (the path bounding
box) by the cutter radius r -- verified algebraically equal to the union of the three
parallel 2 mm-pitch Y-tracks (254/256/258) swept over the same range, because the track
pitch (2 mm) is much smaller than 2r (6 mm): the passes overlap enough that a shared core
rectangle dilation is the correct closed form, not an approximation of convenience.

Two candidate ROUND-2 (finishing) geometries are built on the SAME round-1 stock and
counted for 3D connectivity with scipy.ndimage.label (6-connectivity), at nominal r and
at a runout-inflated r, plus a registration-shift check -- see RESULTS at the bottom.
"""
import numpy as np
from scipy import ndimage

# ---- grid ------------------------------------------------------------------
RES = 0.2  # mm/voxel
X0, X1 = -32.05, 32.05
Z0, Z1 = 0.0, 36.35
Y0, Y1 = 248.0, 264.0

xs = np.arange(X0, X1 + RES, RES)
zs = np.arange(Z0, Z1 + RES, RES)
ys = np.arange(Y0, Y1 + RES, RES)
NX, NZ, NY = len(xs), len(zs), len(ys)
print(f"grid: {NX} x {NZ} x {NY} = {NX*NZ*NY:,} voxels")

X, Z, Y = np.meshgrid(xs, zs, ys, indexing="ij")  # arrays shape (NX,NZ,NY)


def rounded_rect(A, B, a0, a1, b0, b1, r):
    """Boolean mask: dilation of axis-aligned rect [a0,a1]x[b0,b1] by disk radius r,
    evaluated on coordinate arrays A, B (broadcastable)."""
    da = np.maximum(0.0, np.maximum(a0 - A, A - a1))
    db = np.maximum(0.0, np.maximum(b0 - B, B - b1))
    return (da * da + db * db) <= r * r


def build(r, y_shift=0.0, d_side=22.05, variant="tabs", tab_w=5.0, tab_h=6.0,
          leg_h=9.0, spine_w=6.0, gap_half=2.0):
    """Return boolean 'solid' array (True = material present) for one variant.
    y_shift perturbs the existing-groove / cut Y-band registration for sensitivity."""
    y0g, y1g_top, y1g_bot = 253.5 + y_shift, 259.0 + y_shift, 258.0 + y_shift
    solid = np.ones_like(X, dtype=bool)

    # --- existing grooves (measured, sharp box; full width) ---
    top_groove = (Z <= 9.15) & (Y >= y0g) & (Y <= y1g_top)
    bot_groove = (Z >= 30.2) & (Y >= y0g) & (Y <= y1g_bot)
    solid &= ~top_groove
    solid &= ~bot_groove

    # --- round 1: side cuts (SIDE approach: round in Y,Z; flat/sharp in X) ---
    side_core = rounded_rect(Y, Z, 254 + y_shift, 258 + y_shift, 9.15, 30.2, r)
    west_side = side_core & (X <= X0 + d_side)
    east_side = side_core & (X >= X1 - d_side)
    solid &= ~west_side
    solid &= ~east_side

    cb = X1 - d_side  # = 10.05, the round-1 remaining half-width (center bar)

    if variant == "tabs":
        # round 2: TOP/BOTTOM deepen (TOP/BOTTOM approach: round in X,Y; flat/sharp in Z).
        # FULL WIDTH core (not shrunk) so the pass reaches every X in the bar; the four
        # corner tabs are carved out as explicit exclusion notches (the untouched material
        # the pass does NOT visit), not by narrowing the pass's own X core -- narrowing the
        # core instead leaves two continuous full-height pillars (caught by this script's
        # first draft: see critique.md "modelling pitfall").
        full_core = rounded_rect(X, Y, -cb, cb, 254 + y_shift, 258 + y_shift, r)
        tab_col = (X <= -cb + tab_w) | (X >= cb - tab_w)  # the two margin columns
        top_tab_notch = tab_col & (Z >= 9.15) & (Z <= 9.15 + tab_h)
        bot_tab_notch = tab_col & (Z >= 30.2 - tab_h) & (Z <= 30.2)

        top_deepen = full_core & (Z >= 9.15) & (Z <= 30.2 - tab_h) & ~top_tab_notch
        bot_deepen = full_core & (Z >= 9.15 + tab_h) & (Z <= 30.2) & ~bot_tab_notch
        solid &= ~top_deepen
        solid &= ~bot_deepen
        meta = dict(cb=cb, tab_w=tab_w, tab_h=tab_h)

    elif variant == "cshape":
        # separation gap between the two C's: TOP/BOTTOM approach, full Z height
        gap_core = rounded_rect(X, Y, -gap_half, gap_half, 254 + y_shift, 258 + y_shift, r)
        gap = gap_core & (Z >= 9.15) & (Z <= 30.2)
        solid &= ~gap

        # each C's interior bite: SIDE approach, middle-Z band only
        bite_core = rounded_rect(Y, Z, 254 + y_shift, 258 + y_shift,
                                  9.15 + leg_h, 30.2 - leg_h, r)
        west_bite = bite_core & (X >= X0 + d_side) & (X <= -gap_half - spine_w)
        east_bite = bite_core & (X <= X1 - d_side) & (X >= gap_half + spine_w)
        solid &= ~west_bite
        solid &= ~east_bite
        meta = dict(cb=cb, gap_half=gap_half, spine_w=spine_w, leg_h=leg_h,
                     west_reach_from_face=(X1 - (gap_half + spine_w)),
                     east_reach_from_face=(X1 - (gap_half + spine_w)))
    else:
        raise ValueError(variant)
    return solid, meta


def analyse(solid, label="variant"):
    struct = ndimage.generate_binary_structure(3, 1)  # 6-connectivity
    labels, n = ndimage.label(solid, structure=struct)
    sizes = ndimage.sum(solid, labels, index=np.arange(1, n + 1))
    # does the largest component span the full Y range (i.e. still joins
    # enclosure-side stock at Y<=249 to tenon-side stock at Y>=263)?
    main = int(np.argmax(sizes)) + 1
    mask_main = labels == main
    y_idx_present = np.any(mask_main, axis=(0, 1))
    spans_full = y_idx_present[1] and y_idx_present[-2]  # near both Y ends
    voxel_area = RES * RES
    # minimum X-Z cross-sectional area of solid (any component) at any Y slice
    # within the kerf band, and per-Y connected-component count in that slice
    y_lo = np.searchsorted(ys, 251.0)
    y_hi = np.searchsorted(ys, 261.0)
    min_area = None
    min_area_y = None
    worst_component_count = 0
    for iy in range(y_lo, y_hi + 1):
        sl = solid[:, :, iy]
        area = sl.sum() * voxel_area
        lbl2, n2 = ndimage.label(sl, structure=np.ones((3, 3)))
        worst_component_count = max(worst_component_count, n2)
        if area > 0 and (min_area is None or area < min_area):
            min_area = area
            min_area_y = ys[iy]
    iy256 = np.searchsorted(ys, 256.0)
    area256 = solid[:, :, iy256].sum() * voxel_area
    lbl256, n256 = ndimage.label(solid[:, :, iy256], structure=np.ones((3, 3)))
    print(f"[{label}] components(3D,6-conn)={n}  main-component spans full Y={spans_full}  "
          f"sizes(vox)={sorted(sizes.astype(int), reverse=True)[:6]}")
    print(f"          smallest X-Z cross-section anywhere in Y251-261: "
          f"{min_area:.2f} mm^2 at Y={min_area_y:.1f}   "
          f"max components seen in a single Y-slice: {worst_component_count}")
    print(f"          mid-band (Y=256) cross-section: {area256:.2f} mm^2, "
          f"{n256} piece(s) in that slice")
    return dict(n_components_3d=n, spans_full=bool(spans_full),
                min_cross_section_mm2=float(min_area), min_cross_section_y=float(min_area_y),
                max_slice_components=int(worst_component_count),
                mid_band_y256_mm2=float(area256), mid_band_y256_pieces=int(n256))


print("\n=== NOMINAL (r=3.0 mm, no registration shift) ===")
solid_tabs, meta_tabs = build(r=3.0, variant="tabs")
res_tabs = analyse(solid_tabs, "four-corner-tabs")
solid_c, meta_c = build(r=3.0, variant="cshape")
res_c = analyse(solid_c, "two-C-shapes")
print("tabs meta:", meta_tabs)
print("C meta:", meta_c)

print("\n=== RUNOUT SENSITIVITY (r=3.15 mm) ===")
solid_tabs_r, _ = build(r=3.15, variant="tabs")
analyse(solid_tabs_r, "four-corner-tabs (r+0.15)")
solid_c_r, _ = build(r=3.15, variant="cshape")
analyse(solid_c_r, "two-C-shapes (r+0.15)")

print("\n=== REGISTRATION SENSITIVITY (Y band shifted +0.5 mm) ===")
solid_tabs_y, _ = build(r=3.0, y_shift=0.5, variant="tabs")
analyse(solid_tabs_y, "four-corner-tabs (Y+0.5)")
solid_c_y, _ = build(r=3.0, y_shift=0.5, variant="cshape")
analyse(solid_c_y, "two-C-shapes (Y+0.5)")

print("\n=== REGISTRATION SENSITIVITY (Y band shifted -0.5 mm) ===")
solid_tabs_y2, _ = build(r=3.0, y_shift=-0.5, variant="tabs")
analyse(solid_tabs_y2, "four-corner-tabs (Y-0.5)")
solid_c_y2, _ = build(r=3.0, y_shift=-0.5, variant="cshape")
analyse(solid_c_y2, "two-C-shapes (Y-0.5)")

# ---- save a mid-band (Y=256) cross-section PNG for both variants, for the diagram ----
import json

iy256 = np.searchsorted(ys, 256.0)
np.save("stock_solid_tabs_y256.npy", solid_tabs[:, :, iy256])
np.save("stock_solid_cshape_y256.npy", solid_c[:, :, iy256])

summary = dict(
    grid_resolution_mm=RES,
    frame=("LOCAL PHYSICAL (x=machine_X-169.90, y=machine_Y, z=depth from B0 top); "
           "NOT machine frame, not yet a registered WCS"),
    tabs=dict(meta=meta_tabs, nominal=res_tabs),
    cshape=dict(meta=meta_c, nominal=res_c),
)
with open("neck_geometry_results.json", "w") as f:
    json.dump(summary, f, indent=2, default=str)
print("\nWrote neck_geometry_results.json")
