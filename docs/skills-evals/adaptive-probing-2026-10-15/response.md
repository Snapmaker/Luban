# Offline exercise — proposed responses only

No live inspection, machine calls, staging, dry-run execution or tests were performed. Values below come from the fixture, not live tool results. Each case is independent.

## Case A

I would plan a single continuous 4×4 serpentine surface grid, retaining corners and interior coverage. Machine X stations are 141, 160.333333, 179.666667, 199 mm; machine Y stations are 185, 205.333333, 225.666667, 246 mm. X pitch is 19.333333 mm and Y pitch 20.333333 mm; both fit a 21 mm local-hop limit and the 60 mm maximum. These are 16 new broad-map stations; the two existing top-find contacts remain supporting evidence and are not repeated.

Fixture preflight (to be refreshed through MCP before any future staging):

- State: homed, idle, verified; live connection, warnings and current position still require readback at execution time.
- Frame: every XYZ below is MACHINE frame; all Z values are raw TOOLHEAD Z.
- Height: ordinary approach/transfer and successful finish use machine toolhead Z328. First approach is the verified column to machine toolhead Z205.0; search floor is machine toolhead Z202.
- Obstacles/access: fixture says the rectangle has no landmark/keep-out intersections, ball/body access is verified and the park approach is clear.
- Tool/sensor: unchanged fitted calibrated probe and clamping at B0; healthy GPIO polling 10 ms supports sensor_delay_ms 50. Preserve the calibration and datum snapshot with results; verify the active-tool clearance basis before execution.
- Authority: “Plan it for me” requests this plan, not staging or movement. No confirm URL exists yet.

Proposed standalone `probe_surface_grid` argument fragment, subject to the installed schema exposing adaptive confirmation:

```json
{
  "x_min": 141,
  "x_max": 199,
  "y_min": 185,
  "y_max": 246,
  "x_count": 4,
  "y_count": 4,
  "start_z_machine": 205.0,
  "expected_z_machine": 204.4,
  "floor_z_machine": 202.0,
  "hop_mode": "stepped",
  "hop_lift_mm": 0.5,
  "max_hop_mm": 21,
  "max_drop_mm": 3,
  "coarse_step_mm": 1,
  "fine_step_mm": 0.05,
  "confirmation_mode": "adaptive",
  "confirmation_tolerance_mm": 0.05,
  "backoff_mm": 0.2,
  "sensor_delay_ms": 50
}
```

The measured top-find evidence is raw machine toolhead Z204.3 at machine X171 Y214 and Z204.4 at machine X171 Y217.75, with the applicable fitting/B0 context. The fixture independently establishes the first approach column to machine toolhead Z205.0. I would reuse those facts rather than insert another long find from park. The 3 mm per-station drop bound and absolute floor both constrain searching; a deeper feature becomes missing coverage, not permission to extend the search.

Use `stepped` links so the requested 0.5 mm is a release-verified local lift above the previous contact, with contact-aware links. It is not `z_safe_delta_mm` (guarded mode has a 3 mm minimum), and it does not lower the ordinary motion floor or park. A contact during a stepped link invokes the bounded stepped recovery; it also makes the following contact suspicious enough to confirm. Held contact prevents further lift or lateral travel.

Adaptive confirmation gives the first station one release-verified retouch. Routine fine contacts that agree with the expected surface need no extra retouch. Unexpected height, coarse contact, a bumped link or a preceding miss causes one conditional retouch. The 0.2 mm backoff must establish sensor release before re-approach. Read and preserve each station's confirmation reason, count, observations and spread. Do not use `confirm_passes: 0` as a single-touch switch: in fixed mode confirm_passes counts extra cycles and zero does not select single-touch mode. If adaptive mode is absent from the advertised schema, report that capability gap before changing the proposed contact policy.

Event estimate: the documented stepped-surface estimate is 40 + 120×16 = 1960 events, before any enclosing program overhead. Check the actual event limit and planner estimate; do not substitute the guarded-scan 60-events-per-station estimate. A `probe_program` wrapper adds overhead and may exceed the default 2000 limit. If using a wrapper, a future read-only `probe_program` dry run with this one `surface_grid` op determines `eventBudget`, `jobEventLimit` and `fitsEventLimit`; no such call is made in this exercise. Resolve any required buffer increase before staging, without removing the requested coverage. Estimate elapsed time from actual prior controller/station timings if available, not sensor delay alone.

If subsequently instructed to run the map, refresh `get_connection_status`, `get_position`, `get_stored_state`, `get_active_tool` and `get_probe_feed_status`, verify schema/budget, then stage this one continuous procedure for one approval. Immediately return one sentence describing the 16-point map and end that turn with the returned confirm_url alone on its last line. Only after that handoff, use `start_gcode_job {"job_id":"<returned id>","wait_for_approval_ms":110000}` as a background approval poll (or the operator's pasted confirm_token). A timeout is not approval or grounds to restage. Preserve results through `get_gcode_job_status` and report the ending.

Report sampled raw height range, fitted-plane tilt and residual peak-to-valley warp, preserving XYZ/B, calibration/datum, clamping context and partial results. The 0.05 mm threshold is a repeatability decision threshold, not certified absolute accuracy. A single observation has unknown repeatability (`spreadMm: null`), not zero error; two agreeing contacts only bound observed repeatability under those conditions. Sixteen points do not rule out bow, steps or local defects between stations and do not establish edge registration or a cutting WCS. A first-station miss aborts; later no-contact stations remain explicit gaps. Refine only a measured anomaly or a separately identified unresolved constraint.

## Case B

After raw machine toolhead Z204.4 contact, a requested 0.2 mm confirmation backoff that still leaves the sensor triggered has not established release. There is no valid second independent touch and no confirmed repeatability. Preserve the initial observation and failed-release evidence, stop/hold, and make no further retouch, sideways move or automatic extra raise. A held-contact abort remains held even inside a program with on_fail skip. Ask the operator to inspect/free the probe or resolve the sensor condition. Do not disconnect or bypass the feed. After release is confirmed, recovery needs the operator's instruction: the first authorized recovery motion is a staged straight-up `move_z` to machine toolhead Z328, then reliable-position readback and a revised bounded plan. Never descend back to the old start height. If an overtravel alarm is present, it additionally needs physical inspection and explicit operator clearance after release.

Separately, if the sensor did release and the retouch is raw machine toolhead Z204.25, the two observations differ by 0.15 mm, three times the 0.05 mm decision threshold. This fails confirmation; do not present their midpoint (204.325) as a trusted surface or zero the spread. Stop with uncertainty and retain both readings plus partial map results. Inspect sensor timing, fitting stability, probe/contact behavior and board support before proposing a targeted recheck of the failed station. Do not automatically repeat the entire map. On an abort with sensor released the normal recovery is straight up to machine toolhead Z328; if contact remains held, hold instead. No diagnostic cause is established by the numerical disagreement alone.

## Case C

Neither number is proved wrong: they describe different references. Preserve the saved raw setter trigger at machine toolhead Z171.4 and its named datum snapshot `legacy-reference:175.5:75`, basis `legacy_reference_convention`, datumZ 100.5. Their difference is 171.4 − 100.5 = 70.9 mm: the conventional conversion offset used by those surveys. The datum itself came from the nominal convention 175.5 − 75 = 100.5; it is not an independently measured physical machine plane.

Keep 70.9 and the old surveys in their original convention. Keep raw contacts immutable with their job/date, direction, XYZ/B, fitting, clamping, calibration, uncertainty and sampled extent. Label projected tip heights as conventional and `physicalReferenceVerified: false` rather than claiming independently verified physical machine Z. Do not reinterpret historical contacts by subtracting 45, retrofit a new datum onto them, or recalibrate merely to change the label. Recover and reuse the already covered features; there is no case here for repeating those surveys.

Record the operator's 45 mm as a separate collet-bottom-to-tip measurement with its explicit reference, fitting and uncertainty. It is neither the setter conversion offset nor a bound below the machine TOOLHEAD reference. Do not pass it as `bit_length_mm` without evidence that it represents the configured approach convention, or as `protrusion_mm` with a false toolhead reference. No offset, origin or calibration write is justified by the apparent numerical discrepancy. The useful correction is to the metadata/wording “probe length,” separating the two quantities, not overwriting their values.

The bed-measured obstacle top cannot be combined silently with the conventional 70.9 offset. Its own physical datum must be linked to the machine frame with known uncertainty, and physical tool clearance remains unresolved until there is either (a) a current independently established bound below the machine toolhead reference, or (b) an explicitly configured conservative maximum `toolhead_clearance_bound` for allowable tools. An independently measured setter physical-machine datum with bounded uncertainty can support a current fitting's physical clearance calibration. A same-datum setter rerun alone would not establish that missing physical reference. Neither the 45 mm collet measurement, a nominal setter projection nor a setter approach estimate supplies it.

The missing evidence is therefore the relationship among bed/obstacle datum, machine/toolhead reference and fitted tip, with uncertainty—not another survey of already covered features. First recover any existing independent datum/clearance evidence. If none exists, request the explicitly referenced physical measurement or conservative bound needed for that gap only. Retain and propagate all old evidence; if a new transform is established, create a separately traceable derived interpretation without rewriting history. Until then, physical-obstacle clearance relying on this unknown bound and any cutting geometry that mixes those datums remain unresolved.

For any later probe-to-cutter transfer, actual applicable old/new raw setter measurements are required under the same-session/fitting rules, and the established work-Z chain must be known. The common datum cancels in their difference, but setter contact versus stylus-on-stock pretravel still needs evidence; do not invent a correction or manufacture old_trigger_z from stored geometry. This case authorizes no motion, setter run, origin adjustment or survey repetition. No tool execution is proposed here.
