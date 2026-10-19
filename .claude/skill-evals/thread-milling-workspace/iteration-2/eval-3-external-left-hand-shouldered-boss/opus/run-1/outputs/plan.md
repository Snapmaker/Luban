# Plan: External M8x1 LH conventional thread, 6 mm, on a prepared shouldered boss — read-only preparation, no export yet, nothing moves

## Findings before anything moves
- The operator said "do not move anything" and there is no export. This turn is read-only calls plus one batch of questions. No `probe_*`, `run_tool_setter`, `goto_*`, `move_z`, `traverse_xy`, `home` or `submit_gcode_job` is staged. `convert_thread_milling_gcode` cannot run because it needs the complete generator text.
- Fixture state: connected A350 CNC over Wi-Fi. Position of record is `verified`, homed, idle, machine X-19 Y342 Z328 (park = home), warnings empty. Motion floor is machine Z320 and park is Z328. Re-read all of it fresh before any later staging (motion-rules §0).
- The touch probe is fitted. It cannot cut (thread-milling SKILL "Stage only when..."), so the cut needs a probe-to-thread-mill swap through `tool-change`. Before that, the datum has to be complete while the probe is still fitted (tool-change "Complete the datum work before removing the probe"; work-datums.md).
- A work origin exists but its tool history is not given. `originOffset` does not say which tool set Z0. So nobody can yet say that work Z references the fitted tool, or which tool is the outgoing reference. Flow A only transfers a Z reference that is already valid. If the history is unknown, the operator re-establishes the reference first (tool-change "The sequence (flow A)").
- Stored probe `effectiveLength` 71.3 is calibration for reading probe contacts. It is NOT a tool-setter reading from this connection, and it must never be used to build `old_trigger_z` (setter surface + 71.3). The outgoing probe is measured live with `accept_probe_contact: true`. Setter measurement history (`get_tool_setter_config → measurements`) must be read before any reuse is claimed. Reuse needs same tool, same session, and the operator confirming nothing moved.
- "D4x50L, triple flute" does not describe the cutter well enough to generate a program. In the evaluated designation D4 is the 4 mm shank and 50L is overall length (setup.md "Keep the dimensions separate"). Neither is:
  - the cutting/thread-form OD (the generator's Cutter Diameter)
  - usable reach or neck diameter
  - effective cutting length
  - collet protrusion (`bit_length_mm`)
  - tooth-to-tip distance

  "Triple flute" is 3 circumferential edges (feeds). It says nothing about single vs multiple axial forms, and nothing about pitch/profile compatibility with 1.0 mm ISO metric 60°. The name carries no pitch, unlike the evaluated `M4x0.7xD4x50L`. No OD or length may be invented.
- External-thread review applies, not an internal one (thread-milling SKILL "Choose the feature review"). The path does not rough out the boss. The boss must already have its measured diameter, centre and top, and M8x1 needs the programmed major diameter/fit (e.g. 6g), not just the nominal "M8".
- The shoulder immediately below the 6 mm thread is the main collision risk. Three things follow:
  - **Tool tip below the lowest pass.** Anything on the cutter below the lowest thread form (tooth-to-tip distance, incomplete end tooth) goes below the deepest thread Z. With no undercut, full thread to the shoulder is geometrically impossible. Either the programmed thread length/Z datum stops short by at least tooth-to-tip + margin, or an undercut/relief exists.
  - **Plunge column.** An external Machining Doctor path descends outside the boss at the radial safety distance and then leads in. If the shoulder's outer radius exceeds (plunge centre radius − cutter radius), that descent column lands on the shoulder face. Shoulder OD against the actual source plunge radius is a hard check once the export exists.
  - **Deepest pass.** LH + conventional sets the helix direction and the sign of Z travel. The shoulder end is then either the lead-in or the lead-out. That is reviewed from the signed Z in the source, never inferred from G2/G3 or altered by mirroring.
- The clamp is nearby but not stated or stored. The only stored landmark is the rotary one. Converter/validator bounds are tool-centre bounds only. They are not swept cutter/neck/shank/collet-nut bounds, and they do not know about the clamp. The operator's clamp statement is a planning obstacle immediately. It is written with `set_landmark` (`obstacle_top_z`) only if they ask. Clearance is needed around the whole orbit (orbit radius + cutter radius + lead-in/out) and for the collet nut at the deepest Z.
- Rotary landmark: read `requiredToolheadZ` from `get_stored_state` and check whole segments against it. That includes the conversion's first `G0 X.. Y..`, which moves XY at whatever Z the head is at before the first Z block. Conversion adds no approach. The route from the tool-change park or setter finish (machine Z328) to the boss XY must clear the rotary landmark and the clamp. Whether the boss is on the bed or on the rotary (and at what B) is unknown.
- Head identity: `connectedHead.toolHead` is withheld. `headType: cnc` and the compatible-head list do not settle it (setup.md). Spindle mode (`cnc_200w_rpm` 8000–18000 RPM kept from the source, or `power_percent` with an operator-chosen integer) must come from the operator. Feeds are never rescaled by the converter.
- The M2.5 internal fixture (`thread-milling-m2_5-fanuc.nc`) is regression evidence only. None of its cutter, radii or Z values carries over to this job.
- Nominal single-form turns: 6 / 1.0 = 6 turns, before generator lead-in/out and whole-turn rounding. A multi-form cutter with enough effective length could cut it in one turn. Which one applies depends on the tool drawing.

## Questions for the operator (one message)
1. **Cutter (from its drawing or a measurement).**
   - Cutting/thread-form OD.
   - Pitch/profile: is it a 1.0 mm ISO 60° form, and is it rated for external threads?
   - Single form or multi-form? If multi, how many axial rows and what effective cutting length?
   - Neck diameter and usable reach.
   - Tooth-to-tip distance: lowest crest to the tip face.
   - Collet protrusion, and collet nut OD.

   Please confirm D4 = shank and 50L = overall length.
2. **Head.** Standard CNC head or 200 W? If standard: what integer spindle power percent do you want? Feeds must be generated for that actual speed.
3. **Boss.**
   - Measured diameter, target major diameter/fit (e.g. 6g) and height above the shoulder.
   - Is the boss top/centre already measured, and in which frame?
   - Is the part on the bed or on the rotary (and at what B)?
   - If the centre/top are not measured: do you want me to plan a touch-probe measurement of them while the probe is still fitted? That would be one approval, later, on your request.
4. **Shoulder.** Outer diameter of the shoulder, or its radial extent past the boss. Is there an undercut/relief groove (width, depth)? If not: do you accept the last ~1–2 threads at the shoulder being incomplete, with the programmed length shortened by the cutter's tooth-to-tip distance plus margin?
5. **Clamp.** Machine XY extents and physical top height of the clamp, and its closest distance to the boss. Should I record it as a landmark (`set_landmark` with `obstacle_top_z`)?
6. **Work origin.**
   - Where is G54 XY zero and Z0 physically (boss centre / boss top / elsewhere)?
   - Which tool set Z0 (the touch probe now fitted?), how (touchscreen, Luban, `set_workspace_origin`), and have there been tool changes since?
7. **Tool-change flow.** A (MCP-managed `apply_tool_length_offset`, you at the computer) or B (touchscreen wizard, you at the machine)?
8. **Generator settings to use, then paste the complete export.**
   - Controller dialect.
   - Material, speed/feed per tooth and entry feed.
   - Radial passes and depth percentages.
   - Output settings: D=0 tool-centre output, explicit G21, precision ≥ 3.
   - XYZ datum = the boss centre and top expressed in the existing G54 frame.
   - Axial/radial safety distances.

   Also confirm "Left hand" + "Conventional" + "External" are selected.

## Steps
1. `get_connection_status {}`: confirm connected, channel.
2. `get_position {}`: `reliability` verified/heartbeat/cached-offset, `warnings`, `isHomed`, `machineStatus`, `originOffset`, selected workspace.
3. `get_stored_state {}`: landmarks with `requiredToolheadZ` (rotary), `landmarkClearances`, `limits` (floor 320 / park 328), `geometry.probe` (effectiveLength, tip diameter), tool-setter config summary, probe feed.
4. `get_machine_profile {}`: read `connectedHead.toolHead`. It is withheld, so it goes into question 2, not an assumption.
5. `get_tool_setter_config {}`: setter centre/reference, tool-change park, `measurements.last` / `previous` (tool, time, session) to decide whether any reuse is possible.
6. `get_probe_feed_status {}`: transport, tool setter and overtravel channels available for a later tool change.
7. Reply to the operator with the read-only findings block and the eight questions above in one message. [WAIT]
-- end turn --
8. Operator action: answers the questions, runs Machining Doctor with the agreed settings, and pastes the complete export (header through M30). Preserve it unchanged. [WAIT]
9. Offline source review, no tool call:
   - Header: EXTERNAL, LH, CONVENTIONAL, M8x1, programmed major, `CUTTER COMPENSATION D=0 - TOOLPATH FOR TOOL CENTER`, Cutter Diameter = the measured cutting OD from answer 1, single/multi-tooth matching the drawing.
   - Units and controller comment.
   - First `G00 X.. Y..` before the Z block.
   - Plunge radius against the shoulder OD (answer 4).
   - Deepest Z + tooth-to-tip against the shoulder face.
   - Signed Z direction, turn count, lead-in/out into free exterior space, final retract.
   - Clamp distance against orbit radius + cutter radius + collet nut.

   If anything conflicts, the generator settings change and the file is re-exported. It is never hand-edited.
10. Conditional, only if the operator asks for it in answer 3, because the boss centre/top are unmeasured. Stage the datum measurement while the probe is fitted. This is a one-approval `probe_program`: a `sequence` with a sensor-gated find of the boss top, then four side marches at a referenced depth above the shoulder, derived centre from `mid`. Stations sit outside the boss and clear of the clamp. All numbers come from answers 3–5, e.g.:
    `probe_program {"name": "M8 boss top and centre", "reason": "datum for external thread", "ops": [{"id": "boss", "kind": "sequence", "steps": [{"kind": "hop", "x": <boss cx>, "y": <boss cy>}, {"kind": "probe", "name": "top", "dz": -1, "max_travel_mm": <bounded by answer 3>, "on_miss": "abort"}, {"kind": "hop", "x": <cx - (r + margin)>, "y": <cy>}, {"kind": "descend", "z": {"from": "boss.top.z", "minus": <depth < thread length>, "between": [<lo>, 328]}}, {"kind": "probe", "name": "west", "dx": 1, "max_travel_mm": <margin + uncertainty>}, "... east / south / north likewise ..."]}]}` [APPROVAL]
    -- end turn --
11. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background after the link is delivered. Then `get_gcode_job_status` to the end, and read the derived centre/top (toolhead Z; physical = Z − 71.3).
12. Conditional. If the Z0 history is broken or the origin is not at the measured boss datum, and the operator asks: `set_workspace_origin {"workspace": "G54", "origin_machine": {"x": <measured cx>, "y": <measured cy>, "z": <boss top contact toolhead Z, probe fitted>}, "datum_reference": "probe_program job <id>, touch probe fitted, B<angle>", "reason": "Re-establish probe-referenced datum at boss centre/top"}` [APPROVAL]. Otherwise keep the existing WCS and put the boss centre in the generator's XYZ datum instead (one WCS preferred).
    -- end turn --
13. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`, then `get_position {}` to verify the new `originOffset`. Check it against an independent accessible reference.
14. Tool change, flow A (if chosen in answer 7), outgoing = touch probe. Skip this measurement only if `measurements.last` is this probe, this session, with nothing moved:
    `run_tool_setter {"bit_length_mm": <probe protrusion, declared low>, "accept_probe_contact": true, "reason": "old tool (touch probe) before thread-mill swap"}` [APPROVAL]
    -- end turn --
15. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`, then check `result.finalZ` = 328 and the spread.
16. `goto_tool_change_position {"reason": "park for thread-mill swap"}` [APPROVAL]
    -- end turn --
17. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` twice (Z up, then XY).
18. Operator action: removes the probe and fits the D4x50L thread mill, then says done and confirms the protrusion. [WAIT]
    -- end turn --
19. `run_tool_setter {"bit_length_mm": <thread-mill protrusion from answer 1, declared low>, "reason": "new tool: M8x1 thread mill"}` [APPROVAL]
    -- end turn --
20. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`.
21. `apply_tool_length_offset {"reason": "transfer probe-referenced work Z to thread mill"}` [APPROVAL]
    -- end turn --
22. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`, then `get_position {}`: `originOffset.z` changed by new − old, and the operator sanity-checks the displayed work Z.
    (Flow B instead: `run_tool_setter {"bit_length_mm": <probe>, "accept_probe_contact": true, "stay_at_trigger": true, "reason": "..."}`, the operator's wizard swap, then `run_tool_setter {"bit_length_mm": <mill>, "stay_at_trigger": true, "start_from_current": true, "reason": "..."}`. That is 2 approvals, with no `apply_tool_length_offset`.)
23. Now both declarations can be true. Convert offline: `convert_thread_milling_gcode {"gcode": "<complete pasted export>", "source_controller": "<dialect from answer 8>", "tool_center_path": true, "tool_length_applied": true, "spindle_mode": "<cnc_200w_rpm | power_percent per answer 2>", "spindle_power_percent": <only if power_percent>}`. Keep `gcode`, `changes`, `warnings`, `sourceSpindleRpm`, arc/segment counts and `validation` together.
24. Compare source against result: units, first positioning, plunge outside the boss, lead-in, 6 turns (or the multi-form turn), signed Z, radial passes, feeds, spindle, deepest point vs shoulder, final retract. Resolve every warning against the external-boss review. Any mismatch means regenerating, not patching.
25. `validate_gcode {"gcode": "<converted text>"}`: read the warnings to the operator.
26. Report the reviewed program to the operator. Staging needs a new explicit request to cut, plus the execution preflight: door shut, extraction on, clamp clear, G54 selected. [WAIT]
    -- end turn --
27. On that request only: fresh `get_connection_status`, `get_position`, `get_stored_state`. Check the segment from the current XY at Z328 to the program's first XY against landmarks and the stated clamp. Then:
    `submit_gcode_job {"gcode": "<reviewed converted text, unchanged>", "name": "M8x1-LH-ext-boss.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]
    Read the confirm page's Frame row and machine-resolved Z extents. Deliver the link as the last line.
    -- end turn --
28. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background. Then `get_gcode_job_status {"job_id": "<id>", "wait_ms": 110000, "since_event": <n>}` to `ending.kind`, then `get_position {}`. The operator checks with an M8x1 LH ring gauge. A stopped job has no retract: recovery is agreed with the operator.

## Readiness
- Conversion declarations: neither can be declared truthfully now.
  - **`tool_center_path`:** needs the actual export showing D=0 tool-centre output with no nonzero-compensation header. The generator's Cutter Diameter must also be the verified cutting OD, not D4 (shank).
  - **`tool_length_applied`:** needs the thread mill fitted, and work Z0 referencing its tip. That means a known-valid Z reference from the outgoing tool (history currently unknown), carried through flow A (live probe measurement with `accept_probe_contact`, live mill measurement, `apply_tool_length_offset`, verified `originOffset.z` change), or through flow B, or through an operator re-reference with the cutter. The touch probe is fitted now, so it is false today.
  - Spindle mode also needs the operator's head identity.
- Submission: no `submit_gcode_job` until all of the following hold.
  1. The operator explicitly asks to cut. The current message forbids motion.
  2. The export is reviewed and converted with true declarations, and validated.
  3. Head/spindle mode is confirmed.
  4. The external-boss review has passed: plunge column clear of the shoulder, deepest tip above the shoulder face (or an undercut confirmed), clamp clear of the swept cutter/neck/collet envelope around the whole orbit, lead-out into free space.
  5. The first-XY segment from the actual position is checked against the rotary landmark's `requiredToolheadZ` and the clamp.
  6. The live G54 is the intended origin and is selected.
  7. Fresh connection, position and stored state.
  8. Door and extraction have been confirmed.

Counts: logical approvals = this turn 0 (read-only). Execution branches:
- Flow A, existing datum valid: 4 tool change + 1 job = 5.
- Flow A with datum measurement and re-registration: 1 probe program + 1 set_workspace_origin + 4 + 1 = 7.
- Flow B: 2 + 1 = 3, or 5 with the datum branch.

Literal [APPROVAL] tags = 7. Operator waits = 4 (answers, export paste, swap, request to cut). Questions = 8.
