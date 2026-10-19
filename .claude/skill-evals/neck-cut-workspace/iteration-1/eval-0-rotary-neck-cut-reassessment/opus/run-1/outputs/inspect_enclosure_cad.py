# Read-only inspection of the operator's enclosure CAD (snapshot copy is opened read-only; nothing saved).
# Run: FreeCADCmd.exe -c "exec(open(r'<this file>').read())"
import FreeCAD as App, Part, json, os
SNAP = r"C:/dev/software/snapmaker/Luban/.claude/worktrees/pr-202-scenario-skills-eval-6e349c/.claude/skill-evals/neck-cut-workspace/snapshot-1778779/docs/skills-evals/cnc-neck-cut-evidence/reference_enclosure_20260922.FCStd"
OUT = r"C:/dev/software/snapmaker/Luban/.claude/worktrees/pr-202-scenario-skills-eval-6e349c/.claude/skill-evals/neck-cut-workspace/iteration-1/eval-0-rotary-neck-cut-reassessment/opus/run-1/outputs"
doc = App.openDocument(SNAP)
obj = doc.getObject("Stock_T8c_ExistingEnclosure") or [o for o in doc.Objects if o.Label.startswith("Stock - existing")][0]
sh = obj.Shape.copy()
lines = []
bb = sh.BoundBox
lines.append("object %s label=%s bbox X%.3f..%.3f Y%.3f..%.3f Z%.3f..%.3f vol=%.1f" % (obj.Name, obj.Label, bb.XMin, bb.XMax, bb.YMin, bb.YMax, bb.ZMin, bb.ZMax, sh.Volume))
def ysection(y):
    box = Part.makeBox(200, 0.05, 200, App.Vector(-100, y - 0.025, -150))
    c = sh.common(box)
    res = []
    for s in c.Solids:
        b = s.BoundBox
        res.append("[X%.2f..%.2f Z%.2f..%.2f A=%.1f]" % (b.XMin, b.XMax, b.ZMin, b.ZMax, s.Volume / 0.05))
    return "Y=%.2f area=%.1f pieces=%d %s" % (y, c.Volume / 0.05, len(c.Solids), " ".join(res))
for y in [0.5, 3, 6, 9, 9.9, 10.5, 11.5, 12.5, 13.5, 15, 17, 18.5, 20, 60, 100.5, 101.5, 102.5, 104, 106, 107.5, 108.5, 109.5, 112, 114.5, 115.5, 116.5, 117.5, 118.5, 118.95]:
    lines.append(ysection(y))
# Z probes: is the top (Z0 face) solid along Y at X = -24.9 / 0.1 / 25.1 (machine X145/170/195 if CAD X0 = machine 169.9)?
def zcol(x, y):
    ln = Part.makeLine(App.Vector(x, y, 5), App.Vector(x, y, -41))
    c = sh.common(ln)
    segs = sorted([(e.Vertexes[0].Point.z, e.Vertexes[-1].Point.z) for e in c.Edges], key=lambda t: -max(t))
    return segs
for x in [-24.9, 0.1, 25.1]:
    row = []
    for y in [0.5, 4, 8, 11, 13, 16, 104, 107, 110, 113, 116, 118.5]:
        s = zcol(x, y)
        top = max([max(a) for a in s]) if s else None
        bot = min([min(a) for a in s]) if s else None
        row.append("y%.1f:%s" % (y, "none" if top is None else "%.2f/%.2f(%d)" % (top, bot, len(s))))
    lines.append("column x=%.1f  top/bottom(n segments): %s" % (x, "  ".join(row)))
# X-direction chords at mid-height through the end regions
def xchord(y, z):
    ln = Part.makeLine(App.Vector(-40, y, z), App.Vector(40, y, z))
    c = sh.common(ln)
    return sorted([tuple(sorted((round(e.Vertexes[0].Point.x, 2), round(e.Vertexes[-1].Point.x, 2)))) for e in c.Edges])
for y in [5, 12, 50, 110, 117]:
    for z in [-1, -9, -18, -27, -35]:
        lines.append("x-chord y=%.1f z=%.1f: %s" % (y, z, xchord(y, z)))
open(os.path.join(OUT, "enclosure_cad_inspection.txt"), "w").write("\n".join(lines) + "\n")
print("\n".join(lines))
App.closeDocument(doc.Name)
