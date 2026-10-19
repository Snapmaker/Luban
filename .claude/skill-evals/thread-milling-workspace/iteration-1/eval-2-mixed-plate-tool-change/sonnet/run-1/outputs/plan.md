# Plan: Thread-mill four M2.5 holes then two M4 holes, one tool change per cutter, minimum questions up front

## Findings before anything moves

- **Work origin was zeroed with the touch PROBE fitted, not a cutter.** Every cutting tool needs
  a tool-length-offset shift before it touches the plate — two tool changes are unavoidable
  (probe → M2.5 cutter, M2.5 cutter → M4 cutter), via the `tool-change` skill's flow A
  (MCP-managed offset).
- **The probe's effective length is already stored** (`geometry.probe.effectiveLength` = 71.3,
  SET, per the stand-in `get_stored_state`). `cnc-motion-rules` §2 says to plan on the stored
  value and not budget an approval to re-measure it. That also means the FIRST tool change does
  not need to measure the outgoing "tool" (the probe) on the setter at all: its trigger height is
  `100.5 (setter surface, cnc-probing table) + 71.3 = 171.8`, so `apply_tool_length_offset` can
  take that as an explicit `old_trigger_z`, skipping one whole approval.
- **The second tool change gets the same skip for free**, the other direction: the M2.5 cutter
  will have just been measured on the setter THIS session, so its measurement is `previous` and
  the M4 measurement becomes `last` — `apply_tool_length_offset {reason}` with no explicit
  z-values picks up both automatically (`tool-change` SKILL.md, "skip only if... this same tool,
  this session").
- **The supplied fixture (`thread-milling-m2_5-fanuc.nc`) is generated at datum X0/Y0** — it is
  not yet positioned at any of the four M2.5 hole centres, and `convert_thread_milling_gcode`
  does not reposition programs (`thread-milling.md`: "preserves source coordinates... does not
  invent clearance"; the datum is one of the generator's own inputs, listed under "Additional
  form choices"). To cut all six holes I need **one Machining Doctor export per hole**, each
  generated with that hole's work-coordinate XYZ datum — 4 for M2.5, 2 for M4. Only one export
  (the reference fixture) exists right now.
- **"D4" in both cutter names is shank diameter, not cutting diameter.** The M2.5 fixture's own
  header proves it: `CUTTER DIAM=1.38` while the part name carries "D4". So for the M4 pair,
  neither candidate's actual cutting diameter nor its axial (row) cutting length is known from
  the name alone — and the operator has said there is no more detail than the name. That blocks
  a fully-reasoned single-row-vs-triple-row recommendation; I can offer engineering judgment (see
  Questions) but not a measured answer.
- **The converted program's first move is an XY rapid at "the unknown initial position"**
  (`thread-milling.md`, on the validator's bounds) — its Z is deliberately excluded from what the
  confirm page reports. `cnc-motion-rules` law 2 still requires that move to be at/above the
  motion floor. I'll re-read `get_position` (free) before each `submit_gcode_job` for these
  programs and only insert a `move_z` to the park height when it is actually needed, rather than
  budgeting one for every hole.
- **`get_machine_profile` is not in the stand-in** and decides `spindle_mode`
  (`power_percent` vs `cnc_200w_rpm`) for `convert_thread_milling_gcode`. `README.md` line 5
  records this rig as built and hardware-verified with the **200 W CNC toolhead** (2026-08), and
  the fixture's `S17991` sits inside the 200 W firmware's 8000–18000 RPM range, so I'm planning
  on `cnc_200w_rpm` (keeps source RPM, no invented power percentage) — but I call
  `get_machine_profile` live first in case Machine Settings changed since then, per the run
  instructions' own guidance to say which call reads it and branch on the answer.
- Both required declarations for the converter are already satisfied by this job:
  `tool_center_path: true` (fixture header: `CUTTER COMPENSATION D=0 - TOOLPATH FOR TOOL CENTER`)
  and `tool_length_applied: true` (true once the tool-change offset above is applied, so the work
  Z already accounts for the fitted cutter's tip).

## Questions for the operator (one message)

1. **Tool-change flow** — are you at the computer for an MCP-managed offset (flow A, what I've
   planned below), or at the machine for the touchscreen wizard (flow B)?
2. **Approximate protrusion** (`bit_length_mm`, collet to tip) for the M2.5x0.45 cutter, and for
   whichever M4 cutter we end up using (declare low rather than high; it only sets a measurement
   floor).
3. **Which M4 cutter?** I lean toward the **single-row** one: Machining Doctor's single-tooth
   path only needs pitch/major-diameter/thread-length and helixes continuously, while the
   triple-row (multi-tooth) path forces a "cutter row length longer/shorter than the 5 mm thread"
   choice — and neither candidate's row length is known from the name alone. If you have the
   triple-row cutter's actual cutting diameter and row length (off its datasheet or a caliper),
   say so and I'll use that one instead.
4. **M4 thread depth** — same as the M2.5 holes, full 5 mm through the plate? (Assuming yes since
   the plate is 5 mm and pre-drilled through, unless you say otherwise.)
5. **The six Machining Doctor exports** — I only have the one M2.5 fixture, generated at datum
   (0, 0), which isn't tied to a real hole yet. Please generate (or paste) one export per hole
   with the datum set to that hole's work coordinates: M2.5 at (10,10), (60,10), (10,40), (60,40)
   — same specs as the fixture (RH, climb, internal, 2.53 mm major, 0.45 mm pitch, 5 mm length,
   1.38 mm cutter, 2.25 mm cutting length) — and M4 at (35,15), (35,35) once Q3/Q4 are settled.
   Tell me which of the four M2.5 datums, if any, the fixture I already have corresponds to, or
   treat it as a template and regenerate all four.
6. **Fixturing** — are the clamps clear of the whole (10,10)–(60,40) working rectangle at cutting
   depth, and is the door shut / dust extraction on?

-- end turn --

## Steps

1. `get_connection_status` — quoted from the stand-in: connected (Wi-Fi), A350, CNC module.
2. `get_position` — quoted: `reliability: verified`, homed, idle, machine (X−19, Y342, Z328),
   warnings [], `originOffset` present.
3. `get_stored_state` — quoted: `geometry.probe.effectiveLength` 71.3 (SET); `limits`:
   `motionFloorZ` 320, `safeTraverseZ` 328; tool setter centre machine (X79, Y293); landmark
   `rotary` (box machine X110–230, Y130–342); touch probe fitted.
4. `get_machine_profile` — read-only; confirms CNC head type (standard vs 200 W) before
   `spindle_mode` is fixed for every `convert_thread_milling_gcode` call below. Planning on
   200 W / `cnc_200w_rpm` per README.md unless this says otherwise.
5. Ask the operator the six numbered questions above, deliver as ONE message.
-- end turn --
6. [WAIT] Operator answers. Assume for the remaining steps: flow A, M2.5 protrusion and chosen
   M4 cutter's protrusion given, single-row M4 cutter confirmed, M4 through 5 mm confirmed, all
   six datum-correct exports provided, clamps/door/extraction confirmed clear.

### Tool change 1 — probe → M2.5x0.45 triple-row cutter

7. `goto_tool_change_position {}` [APPROVAL] — stages Z-up then XY to the park spot.
8. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` — deliver the confirm URL as the
   last line, end the turn first.
-- end turn --
9. [WAIT] Operator clicks confirm; head parks. Operator removes the touch probe and fits the
   M2.5x0.45 cutter, then says so in chat.
-- end turn --
10. `run_tool_setter {bit_length_mm: <M2.5 protrusion from answer 2>, reason: "measure M2.5x0.45 cutter after probe->cutter swap"}` [APPROVAL]
11. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` — deliver URL, end turn.
-- end turn --
12. [WAIT] Operator confirms.
13. `apply_tool_length_offset {old_trigger_z: 171.8, reason: "probe (stored effectiveLength 71.3 + setter surface 100.5) -> M2.5x0.45 cutter"}` [APPROVAL] — new_trigger_z defaults to the step-10 measurement.
14. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` — deliver URL, end turn.
-- end turn --
15. [WAIT] Operator confirms.
16. `get_position` — verify `originOffset.z` moved by the expected delta (free, no approval).

### Cut the four M2.5 holes (repeat per hole, operator's datum-correct export from answer 5)

For hole H in {(10,10), (60,10), (10,40), (60,40)}:

17. `validate_gcode {gcode: "<operator's export for hole H>"}` — free; read the warnings.
18. `convert_thread_milling_gcode {gcode: "<same text>", source_controller: "fanuc", tool_center_path: true, tool_length_applied: true, spindle_mode: "cnc_200w_rpm", chord_tolerance_mm: 0.002}` — free/offline; review `changes`, `warnings`, `sourceSpindleRpm`, `validation`.
19. `get_position` — free; if the reported machine Z is below the motion floor (320), insert
    `move_z {z: 328, coordinate_system: "machine", reason: "park before hole H's initial XY rapid, whose Z the converter's own bounds exclude"}` [APPROVAL] + `start_gcode_job` here, otherwise skip straight to 20.
20. `submit_gcode_job {gcode: "<converted program>", name: "m2.5-hole-H.nc", frame: "work", head_type: "cnc"}` [APPROVAL] — read the operator the confirm page's Frame row and machine-resolved Z extents.
21. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` — deliver URL, end turn.
-- end turn --
22. [WAIT] Operator confirms; cut runs.
23. `get_gcode_job_status {job_id, wait_ms: 110000, since_event}` — poll to `ending.kind: completed`.

(Steps 17–23 repeat 4 times, once per M2.5 hole; no further questions, no tool change between
them.)

### Tool change 2 — M2.5 cutter → M4 cutter (single-row, pending answer 3)

24. `goto_tool_change_position {}` [APPROVAL]
25. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` — deliver URL, end turn.
-- end turn --
26. [WAIT] Operator clicks confirm; head parks. Operator swaps M2.5 cutter for the M4 cutter,
    then says so.
-- end turn --
27. `run_tool_setter {bit_length_mm: <M4 protrusion from answer 2>, reason: "measure M4 cutter after M2.5->M4 swap"}` [APPROVAL] — this session's M2.5 measurement (step 10) becomes `previous` automatically; no separate "measure old" run needed.
28. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` — deliver URL, end turn.
-- end turn --
29. [WAIT] Operator confirms.
30. `apply_tool_length_offset {reason: "M2.5 cutter -> M4 cutter"}` [APPROVAL] — defaults to the last two measurements (M2.5 = old, M4 = new).
31. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` — deliver URL, end turn.
-- end turn --
32. [WAIT] Operator confirms.
33. `get_position` — verify `originOffset.z` moved by the expected delta (free).

### Cut the two M4 holes (repeat per hole, operator's datum-correct export from answer 5)

For hole H in {(35,15), (35,35)}:

34. `validate_gcode {gcode: "<operator's M4 export for hole H>"}` — free.
35. `convert_thread_milling_gcode {gcode: "<same text>", source_controller: "fanuc", tool_center_path: true, tool_length_applied: true, spindle_mode: "cnc_200w_rpm", chord_tolerance_mm: 0.002}` — free/offline.
36. `get_position` — free; conditional `move_z {328}` [APPROVAL] as in step 19, only if needed.
37. `submit_gcode_job {gcode: "<converted program>", name: "m4-hole-H.nc", frame: "work", head_type: "cnc"}` [APPROVAL] — read the operator Frame + Z extents.
38. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` — deliver URL, end turn.
-- end turn --
39. [WAIT] Operator confirms; cut runs.
40. `get_gcode_job_status {job_id, wait_ms: 110000, since_event}` — poll to completion.

(Steps 34–40 repeat twice, once per M4 hole.)

### Done

41. Report all six holes' `ending.kind` to the operator; no further motion needed unless they
    want a park/home.

Counts: approvals=12 baseline (3 tool-change-1 + 4 M2.5 submits + 3 tool-change-2 + 2 M4 submits)
plus up to 6 conditional `move_z` insurance approvals (only if a position check finds the head
below the motion floor before a hole's submit — not expected right after a park or a prior job's
retract, but checked every time rather than assumed), operator waits=2 (the two manual tool
swaps), questions=6.
