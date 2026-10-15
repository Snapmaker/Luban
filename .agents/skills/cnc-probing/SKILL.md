---
name: cnc-probing
description: "Plan and run touch-probe measurements through Luban MCP: top profiles, flatness, walls, pockets, edges, holes, stock outlines, probe calibration and the rotary-axis check. Choose bounded local continuation, stylus reach and measurement density to answer the machining question. Load cnc-motion-rules first; CAM probing programs use references/cam-probing.md."
---

# CNC probing: the touch probe

> **Load `cnc-motion-rules` first; do not plan motion without it.** The eight laws, the coordinate
> doctrine, `get_position.reliability`, the canonical calls and the two-op find-then-scan program
> live there (§8). This file holds only what is specific to probing. The bed camera survey lives
> in `cnc-visual-alignment`.

## Jig facts for this rig (read `get_stored_state`; these are for orientation only)

| Item | Value | Note |
|---|---|---|
| Park / procedure traverse height | machine Z328 | ordinary transport and successful procedure completion; local links use the procedure’s own envelope |
| Probe effective length | `geometry.probe.effectiveLength` | never a remembered figure; measure if unset |
| Tool setter | surface machine Z100.5; trigger 175.5 with the 75 mm reference | `run_tool_setter` |
| Rotary axis | `geometry.rotary` — a HISTORICAL estimate tied to the probe length, clamping and date it was measured with (this jig: 2026-09-05, 71.3 mm probe, raw stock; ~1 mm off for a later clamping) | physical Z, never a toolhead target; before CAM rotates about it, check it against opposite-face contacts — [rotary-axis](references/rotary-axis.md) |
| Chuck jaws | reach ~Y269 | a `keep_out` volume for programs |
| Tailstock | inside the `rotary-axis` box, Y < ~110; height UNMEASURED | measure it (see below), then `set_landmark` |

## Recover existing measurements before planning more

Read [measurement evidence](../cnc-motion-rules/references/measurement-evidence.md) before
requesting a repeat or diagnosing missing registration. Retrieve original job/survey results
and handoffs, derive what they constrain, and resolve contradictions before choosing new
measurements. Do not re-probe covered quantities. Name the precise missing or invalidated
constraint and why saved evidence cannot supply it before proposing the smallest targeted
probe. A model discrepancy, lost context or new B index is not evidence that a survey expired.

## Choose measurements that answer the machining question

**A survey for a future cut is also a datum job.** Ask the intended hole/feature position, size
and positional tolerance, face/B and clamping continuity in the same question batch. Retrieve
the prior measurements before deciding what remains. Measure accessible X/Y edges, yaw and Z
references while the probe is fitted, in the same bounded program where practical. Report datum
candidates and their tip convention; a survey request authorizes neither a cut nor an origin write.

Justify pitch from what must be resolved. A sampled edge bracket alone has at least ±pitch/2
uncertainty: ±0.2 mm requires pitch ≤0.4 mm before adding probe uncertainty, not a 2 mm grid.
Prefer targeted side marches/edge bands over a dense whole-face grid when that answers the hole
registration question. Use coarse-camera/probe evidence for the fine bounds, stepped links for
unknown shoulders, and explicitly include the event budget.

Start with the deliverable: which boundaries, depths, remaining material and fixture clearances
must be known to propose the cut? Include the
[work datum and its recheck](../cnc-motion-rules/references/work-datums.md): identify accessible
references for XYZ/orientation, verify probe-body access and measure them before the probe is
removed. A top profile alone does not register the milling WCS. Reuse completed measurements
with their original calibration and applicable workholding/datum context; a measured tool
transfer or known B transform preserves reusable physical geometry. A width measured away from the cut is a reference,
not the cut's verified contour. Preserve partial results and refine the gaps instead of rerunning
whole scans. Produce a reviewable geometry/cut proposal as those constraints become known.

**Stylus reach bounds every descent beside a wall or into a groove.** The limit is the exposed
stylus length (measured or operator-stated for the fitted probe, never remembered) minus the
ball diameter and a stated margin, measured DOWN from the highest surface under the probe BODY
— the rim the body lands on, not the floor the ball is heading for. Write the limit in the plan
(e.g. exposed 21, ball 2.5, margin 2: no floor contact more than 16.5 mm below the highest rim
under the body) and give every march there a `max_travel_mm` that respects it. Readings at
another B angle are in the rotated pose ([rotary-axis](references/rotary-axis.md)).
Read `geometry.fields.probe_stylus_exposed_mm` and `probe_body_diameter_mm`; record measured or
operator-stated values through `set_probe_geometry`. Program references are
`probe.stylus_exposed_mm` and `probe.body_diameter_mm`, with mandatory `between` bounds.
If missing, ask both with the other unknowns. Do not invent a universally safe 5 mm edge descent:
limit work to approaches with proven body clearance until the reach is known.

**Known surface:** use the valid measured contact to set a guarded `start_z_machine` a little
above it and `expected_z_machine` at the contact. Do not repeat a long fine search from machine
toolhead Z328 simply because another op or turn began. First confirm that the evidence applies
to this approach column and unchanged setup; a different B angle needs its own evidence.

**Unknown surface:** find then scan in one `probe_program` (JSON in `cnc-motion-rules` §8).
Use a `sequence` sensor-gated −Z march from the proven safe height, then reference its contact
for the scan's start and expected Z. A guessed height or CAD nominal cannot replace this find.

For channel boundaries, state the required edge tolerance, sample coarsely to bracket transitions,
then refine only unresolved intervals and stop once the cut-planning question is answered. Dense
uniform sampling of a known flat bank adds time without resolving the unknown edge. Budget actual sensor-checked moves, confirm passes, captures
and rotations; a nominal coarse step can still contain several controller transactions.

**Choose the movement pattern before batching calls.** For adjacent measurements of the same
feature, use the appropriate continuous procedure below. `sequence` returns to each march's
start and raises after **every probe**, including a continuing miss. `probe_program` shares
approval and measured references, but each completed probing op still finishes raised; it does
not fuse their paths. Keep related stations inside one suitable op. Unknown fixtures and changes
of face or B can justify full clearance. Small XY increments alone do not prove a route clear.

For the complete capability/retreat comparison and timing decisions, read
[planning and local continuation](references/planning.md) when arranging multiple probes or
reviewing a slow inspection. For imported or hand-written probing programs and mixed station
links, also read [CAM probing](references/cam-probing.md).

Which measuring op:

| The operator wants… | Op | Notes |
|---|---|---|
| one height | just the `sequence` | report toolhead Z and physical = Z − probe length |
| a profile along a line, a crown, "is it level along Y" | `surface_path` | crown X = symmetry centre, see "Reading a profile" |
| "is it flat", a height map, a pocketed box | `surface_grid` | plane residual peak-to-valley + tilt |
| where a block is and how big | `stock_outline` | needs an estimated centre and size |
| a VERTICAL wall at N points (pocket side, boss face), a corner's shape | `wall_follow` | march, back off 2 mm, step along, march again — no retreat to the start line |
| the RADIUS of an internal corner between two fitted walls | `corner` | bisector march, then radial marches from the fitted centre; needs `radius_max_mm` |
| the whole perimeter of a pocket of UNKNOWN shape | `trace` (`probe_trace_perimeter`) | 0.1 mm crawl from a point inside; needs `bounds` + `max_perimeter_mm` |
| a VERTICAL post/boss/hole diameter and centre | `probe_circle` | vertical-axis features only — a cylinder lying along Y is a `surface_path` across it |
| edges of stock of estimated size | `sequence` side marches | start outside the bounded stock; shorten air travel using applicable measured edges |

**Unknown Z, no stored axis, no operator number** (the common "scan that thing" case): the only
lawful route is the sensor-gated −Z march from the traverse height inside the program above.
Keep the travel bounded by probe-body reach and the approved search floor. Account for physical
segments and controller latency, not just `max_travel / coarse_step`. An approximate height helps
identify the region but does not authorise a blind descent into unknown space.

**Measuring inside an unmeasured region** (the tailstock): a `keep_out` bans SCAN geometry from
entering a volume; it does not ban deliberately measuring the thing. The sanctioned first
measurement is exactly the sequence above at the operator-named X/Y; record the result with
`set_landmark` + `clearance_z`, and say the keep-out is retired for that Y band only.

## Point, vector and circle probing

`probe_point` marches one axis (±X, ±Y, −Z) from the CURRENT position with a required
`max_travel_mm`; `probe_vector` marches an arbitrary direction. Side probes touch one tip radius
before the tip centre — correct for it. Results: median of lift-and-retest passes, spread as the
trust metric. `probe_circle` (N radial marches + Kasa fit) REQUIRES the operator's min/max
diameter bounds and a MEASURED top height; OUTSIDE fits = feature + tip diameter, INSIDE (hole)
fits = feature − tip diameter.

Feed latency is TRANSPORT-dependent — read `transport` from `get_probe_feed_status`. GPIO
(Blinka/U2IF, the Ubuntu box): 10 ms polling, `sensor_delay_ms: 50` is ample. MQTT: ~120–150 ms
trigger latency, keep the 200–300 ms defaults and the patient release checks. Before any run
the Workspace → Connection pills (Probe / Tool Setter / Setter Overtravel) must be green;
`unavailable: true` = the USB bridge is unplugged (tell the operator); "disabled (Settings → MCP
Server)" = the operator switched that sensor off — ask, never bypass.

## Live viewing and photographs at probe spots

Use `list_cameras` → `stream_url` for the continuously available `/camera` viewer; it shares the
capture source with MCP snapshots and can remain open during a program. `mjpeg_url` is the raw
stream and `snapshot_url` a current still; `/camera/status.json` reports stream state/freshness.
An asynchronous `capture_frame` can catch the head after it has retracted. For a specific probe
spot, request the photograph in the staged program itself:

- On a `sequence` **probe step**, add `"capture": {"label": "rim contact", "settle_ms": 500}`.
- On a `surface_path` or `surface_grid` op, add
  `"capture": {"stations": [1, 4, 7], "label": "channel transitions", "settle_ms": 500}`.
  Station indices are 1-based, at most 60 selected frames. Select indices after planning the scan.

The runner captures without motion after the final confirm contact, before retracting; a
continuing no-contact station is photographed at its search limit. The result's `capture` contains
the persistent file, frame ID, actual machine pose/B, timestamp and camera identity, or an explicit
camera failure. Read `get_frame {file}` for durable evidence (the frame-ID cache holds only 12).
The actual final-pass pose can differ from the reported median contact. A camera failure is
recorded and normal retraction continues; a stop or safety alarm still stops the procedure.
These options apply to sequence and surface scans, including inside `probe_program`; a standalone
program `capture` after a scan still sees its raised finish position. Do not recreate a low pose
with an extra move just for a picture. If the live schema lacks `capture`, the server needs updating.

## Surface flatness and height maps

Both procedures measure a TOP surface with many −Z marches under ONE approval; every number is
machine coordinates and every contact Z is TOOLHEAD Z.

- `probe_surface_path` — N stations along a line: `start_x/start_y` + `end_x/end_y` (or
  `dx/dy` + `length_mm`); `stations` (2–400; above 60 the confirm page warns about duration and
  event budget) or `spacing_mm` (a MAXIMUM; stations = `floor(length / spacing) + 1`, both
  ends included — 164→176 at 0.2 is 61 stations, 164.1→175.9 is 60). Result: per-station XYZ or
  `no_contact`, Z min/max/range, best-fit line slope, flatness = residual peak-to-valley.
- `probe_surface_grid` — serpentine grid (`x_min..y_max` or `center_x/center_y` + `size_x_mm/size_y_mm`;
  `pitch_mm` maximum or `x_count/y_count`, max 400 stations). Result: `zMatrix`, best-fit plane
  (tilt X/Y), per-point residuals, flatness, a text `heightMap` with +Y up.

`start_z_machine` is REQUIRED: the toolhead Z where the first march starts — measured (the
find-op reference, a `probe_point -Z`, an earlier scan) or operator-stated; never a guess and
never a rough estimate when a march can measure it. `expected_z_machine` gives station 1 its
slow zone. The runner reaches station 1 law-2 style (raise, hop at 328, segmented guarded
descent), then works the envelope.

**Surface envelope (operator law, 2026-09-05)** — applies between consecutive stations in
these scans. Other continuous procedures have their own bounded links; this envelope does not
transfer to ordinary motion or arbitrary operations. Keep parameters within their stated bounds.

| Parameter | Default | Cap | Meaning |
|---|---|---|---|
| `z_safe_delta_mm` | 20 (conservative; use 5 on a surface known to vary < 5 mm between stations) | 20, min 3 | guarded-mode lift above LAST CONTACT; stepped uses `hop_lift_mm` |
| `max_hop_mm` | 60 | 60 | largest station-to-station distance; check `span / (stations − 1) ≤ 60` before staging |
| `max_drop_mm` | 40 | 80 | how far below the previous contact a station may search; also bounded by `floor_z_machine` |
| `hop_mode` | `guarded` | — | see `cnc-motion-rules` §4: spacing × slope ≪ delta → guarded; steps/pockets/unknown → `stepped` (+ `hop_lift_mm`, default 2) |
| `coarse_step_mm` | 1 | 1 | also the worst-case press; station 1 is capped at 1 mm unless `expected_z_machine` is given |

Contact during a `guarded` hop is a collision already in progress (detected at the end of a ≤ 10
mm segment); a `no_contact` station records and the scan continues; the first station finding
nothing aborts. Successful completion raises to 328; abort recovery follows the motion rules,
including held contact. `stop_gcode_job` stops at the next step boundary and keeps every
completed station under `result` with `ending` saying why.

**Event budget — compute it the moment you know the station count.** The job keeps
`mcpJobEventLimit` events (default 2000, 200 000 with spindle telemetry on, max 1 000 000;
`get_mcp_diagnostics → buffers`); beyond it the log
keeps the first 20 and the newest tail, while `result` is never trimmed. Cost ≈ 100 + stations ×
(110 at `z_safe_delta_mm` 20, 60 at 5); a blind −Z find adds ~3 events per mm of travel. When
the estimate exceeds the limit, ask the operator to raise it (Settings → MCP Server → Diagnostic
buffers, or `LUBAN_MCP_JOB_EVENT_LIMIT`) in the same question batch as everything else. For stepped
scans, do not assume the guarded 60/station figure: the program planner budgets 40 + 120 per
surface station, plus program overhead and other ops (`probeProgram.ts:eventBudgetFor`). Treat it
as an estimate, not measured elapsed time or a guaranteed cap; use actual prior timings where
available. `probe_program {dry_run: true, name, reason, ops, keep_out}` returns `eventBudget`,
`jobEventLimit`, `fitsEventLimit` without a job or confirm page. Compute per job, not by adding
separate camera/probe jobs against one buffer. If the operator declines a required increase,
reduce redundant coverage or split the program; staging above its limit is refused. Never
coarsen away the tolerance requirement just to fit the log.

**Reading a profile.** `summary.highestAt.x` is resolution-limited to half a station and
ill-conditioned on a gentle crown. For "where is the axis", prefer the symmetry centre (the
midpoint of the two flank stations at each Z level, or of matching plateaus) — a symmetric tip
preserves the crown's X and offsets only the height by the tip radius, so crown-X answers survive
an unknown tip radius while height answers do not. Quote ± the station pitch / 2 at least.
For "is it flat", report the plane residual peak-to-valley and the tilt, every Z as toolhead Z
with physical = Z − probe length, and the B angle. For fixture separation, calculate the signed
coordinate difference and absolute distance from the actual cut before saying closer/farther.
A tip-centre transition at one X/B is not a material identification or a full cutter/holder clearance;
state the measured bracket, tip convention and unmeasured extent.

**Speed.** Read `result.timing` (or `get_job_timing`) before choosing a remedy: initial search,
repeated full approaches, local links, fine approaches and confirmations have different costs.
`execMs` includes motion and controller/transport overhead; `senseMs` is inside `idleMs`, so do
not add overlapping totals. Use `runMs` for runtime and keep approval/chat gaps separate.
Reduce redundant stations first; keep the confirmations needed by the measurement tolerance.
For guarded scans on a surface known to vary less than 5 mm between stations, `z_safe_delta_mm: 5`
can shorten local approaches. Stepped scans instead use `hop_lift_mm` for their local lift.
Use the transport-appropriate sensor window above; never raise the coarse feed yourself.

## Whole-stock programs (`probe_program`)

Ops: `rotate_b` (absolute B; refused unless the head is at/above the traverse height;
`swept_radius_mm` adds the tip-outside-the-cylinder check; completes only when the turn has
PHYSICALLY finished - `M400`, the rotation's wall-clock time at F600 = 10 deg/s, then two idle
heartbeats at the target B - because the controller's "ok" and M114 report the buffered target
the instant a B move is queued, seen on hardware 2026-09-21), `surface_path`, `surface_grid`,
`sequence`, `stock_outline`, `wall_follow`, `corner`, `trace`, `capture {x?, y?, settle_ms?, label?}` (one frame stamped with
position and B, saved on the job record — read it back with `get_frame {frame_id}` or
`get_frame {file}`; with `x/y` it first raises and hops there at 328, travel- and
obstacle-checked like a sequence hop — a hop-only `sequence` is refused as pure motion, so this
is how a program places the camera; without `x/y` it is NO motion), `home {}` (machine home, the LAST op
only; it also homes B — the page says so), and `group {for_b: [0, 90, 180, 270], ops}` which
runs its inner ops once per angle (`${b}` in strings; a `capture` may sit inside, a `home` may
not). A `capture` first waits for two idle heartbeats at the expected B (a frame is never taken
mid-move). Every successfully completed probing op ends at machine toolhead Z328; a program that ends with `home` ends AT HOME.
**Look at both sides of a rotary part under one click**: `capture {x, y}` → `rotate_b 180` →
`capture` → `home`. References (grammar in
`cnc-motion-rules` §8) may sit in any numeric argument; bounds are mandatory (law 3); order ops
so every reference points backwards; `on_fail: "skip"` lets a non-critical op fail without
ending the program (a requested stop or held probe contact always ends it; skip cannot override a hold). Staging REFUSES a program whose event
estimate exceeds the limit and tells you the number to ask for.

`sequence` steps: `{"kind": "hop", "x", "y"}` (at the hop height), `{"kind": "descend", "z"}`
(guarded segments then 1 mm sensor-checked steps), `{"kind": "probe", "name", "dx"|"dy"|"dz",
"max_travel_mm", "on_miss"?, "capture": {"settle_ms"?, "label"?}?}`. After each probe the head
returns to that probe's start, then raises to park before the next step. Results read as
`<opId>.<name>.x|y|z` (contactMachine); references pass measurement values, not a retained low pose.

Geometry is NEVER a prerequisite: a program that references only its own earlier ops needs
nothing stored. Only `axis.*` references need the rotary axis and probe length — measure and
store them yourself (`set_probe_geometry`) or write the program without them; a stored axis is
historical until checked ([rotary-axis](references/rotary-axis.md)). Rotary stock is
B-dependent (square stock ~12 mm higher at B90); every result carries its B. This changes the
surface coordinates, not the validity of an established common WCS. Keep one verified work
frame for indexed cuts when the mounting and rotary registration remain valid; probe only
missing geometry or checks, rather than re-zeroing or repeating datum probes at every angle.
Prefer one established WCS; multiple workspaces are frowned upon but supported when needed
by an existing G-code job. After measured registration, `set_workspace_origin` can stage a
human-approved XYZ assignment from the current stationary pose; no trip to zero is needed.
Read the motion-rules work-datum reference for toolhead-Z semantics and verification.
A retained WCS does not authorise returning to its zero after rotation: stock/fixtures can now
obstruct that location or the old route. Keep it as the reference and use a separately verified
entry point unless the complete return route is clear in the new orientation.

- **Derive, don't guess**: `{"mid": ["s0.west.x", "s0.east.x"]}` is the stock centre;
  `{"diff": ["s0.east.x", "s0.west.x"], "scale": 0.5, "plus": "axis.z_contact"}` the B90 face
  height. Name probes `top`, `west*`, `east*`, `end*` and `result.derived` (thickness per face
  pair, centring, width, centre X, yaw, end slope) is computed — planning inference, never a
  clearance.
- **Keep-out for this clamping**: `keep_out: [{"name", "machine": {"x0", "y0", "x1", "y1"},
  "clearance_z"}]` — a VOLUME nothing enters. Stored landmarks are CROSSING obstacles (a hop or
  march wholly inside one is allowed). Never shrink a landmark to make a plan pass.
  Carry BOTH tailstock and chuck-jaw keep-outs for operations near the rotary, using current
  clamping extents. Historical examples are tailstock Y<110 and jaws Y>269 over the rotary X
  box; these are not universal fixture constants. A fine region "near tailstock" must stay
  outside its volume. If the intended feature overlaps it, resolve access before staging.
  Axis-centre/tailstock-Y/chuck-face-Y points alone do not supply jaw extents or obstacle tops.
- **Cylinders across the axis**: `surface_path` with `expected_profile: {"circle": {"center_x",
  "center_z_contact", "radius"}}` (stations > 0.7 R off the axis are refused); along the axis a
  plain path suffices.
- **Side marches on stock of estimated size**: start outside the largest size, `max_travel_mm`
  covers the whole uncertainty, first probe at mid-length; a miss records `no_contact` and the
  sequence continues (`on_miss` default); a later reference to it refuses that op.

**Block on the bed or in the chuck: `probe_stock_outline`.** Estimated centre + size, operator
`start_z_machine` / `floor_z_machine`; finds the top at `top_points` (highest wins, holes
ignored), marches the sides from `overextend_mm` outside at `top − side_depth_mm`, returns
`centerMachine`, `sizeMm` (centre-to-centre), `sizePhysicalMm` (minus tip), `yawDeg`. Do NOT
shorten `side_max_travel_mm` (default 25) to save time — a first outline missed a face 13.6 mm
away with an 11 mm march. Also an op kind in `probe_program`.

**Walls: `probe_wall_follow`** (also op kind `wall_follow`). Give `start_x/start_y` (machine, over
free space, at least tip radius + margin inside the wall), `z_machine` (a MEASURED top minus the
depth — never a guess), `dir_x/dir_y` (the march toward the wall), `max_travel_mm` (generous),
`step_mm` (default 5), `stations`, optional `along_x/along_y` (default `dir` turned +90°) and
`standoff_mm` (default 2). Law 2 to station 1, then per station: march to the wall, back off the
standoff, STEP ALONG the wall at that standoff to the next line as a stepped touch-probing
traverse (retreat away from the face, capped at the start line), march again. Result: tip-centre
`contacts`, `bumps` (the wall turned toward the probe during a step), `fit` (line through the
contacts with per-point residuals — a residual trend at one end is the wall curving into a
corner; densify there), `surfacePoints` (contacts + tip radius along `dir`). This replaces the
pass-1 pattern of retreating 25 mm to the start line between every two wall stations. With
`line_tolerance_mm` the result's `segments` splits the run into the straight wall at each end and
the corner between, with the corner's arc fit.

**Rounded corners are the normal case** (operator, 2026-09-21). Never place a station or a link
inside a radius you have not measured; a contact off its wall's fitted line is a corner point, not
a wall point. **`probe_corner`** (op kind `corner`): give the two walls as their fitted TIP-CENTRE
lines (`wall_a` / `wall_b` = `{x, y, nx, ny}` straight from a `wall_follow` `fit.point` /
`fit.normal`), `z_machine`, `radius_max_mm` (the operator's bound on the physical radius — law 3;
it places the bisector start in free space) and `points`. It marches along the bisector (where it
stops gives the radius; a contact at the apex = sharp corner), retreats along that proven path to
the arc centre and marches radially from it, tangent point to tangent point, retreating to the
centre between — every station and link on proven ground. Result: `fit` (tip-centre radius, centre,
per-point residuals — plate (6)'s lobes fit with rms ~0.5 mm, which is the honest answer, not a
fault), `radiusPhysicalMm` (+ tip radius for an internal corner). External (boss) corners are not
planned yet — measure them as a `wall_follow` around the corner and read `segments`.

**Unknown pocket: `probe_trace_perimeter`** (op kind `trace`; operator spec 2026-09-22). Give
`start_x/start_y` (a point KNOWN to be inside — operator or camera), `z_machine` (a MEASURED top minus
the depth), `dir_x/dir_y` (first march, default +X), `max_travel_mm`, the REQUIRED `bounds`
`{x0,y0,x1,y1}` the tip centre never leaves (the pocket's estimated outer extent PLUS at least one
step of margin for the bump into the wall — a bound on the wall itself stops the crawl at the first
bump) and the REQUIRED `max_perimeter_mm` budget (law 3); `keep_out` volumes apply. The crawl keeps
the wall on `wall_side` (default right = counter-clockwise inside), steps `fine_step_mm` (0.1) along
it and bumps 0.1 toward it until contact — each contact is a perimeter point; after EVERY contact
the tip retreats along the inward normal one fine step at a time until the probe reads RELEASED, then
one more (the release-verified standoff — T8 on 2026-09-22 parked one step off the contact, 0.05 mm
inside a wavy wooden wall, and the next advance rubbed); a retreat step short of the last point known
free waits at most ~0.5 s for the release, only the step past it waits the full timeout (and aborts if
still triggered). A blocked step retreats exactly that step; if
the probe releases there it is a corner (turn `turn_step_deg` away from the wall), if not it is a RUB
(the wall came to the tip: the standoff is repaired and the crawl goes on). A wall that falls away
turns the heading toward it; runs proven straight go at `coarse_step_mm` (1) with the heading aligned
to the fitted wall. Confirm cycles run ONLY at `confirm_at` (default first / turns / unexpected; add
`every` + `accuracy_every_mm` for accuracy points); one that ends with the probe still triggered is
skipped as a rub, not reported as a stuck probe. The first wall is found with the normal 1 mm coarse
march; fine steps belong to the crawl. Time (measured T8): a crawl cycle is 0.9 s — 9 s/mm at 0.1 mm,
0.93 s/mm at 1 mm — so a 330 mm pocket is ~50 min at 0.1 everywhere and ~6 min with coarse straights;
the confirm page states the figure. Result: ordered `perimeter` (tip-centre + `surface` one tip radius
into the material along `normal` — the normal of the LOCAL wall, a line through the neighbouring
contacts, not the crawl heading, which lagged 30-90 deg after corners), step kind incl. `rub`,
confirmed), `segments` (straight walls with collinear runs MERGED — T8's 4-wall pocket had come out as
11 — each with its tip-centre `fit` and wall `surface` line; curves with `shape`), `corners` (circle
fitted ONLY to the points off BOTH adjacent walls, with `residualsMm`, `fitIndices`, `onWallPoints`;
`shape` `arc` / `sharp` / `irregular` — an irregular lobe has NO radius: read its `polyline`, its
line / arc `pieces` and `singleArc`, the misfit one circle would have had), `lengths` (`tipCentreMm`,
`surfaceMm` — the one to compare with CAD — and the `surfaceFromTurnMm` cross-check), `closed`,
`ending` (incl. `aborted`), `counts` (rubs, releaseSteps, confirmsSkipped), `standoffMm`, `timing`,
`endState` (parked, or HELD with the exact recovery). On ANY abort `result.trace` carries the partial
perimeter, the measured first wall and the counts — never an empty result. A long crawl overflows the
job event buffer; `result.trace` is never trimmed.

Hardware test order for a new program: B0 half without rotations, then one rotation, then the
whole program — and compare `derived` with the operator's calipers.

## Probe calibration (once per probe fitting)

`run_tool_setter` with `accept_probe_contact: true` and a conservative `bit_length_mm`
(`bit_length_mm` is the fitted tool's PROTRUSION in mm — a length, never a diameter; declare
LOW). Setter surface = machine Z100.5, so effective length = measured trigger Z − 100.5; store
it with `set_probe_geometry`. This derives effective length FROM a measured trigger
and the verified setter reference; the historical 100.5 example is not a fresh
reading. Never reverse the formula to fabricate `old_trigger_z` for a tool change.
That requires the same-connection measurement pair (or the documented same-tool,
same-session reuse) in [tool-change](../tool-change/SKILL.md).
**Any probed surface height = contact toolhead Z − probe length.**
That conversion retains the uncertainty of the contact method: setter contact and stylus
trigger on stock have different pretravel. A setter-derived length is not proof of cutting Z0;
see [probe-length roles](../cnc-motion-rules/SKILL.md#2-coordinate-doctrine) and tool-change.
The run ends with the head raised straight up to the traverse height (machine Z328, reported as
`result.finalZ`), never at its start height — the next hop starts from there.

## Waiting on a job or procedure

Never read server logs. `get_gcode_job_status {job_id, wait_ms: 110000, since_event}` carries
the whole story — state, `ending` (why it ended), the stored `result`, and events (runner
phases, gcode traffic, `position-recheck`, `heartbeat_frame_flip`, `slow_step`). Pass back
`next_event_index` as `since_event` or the poll returns on the first existing event. A
`position-recheck` note or a `get_position` of `awaiting-resync` during a march is the server
protecting you, not a fault. If a scan aborts saying the toolhead is BELOW the descent target,
verify with `query_firmware_position` before re-staging.

**Stopping.** `stop_gcode_job {job_id}` on a running procedure stops at the next step boundary
(≤ 1 mm or one sensor window), raises to 328, and ends the job `stopped` with everything measured
so far in `result` and `ending.kind: stopped-by-agent`. It is not an emergency stop — the crash
guard and the machine's own stop are.

## Steep shoulders and aborted scans

In stepped surface scans, the runner backs along the incoming path before rising. It can add
up to one **stored probe-ball radius** (half `probe_tip_diameter`, not half the exposed stylus
length), in 0.25 mm steps, only within the already verified straight corridor at the same height.
A change in direction/height discards that extra clearance evidence. Lifts are checked in 0.5 mm
segments, including brief touch-and-release events; a contact during a lift holds the procedure
before another sideways move. There is no arbitrary sideways escape or repeated rise against a
triggered probe. Missing ball geometry disables the additional margin.

Read `ending`, the saved partial stations and recovery phases. `abort-held` means held, even if
the feed later releases; the outer program must preserve that decision and must not claim it
raised. Never equate an error message's nominal step with the actual travelled distance. Re-plan
from the verified final state, using independent approaches if the surface cannot be followed.
Long-poll `get_gcode_job_status` with the previous response's `next_event_index` as `since_event`;
do not use a fabricated large cursor or repeatedly fetch the whole event history.
