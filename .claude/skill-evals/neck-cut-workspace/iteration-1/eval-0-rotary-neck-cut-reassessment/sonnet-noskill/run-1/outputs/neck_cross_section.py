"""
Independent cross-section / cutter-sweep connectivity study for the rotary neck cut.

This is a DRY-RUN planning aid, not a CAM program. It is deliberately simplified to a
prismatic (Y-independent) cross-section model of the 64.1 x 36.4 mm stock over the
working Y-band chosen below, because the evidence shows the existing top/bottom
grooves and side opening already span a broad, overlapping Y range there (see
plan.md, "Stock and fixture reconstruction"). Every dimension used here is either:
  - MEASURED  : taken directly from probe_measurements_20260927.json / the brief table
  - CHOSEN    : a planning decision made independently for this dry run (tab size,
                Y-band, pass layout) -- NOT copied from the prior agent's FCStd/macros
  - DERIVED   : arithmetic on the above

All numbers are printed with their provenance tag so plan.md can cite them.

No shapely available; geometry is done with plain rectangle unions and a small
raster grid (numpy only) used purely as a sanity cross-check on the analytic areas
and to render the diagram.
"""
import numpy as np
import json

# ---------------------------------------------------------------------------
# 1. Stock cross-section (perpendicular to the Y rotary axis)
# ---------------------------------------------------------------------------
# MEASURED: B0 outside stock at Y245, physical X faces ~137.85 and 201.95 (64.1 mm),
# side silhouette 36.3-36.4 mm in the other orientations (brief table).
# This matches the nominal CAD Stock_T8c_ExistingEnclosure bbox 64 x 36 mm closely
# enough to use as the section envelope for planning, NOT as a proven registration
# (the CAD Y placement/orientation is explicitly unregistered -- see plan.md WCS).
W = 64.1   # local "u" axis, mm  (B0/B180 face-to-face; MEASURED)
H = 36.4   # local "v" axis, mm  (B90/B270 face-to-face; MEASURED, using the upper
           # bound of the 36.3-36.4 mm silhouette so the model is not optimistic)
CUTTER_D = 6.0
R = CUTTER_D / 2.0   # 3 mm, MEASURED (operator-stated tool)

# Local section coordinates: u in [0, W] with u=0 the B90 face, u=W the B270 face;
# v in [0, H] with v=0 the B180 face, v=H the B0 face. This is a PLANNING frame for
# this script only -- it is not the machine or work frame (see plan.md WCS section).

# ---------------------------------------------------------------------------
# 2. Working Y-band -- CHOSEN independently for this dry run
# ---------------------------------------------------------------------------
# The existing (already-cut, prior work) grooves span:
#   B0   groove floor Z192.2 over Y254.0-259.0, rim breaks down starting ~Y253.0-253.5
#   B180 groove floor Z198.3 over Y254.0-258.0, rim breaks down ~Y253.5, closes ~Y258.5-259.0
# Y259.0-259.5 on the B0 side is EXPLICITLY unmeasured beyond an aborted scan
# ("do not extrapolate that edge"). The B180 floor itself only runs Y254.0-258.0
# (by Y259.0 the B-180 profile is already back up near rim height, Z204.6). So the
# band where BOTH B0 and B180 have measured, contact-confirmed FLOOR (i.e. an
# already-open channel, not a wall or an unmeasured transition) is the intersection
# Y254.0-258.0 (4 mm) -- narrower than the prior agent's Y251-261 axial-extent band
# and chosen here independently, from the raw per-station contacts, not copied.
Y_BAND_START = 254.0   # CHOSEN, exact overlap of measured B0 and B180 floor contacts
Y_BAND_END = 258.0      # CHOSEN, exact overlap of measured B0 and B180 floor contacts
Y_BAND_LEN = Y_BAND_END - Y_BAND_START

print(f"Working Y-band (machine Y, CHOSEN, contact-verified overlap): "
      f"{Y_BAND_START}-{Y_BAND_END} ({Y_BAND_LEN} mm)")
print(f"Cross-section envelope (planning frame): u 0-{W} mm, v 0-{H} mm "
      f"(MEASURED 64.1 x 36.4 mm stock)")
print()

# ---------------------------------------------------------------------------
# 3. Raster grid for sanity-checking areas and rendering
# ---------------------------------------------------------------------------
STEP = 0.1  # mm
us = np.arange(0, W + STEP, STEP)
vs = np.arange(0, H + STEP, STEP)
UU, VV = np.meshgrid(us, vs, indexing="ij")

def rect_mask(u0, u1, v0, v1):
    return (UU >= u0) & (UU <= u1) & (VV >= v0) & (VV <= v1)

def corner_fillet_correction(n_corners, radius=R):
    """Area removed from a square/rect internal corner by a round cutter tracing
    a concave (pocket-side) corner: a square of side `radius` minus the quarter
    circle the cutter can actually clear, i.e. the sliver the cutter CANNOT reach
    stays as material -- wait: the cutter cannot reach the sharp corner of the
    POCKET, so the pocket corner is rounded (radius R) and the tab's own corner,
    which sits exactly at that pocket corner, is correspondingly rounded off.
    Material removed from the ideal sharp tab, per concave corner:
        r^2 - (pi * r^2 / 4)   [square minus quarter disk]
    """
    return n_corners * (radius**2 - (np.pi * radius**2 / 4.0))

# ---------------------------------------------------------------------------
# 4. Variant A: four small corner tabs -- CHOSEN size
# ---------------------------------------------------------------------------
# Each tab is a square of side S at one of the four corners of the section.
# S is a planning choice: big enough that a 6 mm cutter can rough around it with a
# meaningful (not knife-edge) ligament, small enough that "most of the remaining
# neck material" is genuinely removed. S = 1.33x cutter diameter is used as a
# starting, bounded value (needs operator/strength sign-off -- see plan.md).
S_TAB = 8.0  # mm, CHOSEN

def four_tab_mask():
    m = np.zeros_like(UU, dtype=bool)
    m |= rect_mask(0, S_TAB, H - S_TAB, H)        # NW: B90 face + B0 face corner
    m |= rect_mask(W - S_TAB, W, H - S_TAB, H)    # NE: B270 face + B0 face corner
    m |= rect_mask(0, S_TAB, 0, S_TAB)            # SW: B90 face + B180 face corner
    m |= rect_mask(W - S_TAB, W, 0, S_TAB)        # SE: B270 face + B180 face corner
    return m

tab_mask = four_tab_mask()
tab_area_raster = tab_mask.sum() * STEP * STEP
tab_area_analytic = 4 * (S_TAB**2) - corner_fillet_correction(4)
print("== Variant A: four corner tabs (S=%.1f mm) ==" % S_TAB)
print(f"  analytic retained area (with cutter-radius fillet loss): {tab_area_analytic:.2f} mm^2")
print(f"  raster sanity check (sharp-corner, no fillet):            {tab_area_raster:.2f} mm^2")
print(f"  per-tab retained area (fillet-corrected):                 {tab_area_analytic/4:.2f} mm^2")
print(f"  per-tab ligament (min cross-section, this design is prismatic so "
      f"the ligament equals the retained area at every Y in the band): {tab_area_analytic/4:.2f} mm^2")
print(f"  section volume over {Y_BAND_LEN} mm band: {tab_area_analytic*Y_BAND_LEN:.1f} mm^3")
print(f"  number of separate connections: 4")
print(f"  each connection touches exactly 2 of the 4 cut faces (B0/B180 and B90/B270) -> "
      f"the corner itself was never engaged by any single face pass, so no extra "
      f"reach is required beyond each face's own programmed depth.")
print()

# ---------------------------------------------------------------------------
# 5. Variant B: two diagonal C / L brackets -- CHOSEN size
# ---------------------------------------------------------------------------
# Each bracket wraps ONE corner with two legs (along the two adjoining faces),
# CHOSEN longer than a plain tab so it "retains more wood in the corner" per the
# brief's framing, but there are only two of them (NW and SE, diagonal), so the
# stock stays balanced under the chuck rather than being held from one side only.
LEG = 16.0    # mm, leg length along each face from the corner, CHOSEN
THICK = 8.0   # mm, leg thickness (how far the leg reaches in from the face), CHOSEN
# THICK intentionally matches S_TAB so the two variants are compared at the same
# "how deep did we dare leave material" depth; LEG is the only extra parameter.

def l_bracket_mask(corner):
    """corner in {'NW','SE'}; returns mask of the L/C bracket at that corner."""
    m = np.zeros_like(UU, dtype=bool)
    if corner == "NW":
        # leg along B0 face (top, v in [H-THICK,H]), from B90 face (u=0) for LEG
        m |= rect_mask(0, LEG, H - THICK, H)
        # leg along B90 face (west, u in [0,THICK]), from B0 face (v=H) down for LEG
        m |= rect_mask(0, THICK, H - LEG, H)
    elif corner == "SE":
        m |= rect_mask(W - LEG, W, 0, THICK)
        m |= rect_mask(W - THICK, W, 0, LEG)
    return m

c_mask = l_bracket_mask("NW") | l_bracket_mask("SE")
c_area_raster = c_mask.sum() * STEP * STEP
# analytic: each bracket = 2 rects (LEG*THICK) minus their THICK*THICK overlap,
# then remove the fillet at the TWO concave (pocket-side) corners each bracket
# creates (one where its own two legs meet the surrounding cut, mirrored) --
# a bracket has 2 concave internal corners (at the inner ends of each leg) plus
# 1 convex internal corner where the two legs meet (no fillet loss there, it's
# material, not pocket). So 2 brackets x 2 concave corners = 4 fillet losses,
# same count as the four-tab variant, for a fair comparison.
bracket_area_each = 2 * (LEG * THICK) - THICK * THICK
c_area_analytic = 2 * bracket_area_each - corner_fillet_correction(4)
print("== Variant B: two diagonal C/L brackets (leg=%.1f mm, thickness=%.1f mm) ==" % (LEG, THICK))
print(f"  analytic retained area (with cutter-radius fillet loss): {c_area_analytic:.2f} mm^2")
print(f"  raster sanity check (sharp-corner, no fillet):            {c_area_raster:.2f} mm^2")
print(f"  per-bracket retained area (fillet-corrected):             {c_area_analytic/2:.2f} mm^2")
print(f"  per-bracket ligament (min cross-section along its narrower leg, THICK={THICK}mm "
      f"minus fillet on its 2 concave corners): {(LEG*THICK - corner_fillet_correction(2)):.2f} mm^2")
print(f"  section volume over {Y_BAND_LEN} mm band: {c_area_analytic*Y_BAND_LEN:.1f} mm^3")
print(f"  number of separate connections: 2")
print()

# ---------------------------------------------------------------------------
# 6. Comparison summary
# ---------------------------------------------------------------------------
stock_area = W * H
removed_A = stock_area - tab_area_analytic
removed_B = stock_area - c_area_analytic
print("== Comparison ==")
print(f"  full stock cross-section: {stock_area:.1f} mm^2")
print(f"  Variant A (4 tabs) retains {tab_area_analytic:.1f} mm^2 "
      f"({100*tab_area_analytic/stock_area:.1f}%), removes {removed_A:.1f} mm^2 "
      f"({100*removed_A/stock_area:.1f}%)")
print(f"  Variant B (2 brackets) retains {c_area_analytic:.1f} mm^2 "
      f"({100*c_area_analytic/stock_area:.1f}%), removes {removed_B:.1f} mm^2 "
      f"({100*removed_B/stock_area:.1f}%)")
print(f"  Variant A smallest single-connection area: {tab_area_analytic/4:.1f} mm^2 (x4 identical)")
print(f"  Variant B smallest single-connection area: {c_area_analytic/2:.1f} mm^2 (x2 identical)")
print(f"  Variant A total sawn perimeter (saw must cut through 4 posts): "
      f"~4 x {S_TAB:.1f}mm x2 cuts-ish (operator will make 1-2 straight saw passes "
      f"crossing all 4 posts if collinear, or 4 nibbles if not -- see plan.md)")
print(f"  Variant B: 2 posts, diagonal, likely needs 2 separate short saw cuts "
      f"but each cut removes more material per pass (bigger, blunter cross-section)")
print()

# ---------------------------------------------------------------------------
# 7. 3D connectivity sanity check (voxel BFS across the Y band into the full
#    body/tenon solids on either side) -- confirms the prismatic assumption
#    really does bridge two full-section solids, and that no unintended path
#    exists between the two ends other than through the declared connections.
# ---------------------------------------------------------------------------
def connectivity_check(section_mask, label):
    # Downsample raster for speed (BFS), still fine resolution (0.4mm)
    ds = 4
    m2 = section_mask[::ds, ::ds]
    ny_band = 6           # a handful of layers across the (prismatic) band
    ny_body = 3            # a few layers of full solid on each side
    full = np.ones_like(m2, dtype=bool)
    nx, nz = m2.shape
    ny_total = ny_body + ny_band + ny_body
    vol = np.zeros((nx, nz, ny_total), dtype=bool)
    for y in range(ny_total):
        if y < ny_body or y >= ny_body + ny_band:
            vol[:, :, y] = full          # body / tenon: full cross-section
        else:
            vol[:, :, y] = m2            # neck band: only the declared connections
    # BFS/flood-fill from one voxel in the body to see what it reaches
    from collections import deque
    visited = np.zeros_like(vol, dtype=bool)
    start = (nx // 2, nz // 2, 0)
    assert vol[start], "seed not solid"
    dq = deque([start])
    visited[start] = True
    neighbours = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
    while dq:
        x, z, y = dq.popleft()
        for dx, dz, dy in neighbours:
            nx_, nz_, ny_ = x + dx, z + dz, y + dy
            if 0 <= nx_ < nx and 0 <= nz_ < nz and 0 <= ny_ < ny_total:
                if vol[nx_, nz_, ny_] and not visited[nx_, nz_, ny_]:
                    visited[nx_, nz_, ny_] = True
                    dq.append((nx_, nz_, ny_))
    tenon_reached = visited[:, :, -1].any()
    body_voxels = int(vol[:, :, 0].sum())
    reached_body_voxels = int(visited[:, :, 0].sum())
    tenon_voxels = int(vol[:, :, -1].sum())
    reached_tenon_voxels = int(visited[:, :, -1].sum())
    print(f"  [{label}] body reached from itself: {reached_body_voxels}/{body_voxels} voxels")
    print(f"  [{label}] tenon reachable from body seed: {tenon_reached} "
          f"({reached_tenon_voxels}/{tenon_voxels} voxels)")
    # Also check the section mask itself is internally connected as expected
    # (n components at the mid-band layer)
    mid = m2
    visited2 = np.zeros_like(mid, dtype=bool)
    comps = 0
    for ix in range(nx):
        for iz in range(nz):
            if mid[ix, iz] and not visited2[ix, iz]:
                comps += 1
                dq2 = deque([(ix, iz)])
                visited2[ix, iz] = True
                while dq2:
                    x, z = dq2.popleft()
                    for dx, dz in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                        nx2, nz2 = x + dx, z + dz
                        if 0 <= nx2 < nx and 0 <= nz2 < nz and mid[nx2, nz2] and not visited2[nx2, nz2]:
                            visited2[nx2, nz2] = True
                            dq2.append((nx2, nz2))
    print(f"  [{label}] connected components in the neck cross-section itself: {comps}")
    return tenon_reached, comps

print("== 3D voxel connectivity check (body -> neck band -> tenon) ==")
tA, compsA = connectivity_check(tab_mask, "Variant A (4 tabs)")
tB, compsB = connectivity_check(c_mask, "Variant B (2 brackets)")
print()
print(f"RESULT: Variant A bridges body-to-tenon: {tA}, with {compsA} separate "
      f"cross-section islands (expect 4)")
print(f"RESULT: Variant B bridges body-to-tenon: {tB}, with {compsB} separate "
      f"cross-section islands (expect 2)")

# Save numeric results for the report
results = {
    "stock_W_mm": W, "stock_H_mm": H, "cutter_diam_mm": CUTTER_D,
    "y_band_start": Y_BAND_START, "y_band_end": Y_BAND_END,
    "variant_A_four_tabs": {
        "tab_side_mm": S_TAB,
        "retained_area_mm2": tab_area_analytic,
        "per_tab_area_mm2": tab_area_analytic / 4,
        "n_connections": 4,
        "components_check": compsA,
        "bridges_body_to_tenon": bool(tA),
    },
    "variant_B_two_brackets": {
        "leg_mm": LEG, "thickness_mm": THICK,
        "retained_area_mm2": c_area_analytic,
        "per_bracket_area_mm2": c_area_analytic / 2,
        "n_connections": 2,
        "components_check": compsB,
        "bridges_body_to_tenon": bool(tB),
    },
    "stock_area_mm2": stock_area,
}
with open("neck_cross_section_results.json", "w") as f:
    json.dump(results, f, indent=2)
print("\nWrote neck_cross_section_results.json")

# ---------------------------------------------------------------------------
# 8. Render a simple diagram (PNG via raw PPM->PNG is heavy without libs; use
#    matplotlib if present, else fall back to a hand-written SVG in the report
#    script). This block only prints masks for optional matplotlib use.
# ---------------------------------------------------------------------------
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(1, 2, figsize=(10, 5))
    for ax, mask, title in [
        (axes[0], tab_mask, f"Variant A: four corner tabs (S={S_TAB}mm)\nretained {tab_area_analytic:.0f} mm^2"),
        (axes[1], c_mask, f"Variant B: two diagonal C-brackets (leg={LEG},t={THICK}mm)\nretained {c_area_analytic:.0f} mm^2"),
    ]:
        ax.imshow(mask.T, origin="lower", extent=[0, W, 0, H], cmap="Oranges")
        ax.set_title(title, fontsize=9)
        ax.set_xlabel("u (B90=0 .. B270=%.1f)" % W)
        ax.set_ylabel("v (B180=0 .. B0=%.1f)" % H)
        ax.set_aspect("equal")
    plt.tight_layout()
    plt.savefig("cross_section_variants.png", dpi=150)
    print("Wrote cross_section_variants.png")
except Exception as e:
    print(f"(matplotlib not available or failed: {e}; diagram will be hand-written SVG instead)")
