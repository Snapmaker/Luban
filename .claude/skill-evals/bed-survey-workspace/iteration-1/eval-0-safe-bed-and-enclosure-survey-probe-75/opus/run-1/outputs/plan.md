# Bed + enclosure survey: home (B turns 180->0), identify and solve the toolhead camera, run a coarse camera survey of the whole bed at Z328, then a fine survey (touch-probe find + height map, then a camera survey on the measured plane) of the enclosure's tailstock end. All heights are machine Z328/Z320, and the probe is taken as 75 mm for clearance.

All coordinates are MACHINE frame. "Toolhead Z" is what the heartbeat reports. Physical height = toolhead Z at contact minus the probe effective length. The fitted tool is the spindle touch probe throughout (operator, 2026-10-04). Dry run: nothing below has been executed.

## State block (from the fixture)
- Connection: `get_connection_status` gives `connected: true, channelName "sstp-http", machineIdentifier "A350", machineReady: true` (fixture).
- Position: `get_position` gives `machine {x 150.2, y 210.4, z 296.0, b 180.0}, reliability "heartbeat", warnings [], machineStatus "IDLE", reportAgeMs 900` (fixture). Reliability is acceptable.
- **Homed: `isHomed: false`**, with reason "controller has not been homed since Luban reconnected" (fixture). **No motion until homed**, and homing needs the operator's word because it turns B.
- Head location: X150.2 Y210.4 is **inside the `rotary-axis` box** (X140..200, Y0..350, legacy clearanceZ 328). It is at Z296, below the box's 328 and below the floor 320. Only a Z-only rise is acceptable from here. `home` raises Z first.
- Work offset: `originOffset {x -118.8, y -77.2, z -79.0}` (fixture). This plan never uses it or writes it.
- Active tool: `get_active_tool` gives `active: null` ("No active tool is confirmed…") (fixture).
- Tool clearance basis: `landmarkClearances.toolProtrusionMm 75`, source `longest-bit`. Both landmarks are legacy toolhead-basis (fixture).
- Limits: `safeTraverseZMm 328`, `motionFloorZMm 320`, `maxJogDistanceMm 100` (fixture).
- Probe calibration: `probe_effective_length 70.9` (run_tool_setter job 5ce60989dc03, 2026-09-29, contact Z171.4 x3, spread 0, setter surface 100.5). `probe_tip_diameter 2` (fixture).
- Tool setter: centre (79, 293), `triggerZ 175.5` with the 75 mm reference, so the plate top is physical 100.5. Air-blast post centre (49.691, 280.707), top physical "~106.9" (fixture).
- Rotary: `rotary_axis_x 170.1` and `rotary_axis_z_physical 112.4` are "config, undated - historical". `rotary_tailstock_y` and `rotary_chuck_face_y` are unset. Tailstock live centre is at "~Y95", and its "bracket+handwheel stand ABOVE stock top - keep-out Y<110" (fixture landmark note).
- Travel: X -19..339, Y 0..342 (stated 2026-09-20) (fixture).
- Camera model: `model null, usable false, state "unverified", next "camera_bootstrap"` (fixture).
- Cameras: two are attached. The pinned one is `usb-Generic_USB_Camera_200901010001-video-index0`, and the other is `usb-icSpring_icspring_camera-video-index0` (fixture). `calibrations: []`.
- Probe feed: `gpio (KB2040 U2IF), connected, toolsetter/overtravel/probe enabled and idle, ok: true` (fixture).
- Event buffer: `jobEventLimit 2000` (spindle telemetry off) (fixture).
- Prior evidence: probing jobs **031c3eb1fe38** (pocket outline, B180) and **d677bd88d31a** (closed perimeter trace) of the QuadEink enclosure, 2026-09-21/22. "Nothing records whether the enclosure has been unclamped, re-clamped or rotated since" (fixture).

## Assumptions and unknowns

| item | value | frame / qualifier | source | status |
|---|---|---|---|---|
| Fitted tool | spindle touch probe | n/a | operator (prompt) | given |
| Probe protrusion for clearance | 75 mm | overall length, an upper bound | operator (prompt) | given. Recorded with `set_active_tool` (source operator) |
| Probe effective length for surface conversion | 70.9 mm | trigger-to-ball, 2026-09-29 fitting | fixture | **disagrees with 75 by 4.1 mm (> 0.3), so ask (Q3)** whether it is still this fitting |
| Probe tip (ball) diameter | 2 mm | operator-stated 2026-09-29 | fixture | given |
| Exposed stylus length / probe body diameter | unknown | n/a | n/a | **Q3**. If not given, grid drops are capped at 5 mm |
| Motion floor / park height | 320 / 328 | machine toolhead Z | fixture | given |
| Probe tip at Z328 / Z320 | physical 253 / 245 (with 75); 257.1 / 249.1 (with 70.9) | physical, derived | derived | clearance figures |
| Landmark requirement | 328 for both boxes | legacy toolhead basis | fixture | binding. 328 passes (equal passes), 320 does not inside either box |
| Tailstock height | unmeasured | n/a | fixture note | treated as a keep-out volume (Y<110, X140..200) up to 328 |
| Workpiece | "the enclosure" = the QuadEink enclosure on the rotary (assumed) | B-dependent | operator / job history | **Q2** |
| Clamping unchanged since 09-21/22 | unknown | n/a | fixture says unrecorded | **Q2**. Decides whether old contacts are reusable hints |
| Face / B for the screw hole | unknown (old jobs at B180, head now at B180) | B angle | n/a | **Q2** |
| B after homing | 0 | B | tool doc (`home` homes B) | derived. The enclosure turns 180 deg |
| Enclosure swept radius about the axis | unknown | mm | n/a | Q1 (optional; for the `rotate_b` swept check) |
| Camera identity (which cam is on the toolhead) | unknown | device by-id | fixture lists 2 | decided from frames: `preview_cameras` before and after homing |
| Camera offset / FOV / tilt | unknown | session state | n/a | solved by `camera_bootstrap`. **Never assumed** |
| Bed (wasteboard) physical Z | unknown | physical | n/a | Q4. Otherwise the coarse mosaic plane is the setter plate, 100.5 |
| Unmapped objects above ~physical 240 | unknown | physical | n/a | **Q4** (the floor 320 minus the 75 mm probe minus margin) |
| Enclosure top height near the tailstock | unknown | toolhead contact Z | n/a | measured by the find op in the fine program |
| Event budget of the fine probe program | ~4,400 estimated, > 2000 | events | derived (skill formula) | **Q5**: raise to 6000, or the grid shrinks |
| `camera_program` op field names | not in schema (`items: object`) | n/a | tools-list | best guess mirrors the standalone tools. A staging refusal would correct it |

## Questions for the operator (one batch)
1. **Homing.** The controller is not homed, so nothing can move until it is. `home` raises Z first from Z296. It then drives X/Y to home (X-19 Y342 Z328) and homes **B from 180 to 0, so the enclosure will rotate half a turn**. Is it free to turn: no loose clamps, cables or tools near it? **May I home?** Optional: give the largest radius of the enclosure plus its clamping about the rotary axis. I'll use it for the swept-radius check when I turn B back.
2. **Workpiece.** Is "the enclosure" the QuadEink enclosure on the rotary, the part probed on 2026-09-21/22 (jobs 031c3eb1fe38 / d677bd88d31a)?
   - Has it been unclamped, re-clamped or rotated since?
   - Which face gets the screw hole: B180 (as in those jobs) or B0?
   - If you know roughly where the hole goes (mm from the tailstock end, which side), say so. Otherwise I map a band about 30 mm deep at the tailstock end.
   - Is the tailstock still at ~Y95, with its bracket and handwheel inside Y<110?
3. **Probe length.** You said ~75 mm. The store says the effective length is 70.9, measured 2026-09-29 after a refit.
   - Is 75 your conservative *overall* figure for clearance (I'll use it for clearance), with the probe not refitted since 09-29 (I'll convert heights with 70.9)? If it has been refitted, or you're unsure, I'll add one tool-setter measurement (one more approval).
   - What is the exposed stylus length (and roughly the probe body diameter)? If I don't know, I cap every descent near edges at 5 mm.
4. **Bed.** Is anything on the bed that I have no landmark for (clamps, vises, lights, cables, the enclosure itself) taller than about physical Z240? At the floor Z320 the probe tip is at about 245. If you know the wasteboard height in physical machine Z, tell me. Otherwise I register the coarse mosaic on the setter plate (100.5).
5. **Event buffer.** The fine touch-probe program (find + 7x5 grid) is estimated at ~4,400 events, and the limit is 2000. May I ask you to raise it to 6000 (Settings → MCP Server → Diagnostic buffers)? If not, I shrink the grid to 4x3.
6. **Fine-survey scope.** By default the fine survey is a touch-probe height map of the tailstock end (Z for the screw hole) plus a camera survey on that measured plane (XY edges). Or do you want camera only?
7. **Contingency (answer only if you like).** The camera solve sweeps Z from 328 down to 320 at a few poses. Any pose inside the tool-setter box is dropped, because its legacy clearance is 328. If too few poses survive, may I re-state the `tool-setter` landmark with `obstacle_top_z` = the air-blast post top? The store says "~106.9"; please confirm that figure. That would require toolhead Z 186.9 or higher with the 75 mm probe. Default: no change.
8. **Basic check (optional, machine idle).** Deflect the stylus once by hand and tell me whether the **Probe** pill in Workspace → Connection flashes and clears. Nothing is moving, so it cannot trip an alarm. Please keep the door shut and hands clear during every approved job. You can watch live at https://192.168.1.153:40890/camera.

## Plan by phase

**Phase 0: basic checks (read-only, plus one no-motion state write, plus homing on your word).**
- Purpose: establish connection, position of record, homed state, probe feed, camera identity, active tool and prior evidence.
- Heights: no motion until homing. `home` lifts Z straight up from 296 to 328 first. That is a Z-only move inside the rotary box, which is allowed. XY then travels at the top, and B goes to 0.
- Approvals: none. `home` runs on the call, on the operator's yes to Q1.
- Expected: `isHomed true`, machine (-19, 342, 328), B 0, `reliability` verified or heartbeat. The toolhead camera is identified because its view changes with the head. The fixed camera's view does not change in the same way.

**Phase 1: camera alignment/calibration (`camera_bootstrap` search + poses, solve, verify).**
- Purpose: solve the toolhead camera from nothing, using the tool setter disc (79, 293, plate top 100.5) and the air-blast post (49.691, 280.707, ~106.9) as targets. Then verify against a pose held out of the fit.
- Heights: the search runs entirely at park Z328. That is at the legacy 328 of both boxes, so the crossings pass, and the tip is at physical 253. Pose sweeps run 328→320 with XY stationary. 320 is the motion floor, and any pose inside a 328 box is dropped by the tool, never adjusted.
- Approvals: 2 (search, poses). Plus 1 conditional `traverse_xy` if the head does not end at the held-out pose.
- Expected: the frames that contain the setter give the camera offset with its sign. The model is stored unverified, then verified with a residual of 8 px or less.

**Phase 2: coarse survey (`camera_program` → `survey_bed`).**
- Purpose: a whole-bed mosaic at B0 (after homing) to locate the enclosure, the tailstock, the chuck, clamps and anything unmapped.
- Heights: Z328 only (`machine_z` 328, `z_levels [328]`). At 328 no waypoint is dropped and no link needs lifting, because 328 meets every box's 328. A 320 pass would drop the whole rotary column, which is where the workpiece is.
- Approvals: 1.
- Expected: `mosaic_z328.jpg` + `index.json` in machine coordinates. It registers on one plane only, so raised objects are search hints with parallax, not positions.

**Phase 3: fine survey near the tailstock.**
- 3a, `probe_program`: `rotate_b` to the hole face if it is not B0, then a sensor-gated find of the enclosure top, then a stepped `surface_grid` over the tailstock-end band.
  - Hops are at 328. The find column lies wholly inside the rotary box, which is allowed. The march is sensor-gated and bounded at 140 mm (lowest toolhead 188, so the tip stays above the historical axis height).
  - Between stations the stepped link is at last contact + 2 mm; that is the sanctioned surface envelope. Drops are capped by the stylus reach.
  - Transient `keep_out` volumes cover the tailstock (Y<110) and the chuck jaws (Y≥269), both up to 328.
  - Approvals: 1.
  - Expected: top contact Z, `zMatrix`, plane tilt, flatness, and edge or pocket transitions (no_contact stations). Physical = Z − 70.9.
- 3b, `camera_program` → `survey_bed` over the same band. Toolhead bounds come from `plan_view_pose` at the **measured** plane. Heights are `z_levels [328, 320]`; waypoints inside the 328 boxes are dropped at 320 and kept at 328. Overlap is 0.5.
  - Approvals: 1.
  - Expected: a plane-correct mosaic of the tailstock end, to read edges and features in machine XY for the future screw hole.
- No cut is staged. The report ends the plan.

## Steps
1. `get_connection_status {}` returns connected, A350, machineReady (fixture).
2. `get_position {}` returns heartbeat, IDLE, warnings [], isHomed false, Z296, B180 (fixture).
3. `get_active_tool {}` returns null (fixture).
4. `get_stored_state {}` returns landmarks, limits, geometry, camera and probe feed as in the state block (fixture).
5. `get_camera_model {}` returns no model, so the next step is camera_bootstrap (fixture).
6. `list_cameras {}` returns two devices (fixture). `stream_url` goes to the operator.
7. `get_mcp_diagnostics {}` returns `jobEventLimit 2000` (fixture).
8. `get_probe_feed_status {}` is live-unknown beyond the stored snapshot. Branch:
   - All channels idle and `ok`: continue.
   - Any channel triggered, `unavailable` or disabled: stop and tell the operator. Never bypass.
9. `get_machine_profile {}` checks `connectedHead`, which is live-unknown. Branch: if it is not the CNC head, stop and ask.
10. `get_gcode_job_status {"job_id": "031c3eb1fe38"}` and `get_gcode_job_status {"job_id": "d677bd88d31a"}` retrieve the enclosure's earlier contacts. These are read-only. For each I record XYZ, B, probe length and date. They stay hints until Q2 confirms the clamping is unchanged; I never reinterpret them with today's probe length.
11. `preview_cameras {}` takes one frame per camera at the current pose (X150.2 Y210.4 Z296 over the rotary). I describe what each sees and keep both frame_ids.
12. `set_active_tool {"protrusion_mm": 75, "source": "operator", "tool_identity": "spindle touch probe", "note": "Operator 2026-10-04: touch probe fitted, overall length ~75 mm stated as the safe assumption; used for clearance only. Calibration for surface heights stays probe_effective_length 70.9 (job 5ce60989dc03, 2026-09-29) pending operator check."}`. This is a no-motion write. It equals the existing 75 mm worst case, so no clearance shrinks. Then `get_active_tool {}` to read it back.
13. Reply: the state block, the camera stream link, and the question batch above (Q1–Q8). [WAIT]
-- end turn --
14. Read the answers.
    - Q1 "no": stop. Nothing can move un-homed. I report the read-only findings, the camera previews and the retrieved evidence.
    - Q2 says the setup changed: old contacts are history only.
    - Q3 says refitted or unsure: add steps 20a–20c.
    - Q6 says camera only: skip step 34 and plane the fine camera survey on the evidence or coarse estimate, stating the uncertainty.
15. `get_position {}` re-checks reliability, idle and warnings, since time has passed.
    - `awaiting-resync`: re-read after ~3 s.
    - `machine-frame`: `restore_work_frame {"reason": "controller left in G53"}`, then re-read.
    - `stale`: go to Recovery.
16. One sentence before the call: "Homing now: Z rises first, then X/Y, and B goes 180 to 0, so the enclosure will turn half a turn." Then `home {}` (operator's Q1 yes is the authority; no confirm page). It blocks ~15–20 s.
17. `get_position {}` should show `isHomed true`, machine ≈ (-19, 342, 328), B 0 and a reliable reading. If not, go to Recovery.
18. `preview_cameras {}` again. The camera whose view changed with the head is the toolhead camera; at home it should see the enclosure's silver extrusion up close. The fixed/wide camera shows the same scene with the head moved.
19. If the toolhead camera is NOT the pinned Generic device: `select_camera {"device": "<toolhead camera by-id from step 18>", "confirm_frame_id": "<its frame_id from step 18>", "reason": "Toolhead camera identified by its view changing with the head between pre- and post-home previews"}`. This is no motion. If the toolhead camera is already pinned, skip this step. If neither or both views changed in an ambiguous way, ask the operator to name the camera and use `operator_confirmed` only on their word.
20. (Only if Q3 = refitted/unsure)
    - 20a. `run_tool_setter {"bit_length_mm": 70, "accept_probe_contact": true, "sensor_delay_ms": 50, "reason": "Re-measure touch probe effective length after possible refit; setter plate top 100.5"}` [APPROVAL]. Reply with the URL as the last line.
    - -- end turn --
    - 20b. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` (background) [WAIT]. Then `get_gcode_job_status {"job_id": "<id>", "wait_ms": 110000, "since_event": <n>}` until it ends. `result.finalZ` should be 328.
    - 20c. `set_probe_geometry {"probe_effective_length": <median trigger Z − 100.5>, "reason": "run_tool_setter job <id>, 2026-10-04"}`. Then `get_active_tool {}`: if the run replaced the operator's 75 with a shorter measured value, re-assert `set_active_tool` with 75 (source operator), because 75 is the clearance bound the operator asked for.
21. `camera_bootstrap {"stage": "search", "reason": "Solve the toolhead camera from nothing: serpentine grid at park Z328 bracketing the tool setter (79, 293) to find which frames contain the gold disc and so the camera offset and its sign", "reach_mm": 200, "pitch_mm": 40, "y_span_mm": 80}` [APPROVAL].
    - The X band is 79±200, so the tool clips the low end to travel X-19 and reports it. The Y band is 253..333.
    - Everything runs at 328, which meets both boxes' legacy 328.
    - Reply: "Approving runs the camera search grid at Z328 only; the B axis does not move." The URL is the last line.
-- end turn --
22. `start_gcode_job {"job_id": "<search id>", "wait_for_approval_ms": 110000}` in the background [WAIT]. Re-call on `timed_out`; never restage. Long-poll `get_gcode_job_status {"job_id": "<search id>", "wait_ms": 110000, "since_event": <next_event_index>}` to `ending.kind: completed`.
23. Read the frame index. Mark which frames contain the setter disc, with the pixel position of the disc in each. Derive the coarse offset o = (ground point at frame centre) − (toolhead XY) at Z328, sign included.
    - Branch: no frame shows the disc, which means the wrong camera or too narrow a band. Report it and restage the search with `reach_mm` 300 / `y_span_mm` 160 (one more approval), or ask the operator. Never guess an offset.
24. `camera_bootstrap {"stage": "poses", "reason": "Perspective solve: setter and air-blast post viewed from four poses, Z swept 328 to the floor 320 in 2 mm steps with XY stationary; pose T4 is held out of the fit for verification", "poses": [...], "step_mm": 2, "floor_z": 320}` [APPROVAL]. The poses list:
    - `{"label": "T1 setter centred", "x": 79 − ox, "y": 293 − oy}`
    - `{"label": "T2 setter left", "x": 79 − ox + d, "y": 293 − oy}`
    - `{"label": "T3 setter low", "x": 79 − ox, "y": 293 − oy − d}`
    - `{"label": "T4 post centred (held out)", "x": 49.691 − ox, "y": 280.707 − oy}`

    Here d is about a third of the frame width, measured on the search frames. All are numeric values from step 23, rounded to 0.1 mm. T4 is deliberately last.
    - Reply: one sentence saying "XY moves only at 328; Z sweeps 328→320 with XY still; poses inside a 328 box are dropped". The URL is the last line.
-- end turn --
25. `start_gcode_job {"job_id": "<poses id>", "wait_for_approval_ms": 110000}` (background) [WAIT]. Then `get_gcode_job_status` long-poll to completed. Read the `dropped` list.
    - Branch: fewer than 2 fit poses plus T4 survive. If Q7 was yes, `set_landmark {"name": "tool-setter", "description": "<existing description>", "x0": 38, "y0": 269, "x1": 89, "y1": 303, "obstacle_top_z": <operator-confirmed post top>, "notes": "re-stated from legacy clearance_z 328, operator 2026-10-04"}` and restage step 24 (one more approval). If Q7 was no, report and stop the camera phase.
26. Run `python .agents/skills/cnc-visual-alignment/scripts/camera_bootstrap.py <bootstrap frame directory>` on T1–T3 only. Detection-failure frames get `--marks` with hand-marked pixels. The result is a model JSON with residuals, `valid_band_z` [320, 328], `central_region` and `k1` (null if unconstrained).
27. `set_camera_model {"offset": {...}, "rotation": [[...]], "intrinsics": {"fx": .., "fy": .., "cx": .., "cy": .., "k1": null}, "valid_band_z": [320, 328], "central_region": <from fit>, "residuals": {"rms_px": .., "max_px": .., "rms_mm": .., "n_points": .., "n_poses": 3}, "survey_id": "<poses job id>", "targets": ["tool-setter disc (79, 293, 100.5)", "air-blast post (49.691, 280.707, ~106.9)"]}`. It is stored UNVERIFIED.
28. `get_position {}`.
    - Head at T4 (any Z in 320..328, reliable): `capture_frame {}`, locate the post centre with `track_feature` against a T4 bootstrap frame, then `verify_camera_model {"target": {"x": 49.691, "y": 280.707, "z": 106.9}, "pixel_u": <u>, "pixel_v": <v>, "tolerance_px": 8, "note": "air-blast post at held-out pose T4; post top is approximate (~106.9)"}`. Also verify the setter disc (79, 293, 100.5) if it is in the same frame; it is the better-known height.
    - Head elsewhere: stage `traverse_xy {"x": <T4x>, "y": <T4y>, "coordinate_system": "machine", "reason": "Place the camera at held-out pose T4 to verify the new camera model"}` [APPROVAL] (conditional). Its precondition is the head at ≥320. Send the URL and end the turn, then `start_gcode_job` [WAIT], then the capture and verify above.
    - Verify fails: the model stays unverified. Re-solve with all poses and a fresh held-out pose, or re-bootstrap. Phases 2/3b then run with `pitch_mm` and no overlap or mosaic claims.
29. `camera_program {"name": "Coarse bed survey Z328", "reason": "Whole-bed camera mosaic at park height to locate the enclosure, tailstock, chuck, clamps and anything unmapped; B stays 0", "ops": [{"kind": "survey_bed", "machine_z": 328, "z_levels": [328], "overlap_fraction": 0.3, "plane_z": <Q4 wasteboard physical Z, else 100.5>, "margin_mm": 10, "reason": "coarse bed survey"}]}` [APPROVAL]. The bounds are the travel inset by 10 (X -9..329, Y 10..332). The reply reads the frame count and duration off the confirm page, and the URL is the last line.
-- end turn --
30. `start_gcode_job {"job_id": "<coarse id>", "wait_for_approval_ms": 110000}` (background) [WAIT]. Then `get_gcode_job_status` long-poll to completed.
31. Read `mosaic_z328.jpg` + `index.json`. Identify the enclosure, the tailstock, the chuck, clamps, and any object not in the landmark store (flag each to the operator; never record identities by analogy).
    - From the mosaic, pick the find point F, a spot on the enclosure top at least 10 mm inside its visible tailstock-end edge. The camera finds it; the march measures it.
    - Pick the grid band: X from the visible west edge + 8 to the east edge − 8, and Y from max(visible tailstock edge + 8, 120) to that + 30. If Q2 named a hole location, centre the band on it.
    - Branch: seams marked the model unverified. A wrong `plane_z` can also cause this. Re-verify at T4 (step 28 path, one traverse approval) before concluding the camera moved.
32. `probe_program` [APPROVAL], with these arguments:
```jsonc
{"name": "Enclosure tailstock-end top: find + height map",
 "reason": "Measure the enclosure top near the tailstock (future screw hole): one sensor-gated find, then a stepped 7x5 grid; probe 70.9 effective, 75 for clearance",
 "keep_out": [
   {"name": "tailstock bracket+handwheel", "machine": {"x0": 140, "y0": 0, "x1": 200, "y1": 110}, "clearance_z": 328},
   {"name": "chuck jaws", "machine": {"x0": 140, "y0": 269, "x1": 200, "y1": 342}, "clearance_z": 328}],
 "ops": [
   {"id": "rot", "kind": "rotate_b", "b": 180, "swept_radius_mm": <Q1 radius, omit if not given>},   // only if Q2 says the hole face is B180
   {"id": "find", "kind": "sequence", "sensor_delay_ms": 50, "steps": [
      {"kind": "hop", "x": <Fx>, "y": <Fy>},
      {"kind": "probe", "name": "top", "dz": -1, "max_travel_mm": 140, "on_miss": "abort",
       "capture": {"label": "enclosure top find", "settle_ms": 500}}]},
   {"id": "grid", "kind": "surface_grid",
    "x_min": <Xw+8>, "x_max": <Xe-8>, "y_min": <max(Yt+8,120)>, "y_max": <y_min+30>,
    "x_count": 7, "y_count": 5,                       // 4 x 3 if Q5 declined
    "start_z_machine":    {"from": "find.top.z", "plus": 3, "between": [188, 325]},
    "expected_z_machine": {"from": "find.top.z", "between": [188, 325]},
    "floor_z_machine":    {"from": "find.top.z", "minus": <R>, "between": [150, 325]},
    "hop_mode": "stepped", "hop_lift_mm": 2, "max_drop_mm": <R>, "sensor_delay_ms": 50,
    "capture": {"stations": [1, 18, 35], "label": "tailstock-end patch", "settle_ms": 500}}]}
```
    - R = exposed stylus − 2 (ball) − 2 (margin) from Q3, else 5 mm.
    - Event estimate: 100 + 35×110 + ~420 for the find ≈ 4,400. The tool refuses staging above the limit and names the number.
    - The reply reads the page's B schedule, bounds and event figure. The URL is the last line.
-- end turn --
33. `start_gcode_job {"job_id": "<fine probe id>", "wait_for_approval_ms": 110000}` (background) [WAIT]. Then `get_gcode_job_status` long-poll with `since_event`.
    - Read `result.ops`: the find contact Z, the grid `zMatrix`, the plane tilt, flatness, `no_contact` stations and the captures.
    - Physical = toolhead Z − 70.9 (or the step-20 value). B is the B of `rot`.
    - Branch, find missed (on_miss abort): the program ended raised at 328. Report it; no blind second try.
34. Compute the plane P = median grid contact Z − 70.9 (physical).
    - `plan_view_pose {"target": {"x": <band corner>, "y": <band corner>, "z": P}, "toolhead_z": 328}` for the 4 band corners, and again with `"toolhead_z": 320`.
    - Take the union of the toolhead XY bounds plus half a field of view. Any clipping to travel is reported.
35. `camera_program {"name": "Fine camera survey: enclosure tailstock end", "reason": "Plane-correct mosaic of the measured enclosure top near the tailstock, for locating the screw hole later", "ops": [{"kind": "survey_bed", "machine_z": 328, "z_levels": [328, 320], "overlap_fraction": 0.5, "plane_z": <P>, "x_min": .., "x_max": .., "y_min": .., "y_max": .., "reason": "fine survey on plane P"}]}` [APPROVAL]. The reply says that 320-level waypoints inside the 328 boxes will be dropped, never lowered past. The URL is the last line.
-- end turn --
36. `start_gcode_job {"job_id": "<fine cam id>", "wait_for_approval_ms": 110000}` (background) [WAIT]. Then `get_gcode_job_status` long-poll to completed. Read `mosaic_z328.jpg`, `mosaic_z320.jpg`, `index.json` and `dropped`.
37. Report fine-survey results:
    - Enclosure top at the tailstock end: toolhead Z, physical Z, tilt, flatness and step/pocket transitions, with ±pitch/2 on the transitions.
    - Edges and features in machine XY from the plane-P mosaic, with uncertainty.
    - B angle, probe calibration used, date, and job ids.
    - Offers, each needing the operator's word:
      - record the enclosure and tailstock as landmarks;
      - choose and probe a milling datum before the probe comes out (work-datums reference);
      - stage nothing further.

    No cut is staged.

## Recovery
- **Any procedure abort** (`ending.kind` not `completed`):
  - The server raises straight up to 328 unless the probe still reads contact. On a hold, the operator frees the probe; I never command motion against a held contact.
  - Then `get_position`. If the head is below 328 and not held, I ask "may I raise Z first?" and stage `move_z {"z": 328, "coordinate_system": "machine", "reason": "recover to park height after abort"}`.
  - Then re-prove the position and re-plan from the verified state. Never "return to the start height".
  - Partial results in `result` are kept and reused; only the gap is re-measured.
- **Crash or overtravel alarm:** the job stops and the connection closes. Only the operator clears it (Workspace → Connection → Clear alarm, or `clear_overtravel_alarm` on their explicit word). Then `get_connection_status` and `get_position`, and I re-home only with their word, noting that B turns.
- **Position unreliable:**
  - `awaiting-resync`: re-read after ~3 s, up to ~10 s.
  - `frame: machine-frame`: `restore_work_frame`, not a re-home.
  - Still rejected, or `stale`: `get_mcp_diagnostics` (connection + machinePosition) and `query_firmware_position`, then `recover_machine_connection` to preserve evidence and restart polling. Never pair, send `/connect` or touch credentials; if recovery refuses, the operator reconnects in Luban.
- **Camera trouble:**
  - Device vanished: report it; never substitute.
  - Seams mark the model unverified: stop metric use, re-verify at T4 (one traverse approval). If verification fails, re-bootstrap. No pose arithmetic in between.
- **A reference resolves out of bounds** in the probe program: the runner refuses that op and stops raised with earlier ops kept. I report the value and do not widen the bounds without a measurement.
- **`start_gcode_job` times out:** call it again. A timeout means nothing has happened yet, so never withdraw or restage because of it.

Counts: logical approvals=5 (search, poses, coarse camera_program, fine probe_program, fine camera_program; up to 7 with the conditional tool-setter run (step 20a) and verify traverse (step 28), plus a restaged search/poses only on failure), literal [APPROVAL] tags=7 (5 unconditional + 2 conditional), operator waits=8 tagged [WAIT] (question batch + 5 confirm-page clicks unconditional = 6; + 2 conditional clicks), question batches=1
