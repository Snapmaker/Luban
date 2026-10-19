# Plan: Siemens D thread export (D=0.12, S7958) cannot be converted today. Regenerate it, identify the head, re-establish tool-tip Z, then convert. Nothing gets staged.

## Findings before anything moves
- **Scope.** The operator asked to convert, and said "do not stage anything". Conversion is offline and grants no motion authority (cnc-thread-milling SKILL, intro). This turn uses read-only calls only. No `submit_gcode_job`, tool-setter run, park, origin write or Z move is staged.
- **The "flags" are statements of fact, not switches.** `tool_center_path: true` and `tool_length_applied: true` are declarations the importer relies on (import.md, "Required declarations"). The skill says not to assert one "merely to obtain a preview" (SKILL, Import step 1). At the moment both would be false.
- **D=0.12 is nonzero cutter compensation, so `tool_center_path: true` would be false.** The declaration means the path is already offset by the cutter radius and the D value is zero. Nonzero radius or wear compensation is not implemented, and known nonzero headers are rejected even when the zero-compensation declaration is made (thread-milling.md, option table "Nonzero controller compensation"). The fix is to regenerate in Machining Doctor with D=0 (tool-centre path) and the measured cutting OD. The centre/peripheral toggle is not evidence that compensation was applied. `D1` as a register selector would be fine, but a 0.12 value is not.
- **S7958 is below the 200 W RPM floor.** `cnc_200w_rpm` accepts only 8000–18000 and refuses rather than clamping. The skill rules out the operator's proposed route: an RPM refusal calls for revisiting the cutting conditions, "not silently clamping RPM or switching to percentage mode to bypass the limit" (import.md). The converter keeps the source feeds and never rescales them. Those feeds were computed for 7958 RPM, so a percentage chosen to get past the refusal leaves chip load undefined.
- **`power_percent` is legitimate only if the standard CNC head is physically fitted.** In that case the operator chooses an integer 1–100 percentage, and the feeds must suit the spindle speed that percentage actually gives. Mapping 7958 RPM to a percentage is not a calibration (import.md; thread-milling.md "Usage").
- **The fitted head is unknown.** `connectedHead` is null. `toolHeads` lists compatible heads, not the fitted one. `headType: cnc` and `machineSettings` do not settle it either. The rule for a null identity is to ask (setup.md, "Generator input checklist"). Spindle mode is therefore undetermined, and so is the correct regeneration target (RPM of 8000 or more, or a percentage).
- **The touch probe is fitted and the tool that set work Z is unknown, so `tool_length_applied: true` would be false.** The probe cannot stay in for cutting. `originOffset` does not record which tool set Z0. With the history unknown, measuring an old/new setter pair cannot repair it; the operator must re-establish the reference first (tool-change SKILL, "The sequence (flow A)"; work-datums.md).
- **Stored probe length is calibration, not a setter reading.** The stored `effectiveLength` 71.3 cannot be combined with the setter height to make an `old_trigger_z` (tool-change SKILL step 1). Tool-setter history must be read (`get_tool_setter_config`) before any reuse is claimed.
- **Controller dialect.** Use `source_controller: "siemens_d"` because it is the generator's actual selection, not trial and error. The generator page duplicates the Siemens C-Type label and the `sd` value produces D-Type, so confirm the export came from that entry. Under the declarations, the Siemens H on G0 is removed but the move is kept. G40/G41/G42 and D selectors are removed only under a true zero-compensation declaration.
- **"External" is read as an external thread (boss).** That means a boss review: diameter, centre, height, shoulder or undercut, and space for the cutter, neck, shank and holder around the whole boss including clamps. An internal-bore clearance plan does not apply here (SKILL, "Choose the feature review"). Converter bounds are tool-centre bounds, not the swept holder envelope.
- **The source text is not in hand.** I have the header values only. The converter needs the complete regenerated export, and the original is kept separately.
- **The route will need review later.** The output emits G54, and conversion adds no approach. The first XY move before the source's first Z runs at whatever the actual Z is. It must satisfy the Z320 motion floor and the rotary landmark's `requiredToolheadZ` for the whole segment, with the new tool's length (motion-rules §0 items 3–4). The source's work Z20 is not park height.

## Questions for the operator (one message)
1. **Which CNC head is physically fitted: the standard head or the 200 W head?** The profile reports `connectedHead: null`, so I cannot tell.
2. **Please regenerate the export in Machining Doctor and paste the complete text.** Keep the original. Settings:
   - Controller: Siemens D-Type (`sd`).
   - Compensation: D=0, tool-centre path.
   - Cutter diameter: the measured cutting OD, not neck or shank.
   - Explicit units.
   - The feature's XYZ datum in the existing work frame.
   - Spindle: for the 200 W head, 8000–18000 RPM with feeds recalculated for that speed. For the standard head, tell me the power percentage you choose, with feeds that suit it.

   Also give me the cutter's cutting OD, neck, shank, usable reach, axial forms and flutes, and its protrusion from the collet.
3. **Do you know which tool set the current work Z0, and how X/Y were established?** If not, how do you want to re-establish the reference?
   - (a) With the probe still fitted: re-measure Z on a retained, accessible datum surface (name it and its machine XY), register it with `set_workspace_origin`, then MCP tool change flow A to the cutter.
   - (b) Swap to the cutter and touch it off yourself on the touchscreen or in Luban.

   If (a), also give the probe's approximate protrusion.
4. **Please confirm this is an external thread on a boss.** Give the boss diameter, height, centre in the work frame, and the shoulder, undercut and clamp clearance around it.

## Steps
1. `get_connection_status {}`: expect a connected A350 CNC.
2. `get_position {}`: quote `reliability`, `isHomed`, `machineStatus`, `warnings` and `originOffset` (fixture: verified, homed, idle, machine X-19 Y342 Z328, warnings empty).
3. `get_stored_state {}`: quote `geometry.probe.effectiveLength` (71.3, calibration), `limits` (floor Z320, park Z328), and the rotary landmark's `requiredToolheadZ` and box.
4. `get_machine_profile {}`: quote `connectedHead` (null) and `toolHeads` (compatible list only).
5. `get_tool_setter_config {}`: read `measurements.last`/`previous`. No reuse is claimed unless they are this tool, this session.
6. Send the reply. Refuse the "set flags and switch to power mode" route and give the reasons from Findings. Ask Questions 1–4 in one message. No conversion call, because both declarations would be false. [WAIT]
-- end turn --
Everything below is conditional. Steps 7–14 run only when the operator later asks for them explicitly, because they stage. The operator's "do not stage anything" stands until then.

7. Branch (a), re-reference with the probe fitted:
   `probe_program {"name": "re-reference work Z on <datum>", "reason": "tool that set Z0 unknown; re-establish with probe", "ops": [{"id": "find", "kind": "sequence", "steps": [{"kind": "hop", "x": <operator datum X machine>, "y": <operator datum Y machine>}, {"kind": "probe", "name": "top", "dz": -1, "max_travel_mm": <bounded by the stated datum>, "on_miss": "abort"}]}]}` [APPROVAL]
   Deliver `confirm_url` as the last line and end the turn, then run `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background.
8. Branch (a): `set_workspace_origin {"workspace": "G54", "origin_machine": {"x": <verified existing X>, "y": <verified existing Y>, "z": <find.top.z toolhead Z at contact>}, "datum_reference": "probe contact on <datum>, probe fitted, B<angle>, 2026-09-27", "reason": "..."}` [APPROVAL]. Afterwards, re-read `get_position` and check an independent reference.
9. Flow A, outgoing probe: `run_tool_setter {"bit_length_mm": <probe protrusion, declared low>, "accept_probe_contact": true, "reason": "flow A old tool = touch probe"}` [APPROVAL]
10. `goto_tool_change_position {"reason": "flow A park for swap"}` [APPROVAL]. The operator swaps to the thread mill and gives the word. [WAIT]
11. `run_tool_setter {"bit_length_mm": <cutter protrusion>, "reason": "flow A new tool = thread mill"}` [APPROVAL]
12. `apply_tool_length_offset {"reason": "flow A probe -> thread mill"}` [APPROVAL]. Then `get_position`: `originOffset.z` must have changed by new − old, and the operator sanity-checks the work Z.

    Branch (b) replaces steps 7–12: the operator touches off with the cutter and states that it is done [WAIT]. Then re-read `get_position`.
13. Convert offline. This is not staging:
    `convert_thread_milling_gcode {"gcode": "<complete regenerated Siemens D export>", "source_controller": "siemens_d", "tool_center_path": true, "tool_length_applied": true, "spindle_mode": "<cnc_200w_rpm if 200 W | power_percent if standard>", "spindle_power_percent": <operator's integer, standard head only>, "chord_tolerance_mm": 0.002}`
    Then:
    - Review `changes`, `warnings`, `sourceSpindleRpm`, the counts and `validation`.
    - Compare against the boss: radii, pitch per turn, direction with signed Z, deepest point versus the shoulder, entry and exit, retract.
    - Run `validate_gcode {"gcode": "<converted text>"}`.
14. Only on a later explicit execution request: fresh `get_position` and `get_stored_state`, then a route check against Z320 and the rotary landmark. Then `submit_gcode_job {"gcode": "<converted text, unchanged>", "name": "external-thread-siemens-d.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]. Read the Frame row and machine-resolved Z extents, deliver the link and end the turn.

## Readiness
- **Conversion declarations:** neither can be declared truthfully now.
  - `tool_center_path` needs a regenerated export with D=0 and a tool-centre path built on the measured cutting OD.
  - `tool_length_applied` needs work Z referenced to the fitted thread mill's tip. That means the probe out, the cutter in, and a known reference chain: re-established with the probe and transferred by flow A (setter pair from this connection), or a cutter touch-off by the operator.
  - Spindle mode needs the fitted head identified. If the head is 200 W, the source needs 8000 RPM or more. If it is standard, it needs an operator-chosen percentage with matching feeds.
- **Submission:** everything above must hold, and:
  - the converted text is reviewed against the boss and validated;
  - position is fresh (verified, homed, idle, warnings empty);
  - the live selected workspace is confirmed as the intended G54;
  - the initial XY segment is clear of the Z320 floor and the rotary landmark's `requiredToolheadZ` with the new tool;
  - clamp and holder clearance around the boss is confirmed;
  - the operator explicitly requests execution, which lifts today's "do not stage".

Counts: logical approvals = 0 for the executed branch (read-only this turn; the operator forbade staging). Later branches: (a) 2 re-reference + 4 flow A + 1 job = 7; (b) 0 MCP + 1 job = 1. Literal [APPROVAL] tags = 7. Operator waits = 1 in the executed branch (the answers); 3 [WAIT] tags in total, including the swap in (a) and the touch-off in (b). Questions = 4.
