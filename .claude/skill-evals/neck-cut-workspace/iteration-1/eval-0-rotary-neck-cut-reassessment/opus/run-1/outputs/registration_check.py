"""Rotary-axis / stock registration from the 26-27 Sep evidence (no live data).

All inputs are MACHINE coordinates copied from the snapshot evidence. Contact Z values are TOOLHEAD Z
with the touch probe (stored effective length 70.95 mm); physical Z = contact - 70.95. Side contacts
are probe tip-centre X; physical faces lie one tip radius (1.25 mm) outside the tip centre.
Assumes a rigid rectangular section and exact 90-degree indexing; the residuals test that assumption.
Run: python registration_check.py
"""
L, RT = 70.95, 1.25
# B0 X faces at Y245 (physical, from 4a426e131af8 and earlier outline)
x0_w, x0_e = 137.85, 201.95
# tops (toolhead contact)
top_b0, top_b180 = 201.3, 204.5          # B0 X195/Y250 ; B-180 X198/Y245-250
floor_b0, floor_b180 = 192.2, 198.3      # groove floors (B0 X195 Y254-259 ; B-180 X198 Y254-258)
# side silhouettes, tip centres at toolhead Z213 (job 97ff89e230a5)
b90 = {"y245": (151.5, 190.4), "y256": (160.5, 184.3)}
b270 = {"y245": (148.3, 187.1), "y256": (154.3, 178.1)}
stored = (170.1, 112.4)                   # stored rotary axis X, PHYSICAL Z (estimate)

W = x0_e - x0_w
T90 = (b90["y245"][1] - b90["y245"][0]) - 2 * RT
T270 = (b270["y245"][1] - b270["y245"][0]) - 2 * RT
T = (T90 + T270) / 2
c90 = sum(b90["y245"]) / 2
c270 = sum(b270["y245"]) / 2
Ax = (c90 + c270) / 2
e_side = (c90 - c270) / 2
Az_contact = (top_b0 + top_b180 - T) / 2          # toolhead Z at which the probe tip is at axis height
Az = Az_contact - L
cz_b0 = (top_b0 - L) - T / 2                       # thickness centre at B0 (physical)
e_top = Az - cz_b0
f = (x0_w + x0_e) / 2 - Ax                          # width-centre offset at B0

out = []
p = out.append
p("W (B0 X width, physical) = %.2f   T (B90/B270 widths, tip-corrected) = %.2f / %.2f -> %.2f" % (W, T90, T270, T))
p("Derived axis X = %.3f  (mid of B90/B270 thickness centres %.2f / %.2f)" % (Ax, c90, c270))
p("Derived axis Z: toolhead-contact equivalent %.3f ; physical %.3f (with L=%.2f)" % (Az_contact, Az, L))
p("Thickness-centre offset from axis: from B0/B180 tops %.3f ; from B90/B270 centres %.3f  (independent agreement check)" % (e_top, e_side))
p("Width-centre offset at B0 f = %.3f" % f)
p("Stored axis (%.1f, %.1f) differs by dX %+.2f, dZ %+.2f" % (stored[0], stored[1], stored[0] - Ax, stored[1] - Az))

def model(ax, az):
    zt = top_b0 - L; zb = zt - T                  # B0 top/bottom physical
    pred = {}
    # B90: +Z -> -X, +X -> +Z
    pred["B90 faces Y245"] = (ax - (zt - az), ax - (zb - az))
    pred["B270 faces Y245"] = (ax + (zb - az), ax + (zt - az))
    pred["B180 top (phys)"] = 2 * az - zb
    pred["B90 top (phys)"] = az + (x0_e - ax)
    pred["B270 top (phys)"] = az - (x0_w - ax)
    fb0 = floor_b0 - L; fb180 = 2 * az - (floor_b180 - L)
    pred["B90 faces Y256"] = (ax - (fb0 - az), ax - (fb180 - az))
    pred["B270 faces Y256"] = (ax + (fb180 - az), ax + (fb0 - az))
    return pred

meas = {"B90 faces Y245": (b90["y245"][0] + RT, b90["y245"][1] - RT),
        "B270 faces Y245": (b270["y245"][0] + RT, b270["y245"][1] - RT),
        "B180 top (phys)": top_b180 - L,
        "B90 faces Y256": (b90["y256"][0] + RT, b90["y256"][1] - RT),
        "B270 faces Y256": (b270["y256"][0] + RT, b270["y256"][1] - RT)}
for label, (ax, az) in [("DERIVED", (Ax, Az)), ("STORED", stored)]:
    pr = model(ax, az)
    p("--- model with %s axis X%.2f Zphys%.2f ---" % (label, ax, az))
    for k, v in pr.items():
        m = meas.get(k)
        if m is None:
            p("  %-18s predicted %s  (not measured in the evidence; M1 measures it)" % (k, v if not isinstance(v, tuple) else tuple(round(a, 2) for a in v)))
        elif isinstance(v, tuple):
            p("  %-18s predicted (%.2f, %.2f)  measured (%.2f, %.2f)  residual (%+.2f, %+.2f)" % (k, v[0], v[1], m[0], m[1], m[0] - v[0], m[1] - v[1]))
        else:
            p("  %-18s predicted %.2f  measured %.2f  residual %+.2f" % (k, v, m, m - v))
# groove floors seen in the B0 frame
p("B0 groove floor physical (direct) %.2f ; B-180 floor in B0 frame %.2f -> neck height %.2f" % (floor_b0 - L, 2 * Az - (floor_b180 - L), (floor_b0 - L) - (2 * Az - (floor_b180 - L))))
# CAM error if the stored axis is used: cut shift in stock coords (R^-1 - I) delta
dx, dz = stored[0] - Ax, stored[1] - Az
p("Cut displacement in stock (u,v) if CAM rotates about the STORED axis: B180 (%+.2f, %+.2f)  B90 (%+.2f, %+.2f)  B270 (%+.2f, %+.2f)" % (
    -2 * dx, -2 * dz, dz - dx, -dx - dz, -dz - dx, dx - dz))
# old G54 vs CAD (inferred registration)
g54 = (169.953, 133.632, 208.5)
p("Old G54 X %.3f -> CAD X+-32 faces at %.3f / %.3f vs measured %.2f / %.2f" % (g54[0], g54[0] - 32, g54[0] + 32, x0_w, x0_e))
p("Old G54 Y %.3f + CAD length 119 = %.3f vs measured enclosure-side groove wall 252.15 (B0 X195, at depth)" % (g54[1], g54[1] + 119))
p("Old G54 Z %.1f is a TOOLHEAD Z for an unknown tool; with the probe the B0 rim reads work Z %.1f" % (g54[2], top_b0 - g54[2]))
# proposed WCS numbers
p("PROPOSED G54 (probe fitted): origin_machine x=%.2f y=252.15 z=%.2f (toolhead Z of the probe with its tip at axis height)" % (Ax, Az_contact))
p("Predicted probe readings in that G54 (work = machine - origin):  B0 rim X195/Y250 Z %+.3f ; B0 +X face %+.2f ; B90 top Z %+.2f ; B270 top Z %+.2f" % (
    top_b0 - Az_contact, x0_e - Ax, (x0_e - Ax - f) + f, Ax - x0_w))
print("\n".join(out))
open(__file__.replace(".py", "_output.txt"), "w").write("\n".join(out) + "\n")
