# Iteration 1 review: rotary neck-cut reassessment (PR #202)

Full grading: `eval-0-rotary-neck-cut-reassessment/grading-summary.md`.

**Brief version graded: `1778779c0`.** While these runs were in flight the brief was revised
(`04a54a149` operator-stated tool protrusion of about 55 mm and a jaw clearance already established with a 5 mm margin;
`9261b5812` C connections defined as west/east side-end Cs opening outward, formed west then east).
Those revisions answer the "C undefined" finding below. They also change what A9 (jaw bracket) and
A11 (tool envelope) should demand. Opus's top/bottom-spine C is now the wrong orientation. Iteration 2 must
re-snapshot and revise A9, A11 and A14/A15 for the side-C geometry.

| Config | Pass (of 23) | Without A21 | Tokens | Time |
|---|---|---|---|---|
| opus + skills | 22 | 22/22 | 432 k | 52.7 min |
| sonnet + skills | 14 | 14/22 | 249 k | 18.0 min |
| haiku + skills | 4 | 4/22 | 104 k | 6.3 min |
| sonnet, no skills | 11 | 11/22 | 195 k | 16.3 min |

## Headlines

1. **Only Opus did the geometry the brief asks for.** Exact FreeCAD solids for every 6 mm sweep, a
   connected-solid count over the whole kerf (4 tabs), and a demonstration that a mid-plane-sized notch
   leaves only 2 solids in 3D. Sonnet's and the baseline's "3D" checks are extruded sections (every Y slice
   identical). Haiku's areas are invented.
2. **Stored rotary axis is inconsistent with this clamping (grader-verified).** From measured contacts
   alone: axis X approximately 169.33 (B90/B270 silhouette centres; 169.30 at Y256), physical Z approximately 113.78
   (with probe 70.95). The stored X170.1 / physical Z112.4 dates from 2026-09-05 with a 71.3 mm probe on
   the raw stock. Keeping 112.4 would need a 39.1 mm section against 36.35 measured. Only Opus tested
   it. **Operator-relevant: do not rotate CAM about the stored axis for this job.**
3. **The prior agent's Y251-261 sweep overcuts the measured B0 enclosure-side wall (Y252.15) by
   about 1.15 mm** (B180: about 1.25-1.75 mm). "Enclosure end face" is an inference until the CAD's Y placement is registered.
4. **The skills pay off for Sonnet (+3 over baseline), not for Haiku.** Haiku with skills scored below
   the no-skill baseline. It traversed before raising, invented the setter trigger, put B180 physical Z
   into B0 coordinates, and adopted the prior agent's band and depth.
5. **Eval defects:** A21 contradicted the brief (the sequenced plan necessarily lists the cuts after the
   gate), so every run failed it. A7 passes vacuously when `goto_work_origin` is never mentioned. A14's
   "inside corner radius" wording invites a wrong answer. The baseline was not clean: every subagent
   receives the operator's auto-memory index (the noskill run quoted its "~73.5 mm" probe note).

## Skill and doc gaps (edits in grading-summary.md)

- `cnc-probing/SKILL.md` jig table presents the rotary axis as a fact; it should say historical and
  tied to probe length and clamping, and require an opposite-face check before CAM rotates about it.
- No stylus-reach rule (A10): add a limit of exposed stylus minus the ball diameter, measured from the highest surface under the body.
- No retained-connection or cutter-sweep guidance (A13): add it to `work-datums.md`.
- No cutting-post guidance (A20): the only post doc is the probing emitter, and Sonnet misapplied it.
  It needs a Job with a verified post, `validate_gcode`, and an independent first-move-to-retract parse. Say
  whether an in-file `G0 B` passes through.
- Sonnet still misses rules the skill states (A7 `goto_work_origin` is XY at the current Z, A8 traverse height).
  This matches the earlier motion evals, where one-point misses kept recurring for Sonnet.

## Brief edits suggested

- "Rotary and CAD references" row: say the stored axis predates this clamping and probe length.
- Define "C-shaped connection" (the runs built four different shapes).
- State that the side silhouettes imply the grooves span the full width.

## Next iteration

Fix A21/A7/A14 and add the rotary-axis assertion, then apply the skill edits above. Rerun Sonnet and Haiku
with auto-memory disabled for all configs.
