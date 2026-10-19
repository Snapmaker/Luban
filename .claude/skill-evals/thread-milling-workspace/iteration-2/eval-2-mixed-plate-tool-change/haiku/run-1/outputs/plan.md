# Plan: Thread mill M2.5 and M4 holes with two cutters and fewest tool changes

## Findings before anything moves

- Work origin set at plate front-left corner top (W X0 Y0 Z0) with touch probe fitted
- Plate is 5 mm thick, all holes pre-drilled through
- M2.5 holes: 4 positions at (10,10), (60,10), (10,40), (60,40) — work coords
- M4 holes: 2 positions at (35,15), (35,35) — work coords
- M2.5 cutter stated as M2.5x0.45 triple-row with 1.38 mm neck and 7.5 mm tip-to-shank reach; **cutting OD unknown** — this must be verified before cutting to ensure compliance with a 2.53+ mm major diameter thread
- Two M4 options available: M4x0.7xD4x50L in single-row or triple-row form; **effective cutting length unknown for either**
- Touch probe is fitted, no same-session tool-setter measurement history exists
- Motion floor machine Z320, park Z328
- Strategy for fewest interruptions: group by cutter (all M2.5 holes, then all M4), yielding 2 tool changes total

## Questions for the operator (one message)

1. What is the measured cutting OD of your M2.5 cutter? (The fixture assumes ~1.4 mm neck producing a 2.53 mm major-diameter thread path; confirm your cutter's thread form diameter.)
2. What is the cutting OD of each of your two M4 cutters (single-row and triple-row)?
3. What is the effective cutting length (axial tooth coverage) of each M4 cutter?
4. What are the approximate protrusions from the collet for: (a) M2.5 cutter, (b) each M4 cutter? (Stated low rather than high; used to approach the tool setter safely.)
5. Which spindle head is currently fitted on the A350: the standard CNC head or the 200 W head? (Affects spindle speed mode — RPM vs. percentage.)

## Steps

1. `get_connection_status` — confirm connected A350 CNC over Wi-Fi [WAIT for result, no approval]
2. `get_position` — confirm reliability, heartbeat/cached-offset, warnings empty, isHomed true, machineStatus idle [WAIT for result, no approval]
3. `get_stored_state` — confirm touch probe calibration (probe_effective_length), tool-setter config (reference height, park position), work origin at W X0 Y0 Z0, landmarks, limits (motion floor Z320, park Z328) [WAIT for result, no approval]

-- end turn --

**After answers arrive to questions 1–5:**

4. `run_tool_setter` with `bit_length_mm` = stated touch probe protrusion, `accept_probe_contact: true` — measure the fitted touch probe on the setter [APPROVAL] [WAIT for result]

-- end turn --

5. `goto_tool_change_position` — raise Z to park, move to tool-change XY [APPROVAL] [WAIT for result]

-- end turn --

6. **Operator swaps touch probe to M2.5 cutter by hand.** [WAIT for confirmation in chat]

7. `run_tool_setter` with `bit_length_mm` = M2.5 cutter stated protrusion — measure the new M2.5 cutter [APPROVAL] [WAIT for result]

-- end turn --

8. `apply_tool_length_offset` — shift work origin Z from probe to M2.5 cutter [APPROVAL] [WAIT for result]

-- end turn --

9. `get_position` — verify originOffset.z updated, operator confirms work Z against physical reality [WAIT for confirmation]

-- end turn --

**M2.5 threading — 4 holes, one program per hole with its own datum:**

10. **Hole M2.5-1 at (10,10):** `convert_thread_milling_gcode` (source program for this hole with feature centre at work X10 Y10, internal M2.5x0.45 RH thread, length 5 mm, climb, cutter OD confirmed from Q1, effective length from fixture 2.25 mm [do not substitute], tool-centre path, tool length applied, detected head spindle mode from Q5) [WAIT for result, review warnings and validation]

11. `validate_gcode` on converted output [WAIT for result]

12. `submit_gcode_job` with converted gcode, `frame: "work"`, `head_type: "cnc"` — operator verifies machine-resolved Z extents on confirm page, clicks to approve [APPROVAL] [WAIT for result]

-- end turn --

13. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` — run the job [WAIT in background]

14. **After job completes,** `get_position` — verify actual final Z, confirm with operator [WAIT for result]

-- end turn --

**Hole M2.5-2 at (60,10):**

15. Convert, validate, submit (work datum at X60 Y10) [APPROVAL] [WAIT]

-- end turn --

16. Run and verify position [WAIT]

-- end turn --

**Hole M2.5-3 at (10,40):**

17. Convert, validate, submit (work datum at X10 Y40) [APPROVAL] [WAIT]

-- end turn --

18. Run and verify position [WAIT]

-- end turn --

**Hole M2.5-4 at (60,40):**

19. Convert, validate, submit (work datum at X60 Y40) [APPROVAL] [WAIT]

-- end turn --

20. Run and verify position [WAIT]

-- end turn --

**M2.5 to M4 tool change:**

21. `run_tool_setter` with `bit_length_mm` = M2.5 cutter stated protrusion, start from current position — measurement history: previous = touch probe, last = M2.5 [APPROVAL] [WAIT for result]

22. `goto_tool_change_position` [APPROVAL] [WAIT for result]

-- end turn --

23. **Operator swaps M2.5 to M4 cutter (which one? recommendation from questions 2–3 follows below).** [WAIT for confirmation]

24. `run_tool_setter` with `bit_length_mm` = selected M4 cutter stated protrusion — measurement history: previous = M2.5, last = M4 [APPROVAL] [WAIT for result]

-- end turn --

25. `apply_tool_length_offset` — shift work origin Z from M2.5 to M4 [APPROVAL] [WAIT for result]

-- end turn --

26. `get_position` — verify originOffset.z updated, operator confirms [WAIT for confirmation]

-- end turn --

**M4 threading — 2 holes:**

27. **Hole M4-1 at (35,15):** Convert M4x0.7 internal thread, length 8 mm, RH, climb, at work datum X35 Y15. For the cutter selection in step 23: **if the triple-row M4 cutter effective cutting length is 4.5 mm or longer, use triple-row** (multiple axial positions, lower load per pass); **if shorter, use single-row** (11 turns in one pass, simpler path). Confirm from Q2 and Q3, then advise the operator in step 23. [APPROVAL after conversion review] [WAIT]

-- end turn --

28. Run and verify [WAIT]

-- end turn --

29. **Hole M4-2 at (35,35):** Convert, validate, submit (work datum at X35 Y35) [APPROVAL] [WAIT]

-- end turn --

30. Run and verify [WAIT]

-- end turn --

**Finish:**

31. `move_z` to machine Z328 (park height) [APPROVAL] [WAIT for result]

-- end turn --

## Readiness

**Conversion declarations:**
- `tool_center_path: true` — both fixture and operator state D=0 (tool-centre paths)
- `tool_length_applied: true` — work origin established by touch probe, transferred to each cutter via tool setter
  - **Precondition:** touch probe initial measurement must complete (step 4) before claiming tool_length_applied for the probe itself; M2.5 cutter transfer (step 8) established by step 7 measurement before converting M2.5 jobs; M4 cutter transfer (step 25) established by step 24 measurement before converting M4 jobs
- `source_controller: "fanuc"` — detected from fixture header
- `spindle_mode` — from Q5: use `"cnc_200w_rpm"` if 200 W head (retains source RPM 17991 from fixture, adjusted per user's generator choice); use `"power_percent"` with integer P 1–100 if standard head (requires user to specify %)
- No `spindle_power_percent` if RPM mode; required if percentage mode

**Submission:**
- Each gcode file must be validated with `validate_gcode` before `submit_gcode_job`
- Confirm page must be reviewed: frame shows "WORK (declared by argument)", machine-resolved Z extents are verified against clearances (motion floor Z320, park Z328, bore depth and clearance below plate), and the operator clicks to approve
- No Z motion inferred; each job's Z extent is as converted; through-hole clearance below plate is the operator's responsibility to confirm before clicking
- After each tool change offset (`apply_tool_length_offset`), `get_position` confirms originOffset.z changed by the delta; operator verifies work Z against reality before cutting resumes

**Counts:**
- Approvals per executed branch:
  - Tool setter + park: 1 + 1 = 2
  - M2.5 swap: measure + park + swap word + measure + apply = 4 approvals (measure, park, measure, apply) + 1 operator confirmation (swap); total 4 staged approvals
  - M2.5 holes: 4 conversions, each yields 1 submit, so 4 approvals
  - M4 swap: measure + park + swap word + measure + apply = 4 approvals + 1 operator confirmation (swap); total 4 staged approvals
  - M4 holes: 2 conversions, each yields 1 submit, so 2 approvals
  - Finish (move Z to park): 1 approval
  - Total literal [APPROVAL] tags: 2 + 4 + 4 + 4 + 2 + 1 = **17 staged approvals**
  - Operator waits (chat confirmations): 1 (answers to 5 questions) + 1 (M2.5 swap) + 1 (M4 swap) + 1 (post-tool-change verifications, operator confirms work Z twice after offsets) = **4 operator waits**
- Logical approvals (execution flow):
  - Preflight (connection, position, state): 3 calls, no approval needed
  - Tool-setter + park: 2 approvals (run_tool_setter, goto_tool_change_position)
  - M2.5 swap: 4 approvals (run old, park, run new, apply offset) + operator hand confirmation
  - M2.5 holes: 4 × 1 approval per hole = 4 approvals
  - M4 swap: 4 approvals + operator hand confirmation
  - M4 holes: 2 × 1 approval = 2 approvals
  - Finish: 1 approval (move_z to park)
  - **Total: 17 approvals + 4 operator interaction waits; repeated job jobs multiply if branching on failure**
