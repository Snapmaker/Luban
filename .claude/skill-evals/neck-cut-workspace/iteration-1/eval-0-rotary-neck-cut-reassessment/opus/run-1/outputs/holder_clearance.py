"""Tool/holder reach and clearance requirements per indexed setup (analytic, from the sweep model).

Frame: W (work frame proposal). Z values are PHYSICAL cutter-tip heights relative to the derived rotary
axis (physical Z113.78). Machine toolhead Z for any cutter = physical Z + that cutter's measured
setter-derived length; that conversion is done by the controller through G54 after the tool-length
transfer, never by hand. Obstacle tops marked INFERRED or UNKNOWN must be measured (plan M2/M4).
Run: python holder_clearance.py
"""
AZ = 113.78
setups = [  # name, B, deepest tip Z_w, material entry face Z_w, engaged-slot top Z_w (tool length inside a tool-width slot)
    ("S1 R1-B0 band", 0, -0.55, 7.47, 7.47),
    ("S2 R1-B180 band", 180, 5.55, 13.57, 13.57),
    ("S3 R1-B90 notch", 90, 29.62, 32.62, 32.62),
    ("S4 R1-B270 notch", 270, 28.48, 31.48, 31.48),
    ("S5 R2-B270 spine", 270, 21.98, 31.48, 31.48),
    ("S6 R2-B90 spine", 90, 23.12, 32.62, 32.62),
    ("S7 R2-B0 web", 0, -6.05, 7.47, 7.47),
]
# highest surface under the collet-nut footprint (Y252.15..~268, i.e. kerf +/- <=12 mm; jaws start ~Y270.5)
nut_obst = {0: (22.27, "tenon top B0 (X195/Y263 contact 207.0 -> phys 136.05) MEASURED at one X"),
            180: (22.57, "tenon top B-180 (X198/Y259.5-263 207.2-207.5) MEASURED at one X"),
            90: (34.92, "tenon side at B90: raw-stock +X face ~X204.25 INFERRED (X205 contact / X210 miss)"),
            270: (34.58, "tenon side at B270: raw-stock -X face ~X134.75 INFERRED from 2026-09-02 outline")}
jaw_b0_x195 = 143.25 - AZ   # B0 X195 Y272-278 contact 214.2 (raw 214.2-70.95) MEASURED at one X, one B
MARGIN = 3.0
lines = []
p = lines.append
p("%-18s %4s %9s %9s %11s %11s %9s" % ("setup", "B", "tip Zw", "tipZ phys", "P_min(nut)", "P+Ln (jaw)", "in-slot"))
pmin_all = 0
for name, b, tip, face, slot_top in setups:
    top, why = nut_obst[b]
    pmin = top + MARGIN - tip
    pmin_all = max(pmin_all, pmin)
    jaw = (jaw_b0_x195 + MARGIN - tip) if b == 0 else float("nan")
    p("%-18s %4d %9.2f %9.2f %11.2f %11s %9.2f" % (name, b, tip, tip + AZ, pmin, ("%.2f" % jaw) if b == 0 else "UNKNOWN", slot_top - tip))
p("")
p("Collet-nut rule: fitted protrusion P (tip to nut face) >= %.1f mm (driven by S7, tenon top + %.0f mm)." % (pmin_all, MARGIN))
p("Flute rule: the deepest tool length inside a tool-width slot is %.1f mm (S7); cutting edge > 25 mm covers it." % max(s[4] - s[2] for s in setups))
p("Jaw rule (B0, X195 line only): P + L_nut >= %.1f mm if the nose/body footprint reaches Y>=270.5 at X195." % (jaw_b0_x195 + MARGIN + 6.05))
p("Chuck body / other jaws / other B: UNKNOWN -> plan M4 go/no-go marches; requirement for spindle bottom at S7:")
for R in (40, 45, 50, 55, 60):
    p("   if the chuck/jaw envelope radius about the axis is %d mm: P + L_nut(+nose) >= %.1f mm" % (R, R + MARGIN + 6.05))
p("Groove-wall clearance of the 6 mm cutter at track Y256.30 (kerf Y253.30-259.30):")
for label, ye, yt in [("B0 groove (X195)", 252.15, 260.25), ("B-180 groove (X198 at B-180)", 252.82, 259.6)]:
    p("   %-30s enclosure side %.2f mm, tenon side %.2f mm   (walls %s / %s, INFERRED from ball-model edges; M2 measures)" % (label, 253.30 - ye, yt - 259.30, ye, yt))
open(__file__.replace(".py", "_output.txt"), "w").write("\n".join(lines) + "\n")
print("\n".join(lines))
