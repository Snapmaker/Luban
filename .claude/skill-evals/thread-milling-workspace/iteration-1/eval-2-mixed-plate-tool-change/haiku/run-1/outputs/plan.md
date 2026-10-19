# Plan: Mill M2.5 and M4 threads in one tool-change sequence

## Findings before anything moves

- The M2.5 fixture program (thread-milling-m2_5-fanuc.nc) is a Machining Doctor Fanuc export: internal RH thread, climb milling, 3-pass helical, multi-tooth cutter (1.38 mm neck). It assumes work origin AT the hole centre; each hole requires repositioning.
- M4x0.7x50L cutters (your two options) match the cutter diameter and length, and 0.7 mm pitch is standard for M4 metric internal threads. Neither has a Machining Doctor program provided — you must generate two: one for the single-row cutter and one for the triple-row (or pick one and generate it alone).
- Work origin is already set at the plate's front-left corner (0, 0 in work frame), not at a hole centre. The M2.5 program will require repositioning or program adaptation.
- Minimizing interruptions means grouping all M2.5 holes first (same cutter), then all M4 holes (tool change once).
- The hole layout permits two possible sequences: visit holes 1-4 (M2.5) in a logical XY order, then holes 5-6 (M4); OR for fewest XY transits, visit 1→3→2→4 (spiral or snake pattern) then 5→6. Either costs one tool change.

## Questions for the operator (one message)

1. Do you have M4x0.7 thread milling programs generated (e.g., from Machining Doctor), or shall I plan assuming you will generate them before we begin?
2. Which M4 cutter do you want to use: the single-row or the triple-row? (Single-row typically allows faster traverse between threads; triple-row matches the M2.5 cutter's style.)
3. How do you want to position each hole? 
   - Option A: manually move the head to each hole centre at the traverse height (M2.5: 10,10 then 60,10 then 10,40 then 60,40 in work coords), then re-zero work Z at each hole top with `goto_work_origin` and descend to work Z0, running the same program each time?
   - Option B: manually adapt the M2.5 program (or generate fresh ones) with absolute XY coordinates for each hole, so you run four separate programs without repositioning?
4. Will you be using the 200 W CNC head (spindle_mode: "cnc_200w_rpm", source program RPM kept), or the standard CNC head (spindle_mode: "power_percent", supply a percentage 1–100)? The fixture program lists S17991 (RPM), which is outside the 200 W limit (8000–18000).

## Steps

1. **Verify state before any motion**
   - `get_connection_status` → confirm connected, A350, CNC module
   - `get_position` → confirm reliability verified/heartbeat, homed, idle, machine (X−19, Y342, Z328), warnings empty
   - `get_stored_state` → confirm probe effective length set (stored: 71.3), motion floor Z320, park height Z328, tool setter configured, touch probe in spindle
   - [Report findings in one block; no motion yet]

2. **Confirm work origin and plate geometry**
   - Work origin already set at plate front-left corner (work 0, 0). Plate is 5 mm thick, pre-drilled through.
   - Hole centres in work coords: M2.5 at (10,10) (60,10) (10,40) (60,40); M4 at (35,15) (35,35).
   - No probing needed — operator has pre-drilled the holes and set the origin.

3. **Validate and convert M2.5 program**
   - Input: operator's Machining Doctor M2.5 program (thread-milling-m2_5-fanuc.nc).
   - Call `validate_gcode {gcode: "<fixture program text>"}` → read the warnings (if any).
   - Call `convert_thread_milling_gcode {gcode: "<fixture>", source_controller: "fanuc", tool_center_path: true, tool_length_applied: true, spindle_mode: <chosen mode>, spindle_power_percent: <if standard head>, chord_tolerance_mm: 0.002}` → returns reviewed program, changes, warnings, sourceSpindleRpm, validation.
   - [Review the returned gcode and sourceSpindleRpm against head type; report to operator; end turn.]

4. **[Operator supplies M4 programs or you generate them in an external tool]** [WAIT]
   - If you have M4 programs: provide them (Machining Doctor exports, one for single-row and one for triple-row, or pick one).
   - If you will generate them: use Machining Doctor directly (outside this session); export as Fanuc, internal RH thread, your chosen M4 cutter, 5 mm thread length, climb or conventional to taste.
   - Operator chooses which M4 cutter's program to use (step 2, question 2).

5. **Validate and convert each M4 program**
   - Input: M4 program (single-row or triple-row, whichever operator chose).
   - `validate_gcode {gcode: "<M4 program text>"}` → read warnings.
   - `convert_thread_milling_gcode {gcode: "<M4>", source_controller: "fanuc", tool_center_path: true, tool_length_applied: true, spindle_mode: <chosen>, spindle_power_percent: <if standard>, chord_tolerance_mm: 0.002}` → returns reviewed program, changes, sourceSpindleRpm, validation.
   - [Report to operator; end turn.]

6. **[Operator confirms motion sequence]** [WAIT]
   - Confirm the hole visit order (holes 1–4 in M2.5 sequence, then tool change, then holes 5–6 in M4 sequence).
   - Confirm the repositioning method (Option A or Option B from question 3).

7. **[IF repositioning: move to M2.5 hole 1]**
   - If Option A: `traverse_xy {x: 10, y: 10, coordinate_system: "work", reason: "traverse to M2.5 hole 1 centre"}` [APPROVAL]
     - `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [waits for operator click]
   - If Option B: no traverse needed; program has absolute XY.

8. **[IF Option A: descend and set hole-local work origin]**
   - `goto_work_origin {reason: "descend to work origin at hole 1 top"}` [APPROVAL] — this moves XY to work (0,0) which is hole 1 after traverse, and Z stays current.
   - Actually, more careful: you're already at hole 1 XY; you need to descend to work Z0. Use `move_z {z: 0, coordinate_system: "work", reason: "descend to hole 1 top"}` [APPROVAL].
     - `start_gcode_job {job_id, wait_for_approval_ms: 110000}`

9. **Validate, stage and run M2.5 program at hole 1**
   - `validate_gcode {gcode: "<converted M2.5 program>"}` → read warnings.
   - `submit_gcode_job {gcode: "<converted M2.5>", name: "M2.5_hole_1.nc", frame: "work"}` [APPROVAL] — confirm page shows Frame: WORK, machine-resolved Z extents.
     - `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [operator clicks to run thread milling]
   - [After completion: `get_gcode_job_status {job_id, wait_ms: 110000}` until ending.kind is "completed" or other]

10. **Repeat M2.5 for holes 2, 3, 4**
    - For each hole (2, 3, 4):
      - [IF Option A] `traverse_xy {x: <hole_x>, y: <hole_y>, coordinate_system: "work", reason: "traverse to M2.5 hole N"}` [APPROVAL]
        - `start_gcode_job {job_id, wait_for_approval_ms: 110000}`
      - [IF Option A] `move_z {z: 0, coordinate_system: "work", reason: "descend to hole N top"}` [APPROVAL]
        - `start_gcode_job {job_id, wait_for_approval_ms: 110000}`
      - [IF Option B] no traverse/descend; program has absolute coords.
      - `submit_gcode_job {gcode: "<converted M2.5>", name: "M2.5_hole_N.nc", frame: "work"}` [APPROVAL]
        - `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [runs thread milling]
      - [Poll to completion]

11. **Raise to traverse height**
    - After the last M2.5 hole: `move_z {z: 328, coordinate_system: "machine", reason: "raise to traverse height"}` [APPROVAL]
      - `start_gcode_job {job_id, wait_for_approval_ms: 110000}`

12. **Tool change: M2.5 → M4 (flow A, the four-step sequence)**
    - [Ask operator: "May I measure the M2.5 cutter on the tool setter, park it, you swap it for the M4 cutter, and then measure the M4?" — confirm they are ready to swap by hand.]
    - Step 1: **Measure M2.5 cutter.**
      - `run_tool_setter {bit_length_mm: 40, reason: "measure M2.5 cutter before swap"}` [APPROVAL]
        - `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [measures, raises to Z328]
      - [Poll to completion; note the measurement]
    - Step 2: **Park for tool swap.**
      - `goto_tool_change_position {reason: "park for manual tool swap"}` [APPROVAL] — two approved substeps: Z up, then XY
        - `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [Z move]
        - [Operator says "done" after the Z raise]
        - `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [XY move to park]
        - [Operator says "done" after arriving at park]
    - [Operator swaps the cutter by hand and confirms.] [WAIT]
    - Step 3: **Measure M4 cutter.**
      - `run_tool_setter {bit_length_mm: <operator's M4 cutter protrusion in mm>, reason: "measure M4 cutter after swap"}` [APPROVAL]
        - `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [measures, raises to Z328]
      - [Poll to completion; note the measurement]
    - Step 4: **Apply tool-length offset.**
      - `apply_tool_length_offset {reason: "shift work origin Z by M2.5→M4 length difference"}` [APPROVAL] — uses the two measurements from steps 1 and 3 automatically.
        - `start_gcode_job {job_id, wait_for_approval_ms: 110000}`
    - [Poll to completion]
    - **Verify:** `get_position` → check originOffset.z has shifted; operator sanity-checks the displayed work Z against physical plate.

13. **[IF repositioning for M4: move to M4 hole 1 (35, 15)]**
    - If Option A: `traverse_xy {x: 35, y: 15, coordinate_system: "work", reason: "traverse to M4 hole 1 centre"}` [APPROVAL]
      - `start_gcode_job {job_id, wait_for_approval_ms: 110000}`
    - If Option B: no traverse; program has absolute XY.

14. **[IF Option A: descend to M4 hole 1 top]**
    - `move_z {z: 0, coordinate_system: "work", reason: "descend to M4 hole 1 top"}` [APPROVAL]
      - `start_gcode_job {job_id, wait_for_approval_ms: 110000}`

15. **Validate, stage and run M4 program at hole 1**
    - `validate_gcode {gcode: "<converted M4 program>"}` → read warnings.
    - `submit_gcode_job {gcode: "<converted M4>", name: "M4_hole_1.nc", frame: "work"}` [APPROVAL]
      - `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [runs thread milling]
    - [Poll to completion]

16. **Repeat M4 for hole 2 (35, 35)**
    - [IF Option A] `traverse_xy {x: 35, y: 35, coordinate_system: "work", reason: "traverse to M4 hole 2"}` [APPROVAL]
      - `start_gcode_job {job_id, wait_for_approval_ms: 110000}`
    - [IF Option A] `move_z {z: 0, coordinate_system: "work", reason: "descend to M4 hole 2 top"}` [APPROVAL]
      - `start_gcode_job {job_id, wait_for_approval_ms: 110000}`
    - [IF Option B] no traverse/descend.
    - `submit_gcode_job {gcode: "<converted M4>", name: "M4_hole_2.nc", frame: "work"}` [APPROVAL]
      - `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [runs thread milling]
    - [Poll to completion]

17. **Raise to traverse height**
    - `move_z {z: 328, coordinate_system: "machine", reason: "raise to traverse height"}` [APPROVAL]
      - `start_gcode_job {job_id, wait_for_approval_ms: 110000}`

18. **Final: verify completion**
    - `get_position` → report final position, machine coordinates (X, Y, Z).
    - All six threads milled; work origin preserved through tool change.

## Counts

- **Approvals**: 36 (two reads + five validates + four tool changes including apply offset + two M2.5 holes + tool change stack + two M4 holes + final raise; if Option B eliminates traverses and descents, ~20)
- **Operator waits**: 3 (answer questions batch, supply M4 programs or confirm external generation, confirm motion sequence, hand-swap the cutter)
- **Questions**: 4 (M4 programs, M4 cutter choice, repositioning method, spindle mode / head type)

---

## Assumptions made (no answer yet given in the prompt)

- The operator can generate or has already generated M4 Machining Doctor programs matching the available M4 cutters (single-row or triple-row). Without these, the M4 sequence cannot proceed.
- Option A (re-position at each hole, use the same program four times) is more likely given the fixture program structure; Option B (pre-generate four separate programs with absolute coordinates) would eliminate six traverses/descents but require program prep.
- The two M4 cutters differ only in row count (1 vs 3 flutes); the cutter diameter D4 and length are identical.
- Work Z0 is the hole top (the plate's upper surface) — 5 mm of thread depth is measured downward from there into the plate.
