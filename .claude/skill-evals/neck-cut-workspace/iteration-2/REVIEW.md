# Iteration 2 review: rotary neck-cut reassessment (PR #202)

Skills: commit `532c46234` (Fable-drafted: new `cnc-probing/references/rotary-axis.md` and
`cnc-motion-rules/references/cutting-programs.md`, "Stylus reach" in `cnc-probing/SKILL.md`, indexed-setup
and non-circular recheck paragraphs in `work-datums.md`, sharper `goto_work_origin` in motion-rules §2).
Brief: `9261b5812` (operator's revisions: stated tool, jaw clearance with 5 mm margin, west/east side-end Cs).
Assertions: 26 (A7/A9/A11/A14/A15/A21 reworded, A24-A26 new). Full grading: `eval-0-.../grading-summary.md`.

| Config | 26 assertions | Comparable subset (22) | Iteration 1 same subset | Tokens | Time |
|---|---|---|---|---|---|
| sonnet | 20/26 (77 %) | 17/22 | 14/22 | 266 k | 20.9 min |
| haiku | 7/26 (27 %) | 6/22 | 4/22 | 113 k | 7.2 min |

The subset is indicative only: A7/A9/A11/A14/A15 wording changed, and the brief changed too.

## What the edits fixed (Sonnet)

- **A7/A8** (retract before `goto_work_origin`; stated traverse height): fixed by the `work-datums.md` and §2 edits.
- **A10** (stylus reach): fixed by "Stylus reach"; Sonnet used its worked example.
- **A14** (where R3 appears) and **A20** (cutting release route, not the probing emitter): fixed by `cutting-programs.md`.
- **Circular WCS recheck:** fixed ("a contact that fed the origin cannot also verify it").
- **A13** moved from an extruded section to a real voxel sweep. It still fails, because the tab variant removes
  material under a retained tab with a top/bottom pass, and the "registration" shift moves the cuts and the stock together.

## Still missing

- **Reachability** of every removed region from its pass's approach, and a registration test that moves the cuts
  relative to the stock (`cutting-programs.md`).
- **Axis written in work coordinates plus a per-B face table** (which original face is up at B90/B270). Both runs
  mislabelled the B90/B270 faces (`work-datums.md`).
- **Tip-centre to wall conversion at the neck.** Sonnet read the rule but still bounded grooves at tip-centre midpoints and
  overcut the measured Y252.15 wall. Needs the worked example in `cutting-programs.md`.
- **Flute/shank reach per setup** (A26). Sonnet's centre slot reaches 30 mm, past the flute and the 29 mm reach.
- **`tool-change`**: Sonnet skipped the probe's setter run because the probe has a stored calibration. The skill already
  forbids this; the rule needs to lead the step in bold.

## Haiku

Haiku gained A2/A7/A8/A21 but remains at 27 %. It saw the `rotary-axis.md` link and chose not to open it; its critique
admits this. It also did not open `cutting-programs.md`. It made serious errors:
- converted the cutter's Z with the probe's 70.95,
- planned `probe_point` jaw descents with the endmill fitted,
- ruled four corner tabs "infeasible" by laying them out along Y.

The link placement is part of the cause. `rotary-axis.md` is linked only inline in `cnc-probing/SKILL.md`, and not at all
from `cnc-motion-rules/SKILL.md`. For Haiku, the rotary and cutting rules must sit where the reading order forces them:
an explicit "read before" pointer in each SKILL.md, not an inline link.

## Brief ambiguities (for the operator)

1. Must the two Cs be separate pieces, and which setup removes the material between them?
2. Which original face is up at each B?
3. What "corner tab" means: at the corners of the X-Z neck section, each bridging the kerf in Y.
4. Which tool, holder and B pose the 5 mm jaw margin was established for.
5. Groove X extent: only X195/X198 were sampled.

## Eval and harness

- Add the grader's two new assertions: no cut past the measured wall, and a B-to-face mapping that matches the groove shifts.
- Reword A13 (reachability) and A23 (drawn dimensions match the computed ones; the labels mark retained material).
- Haiku consulted the auto-memory index despite the instruction. No plan fact depended on it, but eval runs
  should disable auto-memory.
