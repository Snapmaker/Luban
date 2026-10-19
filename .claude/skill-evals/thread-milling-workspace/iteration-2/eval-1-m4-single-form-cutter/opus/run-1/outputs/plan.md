# Plan: M4x0.7 internal thread with the single-form M4x0.7xD4x50L cutter, 3.3 mm drilled hole in the aluminium block: Machining Doctor inputs, then an offline conversion and a staged Snapmaker job

## Findings before anything moves
- Dry-run state (fixtures, to re-read live): connected A350 CNC over Wi-Fi; `get_position` verified, homed, idle, machine X-19 Y342 Z328, warnings empty. The touch probe is fitted. Limits: motion floor machine Z320, park machine Z328. A work origin exists, but nothing tells us which tool or surface set it.
- `M4x0.7xD4x50L`: D4 is the **4 mm shank** and 50L is the **overall length**. Neither is the cutting OD, neck diameter, reach, effective length or protrusion. Machining Doctor's **Cutter Diameter** is the cutting-crest OD. Nothing supplied gives it: the M4 dimensions and flute count are not supplied, so they must be measured or taken from the tool drawing. I will not invent a typical OD, and the M2.5 fixture's `CUTTER DIAM=1.38` (a neck, per setup.md) must not be carried over.
- Single-form cutter (one axial tooth row) means Tooth Configuration = **single tooth**. Nominal helix is thread length / pitch = 8 / 0.7 ≈ 11.43 turns. The actual export will round and add lead-in and lead-out, so I review the real turn count and extents rather than insisting on 11.43. Flute count is a separate number (circumferential edges, used for feed per tooth), and the tooth-row count says nothing about it.
- **Reach blocks the job as stated.** If the M4 cutter really has the M2.5 cutter's 7.5 mm tip-to-shank reach, it cannot cut an 8 mm thread (setup.md: "A 7.5 mm reach cannot provide an 8 mm thread"). At the deepest pass the 4 mm shank step would hit the block top, and a 4 mm shank cannot enter a 3.3 mm hole. Usable thread length is at most reach − (tip-to-tooth distance) − the operator's shoulder clearance. Either the M4 cutter's measured reach is longer, or the thread length drops, or a different cutter is used.
- Geometry checks once the dimensions exist:
  - Cutting OD must be below 3.3 mm with room for the internal lead-in.
  - The swept neck (neck Ø + 2 × helix radius) must stay inside the 3.3 mm bore throughout the orbit. Helix radius = (programmed major − cutting OD) / 2.
  - In the export, 2 × helix radius + OD must equal the programmed major. This is the identity check used on the M2.5 fixture.
- 3.3 mm is the usual M4x0.7 tap-drill size, so the prepared bore is consistent with the thread. The thread path does not drill; it needs the hole's **full-diameter** depth (not drill-point depth), whether the hole is blind or through, and what lies below it. The deepest programmed tip position sits below the thread bottom by the lead-in, plus the tip-to-tooth distance if the generator's Z is the tooth.
- **Head identity is unknown.** `get_machine_profile.connectedHead.toolHead` is withheld. `headType: cnc` and the `toolHeads` list do not tell standard from 200 W, so the spindle mode (`cnc_200w_rpm` for 8000–18000 RPM, or `power_percent` for the standard head) and the generator's RPM ceiling must come from the operator.
- **Work-Z tool history is unknown**, and `originOffset` cannot supply it. `tool_length_applied: true` cannot be declared until the work Z reference is proven to belong to the outgoing tool and is then transferred to the fitted M4 cutter by a measured tool change. The probe cannot stay in for cutting, so a tool change is required whatever happens.
- Stored probe `effectiveLength` 71.3 is calibration, not a setter reading from this session. It is never used to make up an `old_trigger_z`. The setter's `measurements` history must be read (`get_tool_setter_config`) before any reuse is claimed. With nothing read, I plan a fresh probe measurement.
- The rotary landmark exists. Its `requiredToolheadZ` must be read from `get_stored_state` for the whole segment from the setter or park XY to the hole XY, with the fitted cutter's length, not worked out by hand. Nothing says where the block sits relative to it (bed or rotary, B angle).
- Datum: the generator needs the hole centre and top Z in the **existing work frame**, one program per hole. If the hole centre is not known in work XY, measuring it inside a 3.3 mm bore is only possible if the stored probe tip diameter (`get_stored_state → geometry`) plus the needed probing travel fit. Otherwise it comes from exterior references or the drilling program, never from pushing an oversized stylus into the hole.
- Converter facts that matter here:
  - It emits G54 and removes M8, M6 and G43/H.
  - It keeps the source order, so the export's first `G00 X Y` runs at whatever Z the head is at before its first Z block.
  - It adds no approach or clearance. Its bounds are tool-centre bounds, not a cutter or holder sweep.
  - A completed or approved conversion grants no motion.
- M2.5 fixture traps not to repeat: its S17991 and feeds belong to another cutter. Its 2.25 mm axial step is a multi-tooth artefact. Its work Z20 retract is not machine park height.

## Questions for the operator (one message)
1. **Single-form M4 cutter, measured or from its drawing:**
   - cutting-crest OD (this goes into Cutter Diameter)
   - neck diameter
   - tip-to-shank reach (is it really about 7.5 mm like the M2.5?)
   - tip-to-tooth distance
   - flute count
   - solid carbide or not
   - roughly how far it will stick out of the collet (declared low)
2. **If the reach is too short for 8 mm** (reach − tip-to-tooth − your shoulder clearance < 8), which thread length do you want instead? Or do you want a different cutter? Generate the export with that length.
3. **Hole:** blind or through? What is the full-diameter depth excluding the drill point (or plate thickness), what is under it, and is there a chamfer?
4. **Location and datum:** where is the hole centre in work X/Y? Was it drilled in this same setup? How was the current work origin set: which tool was in the spindle for Z0, on which surface, how XY was found, and has anything been changed or swapped since?
5. **Thread spec:** RH, and climb milling like the M2.5 job? Standard M4 6H, or a specific programmed major diameter as with the M2.5's 2.53 mm? Which aluminium alloy?
6. **Head:** is the standard CNC head or the 200 W head fitted? If standard, what power % do you want and what spindle RPM does it give (so the generator feeds match)?
7. **Cutting data:** number of radial passes and depth split, and cutting speed / feed per tooth from the cutter's data. I won't pick universal values.
8. **Tool change:** flow A (MCP measures probe → park → you swap → measures cutter → offset) or flow B (touchscreen wizard)? If flow B, may I raise Z to machine 328 after the wizard, before the file job? The wizard leaves the tip at the setter.
9. **Setup:** is the block on the bed or on the rotary (at what B)? Are the clamps clear of the hole area? Is there anything tall and unmapped between the tool setter or park position and the hole? Will the door be shut and extraction/lubrication handled by you (the converted file sends no coolant)?

## Steps
1. `get_connection_status {}`, `get_position {}`, `get_stored_state {}` (landmarks with `requiredToolheadZ`, `landmarkClearances`, limits, `geometry.probe` effectiveLength and tip diameter), `get_machine_profile {}` (`connectedHead.toolHead`), `get_tool_setter_config {}` (setter centre, park, `measurements.last` / previous), `get_probe_feed_status {}`. Read-only. State the §0 checklist block in one line per item.
2. Send the operator the Machining Doctor field list, filled in wherever I have the answer and leaving placeholders for their answers:
   - **Thread:** Metric, standard M4 × 0.7 (or the special major diameter from Q5); **Internal**; RH/LH and climb/conventional from Q5 (no silent default); thread length = 8 mm, or the Q2 length if the reach forbids 8.
   - **Tool:** Tooth Configuration = **Single tooth**; Cutter Diameter = the **measured cutting-crest OD** (not the neck, not the 4 mm shank); flutes = the counted number; solid carbide per Q1.
   - **Material and conditions:** aluminium alloy per Q5; cutting speed and feed per tooth from the cutter's data; maximum RPM = 18000 on the 200 W head (so S lands in 8000–18000), or the standard head's actual RPM at the chosen % (Q6); radial passes and depth split per Q7; review the entry feed.
   - **Output:** controller **Fanuc**; cutter compensation **D=0 / toolpath for tool centre**; program units **mm (G21)**; highest available precision (4–5 decimals, to avoid arc-endpoint refusals); XY datum = **hole centre in work coordinates**; Z datum = **work Z of the block top at the hole**; axial and radial safety distances and rapid feed reviewed, not assumed safe.
   - **Afterwards:** paste the complete export, `%` to `%`, unedited.

   Then ask Q1–Q9 in the same message.
-- end turn --
3. Operator answers and pastes the complete Machining Doctor export. [WAIT]
4. Review the source export by eye, without converting yet:
   - Header: INTERNAL, RH/CLIMB as answered, `SINGLE TOOTH`, `CUTTER DIAM` = the measured OD, `D=0 - TOOLPATH FOR TOOL CENTER`.
   - Setup block: G54 / G90 / G17 / G94 / G21.
   - First `G00 X Y` before the `G43 H1 Z..` block.
   - Helix radius: check that 2r + OD = the programmed major.
   - Turn count ≈ length / 0.7 plus rounding, lead-in and lead-out.
   - Deepest work Z against the full-diameter hole depth plus tip-to-tooth distance.
   - Shank-step clearance at the deepest point (reach vs depth).
   - Final retract.

   Keep the source text unchanged and separate. If the reach, OD, neck sweep or depth fails, ask for a regeneration and stop.
5. Datum decision from Q4:
   - **Branch A:** Z0 was set with this touch probe, XY is known, nothing has moved since. Go on to step 6.
   - **Branch R:** history unknown or broken. Re-reference with the probe still fitted (steps R1–R3), then go to step 6.
   - **Branch B:** the operator chose the touchscreen wizard. Use steps B1–B4 in place of steps 6–9.
   - R1. `probe_program {"name": "M4 hole block top", "reason": "re-establish work Z0 on block top beside the M4 hole with the touch probe before the cutter swap", "ops": [{"id": "find", "kind": "sequence", "steps": [{"kind": "hop", "x": <machine X near hole, from Q4 and the live offset as resolved by MCP>, "y": <machine Y>}, {"kind": "probe", "name": "top", "dz": -1, "max_travel_mm": <bounded from the park Z to the stated block height, per Q9>, "on_miss": "abort"}]}]}` [APPROVAL]. Hop XY is chosen clear of the 3.3 mm hole. If the hole's XY is also unknown and the stored tip diameter allows it, a separate `probe_circle` inside the bore adds 1 more [APPROVAL]; otherwise XY comes from exterior references, which is asked, not guessed. -- end turn -- then `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background, and `get_gcode_job_status` to read `find.top.z`.
   - R2. `set_workspace_origin {"workspace": "G54", "origin_machine": {"x": <measured hole-centre or datum machine X>, "y": <machine Y>, "z": <find.top.z toolhead Z with the probe fitted>}, "datum_reference": "probe_program job <id> top contact, touch probe fitted, B<angle>, independent check <ref>", "reason": "work Z0 = block top, tool = touch probe, before M4 cutter swap"}` [APPROVAL] -- end turn -- then `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`.
   - R3. `get_position {}`: `originOffset` matches, G54 active, and an independent reference check is quoted while the probe is still fitted.
6. `run_tool_setter {"bit_length_mm": 70, "accept_probe_contact": true, "reason": "tool change flow A step 1: measure outgoing touch probe that established work Z0 (declared low, stored calibration 71.3)"}` [APPROVAL]. Skip only if `measurements.last` is this probe, this session, and the operator confirms nothing moved. -- end turn -- then `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background, and `get_gcode_job_status`: read the spread and `result.finalZ` (expect machine Z328).
7. `goto_tool_change_position {"reason": "park for swap from touch probe to M4x0.7 single-form thread mill"}` [APPROVAL] -- end turn -- then two `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` calls (Z up, then XY).
8. The operator removes the probe and fits the **single-form** M4 cutter (not the triple-form one), then tells me it's done. [WAIT] -- end turn --
9. `run_tool_setter {"bit_length_mm": <Q1 protrusion, rounded down>, "reason": "tool change flow A step 4: measure M4x0.7 single-form thread mill"}` [APPROVAL] -- end turn -- then `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`. Check the spread and that `finalZ` = machine Z328.
10. `apply_tool_length_offset {"reason": "transfer work Z0 from touch probe to M4 single-form cutter (last two setter measurements)"}` [APPROVAL] -- end turn -- then `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`.
11. `get_position {}`: `originOffset.z` has changed by (new − old). The operator sanity-checks the displayed work Z. Work Z now references the fitted cutter's tip, which makes both declarations true.
12. `convert_thread_milling_gcode` on the complete pasted export:
    - 200 W head: `{"gcode": "<complete export>", "source_controller": "fanuc", "tool_center_path": true, "tool_length_applied": true, "spindle_mode": "cnc_200w_rpm", "chord_tolerance_mm": 0.002}`
    - Standard head: `{"gcode": "<complete export>", "source_controller": "fanuc", "tool_center_path": true, "tool_length_applied": true, "spindle_mode": "power_percent", "spindle_power_percent": <Q6 %>, "chord_tolerance_mm": 0.002}`

    An RPM refusal means the generator's conditions get revisited. It is never a reason to switch modes.
13. Review `changes`, `warnings`, `sourceSpindleRpm`, the arc/full-circle/segment counts and `validation` against the source:
    - units and G54
    - first XY move before the first Z
    - direction with signed Z travel
    - pitch 0.7 per turn and the turn count
    - every radial pass
    - feeds
    - deepest point and final retract
    - M5 at the end, M8 removed

    Report what was removed or changed.
14. Fresh `get_position {}` and `get_stored_state {}`. The head is at the setter XY at machine Z328 (≥ floor 320). Check the whole segment from there to the hole's machine XY, at 328, against each landmark's `requiredToolheadZ` (now computed with the cutter). The file's first `G00 X Y` runs at this Z. Confirm G54 is the selected workspace and is the origin just transferred.
15. `validate_gcode {"gcode": "<converted text, unchanged>"}`: read the warnings (spindle-on below Z0 is expected for an internal thread, and it goes in front of the operator).
16. `submit_gcode_job {"gcode": "<converted text, unchanged>", "name": "M4x0.7-internal-single-form-<len>mm-hole1.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]. Read the operator the **Frame** row and the **machine-resolved Z extents** (deepest machine Z against the block and hole bottom). Put the confirm URL on the last line. -- end turn --
17. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background, then long-poll `get_gcode_job_status {"job_id": "<id>", "wait_ms": 110000, "since_event": <n>}` and report `ending.kind`. On a stop: no retract or resume. Recovery is agreed with the operator.
18. `get_position {}` (actual final Z). The operator checks the thread with an M4x0.7 go/no-go gauge. Completion is not fit. [WAIT]

Branch B (touchscreen wizard), in place of steps 6–10:
- B1. `run_tool_setter {"bit_length_mm": 70, "accept_probe_contact": true, "stay_at_trigger": true, "reason": "wizard: hold probe at trigger"}` [APPROVAL] -- end turn -- then `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`.
- B2. The operator confirms on the touchscreen and swaps to the single-form cutter. [WAIT] -- end turn --
- B3. `run_tool_setter {"bit_length_mm": <Q1 protrusion>, "stay_at_trigger": true, "start_from_current": true, "reason": "wizard: hold M4 cutter at trigger"}` [APPROVAL] -- end turn -- then `start_gcode_job`. The operator finishes the wizard. [WAIT] No `apply_tool_length_offset`.
- B4. `move_z {"z": 328, "coordinate_system": "machine", "reason": "raise cutter from setter trigger to park before thread file job (operator OK'd in Q8)"}` [APPROVAL] -- end turn -- then `start_gcode_job`. Continue at step 11 (`get_position`), then step 12 on.

## Readiness
- Conversion declarations:
  - `tool_center_path: true` can be declared once the pasted export's header and blocks show D=0 / tool-centre with only G40/G41 D1 register selectors. Not before the export exists.
  - `tool_length_applied: true` **cannot** be declared now. Work-Z tool history is unknown, and the probe (not the cutter) is fitted. First, work Z0 must be proven or re-established with the outgoing probe. Then the M4 single-form cutter must be fitted and the reference transferred by a measured tool change: flow A with `apply_tool_length_offset` completed and verified in `get_position`, or the flow B wizard finished.
  - The spindle mode also has to wait for the operator to name the head.
  - No conversion is run just to get a preview.
- Submission: nothing is staged until all of the following hold:
  - The generator inputs are verified from measured cutter data: OD, neck, flutes, and a reach that is ≥ thread length + tip-to-tooth + clearance.
  - The hole depth covers the deepest actual tip position.
  - Work XY and Z registration are verified, and G54 is the selected, transferred origin.
  - The conversion has been reviewed with its warnings resolved.
  - A fresh position is verified, idle and at Z328, with the first-move segment clear of each landmark's `requiredToolheadZ`.
  - `validate_gcode` has been read.
  - The operator has asked for execution and confirmed clamps, door and lubrication.

Counts: logical approvals = Branch A 5 (probe measure 1 + park 1 + cutter measure 1 + offset 1 + file job 1); Branch R 7 (+ probe_program 1 + set_workspace_origin 1), 8 if a probe_circle is needed; Branch B 4 (2 wizard setter runs + move_z 1 + file job 1). literal [APPROVAL] tags=11 across all branches (Branch A path: 5; R adds 2 plus 1 conditional probe_circle; B uses 3 of its own plus step 16), operator waits=5 tagged (Branch A path: 3: answers+export, swap, gauge check), questions=9
