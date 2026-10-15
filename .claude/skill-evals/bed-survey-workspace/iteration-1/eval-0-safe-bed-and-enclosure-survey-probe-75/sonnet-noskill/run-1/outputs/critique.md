# Critique (noskill, sonnet, run-1)

## What helped
- TOOLS.md "Standing rules" and the `survey_bed` / `camera_bootstrap` / `set_active_tool` descriptions: park 328 vs floor 320, machine-frame doctrine, "approval never carries forward", staged-then-end-turn pattern.
- CAMERA_SURVEY_PLAN.md sections 2-4 gave the bootstrap rationale (setter as target, Z sweep 328 -> 320, verify on a hold-out pose) and the target heights (setter plate top = triggerZ - reference bit).
- README keep-out section: stored boxes are volumes for survey_bed (waypoints dropped, links lifted) but "crossing" obstacles for probing, and `probe_program.keep_out` exists while `probe_surface_grid` has no keep_out. That decided the structure of the fine probe step.
- live-state.md being explicit that get_position shows Z296 / not homed forced the home-first branch.

## Missing, unclear or contradictory
- `camera_program` (the headline of PR #219): tools-list.json gives `ops` as bare `object` items; the description lists op names (move_z, survey_bed, move_and_capture, capture, track_feature, fit_calibration, verify_calibration) but no field names, no example, and no mention in TOOLS.md or README. I could not write a valid call, so I used standalone `survey_bed`/`camera_bootstrap`. Also unclear how `fit_calibration`/`verify_calibration` (legacy Y/Z calibration) relate to the new camera model (`camera_bootstrap`/`verify_camera_model`); two calibration systems coexist and nothing says which one `survey_bed overlap_fraction` consumes.
- `set_active_tool`: unclear whether it changes any check when every landmark is still legacy (toolhead basis, 328); the doc implies only physical-basis `obstacle_top_z` boxes use it. Also unclear whether `source: operator` needs a separate human gate and whether it survives a reconnect/power cycle (camera does not; the tool is silent). The operator said "overall length", the tool wants "protrusion below the toolhead"; nothing explains the difference or how to treat 75 vs the stored 70.9 / 74.8.
- Floor contradiction: TOOLS.md and stored limits say floor 320; the `traverse_xy` and `move_and_capture` descriptions in tools-list.json still say 328/mcpSafeTraverseZ and "no override". I planned everything at 328 so both readings pass. Also because `rotary-axis` and `tool-setter` are legacy 328 landmarks, the new "320 floor" gives NO benefit for this task and a 320 survey over the workpiece would drop every waypoint; the docs never say this plainly.
- Where `scripts/camera_bootstrap.py` runs (agent host vs the Ubuntu box), its arguments and how frames are fetched are not documented in the snapshot docs I was allowed to read.
- `verify_camera_model` needs pixel_u/pixel_v; the only source is hand-marking or `track_feature` (frame-to-frame, not model-to-frame). No tool detects the setter disc. Also it needs the head at the verification pose, and bootstrap does not say where the head ends.
- Whether `home` is a direct call needing the operator's chat word or a gated action is only in cnc-motion-rules (not allowed here); TOOLS.md says "never infer permission from this tool index". I asked in the batch.
- Which B the enclosure sits at after homing (B0) vs the stored pocket jobs (B180) is not recorded; plan needs a `rotate_b` branch.
- `survey_bed` dropping/lifting behaviour near `keep_out` for the tailstock is described for stored boxes only; a `keep_out` is not an argument of survey_bed.

## What I had to guess
- That 75 mm is conservative both ways: used 75 for clearance/start heights and 70.9 for the search floor; the exact start/floor offsets (+5, -8), `max_drop_mm` 14, pitch 5, overlap 0.3/0.5, `reach_mm` 200 are my choices, not sourced.
- The tailstock keep_out box X140..200 Y0..110 (taken from the rotary landmark's X span and the "Y<110" note).
- Poses for the bootstrap poses stage depend on the solved offset (live-unknown), left as placeholders.
- Camera selection: the pinned device is assumed to be the toolhead camera until preview_cameras shows otherwise.

## Risks in the new tools
- `set_active_tool` lets a conversation assertion set the clearance protrusion; a wrong (too small) number silently weakens any physical-basis clearance. There is no expiry or fitted-tool check.
- Motion floor 320 with legacy 328 landmarks is easy to misread as permission to survey/transit at 320; the rotary box then drops waypoints silently into `result.dropped` (reported, but a partial mosaic looks like a complete one).
- Z sweep to 320 in the bootstrap puts the tip at 245 physical with an unmapped tailstock bracket of unknown height nearby; the camera-looks-into-keep-outs-on-purpose design relies on the TOOLHEAD pose filter only.
- `camera_program` with `operator_confirmed_clearance` (also on `survey_bed`) is a one-flag escape from the floor; its confirm page is the only guard.
- The hand-marked pixel path in verification can pass a bad model; a residual in px is only as good as the marked pixel.
