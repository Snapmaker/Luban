# Luban MCP tool surface

Terse per-tool reference. Machines: A350 = CNC, F350 = printer. Staged motion needs
one operator click on the confirm page; direct-call exceptions are governed by
`cnc-motion-rules`. Results
quote coordinates with their frame (machine vs work). Call `get_stored_state` first in a fresh
session.

For a compact workflow and exact camera operation fields, see
[camera operations](../../../../../.agents/skills/cnc-camera-operations/SKILL.md).
One approval covers a complete bounded program/sequence; do not split safe internal steps into
separate confirmations. Unhomed transport/procedures refuse; `home` raises Z first and turns B.

## Orientation and status (read-only)

- `get_stored_state` — everything known in one call: calibrations, landmarks, tool region, limits, camera (incl. `camera.stream.stream_url`, the operator's live view), connection, probe feed. Start here.
- `get_connection_status` — is Luban connected to a machine, over what channel.
- `get_machine_profile` — kinematics, work envelope, toolhead module offsets and `connectedHead` (`headType`, `toolHead`, possibly null). `toolHeads` lists compatible heads, not the currently fitted one; generic `headType: "cnc"` alone cannot choose thread-milling spindle mode.
- `get_position` — the machine POSITION OF RECORD: judged machine coordinates with `reliability` (verified | heartbeat | cached-offset | awaiting-resync | stale), the frame it rests on and `reasons`, plus the raw work report and originOffset. Motion refuses unless verified/heartbeat/cached-offset; never derive machine = work − offset yourself.
- `query_firmware_position` — raw `M114`; use when `get_position` looks suspect. Empty replies and transport failures are errors.
- `query_firmware_configuration` — secondary read-only `M503 S` diagnostic of configuration currently in use, not necessarily EEPROM values. Prefer `M114` for fresh position.
- `recover_machine_connection` — automatically preserve a diagnostic snapshot, then verify the retained HTTP session with a status GET and restart heartbeat polling. Never sends `/connect`, changes credentials or initiates touchscreen pairing. Refuses missing/expired sessions; no raw-backend fallback. Re-read fresh position after recovery.
- `get_mcp_diagnostics` — event-loop stalls and timing evidence for slow or aborted procedures; `connection` contains server/build identity, attempt/session IDs, worker lifecycle, poll/report ages, recent events and pre-recovery snapshots; `machinePosition` counts rejected heartbeats by reason (out-of-bounds, frame-flip, no-offset-yet), resyncs and disconnects.
- `get_job_timing` — where a job's time went, from its event log; works for running, done and failed jobs.

## G-code jobs

- `convert_thread_milling_gcode {gcode, source_controller?, tool_center_path: true, tool_length_applied: true, spindle_mode, spindle_power_percent?, chord_tolerance_mm?}` — OFFLINE import of internal/external Machining Doctor exports to explicit absolute Snapmaker G0/G1. Requires zero cutter compensation and work Z already referenced to the fitted cutter. Choose `power_percent` with integer percentage 1–100 for the standard head, or `cnc_200w_rpm` to retain 8000–18000 source RPM on the 200 W head. Never auto-selects the head or rescales feeds. Returns `gcode`, `changes`, `warnings`, `sourceSpindleRpm`, arc/full-circle/segment counts and `validation`; no connection, staging, origin write or motion. Review, then submit the converted text with `head_type: "cnc"`, `frame: "work"`. See [thread-milling guide](thread-milling.md) and [agent skill](../../../../../.agents/skills/cnc-thread-milling/SKILL.md).

- `validate_gcode` — static inspection: extents, spindle state, distance-mode hazards, and the FRAME the job declares (G53 own-line = machine, G54..G59.3 = work; inline `G53 G0` flagged - the firmware ignores it; G92 flagged). Free, run before submitting.
- `submit_gcode_job {gcode, name, frame?: "machine"|"work", head_type?}` — stage a file job (the gcode TEXT, not a path); returns the confirm-page URL — deliver it to the operator as the last line of your message, alone. REFUSED unless the job declares its frame: `G53` on its own line before the first move (machine), or `G54..G59.3` in the file / `frame: "work"` for a Luban/slicer export (work; the file is never modified). `frame: "machine"` without a literal G53 is refused. The confirm page shows Frame and machine-resolved Z extents when resolvable. A file that selects only `G54` before its first move (converted thread-milling output) shows machine Z "if G54 is the active workspace" (`machineZResolvedFor: "G54"`); `start_gcode_job` then selects G54 with no motion and refuses to stream unless its offset Z matches staging. Other named workspace selectors, mixed frames and origin writes leave machine extents unresolved: one live offset cannot establish every section; review each required workspace separately.
- `start_gcode_job {job_id, wait_for_approval_ms?, wait_ms?, confirm_token?}` — after delivering the confirm URL and ending the staging turn, call with `wait_for_approval_ms` (e.g. 110000): the operator's click on the confirm page starts the job; `approved: false, timed_out: true` means call again, never restage. A file job with `machineZResolvedFor` first selects that workspace (no motion) and verifies its offset; a mismatch ends it `workspace-unverified` with nothing streamed - verify the workspace, then restage. Procedures return the result if it lands within `wait_ms` (default 25 s), else `running` — long-poll `get_gcode_job_status`.
- `get_gcode_job_status {job_id, wait_ms?, since_event?}` — event log plus stored result and `ending` (why it ended: completed | stopped-by-agent | stopped-by-operator | withdrawn | rejected-by-operator | crash-alarm | overtravel-alarm | unexpected-contact | controller-rejected | workspace-unverified | timeout | operation-failure | machine-stopped | completion-unverified, with reason and measured count); a stopped or failed procedure keeps every completed station under `result`. Long-poll with `wait_ms` / `since_event` instead of spinning.
- `stop_gcode_job` — procedures stop cooperatively at the next step and raise; file jobs get a firmware stop. Partial result kept.

## Transport and direct motion

- `home {ignore_stale_position?: boolean}` — machine home (`G53;G28;G54`; also homes B). Default first step after (re)connecting; raises Z first and clears the NOT-HOMED state. It is not a remedy for a `get_position` reliability of `awaiting-resync` or `stale` — a rejected or aged beat is a reporting fault, not a position fault, and motion is refused until the record recovers on its own (next coherent beat, ~2 s).
- `set_workspace_origin {workspace, origin_machine: {x,y,z}, datum_reference, reason}` — HUMAN-GATED replacement of all XYZ in an explicit G54–G59.3 workspace. Origin is measured machine coordinates, with Z as TOOLHEAD Z for the fitted tool. No motion or need to visit zero. Checks unchanged staging state, requires firmware selection acknowledgement and two fresh readbacks; no B/E write or automatic rollback. Leaves the named workspace active and invalidates earlier staged jobs. See [workspaces](workspaces.md).
- `select_workspace {workspace, reason}` — HUMAN-GATED selection/readback of an existing G54–G59.3 workspace without rewriting its origin. Prefer one WCS; additional workspaces only when necessary, particularly for existing G-code jobs. Standard MCP procedures may reselect G54, so verify/reselect before submitting the file.
- `goto_work_origin` — STAGE XY to work X0 Y0 at the current toolhead Z; no automatic raise, Z0 descent, datum setting or physical registration check. The confirm page shows the MACHINE destination; untrusted offsets, insufficient transport height, travel and mapped landmark conflicts are refused. Check the actual route and fitted tool/holder against fixtures. After B rotation, a retained WCS can remain valid while access to zero is obstructed; use another verified entry without re-zeroing. Distinct from `home`, which runs on the call.
- `move_z {z | z_targets[], coordinate_system: "machine"|"work", feed_rate?, reason}` — single Z target or a batch; one approval covers the list, one `start_gcode_job` per step. Only on the operator's explicit request.
- `traverse_xy {x?, y? | targets: [{x?, y?}], coordinate_system?: "machine" (default) | "work", feed_rate?, reason}` — law-2 TRANSPORT: an absolute XY target or an ordered `targets` series at the height the head is already at (>= the motion floor), one approval, one `start_gcode_job` per leg, like `move_z`. Refused unless the head is already at/above `mcpMotionFloorZ` (default 320; no override); every leg checked against landmarks and the travel; Z never written; default frame machine (`G53` per step). Use this, never a hand-written file job, to move the head.
- `move_and_capture` — one guarded XY move followed by a position-stamped frame; the unit of visual alignment. Z-gated first: the head is raised to the safe traverse height before any XY, and the call is refused when Z cannot be established.
- `goto_tool_change_position` — ONE approval covering two exact steps (Z up, then XY to the operator-set park spot); call `start_gcode_job` once per step.

- `restore_work_frame {reason?}` — `G90` + `G54` on their own lines, NO MOTION. The cure for a controller left in the machine workspace by a job that declared `G53` and never handed the frame back: every beat then carries machine coordinates with the work-origin offset still populated, `raw − offset` is impossible, and the position of record refuses everything - including this, which is why it is explicitly allowed while `awaiting-resync` or `stale`. Reports the position before and after. A re-home is not the remedy.

## Camera and vision

- `list_cameras` — enumerate capture devices (DirectShow names on Windows, `/dev/v4l/by-id` on Linux), plus `selection` (which camera captures actually use: `url`, `device`, `last_good`, `effective`, `pinned`) and `stream` — `enabled`, `stream_url` (`/camera` page for the OPERATOR's browser; not for the agent to fetch), `running`, `clients`, `fps`.
- `preview_cameras {device?}` — one frame from EACH attached camera (or just the named one), labelled with its device string and `frame_id`. With two cameras attached both return good-looking frames and nothing downstream can tell which is which — the measurements are simply wrong — so look before you pin. A camera that will not open is reported beside the others, never substituted. Read-only; the selection is untouched.
- `select_camera {device | clear, confirm_frame_id?, operator_confirmed?, reason?}` — pin which camera every capture uses (`mcpCameraDevice`, or `mcpCameraUrl` for an http(s) snapshot URL — picking one clears the other, since the URL wins wherever both are set). `device` matches a `list_cameras` entry, its `/dev` path (symlink or the node it resolves to), or its friendly name; ambiguous matches and bare indices are refused, never guessed. `confirm_frame_id` must be a frame that came from THAT camera (from `preview_cameras`) — waived only when one camera is attached or the selection is unchanged; `operator_confirmed` is the OPERATOR's word, not the model's. Returns a fresh frame from the camera it just selected, restarts the live stream loop onto it, and — when the camera actually changed — marks the solved camera model unverified, because that geometry belonged to the old camera. `clear: true` unpins.
- `capture_frame` — position-stamped frame with a `frameId`, the expected tool region, nearby landmarks, `source` (`stream` = served by the live MJPEG loop someone is watching, `one-shot` = this call opened the device) and `stream_url`. Every requested snapshot is archived under `mcp-camera-captures`; the last 12 also stay in RAM. Returned `camera.file` and `frameId` remain usable after cache eviction and restart. Works the same whether or not the stream is running.
- `get_frame {frame_id | file}` — any requested snapshot by ID (RAM then disk), or a saved image/mosaic inside MCP camera-capture, program-frame, bootstrap or survey directories. **There is no 12-frame retrieval or survey-size limit**; 12 is only the RAM cache size. JPEG and PNG responses carry their actual MIME type. Server paths are accepted from remote clients; extensions and real paths are constrained. Read-only, no capture/motion.
Requested snapshots are retained until their archive files are explicitly removed; there is no automatic age/count eviction on disk. Continuous live-video frames are not archived. Frames already lost from the old RAM-only cache cannot be recovered. Survey/programme images have their own saved paths and indexes.

- `get_camera_capture_set {directory}` — read the position-stamped `index.json` from a bootstrap/survey result directory. Returns targets, frames, holdout flags, physical plane and mosaic metadata as recorded. Fetch images with `get_frame`; save the index and images by basename to run the offline solver locally. No SSH/server filesystem access needed.
- `camera_program {name, reason, ops}` — one staged procedure with 1–80 ordered `{id, kind, ...fields}` ops. The live `ops.items.oneOf` schema defines all fields and rejects unknown fields/references before staging. Kinds: `move_z {machine_z}`, `survey_bed` (standalone fields, no mosaic), `move_and_capture {x,y,machine_z}`, `capture`, `track_feature {template_capture_id,search_capture_id,point:{u,v}}`, `fit_calibration {samples:[{track_id,dx_mm,dy_mm}],max_residual_px?,valid_at_y?,z?,surface?,notes?}`, `verify_calibration {fit_id|jacobian+matrix,tolerance?}`. Tracking uses a 41 px patch and 120 px search. Fit stores a local 2×2 inverse (5 px residual limit default), not the camera model; verification checks M·J only (0.25 default). `operator_confirmed_clearance` is permitted only on specifically cleared survey/move-and-capture ops, never at program level. Result `ops` is keyed by id, with saved `file`/machine positions, tracks, matrices/residuals/store entries; failures retain completed ops and retreat/HOLD outcome. Initial anchor/tool/obstacles/model are rechecked before execution. Deliver the URL last, end the turn, then `start_gcode_job`.
- `set_tool_region` — tell the server where the tool appears in frame so captures can flag it.
- `track_feature` — normalised cross-correlation of a template between two captured frames (RAM or disk). Use instead of eyeballing pixels.
- `set_camera_calibration` — Y/Z-keyed pixel-to-mm calibration, optional `surface` depth tag and `jacobian`. Sign-flipped matrices are rejected.
- `get_camera_calibration` / `delete_camera_calibration` — read or remove a stored calibration.
- `visual_servo` — one clamped step toward a seen target per call. Trips when the error stops shrinking or the response diverges from the calibration prediction (parallax signature).
- `survey_bed` — approved serpentine XY camera grid at gantry height; whole-bed mosaic for finding stock and fixtures. New: `overlap_fraction` + `plane_z` derive the pitch from the camera model's real field of view ("seamless" is a relationship between pitch and field of view, and a picked pitch is not one); `z_levels` runs the grid at several heights under ONE approval, each entered with XY stationary; with a verified model each pass is composed into `mosaic_z<Z>.jpg` indexed in machine coordinates, and the seams double as a drift check that marks the model unverified when overlapping frames disagree.
- *(not a tool)* Live view for humans: `GET /camera` on the MCP port (`stream_url` above) — MJPEG at `/camera/stream.mjpeg`, one JPEG at `/camera/snapshot.jpg`, `/camera/status.json`. Same LAN gate as `/mcp`; off (Settings → MCP Server → Camera) = 404.

### The camera model (the camera is SESSION STATE, not a rig constant)

`survey_bed.machine_z` is TOOLHEAD machine Z, asserted before XY, mutually exclusive with
`z_levels`. Active tools do not bypass the floor. A legacy Z328 box still excludes Z320 views
inside it: inspect dropped/clipped coverage and use park height when necessary. `plane_z` is
PHYSICAL surface Z at the applicable B, never the toolhead height. `bed_plane_z` is used when
stored; without either, zero is an unmeasured placeholder for qualitative frames only and no
metric mosaic is rendered. Overlap requires an explicit/stored plane and a verified model;
spacing is chosen to satisfy every requested height. Seam mismatch invalidates metric use but
does not distinguish camera drift from wrong plane, parallax or poor matches. Re-verify a known
target before re-solving; do not infer a replacement plane from a seam residual.

It can sit differently after every power cycle, be knocked, be re-aimed, or be a different camera. Nothing converts a pixel into a machine coordinate, or a machine coordinate into a pose, until a model is solved AND verified on this connection. Plain captures never need one.

- `get_camera_model {history?}` — the model, its state (verified | unverified | superseded), why it is not usable, and which tool fixes it. Read-only.
- `verify_camera_model {target, pixel_u, pixel_v, tolerance_px?}` — predict where a target of known machine coordinates should appear at the CURRENT toolhead position, compare with where it does, record the residual in px and mm. **Before metric camera use; plain observation needs no calibration.** Beyond tolerance the model stays unverified and says the camera has probably moved. No motion - position with `traverse_xy` first.
- `camera_bootstrap {stage, reason, ...}` — solve the geometry FROM NOTHING, two staged procedures, one approval each. `stage: "search"`: a grid at the park height bracketing the tool setter, whose machine XY is known exactly - which frames contain it gives the camera offset INCLUDING ITS SIGN with no prior assumption, and it is the only step meaningful without a calibration. `stage: "poses"`: the poses that implies, each sweeping Z from the park height to the motion floor with XY stationary. A pose the TOOLHEAD cannot reach is dropped with a reason, never quietly adjusted.
- `set_camera_model {offset, rotation, intrinsics, valid_band_z, central_region, residuals, ...}` — store a solve from `scripts/camera_bootstrap.py`. Always stored UNVERIFIED; the previous model is kept superseded, never overwritten.
- `plan_view_pose {target, toolhead_z?}` — where must the TOOLHEAD go to see this machine point? Returns the pose, the standoff and the field of view, from the model. Use it instead of computing a pose; never carry one between sessions.

Bootstrap poses accept `holdout: true`: choose distinct XY from observed search frames, not
`plan_view_pose` while the model is unverified. Holdouts run last and the solver excludes all
their frames. Poses finish at park Z above the last pose; `result.finalMachine` reports it.
Take a fresh verification capture there after `set_camera_model` (default 8 px threshold).
Review dropped/restricted poses; at least two useful fit poses plus a holdout must survive,
and the solve still needs sufficient independent geometry. Search `y_span_mm` defaults to 0;
widen it when the viewing direction is unknown. Each moving bootstrap stage returns its own
confirm URL. The solve, model store and verification themselves have no confirm page or motion.

## Landmarks and scene

- `set_landmark` — name a scene feature by machine extent, optionally with `clearance_z`. Landmarks are obstacles: planners refuse XY paths that cross them below clearance.
- `delete_landmark` — remove one.

## Probe feed (external sensors: tool setter, overtravel switch, touch probe)

- `get_probe_feed_status` — transport, per-channel last readings, tripwire state.
- `connect_probe_feed` — bring up the MQTT or Blinka GPIO feed; connecting arms the overtravel tripwire.
- `disconnect_probe_feed` — drop the feed.
- `clear_overtravel_alarm` — reset a latched overtravel trip. Operator's explicit word only.

## Tool setter and tool change

- `set_active_tool {protrusion_mm, source, note?, tool_identity?, measurement_job_id?}` — record the fitted-tool clearance assertion, no motion/page. Operator source requires the operator's explicit statement; measured sources must match a completed setter job. Protrusion is a conservative distance below the toolhead, not probe contact calibration. A shorter active value lowers physical-basis clearances; legacy toolhead heights remain unchanged and the camera motion floor remains enforced.
- `get_active_tool` — current usable assertion with source and age, or `active:null`, historical `stored` evidence and `staleReason`. Server restart, detected disconnect/reboot and tool-change parking invalidate it. Reconfirm after the manual swap; never blindly replay the old value.
- Successful `run_tool_setter` replaces the active tool, returns `active_tool_replaced` old → new, and `get_tool_setter_config` includes it. Re-read before subsequent planning. Every confirm page displays staging and current active-tool provenance.

- `set_tool_setter_config` — setter centre, trigger Z with a reference bit, known bit lengths. Operator-stated values only.
- `get_tool_setter_config` — read it back.
- `run_tool_setter` — tool height measurement as one approved, envelope-bounded routine: sensor-gated 1 mm descent, release, 0.1 mm approach, confirm pass, then a Z-only raise straight up to the traverse height (machine Z328 — never the start height; `result.finalZ`). Hard floor below expected trigger. `store_as_reference` locks the new reference; `stay_at_trigger` / `start_from_current` support the swap wizard.
- `apply_tool_length_offset` — confirmed `G92` shifting work Z by the new-minus-old tool length. Keeps the work origin true across a swap without re-touching stock.

## Touch-probe procedures (staged, one approval per circuit, results in machine coordinates)

- `probe_point` — one axis from the current position. The atom.
- `probe_vector` — probe along any downward or lateral unit vector.
- `probe_sequence` — enumerated hop / descend / probe circuit. Every probe returns to its own start and raises, including continuing misses; keep-out boxes honoured at plan time. Use a continuous procedure below for related local stations.
- `probe_circle` — N radial marches plus least-squares circle fit. Inside a hole, returns to the staged interior origin between radials; outside a boss, repositions at full height. Reports rms and residuals.
- `probe_surface_path` — N minus-Z stations along a line: per-station contact, best-fit slope, flatness. Optional `capture: {stations: [1, 4], settle_ms?, label?}` saves stationary photos at selected contacts before retraction (also `probe_surface_grid`).
- `probe_surface_grid` — serpentine minus-Z grid: Z matrix, best-fit plane and residuals, ASCII height map. Both scans link locally: guarded at last contact plus `z_safe_delta_mm`, stepped at last contact plus `hop_lift_mm` with contact recovery.
- `probe_stock_outline` — from a block estimate, find its top, outline and centre. Links top samples and same-side samples locally; raises when changing sides.
- `probe_wall_follow` — repeated vertical-wall contacts with standoff and stepped links away from the face on a bump; no full-height return between stations.
- `probe_corner` — internal corner between fitted walls: bisector find then radial probes from the measured centre, returning there between contacts.
- `probe_trace_perimeter` — bounded internal-pocket crawl with release-verified standoff, coarse steps on proven straights and selective confirmations; external tracing is not exposed.
- `probe_program` — composite program: an ordered list of operations, derived references, jig geometry, keep-out and groups under one approval. The new-stock survey lives here. Each completed probing op ends raised; references/groups do not fuse local motion between ops. Op kinds: `rotate_b`, `surface_path`, `surface_grid`, `sequence`, `stock_outline`, `wall_follow`, `corner`, `trace`, `capture {x?, y?}` (a position- and B-stamped frame saved on the job record; with x/y it first hops there at the traverse height, travel- and obstacle-checked like a sequence hop, else no motion) and `home` (machine home, last op only, homes B too) — so "capture at (x, y), rotate_b 180, capture, home" is one click.
- `set_probe_geometry` — jig and tool constants a rotary `probe_program` can reference as the `axis` namespace. Measured or operator-stated, with a reason.

`probe_program {dry_run:true,...}` validates the same plan and returns `eventBudget`,
`jobEventLimit`, `fitsEventLimit` and a recommended limit without staging or motion. Normal
staging refuses an oversized budget. Surface ops budget 40 + 120/station plus other op/program
overhead; use measured timing for runtime, not that count. `set_probe_geometry` also stores
`probe_stylus_exposed_mm`, `probe_body_diameter_mm` (references `probe.stylus_exposed_mm` and
`probe.body_diameter_mm`, null refuses bounded references) and measured physical `bed_plane_z`.
Both tailstock and chuck-jaw keep-out volumes need current measured/operator-stated extents;
axis-centre points alone cannot generate safe fixture boxes.

## CAM probing programs

- FreeCAD side: `docs/post/freecad_probe_emitter.py` writes a `run_probing_gcode` program with `(PROBE ...)` nominals, normals and tolerances read straight off the selected faces (the Path Probe operation carries none of that, so it is bypassed, along with the post processor). `frame="machine"` + a measured `App.Placement` for a re-clamped part.

- `run_probing_gcode` — stage a CAM-generated probing program (Fusion 360, FreeCAD, any Grbl/Marlin post, or hand-written). `G38` cycles are translated into staged probes, never sent raw. Default `link_mode: raise` repositions at full height; `stepped`/`wall` provide local links with blocked-station handling. Every G38.2/G38.3 cycle still returns to its own start. Returns an inspection report.
- `get_inspection_report` — re-render a finished/aborted **run_probing_gcode** CAM report. For probe_program, probe_sequence and surface scans, read `get_gcode_job_status.result`; unsupported report requests return that pointer.

For tool selection, timing and the limits of local continuation, see [inspection planning](probe-inspection.md#efficient-inspection-planning).

## Standing rules the tools assume

- A tool or probe is always in the spindle; establish which is fitted and never plan as if the collet is empty.
- XY transport over 1 mm is planned at or above the motion floor, machine Z320 by default; park/procedure traverse height is machine Z328. Read the stored limits and canonical motion rules. Landmarks are honoured literally: a hop at 328 clears them on its own merits, a lower hop is checked like any low segment.
- No Z motion without a direct request. "Home" always means machine home.
- Approval covers one bounded series of moves and never carries forward. A staged procedure or program is ONE approval for every move inside its envelope — the efficient lawful form.
- For staged motion, deliver the confirm URL as the last line and end the turn before waiting with `start_gcode_job`. `home` and `move_and_capture` are direct-call exceptions governed by `cnc-motion-rules`; never infer permission from this tool index.
- Agents plan, stage, record and quote in MACHINE coordinates. Every staged job declares its frame or is refused; `G90`/`G91` is distance mode, not a frame; never a bare frameless `Z`.
- The work origin is the operator's (touchscreen, Luban, tool-change wizard). Read it fresh from `get_position`; never assume it; write measured XYZ only through human-gated `set_workspace_origin`, or transfer measured tool length through `apply_tool_length_offset`. Prefer one WCS; multiple workspaces are frowned upon but supported if an existing G-code job requires them.
- `get_position.machine` is the judged position of record with a `reliability`; a reading more than 50 mm outside the travel is a bug, never a position, and is ignored until the next coherent beat. Do not derive a machine position from one heartbeat by hand.
- Canonical agent guidance: `.agents/skills/cnc-motion-rules/SKILL.md`.

### Probe-spot photographs and shoulder recovery

Sequence probe steps accept `capture: {settle_ms?, label?}`; surface scans select 1-based
`capture.stations`. Frames are saved beside measurement results before retraction. Continuous
viewing remains available at `list_cameras.stream.stream_url`; it does not synchronize a photo
to a contact. Stepped surface links use bounded ball-radius backoff along verified incoming
paths and sensor-check their rises. Nested probe holds stop the whole program, including
`on_fail: skip`. See [probe inspection](probe-inspection.md) for schemas, limits and recovery details.

`home.ignore_stale_position` defaults to false. Set true only on an explicit operator demand to home despite stale data. It does not waive alarms, idle/toolhead checks, incoherent positions or fresh completion verification.
