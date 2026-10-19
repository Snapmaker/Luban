# Plan: Prepare and stage an internal M4x0.7 single-tooth thread-milling job in a 3.3 mm bore

## Findings before anything moves

- The operator named the cutter (single-tooth, M4x0.7xD4x50L) and the bore (3.3 mm drilled, aluminium),
  but the setup checklist in `cnc-thread-milling/references/setup.md` requires cutting OD, effective
  cutting length, flutes, reach and neck/shank dimensions before a generator entry can be trusted —
  the prompt explicitly says the M4 cutter's dimensions and flute count were not supplied.
- The "7.5 mm tip-to-shank reach" figure the operator gave is stated to belong to the **M2.5**
  cutter comparison, not this M4 cutter — it cannot be reused for the M4 single-tooth tool's reach.
- `setup.md` states directly: "A 7.5 mm reach cannot provide an 8 mm thread." The requested depth here
  is 8 mm, so the M4 single-tooth cutter's actual usable reach is a hard blocker, not a convenience
  question, until it is confirmed to exceed 8 mm plus tooth-to-tip and clearance margin.
- The designation's D4 shank (4 mm) is wider than the 3.3 mm drilled hole itself: the shank cannot
  enter the bore at all, so whatever necked/cutting portion does enter must clear the whole 8 mm
  depth on reach alone — reinforcing the same blocker from a different angle.
- Handedness (RH/LH) and climb/conventional direction were not stated in this message; `setup.md` and
  `import.md` both forbid silently defaulting these — the source program is what encodes them, and the
  importer has no flag to change them after the fact.
- Blind vs through hole, and the fit/class wanted for the M4x0.7 thread, are also not stated.
- Per the fixture in this dry run, the touch probe is assumed fitted (not the M4 cutter), and the
  existing work origin's tool history is unknown — `originOffset` alone never proves which tool
  set Z0, so a tool-change (flow A) is presumptively needed before `tool_length_applied: true` can
  be declared truthfully.
- The fitted head (`connectedHead.toolHead`) is not yet read; it governs `spindle_mode`
  (`cnc_200w_rpm` vs `power_percent`) and is not decided by `headType: "cnc"` alone.
- The hole's XY feature centre relative to the current/verified work frame is not stated; measuring
  it later with the touch probe (a 3.3 mm bore) needs the stored probe-tip diameter checked first —
  per `setup.md`, an oversized stylus must never be proposed for that hole.
- Nothing here authorises any motion; this whole turn is read-only calls plus one operator question
  batch.

## Questions for the operator (one message)

1. What is the actual cutting (thread-form) OD of the single-tooth M4x0.7xD4x50L cutter — from its
   tool drawing or a measurement? (Needed for the generator's Cutter Diameter field and to confirm
   it can orbit inside the 3.3 mm bore.)
2. What is that single-tooth cutter's usable reach (tip to where the shank/neck stops further
   insertion) — is it confirmed greater than 8 mm plus margin for tooth-to-tip geometry and
   clearance? Please don't infer this from the M2.5 cutter's 7.5 mm figure — that number was for
   the other tool.
3. What is this cutter's flute count, and its effective cutting length if that differs from the
   reach answered above?
4. Is the 3.3 mm hole blind or through, and what is the block thickness / full-diameter depth
   available beyond the 8 mm wanted (for bottom clearance or through-hole overrun)?
5. Thread handedness (RH or LH) and cutting direction (climb or conventional) for this job?
6. Is a standard M4x0.7 6H internal fit acceptable, or is a specific fit/class required?
7. Do you have the manufacturer's recommended cutting speed, feed per tooth and radial-pass
   depth percentages for this cutter in aluminium, or should we choose conservative values
   together once the head is confirmed?
8. What tool was in the spindle when the current work-Z origin (and X/Y datum for this block) was
   set — the touch probe, or a different cutter? Do you have this hole's measured XY position in
   that work frame already, or should it be probed once the cutter geometry above is confirmed
   (checking the stored probe-tip diameter fits the 3.3 mm bore first)?

## Steps

1. `get_stored_state {}` — read landmarks, tool-setter config/measurement history, probe geometry
   (`effectiveLength`), limits. Read-only, no approval.
2. `get_position {}` — confirm `reliability`, `isHomed`, `machineStatus`, `warnings`, and read
   `originOffset`. Read-only, no approval.
3. `get_machine_profile {}` — read `connectedHead.toolHead` to identify the actual fitted head
   (standard CNC vs 200 W) for the eventual `spindle_mode` choice; `toolHeads`/`headType: "cnc"`
   alone won't settle it. Read-only, no approval.
4. `get_tool_setter_config {}` — read stored reference and `measurements.last` (which tool, which
   session) to plan the tool-change flow. Read-only, no approval.
5. Ask the operator the numbered questions above, in one message. [WAIT]

-- end turn --

6. (After answers) Tell the operator exactly what to enter into the Machining Doctor generator:
   Internal, M4 nominal / confirmed programmed major diameter and 0.7 mm pitch, thread length
   8 mm (adjusted for blind/through per their answer), RH or LH and climb/conventional per their
   answer, Tool: single tooth, Cutter Diameter = the confirmed cutting OD, Efective Length = the
   confirmed effective cutting length, flutes = confirmed count, material = aluminium with the
   confirmed or conservative speed/feed/radial-pass inputs, output controller = Fanuc (or their
   preferred supported dialect), D=0/tool-centre path, explicit units (mm) and precision, XYZ datum
   in the existing/verified work frame, explicit axial/radial safety distances. This is an operator
   action, not a tool call.
7. Wait for the operator to paste the complete generator export. [WAIT]

-- end turn --

8. `convert_thread_milling_gcode {"gcode": "<pasted export>", "source_controller": "fanuc",
   "tool_center_path": true, "tool_length_applied": true, "spindle_mode": "<cnc_200w_rpm |
   power_percent per step 3's answer>", "spindle_power_percent"?: <if power_percent>}` — offline,
   no connection, no approval. Only assert `tool_length_applied: true` once the tool-change below
   has actually transferred Z to the M4 cutter (or the operator confirms this cutter already set
   the current origin this session); otherwise convert with the same-shaped call once that is true
   and treat an earlier conversion as provisional review only.
9. Review `gcode`, `changes`, `warnings`, `sourceSpindleRpm`, arc/segment counts and `validation`
   against the internal-thread checklist: bore centre/depth/bottom clearance, cutter+neck+shank fit
   for the entire insertion given the confirmed reach, approach/lead-in/every helical pass/lead-out/
   withdrawal, actual vs nominal turns (8 / 0.7 ≈ 11.43), deepest point vs blind bottom or through
   clearance. No approval (analysis only).
10. If the reach, cutting OD or any checklist item does not clear the bore/depth: stop, report the
    mismatch, and ask the operator to regenerate rather than hand-patching the file.
11. `run_tool_setter {"bit_length_mm": <operator-stated approximate probe protrusion>,
    "accept_probe_contact": true, "reason": "measure outgoing touch probe before M4 cutter swap"}`
    — measure the OLD tool (touch probe, per this fixture's default). [APPROVAL]
12. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` (background wait).
13. `goto_tool_change_position {}` — park for the manual swap. [APPROVAL]
14. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` (background wait).
15. Operator swaps the touch probe for the M4 single-tooth cutter by hand. [WAIT]

-- end turn --

16. Ask the new cutter's approximate protrusion if not already given, then
    `run_tool_setter {"bit_length_mm": <operator-stated>, "reason": "measure incoming M4
    single-tooth cutter"}` — measure the NEW tool. [APPROVAL]
17. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` (background wait).
18. `apply_tool_length_offset {"reason": "tool change: probe -> M4 single-tooth thread mill,
    <date>"}` — shifts work Z by new − old; this is what makes `tool_length_applied: true`
    truthful for the conversion above. [APPROVAL]
19. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` (background wait).
20. `get_position {}` — verify `originOffset.z` changed by the expected delta; operator
    sanity-checks displayed work Z against the physical block. Read-only, no approval.
21. If the hole's XY feature centre in the current work frame is still unconfirmed from question 8
    and the stored probe-tip diameter clears the 3.3 mm bore: `probe_circle {...}` with the
    operator's min/max diameter bounds and a measured top height, to establish/verify the centre.
    [APPROVAL] (conditional branch — skip if the operator already supplied a verified XY datum, or
    if the touch probe is no longer fitted at this point — in that case this measurement must
    happen BEFORE the tool change in step 11, not after.)
22. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` (background wait, if 21 ran).
23. `validate_gcode {"gcode": "<reviewed converted text>"}` — read warnings (extents, spindle
    state, frame). No approval.
24. `submit_gcode_job {"gcode": "<reviewed converted text>", "name": "m4-thread-hole1.nc",
    "head_type": "cnc", "frame": "work"}`. [APPROVAL]
25. Read the operator the confirm page's Frame row and machine-resolved Z extents; deliver the
    confirm URL as the last line and end the turn.

-- end turn --

26. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` in the background (or
    `confirm_token`).
27. `get_gcode_job_status {"job_id": "<id>", "wait_ms": 110000, "since_event": <n>}` — long-poll to
    completion; report `ending.kind`.
28. Report the completed/stopped result to the operator; recommend inspecting the thread with an
    appropriate gauge — completion proves execution, not thread fit.

## Readiness

- Conversion declarations: `tool_center_path: true` can be declared once the Machining Doctor
  output is confirmed D=0/tool-centre with zero compensation (the standard export, unmodified).
  `tool_length_applied: true` can be declared truthfully only after the tool-change flow above has
  actually transferred work Z to the fitted M4 single-tooth cutter via a same-connection
  `apply_tool_length_offset`, or the operator confirms this exact cutter already set the current
  origin this session — never from `originOffset` alone.
- Submission: before `submit_gcode_job` is staged, all of the following must be true: (1) the M4
  single-tooth cutter's cutting OD, reach and effective cutting length are confirmed to clear the
  3.3 mm bore and reach the full 8 mm depth with margin; (2) handedness, cutting direction, fit/class
  and blind/through depth are operator-confirmed, not defaulted; (3) the actual fitted head is read
  from `get_machine_profile` and the matching `spindle_mode` (with real feeds/speeds for that head
  and aluminium) is used, not the RPM example from the skill; (4) the hole's feature centre is
  registered to a verified work frame (measured or operator-supplied, not a CAD guess); (5) work Z
  is proven to reference the fitted M4 cutter's tip (post tool-change) before conversion's
  `tool_length_applied` is asserted; (6) `validate_gcode` has been run on the exact converted text
  and its warnings resolved against the internal-thread checklist; (7) clamps clear of the XY
  extents and stock thickness vs. deepest Z has been checked in the same preflight batch as the
  door/extraction check.

Counts: logical approvals=5 (tool change 4 + 1 file job) on the branch where the feature centre is
already known, or 6 if `probe_circle` is needed to establish it; literal [APPROVAL] tags=5 (6 with
the conditional probe_circle); operator waits=3 ([WAIT]: answering the question batch, pasting the
generator export, physically swapping the tool) plus the implicit confirm-page clicks folded into
each [APPROVAL]; questions=8.
