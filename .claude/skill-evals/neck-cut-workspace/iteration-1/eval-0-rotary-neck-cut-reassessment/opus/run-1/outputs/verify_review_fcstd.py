import FreeCAD as App, os
d = App.openDocument(os.path.join(r"C:/dev/software/snapmaker/Luban/.claude/worktrees/pr-202-scenario-skills-eval-6e349c/.claude/skill-evals/neck-cut-workspace/iteration-1/eval-0-rotary-neck-cut-reassessment/opus/run-1/outputs", "neck_cut_T4_review.FCStd"))
for o in d.Objects:
    if o.TypeId == "App::DocumentObjectGroup":
        print(o.Label, "->", [c.Name for c in o.Group])
f = d.getObject("S7_OutputStock").Shape
print("S7 output solids", len(f.Solids), "valid", f.isValid())
