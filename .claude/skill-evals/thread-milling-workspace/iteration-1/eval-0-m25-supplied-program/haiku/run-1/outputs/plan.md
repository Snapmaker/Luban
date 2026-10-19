# Plan: Convert and run M2.5 thread-milling program on A350 CNC

## Findings before anything moves

- **FANUC program spindle speed out of range**: The Machining Doctor output specifies S17991 RPM, which exceeds the 200W CNC's maximum of 18000 RPM. The `convert_thread_milling_gcode` tool in "cnc_200w_rpm" mode will REJECT this program with a validation error. The tool requires spindle speed in the range 8000–18000.
- **Cutter neck vs thread length trade-off**: The cutter has a 1.38 mm neck and 7.5 mm total length. The thread is 5 mm deep, which fits within the 7.5 mm available. However, the neck clearance to the aluminum plate surface is thin (7.5 mm body − 5 mm thread depth = 2.5 mm). Verify the cutter does not jam in the hole.
- **Work origin must be at the hole**: The program is in work frame (G54 declared). The operator must have set the work origin already at (or will set it at) the hole location on the aluminum plate before running.
- **Hole pre-drilled correctly**: The hole is stated as 2.05 mm diameter, 6 mm deep. The M2.5 internal thread requires a pilot hole; 2.05 mm nominal pilot for M2.5×0.45 is correct. Depth (6 mm) exceeds the 5 mm thread length, so plunge is safe.
- **Probe stays in spindle**: The touch probe is currently fitted. It will remain so for all motion planning (no tool change required for thread milling).
- **Three-pass helical milling**: The FANUC file contains three identical passes of the thread-milling helix, each with approach, cutting (three arcs: entry, full turn, exit), and retract. The converter will preserve this as a segmented G1 program.

## Questions for the operator (one message)

1. **Spindle speed approval**: The Machining Doctor program specifies 17991 RPM, which is 1991 RPM above the A350's 200W CNC maximum of 18000 RPM. The conversion tool will reject this as out-of-specification. Two options:
   - **Option A**: Regenerate the program in Machining Doctor with a target spindle speed of **18000 RPM or lower** (e.g., 17000 RPM, or re-choose the material/tool to get a lower speed), then provide the new file for conversion.
   - **Option B**: Accept a speed reduction: I can adjust the expected RPM to 18000 in the conversion, which reduces cutting speed but keeps the feed rates and geometery intact. The thread will still cut; it will just run slower. Which do you prefer?

2. **Work origin**: Have you already set the work origin (via the touchscreen or Luban) at the hole location on the aluminum plate? Or shall we do that as the first step?

3. **Cutter confirmation**: The cutter is M2.5×0.45×D4, with a 1.38 mm neck and ~7.5 mm total protrusion. It is currently in the spindle, fitted. Is that correct?

4. **Stock/clamp check**: Are the XY clamps clear of the plate's edges and the bed around the hole? The program runs at the hole with small XY excursions (~0.3 mm around center); no large traverses.

## Steps

**Step 0: Establish baseline state (preflight checklist)**

Read the machine state without moving anything:
- `get_connection_status` → confirm: connected, A350, CNC module.
- `get_position` → confirm: `reliability: verified` or `heartbeat`, `isHomed: true`, `machineStatus: idle`, Z ≥ 320 (motion floor), no warnings.
- `get_stored_state` → confirm: landmarks (rotary), probe fitted, tool setter configured at (79, 293), `geometry.probe.effectiveLength: 71.3`, Z limits: floor 320, traverse 328.

**Quote the three results to the operator.**

-- end turn --

**Step 1: Ask the operator the four questions above**

Wait for the operator's answers:
1. Spindle speed preference (regenerate with lower RPM, or accept 18000 RPM limit).
2. Work origin set or not.
3. Cutter confirmation.
4. Clamp clearance confirmation.

-- end turn --

**Step 2a: (If operator chooses "regenerate program with lower RPM")**

The operator provides a new FANUC .nc file with spindle speed ≤ 18000 RPM. Skip to Step 3 with that file.

-- end turn --

**Step 2b: (If operator chooses "accept 18000 RPM")**

Proceed to Step 3, understanding that the thread-milling will run at the capped spindle speed.

-- end turn --

**Step 3: Set work origin (if not already set)**

If the operator says the work origin is NOT yet set at the hole:
- `traverse_xy {x: <hole_x>, y: <hole_y>, coordinate_system: "machine", reason: "move to the hole on the aluminum plate"}` [APPROVAL]
- `start_gcode_job {job_id, wait_for_approval_ms: 110000}`

Then the operator performs the touchscreen work-origin capture at the hole, or you call a touch-probe find at the hole location (a single `probe_point` downward to find the top of the hole, then `set_landmark` or the operator re-zeros work Z). For simplicity on a dry run, assume the operator sets work origin via touchscreen.

If the operator says the work origin IS already set, skip this step and proceed to Step 4.

-- end turn --

**Step 4: Validate and convert the FANUC program**

Call `validate_gcode {gcode: <entire FANUC file text>}` with the supplied program. This is a read-only check; nothing moves.

Review the validation output:
- Expect a **warning** about spindle speed being out of range (17991 > 18000) if conversion will be attempted.
- Expect no Z-out-of-bounds warnings (Z moves are Z−5.056 to Z+20, valid in work frame).

-- end turn --

**Step 5: Convert the FANUC thread-milling program**

Call `convert_thread_milling_gcode`:

```json
{
  "gcode": "<entire FANUC file text>",
  "source_controller": "fanuc",
  "tool_center_path": true,
  "tool_length_applied": true,
  "spindle_mode": "cnc_200w_rpm",
  "chord_tolerance_mm": 0.002
}
```

**Expected outcome on spindle overspeed**: The tool WILL REFUSE this call with a validation error stating that the spindle speed (17991 RPM) exceeds the firmware limit (18000). If this happens, **the conversion cannot proceed with the current file**. Return to Step 1 and ask the operator to regenerate the program with S18000 or lower, or offer Option B: I adjust the expected upper bound to 18000 and the conversion should accept it.

**If regenerated program provided (Option A)**: The call returns:
- `gcode`: the converted program (arcs → G1 segments at 0.002 mm chord tolerance).
- `changes`: list of transformations (M06 T1 removed, G43 H1 handled, compensation D removed, etc.).
- `warnings`: any non-fatal notices (e.g., "coolant M7/M8 removed").
- `sourceSpindleRpm`: 17991 (or the new value if re-generated).
- `validation`: full bounds check on the converted program.

Review `validation` extents (machine-resolved Z range, XY envelope). The program should show:
- Machine Z: work Z−5.056 (relative) → machine Z = work_origin_z − 5.056 (the thread depth).
- Machine Z retract: work Z+20 → machine Z = work_origin_z + 20 (clearing move, away from stock).
- XY extents: ±0.3 mm around the hole (small envelope, rotary-safe if hole is far from the rotary axis).

-- end turn --

**Step 6: Validate the converted program**

Call `validate_gcode {gcode: <converted program text>}`. This is a final sanity check.

Review the result:
- `frame`: should infer "work" (G54 is declared in the output).
- `warnings`: should be minimal (converted arcs as segments are normal, no motion hazards).
- Z extents in both work and machine frames.

Quote the validation result to the operator.

-- end turn --

**Step 7: Stage the thread-milling job**

Call `submit_gcode_job {gcode: <converted program text>, name: "M2.5-thread-milling", frame: "work"}`.

Returns a `confirm_url` and job details. The confirm page will display:
- **Frame**: WORK (declared by argument, resolved against the operator's work origin).
- **Machine Z extents**: the lowest and highest Z the head will reach in machine coordinates.
- **Program summary**: three passes of the helix.

Quote the **Frame** row and **machine Z extents** to the operator, then deliver the confirm URL as the last line of your message, alone.

-- end turn --

**Step 8: Wait for the operator's approval**

Either:
- The operator clicks the confirm page link (the MCP returns `approved: true`), or
- The operator pastes the `confirm_token` code from the page.

Call `start_gcode_job {job_id: "<id from submit result>", wait_for_approval_ms: 110000}`.

If `approved: true` comes back, the job has started. Proceed to Step 9.

If `approved: false, timed_out: true`, call `start_gcode_job` again (the operator just has not clicked yet).

-- end turn --

**Step 9: Monitor the thread-milling job**

Call `get_gcode_job_status {job_id: "<id>", wait_ms: 110000, since_event: 0}` to wait for the job to complete or fail.

Expect `ending.kind` to be one of:
- `completed`: thread milling finished successfully. Report the final Z position and job duration from `result.timing`.
- `stopped-by-operator`: the operator pressed Stop on the Workspace page (intentional abort).
- `crash-alarm` or `unexpected-contact`: the touch probe (still in spindle) tripped during the cutter motion. This is a fault; report it and wait for the operator to clear the alarm via `clear_overtravel_alarm` if needed.
- Other failure: report the ending reason and the partial result if any.

Quote the ending summary to the operator.

-- end turn --

**Step 10: Post-run verification (if successful)**

If the job completed:
- `get_position` to verify the final toolhead Z and XY are safe (should be at work Z+20, retracted).
- Visually check the thread in the hole (with calipers or thread plug if available, outside MCP scope).
- Report success with the tool, spindle speed achieved, and any notes on cut quality.

-- end turn --

## Counts

- **Approvals**: 3
  1. Step 3 (optional traverse to hole for origin setting).
  2. Step 7 (submit thread-milling job, confirm page).
  3. Step 9 (start job after approval).
- **Operator waits**: 4
  1. After Step 0 baseline read: operator reviews state.
  2. After Step 1: operator answers four questions.
  3. After Step 7: operator clicks confirm page (or pastes code).
  4. After Step 9: job runs, operator monitors or waits for completion.
- **Questions**: 4
  1. Spindle speed preference (regenerate or accept 18000 RPM cap).
  2. Work origin already set?
  3. Cutter M2.5 currently fitted?
  4. Clamp clearance verified?
