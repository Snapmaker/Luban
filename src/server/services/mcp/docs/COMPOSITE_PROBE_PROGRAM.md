<!-- Written by the on-box GPT-5.6 agent on 2026-09-05 after the four-face rotary-stock survey
(see the "Timing" section of the MCP README for the measured cost table it is based on). Kept
verbatim as the design brief. Implemented 2026-09-06 as the `probe_program` tool (probeProgram.ts):
items 1, 2, 3 (bounded references), 9 (abort semantics) and 11 (per-op parameters); item 4 via the
explicit-floor fix; items 5, 6, 7, 8 (beyond the configurable event limit) and 10 remain open. -->

# Proposal: one approved operation for a multi-rotation stock survey

Goal: stage ONCE, operator approves ONCE, runner performs: for B in [0, 90, 180, 270]:
rotate -> centre probe -> N-S top scan (overtravel past the end) -> W-E top scan (both edges);
plus horizontal side + end marches at two rotations. Today this is 18 approvals (~75 min wall).

## What the tooling lacks today (each item is a concrete gap hit on 2026-09-05)
1. **A composite procedure job (`probe_program`)**: ordered `ops[]`, each op one of
   `rotate_b | surface_path | surface_grid | sequence` with its own envelope; ONE confirm page
   enumerating every op's envelope (extents, floors, hop heights, B targets); ONE runner;
   partial results kept per op on abort. Existing runners (probeSurface, probeSequence) become
   callable op executors sharing the position-of-record and the crash guard.
2. **B rotation inside a procedure** (`rotate_b` op): today only a file job can move B (Z returns
   to top, door interlock, separate approval). Needs: direct guarded `G0 B<abs>` via the same
   path as moveMachineSettled, verified-settle on B (M114 B within 0.01 of target - heartbeat
   `b` lags ~1 beat), precondition toolhead Z >= traverse Z (320) or XY outside a declared
   sweep radius, and the confirm page saying "stock WILL rotate to B90/180/270".
3. **Run-time references between ops**: `expected_z_machine: {from: "centre_b90"}`,
   `start_z_machine: {from: "centre_b90", plus: 7}`, side-march Z `{from: "ns_b180.zMean",
   minus: 7}`. Staging cannot know the value, so each reference carries operator-approved
   BOUNDS (`between: [195, 235]`); the runner refuses the op if the resolved value falls
   outside, raises, and stops. The confirm page shows the bounds, not a number.
4. **First-station search window**: station 1 aborts unless a surface lies within max_drop_mm
   of start_z even when floor_z_machine is explicitly lower (d7ac9247838e). Add
   `first_station_search_mm` (bounded by the floor) or honour the explicit floor for station 1
   only when no expected_z is given. With (3) this is mostly moot but still a footgun.
5. *(open)* **Multi-segment paths in one op**: `segments: [{start, end}, ...]` sharing a reference, so
   W-E from the measured centre outward to both edges is one op (today two jobs, or an
   off-stock first station aborts - 1dc39a8210a4).
6. *(done mcp/48: `mcpProbeTipDiameter` + `axis.tip_radius`, widths reported with the tip)* **Tip radius as configuration** (`probeTipDiameterMm` in the tool-setter config): side and
   end marches report contact centre AND corrected face; width/thickness/end position come out
   corrected. Unpinned today (~2.5 mm per README, inconsistent).
7. *(done mcp/48: `stockGeometry.ts` → `result.derived`)* **Stock-geometry reduction in the result**: faces keyed by B; per face: mean/slope/flatness;
   across faces: section dimensions (opposite-face pair means), axis height, centring offsets,
   yaw and pitch of the stock centreline (from side pairs and pair-mean slopes), end squareness.
   All the arithmetic done by hand in REPORT-four-face-scan-2026-09-05.md.
8. *(done mcp/48: plan estimate + staging refusal; limit is a setting)* **Event budget**: a full program is ~6,000-8,000 events at today's verbosity (537 batches x
   2 events per 11-station scan + readings). Either per-op event logs, or `mcpJobEventLimit`
   default 10,000, or drop the per-batch `response` payload behind a verbosity flag. Summaries
   and per-op results must never be trimmed.
9. **Abort semantics**: any op failure (no contact at station 1, hop-guard contact, crash
   alarm, B settle failure) -> raise to traverse Z, mark the op failed, stop the program, keep
   all earlier op results. Optional `on_fail: skip|stop` per op for overtravel-type ops.
10. *(partly: budget and B schedule on the page; live progress open)* **Confirm page for long programs**: live progress (op k of n, station, ETA from the timing
    table), the B schedule, total extents, and the token TTL is irrelevant once
    wait_for_approval_ms hands off - but the page should keep working as a monitor for the
    ~40-70 min run.
11. **Speed knobs exposed per op** (from the timing analysis): z_safe_delta_mm (use 5), coarse
    feed (F100 -> F300, operator-gated default), single G53 window per march, confirm_passes 2,
    sensor_delay 30. With these the full program is ~35-40 min instead of ~75.

## Sketch of the request
```json
{"name":"four-face survey","ops":[
 {"id":"rot90","kind":"rotate_b","b":90,"require_z_at_least":320},
 {"id":"c90","kind":"sequence","steps":[{"kind":"hop","x":170,"y":199},{"kind":"descend","z":235},
   {"kind":"probe","name":"top","dz":-1,"max_travel_mm":40}]},
 {"id":"ns90","kind":"surface_path","start_x":170,"start_y":262,"end_x":170,"end_y":120,"spacing_mm":15,
   "expected_z_machine":{"from":"c90.top.z","between":[195,235]},"start_z_machine":{"from":"c90.top.z","plus":7},
   "max_drop_mm":10,"z_safe_delta_mm":5},
 {"id":"we90","kind":"surface_path","segments":[{"start":[170,199],"end":[115,199]},{"start":[170,199],"end":[225,199]}],
   "spacing_mm":14,"expected_z_machine":{"from":"c90.top.z"},"start_z_machine":{"from":"c90.top.z","plus":7}},
 {"id":"sides90","kind":"sequence","steps":[{"kind":"hop","x":118,"y":150},{"kind":"descend","z":{"from":"c90.top.z","minus":7,"between":[195,230]}},
   {"kind":"probe","name":"west_y150","dx":1,"max_travel_mm":25}, "..."]},
 {"id":"rot180","kind":"rotate_b","b":180}, "..."]}
```
Laws preserved: the confirm page is still the single motion gate (law 6); every XY move is at
traverse height or inside the approved station envelope (law 2); every number is measured,
operator-stated, or a bounded reference to a measurement made earlier in the same approved
program (law 3); rotations are enumerated on the page (law 1's "no inferred approvals").
