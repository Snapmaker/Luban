# Plan: Prepare an M8x1 external left-hand thread mill job with full safety review

## Findings before anything moves

1. **Tool designation incomplete.** "D4x50L triple flute" specifies shank (D4 = 4 mm) and overall length (50L = 50 mm), but not the cutting diameter, axial form count, effective cutting length, or reach — all required for safe planning and generator input.

2. **Flute count and axial configuration are independent.** Three flutes (circumferential cutting edges) does not mean three axial thread forms. The tool geometry, reuse in axial repositioning, and effective cutting length must be confirmed separately.

3. **External thread geometry differs fundamentally from internal.** The setup reference distinguishes bore checks (depth, diameter, wall clearance during insertion) from boss checks (height, surrounding space for full exterior orbit, neck/shank clearance, holder clearance, and shoulder/fixture interference). No internal recipe applies here.

4. **No export exists yet.** Conversion cannot begin until the operator provides a complete Machining Doctor program with verified generator inputs. Tool-center-path and tool-length-applied declarations cannot be made until the source is reviewed.

5. **Work origin status unknown.** The operator has not stated whether a work origin is set, whether it is at the boss center, or which tool established work Z. If the origin was set with the probe, the thread mill must be measured on the tool setter and the offset applied before declaring tool_length_applied true.

6. **Shoulder and clamp clearance not quantified.** "Shoulder immediately below" and "clamp nearby" require specific geometry review: Is the shoulder a sharp corner or undercut? What is the gap between the clamp and the boss during the full helical orbit?

## Questions for the operator (one message)

1. What is the **cutting diameter** (thread-form OD, not neck or shank) of the M8x1 thread mill? Provide a measurement or manufacturer datasheet.
2. How many **axial thread forms** does this thread mill have — single continuous helix, or multiple forms requiring axial repositioning?
3. What is the **effective cutting length** (distance from first to last cutting form along the axis)?
4. What is the **reach** of the thread mill (distance from the neck/shank junction to the tool tip)?
5. What are the **prepared boss dimensions** — current OD, and height above the shoulder?
6. Describe the **shoulder geometry**: Is it a sharp corner, or is there an undercut? If undercut, what are the undercut diameter and depth?
7. Where is the **clamp positioned** relative to the boss and its orbit during cutting?
8. What is the **clearance gap** available around the boss exterior for the cutting tool, neck, shank, and holder to orbit freely without collision?
9. Is a **work origin already set**? If yes, how was it established (touch probe, tool setter measurement, operator touch-off) and with which tool fitted?
10. What is the current **fitted tool** in the spindle? Is it the M8x1 thread mill itself, or the touch probe?

## Steps

No motion or staging is performed in this turn. The following sequence describes the required workflow after answers are provided.

1. **Operator provides answers above** — all ten questions must be answered before proceeding

   `-- end turn --`

2. Operator confirms **boss and shoulder geometry** are compatible with the stated tool dimensions, reach, and planned helical path, with no collision risk for the tool neck, shank, holder, or adjacent clamps during the complete orbit and entry/exit

3. Operator generates the **Machining Doctor thread-milling export** with:
   - Thread: **External**, M8×1, pitch 1 mm, thread length 6 mm, **left-hand**, **conventional**
   - Tool: [measured cutting OD], [confirmed axial form count], [measured effective cutting length], [flute count], solid carbide/high-speed steel
   - Cutting conditions: appropriate spindle speed and feed per tooth for the material and cutter
   - Controller: **Fanuc** (or another supported controller; see cnc-motion-rules §7)
   - Units: **Metric** (mm)
   - Cutter compensation: **D=0** (tool-center path required for the declaration below)
   - Output precision: sufficient to avoid arc-endpoint mismatch after conversion (precision 3–5 recommended)
   - XYZ datum: boss center XY, work Z at the level the fitted tool's tip was when the origin was set
   - Safety distances: axial and radial clearance as configured in the generator

   `-- end turn --`

4. Operator pastes the **complete Machining Doctor export** (from `%` to `%` inclusive, with all comments and setup blocks preserved)

   `-- end turn --`

5. **Read and preserve the complete source export separately**

6. **Verify machine preflight** (no motion authority assumed yet):
   - `get_connection_status`: connected A350 CNC over Wi-Fi
   - `get_position`: reliability `verified` or `heartbeat`, not `awaiting-resync` or `stale`; `isHomed` true; `warnings` empty
   - `get_stored_state`: current work origin, probe effective length (for reference), tool setter config, rotary landmark if present
   - `get_machine_profile`: determine fitted head type (standard CNC vs 200 W head) to select spindle mode for conversion

7. Verify **work origin history and current fitted tool**:
   - If work Z was set with the touch probe: measure the outgoing probe on the tool setter with `accept_probe_contact: true`, park to the tool-change position, operator swaps to the M8x1 thread mill, measure the new tool, and apply the offset with `apply_tool_length_offset` — then tool_length_applied can be declared true
   - If work Z was already set with the M8x1 thread mill fitted: confirm this history and that the tool has not been removed; tool_length_applied is true
   - If origin history is unknown or broken: ask the operator to re-establish the reference before proceeding

8. **Offline conversion**: call `convert_thread_milling_gcode` with:
   ```json
   {
     "gcode": "<complete operator-provided source export>",
     "source_controller": "fanuc",
     "tool_center_path": true,
     "tool_length_applied": true,
     "spindle_mode": "cnc_200w_rpm" OR "power_percent" (determined from machine profile and head),
     "spindle_power_percent": <integer 1-100> (only if spindle_mode is "power_percent"),
     "chord_tolerance_mm": 0.002
   }
   ```

9. **Preserve the conversion result**: keep returned `gcode`, `changes`, `warnings`, `sourceSpindleRpm`, `validation` together

10. **Review the conversion against the source** (in write-only mode, no staging):
    - Compare units: source metric → output metric (G21)
    - Compare first positioning moves: initial Z approach and XY before any engagement
    - Verify external helix: entry to the boss surface, each helical pass radius and Z advance, lead-out into free exterior space
    - Confirm direction: left-hand rotation (G2/G3 arcs) preserved correctly; signed Z travel matches conventional (tool descends)
    - Verify every radial pass if multiple
    - Check deepest point (work Z position at maximum depth) against shoulder and fixture clearance — [operator-measured shoulder height]
    - Confirm final retract location and Z height
    - Compare spindle commands: source RPM → converted RPM (for 200 W mode) or power percentage (for standard head)
    - Review all warnings and compare against bore/boss setup

11. **Call `validate_gcode` on the converted text** to check for controller syntax issues

12. **Operator reviews the converted program** and confirms external orbit, entry/exit, shoulder clearance, and all cutting passes are acceptable

    `-- end turn --`

13. **Stage the job for execution** (only when operator requests "go" or "run it"):
    - Call `submit_gcode_job` with:
      ```json
      {
        "gcode": "<reviewed converted program text>",
        "name": "M8x1-external-LH.nc",
        "head_type": "cnc",
        "frame": "work"
      }
      ```
    - Read the confirm page **Frame** row and **machine-resolved Z extents** to the operator
    - Deliver the confirm URL as the **last line of this message**, alone, plainly, in one sentence
    - **End the turn** [APPROVAL]

14. Wait for operator click or pasted confirm code, then call `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background

15. Poll `get_gcode_job_status {"job_id": "<id>"}` to completion and report the ending kind and any tool/material issues

## Readiness

**Conversion declarations:**
- `tool_center_path: true` — Only after verifying the Machining Doctor export header states `D=0` or no cutter compensation.
- `tool_length_applied: true` — Only after confirming with evidence (tool-setter measurement and offset application if coming from the probe, or verified history if already fitted) that work Z was set with the M8x1 thread mill currently in the spindle, not the probe or another tool.

**Submission readiness (before any `submit_gcode_job` staging):**
1. Machine connection verified: `get_connection_status` shows connected.
2. Position reliable: `get_position` reliability is `verified` or `heartbeat`, `isHomed` true, `warnings` empty.
3. Head identity confirmed from `get_machine_profile` to select the correct spindle mode for the conversion.
4. Work origin established and tool history traced:
   - If origin was set with probe: probe measured and offset applied; M8x1 thread mill now fitted.
   - If origin was set with M8x1: confirmed thread mill still fitted and unmoved.
   - If origin history unknown: stopped, not proceeded.
5. Conversion successful: `gcode`, `changes`, `warnings`, `validation` reviewed.
6. External geometry validated: tool orbit, entry, every radial pass, deepest cut point, shoulder and clamp clearance all confirmed against operator-measured boss dimensions.
7. Operator authority: explicit request to run the job, no ambiguous phrasing or conditional language.

**Counts:**
- Logical approvals: **0** in this planning-only turn (no motion authority requested); later execution flow = 1 (tool change if needed) + 1 (job submission) = **up to 2 if probe swap required, or 1 if thread mill already fitted**
- Literal [APPROVAL] tags in this turn: **0** (no staging)
- Operator waits: **0** in this turn (awaiting answers and G-code export)
- Questions: **10** (batched into one message)
