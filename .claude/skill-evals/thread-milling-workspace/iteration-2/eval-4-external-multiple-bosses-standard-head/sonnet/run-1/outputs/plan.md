# Plan: Convert and stage two per-boss external-thread programs (Okuma exports, standard head, 65% power)

## Findings before anything moves
- Fixture position: `get_position` → verified, homed, idle, machine (X−19, Y342, Z328) = home/park height, warnings empty; this must be re-read fresh, not assumed, before each staging step.
- `get_stored_state` is needed (not yet read) for the current `originOffset`/tool-history note, motion-floor (Z320) / park (Z328) limits, and the stored rotary landmark's full-segment clearance requirement — its number must be read, never invented.
- Tool in spindle: the operator states the correct cutter (not the touch probe) is fitted and work Z was set directly with it. No tool-change flow (`tool-change` skill, `apply_tool_length_offset`) is needed for this job — the tool that established Z0 and the tool now fitted are the same, by the operator's own word.
- Head: operator states the standard CNC head is fitted, chosen power 65%. `get_machine_profile.connectedHead.toolHead` is withheld/ambiguous per the fixture, and generic `headType: "cnc"` alone can't distinguish standard from 200 W — it still needs to be read and cross-checked against the operator's statement before conversion is finalized; only re-ask if it disagrees or stays null.
- Controller: `source_controller: "okuma"` — standalone G15 H1 maps to G54; G56/H length lookup is removed under the `tool_length_applied` declaration.
- Declarations: `tool_center_path: true` needs the actual export header confirmed as D=0/zero radius compensation; `tool_length_applied: true` needs work Z already referenced to the fitted cutter tip. The operator's statement supports both, but each must still be checked against the literal export text during review, not accepted on summary alone.
- Spindle: standard head → `spindle_mode: "power_percent"`, `spindle_power_percent: 65` (integer). This replaces the source RPM outright; it is not a calibration and feeds are retained unscaled.
- Two features under one common corner WCS, each with its own **per-boss** datum: per the setup/import references this must run as two separate `convert_thread_milling_gcode` calls producing two separate programs, each keeping its own feature's XY datum baked into its source export — never a shared (0,0) export re-run after a traverse, and never concatenated into one file.
- Neither export's literal gcode text has been supplied yet. `convert_thread_milling_gcode`'s `gcode` argument is the complete source text, not a description — nothing can actually be converted until it is supplied.
- Known importer trap (seen in the shipped M2.5 fixture): the source's first `G00 X0 Y0` runs at whatever height the head is already at, *before* the first Z positioning block — conversion adds no raise. The actual starting machine Z and the whole X0/Y0 segment for each converted program must be checked against the motion floor and every stored landmark (including the rotary landmark) at the fitted cutter's clearance, immediately before staging — not assumed safe from the source's nominal Z.
- This is external thread work on prepared bosses: review each converted program against the external-thread checklist (existing boss diameter/centre/height/shoulder-undercut clearance; cutter+neck+shank+holder+clamp space around the whole boss and above the shoulder at the deepest pass; approach outside the boss, lead-in, every helical pass, lead-out into free exterior space, axial withdrawal). An internal-bore clearance plan must not be reused for these.
- A completed job proves execution, not thread fit — the operator should check both bosses with a thread gauge afterward.

## Questions for the operator (one message)
1. Please supply the complete literal G-code text of both Okuma thread-milling exports — the one datumed at work (20,15) and the one datumed at work (70,15) — so each can be run through `convert_thread_milling_gcode` and reviewed. Everything else needed (controller, head, power, cutter/Z declarations) is already stated.

## Steps
1. `get_connection_status` — confirm connected. Read-only, no approval.
2. `get_position` — reliability (verified/heartbeat/cached-offset), homed, idle, warnings empty; note current `originOffset`. Read-only, no approval.
3. `get_stored_state` — current tool history on the work origin, motion-floor/park limits, the rotary landmark and any others with their clearance requirements, tool-setter config. Read-only, no approval.
4. `get_machine_profile` — read `connectedHead.toolHead`; cross-check against the operator's "standard CNC head" statement. Read-only, no approval.
5. Ask the operator the question above. [WAIT]
-- end turn --
6. (after receiving export A, boss @ work (20,15)) `convert_thread_milling_gcode {"gcode": "<complete export A text>", "source_controller": "okuma", "tool_center_path": true, "tool_length_applied": true, "spindle_mode": "power_percent", "spindle_power_percent": 65}` — offline; no connection, motion or approval involved.
7. Review export A's result against the external-thread checklist and its own source text: confirm the source header's D/compensation is actually zero and the removed G43/H block matches an already-referenced tool tip; confirm the emitted datum resolves to work (20,15); read `changes`, `warnings`, arc/segment counts and `validation`.
8. (after receiving export B, boss @ work (70,15)) `convert_thread_milling_gcode {"gcode": "<complete export B text>", "source_controller": "okuma", "tool_center_path": true, "tool_length_applied": true, "spindle_mode": "power_percent", "spindle_power_percent": 65}` — offline, same review as step 7, against work (70,15).
9. `validate_gcode {"gcode": "<converted A text>"}` then `validate_gcode {"gcode": "<converted B text>"}` — read-only static checks; review warnings against the checklist above, not accepted blind.
10. Re-read `get_position` and `get_stored_state` immediately before staging anything (state may have moved on since step 2–3): reliability still verified/heartbeat/cached-offset, still homed/idle, `originOffset` unchanged and still the reference whose tool history matches the fitted cutter; now that the boss coordinates resolve to machine coordinates through the live offset, confirm the rotary landmark (and any other stored landmark) does not sit below its required clearance across either boss's initial X0/Y0 segment or the rest of its approach.
11. `submit_gcode_job {"gcode": "<converted A text>", "name": "boss-ext-thread-work20-15.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]
12. Read the operator the confirm page's Frame row and machine-resolved Z extents; deliver the confirm URL as the last line, alone.
-- end turn --
13. `start_gcode_job {"job_id": "<id-A>", "wait_for_approval_ms": 110000}` [WAIT] (background poll; on `timed_out` call again — never restage or withdraw)
14. `get_gcode_job_status {"job_id": "<id-A>", "wait_ms": 110000, "since_event": 0}` — long-poll to `ending`.
15. `get_position` — re-read actual machine position after completion (the source's work Z20 retract is not proof of the final machine Z); confirm idle before the next job.
16. `submit_gcode_job {"gcode": "<converted B text>", "name": "boss-ext-thread-work70-15.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]
17. Read the operator the confirm page's Frame row and machine-resolved Z extents; deliver the confirm URL as the last line, alone.
-- end turn --
18. `start_gcode_job {"job_id": "<id-B>", "wait_for_approval_ms": 110000}` [WAIT]
19. `get_gcode_job_status {"job_id": "<id-B>", "wait_ms": 110000, "since_event": 0}` — long-poll to `ending`.
20. Report both jobs' `ending` to the operator and recommend a thread-gauge check of both bosses.

## Readiness
- Conversion declarations: `tool_center_path` and `tool_length_applied` can be truthfully declared once the two literal export texts are in hand and their headers are actually inspected (zero D/radius compensation; a G43/H block that is being removed rather than relied on) — the operator's summary ("verified cutter geometry", "work Z was set with it") is enough to plan on, not enough to skip checking the real text during review (step 7/8).
- Submission: before either `submit_gcode_job`, both programs must be converted and reviewed against the external-thread checklist, `validate_gcode` run with warnings resolved against that review, a fresh connection/position/stored-state read confirming unchanged tool history on the work origin, and confirmation that neither boss's resolved-to-machine approach segment (including the source's pre-Z-move X0/Y0 hop) crosses the rotary landmark or any other stored landmark below its required clearance for the fitted cutter.

Counts: logical approvals=2 (one file job per boss, no tool change needed) x 1 = 2, literal [APPROVAL] tags=2, operator waits=3 (1 question + 2 start_gcode_job), questions=1.
