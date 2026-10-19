# Plan: Convert the M2.5 internal thread-milling fixture, but stop for operator input before declaring it ready — the stated cutter does not match what the file assumes

## Findings before anything moves

- `get_position` (fixture): reliability `verified`, homed, idle, machine X-19 Y342 Z328 — already at the park height; motion is legal in principle.
- `get_connection_status` (fixture): connected to the A350 over Wi-Fi.
- Tool fitted (fixture): the touch probe, not the thread mill — a tool-change to the cutter is required before cutting, and `tool_length_applied: true` cannot reference a tool that is not yet fitted.
- A work origin exists, but its tool history is unstated by both the fixture and the operator's message — `originOffset` alone never proves which tool established it (`cnc-thread-milling` SKILL.md, `tool-change` SKILL.md).
- `geometry.probe.effectiveLength` is stored at 71.3 mm — this is probe calibration, not a same-session tool-setter reading, and is irrelevant to the cutter's length transfer.
- Motion floor machine Z320, park Z328 (fixture `limits`) — matches the current position.
- Tool setter is configured, but its measurement history is unread — needed before claiming any same-tool/same-session reuse in the tool change.
- `connectedHead.toolHead` is withheld; `headType: cnc` and the compatible-head list do not distinguish the standard head from the 200 W head — `spindle_mode` cannot be chosen without asking.
- A rotary landmark exists; its full-segment clearance requirement is unread. The source file's first move is `G00 X0 Y0` in the WORK frame *before* any Z positioning — the whole segment from wherever the head actually is to that XY must be checked against the motion floor and this landmark before the job is ever staged (`cnc-thread-milling` setup.md, `docs/thread-milling.md`).
- **The supplied file is the repository's own regression fixture**, and the setup reference (`cnc-thread-milling/references/setup.md`) names this exact trap: the file's toolpath was generated assuming `CUTTER DIAM=1.38` as the **cutting OD** (`2 × 0.575 mm orbit radius + 1.38 mm = 2.53 mm` major diameter). The operator instead gave 1.38 mm as the cutter's **neck** diameter — a different quantity that the skill explicitly says must not be accepted as evidence the cutter matches the path.
- The file advances 2.25 mm between the three axial cutting positions (`0.056 + 0.45 + 0.056 + 1.688`). Three rows at 0.45 mm pitch suggest only ≈1.35 mm of real axial coverage. If the actual cutter's effective cutting length is close to that 1.35 mm figure rather than 2.25 mm, this file would leave unthreaded bands — this is the second half of the same documented regression trap, and the operator's cutter ("triple row threads, triple flute") matches the trap's description, not necessarily the file's assumptions.
- Cutter reach is stated as "7.5 mm long including triple row threads," which is ambiguous between overall usable reach and some other dimension; the bore is 6 mm deep and the file's deepest point is work Z−5.056 with final cutting point work Z+0.006 — reach must be confirmed before clearance can be judged.
- Thread length in the file (5 mm) is shorter than the drilled depth (6 mm), which is consistent with a blind hole, but a 6 mm "drilled" depth may itself include the drill point rather than full-diameter depth (setup.md) — worth a sanity check with the operator, not assumed.
- Spindle: file carries `S17991`, inside the 200 W head's 8000–18000 RPM window — only usable in `cnc_200w_rpm` mode, and only if the 200 W head is actually fitted.
- The operator's "get it converted and ready to run" is an imperative that authorises **staging** the eventual procedure (motion law 6's resolution), never motion itself and never a declaration made ahead of its evidence — each declaration and each staged step still needs its own truth/click.

## Questions for the operator (one message)

1. Which head is fitted right now — the standard CNC head or the 200 W CNC head? `connectedHead.toolHead` came back withheld, so this decides `spindle_mode` (`cnc_200w_rpm` keeping the file's S17991, or `power_percent` with a percentage you choose for the standard head).
2. What is the cutter's actual **cutting diameter** — the diameter across the cutting crests, not the 1.38 mm neck you gave? The file's helical path was built assuming a 1.38 mm cutting diameter; if the real cutting OD is different, this exact file will over- or under-cut the thread and would need to be regenerated in Machining Doctor with the correct value, not hand-patched.
3. What is the cutter's **effective cutting length** (the axial span the three thread-forming rows actually occupy)? Three rows at 0.45 mm pitch suggest roughly 1.35 mm; the file assumes enough coverage to advance 2.25 mm between positions. If your cutter's real coverage is nearer 1.35 mm, this file needs regenerating with the correct effective-length input to avoid unthreaded bands.
4. Does "7.5 mm long including triple row threads" describe the tool's overall length or its usable reach (tip to the shank/first obstruction)? I need the reach figure against the 6 mm bore depth plus neck/shank clearance.
5. How was the current work origin (G54) established, and with which tool — the touch probe, this cutter, or something else? `tool_length_applied: true` requires the origin to reference the fitted cutter's tip; if that history isn't a verified chain, we'll need to re-establish it rather than assume it.
6. Is the plate's registered work origin a verified, recheckable measurement of *this* hole/plate in its current mounting, or does it still need probing before I treat the setup as ready?
7. For the tool change from the touch probe to this cutter: are you at the computer for the MCP-managed flow (I measure both tools on the setter and shift the origin automatically), or at the machine for the touchscreen wizard? Either way, what is each tool's approximate protrusion from the collet (never the cutting diameter)?

## Steps

1. `get_connection_status {}` — confirm connected (no confirm page; read-only).
2. `get_position {}` — confirm reliability, homing, warnings, machine coordinates (read-only).
3. `get_stored_state {}` — read landmarks (rotary full-segment clearance), tool setter config + measurement history, probe geometry, limits, all in one call (read-only).
4. `get_machine_profile {}` — read `connectedHead.toolHead` and `toolHeads` (read-only).
5. Ask the operator the seven questions above in one message.
`-- end turn --`
[WAIT] for the operator's answers — nothing below runs until they arrive.

6. (depends on Q2/Q3) If the actual cutting OD or effective cutting length differs from the file's built-in 1.38 mm / ~2.25 mm assumptions: tell the operator this exact export cannot be trusted for their cutter and that Machining Doctor needs to be re-run with the correct Cutter Diameter / Effective Length fields — the fixture stays unchanged as regression evidence, it is not something to hand-edit. Stop here and wait for either a regenerated export or the operator's explicit confirmation that the file's assumed geometry already matches their tool.
`-- end turn --`
[WAIT] for a regenerated file or explicit confirmation.

7. (depends on Q1, and on Q2/Q3/step 6 resolving favourably) `convert_thread_milling_gcode {"gcode": "<the confirmed-correct source text>", "source_controller": "fanuc", "tool_center_path": true, "tool_length_applied": true, "spindle_mode": "cnc_200w_rpm" | "power_percent", "spindle_power_percent": <operator's chosen percent, only for power_percent>, "chord_tolerance_mm": 0.002}` — offline, no motion, no approval. `tool_center_path: true` is supportable straight from the file's own `CUTTER COMPENSATION D=0` header; `tool_length_applied: true` is only honest once Q5 confirms the origin's tool history (or is re-established — see steps 10–14 below) and the correct cutter is actually fitted.
8. Review the returned `gcode`, `changes`, `warnings`, `sourceSpindleRpm`, arc/segment counts and `validation`: units, datum, first positioning move, entry/exit, signed Z travel, pitch per turn, axial repositioning against the confirmed effective length, every radial pass, deepest point (work Z−5.056) against the confirmed reach and the 6 mm bore, final retract (work Z20).
9. `validate_gcode {"gcode": "<converted text>"}` — read the warnings (read-only).

Tool change (assuming Flow A per the operator's Q7 answer; Flow B substitutes the touchscreen-wizard sequence from `tool-change` SKILL.md):

10. `run_tool_setter {"bit_length_mm": <operator-stated probe protrusion>, "accept_probe_contact": true, "reason": "measure outgoing touch probe before swap to M2.5 thread mill"}` [APPROVAL]
    `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` [WAIT]
`-- end turn --`
11. `goto_tool_change_position {"reason": "park for manual swap to the thread mill"}` [APPROVAL]
    `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` [WAIT]
`-- end turn --`
12. Operator swaps the touch probe for the thread mill by hand. [WAIT] — never inferred.
13. `run_tool_setter {"bit_length_mm": <operator-stated cutter protrusion>, "reason": "measure incoming M2.5 thread mill"}` [APPROVAL]
    `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` [WAIT]
`-- end turn --`
14. `apply_tool_length_offset {"reason": "transfer work Z from probe to thread mill, run_tool_setter jobs <old id>/<new id>"}` [APPROVAL]
    `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` [WAIT]
`-- end turn --`
15. `get_position {}` — confirm `originOffset.z` moved by exactly the measured delta; operator sanity-checks the displayed work Z against physical reality (read-only).

Submit the reviewed program:

16. `submit_gcode_job {"gcode": "<reviewed converted text>", "name": "m2_5-internal-thread.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL] — read the confirm page's Frame row and machine-resolved Z extents to the operator as the message text, with the `confirm_url` as the last line.
    `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` [WAIT]
`-- end turn --`
17. `get_gcode_job_status {"job_id": "<id>", "wait_ms": 110000, "since_event": <n>}` — long-poll to completion; report `ending.kind`.
18. `get_position {}` — confirm actual finishing machine position (the file's work Z20 retract is not proof of it) (read-only).
19. Tell the operator completion is not a thread-fit certification — ask them to check the cut with an M2.5 thread gauge.

## Readiness

- **Conversion declarations:** `tool_center_path: true` is supportable now, straight from the file's own `CUTTER COMPENSATION D=0` header — that is a claim about the compensation register, not about whether the assumed 1.38 mm cutting diameter matches the real cutter. `tool_length_applied: true` is **not** truthfully declarable yet: the fitted tool is the touch probe, not the cutter, and the existing origin's tool history is unstated. It becomes true only after (a) Q5 confirms/repairs the origin's tool-reference history and (b) the tool-change sequence (steps 10–14) has transferred the origin to the actual thread mill's tip.
- **Submission:** before any `submit_gcode_job`, all of the following must hold: the cutter's real cutting OD and effective cutting length are confirmed to match the file's built-in assumptions (or the file has been regenerated in Machining Doctor to match them); the fitted head is identified and the matching `spindle_mode` chosen; the stated reach is confirmed sufficient for the 6 mm bore plus neck/shank clearance; the work origin has been verified as a measured, recheckable datum for this actual plate/hole and then transferred to the fitted cutter via `apply_tool_length_offset`; the rotary landmark's clearance requirement has been checked against the file's initial `G00 X0 Y0` segment from the actual current position; and `validate_gcode` has been read with no unresolved warnings against the internal-thread checklist.

Counts: logical approvals=1 tool change x 4 + 1 job = 5 (favourable branch, single hole, Flow A; the file-regeneration branch adds a wait but no new approval until a corrected file is resubmitted through the same count), literal [APPROVAL] tags=5, operator waits=9 ([WAIT] tags at steps 5, 6, 10, 11, 12, 13, 14, 16, plus the implicit wait folded into step 17's poll), questions=7.
