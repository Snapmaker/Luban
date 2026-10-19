# Plan: thread 4x M2.5x0.45 + 2x M4x0.7 through holes in a 5 mm plate, probe -> M2.5 triple-row -> M4 single-row, one WCS, one file job per hole

## Findings before anything moves

- **Checklist (fixture results, to be re-read live in step 1):** connection: A350 CNC over Wi-Fi, connected. Position: `reliability: verified`, homed, idle, machine X-19 Y342 Z328, `warnings: []`. Height: at park Z328 (floor machine Z320, park Z328 from `get_stored_state.limits`). Tool: touch probe fitted. Frame: every plan number below is either machine frame or a `frame: "work"` file resolved by the MCP. No bare Z anywhere. Authority: nothing is staged until the operator answers the question batch. The operator asked for a plan, not for a cut.
- **Nothing can be converted yet. The existing fixture is no recipe.** `thread-milling-m2_5-fanuc.nc` declares `CUTTER DIAM=1.38, L=2.25 [MULTI TOOTH]`. 1.38 mm is the stated **neck** of the operator's cutter, not its cutting OD (setup.md "Keep the dimensions separate"). The path's nominal orbit radius 0.575 mm gives 2 x 0.575 + 1.38 = 2.53 mm, so the cutting OD is built into the path. If the real OD is larger, the thread overcuts. The M2.5 cutting OD is **unknown**, so no M2.5 program can be generated until it is measured.
- **The fixture's axial step is too big for a three-row cutter.** It advances 0.056 + 0.45 + 0.056 + 1.688 = 2.25 mm between axial positions. Three rows at 0.45 mm cover only about 1.35 mm per turn, so the gaps would leave unthreaded bands. A regenerated 5 mm thread with about 1.35 mm verified effective length needs about 4 axial positions, not 3. Confirm against the manufacturer's effective length; rows x pitch is only a sanity check.
- **The fixture is datumed at X0 Y0, the plate corner.** Every hole needs its own export with its XY centre as the generator datum: (10,10), (60,10), (10,40), (60,40), (35,15), (35,35). That makes 6 programs. They are not concatenated and not joined over work Z20 (setup.md "Multiple holes or bosses"). Reusing the fixture unchanged would thread air at the plate corner.
- **Other fixture traps that carry into the regenerated files:**
  - `S17991` is legal only in `cnc_200w_rpm` mode, and `connectedHead.toolHead` is withheld, so the spindle mode is undecided.
  - `G00 X0 Y0` runs before the first Z block, so each file's first move is XY at whatever Z the head is at.
  - The deepest point is work Z-5.056. On a 5 mm through plate the tip and the lowest tooth go below the plate bottom.
  - `M08` is removed, so there is no coolant.
  - `M06 T1` is removed, so the tool must already be fitted.
  - `G41 D1` / `G40` are removed under the D=0 tool-centre header. D1 is a register number, not a 1 mm correction.
- **M2.5 reach looks sufficient on paper but must be checked against the real export.** The 7.5 mm tip-to-shank reach against a 5 mm plate leaves about 2.4 mm above the plate top at a deepest tip of about work Z-5.06, before any tooth-to-tip offset or overrun. Check this against the actual exported deepest Z, not the nominal. The neck (1.38) and the cutting OD must both orbit inside the drilled bore, whose diameter is unknown.
- **M4 cutter choice: single-row recommended, not yet confirmed.** Both are `M4x0.7xD4x50L`. D4 is the 4 mm **shank** and 50L the overall length. Neither is reach, cutting OD or effective length, all three are unknown for both cutters, and a 4 mm shank cannot enter an M4 bore, so reach below the shank must exceed 5 mm plus overrun.
  - Single-row: a continuous helix, 5 / 0.7 = about 7.1 turns, the least simultaneous engagement. That suits the A350's low rigidity and a small 4 mm-shank tool, and cycle time on a 5 mm hole is trivial.
  - Triple-row: covers about 3 x 0.7 = 2.1 mm per turn, so it needs about 3 axial repositionings in a 5 mm thread. It engages 3 forms at once and its lowest forms overrun further below the plate.
  - The choice does not change the interruption count: one swap either way. This is conditional on the single-row's measured reach and OD fitting the bore. No force ratio is promised.
- **Origin Z was set with the touch probe, so the first swap must measure the probe itself.** `run_tool_setter` with `accept_probe_contact: true`. The stored probe `effectiveLength 71.3` is calibration, not a same-session setter reading. The old trigger can never be reconstructed as setter surface + 71.3. The setter's `measurements` history must be read (`get_tool_setter_config`) before any reuse is claimed. None is claimed for swap 1.
- **`originOffset` does not say how XY was set.** It proves the mapping, not the datum. The holes span 50 mm in X, so a plate rotated 0.5 deg against machine X moves (60,40) by about 0.5 mm. The drilled holes may also sit off their nominal centres, which makes an eccentric thread. The datum method and any recheck must be settled **while the probe is still fitted** (work-datums.md). The M2.5 bores (about 2.05 mm tap drill) are too small to probe. The M4 bores (about 3.3 mm) may take a `probe_circle` only if the stored tip diameter and the required radial travel fit. Never push an oversized stylus in.
- **Converted files emit `G54`.** workspaces.md says the validator leaves machine extents **unresolved** for a file that names a workspace, "including a single explicit G54". So the confirm page may not show machine-resolved Z extents. The live G54 must be verified as the operator's plate origin, and each file reviewed against that verified offset. The probing and setter tools may reselect G54, so re-read it before each file job.
- **Route and landmarks.** Each file's first move is XY at the current Z. At machine Z328 after `run_tool_setter` or the park that is above the floor. The whole segment from the actual start (setter, park spot or the previous hole's finish XY) to the hole must still clear the rotary landmark's `requiredToolheadZ` from `get_stored_state`. Its full-segment requirement is read, not invented. Plate clamps within work Z0 to Z20 near a hole, or on the descent column, are unmapped and are the operator's to state.
- **After each file job, re-read `get_position`.** Completion raises Z at the finish XY, but by how much is not proven by the source's work Z20. If Z is below 320, the next job's first XY move is not lawful and needs a separately authorised `move_z` (conditional).
- **Fewest interruptions has a floor.** This importer produces one file job per hole (6 clicks), and each flow-A swap is 4 clicks, or 3 when the old-tool reading legitimately qualifies for reuse. A single multi-hole program would need custom CAM with its own full review. It is out of scope and is not offered as a shortcut.

## Questions for the operator (one message)

1. **M2.5 triple-row cutter:**
   - cutting OD across the crests (tool drawing or micrometer; the 1.38 neck is not usable)
   - manufacturer effective cutting length, and tip-to-lowest-crest distance
   - flute count
   - approximate protrusion from the collet, for the setter approach (declare low)
2. **The two M4 cutters:** for each, the same data as question 1: cutting OD, reach from tip to the shank or neck step, effective length (triple-row), flutes and protrusion. I recommend the **single-row**, provided its reach clears 5 mm plus overrun. OK, or do you prefer the triple-row?
3. **Thread spec:**
   - full 5 mm thread length through the plate?
   - RH, and climb or conventional?
   - fit/class (for example 6H) and the programmed major diameters (your fixture used 2.53 for M2.5; what for M4?)
   - number of radial passes
4. **Bores and what is under the plate:**
   - actual pre-drilled diameters for the M2.5 and M4 holes
   - what is under each hole (spoilboard, sacrificial sheet, air gap) and how far the tip may go below the plate bottom
   - clamp positions, and their height above the plate top near any hole
5. Plate material (for speeds and feeds).
6. **Which CNC head is fitted: standard or 200 W?** Standard needs `power_percent` with an integer % you choose. 200 W keeps RPM in 8000–18000.
7. **How was the work origin made?**
   - XY: probed on the front and left edges, or set by eye?
   - Z: probe contact on the plate top, with work Z0 set at that toolhead Z?
   - any tool change or re-zero since?
   - was the plate checked square to machine X?
   Do you want me to probe-check the two M4 bore centres before the probe comes out? That is 2 extra approvals, only if the stored tip fits the bore.
8. **Tool-change flow:** A (MCP-managed from the computer, recommended for fewest interruptions) or B (touchscreen wizard)?
9. For the M2.5 -> M4 swap: if the four M2.5 jobs all end `completed` with no alarm, and nobody touches the cutter, may I reuse the M2.5 setter reading from this session instead of re-measuring? That saves 1 approval (13 instead of 14). I will restate it on the park page, and rejecting that page switches to re-measuring.
10. **Six regenerated Machining Doctor exports**, ideally attached with your answers. Settings:
    - controller Fanuc, D=0 tool-centre path, G21, precision 4 or more
    - Z datum 0 at the plate top
    - XY datum at each hole centre as listed
    - M2.5: "multi tooth shorter than thread" with the verified effective length
    - M4: "single tooth", unless you choose otherwise in question 2
    - your spindle speed and feeds for the head and material above
11. Door shut and extraction on for the cut?

-- end turn --

## Steps

*Turn 1: read-only calls, no approvals, before sending the questions above.*
1. `get_connection_status {}`, `get_position {}`, `get_stored_state {}`, `get_machine_profile {}`, `get_tool_setter_config {}`, `get_probe_feed_status {}`. Quote the checklist block. Record `originOffset`, `limits`, landmarks' `requiredToolheadZ`, `geometry.probe` (effectiveLength and tip diameter), setter centre and `measurements.last`, `connectedHead.toolHead`, and the feed transport with the Tool Setter and Overtravel pills green. Then send the question batch.

-- end turn --

*After the answers and exports arrive. Probe still fitted.*

2. Offline review of the six sources. For each: the header `CUTTER DIAM` equals the measured cutting OD, the effective length equals the manufacturer value, the axial step is no more than coverage, the XY datum is the hole centre, the deepest Z is within the reach and the under-plate allowance, and D=0. Anything wrong goes back to the generator (one message, only if needed). No conversion yet: `tool_length_applied` is not yet true.
3. *(Conditional on question 7: operator wants the bore check and the stored tip fits.)* `probe_circle` inside the M4 bore at work (35,15). Its machine centre comes from the fresh `get_position.originOffset` read by the MCP. It uses the operator's min/max diameter bounds and the measured plate-top toolhead Z from the origin record. Link, end turn, `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [APPROVAL]
4. *(Conditional, same as step 3.)* `probe_circle` at work (35,35), same form [APPROVAL]. Compare the fitted centres to nominal. If they are off by more than the thread tolerance, stop and discuss before any cutting.

*Swap 1 (flow A): probe -> M2.5 triple-row*

5. `run_tool_setter {"bit_length_mm": 70, "accept_probe_contact": true, "reason": "Swap 1 old tool: touch probe that set work Z0 on plate top; stored effectiveLength 71.3 declared low"}`. Deliver the link and end the turn, then `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background. Read the spread and `result.finalZ` (machine Z328). [APPROVAL]
6. `goto_tool_change_position {}`. Link, end turn, then two `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` calls (Z up, then XY). [APPROVAL]
7. Operator removes the touch probe, fits the M2.5 triple-row cutter and replies "done" with its protrusion. [WAIT]

-- end turn --

8. `run_tool_setter {"bit_length_mm": <operator's M2.5 protrusion, declared low>, "reason": "Swap 1 new tool: M2.5x0.45 triple-row"}`. Link, end turn, `start_gcode_job`. Check the spread. [APPROVAL]
9. `apply_tool_length_offset {"reason": "Swap 1: probe -> M2.5 triple-row, setter pair from steps 5 and 8, this connection"}`. Link, end turn, `start_gcode_job`. [APPROVAL]
10. `get_position {}`. `originOffset.z` must have changed by new - old; ask the operator to sanity-check the displayed work Z in the same message as the next link. Record the chain: plate top Z0 by probe -> setter pair -> M2.5 tip. `tool_length_applied` is now true for the M2.5 cutter.
11. `convert_thread_milling_gcode` four times, offline, e.g. `{"gcode": "<complete regenerated export, M2.5 at work (10,10)>", "source_controller": "fanuc", "tool_center_path": true, "tool_length_applied": true, "spindle_mode": "<cnc_200w_rpm | power_percent>", "spindle_power_percent": <operator's integer, only for power_percent>, "chord_tolerance_mm": 0.002}`. Repeat for (60,10), (10,40) and (60,40). For each, review `changes`, `warnings`, `sourceSpindleRpm`, arc/full-circle/segment counts and `validation`:
    - centre XY
    - pitch per turn and the number of axial positions
    - deepest Z against the plate and the allowance below it
    - final retract
12. `validate_gcode {"gcode": "<converted text>"}` for each of the four. Read the warnings to the operator. A spindle-on Z below 0 is expected in a through hole.
13. Hole M2.5-1: `get_position {}`. It must be at or above Z320, reliable and in G54, and the segment from here to the hole must clear the landmarks. Then `submit_gcode_job {"gcode": "<converted (10,10) text>", "name": "M2.5x0.45 hole (10,10) triple-row.nc", "head_type": "cnc", "frame": "work"}`. Read the Frame row and the extents (unresolved if the G54 selector blocks resolution; then quote the review against the verified G54 offset). Link, end turn, `start_gcode_job`, then `get_gcode_job_status {"job_id": "<id>", "wait_ms": 110000, "since_event": <n>}` until `ending.kind`. The operator may gauge this first hole before clicking the next page. [APPROVAL]
14. Hole M2.5-2 at (60,10): `get_position` (Z at or above 320? If not, see step 25), then submit, link, start and poll exactly as in step 13. [APPROVAL]
15. Hole M2.5-3 at (10,40): same as step 14. [APPROVAL]
16. Hole M2.5-4 at (60,40): same as step 14. [APPROVAL]

*Swap 2 (flow A): M2.5 -> M4 single-row (or the triple-row, per question 2)*

17. `get_tool_setter_config {}`. `measurements.last` must be the step-8 M2.5 reading from this connection, and all four jobs must have ended `completed` with no alarm or contact. **Reuse branch:** old tool = step-8 reading; no new approval. **Otherwise:** `run_tool_setter {"bit_length_mm": <M2.5 protrusion, low>, "reason": "Swap 2 old tool: M2.5 triple-row"}`, link, end turn, start. [APPROVAL, re-measure branch only]
18. `goto_tool_change_position {}`. The page message restates the reuse condition from question 9. Link, end turn, then two `start_gcode_job` calls. [APPROVAL]
19. Operator swaps to the M4 cutter and replies with its protrusion. [WAIT]

-- end turn --

20. `run_tool_setter {"bit_length_mm": <M4 protrusion, declared low>, "reason": "Swap 2 new tool: M4x0.7 single-row"}`. Link, end turn, start. [APPROVAL]
21. `apply_tool_length_offset {"reason": "Swap 2: M2.5 -> M4, setter pair step 8 (or 17) and step 20, this connection"}`. It defaults to the last two measurements. On the reuse branch those are step 8 and step 20, and the page must show exactly those two. Otherwise pass `old_trigger_z` / `new_trigger_z` from those two job results. Link, end turn, start. [APPROVAL]
22. `get_position {}`. Verify the Z delta, and the operator sanity-checks the work Z.
23. `convert_thread_milling_gcode` for M4 (35,15) and (35,35), with the same declarations and spindle policy. Review as in step 11 (about 7 turns for single-row, reach against deepest Z). Then `validate_gcode` for both.
24. Hole M4-1 at (35,15), then hole M4-2 at (35,35). Each is `get_position`, `submit_gcode_job {"gcode": "<converted text>", "name": "M4x0.7 hole (35,15) single-row.nc", "head_type": "cnc", "frame": "work"}`, link, end turn, start, poll. [APPROVAL] [APPROVAL]
25. *(Conditional, before any job in steps 14–16 or 24.)* If `get_position` shows the head below machine Z320 after a completed job: ask "may I raise Z first?", and on the operator's word `move_z {"z": 328, "coordinate_system": "machine", "reason": "Restore park height before next hole"}`, link, end turn, start. [APPROVAL] [WAIT]
26. Operator checks all six threads with M2.5 and M4 go/no-go gauges. Completion is not fit. I report every `ending` and note that the M4 cutter is now in the spindle and work Z is referenced to its tip. [WAIT]

## Readiness

- **Conversion declarations.**
  - `tool_center_path: true` is true for regenerated exports with the D=0 tool-centre header, once the header's `CUTTER DIAM` is the **measured cutting OD**. It is not true for the fixture as-is (the diameter is the neck).
  - `tool_length_applied: true` becomes true only after the flow-A chain completes and is verified for the fitted cutter. That is steps 5–10 for M2.5, and 17–22 for M4.
  - Before that, keep the sources and convert nothing. A declaration is not asserted just to get a preview.
  - The spindle mode needs the operator's head answer.
- **Submission.** All of the following must hold:
  - a converted and reviewed file for the exact hole and cutter, with `validate_gcode` read
  - the operator's word in their latest message to cut
  - a fresh `get_position`: reliable, homed, idle, no warnings, head at or above Z320, live G54 equal to the verified plate origin
  - the whole segment from the actual position to the hole clear of every landmark's `requiredToolheadZ` and the operator-stated clamps
  - under-plate clearance confirmed for the file's deepest Z plus the tooth-to-tip offset
  - door shut and extraction on
  - the correct cutter fitted, with the setter delta verified in `originOffset`

Counts: logical approvals = flow A with reuse: swap 1 x 4 + swap 2 x 3 + 6 jobs = 13; re-measure branch: 4 + 4 + 6 = 14; optional bore check +2; each conditional Z raise +1. Literal [APPROVAL] tags = 17 (steps 3, 4, 5, 6, 8, 9, 13, 14, 15, 16, 17, 18, 20, 21, 24 x2, 25; of these steps 3, 4, 17 and 25 are conditional). Operator waits = 4 on the main path (answers and exports, swap 1, swap 2, final gauge; +1 per conditional raise). Questions = 11.
