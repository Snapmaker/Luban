# Critique (sonnet run-1, eval 0)

## What helped
- `cnc-motion-rules` section 0 checklist and section 3 table made the starting state unambiguous: reliability fine but `isHomed: false` and Z296 under the 320 floor, so the plan opens with homing (and the B turn) and a single question batch.
- The two-op find-then-scan `probe_program` example (section 8) and the surface-scan envelope table gave real argument names and the `between` bounds.
- `cnc-visual-alignment`: "verify, else bootstrap, before any pose arithmetic" and "survey before single poses" fixed the camera ordering; `CAMERA_SURVEY_PLAN.md` explained the four bootstrap stages and the Z sweep.
- tools-list.json descriptions (`camera_bootstrap`, `survey_bed`, `set_active_tool`) were precise enough to write calls.

## Missing, unclear or contradictory
- **camera_program and the active tool are not in any doc I was allowed to read.** A grep of the snapshot (skills, TOOLS.md, README, CAMERA_SURVEY_PLAN.md) finds neither `camera_program` nor `set_active_tool` / `get_active_tool`. The only source is tools-list.json, and `camera_program.inputSchema.ops.items` is a bare `{"type": "object"}`: the op names (move_z, survey_bed, move_and_capture, capture, track_feature, fit_calibration, verify_calibration) are in the description but no per-op fields (`machine_z`? thresholds? what `fit_calibration` stores?). I would have had to guess, so I did not use `camera_program`; I used the documented standalone tools. That is probably not what the operator meant by "camera programs". Fix: put op schemas in the tool's inputSchema (oneOf) and add a camera-program section to `cnc-visual-alignment`.
- **Active tool vs. stored probe length.** `set_active_tool` says the operator must state "protrusion below the toolhead"; the operator said "overall length ~75". Those can differ (the part inside the collet). The skills' rule "store and operator disagree by >0.3 mm: ask" is written for `probe_effective_length`, not for the new active-tool assertion. I do not know whether `get_active_tool` feeds physical conversions (surface = Z - L) or only clearance, nor whether it expires on a tool change. Fixture shows both landmarks are LEGACY toolhead-basis, so the 75 here changes nothing in route checks; the skill does not say so, I had to infer it from `landmarkClearances`.
- **traverse_xy description vs. skill.** The tool text says it is "Refused unless the toolhead is already at or above mcpSafeTraverseZ (328 ...) ... deliberately no override", while the skill law 2 says XY transport is lawful from the 320 floor. I planned everything at 328 to satisfy both; the doc should be reconciled.
- **Unhomed state.** The checklist requires `isHomed` true, but a plain `move_z` raise is also listed as the way to leave a low Z; nothing says whether `move_z` and `traverse_xy` refuse when unhomed (only `move_and_capture` is documented to). I branched on home needing the operator's word.
- **Frames for the offline solver.** `scripts/camera_bootstrap.py <directory>` needs the bootstrap frames; they are written on the server (the Ubuntu box). Neither the skill nor tools-list.json says how an agent not on that box gets them (`get_frame {file}` is limited to the program-frame directory). I added a conditional [WAIT].
- **Mosaic `plane_z` for a workpiece.** `survey_bed` takes a single stated `plane_z` (default 0 = bed); the enclosure top is unknown until probed, so the first mosaic is bed-plane only and the workpiece is parallax-shifted. The skill mentions parallax but not this ordering problem.
- **Verification held-out target.** The skill says verify "against a pose not in the fit" but `camera_bootstrap` poses are my choice and the target is always the setter; nothing guides how to keep them distinct. I used a different XY pose.
- Bootstrap `poses` at 320 inside the setter/rotary boxes would be dropped (legacy clearance 328); the docs never say which poses are likely reachable, so the pose list is "from the stage-0 result".
- Event-budget formula in `cnc-probing` gives a per-station cost for guarded (110/60) but not for stepped; I used 110 as worst case.
- Tailstock keep-out numbers (Y<110) exist only as free text in the `rotary-axis` landmark notes; I derived a `keep_out` box from them and flagged the margin as mine.

## Guessed
- 10 mm margin (Y >= 120), 5 mm pitch, `max_travel_mm` 150 and `between [178, 328]` (taken from the skill example), event limit 20000, overlap 0.3 (tool default), `step_mm` 2 and `floor_z` 320 (default/min), the choice to survey at Z328 only.

## Risks in the new tools
- `set_active_tool` is a bare assertion with no motion gate and no expiry I can see. A SHORT value would lower required clearances for any physical-basis landmark; here 75 is conservative, but a later tool swap leaves a stale assertion.
- `survey_bed` / `camera_program` both carry `operator_confirmed_clearance` (skips the floor); `camera_program` composes move_z with survey ops, so a single page can include several Z changes - the reviewer must read the exact Z list.
- `camera_bootstrap` poses stage descends 328 -> 320 over the bed; the unmapped-object question (anything above 245 physical) is a real prerequisite, and I put it to the operator.
- A model that passes `verify_camera_model` only at the setter says nothing about parallax at the enclosure's height; relying on the mosaic for the probe region without a margin would be unsafe. The plan uses the mosaic to locate only and bounds the descent with a sensor-gated find.
