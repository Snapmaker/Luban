# Planning related measurements without redundant approaches

Choose an existing procedure whose geometry and recovery rules fit the question. Local
continuation already exists; a full-height return in one runner does not imply it is missing
from the toolset. Keep all motion within the selected procedure's approved bounds and apply
`cnc-motion-rules` first.

## Capability and return boundaries

| Measurement | Existing tool | Movement between measurements |
|---|---|---|
| Top profile / height map | `probe_surface_path` / `probe_surface_grid` | Local lifts and guarded or stepped links; full approach to station 1 and raise at completion. Guarded uses `z_safe_delta_mm`; stepped uses `hop_lift_mm`. |
| Repeated contacts along a vertical wall | `probe_wall_follow` | Back off by `standoff_mm`, step along with contact handling away from the face, then march from the new position. A miss returns to the approved start line. |
| Unknown internal pocket, including polygonal or curved perimeter | `probe_trace_perimeter` / program `trace` | Release-verified standoff, local crawl, coarse steps on proven straights and selective confirmations. Requires a valid interior entry, measured depth, bounds and perimeter budget. External tracing is not exposed. |
| Internal corner between fitted walls | `probe_corner` | Bisector find followed by radial probes from the measured centre; retreats to that centre, not park, between probes. Requires fitted walls and a radius bound; not an external-corner tool. |
| Hole / boss diameter | `probe_circle` | Inside: radial probes from the staged interior position, returning there until final raise. Outside: full-height reposition between azimuths. Do not use the inside mode to avoid outside clearances. |
| Block top and sides | `probe_stock_outline` | Stepped top links; local standoff links on the same side; full raise/reposition when changing sides. Needs a suitable block estimate and valid approach geometry. |
| Planned mixed directions / CAM stations | `run_probing_gcode` | `link_mode: stepped` or `wall` enables local links and blocked-station handling. G38.2/G38.3 cycles still return to their own starts, including misses. Default `raise` uses full-height XY links. Read `cam-probing.md` for constraints. |
| Isolated axis/vector measurement | `probe_point` / `probe_vector` | Returns to the march start and raises on success. Vector probing supports polygon faces but does not itself follow the polygon. |
| Datum approach that must END LOW for the operator's touchscreen origin setup | `probe_approach_and_hold` | Raise, hop at the traverse height, guarded descent, sensor-gated march, then HOLD (in contact, backed off, or at a stated datum). The only procedure that does not raise at the end; `stop_gcode_job` is the sanctioned raise and keeps the measurement. Not a transport or a way to park low between measurements. |
| Explicit independent approaches | `probe_sequence` | By default every probe returns to its own start and raises, including `on_miss: continue`. Opt-in `local_links: {clearance_z, max_hop_mm?}` (#242) links stations at a stated toolhead machine Z above the measured top instead: retreat to the march start, raise only to max(clearance, current Z), hop ≤ `max_hop_mm` (cap 60), a few guarded mm of descent. Checked against landmarks/keep-outs at that height; first hop and final exit at the traverse height. In a program `clearance_z` may reference an earlier top touch. |
| Multiple operations / B orientations / measured dependencies | `probe_program` | References feed earlier results into later bounded plans. Each successful probing op ends raised; groups and one approval do not fuse motion between ops. |

**Depth is bounded by the stylus, not the tool length (issue #187).** Before any station below a
surrounding surface — a pocket floor, a groove, a hole deeper than a ball-radius dip — write the
reach limit into the plan from `get_stored_state.geometry.stylus` (`reachMm − tipDiameterMm −
margin`) and pass the rim as `rim_z_machine` so the tool checks it at staging. The probe's
calibrated tool length (the setter offset behind `tipMachineZ`) is the toolhead-to-tip distance;
the exposed stylus below the body is a separate, shorter number, and only it says whether the
body clears the rim. A result carrying `stylusReach.status: "reach-unknown"` means the check did
not run; do not read it as clearance.

A same-column find → side probe → deeper search can cross these composition boundaries.
First ask whether a supported wall, surface, outline or CAM circuit expresses the intended
measurements safely. If not, a `probe_sequence` with `local_links` is the sanctioned way to keep
independent stations low between marches once the top is measured; record any transition that
still requires a full return (a change of face or B, an unmeasured fixture) rather than inventing
an option the schema does not advertise. The shared internal `marchToContact` primitive leaves
retreat policy to its caller, but is not an agent-callable motion tool. A miss does not make its
entire surrounding region clear.

## Choose samples and an exit condition

- Define the missing boundary, height, width or uncertainty and the precision the cut needs.
  Measure enough to decide that question; do not automatically produce a dense contour.
- For a top transition, establish the applicable heights, bracket coarsely, then refine the
  unresolved interval. A verified high-side entry can make high-to-low scanning preferable
  to repeatedly climbing a shoulder; check body reach, fixtures and the entire link envelope.
- For walls and corners, use wall fits and residuals to select where more points are useful.
  For unknown internal perimeters, trace already adapts step size and confirmation placement;
  do not replace it with independent fully confirmed vector probes at every tiny increment.
- Preserve partial results and their X/Y/B, tool and setup context. A jaw approach or changed B
  may need a new high approach; a neighbouring contact or photograph alone does not clear it.
- Keep observation proportional: use the live viewer for progress, synchronized captures for
  specific contacts, and high-clearance views for rotary orientation/fixture context.

## Broad surface map: select density, links and confirmation separately

For the operator's nominally flat FR4-board use case, 4×4 stations are the initial broad sample.
Use existing contacts first, including partial results from an unfinished/stopped larger grid;
never throw them away and rerun sixteen points merely to apply a faster recipe. Fine edge/datum
measurements and local anomaly refinement are separate needs, not justification for a dense
whole-board map. Preserve uncertainties and unsampled intervals in any interpolation.

The native surface op supports the following performance controls (check the installed schema):

```jsonc
{
  "id": "map", "kind": "surface_grid",
  "x_min": "<verified bound>", "x_max": "<verified bound>",
  "y_min": "<verified bound>", "y_max": "<verified bound>",
  "x_count": 4, "y_count": 4,
  "start_z_machine": "<applicable measured contact + guarded entry margin>",
  "expected_z_machine": "<applicable measured contact>",
  "floor_z_machine": "<bounded search floor respecting body access>",
  "hop_mode": "stepped", "hop_lift_mm": 0.5,
  "confirmation_mode": "adaptive", "confirmation_tolerance_mm": 0.05,
  "fine_step_mm": 0.05, "backoff_mm": 0.2, "sensor_delay_ms": 50
}
```

This is a shape example, not executable coordinates. Replace the string placeholders with
measured numeric values or valid bounded program references. The 0.05 mm threshold is an example
escalation threshold, not certified accuracy; choose it for the required result and sensor/step
resolution. The 50 ms window applies to a healthy GPIO feed, not MQTT. Each hop still obeys the
60 mm spacing bound, obstacles, release verification and stepped-lift recovery. First entry and
final exit retain full clearance. If 0.5 mm fails to release, do not retouch or move sideways.

Adaptive mode confirms the first station and suspicious contacts (height variation, coarse
contact, contact during the link or a preceding miss). It keeps routine fine contacts without
extra retouches, and reports unknown repeatability for a single observation. Its conditional
retouch backs off 0.2 mm only if that establishes release; disagreement stops with uncertainty.
Perimeter tracing's `confirm_at` is a different existing interface and must not be passed to a
surface op. Legacy fixed `confirm_passes: 1` still adds one retouch; zero is not single-touch.

## Diagnose elapsed time before changing the plan

Use `runMs`, `byKind` and station timings from `result.timing` / `get_job_timing`. Separate:

1. initial unknown-height search;
2. return-to-park and repeated descent of already verified columns;
3. local lifts/links;
4. fine approaches, release checks and confirmations;
5. camera/rotation time and approval or conversation gaps.

`execMs` already contains motion plus controller/transport overhead. Sensor time is included
in `idleMs`; some idle can precede a run. Do not sum overlapping counters or substitute a
nominal feed calculation for elapsed job time. An unchanged 1 mm physical segment limit can
still require many controller transactions even when a logical coarse step is larger.

Choose the remedy that matches the dominant cost: fewer redundant stations, a suitable
continuous procedure, reuse of valid approach evidence, or bounded refinement near an edge.
Reduce repeated contacts through the surface-specific adaptive policy, not by globally changing
confirmation defaults or sensor delays. Do not assume every full retreat is waste.
An observed repeated transport cost is an optimization opportunity, not a proven saving until
an equivalent supported plan and its necessary clearances have been accounted for.
