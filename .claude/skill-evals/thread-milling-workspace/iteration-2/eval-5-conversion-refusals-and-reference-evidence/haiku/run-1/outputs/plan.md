# Plan: Conversion refusal — cutter compensation, head identity and origin tool unknown

## Findings before anything moves

- **Cutter compensation D=0.12 is unsupported.** The importer requires `tool_center_path: true`, which mandates "D compensation is zero" (import.md). D registers 1 means tooloffset register 1; nonzero 0.12 mm radius wear is unsupported. The export must be regenerated with D=0 from the Machining Doctor generator. Preserving the complete source and re-exporting are the specified path (cnc-thread-milling SKILL.md, step 1).

- **connectedHead is null — head identity cannot be read.** Querying `get_machine_profile` returns `connectedHead: null`. The TOOLS.md states "toolHeads lists compatible heads, not the currently fitted one; generic `headType: "cnc"` alone cannot choose thread-milling spindle mode" (setup.md: "If connected identity is null, ambiguous or disagrees with the operator, ask which head is fitted"). S7958 = 7958 RPM is inside the 200 W head's 8000–18000 range, but also inside permissible percentage mode; the choice cannot be made from the export alone.

- **Work Z tool identity unknown — origin history broken.** The operator states "the tool that established work Z is unknown". `originOffset` on the position report does not identify which tool (probe, old cutter, or specific replacement) set Z0 (tool-change SKILL.md, step 1). This is a precondition for `tool_length_applied: true` because "a setter pair cannot fix an unregistered model or missing X/Y datum" (cnc-thread-milling SKILL.md, Stage section). If origin history is unknown or broken, the operator must re-establish the reference before cutting.

- **Touch probe currently fitted — must swap before cutting.** "The touch probe is fitted" — the work frame and any measured landmarks use the probe's effective length (71.3 mm stored). The cutting tool cannot run with the probe in the spindle; flow A tool change will be needed after conversion approval, measuring the old probe and the new cutter, applying the offset.

## Questions for the operator (one message)

1. Can you confirm which CNC head is currently installed on the A350: **standard head** (100 W, uses percentage-mode spindle commands) or **200 W head** (uses RPM, accepts 8000–18000)?
2. How was the current work Z0 established? Which tool — touch probe, an earlier cutting tool, or a measured reference — was used to set it?
3. The export carries `D=0.12` (0.12 mm tool offset register). Can you regenerate it from Machining Doctor with **D=0** (tool-center path, no compensation)? This is required for the Snapmaker importer.

## Steps

1. (No tool call: determination phase.) Confirm the three questions above in one message. [WAIT]

`-- end turn --`

2. Once the operator confirms the head type, regenerate the export (operator action): open Machining Doctor, set "Output: D=0, tool-centre path" (or equivalent), generate and provide the new complete export. [WAIT]

`-- end turn --`

3. (No tool call: validation phase.) Offline review the new export:
   - Verify first line: no `G41`/`G42`, or `G41`/`G42` followed by `G40` before the first move, or `D` register is absent/zero-only.
   - Compare units, datum, entry point and deepest Z to the previous export.
   - Check that the internal/external thread, pitch, length and radial passes match the intended feature.

4. (No tool call: re-establish work origin.) Before staging conversion, establish and independently verify the milling work origin using [accessible work references](../cnc-motion-rules/references/work-datums.md) if the current Z is unverified. Record the reference method (probe circle, surface-map landmark, or operator-stated Z from a physical gauge). Document which tool or probe was fitted for that measurement. Once verified, note the measured XYZ datum and B context.

5. **`convert_thread_milling_gcode`** (offline import; no connection required) — using the regenerated export and the operator's head-type confirmation:
   ```json
   {
     "gcode": "<complete regenerated export>",
     "source_controller": "siemens_d",
     "tool_center_path": true,
     "tool_length_applied": true,
     "spindle_mode": "<cnc_200w_rpm or power_percent>",
     "spindle_power_percent": <integer 1–100, standard head only>,
     "chord_tolerance_mm": 0.002
   }
   ```
   Pass only ONE of: `cnc_200w_rpm` (200 W head; retains S7958), or `spindle_power_percent: <n>` (standard head; replaces S7958 with P<n>%).

6. Review the returned `gcode`, `changes`, `warnings`, `sourceSpindleRpm`, arc/segment counts and `validation` against the intended thread, deepest point, final retract and cutter envelope. Compare source and result per cnc-thread-milling SKILL.md step 3: units, datum, first positioning, entry/exit, direction, pitch per turn, repeated axial positions, every radial pass, feeds, spindle commands, deepest Z and final retract. [No APPROVAL; offline read-only]

7. Once the converted text is reviewed and confirmed correct, stage the file job:
   - **`validate_gcode`** on the reviewed text (free read-only call).
   - **`submit_gcode_job`** with the converted text (not the original export):
     ```json
     {
       "gcode": "<reviewed converted text>",
       "name": "<descriptive name>",
       "head_type": "cnc",
       "frame": "work"
     }
     ```
   [APPROVAL]

   The confirm page will show Frame: WORK and machine-resolved Z extents. Deliver the confirm URL as the last line of your message and **END THE TURN**.

`-- end turn --`

8. (Background) `start_gcode_job {job_id, wait_for_approval_ms: 110000}` after the operator clicks the confirm page.

## Readiness

### Conversion declarations
- **`tool_center_path: true`** can be declared once the regenerated export has D=0 verified and the importer accepts it without refusal.
- **`tool_length_applied: true`** can be declared once the work origin's establishing tool is confirmed and the origin has been re-verified (or the operator certifies it from earlier work in this session).
  - If the operator re-verifies the origin (probe circle, surface grid, or physical check), document the method and the fitted tool (probe) at that moment.
  - If the origin is unverifiable, it must be re-established via probing before asserting `tool_length_applied: true`.

### Submission
- No `submit_gcode_job` (conversion or file) is staged until the export is regenerated with D=0, the head type is confirmed, and the work Z origin is verified or re-established.
- Before submission, confirm the live work origin in `get_position.originOffset` matches the verified datum and that the fitted tool (the cutting tool, after a tool change if needed) is correctly reflected in the machine profile.

Counts: questions=3, regeneration steps=1, approval points=1 (submit_gcode_job only; conversion is offline read-only), waits=2, conditional branches=1 (head-type determination), tool changes=1 (probe → cutter, required before cutting, counted separately in operator approval flow)
