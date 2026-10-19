# Plan: M4x0.7 single-thread internal milling, 8 mm depth in aluminium

## Findings before anything moves

- Thread spec: M4x0.7 (major diameter 4 mm, pitch 0.7 mm), internal, 8 mm thread length wanted
- Cutter: M4x0.7xD4x50L single-thread form (one axial row); D4 = 4 mm shank, 50L = 50 mm overall length
- Reach stated as 7.5 mm tip-to-shank (from M2.5 reference); thread depth in bore = 8 mm
- Drilled hole: 3.3 mm diameter, existing, aluminium stock
- Concern: **reach of 7.5 mm may be insufficient for 8 mm thread depth plus cutter neck clearance and holder offset** — need exact hole depth, cutter effective cutting length, and holder geometry
- Work datum: unknown status; established from prior probing or must be set
- Tool in spindle: touch probe (must swap to cutter)
- Spindle: head type (200 W vs. standard) unspecified; RPM/power preference unknown
- Cutter flute count and effective cutting length not supplied — required for feed calculation and multi-turn setup

## Questions for the operator (one message)

1. **Cutter geometry:** How many flutes does the M4x0.7 cutter have? What is its axial effective cutting length (distance from first to last cutting edge along the axis)?
2. **Reach confirmation:** You stated 7.5 mm tip-to-shank reach. Measure or confirm: what is the maximum depth (Z travel) from the cutter tip when fully inserted into a collet to when the neck diameter clears the bore, and does the holder/extension clear nearby clamps? For an 8 mm thread depth plus cutter neck and spindle face clearance, we need ≥ 8.5–9 mm or more.
3. **Hole depth:** Is the 3.3 mm drilled hole exactly 8 mm deep, deeper, or shallower? For a thread to reach 8 mm, the bore must accommodate the deepest tip position of the cutter.
4. **Spindle setup:** Which CNC head is fitted — 200 W (8000–18000 RPM, S-command retained) or standard (percentage mode, P 1–100)? What RPM or power percentage would you prefer for this aluminium cutting?
5. **Work origin:** Does a verified work datum (XYZ, with B-rotary registration if relevant) already exist from prior setup probing? If yes, name its reference point and status. If no, we must probe the bore centre or use a fixture edge before thread cutting.
6. **First movement authority:** Before I stage any machine motion, confirm you want me to proceed with a tool change (measure probe, park, swap to cutter manually, measure cutter, apply offset) once I have the above information.

## Steps

1. `get_connection_status` and `get_position` and `get_stored_state` — verify state, reliability, homing, work origin record, stored probe length (geometry.probe.effectiveLength), tool setter config, and any existing landmarks [READ]

`-- Wait for answers to Questions 1–6 above --`

2. Declare work datum:
   - If operator confirms existing verified origin: cite its reference and B-rotary context; proceed to step 4
   - If no origin exists: probe bore centre using `probe_program` with vertical-axis `sequence` (sensor-gated −Z from traverse height Z328 to locate bore top), then `probe_circle` to measure bore diameter and centre; record W/origin with `set_origin` or note for manual entry [APPROVAL for each probe]

3. **Tool change flow A** (MCP-managed offset):
   - Measure old tool (probe): `run_tool_setter` with `bit_length_mm` (probe protrusion, stated in settings), `accept_probe_contact: true` [APPROVAL] [WAIT for completion]
   - Park: `goto_tool_change_position`, stages two jobs: Z raise then X/Y traverse [2 APPROVALS] [WAIT]
   - Operator swaps M4x0.7 cutter by hand [OPERATOR ACTION — no tool call]
   - Measure new tool (cutter): `run_tool_setter` with new `bit_length_mm` (operator provides approximate M4 cutter protrusion) [APPROVAL] [WAIT]
   - Apply offset: `apply_tool_length_offset` (defaults to last two measurements) [APPROVAL] [WAIT]
   - Verify: `get_position` — confirm `originOffset.z` changed by the expected delta and operator sanity-checks displayed work Z

4. Generate Machining Doctor program:
   - Thread: M4x0.7, internal, 8 mm length, RH, climb milling (or operator's preferred direction)
   - Cutter: cutting OD = 4 mm (the major diameter), single-tooth (one axial form), effective length from step 1, flute count from step 1, material = aluminium
   - Cutting conditions: spindle mode per step 4 answer (RPM if 200 W, or power % if standard); feeds per cutter data and material; entry feed; radial passes (typically 1 or 2 for internal); safety distances per generator defaults or operator; output controller = Fanuc, units = mm, precision = 4 decimals or higher
   - Export complete program including M06 T1 header, G54 origin, coordinates in work frame, D=0 (tool-centre path), ending with M30

5. Convert and review:
   - Call `convert_thread_milling_gcode` with:
     - gcode = complete exported source
     - source_controller = "fanuc"
     - tool_center_path: true
     - tool_length_applied: true (fitted tool M4 cutter, work Z set via tool-change offset)
     - spindle_mode = "cnc_200w_rpm" OR "power_percent" per step 4 answer
     - spindle_power_percent = operator's chosen % (if power_percent mode)
     - chord_tolerance_mm = 0.002 (default)
   - Review returned gcode, changes, warnings, validation, bounds:
     - Verify first XY move (to bore centre at work Z from initial position, accounting for motion-floor floor Z320 and clearance)
     - Confirm Z extent: deepest point must not exceed bore depth and must allow neck/holder clearance
     - Check arc segmentation and full-turn coverage
     - Confirm spiral pitch (should be 0.7 mm per turn)
     - Validate no clashing motion relative to landmarks and holder geometry
   - Record changes and warnings for review [READ]

6. Validate gcode: `validate_gcode` on the converted text [READ]

7. Stage for cutting:
   - `submit_gcode_job` with:
     - gcode = converted validated text
     - head_type = "cnc"
     - frame = "work"
     - name = "M4x0.7 internal, 8mm, single-form" or similar
   - Receive confirm_url and job_id [APPROVAL] [WAIT]

8. Execute: operator clicks confirm link, then `start_gcode_job {job_id, wait_for_approval_ms: 300000}` to await completion [WAIT]

9. Inspection: `get_position` after job finishes; operator inspects thread with M4x0.7 gauge or visual

`-- end turn --`

## Readiness

**Conversion declarations:**
- `tool_center_path: true` — Machining Doctor export at D=0 is tool-centre path (no radius compensation) ✓ (stated by generator, verified in source export)
- `tool_length_applied: true` — Can be declared **only after** tool-change offset is applied and work Z is verified to reference the M4 cutter tip (not the probe). Precondition: flow-A steps 1–5 complete and `get_position` confirms the offset was applied to originOffset.z.

**Submission requirements before any submit_gcode_job:**
- Work origin XYZ and B-rotary context recorded and verified (either prior probing or step 2 measurement)
- M4 cutter protrusion measured and tool-setter history holds both probe and new cutter (step 3)
- Tool-length offset applied; work Z anchored to M4 cutter tip (step 3, point 5)
- Bore depth, centre, cutter reach, neck/holder clearance reviewed and clash-free
- Machining Doctor program generated with all above inputs, exported in Fanuc dialect with D=0 and work-frame XYZ coordinates
- Converted gcode validated and warnings resolved or understood
- No landing on landmarks or obstacles when departing initial position (motion-floor and landmark checks from initial machine position through first approach segment)

**Approvals count:**
- Bore-centre probing (if required): `probe_program` with 2 sub-sequences = 1 approval
- Tool change (flow A):
  - Measure old = 1 [APPROVAL]
  - Park Z + Park XY = 2 [APPROVALS]
  - Measure new = 1 [APPROVAL]
  - Apply offset = 1 [APPROVAL]
  - Total = 5 approvals for tool change
- Submit gcode = 1 [APPROVAL]
- Start gcode (after operator clicks confirm) = 1 [WAIT, counted as operator action]

**Total logical approvals = 1 (bore probe, if needed) + 5 (tool change) + 1 (submit) = 7, OR 5 + 1 = 6 if work origin exists**
**Literal [APPROVAL] tags = 6 (or 7 with probe)**
**Operator waits = 5 (tool-setter runs × 2, park moves × 2, tool-change apply, gcode job start)**
**Questions = 6**
