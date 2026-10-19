# New-stock rotary survey in ONE approval: implementation TODO (mcp/48)

Status: **W1-W6 implemented 2026-09-06 (unit-tested, tsc/eslint clean), hardware test pending** -
see section 5 for the test order; the confirm-page live progress (W6, second bullet) is the only
item not built. Also in this PR: `stop_gcode_job` now stops procedures cooperatively (see README
"Stopping a procedure"). REVISED after the operator's review (2026-09-06): W2 is an MCP tool
(`set_probe_geometry`), not a settings pane; there is NO stored stock radius (per-program
`swept_radius_mm` on `rotate_b`); geometry is never a prerequisite; W3 landmarks are CROSSING
obstacles (probing inside the rotary landmark is allowed), program `keep_out` boxes are volumes.
The W2/W3 text below is the original plan - read it with those corrections. Added the same day on
operator request: `probe_stock_outline` (top with hole rejection, sides from an over-extended
estimate skipping along the face at a standoff, centre/size/yaw fit; `march.ts` shared march +
stepped traverse; surface `hop_mode: stepped`), the traverse-height exemption from crossing
landmarks, and marches exempt from crossing landmarks. Written so any agent can pick this up cold.
Target branch: `mcp/48-new-stock-survey`, stacked on `mcp/47-timing-inline-g53` (PR #81,
commit `f7cea5119`, itself stacked on `mcp/46-position-of-record`, PR #80). One commit per
PR, `--no-verify`, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; PR body
ends with the Claude Code footer. Push to remote `fork` (tyeth/Luban) only, never `origin`.

## 0. Pick-up notes (read first)

- Worktree: `C:\dev\software\snapmaker\Luban-mcp`. MCP server code lives in
  `src/server/services/mcp/`; the README there is the design record and MUST be updated with
  every item below (sections "Motion laws", "Machine facts", "Tool surface", "Open threads",
  stack list).
- Checks before every commit (run from the repo root):
  - `npx tsc -p tsconfig-server.json --noEmit 2>&1 | grep services/mcp` (must print nothing)
  - `npx eslint src/server/services/mcp --ext .ts`
  - pure-module unit checks: `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","esModuleInterop":true}' npx ts-node --transpile-only <test.ts>`.
    Pure modules (`programRefs.ts`, `jobTiming.ts`, `surfaceScan.ts`, `positionOfRecord.ts`)
    must not import server modules (config/settings.base is ESM-only and breaks ts-node). Keep
    new logic in pure modules for the same reason. Earlier scratch tests lived in a session
    scratchpad and are gone: re-create the ones you need (they are small; the expected numbers
    are in this document and the README).
  - Files written from python need `newline='\n'` (CRLF fails eslint linebreak-style).
- CI: `gh workflow run build-on-pull-request.yml --ref <branch> -f platforms=linux`; artifact
  `Snapmaker-luban-4.15.2-linux-amd64.deb`. Stage every green build on the Ubuntu box
  (`pi@192.168.1.153`, `~/Downloads/`, repo `~/dev/Luban` checked out to the same commit).
  SSH/SCP must use `/c/Windows/System32/OpenSSH/ssh.exe` and `scp.exe` (git-bash ssh is
  refused). GitHub calls use the per-command `tyeth` token (memory note
  `github-account-per-push-override`); never `gh auth switch`, never store the token.
- Evidence on the box: `~/luban-evidence/REPORT-four-face-scan-2026-09-05.md` (the manual
  survey this work must reproduce), `stage_*.json` / `start_*.json` (the exact arguments used
  for every manual step), `mcpcall.py` (raw JSON-RPC helper), `scan_<job>_events.json`.
- Laws (README "Motion laws") are not negotiable: one motion per instruction; XY > 1 mm only
  at the safe traverse Z (320) except surface-scan hops (contact + <= 20 mm, hop <= 60 mm); no
  fabricated clearances (every number is measured, operator-given, or bounded and approved);
  landmarks are obstacles; contact sensors are crash sensors; the confirm page is the only
  motion gate; coarse step <= 1 mm; every descent toward the work in <= 5 mm segments.

## 1. Where the tooling stands (mcp/47, hardware status)

| piece | state |
|---|---|
| `probe_program` (rotate_b, surface_path, surface_grid, sequence; one confirm page; one runner) | implemented, **not yet run on hardware** |
| references `{from, plus, minus, between}` resolved at run time, refused outside bounds | implemented (`programRefs.ts`), unit-tested |
| `rotate_b` (direct path, Z >= traverse, M114 / heartbeat `b` verification) | implemented, not hardware-tested (manual rotations used file jobs `G90 / G0 Bnnn`) |
| slow zone, 1 mm coarse cap, segmented descents, position of record, approval hand-off | implemented; band-1 grid (133 stations) verified on `c7600c574`; later builds staged only |
| job timing breakdown (`result.timing`, `get_job_timing`) | implemented, pure module |
| landmarks (`landmarks.ts`: store + `obstaclesOnPath`) | used ONLY by the direct XY move guard (`tools/camera.ts`); no procedure planner checks them |
| probe geometry (effective length 71.3, tip diameter ~2.5) | **not stored anywhere**; every report carries the numbers by hand |
| rotary axis position | **not stored anywhere**; derived by hand in the report (physical Z ~112.4) |

The manual survey (2026-09-05, 18 approvals, ~75 min) proved every sub-step; this PR turns
it into one program for stock whose dimensions are unknown at staging.

## 2. Acceptance target

A rectangular bar in the rotary jig, dimensions unknown, is surveyed by ONE approved
`probe_program` that produces: the top of each of the four faces (centre probe + N-S path +
W-E path), both sides at two Y stations and the free end at two X stations (B0 and B90
suffice for sides/end; the program may do all four). Every number a later op needs comes from
earlier ops or the jig configuration through bounded references. Second target: a cylinder,
same jig, crown line along the axis plus a cross-axis profile at several B angles.

Numbers from the manual survey to reproduce (machine coords, toolhead Z at contact, probe
71.3 mm): B0 top 207.8, B180 top 206.9, B90 top 219.6, B270 top 219.9; section 71.9 x 47.2;
sides at B180 X134.2 / 133.5 (west) and 205.3 / 206.0 (east) at Y150 / Y250, Z200; end Y129.2
at X190, Y128.7 at X150, Z202; stock centre X ~169.7; axis physical Z ~112.4. The stock runs
along machine **Y** (chuck toward +Y, free end near Y129); N-S paths are at fixed X.

## 3. Work items

Order matters: W1 and W2 are prerequisites for the example program; W3 is the safety item
that makes a single click acceptable on freshly clamped stock; W4 and W5 follow.

### W1. Two-operand references (`programRefs.ts`, pure)

Problem: new stock needs the width from two side contacts, the centre as their midpoint, and
the B90 face height as axis + half-width. Today a reference is one source plus an offset.

Shape (keep `from` refs exactly as they are; add operand forms):

```
{ from: "s0.west.x", plus?, minus?, between: [lo, hi] }                      // unchanged
{ mid:  ["s0.west.x", "s0.east.x"], plus?, minus?, between }                  // (a + b) / 2
{ diff: ["s0.east.x", "s0.west.x"], scale?: 0.5, plus?, minus?, between }     // (a - b) * scale
{ min:  ["ns0.summary.zMin", "we0.summary.zMin"], between }                   // min(a, b, ...)
{ max:  [...], between }
```

- Operands are dotted paths (`<opId>.<path>`, same shorthands as `from`: `<seq>.<probe>.z`,
  `.x`, `.y` -> `contactMachine.*`). `plus` / `minus` may be a number OR a path string (so
  "axis.z_contact + half-width" is one reference). No deeper nesting: resolution stays one
  level so the confirm page can print the formula on one line.
- Evaluation order: operator -> `scale` (default 1) -> `+ plus - minus` -> round3 -> bounds.
  `between` stays REQUIRED (law 3); `refMidpoint` unchanged (mid of the bounds).
- `isRef`: object with exactly one of `from | mid | diff | min | max`. `validateRef` checks
  every operand path against the `<opId>.` pattern. Add `refOperands(ref): string[]` and use
  it in `planProbeProgram` where today only `ref.from` is checked to run BEFORE the
  referencing op (the `refs.some(...)` block), and in the page text.
- `source` string for the page/events, e.g. `mid(s0.west.x=134.2, s0.east.x=205.3) = 169.75`.
- Update the `REFERENCE` preview line in `planProbeProgram`, and the `probe_program` schema
  and description in `tools/probing.ts` (refs are `object`; describe the forms).
- Tests: mid, diff with scale, min/max, path-valued `plus`, out-of-bounds refusal, operand
  op-ordering refusal, shorthand `.x` on sequence probes.

### W2. Rotary axis and probe geometry as configuration

Problem: the axis position and the probe geometry are jig/tool constants, re-derived by hand
every survey. Stored once, every rotation's expected face height is derived, and the page can
show the swept cylinder.

- Settings (configstore; same pattern as `mcpJobEventLimit` in `jobs.ts`,
  `services/api/api-mcp.js`, `app/ui/pages/global-modals/settings-modal/McpServer/index.tsx`,
  i18n `resource.json`), each with an env override for the box:
  - `mcpRotaryAxisX` (machine X of the axis line, ~169.7 measured) and `mcpRotaryAxisZ`
    (PHYSICAL machine Z of the axis, ~112.4). UI labels: "Rotary axis X / Z (machine,
    physical)".
  - `mcpProbeEffectiveLength` (71.3 this fitting; toolhead Z at contact - length = physical
    surface Z) and `mcpProbeTipDiameter` (~2.5; side contacts are centre +/- radius).
  - `mcpRotaryMaxRadius` (jig clearance radius about the axis; anything inside it moves when
    B moves).
- Expose them in `getPositionSnapshot()` as `rotary: {axisX, axisZ, maxRadius} | null` and
  `probe: {effectiveLength, tipDiameter} | null`, and through `get_position` and
  `get_mcp_diagnostics`.
- Program namespace: at run start seed `results.axis = { x, z_physical, z_contact:
  z_physical + effectiveLength, max_radius, tip_radius }`; `planProbeProgram` accepts operand
  op id `axis` without an op of that id, only when the settings are set (otherwise a
  reference to `axis.*` is a staging error naming the settings to fill in). Then
  `{ from: "axis.z_contact", plus: 36, between: [...] }` is the B90 face expectation.
- `rotate_b`: keep `require_z_at_least >= traverse`; additionally print the swept cylinder on
  the page (axis, max radius, in toolhead-Z terms `z_contact + max_radius`) so the operator
  sees that 320 clears it. No new motion behaviour.
- Docs: README "Machine facts" (axis, probe geometry, how they were measured, and when they
  must be re-measured: any re-fit of the probe, any move of the rotary module).

### W3. Keep-out checks at plan time (new pure module `envelopeChecks.ts` + planners)

Problem: landmarks are enforced only on direct XY moves. A program on freshly clamped stock
must be refused at staging if any descent column, side/end march, or low hop enters the
chuck/tailstock volume. Today the agent guards this by hand (the Z202 end marches were
"clear of the live centre" only because the agent checked).

- Extract the 2D segment-vs-AABB slab test from `landmarks.ts:obstaclesOnPath` into
  `envelopeChecks.ts` (pure): `segmentHitsBox(x0, y0, x1, y1, box, margin)` and
  `checkSegmentAtZ(seg, z, obstacles, margin)`. `landmarks.ts` calls it.
- Obstacle model for the check is the existing `Landmark` shape `{ name, machine: {x0, y0,
  x1, y1}, clearanceZ }` (clearanceZ is TOOLHEAD Z, operator-set, tool length included).
- Program-level transient obstacles: `probe_program` arg `keep_out: [{ name, machine: {x0,
  y0, x1, y1}, clearance_z }]` for this clamping (jaw Y range, tailstock). Merged with the
  stored landmarks for the checks and printed on the page under "KEEP-OUT"; never persisted.
- What to check (every planner exposes its motion list so the check is data-driven):
  1. `sequence`: each `hop` at hopZ (trivially clear unless a landmark's clearanceZ > hopZ,
     which the check still catches); each `descend` column: the point (x, y) at the target Z;
     each `probe` march: segment from `start` to `start + unit * maxTravelMm` at start.z
     (for dz marches: the column from start.z down to start.z - maxTravelMm).
  2. `surface_path` / `surface_grid`: station 1 descent column to the floor Z; every hop
     segment at the LOWEST hop height it can use (expected contact + z_safe_delta, floor
     bounded); every station column down to `max(lastContact - max_drop, floor)` (the plan
     already prints these numbers).
  3. `rotate_b`: with `axis` configured (W2), refuse if the position of record has the
     toolhead inside the swept cylinder (belt and braces; Z >= traverse already covers it).
- Refusal is a staging error (`McpToolError`) naming the op, the step, the obstacle and the
  Z. The same check re-runs after references resolve at run time (the live plan may differ
  from the mid-point preview); a run-time hit stops the program raised like any op failure.
- The standalone tools (`probe_sequence`, `probe_surface_*`) get the check for free once it
  lives in the planners.
- Tests (pure): column inside/outside a box, segment crossing a box at Z below/above the
  clearance, margin behaviour, a surface hop at contact + 20 crossing a jaw box.

### W4. Discovery for unknown height and for cylinders

- `ZSummary` (`surfaceScan.ts`): add `highestAt: {x, y}` and `lowestAt: {x, y}` (samples
  carry x/y already). `{ from: "cross0.summary.highestAt.x", between: [...] }` then locates
  the crown of a cylinder or the high edge of a face.
- Unknown height, first descent: no new op kind. Pattern (document in the skill): a
  `sequence` whose `descend` is `{ from: "axis.z_contact", plus: <max_radius + 5>, between }`
  and whose probe is `dz: -1, max_travel_mm: <max_radius + 10>`. The runner already segments
  the descent (5 mm, F600, async crash guard) and walks the last band at 1 mm / F100.
- Cylinder cross-axis profile: `surface_path` gets an optional
  `expected_profile: { circle: { center_x, center_z_contact, radius } }` (each a number or a
  reference). Per station the expected contact Z is `center_z + sqrt(r^2 - (x - center_x)^2)`
  with `r = radius + tip_radius`. `slowZoneFor` takes this per-station expectation instead of
  the previous station; the `max_drop_mm` band is measured from the expectation, not from the
  previous contact. The planner refuses stations with `|x - center_x| > 0.7 * radius` (contact
  angle > 45 deg: the tip glances and the side channel would read it as a crash).
- Rectangular faces: no change; the previous-station expectation is right for flat faces.
- `probe_program` result: add `derived` (optional, computed from `axis` and whichever ops are
  present): section width/height, centre XY, tilt per 100 mm, using the formulas of the
  2026-09-05 report so the report writes itself. Pure function, unit-tested against the
  report's numbers (71.9 x 47.2, centre X 169.7, yaw +0.7 / 100).

### W5. Rotation template (`probeProgram.ts`, plan-time expansion)

- New op kind `group`: `{ id, kind: "group", for_b: [0, 90, 180, 270], ops: [...] }`.
  Expanded BEFORE validation into `rotate_b` + the inner ops per angle, so the runner and the
  page see plain ops. Substitution: the literal `${b}` in any string (ids, `name`, reference
  paths) becomes the angle; inner op ids become `<id>_b<angle>` when they contain no `${b}`.
- `MAX_OPS` 40 -> 80 after expansion; the page lists the expanded ops with one header line per
  group ("GROUP faces: 4 rotations x 4 ops").
- Test: expansion of a 2-angle group, id uniqueness, `${b}` inside a `from` path.

### W6. Operational limits for a 30-minute program

- Event budget: `estimateEventBudget(plan)` = 100 + sum(stations x 120) + sequences x
  (60 per probe + 20) + rotations x 20. Staging refuses when the estimate exceeds
  `jobEventLimit()`, naming the setting (Settings -> MCP Server, or
  `LUBAN_MCP_JOB_EVENT_LIMIT`) and the number to set. Put the estimate in the plan result and
  on the page. Measured: 763 events for an 8-station path; a four-face survey with two
  11-station paths per face plus sides/ends is ~12k, so the operator should set 15000-20000.
- Confirm page live progress: the runner already broadcasts `mcp:activity` per op; the
  approved page can poll `/api/mcp/jobs/<id>` and show `op N/M <id>` (nice-to-have, last).
- Approval: `start_gcode_job wait_for_approval_ms` (<= 120 s) already covers the hand-off.

## 4. The program this enables (rectangular bar, nothing known but the jig)

Assumes W1-W3 and `axis` configured (x 169.7, z_physical 112.4, max_radius 45, probe 71.3 /
2.5). All numbers are machine coordinates; `between` bounds are the operator's envelope.

```json
{ "name": "new bar survey", "reason": "four faces, sides and end of freshly clamped stock",
  "keep_out": [{ "name": "chuck jaws", "machine": { "x0": 120, "y0": 262, "x1": 220, "y1": 300 }, "clearance_z": 260 }],
  "ops": [
    { "id": "top0", "kind": "sequence", "steps": [
        { "kind": "hop", "x": 170, "y": 199 },
        { "kind": "descend", "z": { "from": "axis.z_contact", "plus": 50, "between": [225, 240] } },
        { "kind": "probe", "name": "top", "dz": -1, "max_travel_mm": 55 } ] },
    { "id": "sides0", "kind": "sequence", "steps": [
        { "kind": "hop", "x": 118, "y": 150 },
        { "kind": "descend", "z": { "from": "top0.top.z", "minus": 7, "between": [190, 235] } },
        { "kind": "probe", "name": "west", "dx": 1, "max_travel_mm": 40 },
        { "kind": "hop", "x": 222, "y": 150 },
        { "kind": "descend", "z": { "from": "top0.top.z", "minus": 7, "between": [190, 235] } },
        { "kind": "probe", "name": "east", "dx": -1, "max_travel_mm": 40 },
        { "kind": "hop", "x": 170, "y": 110 },
        { "kind": "descend", "z": { "from": "top0.top.z", "minus": 5, "between": [190, 235] } },
        { "kind": "probe", "name": "end", "dy": 1, "max_travel_mm": 30 } ] },
    { "id": "ns0", "kind": "surface_path",
      "start_x": { "mid": ["sides0.west.x", "sides0.east.x"], "between": [160, 180] }, "start_y": 255,
      "end_x":   { "mid": ["sides0.west.x", "sides0.east.x"], "between": [160, 180] }, "end_y": 135,
      "spacing_mm": 15, "expected_z_machine": { "from": "top0.top.z", "between": [195, 235] },
      "start_z_machine": { "from": "top0.top.z", "plus": 7, "between": [200, 245] },
      "z_safe_delta_mm": 5, "max_drop_mm": 10, "confirm_passes": 2, "sensor_delay_ms": 50 },
    { "id": "we0", "kind": "surface_path",
      "start_x": { "from": "sides0.west.x", "plus": 6, "between": [130, 160] }, "start_y": 199,
      "end_x":   { "from": "sides0.east.x", "minus": 6, "between": [180, 215] }, "end_y": 199,
      "spacing_mm": 12, "expected_z_machine": { "from": "top0.top.z", "between": [195, 235] },
      "start_z_machine": { "from": "top0.top.z", "plus": 7, "between": [200, 245] },
      "z_safe_delta_mm": 5, "max_drop_mm": 10, "confirm_passes": 2 },
    { "id": "r90", "kind": "rotate_b", "b": 90 },
    { "id": "top90", "kind": "sequence", "steps": [
        { "kind": "hop", "x": 170, "y": 199 },
        { "kind": "descend", "z": { "diff": ["sides0.east.x", "sides0.west.x"], "scale": 0.5, "plus": "axis.z_contact", "between": [210, 235] } },
        { "kind": "probe", "name": "top", "dz": -1, "max_travel_mm": 20 } ] },
    { "id": "ns90", "kind": "surface_path", "...": "as ns0 with top90.top.z" },
    { "id": "r180", "kind": "rotate_b", "b": 180 }, { "id": "top180", "...": "as top0, expecting top0.top.z +/- 3" },
    { "id": "r270", "kind": "rotate_b", "b": 270 }, { "id": "top270", "...": "as top90" },
    { "id": "r0", "kind": "rotate_b", "b": 0 }
  ] }
```

Notes: the `descend` before `top90` is "axis + half of the measured width", the value the
manual survey derived by hand (219.6 ~= 112.4 + 71.3 + 35.9). The end march at Y110 -> +Y
must stay >= 5 mm below the top and clear of the jaw keep-out; the planner proves it. With W5
the four `top / ns / we` triples collapse into one `group`.

Cylinder variant: replace `sides0` by a cross-axis `surface_path` at Y199 with
`expected_profile.circle` (centre from `axis`, radius bounded by the operator), take the crown
from `summary.highestAt.x`, then run the along-axis path at that X, repeated at B 0/90/180/270.

## 5. Verification plan

1. Pure tests for W1, W3, W4 (profile maths, `derived`), W5, W6 estimate. tsc + eslint clean.
2. Stage a program on the box WITHOUT rotations first (top0 + sides0 + ns0 + we0 at B0) and
   compare against the 2026-09-05 numbers (B0 top 207.8, sides ~133.9 / 205.7 at Y150). Read
   `result.timing` and `result.derived`.
3. Then the B90 half (r90 + top90 + ns90): the derived descend must land within 3 mm of 219.6.
4. Then the full four-face program in one approval; record wall time, event count against the
   estimate, settle-wait count (must stay 0), `slow_step` events, any refused reference.
5. Update the evidence on the box (REPORT style), the README timing table if station time
   changed, the `cnc-probing` skill (+ the claude.ai `.skill` bundle: `python -m
   scripts.package_skill` from the skill-creator plugin cache), and
   `docs/COMPOSITE_PROBE_PROGRAM.md` (mark items 5, 6, 7, 8, 10 done as they land).

## 6. Decisions already taken (do not re-open without the operator)

- References stay one level deep and every reference keeps `between`; no free arithmetic
  expressions. The confirm page must be readable by the operator at a glance.
- Coarse feed stays F100 unless the operator says otherwise; `z_safe_delta_mm` 5 is the
  agent's lever for time, not a default change.
- Inline `G53 G1 ...` (one HTTP line per move, ~100 s per 11-station scan) is NOT part of
  this work: removed from mcp/47 as unrequested; it would be its own PR with the
  gantry-height verification test described in the README.
- Landmarks remain toolhead-Z clearances set by the operator; the program's `keep_out` is
  transient and shown on the page, never persisted silently.
