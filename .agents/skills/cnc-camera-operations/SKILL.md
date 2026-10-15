---
name: cnc-camera-operations
description: "Operate the Luban CNC camera: inspect a live view, select the right device, recover saved frames remotely, plan camera bootstrap/calibration, and stage coarse or detailed camera surveys. Use for camera operations even when no metric alignment is requested. Load cnc-motion-rules before motion or coordinate reasoning; use cnc-visual-alignment for solving geometry and cnc-probing for contact measurements."
---

# CNC camera operations

Load `cnc-motion-rules` first. Camera inspection does not authorize movement. Use only the Luban
MCP surface; absent tools mean report the connection/setup problem, not SSH or backend access.
The camera's offset, direction and field of view are measured session state, never constants.

## Pick the shortest complete route

| Requested outcome | Calls and stopping point |
|---|---|
| See what is happening | `list_cameras` → `capture_frame`; share `stream_url` for live viewing. No calibration, movement or confirm page. |
| Identify/select camera | `preview_cameras` → inspect each frame → `select_camera {device, confirm_frame_id}`. Device names alone do not prove identity. Selection invalidates old geometry. |
| Read saved survey/bootstrap | `get_gcode_job_status {job_id}` → `get_camera_capture_set {directory: result.directory}` → `get_frame {file: index.frames[i].file}`. These are server paths; no motion. |
| Metric pose or overlapping mosaic | Read `cnc-visual-alignment`: usable model → independent `verify_camera_model`; absent/failed model → search, poses, solve, store, held-out verification. |
| Whole bed / locate region | `survey_bed`, preferably one pass at the park height if legacy boxes require it. `overlap_fraction` needs a verified model and the physical surface `plane_z`. |
| Ordered Z, survey, capture or local calibration | `camera_program {name, reason, ops}`. Use its `ops.items.oneOf` schema; details below. One confirm page for the entire stated sequence. |
| Survey for a future hole/cut | Camera locates the region. Read `cnc-probing` and measured evidence; recover prior results, choose tolerance and datum references, then measure only gaps with one bounded `probe_program`. No cut or origin write implied. |

If this agent cannot see images, it may read state, indexes and tool schemas but must obtain
operator-marked targets/device identity or usable measured tracking results before making visual
claims. If it can see images but cannot execute a solver, request the exported model/solve from
the operator. Never fabricate calibration to complete a workflow. A local filesystem-capable
agent can save the returned index and image bytes by basename and run the bundled offline solver;
local shell access does not grant access to the machine server.

## Before a survey: one check, one question batch

Read connection, reliable machine position, homed/idle state, stored landmarks and geometry,
`get_active_tool`, camera selection/model and diagnostics/event limit. Retrieve existing jobs
before calling a region unmeasured. State toolhead machine XYZ, B and date.

Resolve these together, only where missing: permission to home if unhomed (B turns to 0), face/B,
unchanged clamping since saved evidence, feature position/size/tolerance, obstacle extents/heights,
exposed stylus and body diameter for pocket/wall probing, and any needed event-limit increase.
Wait for the answers before dependent calls. Do not repeatedly ask known facts or schedule a
blanket resurvey because the chat changed.

| Easily confused values | Correct use |
|---|---|
| `machine_z` / `z_levels` | TOOLHEAD machine heights; mutually exclusive. Camera XY stays ≥ motion floor, including with an active tool. A per-op explicit operator exception does not remove stored obstacles. |
| Park vs floor | Read live limits (this rig commonly 328 vs 320). A legacy box demanding toolhead Z328 still excludes Z320 captures there. Choose park height; do not silently accept holes in required coverage. |
| `plane_z` | PHYSICAL machine Z of the observed surface, with evidence at the applicable B. Not camera Z or toolhead Z. Stored `bed_plane_z` describes the bed only. No measured plane → qualitative frames, no metric claim. |
| Conservative fitted-tool protrusion | `set_active_tool {protrusion_mm, source: "operator", note}` on the operator's statement. Clearance only. An approximate overall length must be identified as a conservative protrusion bound, not assumed to be the calibrated length. |
| `geometry.probe.effectiveLength` | Contact conversion with source/date and trigger convention; an approximate 75 mm clearance bound does not replace a measured 70.9 mm conversion. Setter contact and stylus trigger can have different pretravel. |

## Approval accounting and handoff

`survey_bed`, both moving `camera_bootstrap` stages, `camera_program`, and `probe_program` each
stage **one confirm page**. Return its URL last, end the turn, then wait/start that existing job.
Timeout is not rejection. `home` and a direct `move_and_capture` need the operator's explicit
word but have **no confirm page**; do not count them as page approvals. Read-only calls, camera
selection, model storage/verification and active-tool recording have no page and no motion.
Unhomed `move_z`, traverses and procedures refuse: `home` itself raises Z first and homes B.

## Composite camera calls: use real fields

Every operation is `{id, kind, ...fields}` with a unique id. Never use `type`, `op`, `target_z`,
or a probe-program reference expression in a camera program. Read the live schema if fields differ.

| `kind` | Fields beyond `id`, `kind` |
|---|---|
| `move_z` | `machine_z` |
| `survey_bed` | `machine_z` OR `z_levels`; `x_min`, `x_max`, `y_min`, `y_max`, `pitch_mm`, `margin_mm`, `plane_z`, `overlap_fraction` |
| `move_and_capture` | `x`, `y`, `machine_z`; the full staged leg is travel/obstacle checked (the ≤100 mm cap belongs to the standalone direct call) |
| `capture` | none |
| `track_feature` | `template_capture_id`, `search_capture_id`, `point: {u,v}`; ids must refer to earlier capture/move-and-capture ops, not surveys |
| `fit_calibration` | `samples: [{track_id,dx_mm,dy_mm}]`, optional `max_residual_px` (5 default), `valid_at_y`, `z`, `surface`, `notes` |
| `verify_calibration` | `fit_id` OR both `jacobian` and `matrix`; optional `tolerance` (0.25 default) |

Clearance exceptions belong only on the particular `survey_bed`/`move_and_capture` op explicitly
cleared by the operator. No program-wide flag. Describe each exception in the approval summary.
Program surveys save frames, **not mosaics**; use standalone `survey_bed` when the deliverable is
a mosaic. Result `ops` is keyed by id; saved captures carry `file` and machine position; fitted
matrices carry residuals and the store entry. Capture files survive the 12-frame cache.

For example, after checking that this machine's park height is 328 and the requested bounds
are covered, this is one approval for the whole sequence:

```json
{
  "name": "coarse bed views",
  "reason": "Locate the requested region before choosing a fine survey",
  "ops": [
    {"id": "park", "kind": "move_z", "machine_z": 328},
    {"id": "bed", "kind": "survey_bed", "machine_z": 328, "pitch_mm": 40},
    {"id": "last", "kind": "capture"}
  ]
}
```

This example produces qualitative indexed views, not a metric mosaic. No invented physical
plane or guessed calibration is needed for that deliverable. Add metric overlap only after the
model and surface plane are verified. Bootstrap's two moving stages remain separate because
the second depends on inspecting the first; do not split an already determined safe sequence.

`fit_calibration` fits a **local 2×2 matrix**, tied to Y/Z and the same physical surface.
It does not solve/verify the camera model used for overlap, `plan_view_pose` or metric mosaics.
`verify_calibration` checks M·J≈I only. A good inverse or training residual is not an independent
physical verification. Track with the supplied NCC tool (41 px patch, 120 px search in programs);
do not estimate displacement by eye or trust a repetitive-grid match without checking it.

## Bootstrap and survey completion

1. Identify the actual camera. Search before assuming a viewing direction; search defaults to
   one Y row (`y_span_mm: 0`). Widen Y when the direction is unknown and coverage permits it.
2. Choose fit views from observed search frames and a distinct `holdout: true` pose. Keep at least
   two useful fit poses plus the holdout after exclusions; this count alone does not guarantee a
   well-conditioned perspective solve. Legacy boxes may restrict all useful Z stops.
3. Holdouts run last, are excluded by `camera_bootstrap.py`, and finish at park Z above the last
   holdout XY (`result.finalMachine`). Fetch the index and frames through MCP, solve offline,
   `set_camera_model`, then capture fresh and `verify_camera_model` there (default 8 px).
   `plan_view_pose` refuses an unverified model; choose the holdout from search evidence instead.
4. Inspect dropped captures, clipping, coverage and seams. Seam mismatch can be the wrong plane,
   raised-object parallax, a wrong match or camera movement; re-verify a known target before
   starting another bootstrap. Never infer a replacement surface height from seams alone.
5. Save evidence links, calibration, XYZ/B, tool, uncertainty, coverage and unresolved gaps.
   For a future cut, measure accessible XYZ/orientation datum candidates while the probe is fitted;
   a camera survey alone does not release cutting geometry.

Requested snapshots survive the 12-frame RAM cache and Luban restarts: use
`get_frame {frame_id}` or the returned `camera.file`. `track_feature` also reads
archived snapshot IDs. Survey/programme images remain available by their saved
file paths; there is no 12-image survey limit. Only requested snapshots are
archived, not every live-video frame. Retention ends when files are removed.
