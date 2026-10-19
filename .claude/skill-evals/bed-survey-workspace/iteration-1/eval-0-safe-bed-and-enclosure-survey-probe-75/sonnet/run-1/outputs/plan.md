# Bed + enclosure survey: checks, then camera model (bootstrap, solve, verify), whole-bed mosaic at Z328, then a probe grid of the enclosure top at the tailstock end; no cut is staged

All heights below are MACHINE frame, toolhead Z unless marked "physical". Tool in the spindle: touch probe, ALWAYS fitted.

## State block (from the fixture)

- get_connection_status: `connected: true`, `channelName: sstp-http`, `machineIdentifier: A350`, `machineReady: true`. OK.
- get_position: machine X150.2 Y210.4 **Z296.0** B180.0, `reliability: heartbeat`, `warnings: []`, **`isHomed: false`**, `machineStatus: IDLE`, `reportAgeMs: 900`, `originOffset` {-118.8, -77.2, -79.0}. Reliability is fine. NOT homed, and Z296 is BELOW the motion floor (320) and the park height (328), so no XY move can be staged until the head is homed or raised. B is 180.
- get_active_tool: `active: null`. No tool is confirmed, so the route planners fall back to the legacy worst case and refuse physical obstacles they cannot bound.
- get_stored_state limits: `safeTraverseZMm` 328, `motionFloorZMm` 320, `maxJogDistanceMm` 100. Travel X -19..339, Y 0..342 (stated 2026-09-20).
- Landmarks (both LEGACY toolhead-basis `clearanceZ` 328, as `landmarkClearances` says): `tool-setter` box X38..89 Y269..303; `rotary-axis` box X140..200 Y0..350 (tailstock live centre ~Y95, bracket and handwheel stand ABOVE the stock top, keep-out Y<110; chuck face ~Y300-310).
- Probe length: operator says ~75 (overall). Store says `probe_effective_length` **70.9** (run_tool_setter job 5ce60989dc03, 2026-09-29 ~12:37 BST, after the probe was refitted). `landmarkClearances.toolProtrusionMm` 75 (`longest-bit`). The difference is 4.1 mm, which is over the 0.3 mm rule.
- probeFeed: GPIO (KB2040), connected, toolsetter / overtravel / probe channels enabled and idle, `ok: true`. `probe_tip_diameter` 2 (operator-stated 2026-09-29).
- get_camera_model: `model: null`, `usable: false`, `state: unverified`, `next: camera_bootstrap`. `calibrations: []`. The legacy 2x2 route is empty too.
- list_cameras: two devices. Pinned: Generic USB Camera `/dev/v4l/by-id/usb-Generic_USB_Camera_200901010001-video-index0`. Other: icSpring. The stream is enabled.
- get_mcp_diagnostics buffers: `jobEventLimit` 2000 (spindle telemetry off).
- Job history: 031c3eb1fe38 (pocket outline, B180) and d677bd88d31a (closed perimeter trace) from 2026-09-21/22. Nothing records whether the enclosure has been unclamped, re-clamped or rotated since.

## Assumptions and unknowns

| item | value | frame / qualifier | source | status |
|---|---|---|---|---|
| Fitted tool | touch probe | in spindle | operator | stated |
| Probe length for CLEARANCE | 75 | protrusion below toolhead, conservative (>= stored 70.9 and >= longest bit 75); "overall length" may not equal protrusion | operator | used for set_active_tool only; confirm in Q2 |
| Probe length for HEIGHT conversion (physical = contact Z - L) | 70.9 stored | toolhead-to-tip, setter job 2026-09-29, after refit | fixture | DISAGREES with operator by 4.1 mm; every physical figure is reported with both L until Q2 is answered |
| Motion floor / park | 320 / 328 | machine toolhead Z | fixture | known |
| All camera moves and survey XY | at Z328 | toolhead Z, = park, passes the legacy 328 boxes (equal passes) | derived | chosen |
| Head now | Z296, not homed, B180 | machine | fixture | must be homed before any XY |
| Enclosure orientation for the screw hole | B? (pocket jobs were B180; home sets B0) | B | live-unknown | Q3 |
| Enclosure physical top Z | unknown | physical | live-unknown | measured by the find march; the 136.5 in the rotary record is from an earlier clamping (2026-09-02) and is NOT used |
| Rotary axis X170.1, Z112.4 physical | historical, undated | machine | fixture | orientation only, never a target or a bound |
| Tailstock Y | ~95 (landmark note); `rotary_tailstock_y` unset; height UNMEASURED | machine | fixture (note) | grid kept at Y >= 120 (110 stated keep-out + 10 mm planning margin for the probe body, mine; Q5) |
| Enclosure XY extents and screw-hole spot | unknown | machine | live-unknown | Q4; else from saved jobs + mosaic |
| Camera model, offset, FOV | none | session state | fixture | solved by bootstrap; never from memory |
| Setter plate top | 100.5 | physical, 175.5 trigger - 75 reference bit | fixture | verification target (79, 293, 100.5) |
| Air-blast post | centre (49.691, 280.707), top ~106.9 | physical | fixture | optional second target; "~" so not used for pass/fail |
| Probe stylus exposed length | unknown | mm | live-unknown | Q6; needed only if the grid reaches a pocket wall |
| Job event limit | 2000 | `get_mcp_diagnostics -> buffers` | fixture | too small for the fine grid; Q7 |
| Unmapped objects above 245 physical (= 320 - 75) | unknown | physical | live-unknown | Q8 |
| Frames location for the offline solver | on the Ubuntu box | filesystem | live-unknown | result of the bootstrap job names the directory; [WAIT] if I cannot read it |

## Questions for the operator (one batch)

1. Homing: the head is not homed (Z296, B180). OK to run `home`? It raises Z first, then drives every axis to its switch, and it **also homes B, so the enclosure will turn from B180 to B0**. It runs on the call with no confirm page. If you say no, I will only offer a staged `move_z` to 328 and expect the tools to refuse XY while unhomed.
2. Probe length: you said ~75, the store holds 70.9 (measured 2026-09-29 after a refit). Is this the same probe (70.9 still true, 75 just your safe round-up), or was it swapped or re-seated? I will register 75 as the active tool for clearance either way (the safe side). Until you answer, physical heights are quoted with both L. If it changed, say whether you want one extra `run_tool_setter` (+1 approval) to re-measure it.
3. Which face and B angle carries the screw hole? The 2026-09-21/22 pocket jobs were at B180; homing leaves B0. I will rotate to the angle you name inside the fine-survey program (`rotate_b`, head at 328). What is the enclosure's largest radius about the axis (for the `swept_radius_mm` check)?
4. Where, roughly, is the screw hole? Give an X/Y box or a distance from the tailstock end and a size. If you give nothing I will derive the grid from the saved jobs + mosaic and put it on the confirm page for the click. Also: has the enclosure been unclamped, re-clamped or rotated in its fixture since 2026-09-22? If NOT, I reuse 031c3eb1fe38 / d677bd88d31a contacts for outline and edges instead of re-measuring them.
5. Is Y >= 120 an acceptable inner limit for probe stations next to the tailstock (110 keep-out + 10 mm margin)?
6. Exposed stylus length and ball diameter of this probe (bounds descents next to walls or in the pocket).
7. May I raise the job event limit from 2000 (Settings -> MCP Server -> Diagnostic buffers) to about 20000? A 5 mm grid over roughly 60 x 60 mm is ~150 stations, ~100 + 150 x 110 = 16.6k worst case events. Staging refuses an over-budget program and names the number.
8. Does anything unmapped on the bed or clamping stand taller than 245 mm physical (320 minus the 75 mm probe)? Both landmarks are legacy 328, so route checks are not relaxed by the active tool, but free-standing clamps have no landmark.

-- end turn --

## Plan by phase

**Phase A - basic checks (read-only, then the one motion that unlocks the rest).** Purpose: prove state, set the active tool, home. No heights are commanded except home (Z rises first, ends at the park height 328 = machine home X-19 Y342). Safe because home is the operator-ruled safe motion, and nothing but the probe is under the head. Result expected: `isHomed: true`, Z328, B0, reliability heartbeat or verified, a fresh `originOffset` (the offset is read again, not assumed). Then pick the toolhead camera from evidence (`preview_cameras`) and read the saved pocket jobs (evidence first; they cost nothing).

**Phase B - camera alignment and calibration.** Purpose: a solved and verified camera model (none exists). All at Z328 for XY; the bootstrap Z sweep goes down 328 to 320 only (the floor) with XY stationary, over clear bed, at a pose outside every landmark box (a pose the toolhead cannot stand on at 320 is dropped by the tool, not adjusted). Approvals: bootstrap search (1), bootstrap poses (1), one traverse_xy to a verification pose (1). Frames are solved offline with `scripts/camera_bootstrap.py`, stored with `set_camera_model` (stored UNVERIFIED), then checked against a held-out target with `verify_camera_model`. Expected: rms residual a few px; verified. If the check fails: re-run the poses stage, never use the model.

**Phase C - coarse survey.** `survey_bed` at Z328 with `overlap_fraction` (pitch derived from the model's FOV), machine_z asserted 328 before XY. Whole reachable bed under one approval. Z328 equals every legacy clearance so nothing is dropped; any drop is reported. `plane_z` 0 = the bed. The enclosure top stands above that plane, so its position in the mosaic carries parallax; the mosaic only LOCATES things, the probe measures them. Expected: `mosaic_z328.jpg` + `index.json`; I read features off the index affine, with an uncertainty, and do not name any landmark by analogy.

**Phase D - fine survey at the tailstock end.** One `probe_program` (one approval): optional `rotate_b`, a sensor-gated find of the top, then a stepped `surface_grid`. Heights: hop at 328, descent only by guarded sensor-gated segments, start_z_machine = measured top + 3 (never a guess), stations within max_hop_mm (60 cap), ends raised at 328. The tailstock goes in as a `keep_out` volume (X140..200, Y0..110, clearance 328), which also bans the descent columns. `hop_mode: stepped` because the top is unknown and may carry a pocket or edge (steps larger than a guarded delta). Expected: height map, plane tilt, flatness, edges, each as toolhead Z with physical = Z - L, B angle, tip convention (tip diameter 2 mm), and an uncertainty.

## Steps

**Turn 1 (read-only, fixture-quoted) - ends at the questions above.**
1. `get_connection_status`, `get_position`, `get_stored_state`, `get_active_tool`, `get_camera_model`, `get_probe_feed_status`, `get_mcp_diagnostics` - quoted in the State block (no motion).
2. `get_gcode_job_status {"job_id": "031c3eb1fe38"}` and `{"job_id": "d677bd88d31a"}` - retrieve the saved pocket contacts (B180, calibration of that date) and reconcile before asking for any new measurement.
3. Reply: the State block, the Q batch (one message), nothing staged.

-- end turn --

**Turn 2 (after the answers).**
4. [WAIT] for the operator's answers to Q1-Q8 (nothing is called before them).
5. `set_active_tool {"protrusion_mm": 75, "source": "operator", "tool_identity": "touch probe", "note": "operator-stated ~75 overall, the safe assumption; stored effective length 70.9 (2026-09-29)"}` then `get_active_tool` to read it back. No motion. If the operator replies the probe is a different length, use that number instead.
6. `home {}` (only on the operator's word from Q1; say aloud: B turns 180 -> 0). Then `get_position`: require `isHomed: true`, reliability heartbeat/verified, no warnings, Z328, and re-read `originOffset`. If it reads `awaiting-resync`, wait ~3 s and re-read once; do not home again.
7. `preview_cameras {}` - identify the toolhead camera by what it sees (at home the silver extrusion up close) and by rig-fixed content. If the pinned Generic USB Camera is it, no change. Otherwise `select_camera {"device": "<entry>", "confirm_frame_id": "<id from the preview>", "reason": "..."}`. Never pass `operator_confirmed`.
8. `camera_bootstrap {"stage": "search", "reason": "Solve the camera from nothing: no model exists on this machine. Serpentine at the park height Z328 around the tool setter (79, 293)", "reach_mm": 200, "pitch_mm": 40, "y_span_mm": 0}` [APPROVAL]. These three are the tool defaults; if no frame shows the setter, restage with a wider `y_span_mm` rather than guessing an offset. Reply with one sentence and the `confirm_url` as the LAST line.

-- end turn --

**Turn 3.**
9. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background; then `get_gcode_job_status {"job_id": "<id>", "wait_ms": 110000, "since_event": <next_event_index>}` until `ending.kind` is `completed`. A timed-out wait is called again, never withdrawn.
10. Read the frames: which contain the gold setter disc vs. the toolhead XY of each frame. That gives the coarse offset including its sign. Choose 2-3 deliberately X- and Y-separated poses from it (outside both landmark boxes), and keep the verification pose (step 14) different from all of them.
11. `camera_bootstrap {"stage": "poses", "reason": "Z sweep 328 -> 320, XY stationary, over the setter at X/Y-separated poses to resolve perspective", "poses": [{"label": "p1", "x": <from step 10>, "y": <...>}, {"label": "p2", ...}, {"label": "p3", ...}], "step_mm": 2, "floor_z": 320}` [APPROVAL]. `floor_z` is the motion floor, the lowest the tool allows. Dropped poses are reported with a reason; I do not nudge them. Confirm URL as the last line.

-- end turn --

**Turn 4.**
12. `start_gcode_job` (background) + `get_gcode_job_status` long-poll as in step 9.
13. [WAIT] only if the frame directory in the result is not readable from my side: ask the operator to hand over the directory. Then `python3 scripts/camera_bootstrap.py <directory>` (hand-marked pixels with `--marks` if detection fails). Read the residuals. `set_camera_model {"offset": {...}, "rotation": [[...]], "intrinsics": {...}, "valid_band_z": [320, 328], "central_region": <script>, "residuals": {...}, "survey_id": "<bootstrap id>", "targets": ["tool-setter"], ...}` with the script's numbers only (stored unverified).
14. `plan_view_pose {"target": {"x": 79, "y": 293, "z": 100.5}, "toolhead_z": 328}`. Read toolhead XY, standoff, FOV, "outside solved band?" flag. Then `traverse_xy {"x": <from the pose>, "y": <...>, "coordinate_system": "machine", "reason": "Hold-out pose to verify the camera model on the tool setter"}` [APPROVAL] - the head is already at Z328 after home so this is lawful with no `move_z`. Confirm URL last line.

-- end turn --

**Turn 5.**
15. `start_gcode_job` (background) + wait for the move to complete; `get_position` (the position of record must be at the target).
16. `capture_frame {}`; locate the setter disc (use `track_feature` or the script's detector, not the eye); `verify_camera_model {"target": {"x": 79, "y": 293, "z": 100.5}, "pixel_u": <u>, "pixel_v": <v>, "tolerance_px": 8, "note": "tool setter centre, plate top; pixel from detector"}`. Branch: **verified** -> go on. **Failed** (residual over 8 px) -> state the residual, the camera was probably knocked, restage the poses stage (plus one more look), do not survey on this model.
17. `survey_bed {"reason": "Whole-bed camera survey of the bed and workpiece at the park height; overlap derived from the verified model", "machine_z": 328, "z_levels": [328], "overlap_fraction": 0.3, "plane_z": 0, "margin_mm": 10}` [APPROVAL]. Read `result.dropped` / `result.clipped` aloud. 0.3 is the tool default; `x_min..y_max` are left to the default (travel inset 10 mm). Confirm URL last line.

-- end turn --

**Turn 6.**
18. `start_gcode_job` (background) + long-poll to the end. `get_stored_state`/job result gives the output directory.
19. Read `mosaic_z328.jpg` and `index.json` (affine lookup, parallax caveat, drift check on the seams). Report: where the enclosure and its tailstock end sit in machine XY, with uncertainty; any surprise (mosaic seams that disagree = model knocked, mark unverified, return to step 11). Reconcile with the saved jobs from step 2: if the clamp is unchanged per Q4 reuse their outline; otherwise note it is not applicable. Choose the grid (x/y box, Y >= 120, pitch <= 6 mm) and the find point (flat top, away from the pocket) and say them aloud.
20. Stage the fine survey (the find point, the box and the heights come from step 19):
```
probe_program {
 "name": "Enclosure top survey, tailstock end",
 "reason": "Measure the top near the tailstock for a later screw-hole cut; no cut staged",
 "keep_out": [{"name": "tailstock", "machine": {"x0": 140, "y0": 0, "x1": 200, "y1": 110}, "clearance_z": 328}],
 "ops": [
  {"id": "rot", "kind": "rotate_b", "b": <Q3 answer, omit if already there>, "require_z_at_least": 328, "swept_radius_mm": <Q3 answer>},
  {"id": "find", "kind": "sequence", "steps": [
     {"kind": "hop", "x": <find X>, "y": <find Y>},
     {"kind": "probe", "name": "top", "dz": -1, "max_travel_mm": 150, "on_miss": "abort"}]},
  {"id": "map", "kind": "surface_grid", "x_min": <>, "x_max": <>, "y_min": 120, "y_max": <>, "pitch_mm": 5,
   "start_z_machine": {"from": "find.top.z", "plus": 3, "between": [178, 328]},
   "expected_z_machine": {"from": "find.top.z", "between": [178, 328]},
   "hop_mode": "stepped", "hop_lift_mm": 2,
   "capture": {"stations": [1], "label": "first station", "settle_ms": 500}}
 ]}
```
`max_travel_mm` 150 and `between [178, 328]` are the skill's example values (physical top roughly 107-253 with the probe at 70.9-75); I cut them to the stock height the operator gave in Q8/Q3 if smaller. If the first staging is refused for event budget, ask for the number it names (Q7). Also `get_stored_state` check that the probe pills are green (they are, per the fixture). Reply: one sentence and the confirm_url as the last line.

-- end turn --

**Turn 7.**
21. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background; `get_gcode_job_status` long-poll with `since_event`. Do not read logs.
22. Report the fine-survey results: find top (toolhead Z and physical with both L), `zMatrix`, tilt X/Y, flatness peak-to-valley, text height map, `no_contact` stations, edges, B, ending kind, `timing`. Each number with its tip convention (2 mm ball) and uncertainty (half the pitch for positions). State what was NOT measured (inside the tailstock keep-out, anything outside the grid). Offer `set_landmark` for the measured tailstock height only on the operator's word. The plan ends here; no cut, no origin written, no work frame touched.

## Recovery

- Any job aborts, a stop, or a refusal: the first motion is a straight-up `move_z` to 328 (machine), then `get_position`, then re-plan. Never "return to the start height". The server does this on a procedure abort already; I read `ending` and `result` (partial stations are kept).
- Probe still reads contact (`abort-held`): HOLD. The operator frees it; I do not move, do not raise over a hold, and `on_fail: skip` does not override it.
- Crash alarm or overtravel latch: connection closed. `clear_overtravel_alarm` only on the operator's explicit words, then re-prove state.
- Position `awaiting-resync` or `stale`: motion is refused. Re-read once after ~3 s. If it is `frame: machine-frame`, `restore_work_frame`. Still rejected after ~10 s: `query_firmware_position`, `get_mcp_diagnostics` (keep the connection captures before any recovery), `recover_machine_connection`; never pair or reconnect myself. `home` with `ignore_stale_position` only on the operator's explicit demand.
- Bootstrap finds no setter frames: restage `search` with a wider `y_span_mm` / `reach_mm`; if the model verify fails or the mosaic seams disagree: the camera moved, mark unverified, redo the poses stage. Never feed a failed model into `plan_view_pose` or `survey_bed`.
- Fine survey `no_contact` at the first station aborts: re-plan from the verified final state with the measured top, not a larger blind descent.
- Event buffer overflow: `result` is never trimmed, read it, not the event tail.

Counts: logical approvals=5, literal [APPROVAL] tags=5, operator waits=2, question batches=1
