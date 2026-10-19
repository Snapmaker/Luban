# Bed + enclosure survey: home, solve and verify the camera at Z328, coarse bed mosaic, then a fine camera + touch-probe survey at the tailstock end of the enclosure (no cut staged)

## State block (from the fixture)
- get_connection_status: `connected: true, sstp-http, wifi, A350, machineReady: true`
- get_position: machine X150.2 Y210.4 **Z296.0** B180.0, reliability `heartbeat`, frame `work-offset`, warnings [], **`isHomed: false`**, IDLE, originOffset (-118.8, -77.2, -79.0), reportAgeMs 900 ("controller has not been homed since Luban reconnected"). Z296 is BELOW the motion floor (320) and the head sits inside the rotary-axis box (X140..200).
- get_active_tool: `active: null` (no tool confirmed; planners fall back to the legacy worst case)
- get_stored_state.limits: `maxJogDistanceMm 100, safeTraverseZMm 328, motionFloorZMm 320`; travel X -19..339, Y 0..342 (stated 2026-09-20)
- landmarks: `tool-setter` X38..89 Y269..303 legacy clearanceZ 328; `rotary-axis` X140..200 Y0..350 legacy clearanceZ 328 (tailstock live centre ~Y95, keep-out Y<110; chuck face ~Y300-310); both on the legacy (toolhead) basis
- landmarkClearances.toolProtrusionMm 75 (longest-bit); toolSetter triggerZ 175.5 with reference bit 75, so setter plate top = 100.5 physical
- geometry: probe_effective_length 70.9 (job 5ce60989dc03, 2026-09-29), probe_tip_diameter 2, rotary_axis_x 170.1, rotary_axis_z_physical 112.4 (undated, historical), rotary_tailstock_y UNSET, rotary_chuck_face_y UNSET
- get_camera_model: `model null, usable false, state unverified, next camera_bootstrap`; calibrations []
- cameras: two attached (pinned Generic USB Camera `...usb-Generic_USB_Camera_200901010001-video-index0`; and icSpring); stream enabled
- probeFeed: gpio, connected, toolsetter/overtravel/probe channels enabled and idle, `ok: true`
- job history: 031c3eb1fe38 (enclosure pocket outline, B180) and d677bd88d31a (closed perimeter trace), 2026-09-21/22; nothing says whether the enclosure was moved since.

## Assumptions and unknowns
| item | value | frame / qualifier | source | status |
|---|---|---|---|---|
| Fitted tool | touch probe | in spindle | operator | stated; protrusion to confirm (Q2) |
| Probe length for CLEARANCE | 75 mm | protrusion below toolhead (operator said "overall length"; may include collet shank) | operator | used as the cautious number; Q2 confirms it is a protrusion |
| Probe length for CONTACT maths | 70.9 (measured) .. 75 (assumed) | tip physical Z = toolhead Z - L | fixture / operator | unresolved: plan uses 75 for start heights (higher, safe) and 70.9 for the search floor (lower, safe); stored 70.9 is never overwritten |
| Motion floor / park | 320 / 328 | machine Z, toolhead | fixture | known. traverse_xy's own description says it needs >= 328 while TOOLS.md says 320; every XY in this plan is at 328 so both hold |
| Rotary-axis and setter box clearance | 328 each (legacy toolhead basis) | machine Z, toolhead | fixture | known: XY over X140..200 below 328 is dropped/refused, so every camera pass over the workpiece runs at exactly Z328 |
| Physical tip height at Z328 | 328 - 75 = 253 | physical Z | derived | safe only if nothing unmapped is taller than ~253 (Q3) |
| Camera offset, look direction, FOV | unknown | camera on toolhead | live-unknown | solved by camera_bootstrap; the README's "-X 90-150" is stated there as rig-specific and is NOT used |
| Camera identity | pinned Generic USB camera, unconfirmed as the toolhead camera | | fixture | check with preview_cameras |
| Enclosure position, top Z, B face, clamping | unknown/stale | machine | job history 09-21/22 | read from the job reports; operator confirms unchanged (Q4) |
| Hole location "near tailstock" | unknown | machine XY | operator | needed for the fine region (Q4) |
| Tailstock bracket/handwheel height and X/Y extent | "above stock top", height unknown; Y<110 keep-out | physical | fixture (landmark note) | Q3 |
| rotary_tailstock_y | unset (note says ~Y95) | machine Y | fixture | stored only from an operator figure |
| B now | 180.0 | | fixture | `home` rotates B to 0 (Q1) |
| camera_program op field names | undocumented (ops items are bare `object`) | | tools-list | not used; documented survey_bed is used instead |

## Questions for the operator (one batch)
1. `home` is required first (not homed; Z296 is under the floor) and it drives B from 180 to 0, so the enclosure WILL rotate. OK to home? Confirm toolhead off, door closed, nothing on the rotary that sweeps into anything, probe not touching anything.
2. Probe: please confirm it is fitted and that 75 mm is how far it protrudes below the spindle nose (not overall length including the part inside the collet). Last measured effective length was 70.9 (2026-09-29). I will record 75 via set_active_tool as an operator assertion (clearance only) and leave 70.9 stored.
3. Is anything on the bed, enclosure or rotary taller than ~253 mm physical (head at Z328 less the 75 mm probe) that is not a stored landmark? What are the physical top and the X/Y extent of the tailstock bracket and handwheel?
4. Is the enclosure still clamped as on 2026-09-21/22 (not unclamped, re-clamped, rotated)? Which face (B angle) takes the screw hole, roughly where (machine X/Y, or "N mm from the tailstock-end edge"), and what are the tailstock Y and chuck face Y if you know them (I can store them with set_probe_geometry)?

-- end turn --

## Plan by phase

### Phase 0 - basic checks (read-only, no approval)
Purpose: confirm the fixture is still true and learn what is live-unknown. Re-read position/connection/active tool; machine profile (`connectedHead`), tool-setter config, probe-feed status; list and PREVIEW both cameras to see which is on the toolhead; pull the 09-21/22 enclosure job reports for the enclosure XY box, top contact Z, B and the probe length used. Branches: reliability not heartbeat/verified/cached-offset -> wait ~2 s and re-read (home is not the cure); probe feed not ok -> stop and ask; preview shows the pinned camera is not the toolhead one -> ask the operator which device, then `select_camera` with `confirm_frame_id` from the preview (the model is already unverified).

### Phase 1 - safe state
`home` after the operator's yes (Z rises first, then G28; B goes to 0). Expect `isHomed: true`, head at the park height (Z328). Then `set_active_tool` 75 / operator. The head is inside the rotary box at Z296 now, but home's first motion is straight up, so no XY happens below 328. If the operator refuses to rotate B, the plan stops here: home is the default first step and the only alternative is their explicit confirmation of current Z and a clear path.

### Phase 2 - camera alignment/calibration (Z328 for all XY; sweeps 328 -> 320 only with the toolhead outside the stored boxes)
Purpose: solve and verify the camera from nothing; no pixel arithmetic before that.
- Search stage: serpentine at the park height bracketing the tool setter (79, 293): `reach_mm` 200, `pitch_mm` 40, one row. Z328 meets both the rotary and setter legacy clearances, so nothing is dropped for Z.
- Solve offline with `scripts/camera_bootstrap.py` on the machine-indexed frames (hand-marked pixels allowed if detection fails); read the coarse offset and its sign.
- Poses stage: 2-3 X- and Y-separated TOOLHEAD poses (setter plate top 100.5; optionally the air-blast post top ~106.9 at (49.691, 280.707)), `step_mm` 2, `floor_z` 320: Z328, 326, 324, 322, 320 with XY stationary. A pose whose toolhead position lies inside a stored box is dropped with a reason (below 328 the rotary box and setter box are volumes), so poses are chosen from the coarse offset with the TOOLHEAD outside those boxes while the CAMERA looks at the targets. Tip at Z320 is 245 physical; the known low features top out at ~137 (stale stock top) / 106.9 / 100.5.
- Store with `set_camera_model`, then prove it at a hold-out pose (not in the fit) at Z328: `traverse_xy`, capture, locate the setter pixel (track_feature or hand-marked), `verify_camera_model` target (79, 293, 100.5). A second independent target if visible. Pass = state `verified`, residual <= 8 px (the default).
- Failure: over tolerance -> model stays unverified (camera probably knocked or poor solve): re-run poses once with wider separation; second failure -> stop and report, and do the coarse survey as a plain-frame survey with no metric claims.

### Phase 3 - coarse survey
Purpose: whole-bed mosaic to locate the enclosure and fixtures and check them against the landmarks. `survey_bed` with `machine_z` 328 (asserted before any XY), `z_levels [328]`, default bounds (travel inset 10), `overlap_fraction` 0.3, `plane_z` = enclosure top physical Z from the job reports (a frame cannot tell its own depth), `pitch_mm` as cap. 328 is the only level legal over the rotary and setter boxes; 320 would drop every waypoint above the workpiece. One approval. Expect `mosaic_z328.jpg`, `index.json`, empty `result.dropped` (anything dropped is reported and read), `result.clipped` if bounds exceed travel. If the enclosure is not where the 09-21/22 reports put it, stop and ask; the probe phase would need fresh figures.

### Phase 4 - fine survey, tailstock end of the enclosure
(a) Camera: `survey_bed` over only the tailstock-end region (bounds from Q4), `machine_z` 328, `z_levels [328]`, `overlap_fraction` 0.5, `plane_z` as above. One approval. `plan_view_pose` (read-only) sanity-checks that the region is viewable from a reachable toolhead pose.
(b) Touch probe, height map. `probe_surface_grid` has no keep-out argument, so the grid is one `surface_grid` op inside a `probe_program` with a transient `keep_out` volume for the tailstock (X140..200, Y0..110, clearance_z 328, until Q3 gives real figures). Region = hole area plus ~10 mm margin; `pitch_mm` 5 (far under the 60 mm hop cap; keep stations under ~50), `hop_mode` guarded, `z_safe_delta_mm` 5, `max_drop_mm` 14. With P = enclosure top physical Z (report contact Z minus the probe length that report used, or the operator's figure): `start_z_machine` = P + 75 + 5 (tip at least 5 mm above the surface even for the longest probe; approach is raise to 328, traverse, guarded 1 mm descent); `floor_z_machine` = P + 70.9 - 8 (finds a surface up to 8 mm lower than expected for the shortest probe; no contact = `no_contact`, and station 1 finding nothing aborts). Ends raised at 328. Expect zMatrix, best-fit plane, flatness, ASCII height map, a few station photos. No cut is staged.
If the hole face is not at B0 (homing leaves B0; the stored pocket was B180), insert one small `probe_program` with a `rotate_b` op first and repeat the camera pass at that B: one more approval.

## Steps
1. get_connection_status, get_position, get_active_tool, get_machine_profile {}, get_tool_setter_config, get_probe_feed_status (read-only batch)
2. list_cameras {}; preview_cameras {} (look at both frames; decide which is the toolhead camera; branch per Phase 0)
3. get_inspection_report {job_id:"031c3eb1fe38", format:"json"} and {job_id:"d677bd88d31a", format:"json"} (enclosure box, top contact Z, B, probe length used)
4. Send the question batch [WAIT]
-- end turn --
5. (after yes to Q1) home {} - direct call, Z up first, B -> 0; then get_position: need `isHomed: true`, reliability heartbeat/verified/cached-offset, Z ~328
6. set_active_tool {protrusion_mm: 75, source: "operator", tool_identity: "touch probe", note: "operator-stated ~75 mm, conservative vs setter-measured 70.9 (2026-09-29); clearance only"}; get_active_tool to read back
7. (if Q4 gave them) set_probe_geometry {rotary_tailstock_y:<Y>, rotary_chuck_face_y:<Y>, reason:"operator-stated 2026-10-04"}; otherwise skip
8. get_camera_model {} (expect unverified); camera_bootstrap {stage:"search", reason:"Solve camera offset and sign from the tool setter at the park height", reach_mm:200, pitch_mm:40, y_span_mm:0} [APPROVAL]
-- end turn --
9. start_gcode_job {job_id:<search job>, wait_for_approval_ms:110000}; long-poll get_gcode_job_status {job_id, wait_ms:30000} to a terminal state; read `ending` (any unexpected-contact or alarm -> Recovery)
10. Run scripts/camera_bootstrap.py on the saved search frames; read the coarse offset incl. sign; pick 2-3 toolhead poses per target with the TOOLHEAD outside the setter and rotary boxes
11. camera_bootstrap {stage:"poses", reason:"Z sweep 328 to 320 at stationary XY for perspective", poses:[{label:"setter-a",x:<>,y:<>},{label:"setter-b",x:<>,y:<>},{label:"setter-c",x:<>,y:<>}], step_mm:2, floor_z:320} [APPROVAL]
-- end turn --
12. start_gcode_job {job_id, wait_for_approval_ms:110000}; get_gcode_job_status long-poll; read dropped poses and reasons
13. Solve with scripts/camera_bootstrap.py; set_camera_model {offset, rotation, intrinsics, valid_band_z, central_region, residuals} (stored unverified)
14. traverse_xy {x:<hold-out pose X>, y:<hold-out pose Y>, coordinate_system:"machine", reason:"Hold-out pose to verify the camera model at the park height"} [APPROVAL]
-- end turn --
15. start_gcode_job {job_id, wait_for_approval_ms:110000}; get_position (Z still ~328); capture_frame {}; locate the setter pixel; verify_camera_model {target:{x:79,y:293,z:100.5}, pixel_u:<>, pixel_v:<>, note:"tool setter plate centre"}; optional second target {x:49.691,y:280.707,z:106.9}; get_camera_model: need `verified`
16. survey_bed {reason:"Coarse whole-bed mosaic at the park height", machine_z:328, z_levels:[328], overlap_fraction:0.3, plane_z:<P>, pitch_mm:80} [APPROVAL] (model not verified: drop overlap_fraction and plane_z, use pitch_mm 60, plain frames)
-- end turn --
17. start_gcode_job {job_id, wait_for_approval_ms:110000}; status long-poll; read result.dropped / clipped, mosaic_z328.jpg and index.json; compare with the 09-21/22 enclosure box. Enclosure not where expected: ask the operator [WAIT]
18. (only if the hole face is not at B0) probe_program {name:"Rotate to hole face", ops:[{id:"rot",kind:"rotate_b",b:<angle>,require_z_at_least:328,swept_radius_mm:<operator figure>}], reason:"Present the screw-hole face for the survey"} [APPROVAL]
-- end turn --
19. (if 18) start_gcode_job {job_id, wait_for_approval_ms:110000} + status; confirm B on get_position; redo step 16 for that face if the mosaic is stale
20. survey_bed {reason:"Fine camera survey of the enclosure tailstock end", machine_z:328, z_levels:[328], x_min:<>, x_max:<>, y_min:<>, y_max:<>, overlap_fraction:0.5, plane_z:<P>, pitch_mm:40} [APPROVAL]
-- end turn --
21. start_gcode_job {job_id, wait_for_approval_ms:110000}; status; read the fine mosaic
22. probe_program {name:"Fine height map at tailstock end", keep_out:[{name:"tailstock", machine:{x0:140,y0:0,x1:200,y1:110}, clearance_z:328}], ops:[{id:"hole_area", kind:"surface_grid", x_min:<>, x_max:<>, y_min:<>, y_max:<>, pitch_mm:5, start_z_machine:<P+80>, floor_z_machine:<P+62.9>, z_safe_delta_mm:5, max_drop_mm:14, hop_mode:"guarded", capture:{stations:[1,<middle>,<last>], label:"hole area"}}], reason:"Height map of the enclosure top where the screw hole will be milled"} [APPROVAL] (a staging refusal naming a box/step is free: quote it and ask; never remove a landmark)
-- end turn --
23. start_gcode_job {job_id, wait_for_approval_ms:110000}; get_gcode_job_status long-poll; get_inspection_report {job_id, format:"json"}; report zMatrix, plane tilt, flatness, ASCII map, mosaic paths, any no_contact stations. Done; no cut staged.

## Recovery
- Any job aborts (`ending` not `completed`): stop, read get_gcode_job_status event log and partial result, then get_position; the runner raises to the park height on abort, so confirm Z ~328 before anything else; do not restage; report to the operator.
- Probe holds contact / `abort-held` / `unexpected-contact` / overtravel alarm: `stop_gcode_job`, read get_probe_feed_status, never lift by hand; ask the operator to inspect; `clear_overtravel_alarm` only on their explicit word; a Z-only raise via move_z only if they ask.
- Position `awaiting-resync` or `stale`: motion is refused; wait for the next coherent beat (~2 s); controller left in the machine workspace -> `restore_work_frame`; home is not the remedy. Connection loss: `recover_machine_connection`, re-read get_position.
- Camera model fails verification or the mosaic seams disagree (model marked unverified): stop metric use, re-run Phase 2 once, else plain frames only and tell the operator.
- Staging refused (landmark, floor, travel, unknown protrusion): quote the refusal; never loosen a clearance myself.

Counts: logical approvals=8 (home by operator's chat word + 6 confirm pages + 1 conditional rotate_b), literal [APPROVAL] tags=7 (6 unconditional + the conditional step 18), operator waits=2 (step 4; step 17 conditional), question batches=1
