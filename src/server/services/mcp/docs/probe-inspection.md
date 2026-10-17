# Probe inspection with synchronized camera evidence

An asynchronous `capture_frame` is a current view, not a photograph tied to a particular
probe contact. The runner may have retracted by the time the call executes. Use stationary
captures inside the measurement operation when the image must show the probe at that spot.

## Contact captures

A `probe_sequence` probe step (also in a `probe_program` sequence) accepts:

```json
{"kind":"probe","name":"rim","dz":-1,"max_travel_mm":5,
 "capture":{"label":"rim contact","settle_ms":500}}
```

The example is a step fragment: its approach position and travel must already be planned
from measured or operator-stated geometry. It is not a standalone motion instruction.

`probe_surface_path` and `probe_surface_grid`, including their program op forms, accept:

```json
{"capture":{"stations":[1,4,7],"label":"channel transitions","settle_ms":500}}
```

Indices refer to the final scan plan, start at 1, are unique and must be within its station
count. Up to 60 photographs may be selected per scan. The delay defaults to 500 ms and is
bounded to 0–5000 ms. No motion fields are accepted inside `capture`.

The runner waits for reliable idle position reports and the requested damping delay, then
photographs after the final confirm pass, before the normal retreat; a continuing miss
is photographed at its search limit. A first-station miss that aborts a scan does not capture.
The probe channel remains expected during the stationary photo. The result's `capture` records
`status`, persistent `file`, `frameId`, `capturedAt`, actual toolhead `machine` coordinates,
`b`, position `reliability`, and camera `device`/`provider`/`source`. This pose is the final pass,
which can differ from the measurement's median contact. Old stream frames from before settling
are rejected. `get_frame {file}` reads saved images after the 12-frame memory cache expires.

Camera/capture-storage failures are recorded as `capture.status: "failed"` and do not discard
measurements or prevent their normal retreat. Stop requests and safety alarms still abort.
The confirm preview describes the selected photographs, and program event estimates include
those frames. A separate program `capture` op after a measurement remains useful for overview
photos but sees the preceding operation's raised finish position.

## Continuous observation

`list_cameras.stream` exposes `stream_url` (`/camera`, viewer), `mjpeg_url`
(`/camera/stream.mjpeg`) and `snapshot_url` (`/camera/snapshot.jpg`) when enabled.
`/camera/status.json` reports running/client/freshness state. The live viewer and tool snapshots
share the same source, avoiding competing opens of a USB camera. An open viewer may stay up
throughout probing. Plain observation needs no metric calibration; pixel-to-machine conversion
and model-based view positioning still require a verified camera model.

## Stepped shoulder recovery

The 2026-09-27 B0 inspection (`7685888d887d`, station 20) moved from machine Y259 to Y259.5
at toolhead Z194.2, backed to Y259, then rose repeatedly. Probe transitions during the rises
were not checked before the next XY step. At Z200.2 the probe remained triggered after the
backoff. The old error claimed 1 mm although the actual link/backoff was 0.5 mm. The surface
runner recorded `abort-held`; the outer program nevertheless commanded toolhead Z328.

The corrected behavior:

- Stepped surface links may add up to one stored ball radius (`probe_tip_diameter / 2`)
  beyond the standard backoff, in 0.25 mm steps with release checks. This is ball size, not
  exposed stylus length. Missing geometry disables the extra margin.
- Additional retreat stays in a verified straight corridor at the same toolhead Z, including
  contiguous incoming scan links. Turning a grid corner or changing height invalidates that
  history. A lift starts a new clearance history at its actual backed-off position.
- Top-link rises use 0.5 mm sensor-checked segments. A monotonic probe-trigger counter also
  catches a touch-and-release during a controller command. Any lift contact holds before
  another sideways move; even a subsequent release does not turn that hold into an automatic
  recovery raise. Pocket wall links retain their reverse-path/block behavior.
- Error messages report the actual backoff distance. Persistent contact with no verified
  retreat left holds. The outer program preserves a nested hold, including with `on_fail: skip`,
  and reports recovery failure/hold rather than claiming an unverified raise succeeded.

The extra retreat is bounded recovery within the approved scan, not permission to move around
an unknown obstruction. Completed stations remain available on the partial job result.

## Efficient inspection planning

Define the missing cut boundaries, depths, retained material and fixture clearances first.
Reuse valid measurements from the unchanged tool/setup/B angle. With applicable measured
height evidence, approach through the guarded descent rather than repeating a fine air search
from the park height. Find unknown surfaces with a sensor-gated march. Bracket transitions
coarsely and refine them to the required tolerance; avoid dense resampling of known flat banks.
Use the previous job response's `next_event_index` for long-polling `since_event`.

### Broad maps and adaptive surface confirmation

For the operator's nominal FR4 broad-warp task, begin with 4×4 (16) points and refine measured
anomalies or unmet cutting constraints. Do not repeat existing coverage to apply this recipe;
16 points cannot exclude unsampled local defects or replace edge/datum measurements.

Surface path/grid and their program ops accept `confirmation_mode:"adaptive"` with an explicit
`confirmation_tolerance_mm` (>0, ≤1). Routine fine contacts use one touch. First station,
after a miss, coarse contact, a contact-aware link bump or an unexpected height change earns
one extra retouch. Choose a threshold from the task and sensor uncertainty; it is not a claim
of absolute accuracy. `backoff_mm:0.2` is supported when `fine_step_mm≤0.2`, and **release must
be verified before retouch**. A stuck probe holds; disagreeing contacts become uncertain and
are excluded from accepted geometry. Single observations report `spreadMm:null`.

Use `hop_mode:"stepped", hop_lift_mm:0.5` for the requested small local links, subject to
existing obstacle, ≤60mm spacing, release and lift-contact checks. `backoff_mm` is separate
from link height. Guarded `z_safe_delta_mm` still has a 3mm minimum; ordinary entry/exit and
transport clearance are unchanged. Fixed mode remains default, and `confirm_passes` counts
EXTRA cycles after the initial fine touch (1 means two observations; 0 is not single-touch).
Use recorded phase timings, including controller/transport overhead, instead of a fixed
seconds-per-point estimate. GPIO and MQTT contact-check windows require their own evidence.

### Contact coordinate provenance

Each procedure snapshots the fitted probe's setter calibration before running. Raw toolhead
contacts remain unchanged; additive `tipMachineZ` and `tipCalibration` preserve trigger,
datum, fitting, job/date and uncertainty. Legacy offsets retain an unknown or conventional
basis, not a fabricated physical datum. For uncertain/no-contact stations there is no accepted
tip point. Keep raw observations and use the original survey's calibration, not today's.

### Include the milling datum in the probing plan

Before removing the probe, establish how the work frame will be set and rechecked against
accessible, stable features. Choose a practical reference with verified probe-ball, stylus,
body and fixture access; record XYZ, axis orientation, B setup, tool identity, measurement
uncertainty and the CAD-to-work registration. A single top contact does not establish X/Y or
orientation. A derived centre can be appropriate if accessible measurements locate it and
provide a repeatable check; it need not be physically visited at Z0.

The inspection follow-up exposed a separate readiness gap: the review model used a stored
rotary-axis origin, then was mapped to a coherent live G54 snapshot. Neither step established
an accessible datum's provenance and recheck. Plan and verify those references before CAM
release or the tool swap, rather than treating a matching model/offset as sufficient.

`goto_work_origin` moves only XY at the current Z, subject to transport guards. It does not
set the work origin, raise first, descend to Z0 or certify unseen fixture clearance. Verify
the complete return route, first program moves and cutter/holder sweep for the actual setup.
Preserve valid datum registration through the measured tool change; length transfer does not
repair missing X/Y, an unknown old-tool Z reference or unverified indexed-B registration.
One verified WCS can serve multiple B orientations in the same mounting: retain it and account
for the measured rotary transform in CAM. A changed face height does not require re-zeroing,
and per-angle datum probing is not mandatory when the existing registration remains valid.
Rotation can obstruct the previous zero or approach despite that valid reference. Do not
return to work zero automatically: verify the route at the new B or retain the WCS and use
another clear entry point. A reference location does not have to be visited to use its frame.
See the canonical [work-datum guidance](../../../../../.agents/skills/cnc-motion-rules/references/work-datums.md).

### Existing local continuation and composition limits

Local continuation is already implemented across the toolset. The agent-facing
[planning reference](../../../../../.agents/skills/cnc-probing/references/planning.md)
compares all measurement families and their return boundaries. Implementation anchors:

- `probeSurface.ts`: guarded or stepped local links between top stations.
- `probeWallFollow.ts`: contact-relative standoff, stepped link, then the next side march.
- `probeOutline.ts`: local top links and same-side standoff links; full reposition on a side change.
- `probeTracePerimeter.ts` / `perimeterTrace.ts`: internal-perimeter crawl with verified release,
  coarse straight runs and selective confirmations.
- `probeCorner.ts`: radial marches from the measured centre; `probeCircle.ts`: internal radials
  from the staged interior origin. External circles still reposition at full height.
- `probeCam.ts` / `camLinks.ts`: `stepped` and `wall` links, with blocked-station outcomes.
  G38.2/G38.3 returns to the cycle start even on a continuing miss; the default link mode is `raise`.
- `march.ts`: `marchToContact` returns a contact or miss and leaves retreat policy to its caller.
  It is an internal primitive, not an independently callable MCP tool.

`probe_sequence` deliberately returns to the march start and raises after every probe.
`probe_program` resolves bounded references and batches approval, but successful probing ops
still finish raised. These are specific composition boundaries, not evidence that guarded
continuation is missing. Before proposing new motion machinery, determine whether an existing
continuous procedure fits the geometry and entry conditions. Do not use an internal-pocket
routine for an unbounded external fixture, or bypass a refused route with many tiny moves.

### Timing and the 2026-09-27 inspection follow-up

The seven probing jobs following `7685888d887d` took approximately **21m 31s** of execution,
excluding approvals and conversation gaps. Their timing records support two different findings:

- Repeated approaches to the same columns (X205/Y263 and X210/Y263) accounted for about
  **2m 25s** of return/re-descent work. The sequence runner enforces those returns. This is
  observed transport cost, not a demonstrated saving: an alternative must preserve the
  unknown-jaw checks, valid entry geometry and conditional choices after contacts/misses.
- `cc6e2592ccd6` took **5m 51s** for 17 top stations from machine Y278 to Y270 at X195/B0.
  It already used 16 local 0.5 mm links and 2 mm local retracts. Thirteen contacts lay around
  toolhead Z214.2–214.3; fine/confirm approaches dominated, not repeated returns to Z328.
  Bracket the transition coarsely and refine to the required tolerance instead of sampling
  the whole plateau densely. Trace's selective confirmations already solve a related
  problem for internal perimeters; they are not currently a top-scan option.

Read `runMs`, `byKind` and station timings. `execMs` includes motion and controller/transport
overhead; `senseMs` is part of `idleMs`, which can include time before the run. Do not double
count them or assume coarse descent always dominates. Retain the confirmation quality and
sensor window required for the measurement and transport. Full clearance for unknown jaws,
changed faces/B orientations or unsafe local links can be justified.

For conclusions, compare coordinates explicitly: a boundary at Y270.5–271 is farther from a
cut near Y256 than a historical Y269 estimate (14.5–15 mm versus 13 mm along Y). This is a
coordinate comparison, not verified machining clearance. A top transition at one X/B remains
a probe-reference measurement; material identity, ball geometry, unmeasured fixture extent
and cutter/holder dimensions must be resolved before using it as a milling limit.

The follow-up observed the existing running service and installed skills; it was not hardware
validation of the newly committed recovery/capture changes.

Validation is offline: simulated-machine traversal regressions, real runner tests with mocked
machine/camera IO, camera failure/freshness tests and held-abort tests. These changes do not
restart the running machine service or qualify the current fixture for milling.


### Latest datum handoff and workspace tooling

The subsequent inspection turn measured a B0 rim at toolhead Z201.3 and edge contacts at
X203.1/Y253.4 (job `4a426e131af8`). It proposed an air-side reference at machine
X230/Y245/toolhead Z231.3, moved there in jobs `65a87b00d77f` and `0857228250d7`, then waited
for the operator to set XYZ manually. The mapping readback was not evidence that this origin
had been set. B0 approach evidence also does not certify access after B rotation.

`set_workspace_origin` closes that tooling gap: a measured origin can be assigned from a
stationary verified pose with one explicit human approval and checked readback. Travelling to
the zero point merely to press Set Origin is unnecessary. `select_workspace` supports an
existing job's required offsets without rewriting them. Prefer one common WCS; multiple
workspaces are discouraged and supported only when needed, especially for existing G-code.
See [workspace tools and verification limits](workspaces.md). These changes remain offline;
the inspection machine and its installed skills are not changed by this PR.
