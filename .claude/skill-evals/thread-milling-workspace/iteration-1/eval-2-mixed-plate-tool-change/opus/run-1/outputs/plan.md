# Plan: Thread-mill 4x M2.5x0.45 and 2x M4x0.7 through-holes in a 5 mm plate, with two tool changes (probe to M2.5, M2.5 to M4)

## Findings before anything moves

- **The M2.5 program can't be run as it is. It was generated with the wrong cutter geometry.** The fixture header says `CUTTER DIAM=1.38, L=2.25 [MULTI TOOTH]`. The operator's cutter is "1.38mm neck 7.5mm long including triple row threads". So 1.38 is the NECK diameter, not the tooth diameter. The helix radius is 0.575 (`I-0.575`), which gives major = 2 x 0.575 + tooth OD. That is 2.53 only if the teeth really are 1.38 across. If the teeth are about 1.9 mm, which is typical for an M2.5 mill with a 1.38 neck, the thread comes out about 3.05 mm major. That is scrap.
- **The cutting length is also wrong for a triple-row cutter.** L=2.25 is 5 rows x 0.45. The program climbs 2.25 per pass (0.056 + 0.45 + 0.056 + 1.688). Three rows cover about 1.35 mm per pass, so each pass would leave an uncut band of about 0.9 mm. It must be regenerated with the measured tooth OD and L = rows x 0.45.
- **The program is for one hole at work X0 Y0.** The converter refuses workspace changes and origin writes, and rejects a second `M06 T1`, so a concatenated source is refused. I will not move a file's coordinates by hand (cnc-motion-rules §2). That leaves one generator run per hole, using the generator's XYZ datum, which thread-milling.md says is covered and preserved: 4 x M2.5 + 2 x M4 = **6 programs, one file job each**.
- **I won't join the 6 converted files into one job to save clicks.** Between holes the joined file would travel XY at work Z20, which is about 15 mm above the plate and below the machine Z320 motion floor (law 2). Separate jobs are lawful: README "Machine facts" says a completed file job returns Z to the top at its finish XY. So each job's first `G0 X Y` runs at Z328. I re-check this with `get_position` before staging each job.
- **There is no M4 program yet.** The operator only has the M2.5 file. The converter only imports generator output, so the operator has to generate the two M4 programs too. Those need that cutter's tooth OD, which "no more detail than the names" does not give. It has to be measured with calipers.
- **M4 cutter choice: single-row, provided it reaches.** Only one tooth is engaged, so there is about 1/3 of the radial load. That matters on the A350's light gantry and spindle, where deflection turns into taper and oversize. It also has no cutting-length (L) step to get wrong, which is the exact error found in the M2.5 file. The cost is about 7-8 helix turns instead of 3 passes, which is seconds for two holes. The gate is reach: the D4 shank is at least as big as the M4 major (4.0), so the neck must be at least about 6 mm (5.0 + ~0.06 overrun + tooth + margin), or the shank orbits into the thread entry. If the single-row neck is shorter than that and the triple-row neck isn't, use the triple-row with L = 3 x 0.7 = 2.1.
- **The M2.5 cutter reaches.** At the bottom pass the tip is at work Z-5.056, so the 7.5 mm neck ends at +2.44 above the plate top. The D4 shank stays above the plate.
- **The tip goes below the plate.** The bottom cut is at work Z-5.056 in a 5.000 plate, so the tip goes at least 0.056 mm below the bottom face. It may go deeper; see the next point. What is under the holes (spoilboard, bed, a gap) is a question.
- **Probe pretravel is not in the tool-length delta.** README "Machine facts" says that with the probe on the setter, "the SETTER fires first". But work Z0 was set by the probe's own trigger on the plate top, which includes its pretravel d. The flow-A delta cancels the setter's own travel, not d. So after the offset, the cutter tip at work Z0 sits d below the real top. The whole thread shifts d deeper, which is harmless for a through thread but adds to the overrun above. I'm reporting this, not correcting it; nothing on the tool surface measures d.
- **The spindle mode depends on the head type, which is unknown.** The file has `S17991`. On a 200 W head, `cnc_200w_rpm` accepts it (range 8000-18000). On a standard head, `power_percent` replaces the RPM without rescaling feeds. Feeds computed for 17991 RPM at a lower real speed raise chip load, so the programs must be generated with that head's max RPM. `get_machine_profile` decides this. I read it in turn 1, before asking, so the regeneration spec is right the first time.
- **The converter's `tool_length_applied: true` claim is only true after the offset.** It says work Z already accounts for the fitted tool tip. That becomes true only after `apply_tool_length_offset` for that cutter. Converting early is offline and harmless. Submitting is gated on the offset step.
- **The M2.5 hole may leave almost no clearance for the plunge.** The program plunges at F2000 on the hole centre. A 2.05 tap-drill hole around a ~1.9 cutter leaves about 0.07 mm radial clearance. If the holes were drilled in another setup, a small position error breaks the cutter. The touch probe tip is almost certainly too big for a 2.05 hole, so the positions can't be checked by probing before the swap.
- **The tool-change path crosses the rotary landmark.** Setter (machine X79 Y293) to the far-X park runs through the rotary box (X110-230, Y130-342) at Z328. That passes only if `requiredToolheadZ` for `rotary` in `get_stored_state` is <= 328. The stand-in doesn't give it, so I read it in turn 1. The same check covers the first `G0 X Y` of each tool's first job, which starts from the park.
- **Old-tool measurement for change 2 can be skipped.** The last setter measurement will be the M2.5 cutter taken before cutting, and that is the one the shifted origin is based on. So `previous = M2.5, last = M4` is the correct pair (tool-change "The sequence" step 1 skip rule, with the operator's word that nothing was knocked).

## Questions for the operator (one message)

Sent at the end of turn 1, after the read-only calls. The spindle line is filled from `get_machine_profile`.

1. **Which tool-change flow?** (A) I shift the work origin through the MCP. You only swap the tool and click the confirm pages. This is my default. (B) The touchscreen wizard. Also, may the swap happen where the head stops after measuring, at Z328 above the tool setter (machine X79 Y293), instead of at the far-X park? That removes one click per change (13 down to 11).
2. **M2.5 cutter.** With calipers: the tooth OD across the thread crests. It is NOT 1.38; that's the neck. How many full tooth rows (I expect 3)? How far it sticks out of the collet (a rough figure is fine; I declare it low).
3. **Both M4 cutters.** For each: the neck length from the tip to where the D4 shank starts, and the tooth OD. Also how far the one you'll fit sticks out of the collet. I'll use the single-row cutter if its neck is at least about 6 mm.
4. **Holes.** What diameter are the pre-drilled M2.5 and M4 holes? Were they drilled in this same setup, from this work origin? If not, positional error can break the M2.5 cutter on its plunge.
5. **Under and around the plate.** What is directly under the six holes (spoilboard, bare bed, parallels with a gap)? The cutter tip goes about 0.06 mm or more below the plate's bottom face. Are the clamps clear of all six hole centres?
6. **Six regenerated programs, please**, from Machining Doctor. Settings: Fanuc, internal, RH, climb, tool-centre path (D=0), metric, thread length 5, Z datum 0 at the plate top, and X/Y datum at each hole centre.
   - M2.5x0.45, multi-tooth: cutter dia = measured tooth OD, L = rows x 0.45 (3 rows gives 1.35). Datums (10,10), (60,10), (60,40), (10,40).
   - M4x0.7: single tooth, cutter dia = its measured tooth OD. Datums (35,15), (35,35).
   - Max RPM: 200 W head = up to 18000. Standard head = its rated max speed, so the feeds match the speed it really runs.
   - Please paste all six as files or text, including `M30`.
7. **Say "go"** with your answers, and I'll start staging. Every motion is still its own confirm page. Please have the door shut and extraction on for the cutting jobs.

## Steps

**Turn 1 (read-only, nothing moves)**

1. `get_machine_profile {}`: CNC head type, standard vs 200 W. This picks `spindle_mode`: 200 W = `"cnc_200w_rpm"`; standard = `"power_percent"` with `spindle_power_percent: 100` and programs generated at that head's max RPM.
2. `get_stored_state {}`: `landmarks.rotary.requiredToolheadZ` (must be <= 328 for the park and first-hop segments), `landmarkClearances`, limits (floor 320, park 328), `geometry.probe.effectiveLength` 71.3.
3. `get_tool_setter_config {}`: `tool_change_x/y/z` park, reference trigger (175.5 with 75 mm), `measurements.last`. If the last measurement is the touch probe from this connection and nothing has moved since, step 9 can be skipped.
4. `get_probe_feed_status {}`: transport (sets `sensor_delay_ms` expectations). Toolsetter and overtravel channels must be readable and untriggered.
5. `get_position {}`: re-quote `reliability` verified, homed, idle, machine (X-19, Y342, Z328), `warnings: []`, and `originOffset` (read to the operator as the plate's machine location).
6. Reply with the §0 checklist block, one line each: State / Frame (work-frame file jobs + machine-frame tool calls) / Height (at Z328 park) / Obstacles (rotary `requiredToolheadZ` = the value read) / Tool (touch probe, 71.3) / Authority (planning only, nothing staged). Then the findings in short form and the numbered question list above. [WAIT]

-- end turn --

**Operator answers 1-7, pastes the six programs, and says "go".** Branches below assume flow A, the default park spot, the single-row M4 cutter, no clamp or under-plate problem, and holes drilled in this setup. If any answer says otherwise, stop and replan before step 9: for example, flow B, a neck under 6 mm, or holes drilled elsewhere. Flow B would use `run_tool_setter {stay_at_trigger: true}` twice per change and no `apply_tool_length_offset`.

**Turn 2 (offline checks, then the first staging)**

7. For each of the six programs: `convert_thread_milling_gcode {"gcode": "<program text>", "source_controller": "fanuc", "tool_center_path": true, "tool_length_applied": true, "spindle_mode": "<from step 1>", "chord_tolerance_mm": 0.002}`. For each result, read `changes`, `warnings`, `sourceSpindleRpm` and `validation`. The Z extents should be about -5.06 to 20, and the XY extents should be within about 0.6-1.5 mm of each hole centre. A refusal (for example an arc precision error) goes back to the operator before anything moves.
8. `validate_gcode {"gcode": "<converted text>"}` on each converted output. `M3 ... M5` is expected. A spindle-on Z below 0 is expected here (a through-thread down to -5.056) and gets said out loud; it isn't something to edit.
9. **Tool change 1, measure the old tool (the touch probe):** `run_tool_setter {"bit_length_mm": 70, "accept_probe_contact": true, "reason": "Tool change 1/2: measure the fitted touch probe (stored effective length 71.3, declared low) before swapping to the M2.5x0.45 triple-row thread mill; the work origin was set with this probe"}` [APPROVAL]
   Reply: one sentence, then the `confirm_url` as the last line.

-- end turn --

10. After the operator clicks: `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`, then `get_gcode_job_status {"job_id": "<id>", "wait_ms": 110000, "since_event": <n>}` until `ending.kind: completed`. Report the trigger Z (machine), the spread, and `result.finalZ` 328. If trigger - 100.5 is more than 0.3 mm from 71.3, say so.
11. `goto_tool_change_position {"reason": "Tool change 1/2: park for the manual swap from touch probe to M2.5x0.45 triple-row thread mill"}` [APPROVAL]
   Reply: one sentence, then the URL.

-- end turn --

12. After the click: `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` (step 1: Z, already at 328), then `start_gcode_job {"job_id": "<id>"}` (step 2: XY to the park). `get_position` confirms machine Z328 at the park.
13. Operator action: take out the touch probe and fit the M2.5 cutter in a 4 mm collet at the stated stick-out. Make sure the Probe pill does not read triggered once the probe is unplugged. Reply "swapped". [WAIT]

-- end turn --

14. `run_tool_setter {"bit_length_mm": <operator's M2.5 stick-out minus 2, declared low>, "reason": "Tool change 1/2: measure the new M2.5x0.45 triple-row thread mill"}` [APPROVAL] (no `accept_probe_contact`: the probe is out)
   Reply with the URL.

-- end turn --

15. After the click: `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` and poll until completed. Check the spread (no more than one fine step, otherwise re-measure). The head is at Z328 above the setter.
16. `apply_tool_length_offset {"reason": "Tool change 1/2: touch probe -> M2.5 thread mill; shift work Z by new - old trigger (last two setter measurements, this connection)"}` [APPROVAL] (a single G92, no motion)
   Reply with the URL.

-- end turn --

17. After the click: `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`. Then `get_position`: `originOffset.z` must have changed by (new - old). Tell the operator the expected lowest machine toolhead Z for the cut: plate-top machine Z with this cutter, minus 5.056. The confirm page in step 18 has to show that.
18. **M2.5 hole 1 at work (10,10).** `get_position` (reliable, Z >= 320, idle). Then `submit_gcode_job {"gcode": "<converted M2.5 @ 10,10>", "name": "M2.5x0.45 thread work(10,10)", "frame": "work", "head_type": "cnc"}` [APPROVAL]
   Read the operator the confirm page's `Frame: WORK (declared by argument)` row and the machine-resolved Z extents, compared with step 17. The first `G0 X Y` runs at Z328 from the park, across the rotary box, which is cleared by step 2.
   Reply with the URL.

-- end turn --

19. After the click: `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`, then poll `get_gcode_job_status` until `ending.kind: completed` (it returns to Z top).
20. **M2.5 hole 2 at (60,10).** Stage it the same way as step 18, after `get_position` shows Z >= 320. [APPROVAL] Test gate folded into this click: "Before you click, try an M2.5 screw in hole (10,10) with the spindle stopped. Click only if it runs in freely. If it doesn't, tell me and nothing else runs."
   Reply with the URL.

-- end turn --

21. Start and poll (as in step 19).
22. **M2.5 hole 3 at (60,40)**, staged as in step 18. [APPROVAL] URL.

-- end turn --

23. Start and poll.
24. **M2.5 hole 4 at (10,40)**, staged as in step 18. [APPROVAL] URL.

-- end turn --

25. Start and poll until completed. The head is at Z top above (10,40).
26. **Tool change 2.** The old-tool measurement is skipped: `measurements.last` is the M2.5 cutter measured before cutting in step 15, and that is the length the origin now refers to. The skip holds only on the operator's word that nothing was knocked, which step 28 asks for. `goto_tool_change_position {"reason": "Tool change 2/2: park for the manual swap from M2.5 thread mill to M4x0.7 single-row thread mill"}` [APPROVAL] URL.

-- end turn --

27. After the click: `start_gcode_job` x2 (Z, then XY). `get_position` shows Z328 at the park.
28. Operator action: swap to the M4 single-row cutter (same 4 mm collet) at the stated stick-out. Confirm that nothing else was knocked or moved (plate, clamps). Reply "swapped". [WAIT]

-- end turn --

29. `run_tool_setter {"bit_length_mm": <M4 stick-out minus 2>, "reason": "Tool change 2/2: measure the new M4x0.7 single-row thread mill"}` [APPROVAL] URL.

-- end turn --

30. Start and poll. Check the spread.
31. `apply_tool_length_offset {"reason": "Tool change 2/2: M2.5 thread mill -> M4 single-row thread mill; previous = M2.5 pre-cut measurement, last = M4"}` [APPROVAL] URL.

-- end turn --

32. Start. `get_position` shows `originOffset.z` changed by (M4 - M2.5). State the expected lowest machine Z.
33. **M4 hole 1 at work (35,15).** `submit_gcode_job {"gcode": "<converted M4 @ 35,15>", "name": "M4x0.7 thread work(35,15)", "frame": "work", "head_type": "cnc"}` [APPROVAL] Read the Frame row and the Z extents. URL.

-- end turn --

34. Start and poll until completed.
35. **M4 hole 2 at (35,35)**, staged as in step 33, with the same test gate: "try an M4 screw in (35,15) before you click". [APPROVAL] URL.

-- end turn --

36. Start and poll until completed. Report: six threads cut, the head at Z top above work (35,35), and the M4 cutter still fitted. The work origin now refers to the M4 tip. Going back to the probe means another tool change. Nothing else is staged: no home or move without the operator's word.

Counts: approvals=13 (12 if a same-session probe measurement lets step 9 be skipped; 11 if the operator accepts swapping over the setter instead of the park), operator waits=3 (answers + programs, swap 1, swap 2; the two screw checks are folded into clicks already counted), questions=7
