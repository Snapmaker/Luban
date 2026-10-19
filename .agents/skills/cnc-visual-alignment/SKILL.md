---
name: cnc-visual-alignment
description: "Measure CNC stock and position a toolhead from webcam frames — via the Luban MCP tool surface (capture, guarded moves, the solved camera model, visual servo, overlapping surveys) with single-frame metric rectification and parallax handling as the vision core. The camera is session state, not a rig constant: verify or re-solve its geometry before any pose arithmetic. Use whenever the user wants to locate stock, find a datum, set or verify a work origin visually, drive the toolhead to something seen on camera, or measure a part on the bed."
---

# CNC visual alignment from a toolhead camera

> **Load `cnc-motion-rules` first; do not plan motion without it.** The motion laws,
> coordinate doctrine and position-of-record rules live there and are assumed here.

Turn webcam frames into real millimetres and drive the toolhead to something you can see.
For choosing tools, approval accounting, remote frame retrieval and complete camera sequences,
start with [cnc-camera-operations](../cnc-camera-operations/SKILL.md). This skill supplies the
metric geometry and image-interpretation details.
The geometry is the easy half; the hard half is the failure modes that make a confident
number wrong, and the machine semantics that make a correct number mean the wrong thing.

The machine runs a **Luban MCP server** for capture and guarded motion. Pasted frames can
support qualitative discussion; they do not authorize a raw G-code or backend control route.

## First: what tooling is live?

Discover the Luban tools by capability (prefixes vary by host/plugin). If connection fails or
tools are missing, report the setup problem and use the repository setup instructions; do not
reach the machine by SSH, raw sockets or backend requests. Remote agents can retrieve camera
indexes and frames through MCP, without access to the server filesystem.

### The Luban MCP surface, by job

| Job | Tool | What matters |
|---|---|---|
| Orient yourself | `get_connection_status`, `get_machine_profile`, `get_position` | Profile carries kinematics and module offsets (bracing kit shifts the envelope). `get_position` reports BOTH coordinate systems, report age, and a `warnings` array — a non-empty `warnings` means position reporting is incoherent; stop and verify. |
| Authoritative frame check | `query_firmware_position` | Raw M114 from the controller. When heartbeat-derived numbers look wrong, this is the truth. |
| Frames | `list_cameras`, `capture_frame` | Every frame is stamped with the firmware-reported position it was taken at. That stamp is what makes calibration possible — never discard it. For the OPERATOR watching live, hand them `stream_url` (from `list_cameras` / `get_stored_state`: the `/camera` page on the MCP port) — captures keep working while it streams, served from the same frames. |
| Camera device | `preview_cameras`, `select_camera`, `list_cameras` | With two cameras attached BOTH return perfectly good frames and nothing downstream can tell you picked the wrong one — the millimetres are just wrong. So: `preview_cameras` shows a frame from each, you identify the toolhead cam by what it sees (at home, the enclosure's silver extrusion up close), then `select_camera {device, confirm_frame_id}` pins it — the frame_id is the evidence, and a frame from the other camera is refused. Windows names cameras by DirectShow friendly name; Linux `list_cameras` returns stable `/dev/v4l/by-id/… (Name)` entries (plain `/dev/videoN` renumbers on replug). A vanished device is an error to report, never a silent substitution. Changing camera marks the solved camera model unverified — re-run `camera_bootstrap`, never carry the old geometry over. |
| Machine home | `home` | `G53;G28;G54`; also homes B (rotary stock rotates) — `cnc-motion-rules` §5. |
| Work origin | `goto_work_origin` | XY only, at the current Z, STAGED (the confirm page shows the MACHINE destination; refused while the origin offset is untrusted). Distinct from homing — never conflate the two. |
| Single guarded move | `move_and_capture` | ONE bounded XY vision correction; first proves/raises to park Z, then settles/captures. No Z parameter. Never use its clearance flag to skip the Z gate. |
| Composite camera sequence | `camera_program` | One approval for ordered `{id, kind, ...fields}` operations; see cnc-camera-operations. Local 2×2 fitting is not camera-model calibration. |
| Fitted tool | `set_active_tool`, `get_active_tool` | Clearance protrusion and provenance, separate from probe contact conversion. Re-read after setter/swap. |
| Saved camera evidence | `get_camera_capture_set`, `get_frame` | Retrieve bootstrap/survey index by result.directory, then saved images by file; server paths work for remote clients. |
| Camera model | `get_camera_model`, `verify_camera_model`, `camera_bootstrap`, `set_camera_model` | Before metric pose arithmetic, independently verify the applicable model; bootstrap if absent or invalid. Plain viewing needs no model. |
| Pose arithmetic | `plan_view_pose` | "Where must the toolhead go to see this machine point?" - from the model, never from memory. |
| Servo step | `visual_servo` | One clamped correction per call; the loop lives in you, not the tool. Pass `plane_z` and it derives the matrix from the camera model at this pose. |
| Calibration store | `set_/get_/delete_camera_calibration` | The legacy 2×2 pixel-delta→mm matrix, keyed by the machine Y and Z it was derived at. Superseded by the camera model, which can also say whether it is still about the camera that is plugged in. |
| Z / XY transport / programs | `move_z`, `traverse_xy`, `submit_gcode_job` | Canonical calls and rules: `cnc-motion-rules` §7–§8. |
| Anything compound (sequences, cutting) | `validate_gcode`, `submit_gcode_job` → human confirm page → `start_gcode_job`, `get_gcode_job_status`, `stop_gcode_job` | Jobs run through the controller's own state machine and door interlock. Only the operator's click on the confirm page authorises motion — call `start_gcode_job` with `wait_for_approval_ms` to start on that click, or pass the one-time code they relay as `confirm_token`. |

### Machine semantics you must not re-derive wrongly (verified on the A350)

- The controller has **G53 (machine workspace) and G54+ (numbered work workspaces)**; the
  heartbeat position is in the *currently selected* workspace. `machine = work − originOffset` is Luban's display convention — the MCP applies it for you with
  frame and reliability judgement; never do the subtraction by hand on one beat (read
  `get_position.reliability`).
- **Machine home is X−19 Y342 Z328** — the X switch sits 19 mm left of work-area zero, and
  **home is not the origin**. Homing takes ~15–20 s.
- **Work origins are operator-set per workspace; they persist across homing but NOT across a
  machine reboot** — re-verify `originOffset` after every (re)connect. Do not assume a home
  reset them, and do not assume they match the current stock setup either — verify. Agents
  plan and record in MACHINE coordinates (`cnc-motion-rules` §2); the work origin is the
  operator's to set, never yours.
- "Home"/"homing" ALWAYS means machine home. Going to work X0 Y0 is "goto work origin".
- The camera is **toolhead-mounted**: it rides X and Z; the **platform moves under it in Y**.
  The camera model works in MACHINE coordinates, where that is just a fixed offset from the
  toolhead — which is why one rigid transform covers every pose, and why the old 2x2 matrix had
  to be keyed by Y: it was this model linearised at one Y and one Z.
- The repeatable *board-viewing* camera pose is the pre-home park (machine X0 Y0), not
  machine home — at home the work area is out of frame entirely.

## Live inspection during a program

`list_cameras` returns `stream_url` (`/camera`, operator viewer), `mjpeg_url` (raw video) and
`snapshot_url` (current still). The viewer can stay open while probing; MCP captures share its
source rather than opening a competing camera process. `/camera/status.json` reports freshness.
`capture_frame` is read-only and needs no calibration or move for qualitative inspection. Check
the selected camera before interpreting a view. A live image is not synchronized evidence of a
particular contact, nor proof of clearance. Use the `capture` option on a sequence probe step or
selected surface-scan stations for a saved frame **before retraction**; see
[probe-spot captures](../cnc-probing/SKILL.md#live-viewing-and-photographs-at-probe-spots).

Start with the available view and task: calibration is necessary for metric positioning, not for
simply observing the cut, checking probe placement or identifying a feature. Reuse a verified
model and applicable position-stamped views within the same unchanged setup; avoid repeating a
full setter search just to take an inspection photograph.

## The camera is session state — verify before metric use

**The camera is not a rig constant.** It can sit differently after every power cycle, be
knocked, be re-aimed, or be a different camera entirely. Nothing you remember about where it
points survives that, and no number in this file is one.

**Before metric pixel-to-machine calculations or model-based positioning, use `verify_camera_model`**: position the toolhead
over a target whose machine coordinates are known (the tool setter is the obvious one), capture,
say where it appears in the frame, and read the residual. It passes, or it does not:

| State | What it means | What to do |
|---|---|---|
| verified | The model predicts a known target to within a few pixels, on this connection | use it |
| unverified after a reconnect | The machine has power-cycled since the solve | `verify_camera_model` |
| unverified after a residual | The camera has most likely moved | `camera_bootstrap` |
| a different camera or resolution | It is a different camera | `camera_bootstrap` |
| no model | Nothing has ever been solved here | `camera_bootstrap` |

Until a model is verified, **nothing converts a pixel into a machine coordinate or a machine
coordinate into a pose** — the tools refuse, and so should you. Plain captures are always
allowed: a frame FINDS things, it clears nothing (law 3).

### `camera_bootstrap`: solving it from nothing

Two staged procedures, one approval each.

1. **`stage: "search"`** — a grid at the park height across the X band the camera could be
   looking from, bracketing the tool setter. Which frames contain that unmistakable gold disc,
   against the toolhead XY of those frames, gives the camera's offset **including its sign**
   while assuming nothing at all. This is the only step that means anything without a
   calibration, which is why it is first.
2. **`stage: "poses"`** — the poses that coarse offset implies, each sweeping Z from the park
   height to the motion floor with XY stationary, capturing at every stop. Targets at different
   heights over that baseline are what make perspective observable.

Then `scripts/camera_bootstrap.py <directory>` (hand-mark pixels with `--marks` when detection
fails), `set_camera_model`, and `verify_camera_model` against a pose that was **not** in the
fit. A model that has only agreed with its own fit has demonstrated nothing.

Choose the holdout from observed search frames, not `plan_view_pose` (it refuses an unverified
model). Set `holdout: true` on a distinct XY pose; the server visits holdouts last, excludes
them in the index for the solver, and ends at park Z above the last pose (`result.finalMachine`).
Take a fresh frame there after storing the model and verify the known target (8 px default).
Keep at least two useful fit poses plus a surviving holdout; count and inspect surviving Z
stops and solve conditioning, not just requested poses. The toolhead may be outside a legacy
box while the camera looks in. If boxes eliminate the useful baseline, widen the search rather
than lowering/removing obstacles. `y_span_mm` defaults to 0 (one row); use a wider Y search
when direction is unknown.

Frames/index live under the server's `mcp-camera-bootstrap/<id>`. Read them with
`get_camera_capture_set {directory}` and `get_frame {file}`. Save index.json and image bytes
by basename in a local directory to run the bundled solver; if the client cannot save/solve,
request the operator's exported solve. Do not SSH to the machine as a camera workaround.

### Choosing a viewing pose

**`plan_view_pose {target: {x, y, z}}`.** It returns the toolhead XY, the standoff and the
field of view, from the measured model. Then ONE `traverse_xy` (one approval);
`move_and_capture` is for ≤ 100 mm nudges once the feature is in frame.

Never compute a pose yourself, and never carry one in your head between sessions. An earlier
version of this file stated the offset as fact — "the camera looks −X, seeing roughly 90–150 mm
to the toolhead's −X side" — and on 2026-09-19 an agent followed it, went to toolhead X 290 for
a feature at X≈170, moved +30 mm to check, watched the workpiece slide further out of frame,
and was corrected by the operator to "260 is about the max". Three operator approvals to
establish a sign that one measurement settles.

The sanity check on a solved model is still evidence: a commanded +X moves the *camera* over
the scene; a commanded +Y moves the *scene* under the camera (platform axis). If a verified
model disagrees with what you see, the camera has been knocked — re-verify, do not re-derive by
hand.

## Survey first, single poses second (`survey_bed`)

A serpentine grid, one settled frame per waypoint, saved to disk with a machine-position index.
**Reach for this before a chain of single poses.** The 2026-09-19 session spent forty minutes
and five approvals on single poses, then found what it was looking for in the first grid it
ran.

- `overlap_fraction` (with a verified model) derives the pitch from the real field of view on
  `plane_z`. "Seamless" is a relationship between pitch and field of view; a picked `pitch_mm`
  is not one.
- `z_levels` runs the whole grid at several heights under ONE approval, each entered with XY
  stationary.
- With a verified model each pass is composed into `mosaic_z<Z>.jpg`, indexed in machine
  coordinates. Read a feature's position off the mosaic through the index's affine — that is a
  lookup, not an inference from one frame and a remembered scale.
- The seams double as the drift check: overlapping frames that disagree mean the camera moved,
  and the survey marks the model unverified rather than handing you a skewed mosaic.

Check coverage across the requested reachable envelope; do not assume which column sees a
region before inspecting this session's camera evidence. Use operator-stated landmark identities.

`machine_z` asserts TOOLHEAD machine Z before any survey XY; it cannot be combined with
`z_levels`. `plane_z` is PHYSICAL surface Z, using the applicable contact calibration and B,
not toolhead/camera height. Stored `bed_plane_z` supplies a measured bed plane; absent both,
zero is only a placeholder for qualitative captures and no metric mosaic is produced.
Raised objects remain parallax-shifted relative to a bed-plane mosaic. State the chosen plane.
Legacy Z328 boxes still drop/refuse Z320 views inside them even with a shorter active tool;
survey at park height when those regions must be covered. Read every dropped/clipped region.

Seam disagreement can come from a wrong plane, raised-object parallax or poor matching as well
as camera movement. The result states plane_z and the ambiguity; it cannot identify a unique
corrected height from seams alone. Re-verify on a known target before re-bootstrapping.

### Composite camera programs

Use `camera_program` for ordered Z moves, surveys, captures, feature tracks and local
calibration under **one approval**. Read its discriminated `ops.items.oneOf` schema or the
[compact operation table](../cnc-camera-operations/SKILL.md#composite-camera-calls-use-real-fields).
Program surveys save indexed frames but do not compose mosaics; standalone `survey_bed` does.
Tracking uses a 41 px NCC patch and 120 px search window. `fit_calibration` stores **M=J⁻¹ in
the local 2×2 calibration store**, with a default maximum residual of 5 px. It does not make
`overlap_fraction`, `plan_view_pose` or model-derived `visual_servo plane_z` available.
`verify_calibration` checks M·J≈I (0.25 default), not held-out physical accuracy.
Read per-op clearance exceptions aloud; never apply an exception across an entire program.

## Measuring: the pipeline

`scripts/board_metrology.py` implements single-frame metric rectification end to end. Read
it before writing your own.

```bash
python3 scripts/board_metrology.py frame.jpg \
    --quad 421,114 530,133 508,193 409,174 \
    --patch 360,180,560,340 --grid-cm 1.0
```

1. **Colour-mask the board** so line detection never sees metalwork.
2. **Flat-field** (divide by a heavy Gaussian) before Canny — raw edges find shading and
   wood grain, not grid lines.
3. **`HoughLinesP`**, split segments into the two angular families.
4. **Vanishing point per family** — SVD null-space of stacked homogeneous line coords.
5. **Affine-rectify** from the line at infinity through both VPs.
6. **Recover the final scale** by asserting a known-rectangular object really is rectangular.

### Two independent routes, or you have nothing

The anisotropy from step 6 must agree with the grid pitch from a Radon projection of the
rectified board. In the validating session both routes gave 1.71 — that agreement is the
*only* reason the number was trustworthy. Disagreement by ~2× means a peak-finder locked
onto a harmonic; other disagreement means an under-constrained vanishing point (usually the
family with fewer lines) — re-shoot with more bare board in frame rather than proceeding.

### The field-of-view sanity check is mandatory

Convert your scale back to px/cm, multiply out to the frame width, compare with the known
bed size. This check once caught a 1.25× pitch error that both other validations passed.

## The four things that make a confident number wrong

**Foreshortening.** One px/mm figure is valid along one direction only. An uncorrected pass
read a block 60 × 35 mm; rectified it was 58 × 45 — the error concentrated in one axis.

**Top-face magnification.** An elevated face images larger by `D/(D−h)` (D ≈ camera
standoff; at D≈290 mm a 40 mm block reads 16 % oversize). **Measure the base contact line**,
never the top face; if you must use the top face, ask for the thickness with calipers.

**Parallax.** At tilt θ, a point *h* above the board images `h·tan θ` from the point beneath
it — 0.70 mm per mm at 36°. This is why open-loop moves cannot be verified from high Z.

**Lens distortion.** Cheap webcams barrel-distort. If you can get a checkerboard on the
bed, do intrinsic calibration and skip the single-frame cleverness.

## Positioning: servo, do not compute-and-jump

Never compute a machine coordinate from one frame and drive to it. With the MCP:

1. Establish state: `get_connection_status` → `get_position` (warnings empty?) → if in any
   doubt, `query_firmware_position`.
2. If not homed, obtain the operator's explicit word to `home`, including that B turns.
   Do not infer authority from a camera request. Ordinary Z/transit/procedure tools refuse
   unhomed state; `home` itself raises Z first. Direct vision's park-height gate remains.
3. Derive the 2×2 matrix at the working Y and Z: command 2–3 known small XY offsets with
   `move_and_capture`, measure the feature's pixel displacement with `track_feature`
   (never by eye - hand-estimated pixels caused a ~50% calibration error live; on
   repetitive grids the second_peak_gap is a SOFT signal, ~0.17-0.25 even for correct
   matches, so verify low-gap matches against the Jacobian prediction), fit the forward Jacobian J
   (pixel shift per mm), and store M = +J⁻¹ with `set_camera_calibration` (residuals in
   `notes`). **Verify the sign before storing**: the tool computes error = target − feature
   (check `pixel_error` in a real response against your own numbers), and J·(M·e) must
   reproduce +e — a flipped M drives every "correction" away from the target, and it looks
   plausible right up until the error grows. The tool warns when consecutive steps fail to
   shrink the error; treat that warning as "stop and re-derive", never "push through".
3b. **Calibrations are depth-plane-specific.** The matrix is only valid for features on
   the same physical surface it was derived from: applying a bracket-screw calibration to
   a feature on the board (different height under a close, tilted camera) predicted ~4×
   wrong — real parallax, not a bug. Derive on the surface you will servo on, record the
   surface in `notes`, and before trusting any tracked shift, sanity-check it against the
   Jacobian prediction (J·Δmachine ≈ Δpixel); a sharp divergence means wrong plane, wrong
   match, or both - visual_servo also performs this cross-check automatically and warns
   on divergence; tag calibrations with their `surface` so the warning can name it.
4. Iterate `visual_servo` — each call is one clamped step and returns the frame; two or
   three passes converge. It auto-selects the nearest-Y calibration and warns when a step
   moves Y (self-invalidating) — re-derive or re-select when it does.

Measuring local differences reduces sensitivity to an imperfect homography, but does
not remove lens distortion, parallax or mounting changes. Check measured response
against the local calibration and stop when the claimed tolerance is unsupported.

Z positioning is not part of the servo: raise or lower Z via `move_z` with
`coordinate_system: "machine"` — one operator-confirmed step per target, never a Z word in a
hand-written file job. Refuse to servo from a height where parallax exceeds
the tolerance you are claiming.

## Reading a toolhead-camera frame (hardware-learned, the hard way)

Two live-session failures came from misreading frames, not from geometry. Both are avoidable:

**Identify by evidence, not by remembered composition.** Never assert "no board in view"
because the frame fails to match a reference framing you were *told about* but do not have.
Describe what IS in the frame and test it against context. On this machine the calibration
board is a **yellow-brown surface with a printed black grid and alphanumeric cell labels
(C1, L1, ...)** — a labeled coordinate grid is a calibration board, not a "cutting mat",
however mat-like its colour. If you have no reference image, say so and reason from content.

**The rig-mounted vs scene heuristic.** Anything whose frame position is **invariant across
machine moves** is mounted to the same assembly as the camera — the endmill, the spindle
housing — not part of the scene. Scene content (board, rail, bed) visibly shifts between
captures. You always have multiple position-stamped frames; cross-reference before guessing.

**The endmill's visual signature.** For a toolhead-mounted camera the tool sits millimetres
from the lens: it images as an **oversized, extremely defocused shape entering from a frame
edge at a fixed orientation** (here: from the bottom edge ~2/3 along, pointing diagonally
toward top-left, ~20 % of frame height). That blur is diagnostic of near-lens distance —
categorically different from the resolvable distance-blur of the scene. `capture_frame`
reports the operator-configured `expectedToolRegion` box with every frame — check it before
concluding anything about "an unidentified blurry shape".

**Landmark identity is operator truth, not visual analogy.** A recurring unidentified
object must not be assigned an identity from what it sits near ("beside jaw-shaped blocks,
so chuck-related") — on this machine the gold cylinder at machine Y≈176–340 is the **tool
height checker**, misidentified twice by analogy before the operator corrected it. If the
operator has named a landmark, use that; if not, ask — never assert a guess as resolved
fact. Landmark identities persist in the registry: call `get_stored_state` first in any
session, and record new operator-stated identities with `set_landmark` - captures then
carry `nearbyLandmarks` automatically.

## Datums: check the landmark is actually in frame

A stated datum is worthless if it is outside the field of view. Verify visually before
building on it. When the datum fixes only one coordinate, say so and ask for one anchor
frame — do not extrapolate. Recover axis directions from evidence: a commanded +X moves the
*camera* over the scene; a commanded +Y moves the *scene* under the camera (platform axis).
If those look swapped, something is mislabeled — stop.

## Safety

- Motion tools enforce: idle machine, toolhead off, homed-first (or explicit operator
  clearance), per-call travel bound, build-envelope check. Do not look for ways around
  them; they encode operator rules.
- The endmill may always be in the collet — an XY move at low Z can drag it through stock
  or clamps. Read Z before moving in XY; when in doubt, raise Z via a confirmed job first.
- Never send a cutting move (spindle on, or Z below stock top) without fresh human
  confirmation — the job confirm page is that mechanism; a stale or reused code is not.
- Report every dimension with an uncertainty. A bare figure reads as authority it has not
  earned.
