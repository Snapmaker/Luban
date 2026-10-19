# Plan: Get the operator's M2.5x0.45 internal thread ready to cut in the drilled 2.05 mm hole. Don't convert the supplied Machining Doctor file for this cutter; have it regenerated, then set the datum, change tools, convert and stage.

## Findings before anything moves

- **What was asked.** "Converted and ready to run" asks me to prepare the job. Converting a file is not a request to cut (cnc-thread-milling). Each motion below is staged as a confirm page, and the operator's click is what actually runs it.
- **What the supplied file contains.** `tests/fixtures/thread-milling-m2_5-fanuc.nc` is Fanuc and internal: RH thread, climb milling, major diameter 2.53, pitch 0.45, 5 mm long. The header reads `CUTTER DIAM=1.38, L=2.25 [MULTI TOOTH]` and `D=0 - TOOLPATH FOR TOOL CENTER`. It has one pass: three helical turns at three axial positions. The spindle line is `S17991 M03`. It contains `M06 T1`, `G43 H1`, `G41 D1` and `M08`, and ends with `M30`. I keep it byte-for-byte as the source and never submit it raw.
- **Cutter diameter mismatch: it overcuts.** The helix centre radius is 0.575 mm, and 2 x 0.575 + 1.38 = 2.53. So the path assumes a **cutting OD** of 1.38 mm. The operator's cutter has a **1.38 mm neck**, and a neck is not the cutting OD. The thread crests must be larger than the neck. Every extra 0.1 mm of real OD adds 0.1 mm to the major diameter this path cuts. The real cutting OD is unknown, so I won't guess a typical value. The file must be regenerated with the measured or datasheet crest OD.
- **Axial step mismatch: it leaves bands uncut.** The source moves 0.056 + 0.45 + 0.056 + 1.688 = 2.25 mm between axial cutting positions. Three thread rows at 0.45 mm pitch cover about 1.35 mm per turn. Steps of 2.25 mm would leave unthreaded bands of about 0.9 mm. It needs regenerating with the cutter's real effective cutting length, using the Tooth Configuration setting "multi tooth shorter than thread". "Triple flute" means 3 circumferential edges and says nothing about the rows. "Triple row" is my only clue to axial coverage, and it is not a datasheet effective length.
- **Cutter designation.** Following the setup reference convention, D4 = 4 mm shank and 50L = 50 mm overall length. Neither one gives reach, collet protrusion or cutting length. The neck is 7.5 mm long including the rows. The deepest point in the file is work Z-5.056, so the 4 mm shank shoulder would sit about 2.4 mm above the plate top. That only holds if the 7.5 mm is measured from the tip and work Z is the tip. The tip-to-lowest-crest distance is unknown.
- **Depth.** The deepest programmed point is work **Z-5.056**. The last cutting point is work Z+0.006, and the retract is work Z20. "About 6 mm deep" could include the drill point. A 118° point on a 2.05 mm drill is about 0.6 mm long, which would leave roughly 5.4 mm at full diameter. That is only about 0.3 mm margin below the tip, and it assumes the tip is the lowest cutting point. I don't know whether the hole is blind or through, or how thick the plate is. The regenerated file's depth must be checked against the full-diameter depth. The operator also hasn't said what thread length they need; the file uses 5.
- **Bore entry.** The cutting OD must be clearly smaller than the 2.05 mm bore, so the cutter can plunge straight down the centre and orbit. The source plunges `G01 Z-5.056 F2000` from work Z20 at X0 Y0. That plunge only clears if work XY zero is on the hole centre.
- **XY datum.** The program is written around work X0 Y0, so work XY zero must be the hole centre, or the generator's XY datum must be the hole's work coordinates. The current work origin has no known history: I don't know which tool or surface set it, or whether its XY is the hole. A coherent `originOffset` does not prove what it references.
- **Can the probe measure the hole?** Probably not. A 2.05 mm bore is almost certainly too small for the probe ball plus travel, but I'll read the stored tip diameter from `get_stored_state` before ruling it out. I won't propose putting the stylus in the hole. The hole centre has to come from how it was drilled (the machine and datum used), or from a separately planned camera alignment.
- **Tool and Z.** The touch probe is fitted. Its stored effectiveLength of 71.3 is a calibration value, not a setter reading from this session. So work Z does not currently reference the thread mill's tip, and `tool_length_applied` cannot be declared yet. I also can't make up a setter trigger as surface + 71.3.
- **Head.** `connectedHead.toolHead` is withheld. `headType: cnc` and the list of compatible heads don't tell me which head is fitted, so I'll ask. S17991 is valid only on the 200 W head (8000–18000). The standard head needs `power_percent` with an explicit percentage. It would also need feeds regenerated for that head's speed: the converter never rescales feeds, and the F491/F981 values were computed for about 18000 RPM on a 1.38 mm tool.
- **What conversion changes.** Removed and reported: `M06 T1`, `G43 H1` (the Z20 move is kept), `G41`/`G40`/`D1`, `M08` and the through-coolant comment. The arcs become G1 segments at the 0.002 mm default. The output is G21/G90/G54 and ends with M5/G90 instead of M30. Coolant is not controlled, so lubrication for aluminium is up to the operator.
- **First move and route.** The first block is `G00 X0 Y0`, at whatever height the head is at, before any Z move. After the tool change, `run_tool_setter` finishes at machine Z328 over the setter (read `result.finalZ`). That is above the Z320 floor. The segment from the setter to the hole must still be checked against the rotary landmark's stored `requiredToolheadZ`, and against clamps the operator describes. Conversion adds no safe approach. Work Z20 is not park height.
- **Frame at staging.** The converted file emits G54, so it must be staged with `frame: "work"` while G54 is the verified, selected workspace. docs/workspaces.md says an explicit G54 can leave machine extents unresolved on the confirm page. If so, I'll report it as unresolved and won't convert by hand.
- **Completion.** A finished job proves the program ran, not that the thread fits. The operator checks it with an M2.5 go/no-go gauge or screw. A stopped file job doesn't retract or resume.

## Questions for the operator (one message)

1. **Cutter geometry.** What is the cutting OD across the thread crests, from the vendor drawing or measured with a micrometer? It is not the 1.38 neck. How many complete thread forms are there, and what is the effective cutting length (for example about 1.35 mm for 3 rows at 0.45)? What is the distance from the tip to the lowest crest? Is the 7.5 mm neck length measured from the tip? Roughly how far will it stick out of the collet, and how far does the touch probe stick out? I need both for `bit_length_mm`; if unsure, give a figure on the low side.
2. **Which CNC head is fitted: standard or 200 W?** If it's the standard head, what spindle power percentage do you want? The feeds will then need regenerating for that head's speed.
3. **The hole.** Is it blind or through? How thick is the plate? Is "6 mm" the full-diameter depth or to the drill tip? What thread length do you need? The current file uses 5 mm. Is the hole chamfered?
4. **Where is the hole?** Was it drilled on this machine, in this setup, and has nothing moved since? At what machine XY is its centre, or at what work XY of a verified origin? How was the current work origin set: which tool touched off, and which surfaces set X, Y and Z?
5. **Thread spec.** Please confirm right-hand, standard M2.5x0.45, and climb milling as in the file. Was the file generated with aluminium cutting conditions (speed and feed per tooth) for this cutter? Please regenerate in Machining Doctor with:
   - Cutter Diameter = the crest OD
   - multi-tooth shorter than thread, with Efective Length = the real effective length
   - your thread length
   - D=0 / tool-centre path, Fanuc controller, precision 3 or higher
   - RPM and feeds for the head you have
   - XY datum 0,0 at the hole centre and Z0 at the plate top

   Then paste or commit the new export.
6. **Obstacles and tool change.** Where are the clamps and anything taller than the plate, near the hole or between the tool setter and the hole? Is there a probe-reachable spot on the plate top 3 mm or more from the hole edge, given as machine XY? Which tool-change flow do you want: A (MCP applies the offset) or B (touchscreen wizard)?
7. **Staging.** May I stage these as confirm pages as we go: the plate-top Z probe, origin set and check, tool change, and finally the thread job? Nothing moves until you click each one. Door shut and extraction on for the cut?

## Steps

1. Call `get_connection_status {}`. Expect a connected A350 CNC over Wi-Fi.
2. Call `get_position {}` and quote `reliability`, `warnings`, `isHomed`, `machineStatus`, machine X/Y/Z and `originOffset`. The fixture gives verified, homed, idle at machine X-19 Y342 Z328.
3. Call `get_stored_state {}` for:
   - limits: floor Z320, park Z328
   - the rotary landmark's box and `requiredToolheadZ`, plus `landmarkClearances`
   - `geometry.probe.effectiveLength` (71.3, calibration only) and the probe tip diameter
4. Call `get_machine_profile {}` and read `connectedHead.toolHead`. Expect withheld/null, so the head goes into question 2.
5. Call `get_tool_setter_config {}` for the setter centre, the park position and `measurements.last`/`previous`, including whether any are from this session and this probe.
6. Call `get_probe_feed_status {}`. The probe, tool setter and setter-overtravel channels must all be available and green.
7. Do the offline source review. Keep the fixture unchanged and don't convert it: truthful declarations aren't possible yet, and its cutter data don't match this cutter.
8. Send the question message above, with the findings summary and the state checklist block. [WAIT]

-- end turn --

9. Read the answers and the regenerated export. Check its header:
   - `CUTTER DIAM` equals the crest OD
   - `L` matches the effective length, and the axial step is at most the effective coverage
   - D=0 / tool centre
   - FANUC, RH, climb
   - thread length as answered
   - deepest Z no lower than the full-diameter depth minus tip margin
   - datum X0 Y0
   - S within the head's range

   If anything is inconsistent, ask once more and stop. Branch: if the hole centre's machine XY can't be established from question 4, plan camera alignment separately before continuing (not counted below).
10. Z datum on the plate top, with the probe still fitted. Stage it:
    ```
    probe_program {
      "name": "plate top Z datum at M2.5 hole",
      "reason": "Establish work Z0 on plate top with calibrated probe before thread-mill swap",
      "ops": [{"id": "find", "kind": "sequence", "steps": [
        {"kind": "hop", "x": <operator plate-top X>, "y": <operator plate-top Y>},
        {"kind": "probe", "name": "top", "dz": -1, "max_travel_mm": 150, "on_miss": "abort",
         "capture": {"label": "plate top contact", "settle_ms": 500}}
      ]}]
    }
    ```
    The station is the machine XY from question 6. It hops at park height and is landmark-checked at staging. [APPROVAL]

-- end turn --  (deliver the confirm_url as the last line)

11. Call `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background. Long-poll `get_gcode_job_status`, then record `find.top.z` (the probe's toolhead Z at contact, in machine coordinates).
12. Set the origin:
    ```
    set_workspace_origin {
      "workspace": "G54",
      "origin_machine": {"x": <hole centre machine X>, "y": <hole centre machine Y>, "z": <find.top.z>},
      "datum_reference": "X/Y: hole centre from <operator's stated drilling datum / job>; Z: plate-top contact job <id>, touch probe fitted, B not used (plate on bed), <date>",
      "reason": "Work XY zero on the M2.5 hole centre, Z0 plate top at probe tip, for thread-mill program datum X0 Y0 Z0"
    }
    ```
    If question 4 showed the existing G54 X/Y is already the verified hole centre, pass those X/Y values from the live readback instead. [APPROVAL]

-- end turn --

13. Call `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}`, then `get_position {}` to confirm G54 is selected with the expected offset, and that X/Y/B haven't changed.
14. Independent check: stage the same single-station `probe_program` (name "G54 Z0 recheck"). The predicted contact is `find.top.z` ± 0.05 mm, which is work Z0.000 ± 0.05. [APPROVAL]

-- end turn --

15. Call `start_gcode_job` in the background and poll. Compare the contact with the prediction; if it's outside tolerance, stop and report.
16. Tool change flow A, step 1 of 4: measure the outgoing probe.
    ```
    run_tool_setter {"bit_length_mm": <operator probe protrusion, low>, "accept_probe_contact": true, "reason": "Outgoing touch probe that set G54 Z0 in job <id>, this session"}
    ```
    [APPROVAL]

-- end turn --

17. Call `start_gcode_job` in the background and poll. Check the spread and `result.finalZ` (Z328).
18. Flow A, step 2: `goto_tool_change_position {"reason": "Park for probe -> M2.5 thread mill swap"}`. That is one approval covering two `start_gcode_job` calls, Z first and then XY. [APPROVAL]

-- end turn --

19. Call `start_gcode_job` twice, one call per leg.
20. The operator removes the probe, fits the M2.5x0.45 thread mill at the stated protrusion, and says "done". [WAIT]

-- end turn --

21. Flow A, step 3: measure the new tool.
    ```
    run_tool_setter {"bit_length_mm": <operator cutter protrusion, low>, "reason": "Incoming M2.5x0.45 3-row thread mill after swap"}
    ```
    [APPROVAL]

-- end turn --

22. Call `start_gcode_job` in the background and poll. Check the spread, and that `measurements.previous` is the probe and `measurements.last` is the cutter.
23. Flow A, step 4: `apply_tool_length_offset {"reason": "Transfer G54 Z0 from touch probe to thread mill, setter pair from this session"}`. [APPROVAL]

-- end turn --

24. Call `start_gcode_job`, then `get_position {}`. `originOffset.z` must have changed by new − old trigger, and the head should be at Z328 over the setter. Ask the operator to sanity-check the displayed work Z.
25. Only now make both declarations and convert offline:
    ```
    convert_thread_milling_gcode {"gcode": "<complete regenerated export>", "source_controller": "fanuc", "tool_center_path": true, "tool_length_applied": true, "spindle_mode": "cnc_200w_rpm"}
    ```
    That call is for the 200 W head. For the standard head, use `"spindle_mode": "power_percent", "spindle_power_percent": <operator's value>` instead. The default `chord_tolerance_mm` is 0.002.
26. Review `changes`, `warnings`, `sourceSpindleRpm`, the arc/full-circle/segment counts and `validation`. Compare with the source:
    - units and the G54 datum
    - the first blocks: G0 X0 Y0 at the current Z, then G0 Z20, then the plunge
    - direction (G3 = climb for an RH internal thread)
    - pitch per turn, the axial repositions against effective coverage, and each radial pass
    - feeds, M3/M5, deepest Z against full-diameter depth, and the final retract
27. Call `validate_gcode {"gcode": "<converted text>"}` and read the warnings to the operator. Check the route: the segment from the current machine XY at Z328 over the setter to the hole must be at or above the rotary landmark's `requiredToolheadZ` (read that value, don't work it out), and clear of the stated clamps. If it isn't, stage `traverse_xy` to a clear waypoint or over the hole first (+1 approval, conditional). Re-read `get_position` to confirm G54 is still selected.
28. Stage the converted text unchanged:
    ```
    submit_gcode_job {"gcode": "<converted text, unchanged>", "name": "M2.5x0.45 internal thread - plate hole.nc", "head_type": "cnc", "frame": "work"}
    ```
    Read the operator the Frame row and the machine-resolved Z extents, or say they're unresolved because of the explicit G54. [APPROVAL]

-- end turn --  (confirm_url is the last line)

29. Call `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background. Then call `get_gcode_job_status {"job_id": "<id>", "wait_ms": 110000, "since_event": <n>}` until `ending.kind` is reported.
30. Call `get_position {}` to get the actual final machine Z. The operator then gauges the thread with an M2.5 go/no-go gauge or screw. If the job stopped, report its `ending` and agree recovery without a blind withdrawal. [WAIT]

## Readiness

- **Conversion declarations.** Neither can truthfully be declared now.
  - `tool_center_path`: the fixture's D=0 header satisfies the compensation meaning, but its geometry is for a 1.38 mm cutting OD and a 2.25 mm effective length, not this cutter. I'll declare it only on the regenerated export, after checking that its header shows D=0 / tool centre and that CUTTER DIAM equals the verified crest OD.
  - `tool_length_applied`: false. The probe is fitted and the current work Z history is unknown. It becomes true once work Z0 has been measured with the probe (steps 10–15) and moved to the thread mill through the flow A setter pair (steps 16–24), and `get_position` shows the `originOffset.z` delta.
- **Submission.** Before any `submit_gcode_job` is staged, all of these must hold:
  - the regenerated export has been converted and reviewed, with warnings resolved
  - the head identity is known and the spindle mode matches it
  - G54 is verified and selected, XY is on the hole centre, and the Z0 recheck passed
  - the thread mill is fitted and its length transferred
  - the full-diameter depth and blind/through status have been checked against the deepest Z, including tip-to-crest and shank clearance
  - the approach from the actual position over the setter to X0 Y0 at Z328 passes the landmark and clamp checks
  - the operator has asked for the run, the door is shut and lubrication is decided

Counts: logical approvals = 1 Z probe + 1 origin set + 1 Z recheck + 4 tool change (flow A) + 1 job = 8, plus 1 conditional `traverse_xy` = 9. The branch where the existing G54 is verified skips 3, giving 5. Literal [APPROVAL] tags = 8. Operator waits = 3. Questions = 7.
