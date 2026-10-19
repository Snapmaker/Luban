# Plan: Convert and execute two external thread-milling bosses with common corner datum

## Findings before anything moves

- **Two Okuma exports, separate per-boss datums:** The supplied programs are Okuma dialect exports, each with its own feature center (20,15) and (70,15) but sharing a common corner reference origin. Both must be submitted separately; concatenation or hand-joining is not supported and would lose the defined datum relationships.
- **Standard CNC head requires explicit power percent:** The fitted standard head with 65% power requires `spindle_mode: "power_percent"` with `spindle_power_percent: 65` (integer 1–100). The converter accepts RPM source programs and replaces spindle speed with the stated percentage. Feeds remain as programmed (converted mm/min if source was inch).
- **Tool center path and tool length already applied:** Both Okuma programs declare D-compensation zero (tool centre path) and work Z referenced to the fitted tool tip. The required declarations `tool_center_path: true` and `tool_length_applied: true` hold for both.
- **One work origin (G54) serves both bosses:** The common corner datum establishes a single measured WCS. Both feature centres (20,15) and (70,15) are work-frame coordinates in that same G54. No workspace switching or re-zeroing is needed between jobs.
- **Cutter confirmed for both features:** Verified geometry and the same fitted tool handle both external threads — no tool change flow required.
- **Each job is one operator approval:** Converting offline does not require approval. Validating and submitting each converted program stages one gcode job (one click per program on the confirm page).

## Questions for the operator

1. **Feature order and retraction between jobs:** After the first boss is cut and the job completes, should the head remain at the finished position (work XY for that boss, work Z20 retract), or should we explicitly traverse to a neutral position before starting the second job? The converted program's final retract is the source's work Z20; the actual machine position at completion depends on the source's last coordinate in its work frame.
2. **Inspection between jobs:** Do you want to inspect or measure the first thread before cutting the second, or proceed continuously if both jobs are ready?
3. **Position and landmark verification:** Before staging any motion, should we confirm the current homed position, verify the work origin offset on the controller, and check for any landmarks that might affect the X-Y transits between (20,15) and (70,15)?

No other information is missing — the setup, cutter, head, power setting and frame are specified.

## Steps

1. **Verify connection and position** (read-only preflight)
   - Operator: confirm the machine is homed and idle, connected over Wi-Fi
   - Call `get_position`: expect reliability `verified` or `heartbeat`, machine X−19 Y342 Z328 (park height), isHomed `true`, warnings empty
   - Call `get_stored_state`: confirm probe effectiveLength 71.3 mm, motion floor Z320, park Z328, work origin offset exists for the common corner datum, no landmarks blocking the (20,15)↔(70,15) transit

   `-- end turn --`

2. **Prepare and review the first converted program** (offline, no tool calls needed)
   - Preserve the complete first Okuma export separately (before any conversion)
   - Arguments for `convert_thread_milling_gcode`:
     ```json
     {
       "gcode": "<complete first Okuma export text>",
       "source_controller": "okuma",
       "tool_center_path": true,
       "tool_length_applied": true,
       "spindle_mode": "power_percent",
       "spindle_power_percent": 65,
       "chord_tolerance_mm": 0.002
     }
     ```
   - Review the returned `gcode`, `changes`, `warnings`, `sourceSpindleRpm`, segment counts and `validation`
   - Compare source and result:
     - Okuma G15 H1 mapped to G54; G56/H removed ✓
     - No tool change, only removal of length lookup ✓
     - Arc/helix count: verify against source
     - Deepest cut position vs boss geometry and clearances
     - Lead-in, orbit and lead-out paths clear of holder/shank
     - Final rapid returns to source work Z20
   - Note: feature datum is work X20 Y15 (for the first boss); the work frame origin is the common corner reference
   - Chord tolerance 0.002 mm is default; output accuracy is segmentation polygons, not thread profile repair

   `-- end turn --`

3. **Validate the first converted program** (offline, read-only)
   - Call `validate_gcode {"gcode": "<reviewed converted text from step 2>"}` (use the MCP-returned text, not the source)
   - Read `warnings` and `validation.warnings`: spindle state, distance mode, frame declaration, Z extents, motion hazards
   - Confirm frame declaration: the output emits G54 (work frame), not G53 (machine frame)
   - Machine-resolved Z extents (if available): compare against actual stock depth and clearance
   - Any refusals → address in the source program and reconvert (do not edit the converted text)

   `-- end turn --`

4. **Stage the first thread-milling job** [APPROVAL]
   - Call `submit_gcode_job`:
     ```json
     {
       "gcode": "<validated converted text from step 3>",
       "name": "external-thread-boss1-m-x-20-y-15.nc",
       "head_type": "cnc",
       "frame": "work"
     }
     ```
   - Read the confirm page:
     - Frame row: should read `WORK (declared by argument)` with the live G54 offset
     - Machine-resolved Z extents: confirm against stored position, motion floor Z320, park Z328
     - Spindle state: S command present (work speed mapped to 65% for standard head)
   - Deliver the confirm URL as the LAST LINE, in one sentence, then END THE TURN

   `[confirm URL for first job]`

   `-- end turn --`

5. **Operator approves and starts the first job**
   - Operator clicks the confirm page; MCP stages the job
   - Call `start_gcode_job {"job_id": "<id from step 4>", "wait_for_approval_ms": 110000}` (background, no blocking)

   `-- end turn --`

6. **Poll the first job to completion**
   - Call `get_gcode_job_status {"job_id": "<id>", "wait_ms": 25000}` (long-poll, ~25 s per cycle)
   - Repeat until `ending.kind` is returned (e.g. `completed`, `stopped-by-operator`, crash/overtravel, etc.)
   - On `completed`: note the `result.finalZ` and final XY from the program (work frame), then re-read position
   - On any stop/crash: operator recovery → report ending, do not auto-restart

   `-- end turn --`

7. **Confirm position after first job** (read-only check)
   - Call `get_position`: read the actual machine Z and XY after the job finished
   - Compare against expected: the source's last move was rapid work Z20; actual machine Z depends on originOffset
   - Operator: is the machine positioned as expected? Any need to check the first thread or clear obstacles?

   `-- end turn --`

8. **Prepare and review the second converted program** (offline, identical flow to steps 2–3)
   - Preserve the complete second Okuma export separately
   - Arguments for `convert_thread_milling_gcode`:
     ```json
     {
       "gcode": "<complete second Okuma export text>",
       "source_controller": "okuma",
       "tool_center_path": true,
       "tool_length_applied": true,
       "spindle_mode": "power_percent",
       "spindle_power_percent": 65,
       "chord_tolerance_mm": 0.002
     }
     ```
   - Feature datum for the second job is work X70 Y15 (the second boss); same common corner reference frame G54
   - Verify deepest cut, holder clearance around the (70,15) boss and final retract to work Z20
   - Okuma transformations and chord checks identical to first job

   `-- end turn --`

9. **Validate the second converted program** (read-only)
   - Call `validate_gcode {"gcode": "<reviewed converted text from step 8>"}` (second job)
   - Confirm frame, Z extents and no warnings specific to the second boss geometry

   `-- end turn --`

10. **Traverse from first boss to second boss** (if needed before cutting)
    - Query: the first job's work Z20 retract and the second job's first positioning move — do they already satisfy motion floor Z320 and landmarks?
    - If motion floor or landmarks conflict: call `traverse_xy {"x": 70, "y": 15, "coordinate_system": "work", "reason": "Move XY to second boss position at traverse height before descent"}` (stages a separate job)
    - Deliver confirm URL, end turn, operator clicks, start job
    - If already clear: no traverse needed; proceed directly to step 11

    `-- end turn --`

11. **Stage the second thread-milling job** [APPROVAL]
    - Call `submit_gcode_job`:
      ```json
      {
        "gcode": "<validated converted text from step 9>",
        "name": "external-thread-boss2-m-x-70-y-15.nc",
        "head_type": "cnc",
        "frame": "work"
      }
      ```
    - Read the confirm page (Frame, machine Z extents, spindle state)
    - Deliver the confirm URL as the LAST LINE, end the turn

    `[confirm URL for second job]`

    `-- end turn --`

12. **Operator approves and starts the second job**
    - Operator clicks; call `start_gcode_job {"job_id": "<id from step 11>", "wait_for_approval_ms": 110000}` (background)

    `-- end turn --`

13. **Poll the second job to completion**
    - Call `get_gcode_job_status {"job_id": "<id>", "wait_ms": 25000}` (long-poll until `ending.kind`)
    - On `completed`: second thread-milling is done

    `-- end turn --`

14. **Final position and readiness check** (read-only)
    - Call `get_position`: confirm final Z and XY
    - Operator: inspect both threads with an appropriate M×0.7 thread gauge (no probe measurement), verify thread fit and profile

    `-- end turn --`

## Readiness

### Conversion declarations
- **`tool_center_path: true`** — Both Okuma exports state D compensation = 0 (tool centre path); this declaration is truthfully applied to both
- **`tool_length_applied: true`** — The operator confirmed work Z was set with the fitted cutter before the exports were prepared; the common corner datum is measured in the current work frame with this tool; this declaration is truthfully applied to both
- Both declarations may be made immediately (step 2) without any additional motion or measurement

### Submission
Before `submit_gcode_job` (steps 4 and 11):
- Converted text must be validated by `validate_gcode`
- Frame (G54) must be declared in the file or via argument
- Machine-resolved Z extents must be read from the confirm page and reviewed against actual stock, clearance and motion floor
- Head type `"cnc"` with standard head and 65% power is correct
- The operator must approve each job (two clicks total, steps 4 and 11)

### Counts
- Logical approvals (decision points): 2 (one for each job, step 4 and step 11; step 10 traverse is conditional and may add 1 more if landmarks require it = **2 or 3**)
- Literal `[APPROVAL]` tags: **2** (one per submitted gcode job)
- Operator waits: **2** (after each job stages on steps 4 and 11, wait for their click)
- Questions: **3** (step 1.1 order/retraction, step 1.2 inspection between jobs, step 1.3 landmark check)
