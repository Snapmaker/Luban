# Bed + enclosure survey: safe phased approach with camera calibration, coarse mosaic, and touch-probe fine measurement

## State block (from the fixture)

- **Connection**: connected, sstp-http wifi, machine A350, machineReady
- **Position**: work frame X150.2 Y210.4 Z296.0 B180.0, reliability heartbeat, isHomed false, machineStatus IDLE, reportAgeMs 900
- **Active tool**: null (no confirmed tool; fallback assumes longest bit 75 mm)
- **Camera**: generic USB camera plugged in, model unverified, stream enabled at https://192.168.1.153:40890/camera
- **Probe geometry**: effective length 70.9 mm (2026-09-29 calibration), tip diameter 2 mm
- **Tool setter**: centre (79, 293) machine, trigger Z 175.5 with reference bit 75 mm
- **Rotary axis**: X 170.1 machine, Z physical 112.4 (undated historical)
- **Probe feed**: GPIO (KB2040 U2IF) connected, ok
- **Limits**: travel X −19…339, Y 0…342; motion floor Z320, safe traverse Z328

## Assumptions and unknowns

| Item | Value | Frame | Source | Status |
|---|---|---|---|---|
| Current work origin valid | unknown | work | operator | ASK |
| Enclosure Y span and size | ~Y90–120 near tailstock | machine | memory (2026-09-21 probing job) | operator verify |
| Enclosure Z top | ~136.5 (wooden stock, stale 2026-09-02) | physical | stored landmark | stale, will measure |
| Rotary tailstock Y | ~Y95 (historical) | machine | stored landmark | unset in config; measure |
| Rotary chuck face Y | unset | machine | stored geometry | unset; not needed for tailstock survey |
| Camera standoff and tilt | unknown | — | fixture: model=null, state=unverified | solve via bootstrap |
| Probe body clearance under enclosure | unknown | measure downward from enclosure rim | fixture: enclosure is part of the rotary landmark | measure with surface path |

## Questions for the operator (one batch)

1. Has the work origin (workspace 0 / G54 offset) been moved since 2026-10-03, or is it still at the location you set for the rotary?
2. The enclosure we measured on 2026-09-21 (probing jobs 031c3eb1fe38 and d677bd88d31a): has the stock been unclamped, re-clamped, or rotated since then?
3. We will focus the fine survey on Y 85–115 machine (the tailstock area below the enclosure). Should we also include the chuck-face area (Y ~260–310)?
4. The screw hole: does the operator have a sketch or approximate location in mind (X/Y), or should we reserve that for the next turn once we map the enclosure top?

(Answer now; the staging questions in §2 below depend on your answers.)

## Plan by phase

### Phase 1 — Basic checks and machine state (no motion)

**Purpose**: verify the rig is alive and the measurements are trustworthy before any motion.

**Tools and results**:
- `get_connection_status` — confirms sstp-http active, A350 ready
- `get_position` — confirm reliability heartbeat or better, isHomed false is expected, zero warnings
- `get_stored_state` — read landmarks (tool-setter, rotary-axis), limits (motion floor 320, traverse 328), geometry (probe effective length 70.9), probeFeed connected
- `get_machine_profile` — confirm A350 kinematics, any bracing kit or quick-swap modules in use
- **Heights used**: none; reading only
- **Expected result**: all systems nominal, position record trustworthy, probe geometry known
- **Approval**: none; read-only calls

### Phase 2 — Home and prepare for camera work

**Purpose**: establish machine coordinates and rotate the rotary B axis to B0 (chuck face forward). Homing also clears position-of-record stale state (law 3).

**Heights and safety**:
- `home` goes G53 (machine coords), then G28 all axes including B, then G54 (work coords)
- **Z motion**: Z rises first to home switches, B rotates to B0
- **Rotation**: stock on the rotary WILL rotate to B0 (currently at B180); warn operator
- **Approval**: law 6 — the operator must explicitly command this; this plan requests it, operator confirms

**Steps**:
1. **Warn**: "I will now home the machine. This rotates the B axis from 180 to 0 and will spin the stock. Please confirm the spindle is off and the bed is clear."
2. `home {wait_until_moved: true}` — blocks until the firmware reports homed; returns `isHomed: true`
3. `get_position` — re-read position after homing; reliability should now be `verified` or `heartbeat`, isHomed true
4. **Expected result**: machine at home (X −19, Y 342, Z 328, B 0), position verified, stock rotated

**Approval**: [APPROVAL] — operator confirms homing is permitted, stock rotation noted

### Phase 3 — Camera setup and verification

**Purpose**: establish which camera we are using and whether its geometry is still valid from the last session. No motion at this stage; only captures and model checks.

**Heights used**: none; the camera is pre-mounted

**Approvals and steps**:

#### 3a. Preview and select camera

3a.1. `list_cameras` — shows the pinned generic USB camera and any others plugged in

3a.2. If only ONE camera:  
     — `get_camera_model` — check if a model is stored and what state it is in (`verified` / `unverified` / `superseded`)  
     — **If state = `verified`**: `verify_camera_model` (move 3c below) to test it against a known target (the tool setter)  
     — **If state = `unverified` or no model**: proceed to `camera_bootstrap` (move 3b below)

3a.3. If TWO or more cameras:  
     — `preview_cameras` — get a frame from each  
     — Operator identifies the TOOLHEAD camera (the one mounted on the spindle looking down at the bed; at home it sees the enclosure and workpiece close-up)  
     — `select_camera {device: <toolhead_camera>, confirm_frame_id: <frame_id_from_that_camera>, reason: "toolhead-mounted camera identified from preview"}`  
     — Selecting a new camera marks any stored model `unverified`; proceed to bootstrap (move 3b)

**Approval for 3a**: [APPROVAL] — operator confirms the camera choice (if two cameras; single camera is automatic)

#### 3b. Bootstrap camera geometry (if needed)

**Trigger**: `camera_model.state` is `unverified` or null

**One-approval procedure**: `camera_bootstrap` with two stages:

**Stage 0 — Direction finding**:
- **Purpose**: find the camera's offset from the spindle including its sign, knowing nothing else
- **Motion**: grid at park height (Z328) across X band around the tool setter (X ~40–100), capturing at each waypoint
- **Heights**: Z328 (machine, traverse height = park for this camera view)
- **Expected result**: frames showing the tool-setter gold disc at different X positions; the frame indices + toolhead XY at capture → coarse offset including sign
- **Operator wait**: [WAIT] — operator has seen stage-0 result; asks to proceed to stage 1 or stop
- **Expected outcome**: coarse camera offset derived (e.g. "camera sees −X, at standoff ~250 mm")

**Stage 1 & 2 — Poses at three known targets, then Z sweep**:
- **Purpose**: solve the camera model with perspective (standoff, tilt, distortion)
- **Motion**: two or three poses (XY at different coordinates), each sweeping Z from 328 down to 320 in 2 mm steps with XY stationary
- **Targets**: tool setter, rotary axis X~170, and a reference point in clear bed area
- **Heights**: Z 328 down to Z 320, guarded descent at each pose
- **Expected result**: model solved with residuals, stored as `unverified` pending verification
- **Approval**: [APPROVAL] — one approval covers both stages

**Approval for 3b**: [APPROVAL] — one camera_bootstrap call stages the whole procedure under one confirmation

#### 3c. Verify the camera model

3c.1. `verify_camera_model`:
- **Motion**: move to tool setter (X 79, Y 293, Z 320), capture frame
- **Operator reports**: where does the tool setter appear in the pixel frame (u, v)?
- **Result**: residual in pixels and millimetres, model marked `verified` if within threshold (typically 2–3 px, ~1 mm)
- **Heights**: Z 320 (motion floor), safe for optical only
- **Approval**: [APPROVAL] — stages one verify move (traverse to setter, capture, return)

**Expected result after 3c**: camera model verified, ready for visual surveys; all motion done at or above Z320

### Phase 4 — Coarse survey: camera mosaic of the bed at motion-floor height

**Purpose**: map the bed and enclosure area with overlapping camera frames, generating a machine-indexed mosaic at Z320. This shows what we are working with before the fine touch-probe survey.

**Heights used**:
- **Machine Z 320** (motion floor) — safe for XY transport and optical viewing
- Z surveys are guarded and stationary (no XY motion during Z moves)
- The motion floor is NOT the traverse height (328); XY moves at 320 are legal by law 2 (§3 of cnc-motion-rules)

**Approval and motion**:

4.1. `survey_bed`:
- **Parameters**:
  - `plane_z: 320` (machine frame; motion floor — safe height for optical over the whole bed)
  - `z_levels: [320]` (single pass; coarse only)
  - `overlap_fraction: 0.3` (30% overlap for mosaic seamlessness)
  - `reason: "coarse optical survey of enclosure area and surrounding bed"`
  - Bounds: `x_min: 140, x_max: 200, y_min: 80, y_max: 330` (covers rotary + tailstock + enclosure)
- **Expected motion**: serpentine grid waypoints at the computed pitch (from camera FOV × (1 − overlap)), one capture per waypoint, return to traverse height (328) on completion
- **Expected result**: `mosaic_z320.jpg` + `index.json` with pixel→machine affine, waypoint grid, no contact expected (optical only)
- **Approval**: [APPROVAL] — one survey_bed call, one approval, multiple captures under that approval

**Expected result after phase 4**: machine-indexed mosaic image showing enclosure location, rotary position, tailstock area; we can identify features and set coordinates for phase 5

### Phase 5 — Fine survey: touch-probe measurement of enclosure clearance and feature geometry

**Purpose**: measure the top surface and side profiles near the tailstock to confirm enclosure height, probe access, and identify the location for the screw hole.

**Heights and safety**:

- **Start height**: Z 320 (motion floor) for XY transports between probe stations
- **Probe descents**: guarded −Z marches from known reference heights using sensor-gated steps
- **Retreat**: after each probe, return straight up to Z 328 (traverse height) before any XY move
- **Probe body clearance**: enclosure rim is at ~Y 95–110, measured top ~136.5 mm physical (stale); we will measure the current top with a −Z march, then check reach limits for side marches

**Approval and operations**:

5.1. **Find the enclosure top** — one sequence probe:
- **Motion**: traverse to above the enclosure (machine X 170, Y 100), raise to Z 328
- **Op**: `probe_sequence` with one step:
  - `kind: "descend"`, start_z_machine 250 (safe from bed), expected_z_machine 200 (nominal from 2026-09-02, stale)
  - `kind: "probe"`, name "enclosure_top", −Z march, max_travel_mm 60, coarse_step_mm 1
  - Expected contact: ~200–210 machine Z toolhead (physical = Z − 70.9 probe length ≈ 130–140 mm)
- **Result**: median contact Z, spread, physical surface height
- **Approval**: [APPROVAL] — stages one station

5.2. **Plan the fine survey** based on the measured enclosure top:
- **Input**: contact Z from 5.1 (e.g. 205 machine toolhead = 134.1 mm physical)
- **Queries for operator**: 
  - Where should the fine grid span in X and Y (e.g. X 160–180, Y 90–110)?
  - Should we measure the top surface (grid) or profiles along edges (path)?
- **Heights for fine scan**:
  - Surface grid: `start_z_machine` = measured top + 10 mm margin (e.g. 215), `expected_z_machine` = measured contact (e.g. 205), pitch 10 mm coarse
  - Guarded hops between stations at `z_safe_delta_mm: 5` (conservative for uncertain geometry)
  - Maximum drop below previous contact: `max_drop_mm: 15` (we know the surface, so tight tolerance)

5.3. `probe_surface_grid` for the enclosure area:
- **Grid bounds**: X 160–180, Y 90–110 machine (adjust per operator answer to 5.2)
- **Pitch**: 10 mm (coarse; refine if we need detail)
- **Start/expected Z**: from 5.1 result + margin
- **z_safe_delta_mm**: 5 (we know the surface is ~205 Z)
- **max_hop_mm**: 60 (distance between stations)
- **max_drop_mm**: 15 (bounded search below last contact)
- **Approval**: [APPROVAL] — one grid, one approval

**Expected result after phase 5**:
- Enclosure top height confirmed in machine coordinates
- Physical clearance under the enclosure rim measured (probe body + margin)
- Grid of contact points showing the surface profile and any slopes
- Identification of probe-accessible areas where the screw hole can be drilled

## Steps

1. Deliver `get_position` result showing current heartbeat position, NOT homed. **[no motion]**

-- end turn --

2. [WAIT] — operator answers the question batch in §3 (work origin, stock clamping, survey bounds, screw hole location).

3. Warn operator: "I will home the machine now. This rotates the B axis from B180 to B0, spinning the stock. Confirm the spindle is off and the bed is clear." **[APPROVAL required]**

-- end turn --

4. `home {wait_until_moved: true}`

5. `get_position` — verify homed, reliability verified or heartbeat. **[no motion approval]**

-- end turn --

6. `list_cameras` — show available cameras. **[no motion]**

-- end turn --

7. [**If one camera**] → `get_camera_model` — check stored model state. [**If unverified or null**] → stage `camera_bootstrap {stage: "search", ...}`, deliver confirm link, **[APPROVAL]**, wait.

-- end turn --

8. [**If two cameras**] → `preview_cameras`, operator identifies toolhead camera, deliver confirm_frame_ids, **[APPROVAL]** for `select_camera`.

-- end turn --

9. [**If bootstrap is needed**] → receive bootstrap stage-0 result, show frames where tool setter is found. [**WAIT for operator: "proceed to stage 1+2"**]

-- end turn --

10. Continue bootstrap stages 1+2 (poses, Z sweeps), deliver confirm link, **[APPROVAL]**, wait.

-- end turn --

11. Receive bootstrap result, model solved but unverified. Stage `verify_camera_model`, deliver confirm link, **[APPROVAL]**, wait.

-- end turn --

12. Receive verify result. [**If residual acceptable**] → model marked verified, ready for survey. [**If residual > threshold**] → camera has moved; re-bootstrap or operator intervention needed.

-- end turn --

13. Stage `survey_bed {plane_z: 320, z_levels: [320], overlap_fraction: 0.3, x_min: 140, x_max: 200, y_min: 80, y_max: 330, reason: "coarse survey of bed and enclosure"}`. Deliver confirm link, **[APPROVAL]**, wait.

-- end turn --

14. Receive survey result: `mosaic_z320.jpg` and `index.json`. Display mosaic showing enclosure location, rotary footprint, tailstock area.

-- end turn --

15. [**WAIT for operator input from step 2 (question batch)**] — finalize X/Y bounds for fine probe survey based on mosaic.

-- end turn --

16. Stage `probe_sequence {steps: [{kind: "descend", start_z_machine: 250, expected_z_machine: 200}, {kind: "probe", name: "enclosure_top", max_travel_mm: 60}]}` at (X 170, Y 100). Deliver confirm link, **[APPROVAL]**, wait.

-- end turn --

17. Receive enclosure_top contact result. Extract measured Z (e.g. 205 machine toolhead). Compute fine-survey parameters:
    - `start_z_machine = measured_z + 10` (e.g. 215)
    - `expected_z_machine = measured_z` (e.g. 205)
    - `z_safe_delta_mm = 5`, `max_drop_mm = 15`

-- end turn --

18. [**WAIT for operator confirmation**] — "Fine survey grid: X 160–180, Y 90–110, pitch 10 mm, guarded hops at 5 mm above contact. Approve?"

-- end turn --

19. Stage `probe_surface_grid {x_min: 160, x_max: 180, y_min: 90, y_max: 110, pitch_mm: 10, start_z_machine: 215, expected_z_machine: 205, z_safe_delta_mm: 5, max_drop_mm: 15, coarse_step_mm: 1}`. Deliver confirm link, **[APPROVAL]**, wait.

-- end turn --

20. Receive surface grid result: `zMatrix`, flatness (peak-to-valley), tilt. Report findings: enclosure top height, physical clearance margin under the rim, surface profile (slope/flatness), probe-accessible regions.

-- end turn --

**End of plan. Fine survey results reported; no cutting staged.**

## Recovery

**If any job aborts** (no contact at station 1, hop-guard collision, overtravel trip):
- Server automatically raises the head to Z 328 (traverse height) and stops
- Review the abort reason in the job status (`ending`)
- `get_position` to check current reliable position
- **If overtravel is latched** → `clear_overtravel_alarm` (operator approval)
- **If probe still reads contact** → manually free the probe, then call `move_z` to retreat
- Call `get_position` again; if reliability is `awaiting-resync`, call `restore_work_frame` to re-sync coordinates (no motion, just selects G54)
- Review whether the plan should proceed, branch, or stop

**If any position report becomes unreliable** (`awaiting-resync` or `stale`):
- `recover_machine_connection` (read-only diagnostic, restarts heartbeat polling)
- `get_position` → re-read and require `reliability: verified` or `heartbeat`
- If still not recovered, may need re-home, but consult the operator first

**Held contact** (probe still touching):
- Abort stops and holds; do NOT retry the station immediately
- Operator must free the probe physically
- Resume with a manual `move_z` retreat step before the next motion

## Counts

- Logical approvals = **5** (home; camera selection or bootstrap; verify model; survey_bed; probe_surface_grid)
- Literal [APPROVAL] tags = **6** (home; camera select/bootstrap stage 0→1+2; verify; survey; grid)
- Operator waits = **2** (initial questions after homing; operator input from survey before fine grid)
- Question batches = **1** (questions 1–4 at the start)
