# Plan: Convert and prepare M2.5 internal thread program from Machining Doctor

## Findings before anything moves

- **Source file format:** Machining Doctor Fanuc dialect export (thread-milling-m2_5-fanuc.nc) — standard format, ready for offline conversion via `convert_thread_milling_gcode`
- **Thread specification:** Internal RH thread, M2.5x0.45 mm pitch, 5 mm thread length (from fixture header)
- **Cutter specification mismatch to resolve:** Fixture declares "CUTTER DIAM=1.38, L=2.25 [MULTI TOOTH]" (1.38 is neck diameter, not cutting OD; 2.25 mm is effective cutting length / axial coverage, suggesting three rows at ~0.75 mm spacing). Operator states "M2.5x0.45xD4x50L - 1.38mm neck 7.5mm long including triple row threads, triple flute" — these dimensions need reconciliation before stage.
- **Hole preparation:** Operator states 2.05 mm diameter, ~6 mm deep (fixture thread length 5 mm, deepest point work Z−5.056, implies clearance below; blind hole clearance must be verified)
- **Spindle mode:** Source RPM 17991 is within 200 W head range 8000–18000 RPM; confirmation required whether 200 W or standard head is fitted
- **Work origin and tool history:** Fixture references work Z20 as retract height; work Z0 datum and fitted-tool Z calibration must be known (probe or thread-milling tool?)
- **Program structure:** G54 workspace selected; G43 H1 tool-length offset; initial XY move G00 X0 Y0 at actual starting height (not raised); three helical passes at Z−1.688, Z0, Z+1.688 relative to entry
- **Frame handshake:** File declares G54 (work frame); requires `frame: "work"` on submit; no G53 present
- **Motion floor and park:** Conversion assumes motion floor Z320 and park Z328 (machine heights)
- **Tool availability:** Conversion is offline; no connection or tool verification needed yet; staged job will require live position, connection, work origin, and tool-setter measurement once operator requests execution

## Questions for the operator (one message)

1. Is the **200 W spindle head** or the **standard CNC head** currently fitted? (Source RPM 17991 is compatible with 200 W; standard head requires spindle speed converted to percentage)
2. **Cutter dimensions to confirm:** The fixture uses neck diameter 1.38 mm for clearance and a 2.25 mm effective cutting length (suggesting ~0.75 mm spacing between three rows). The operator's description says "1.38mm neck 7.5mm long including triple row threads." Are the effective cutting length and axial row spacing the actual values, or is 7.5 mm the total collet-to-tip length? (This affects collision clearance during the three axial passes)
3. **Hole clearance:** The program deepest point is work Z−5.056. The operator states "about 6 mm deep." Is the 6 mm depth measured from the stock top to the blind bottom (chip space), or is it drilled to depth minus clearance? (Fixture thread length 5 mm + work Z−5.056 suggests 0.056 mm margin below thread; a through hole needs additional clearance)
4. **Work origin history:** Was the work origin Z0 established with the touch probe (common for thread-milling setup), or with the thread mill cutter itself? (Determines tool-change flow and `tool_length_applied: true` validity)
5. **Fitted tool before cutting:** Is the touch probe currently in the spindle, or has the thread mill cutter already been inserted? (Determines whether a tool-change measurement is needed before staging the job)

## Steps

1. Verify state (operator word required before any motion; answer the preflight checklist of cnc-motion-rules §0):
   - `get_connection_status` — confirms connected A350 CNC over Wi-Fi
   - `get_position` — reliability verified/heartbeat/cached-offset, warnings empty, isHomed true, machineStatus idle
   - `get_stored_state` — read landmarks, limits, geometry (probe effectiveLength, tool-setter config, rotary geometry if applicable)
   - Read and quote these results in reply

2. Offline conversion (no connection required; review-only until staging):
   - `convert_thread_milling_gcode` {
       "gcode": "<complete thread-milling-m2_5-fanuc.nc text>",
       "source_controller": "fanuc",
       "tool_center_path": true,
       "tool_length_applied": true,
       "spindle_mode": "cnc_200w_rpm" OR "power_percent" with integer spindle_power_percent [depends on answer to question 1],
       "chord_tolerance_mm": 0.002
     }
   - Capture returned: `gcode`, `changes`, `warnings`, `sourceSpindleRpm`, arc/full-circle/segment counts, `validation`
   - Compare source and converted output: check units, datum, first positioning, entry/exit, Z travel sign, pitch per turn, every radial pass, feeds, spindle commands, deepest point (−5.056), final retract (Z+0.006 → Z20), and actual extents
   - Resolve all warnings against bore dimensions (2.05 mm diameter, 6 mm depth) and cutter clearance (neck diameter, shank, effective cutting length)

-- end turn --

3. [After operator answers and conversion review is approved] Validate converted program:
   - `validate_gcode` {"gcode": "<converted text>"}
   - Read the warnings; flag any spindle state, Z extents, or distance-mode issues

4. [After validation approved] Tool change (if probe currently fitted; if thread mill cutter already in place, skip to step 7):
   - Ask operator: **Is the touch probe fitted, or has the thread mill cutter already been inserted?**
   - If probe fitted, execute Flow A tool change (cnc-thread-milling §stage, tool-change §2 flow A):
     a. Measure the old tool (touch probe): `run_tool_setter` {"bit_length_mm": 70 [probe protrusion estimate], "accept_probe_contact": true, "reason": "pre-change measurement, probe fitted"}
        - `start_gcode_job` after confirm page [APPROVAL] [WAIT]
     b. Park for manual swap: `goto_tool_change_position` {"reason": "prepare for thread mill cutter swap"}
        - `start_gcode_job` (two calls: Z raise, then XY park) [APPROVAL] [WAIT]
     c. Operator swaps thread mill cutter by hand (wait for operator word; do not infer)
     d. Measure new tool (thread mill cutter): `run_tool_setter` {"bit_length_mm": 40 [cutter protrusion estimate from answered dimension], "reason": "post-swap measurement, thread mill cutter fitted"}
        - `start_gcode_job` after confirm page [APPROVAL] [WAIT]
     e. Shift work origin Z: `apply_tool_length_offset` {"reason": "transfer work origin from probe to thread mill cutter"}
        - `start_gcode_job` after confirm page [APPROVAL] [WAIT]
     f. Verify: `get_position` — confirm originOffset.z has changed by delta and matches operator expectation

5. [After tool change or if cutter already fitted] Fresh connection state check before staging:
   - `get_position` — verify position reliability, Z within 0…328
   - `get_stored_state` — re-read landmarks, limits, confirm work origin is the intended G54

6. Submit converted program for execution:
   - `submit_gcode_job` {
       "gcode": "<reviewed, converted text unchanged>",
       "name": "thread-m2.5-internal.nc",
       "head_type": "cnc",
       "frame": "work"
     } [APPROVAL] — delivers confirm page with Frame row and machine-resolved Z extents
   - Read confirm page **Frame** row and **machine-resolved Z extents** aloud to operator
   - Deliver confirm URL as the LAST LINE of message; END THE TURN

7. [After confirm URL delivered and turn ended] Background approval wait:
   - `start_gcode_job` {"job_id": "<id>", "wait_for_approval_ms": 110000}

8. [After job approval] Poll job to completion:
   - `get_gcode_job_status` {"job_id": "<id>", "wait_ms": 110000, "since_event": 0}
   - Monitor and report `ending.kind` (completed | stopped-by-operator | crash-alarm | overtravel-alarm | machine-stopped | …)

9. Post-job:
   - `get_position` — verify final position and Z height
   - Operator inspects part with thread gauge or tactile verification
   - Report thread fit status

## Readiness

### Conversion declarations

**`tool_center_path: true`** — can be declared now based on source header "CUTTER COMPENSATION D=0 - TOOLPATH FOR TOOL CENTER" ✓

**`tool_length_applied: true`** — can be declared NOW only if:
- Operator confirms (in answer to question 4) that work origin Z0 was established with the tool that will cut the thread AND the thread mill cutter is currently fitted, OR
- Operator confirms the origin was established with the probe and the thread mill cutter will be fitted via Flow A tool change in step 4 (the origin remains valid because tool setter measures the transfer)

If work origin Z0 was established with the probe (common), and the cutter is not yet fitted: tool-change flow A must complete and measure the cutter before `tool_length_applied: true` is valid for submitting the conversion result. ✓

### Submission preconditions

Before `submit_gcode_job` in step 6:
- Connection reliable and position verified (law 6: staging requires a current `get_position` result)
- Work origin selected/active and matches the G54 declared in the converted file (live `originOffset` from heartbeat)
- Fitted tool is the thread mill cutter, NOT the probe (thread-milling skill: "The touch probe cannot stay in the spindle for cutting")
- All conversion warnings reviewed against bore/cutter dimensions
- Operator confirms go/no-go on the staged program (confirm page click authorises the motion)

## Counts

| Category | Count | Notes |
|---|---|---|
| Connection state reads (`get_position`, `get_stored_state`) | 1 + 1 | preflight (step 1); repeat before submit (step 5) |
| Offline conversion calls | 1 | step 2; no connection, no motion |
| Tool changes (if probe fitted) | 1 complete flow | 4 tool-setter/park/offset steps + 4 approvals |
| Program validations | 1 | step 3 |
| Staged jobs | 1 | step 6: submit_gcode_job + confirm page |
| Job poll | 1 | step 8: get_gcode_job_status |
| **Logical approvals (operator clicks)** | **1 + 4 (if tool change) OR 1 (if cutter fitted)** | min 1 (program submit), max 5 (tool change + program) |
| **Literal [APPROVAL] tags** | **1 submit + 4 tool-change (if needed) + 1 wait** | tool-setter runs × 2 + park + offset + submit = 5; `start_gcode_job` on confirm after submit = 1 wait-in-background |
| **Operator waits** | **2** | wait after submit confirm page (turn ends); wait after job approval for job to complete |
| **Questions needing answers** | **5** (spindle head, cutter dimensions, hole clearance, work origin history, fitted tool status) | batch in one message before any motion |

Repeat: if questions reveal that the work origin was not established with the fitted tool, or the cutter is not ready, the plan may add tool-change steps and restart counts.
