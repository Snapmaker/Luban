# Plan: Generate and run M4x0.7 thread-milling G-code on the A350

## Findings before anything moves

- **Single-tooth cutter vs reference.** The M2.5 reference used a triple-tooth (multi-flute) 1.38 mm cutter; the M4 is single-thread (one axial form). Single-tooth cutters have different chip loads and cutting dynamics — Machining Doctor will size speeds/feeds, but the generated output may have less aggressive axial feed rates.
- **Core hole is ready.** The 3.3 mm drilled hole is the prepared core for M4×0.7 threads (0.7 mm pitch, 8 mm depth); no probing or adjustment needed before milling starts.
- **Machining Doctor is offline software.** The operator must run Machining Doctor separately to generate the Fanuc G-code; the MCP tools do not generate thread mills. The converter (`convert_thread_milling_gcode`) will transform the output.
- **M4 cutter geometry unknown.** Exact cutting diameter, cutting-edge length and mass differ from M2.5; these are needed to validate the Machining Doctor setup and post-processor parameters.
- **Work origin Z reference unclear.** Thread depth is "8 mm" — depth from what? (stock top, work origin, or some other datum?) Machining Doctor needs absolute Z datums and the work origin must be set consistently with the chosen reference.
- **No tool change scope.** If the M4 cutter is already in the spindle, this is one approval (the thread-milling job itself). If it needs to be swapped from a different tool, tool-change adds four approvals (measure old, park, measure new, apply offset).

## Questions for the operator (one message)

1. Is the M4×0.7×D4×50L single-thread cutter **already in the spindle**, or does it need to be changed from what is currently fitted?
2. What is the **actual cutting diameter** of this cutter (in mm)? The "D4" marking usually means the body diameter; the thread form itself is what cuts, and generators need the real geometry.
3. What is the **axial length of the cutting-edge portion** (the threaded/fluted part that cuts)? The "50L" is the overall length. The 1.38 mm M2.5 cutter had 7.5 mm of cutting length; is the M4 similar?
4. Do you have a **standard CNC head (power % spindle mode)** or the **200 W CNC head (RPM mode)**? The Machining Doctor output will likely be in RPM; the converter needs to know which mode to use.
5. For **Machining Doctor generator settings**: are you planning right-hand thread, internal thread (in the drilled hole), and climb milling?
6. Has the **work origin Z been set** for this aluminum block? If so, what is the reference? (e.g., stock top, a fixed plane, or re-touching the block with the M4 cutter first?)

## Steps

1. **Pause for answers.** The entire procedure branches on tool change (yes/no) and cutter parameters, which are needed for the Machining Doctor inputs. 
   [WAIT for answers to all six questions above]

   -- end turn --

2. (After receiving answers) **If tool change is needed**: Run the four-step tool-change procedure from the `tool-change` skill (flow A):
   - `run_tool_setter` with the old tool's `bit_length_mm`
   - `goto_tool_change_position`
   - [Operator swaps the cutter by hand]
   - `run_tool_setter` with the new (M4) tool's `bit_length_mm`
   - `apply_tool_length_offset` to shift the work origin

   (Each of the four is one `APPROVAL` + one `start_gcode_job` call.)

   [APPROVAL] × 4 approvals if tool change is needed; skip this entire step if the M4 is already fitted.

   -- end turn --

3. (After tool change completes, or immediately if no change needed) **Guide the operator through Machining Doctor setup.**

   Settings to configure:
   - **Thread type:** Internal (for the drilled hole)
   - **Major diameter:** 4.0 mm
   - **Pitch:** 0.7 mm (metric)
   - **Thread length:** 8 mm
   - **Handedness:** Right-hand (RH)
   - **Climb/conventional:** Climb (recommended for aluminum)
   - **Cutter diameter:** [from answer to question 2]
   - **Cutter cutting length:** [from answer to question 3]
   - **Cutter form:** Single tooth (already confirmed)
   - **Material & feeds:** Aluminum with feeds Machining Doctor suggests (operator adjusts if needed)

   Output selection:
   - **Controller:** Fanuc (matches the M2.5 fixture and the converter default)
   - **Tool center path:** Yes (D=0 compensation)
   - **Spindle:** RPM (preserve the source RPM; the converter will map it to the right spindle mode based on head type)

   Operator generates the G-code and copies/saves it.

   [WAIT for Machining Doctor output G-code]

   -- end turn --

4. **Validate the generated G-code.**

   `validate_gcode {"gcode": "<complete G-code from Machining Doctor>"}`

   Read the operator: the validation frame (extents, Z range, spindle state). Warnings are informational at this stage. Forward any suspicious findings but do not block.

   [No approval; read-only call]

5. **Convert to Snapmaker format.**

   `convert_thread_milling_gcode {`
   &nbsp;&nbsp;`"gcode": "<same complete G-code>",`
   &nbsp;&nbsp;`"source_controller": "fanuc",`
   &nbsp;&nbsp;`"tool_center_path": true,`
   &nbsp;&nbsp;`"tool_length_applied": true,`
   &nbsp;&nbsp;`"spindle_mode": "cnc_200w_rpm" <— or "power_percent" based on answer to question 4>,`
   &nbsp;&nbsp;`"spindle_power_percent": <percent if power_percent mode, omit if RPM mode>,`
   &nbsp;&nbsp;`"chord_tolerance_mm": 0.002`
   `}`

   Read the operator: returned `gcode`, `changes` (M03/M05 kept, G43/H removed, etc.), `warnings`, `sourceSpindleRpm`. Confirm the spindle RPM is in the 8000–18000 range (firmware clamp for 200W CNC).

   [No approval; read-only call]

   -- end turn --

6. **Stage the milling job.**

   `submit_gcode_job {`
   &nbsp;&nbsp;`"gcode": "<converted G-code from step 5>",`
   &nbsp;&nbsp;`"name": "M4x0.7 thread mill, 8mm depth",`
   &nbsp;&nbsp;`"frame": "work"`
   `}`

   Read the operator: **Frame** (WORK, declared by argument) and **machine-resolved Z extents** (the converted program operates in work coordinates; the MCP shows the actual Z range the machine will traverse). Deliver the confirm URL as the last line of your message.

   [APPROVAL] × 1 approval

   -- end turn --

7. **Start and monitor the job.**

   `start_gcode_job {"job_id": "<id from step 6>", "wait_for_approval_ms": 110000}`

   The operator clicks the confirm page; the spindle starts, the tool mills the threads. Long-poll `get_gcode_job_status` if the job runs longer than the wait window.

   [WAIT for operator click + job completion]

   -- end turn --

8. **Verify completion.**

   `get_gcode_job_status {"job_id": "<id>"}` to read the `ending.kind` (should be `completed`). If the job succeeded, the M4×0.7 threads are cut 8 mm deep in the aluminum hole.

   Optional: **Measure the thread** with a probe sequence or by hand to verify pitch and depth match the generator's spec.

## Counts

- **Approvals:** 1 (the milling job submit) + 4 if tool change needed = 1 or 5 total
- **Operator waits:** 2 (tool change if needed, Machining Doctor G-code generation, job run)
- **Questions:** 6
