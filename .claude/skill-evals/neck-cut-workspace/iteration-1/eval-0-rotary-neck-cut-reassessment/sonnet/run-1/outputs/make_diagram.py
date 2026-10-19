"""Diagram of the recommended two-C-rib variant (with the four-corner-tab alternative alongside
for comparison), built from the same parameters and rounded-rect cutter-sweep model as
neck_sweep_check.py. Saves neck_cut_connections.png into this outputs directory."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import numpy as np

from neck_sweep_check import (X_OUT, Z_OUT, TOP_DEPTH, BOT_DEPTH, W1, TX, TZ, H, CUTTER_R,
                               Y_BAND0, Y_BAND1)

X_HALF, Z_HALF = X_OUT / 2.0, Z_OUT / 2.0
L = Y_BAND1 - Y_BAND0

fig = plt.figure(figsize=(13, 8.5))
gs = fig.add_gridspec(2, 2, height_ratios=[1.15, 1], width_ratios=[1.3, 1])

# ---------------------------------------------------------------- Panel A: X-Z cross-section, recommended (two-C)
axA = fig.add_subplot(gs[0, 0])
axA.set_title("RECOMMENDED: two C-shaped ribs\nX-Z cross-section, any Y in 253.75-258.75 (uniform along the band)",
               fontsize=11)

# original outside stock (dashed, for reference)
axA.add_patch(mpatches.Rectangle((-X_HALF, -Z_HALF), X_OUT, Z_OUT, fill=False, ls="--", ec="0.6", lw=1))
axA.text(0, Z_HALF + 1.2, "original outside stock 64.1 x 36.4 mm (probed, Y245)", ha="center", fontsize=8, color="0.5")

# round-1 intermediate web outline
axA.add_patch(mpatches.Rectangle((-W1/2, -H/2), W1, H, fill=False, ls=":", ec="0.3", lw=1.3))
axA.text(0, -H/2 - 2.0, f"round-1 intermediate web: {W1:.0f} x {H:.2f} mm", ha="center", fontsize=8, color="0.35")

# the two C ribs (retained material)
for sign, label in [(-1, "C-left"), (1, "C-right")]:
    x0 = sign * (W1/2 - TX) if sign > 0 else -W1/2
    x1 = sign * W1/2 if sign > 0 else -(W1/2 - TX)
    rib = FancyBboxPatch((x0, -H/2), TX, H, boxstyle="round,pad=0,rounding_size=%.2f" % CUTTER_R,
                          fc="#8a5a2b", ec="k", lw=1.2)
    axA.add_patch(rib)
    cx = sign * (W1/2 - TX/2)
    axA.text(cx, 0, label, ha="center", va="center", fontsize=10, color="white", fontweight="bold",
              rotation=90)

# removed centre pocket, shaded
axA.add_patch(mpatches.Rectangle((-(W1/2 - TX), -H/2), 2*(W1/2 - TX), H, fc="#dddddd", ec="none", zorder=0))
axA.text(0, 0, "removed\n(B0+B180\ncentre pocket)", ha="center", va="center", fontsize=8, color="0.4")

axA.annotate("", xy=(-W1/2-1.5, -H/2), xytext=(-W1/2-1.5, H/2),
             arrowprops=dict(arrowstyle="<->"))
axA.text(-W1/2-2.7, 0, f"H={H:.2f}", ha="center", va="center", fontsize=8, rotation=90)
axA.annotate("", xy=(-W1/2, H/2+3.0), xytext=(-(W1/2-TX), H/2+3.0), arrowprops=dict(arrowstyle="<->"))
axA.text(-(W1/2-TX/2), H/2+3.8, f"TX={TX:.0f}", ha="center", fontsize=8)

axA.set_xlim(-40, 40); axA.set_ylim(-26, 26)
axA.set_aspect("equal"); axA.set_xlabel("local X (B0 width), mm"); axA.set_ylabel("local Z (B0 height), mm")

# ---------------------------------------------------------------- Panel B: alternative four-tab, smaller
axB = fig.add_subplot(gs[0, 1])
axB.set_title("Alternative: four corner tabs\n(same X-Z cross-section, uniform along the band)", fontsize=11)
axB.add_patch(mpatches.Rectangle((-W1/2, -H/2), W1, H, fill=False, ls=":", ec="0.3", lw=1))
gap_z0, gap_z1 = -(H/2 - TZ), (H/2 - TZ)
for sx in (-1, 1):
    x0 = sx * (W1/2 - TX) if sx > 0 else -W1/2
    for sz, zlabel in [(-1, "B"), (1, "T")]:
        z0 = 0 if sz > 0 else -H/2
        z1 = H/2 if sz > 0 else 0
        z0b = gap_z1 if sz > 0 else -H/2
        z1b = H/2 if sz > 0 else gap_z0
        tab = FancyBboxPatch((x0, z0b), TX, TZ, boxstyle="round,pad=0,rounding_size=%.2f" % min(CUTTER_R, TZ/2),
                              fc="#8a5a2b", ec="k", lw=1.0)
        axB.add_patch(tab)
        axB.text(x0 + TX/2, (z0b + z0b+TZ)/2, f"{'TL' if sx<0 and sz>0 else 'TR' if sz>0 else 'BL' if sx<0 else 'BR'}",
                  ha="center", va="center", fontsize=8, color="white", fontweight="bold")
axB.add_patch(mpatches.Rectangle((-(W1/2 - TX), -H/2), 2*(W1/2 - TX), H, fc="#dddddd", ec="none", zorder=0))
axB.add_patch(mpatches.Rectangle((-(W1/2), gap_z0), TX, gap_z1-gap_z0, fc="#dddddd", ec="none", zorder=0))
axB.add_patch(mpatches.Rectangle(((W1/2-TX), gap_z0), TX, gap_z1-gap_z0, fc="#dddddd", ec="none", zorder=0))
axB.set_xlim(-22, 22); axB.set_ylim(-16, 16)
axB.set_aspect("equal"); axB.set_xlabel("local X, mm"); axB.set_ylabel("local Z, mm")

# ---------------------------------------------------------------- Panel C: axial (Y) elevation of recommended, one rib
axC = fig.add_subplot(gs[1, 0])
axC.set_title("C-left rib, axial (Y) elevation at X=-9", fontsize=10)
axC.add_patch(mpatches.Rectangle((Y_BAND0-3, -H/2), L+6, H, fc="#eee", ec="0.5", lw=0.8))
axC.add_patch(mpatches.Rectangle((Y_BAND0, -H/2), L, H, fc="#8a5a2b", ec="k", lw=1.2))
axC.text((Y_BAND0+Y_BAND1)/2, 0, "C-rib solid,\nfull H, spans the\nwhole jointly-confirmed band",
          ha="center", va="center", fontsize=8, color="white")
axC.axvline(Y_BAND0, color="k", ls="--", lw=0.7)
axC.axvline(Y_BAND1, color="k", ls="--", lw=0.7)
axC.text(Y_BAND0, H/2+2, "Y253.75\n(B0+B180 grooves\nboth confirmed from here)", fontsize=7, ha="center")
axC.text(Y_BAND1, H/2+2, "Y258.75\n(B180 confirmed solid\nagain beyond here)", fontsize=7, ha="center")
axC.text(Y_BAND1+4, 0, "Y259.0+ :\nB0 groove far edge\nUNMEASURED (scan\naborted) -- do not\nextrapolate", fontsize=7,
          color="firebrick", va="center")
axC.set_xlim(248, 268); axC.set_ylim(-16, 16)
axC.set_xlabel("machine Y, mm"); axC.set_ylabel("local Z, mm")

# ---------------------------------------------------------------- Panel D: text summary
axD = fig.add_subplot(gs[1, 1]); axD.axis("off")
lines = [
    "Independently modelled (rounded-rect 6 mm cutter sweep, 3D voxel connectivity check;",
    "script: neck_sweep_check.py). NOT the prior agent's tab dimensions.",
    "",
    f"Neck band used (both grooves jointly confirmed): Y{Y_BAND0}-{Y_BAND1} ({L:.1f} mm) -- SHORTER",
    "than the prior agent's assumed 10 mm; the B0 groove's far edge (Y>259) is unmeasured.",
    f"Web height H = {H:.2f} mm  (36.4 - {TOP_DEPTH:.2f} top - {BOT_DEPTH:.2f} bottom groove depth)",
    f"Round-1 intermediate width W1 = {W1:.0f} mm (64.1 mm less {(X_OUT-W1)/2:.2f} mm/side from B90/B270)",
    "",
    "TWO C-RIBS (recommended):",
    f"  2 components, EACH independently spans the full band (verified by 3D connected-",
    f"  component labelling, not a single mid-plane slice).",
    f"  each rib {TX:.0f} x {H:.2f} mm = ~168 mm2; total retained cross-section ~336 mm2.",
    "  2 finishing setups only (B0Finish, B180Finish) -- B90/B270 not revisited in round 2.",
    "",
    "FOUR CORNER TABS (alternative):",
    f"  4 components, EACH independently spans the full band.",
    f"  each tab {TX:.0f} x {TZ:.0f} mm = 48 mm2; total retained cross-section ~192 mm2 (~43% less",
    "  to saw than the C-rib design) but 4 finishing setups (all of B0/B90/B180/B270 revisited)",
    "  and each post is a slender, independently deflecting stub -- more registration/runout-",
    "  sensitive, and a wood post that small is more prone to short-grain snap-off before the saw.",
    "",
    "Recommendation: two C-ribs, for machining stability (2 vs 4 finishing setups, thicker/",
    "stiffer retained sections) even though it leaves ~75% more material for the final saw cut --",
    "area alone is not the deciding factor here (per the brief).",
]
axD.text(0, 1, "\n".join(lines), va="top", fontsize=8.3, family="monospace")

fig.suptitle("Neck-cut retained-connection comparison -- independent reassessment (2026-09-28 dry run)",
             fontsize=12, y=0.995)
fig.tight_layout(rect=[0, 0, 1, 0.97])
fig.savefig("neck_cut_connections.png", dpi=160)
print("wrote neck_cut_connections.png")
