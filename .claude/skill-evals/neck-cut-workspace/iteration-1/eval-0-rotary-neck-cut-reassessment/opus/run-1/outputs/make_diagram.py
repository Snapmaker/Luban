"""Diagram of the retained connections, drawn from neck_sweep_results.json (FreeCAD B-rep sections).
Run: python make_diagram.py  ->  neck_tabs_diagram.svg / .png
"""
import json, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Rectangle

HERE = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(HERE, "neck_sweep_results.json")))
F = R["frames"]
HU, HV = F["HU"], F["HV"]
UCX, VCZ = F["UC_machineX"], F["VC_physZ"]
MID = "%.2f" % F["YT_machine"]
EDGE = "%.2f" % (F["YT_machine"] - 2.9)

fig = plt.figure(figsize=(15, 11))
gs = fig.add_gridspec(3, 2, height_ratios=[1.05, 1.05, 0.9], hspace=0.42, wspace=0.16)

def outline(ax):
    ax.add_patch(Rectangle((-HU, -HV), 2 * HU, 2 * HV, fill=False, ls="--", lw=1, ec="0.45"))
    ax.set_xlim(-37, 37); ax.set_ylim(-19.5, 19.5); ax.set_aspect("equal")
    ax.axhline(0, color="0.85", lw=0.6); ax.axvline(0, color="0.85", lw=0.6)
    ax.set_xlabel("u (mm)  = machine X at B0 - %.2f" % UCX)
    ax.set_ylabel("v (mm) = physical Z at B0 - %.2f" % VCZ)

def fill(ax, polys, color, alpha=0.85):
    for pts in polys:
        ax.add_patch(Polygon(pts, closed=True, fc=color, ec="k", lw=0.8, alpha=alpha))

def removal_bands(ax, variant):
    # cut regions at mid-kerf (from the setup specs used in neck_sweep_model.py)
    a, b, t, w = 6.0, 4.0, 5.0, 3.0
    ax.add_patch(Rectangle((-(HU - a), t / 2), 2 * (HU - a), HV - t / 2, fc="#9ecae1", ec="none", alpha=0.45))
    ax.add_patch(Rectangle((-(HU - a), -HV), 2 * (HU - a), HV - t / 2, fc="#fdae6b", ec="none", alpha=0.45))
    ax.add_patch(Rectangle((HU - (a - w), -(HV - b)), a - w, 2 * (HV - b), fc="#a1d99b", ec="none", alpha=0.5))
    ax.add_patch(Rectangle((-HU, -(HV - b)), a - w, 2 * (HV - b), fc="#bcbddc", ec="none", alpha=0.5))
    if variant == "T4":
        ax.add_patch(Rectangle((HU - a - 3.5, -(HV - b)), 6.5, 2 * (HV - b), fc="#31a354", ec="none", alpha=0.35))
        ax.add_patch(Rectangle((-(HU - (a - w)), -(HV - b)), 6.5, 2 * (HV - b), fc="#756bb1", ec="none", alpha=0.35))
    ax.add_patch(Rectangle((-(HU - a), -t / 2), 2 * (HU - a), t, fc="#e7e7e7", ec="0.3", ls=":", lw=0.8, alpha=0.8))

# (a) T4 mid-kerf
ax = fig.add_subplot(gs[0, 0]); outline(ax); removal_bands(ax, "T4")
fill(ax, R["polygons"]["T4"][MID], "#8c510a")
ax.set_title("RECOMMENDED  T4: four corner tabs at mid-kerf (machine Y%s, B0 view)\n4 separate solids span the whole kerf (3D check); 96.0 mm$^2$ left to saw" % MID, fontsize=10)
labels = [(-29.05, 8.5, "TAB 1\n6.0 x 4.0\n24 mm$^2$"), (29.05, 8.5, "TAB 2\n6.0 x 4.0\n24 mm$^2$"),
          (-29.05, -8.5, "TAB 3\n6.0 x 4.0\n24 mm$^2$"), (29.05, -8.5, "TAB 4\n6.0 x 4.0\n24 mm$^2$")]
for x, y, s in labels:
    ax.annotate(s, (x, y), xytext=(x * 0.55, 11.6 if y > 0 else -11.6), fontsize=7.5, ha="center", va="bottom" if y > 0 else "top",
                arrowprops=dict(arrowstyle="->", lw=0.7), bbox=dict(fc="white", ec="0.6", lw=0.5))
ax.text(0, 7.0, "S1 R1-B0 band (tool from top)", ha="center", fontsize=7)
ax.text(0, -7.5, "S2 R1-B180 band (tool from bottom)", ha="center", fontsize=7)
ax.text(0, 0, "S7 R2-B0 web break (last cut)", ha="center", va="center", fontsize=7)
ax.text(31.0, 0, "S3 / S6\nB90", ha="center", va="center", fontsize=6.5, rotation=90)
ax.text(-31.0, 0, "S4 / S5\nB270", ha="center", va="center", fontsize=6.5, rotation=90)

# (b) C2 mid-kerf
ax = fig.add_subplot(gs[0, 1]); outline(ax); removal_bands(ax, "C2")
fill(ax, R["polygons"]["C2"][MID], "#bf812d")
ax.set_title("ALTERNATIVE  C2: two C-shaped connections at mid-kerf (Y%s)\n2 solids span the kerf; 174.2 mm$^2$ left to saw (+81 %%)" % MID, fontsize=10)
for x, s in [(-28.0, "C 1: 6.0 x 21.05, spine 3.0 (5.1 at kerf edge), arms 6.0 x 4.0 | 87.1 mm$^2$"),
             (28.0, "C 2: mirror\nspine 3.0 | 87.1 mm$^2$")]:
    ax.annotate(s, (x + (1.5 if x < 0 else -1.5), 0), xytext=(x * 0.3, 15.0 if x < 0 else -15.5), fontsize=7.5, ha="center",
                arrowprops=dict(arrowstyle="->", lw=0.7), bbox=dict(fc="white", ec="0.6", lw=0.5))

# (c) T4naive near kerf edge: the mid-plane trap
ax = fig.add_subplot(gs[1, 0]); outline(ax)
fill(ax, R["polygons"]["T4naive"][MID], "#dfc27d", alpha=0.5)
fill(ax, R["polygons"]["T4naive"][EDGE], "#d73027", alpha=0.75)
ax.set_title("TRAP: spine-notch depth taken from the mid-plane (tip u=+-25.55, not +-22.55)\nmid-plane: 4 tabs (tan); at Y%s (red) each side is one piece -> only 2 solids in 3D" % EDGE, fontsize=9)
ax.text(0, 0, "flat-end sweep ends are R3 in the u-Y and v-Y planes:\nthe band end retreats 3 mm toward the kerf edges,\nso the spine notch must reach 3.5 mm past the\nmid-plane band edge to separate the corners", ha="center", va="center", fontsize=7.5,
        bbox=dict(fc="white", ec="0.6", lw=0.5))

# (d) T4 near kerf edge (flare)
ax = fig.add_subplot(gs[1, 1]); outline(ax)
fill(ax, R["polygons"]["T4"][EDGE], "#8c510a", alpha=0.55)
fill(ax, R["polygons"]["T4"][MID], "#543005", alpha=0.9)
ax.set_title("T4 tab flare: dark = mid-kerf Y%s (6.0 x 4.0, smallest ligament = saw plane)\nlight = Y%s near the kerf edge (up to 8.45 x 6.45); blue dotted = CAD side walls (H1)" % (MID, EDGE), fontsize=9)
ax.text(0, 0, "enclosure CAD (H1, inferred): 4 mm side walls at |u|>=28,\nbackplate/ledge below v=-6.4; top tabs 67 % backed by wall,\nbottom tabs 99 %, C footprints 62 %", ha="center", va="center", fontsize=7.5,
        bbox=dict(fc="white", ec="0.6", lw=0.5))
for s in (-1, 1):
    ax.add_patch(Rectangle((s * 28.0 if s > 0 else -32.05, -HV), 4.05, 2 * HV, fill=False, ec="#2166ac", ls=":", lw=1.1))

# (e) area vs Y
ax = fig.add_subplot(gs[2, :])
colors = {"R1": "#4d4d4d", "C2": "#bf812d", "T4": "#8c510a", "T4naive": "#d73027"}
names = {"R1": "after round 1 (continuous web)", "C2": "C2 final", "T4": "T4 final (recommended)", "T4naive": "T4 with mid-plane notch depth (wrong)"}
for var in ["R1", "C2", "T4", "T4naive"]:
    sec = R[var]["sections"]
    ys = sorted(float(k) for k in sec)
    areas = [sum(p["area"] for p in sec["%.2f" % y]) for y in ys]
    n = [len(sec["%.2f" % y]) for y in ys]
    ax.plot(ys, areas, "-o", color=colors[var], ms=3.5, label="%s: %d solid(s) in 3D" % (names[var], R[var]["kerf_components"]))
    for y, a, k in zip(ys, areas, n):
        if var in ("T4naive",) and k != 4:
            ax.annotate(str(k), (y, a), textcoords="offset points", xytext=(0, 6), fontsize=7, color=colors[var], ha="center")
ax.axvspan(252.15, 253.30, color="#c7e9c0", alpha=0.5); ax.axvspan(259.30, 260.30, color="#fee0b6", alpha=0.6)
ax.axvline(float(MID), color="k", lw=0.8, ls="--")
ax.text(252.72, 480, "enclosure-side\nskin (uncut)", ha="center", fontsize=7.5)
ax.text(259.8, 480, "tenon-side\nskin", ha="center", fontsize=7.5)
ax.text(float(MID) + 0.08, 30, "saw plane Y%s" % MID, fontsize=7.5)
ax.set_xlim(252.0, 260.5); ax.set_ylim(0, 560)
ax.set_xlabel("machine Y (mm): kerf of the 6 mm cutter at track Y%s = Y253.30..259.30; enclosure face Y252.15 (measured)" % MID)
ax.set_ylabel("retained section area (mm$^2$)")
ax.legend(fontsize=8, loc="center", bbox_to_anchor=(0.5, 0.62), ncol=2)
ax.set_title("Retained area and connected-solid count along the kerf (B-rep sections every 0.5 mm; original neck 64.10 x 21.05 = 1349 mm$^2$)", fontsize=10)
fig.suptitle("Rotary enclosure neck: retained connections from actual 6 mm flat-endmill sweeps (dry-run model, not a released CAM job)", fontsize=12)
for ext in ("svg", "png"):
    fig.savefig(os.path.join(HERE, "neck_tabs_diagram." + ext), dpi=130, bbox_inches="tight")
print("written")
