# Neck-cut cutter-sweep model: exact B-rep booleans of 6 mm flat-endmill sweeps, 3D connectivity,
# sections, sensitivity, and a review FCStd with one group per indexed setup.
# Run headless:  FreeCADCmd.exe -c "exec(open(r'<this file>').read())"
#
# FRAMES (read before using any number):
#   W  = proposed work frame, stock in its B0 pose. Origin = DERIVED rotary axis (X169.33, physical Z113.78
#        with the 70.95 mm probe) at the MEASURED enclosure chuck-end face Y252.15. W Z is PHYSICAL height
#        relative to the axis (cutter tip), never machine toolhead Z.
#   u,v = neck-section coords: u = X_w - 0.57 (neck width centre, machine X169.90), v = Z_w + 3.05
#        (mid-height between the measured groove floors).
#   Setup pose at B=theta: stock rotated by R_y(-theta) about the W Y axis (+B turns +Z toward -X,
#        identified by the B90/B270 side-probe shifts).
import FreeCAD as App, Part, json, math, os
V = App.Vector
OUT = r"C:/dev/software/snapmaker/Luban/.claude/worktrees/pr-202-scenario-skills-eval-6e349c/.claude/skill-evals/neck-cut-workspace/iteration-1/eval-0-rotary-neck-cut-reassessment/opus/run-1/outputs"
CAD = r"C:/dev/software/snapmaker/Luban/.claude/worktrees/pr-202-scenario-skills-eval-6e349c/.claude/skill-evals/neck-cut-workspace/snapshot-1778779/docs/skills-evals/cnc-neck-cut-evidence/reference_enclosure_20260922.FCStd"

AX, AZ, Y0 = 169.33, 113.78, 252.15            # derived axis X / physical axis Z; measured face Y (machine)
NX0, NX1 = 137.85 - AX, 201.95 - AX              # neck X faces ASSUMED flush with the enclosure (measure M2)
NZ0, NZ1 = 100.21 - AZ, 121.25 - AZ              # B180 floor (via axis) / B0 floor (direct), physical
NY1 = 260.30 - Y0                                # tenon-side wall ~Y260.3 (bracketed, measure M2)
UC, VC = (NX0 + NX1) / 2, (NZ0 + NZ1) / 2
HU, HV = (NX1 - NX0) / 2, (NZ1 - NZ0) / 2
YT = 256.30 - Y0                                 # kerf track (machine Y256.30)
LC = 60.0                                        # cutter+shank length modelled (holder checked separately)
A_TAB, B_TAB, T_WEB, W_SPINE, OB = 6.0, 4.0, 5.0, 3.0, 0.5

def W_from_uv(u, v):
    return u + UC, v + VC

def sweep(tip0, tip1, d, r):
    d = V(d).normalize()
    c0 = Part.makeCylinder(r, LC, tip0, d)
    if (tip1 - tip0).Length < 1e-9:
        return c0
    c1 = Part.makeCylinder(r, LC, tip1, d)
    p = (tip1 - tip0).normalize()
    n = d.cross(p).normalize()
    poly = Part.makePolygon([tip0 + n * r, tip1 + n * r, tip1 - n * r, tip0 - n * r, tip0 + n * r])
    prism = Part.Face(poly).extrude(d * LC)
    return c0.fuse([c1, prism]).removeSplitter()

AXISDIR = {0: V(0, 0, 1), 180: V(0, 0, -1), 90: V(1, 0, 0), 270: V(-1, 0, 0)}

def setup_specs(variant):
    """Cut specs in the STOCK (B0-pose W) frame: (name, B, tip0(u,v), tip1(u,v))."""
    uc = HU - A_TAB - 3.0                 # band tool-centre half travel -> band edge at mid-kerf = HU - A_TAB
    vn = HV - B_TAB - 3.0                 # notch tool-centre half travel -> notch edge at mid-kerf = HV - B_TAB
    s = []
    s.append(("R1_B0_band", 0, (-uc, +T_WEB / 2), (uc, +T_WEB / 2)))
    s.append(("R1_B180_band", 180, (-uc, -T_WEB / 2), (uc, -T_WEB / 2)))
    s.append(("R1_B90_notch", 90, (HU - (A_TAB - W_SPINE), -vn), (HU - (A_TAB - W_SPINE), vn)))
    s.append(("R1_B270_notch", 270, (-(HU - (A_TAB - W_SPINE)), -vn), (-(HU - (A_TAB - W_SPINE)), vn)))
    if variant in ("T4", "T4naive"):
        deep = HU - A_TAB - 3.0 - OB if variant == "T4" else HU - A_TAB - OB
        s.append(("R2_B270_spine", 270, (-deep, -vn), (-deep, vn)))
        s.append(("R2_B90_spine", 90, (deep, -vn), (deep, vn)))
    if variant in ("T4", "T4naive", "C2"):
        s.append(("R2_B0_web", 0, (-uc, -T_WEB / 2 - OB), (uc, -T_WEB / 2 - OB)))
    return s

def shift_for(b, dx, dz):
    # cut displacement in stock coords when CAM assumes axis A_true+(dx,dz):  (R^-1 - I) delta
    return {0: (0.0, 0.0), 180: (-2 * dx, -2 * dz), 90: (dz - dx, -dx - dz), 270: (-dz - dx, dx - dz)}[b]

def build(variant, r=3.0, dax=0.0, daz=0.0, dy=0.0):
    neck = Part.makeBox(NX1 - NX0, NY1, NZ1 - NZ0, V(NX0, 0, NZ0))
    stages, sweeps = [], []
    cur = neck
    for name, b, t0, t1 in setup_specs(variant):
        sx, sz = shift_for(b, dax, daz)
        x0, z0 = W_from_uv(*t0); x1, z1 = W_from_uv(*t1)
        sw = sweep(V(x0 + sx, YT + dy, z0 + sz), V(x1 + sx, YT + dy, z1 + sz), AXISDIR[b], r)
        nxt = cur.cut(sw)
        stages.append((name, b, cur, sw, nxt, (x0, z0), (x1, z1)))
        cur = nxt
    return neck, cur, stages

def pieces_at(shape, y):
    thin = Part.makeBox(200, 0.01, 200, V(-100, y - 0.005, -100))
    c = shape.common(thin)
    out = []
    for s in c.Solids:
        bb = s.BoundBox
        out.append({"area": round(s.Volume / 0.01, 2), "u": [round(bb.XMin - UC, 2), round(bb.XMax - UC, 2)],
                    "v": [round(bb.ZMin - VC, 2), round(bb.ZMax - VC, 2)]})
    out.sort(key=lambda p: (p["u"][0], p["v"][0]))
    return out

def chord_u(shape, y, v):
    ln = Part.makeLine(V(-60, y, v + VC), V(60, y, v + VC))
    c = shape.common(ln)
    return sorted([round(abs(e.Vertexes[-1].Point.x - e.Vertexes[0].Point.x), 2) for e in c.Edges])

def chord_v(shape, y, u):
    ln = Part.makeLine(V(u + UC, y, -60), V(u + UC, y, 60))
    c = shape.common(ln)
    return sorted([round(abs(e.Vertexes[-1].Point.z - e.Vertexes[0].Point.z), 2) for e in c.Edges])

def analyse(variant, **kw):
    neck, fin, stages = build(variant, **kw)
    dy_ = kw.get("dy", 0.0)                       # the connectivity slab follows the (shifted) kerf
    ky0, ky1 = YT + dy_ - 3.0 + 0.05, YT + dy_ + 3.0 - 0.05
    slab = Part.makeBox(200, ky1 - ky0, 200, V(-100, ky0, -100))
    conn = fin.common(slab)
    comps = []
    for s in conn.Solids:
        bb = s.BoundBox
        comps.append({"volume": round(s.Volume, 1), "spans_kerf": bool(bb.YMin <= ky0 + 1e-3 and bb.YMax >= ky1 - 1e-3),
                      "u": [round(bb.XMin - UC, 2), round(bb.XMax - UC, 2)], "v": [round(bb.ZMin - VC, 2), round(bb.ZMax - VC, 2)]})
    ys = [ky0] + [y + dy_ for y in [1.5, 2.0, 2.5, 3.0, 3.5]] + [YT] + [y + dy_ for y in [4.8, 5.3, 5.8, 6.3, 6.8]] + [ky1]
    secs = {("%.2f" % (y + Y0)): pieces_at(fin, y) for y in ys}
    mid = secs["%.2f" % (YT + Y0)]
    removed = [{"setup": n, "B": b, "removed_mm3": round(a.Volume - c.Volume, 1), "sweep_in_kerf_region_mm3": round(sw.common(Part.makeBox(200, NY1, 200, V(-100, 0, -100))).Volume, 1)} for (n, b, a, sw, c, _, _) in stages]
    res = {"variant": variant, "params": kw, "whole_solids": len(fin.Solids), "kerf_components": len(comps),
           "components": comps, "mid_kerf_area_total": round(sum(p["area"] for p in mid), 2),
           "min_section_pieces": min(len(v) for v in secs.values()), "max_section_pieces": max(len(v) for v in secs.values()),
           "sections": secs, "removed_per_setup": removed, "connection_volume": round(sum(c["volume"] for c in comps), 1)}
    return res, fin, stages

results = {}
shapes = {}
for var in ["R1", "C2", "T4", "T4naive"]:
    res, fin, stages = analyse(var)
    results[var] = res
    shapes[var] = (fin, stages)
# ligament chords at mid-kerf
fT4 = shapes["T4"][0]; fC2 = shapes["C2"][0]
results["T4"]["mid_chords"] = {"u_at_v=+8.5": chord_u(fT4, YT, 8.5), "u_at_v=-8.5": chord_u(fT4, YT, -8.5),
                               "v_at_u=+29": chord_v(fT4, YT, 29.0), "v_at_u=-29": chord_v(fT4, YT, -29.0)}
results["C2"]["mid_chords"] = {"u_at_v=0 (spine)": chord_u(fC2, YT, 0.0), "u_at_v=+8.5": chord_u(fC2, YT, 8.5),
                               "v_at_u=+30.5 (outer)": chord_v(fC2, YT, 30.5), "v_at_u=+27.5 (spine)": chord_v(fC2, YT, 27.5)}
results["C2"]["edge_chords"] = {"u_at_v=0 near kerf edge": chord_u(fC2, 1.3, 0.0)}
results["T4"]["edge_chords"] = {"u_at_v=+8.5 near kerf edge": chord_u(fT4, 1.3, 8.5), "v_at_u=+29 near kerf edge": chord_v(fT4, 1.3, 29.0)}

# sensitivity
sens = []
cases = [("nominal", {}), ("stored axis used by CAM (170.1/112.4)", {"dax": 170.1 - AX, "daz": 112.4 - AZ}),
         ("axis +0.15/+0.15", {"dax": 0.15, "daz": 0.15}), ("axis -0.15/+0.15", {"dax": -0.15, "daz": 0.15}),
         ("runout: r_eff 3.10", {"r": 3.10}), ("runout: r_eff 3.25", {"r": 3.25}), ("track Y +0.5", {"dy": 0.5})]
for var in ["T4", "C2"]:
    for label, kw in cases:
        res, fin, _ = analyse(var, **kw)
        mid = res["sections"]["%.2f" % (YT + Y0)]
        dims = [(round(p["u"][1] - p["u"][0], 2), round(p["v"][1] - p["v"][0], 2), p["area"]) for p in mid]
        entry = {"variant": var, "case": label, "kerf_components": res["kerf_components"], "mid_pieces": len(mid),
                 "mid_area_total": res["mid_kerf_area_total"], "mid_piece_bbox_du_dv_area": dims}
        if var == "C2":
            entry["spine_chords_v0"] = chord_u(fin, YT, 0.0)
        else:
            entry["corner_v_chords"] = chord_v(fin, YT, 29.0) + chord_v(fin, YT, -29.0)
            entry["corner_u_chords"] = chord_u(fin, YT, 8.5) + chord_u(fin, YT, -8.5)
        sens.append(entry)
results["sensitivity"] = sens

# mid-kerf polygons for the diagram
def polys(shape, y):
    out = []
    for w in shape.slice(V(0, 1, 0), y):
        pts = w.discretize(Deflection=0.02)
        out.append([[round(p.x - UC, 3), round(p.z - VC, 3)] for p in pts])
    return out
results["polygons"] = {var: {("%.2f" % (y + Y0)): polys(shapes[var][0], y) for y in [YT, YT - 2.0, YT - 2.9]} for var in ["R1", "C2", "T4", "T4naive"]}

# load path: fraction of each mid-kerf tab/C footprint backed by enclosure wall material just behind the
# 3.5 mm end block (H1 registration: CAD Y119 -> W Y0, CAD X0 -> W X0.57, CAD Z0 -> W Z16.57)
cdoc = App.openDocument(CAD)
cad = cdoc.getObject("Stock_T8c_ExistingEnclosure").Shape.copy()
App.closeDocument(cdoc.Name)
cadH1 = cad.copy(); cadH1.translate(V(UC, -119.0, 130.35 - AZ))
cadH2 = cad.copy(); cadH2.rotate(V(0, 0, 0), V(0, 0, 1), 180); cadH2.translate(V(UC, 0.0, 130.35 - AZ))
back = {}
for var in ["T4", "C2"]:
    fin = shapes[var][0]
    thin = fin.common(Part.makeBox(200, 0.2, 200, V(-100, YT - 0.1, -100)))
    rows = []
    for s in thin.Solids:
        prism = s.copy(); prism.translate(V(0, -(YT - 0.1) - 5.0, 0))          # the footprint at W Y -5.0..-4.8 (CAD ~114)
        a = s.Volume / 0.2
        bh1 = prism.common(cadH1).Volume / 0.2
        bh2 = prism.common(cadH2).Volume / 0.2
        bb = s.BoundBox
        rows.append({"u": [round(bb.XMin - UC, 1), round(bb.XMax - UC, 1)], "v": [round(bb.ZMin - VC, 1), round(bb.ZMax - VC, 1)],
                     "area": round(a, 1), "backed_H1_at_CAD_Y114": round(bh1 / a, 2), "backed_H2": round(bh2 / a, 2)})
    back[var] = rows
results["load_path_backing"] = back
# interior clearance: nearest enclosure cavity (H1) to the kerf, along Y
results["kerf_to_enclosure_face_mm"] = round(YT - 3.0 - 0.0, 2)
results["frames"] = {"AX": AX, "AZ_phys": AZ, "Y0": Y0, "UC_machineX": AX + UC, "VC_physZ": AZ + VC, "HU": HU, "HV": HV, "YT_machine": YT + Y0}

# ---------------- review FCStd: one group per setup, in its B pose -----------------
def pose(shape, b):
    s = shape.copy(); s.rotate(V(0, 0, 0), V(0, 1, 0), -b); return s

def tip_path(name, b, t0, t1, cur_in):
    """Tip-centre polyline in the W frame at the setup pose: entry, zigzag stepdown levels, clean-up, exit."""
    (x0, z0), (x1, z1) = t0, t1
    P0 = pose(Part.Vertex(V(x0, YT, z0)), b).Point; P1 = pose(Part.Vertex(V(x1, YT, z1)), b).Point
    # entry surface = where material starts along the tool axis at this setup (from the stock-pose input)
    face = {"R1_B0_band": NZ1, "R2_B0_web": NZ1, "R1_B180_band": -NZ0, "R1_B90_notch": NX1, "R2_B90_spine": NX1,
            "R1_B270_notch": -NX0, "R2_B270_spine": -NX0}[name]
    start_mat = {"R2_B0_web": T_WEB / 2 + VC, "R2_B90_spine": HU - (A_TAB - W_SPINE) + UC,
                 "R2_B270_spine": HU - (A_TAB - W_SPINE) - UC}.get(name, face)
    target = P0.z
    depth = start_mat - target
    n = max(1, int(math.ceil(depth / 1.5 - 1e-9)))
    step = depth / n
    pts = [V(P0.x, YT, face + 12.0), V(P0.x, YT, face + 2.0), V(P0.x, YT, start_mat + 0.2)]
    a, bpt = P0, P1
    for k in range(1, n + 1):
        z = start_mat - k * step
        L = (bpt - a).Length
        ramp = min(L, 15.0)
        dirv = (bpt - a).normalize()
        pts.append(V(a.x + dirv.x * ramp, YT, z))       # ramp down over <=15 mm (<= ~5.7 deg for 1.5 mm)
        pts.append(V(bpt.x, YT, z))
        a, bpt = bpt, a
    pts.append(V(bpt.x, YT, target))                      # clean-up pass removes the last ramp scar
    pts.append(V(bpt.x, YT, face + 2.0)); pts.append(V(bpt.x, YT, face + 12.0))
    return pts, n, step, face, start_mat, (P0.x, P1.x)

doc = App.newDocument("NeckCutT4Review")
def add(group, name, shape, label=None):
    o = doc.addObject("Part::Feature", name); o.Shape = shape; o.Label = label or name; group.addObject(o); return o
ctx = doc.addObject("App::DocumentObjectGroup", "Context_B0_pose")
add(ctx, "NeckInput_measured", Part.makeBox(NX1 - NX0, NY1, NZ1 - NZ0, V(NX0, 0, NZ0)), "Neck input (measured floors, flush X faces ASSUMED)")
add(ctx, "Enclosure_CAD_H1", cadH1, "Enclosure CAD, H1 registration (thin end at chuck) - INFERRED")
add(ctx, "Enclosure_CAD_H2", cadH2, "Enclosure CAD, H2 registration (12 mm end at chuck) - alternative")
add(ctx, "Tenon_proxy", Part.makeBox(69.5, 18.35 - NY1, 44.84, V(134.75 - AX, NY1, -22.57)), "Tenon proxy (raw-stock width 69.5 INFERRED; top/bottom from B0/B180 contacts)")
add(ctx, "RotaryAxis_W", Part.makeLine(V(0, -130, 0), V(0, 40, 0)), "Derived rotary axis = work X0 Z0")
paths_report = []
for var in ["T4"]:
    fin, stages = shapes[var]
    for idx, (name, b, cin, sw, cout, t0, t1) in enumerate(stages, start=1):
        g = doc.addObject("App::DocumentObjectGroup", "S%d_%s" % (idx, name))
        g.Label = "Setup %d | %s | B%d | %s" % (idx, "ROUND 1" if name.startswith("R1") else "ROUND 2", b, name)
        add(g, "S%d_InputStock" % idx, pose(cin, b), "S%d input stock (B%d pose)" % (idx, b))
        add(g, "S%d_CutterSweep" % idx, pose(sw, b), "S%d 6 mm cutter sweep (B%d pose)" % (idx, b))
        add(g, "S%d_OutputStock" % idx, pose(cout, b), "S%d output stock (B%d pose)" % (idx, b))
        pts, n, step, face, start_mat, trav = tip_path(name, b, t0, t1, cin)
        add(g, "S%d_TipPath" % idx, Part.makePolygon(pts), "S%d tip-centre path, W frame at B%d (physical tip, not toolhead Z)" % (idx, b))
        paths_report.append({"setup": idx, "name": name, "B": b, "levels": n, "stepdown": round(step, 3),
                             "entry_face_Zw": round(face, 2), "material_start_Zw": round(start_mat, 2),
                             "final_tip_Zw": round(pts[-3].z, 2),
                             "travel_Xw": [round(trav[0], 2), round(trav[1], 2)],
                             "Yw": YT, "points": [[round(p.x, 3), round(p.y, 3), round(p.z, 3)] for p in pts]})
for var in ["C2", "T4naive", "R1"]:
    g = doc.addObject("App::DocumentObjectGroup", "Compare_%s" % var)
    add(g, "Final_%s" % var, shapes[var][0], "Final retained neck, variant %s (B0 pose)" % var)
results["tip_paths_T4"] = paths_report
doc.saveAs(os.path.join(OUT, "neck_cut_T4_review.FCStd"))
json.dump(results, open(os.path.join(OUT, "neck_sweep_results.json"), "w"), indent=1)
summary = []
for var in ["R1", "C2", "T4", "T4naive"]:
    r = results[var]
    summary.append("%s: kerf components=%d (all span kerf: %s) mid-kerf pieces=%d area=%.1f mm2 conn.vol=%.0f mm3 pieces/section min..max=%d..%d" % (
        var, r["kerf_components"], all(c["spans_kerf"] for c in r["components"]), len(r["sections"]["%.2f" % (YT + Y0)]),
        r["mid_kerf_area_total"], r["connection_volume"], r["min_section_pieces"], r["max_section_pieces"]))
print("\n".join(summary))
print(json.dumps({k: results[k].get("mid_chords") for k in ["T4", "C2"]}))
print(json.dumps({k: results[k].get("edge_chords") for k in ["T4", "C2"]}))
for s in sens:
    print(json.dumps(s))
print(json.dumps(results["load_path_backing"]))
for p in paths_report:
    print(p["setup"], p["name"], "B", p["B"], "levels", p["levels"], "step", p["stepdown"], "face", p["entry_face_Zw"], "start", p["material_start_Zw"], "final", p["final_tip_Zw"])
