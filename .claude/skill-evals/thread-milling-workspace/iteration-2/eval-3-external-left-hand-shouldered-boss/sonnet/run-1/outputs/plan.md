# Plan: External M8x1 LH conventional thread on a shouldered boss — gather the missing cutter/feature/head data before any Machining Doctor export exists or converts

## Findings before anything moves

- Connection: hypothetical fixture states connected, A350 CNC over Wi-Fi (would confirm with `get_connection_status`).
- Position: hypothetical fixture states `reliability: verified`, homed, idle, machine X-19 Y342 Z328, warnings empty — motion would be lawful if any were requested, but the operator asked only to plan and said not to move anything.
- Tool fitted: fixture says "touch probe fitted unless the prompt states otherwise" — the prompt never mentions a currently-fitted tool, so the touch probe, not the D4x50L thread mill, is in the spindle right now. A tool change with a measured length transfer (`tool-change` skill, flow A) must complete before `tool_length_applied: true` can be truthfully declared.
- Probe geometry: stored `effectiveLength` 71.3 — calibration history, not a fresh same-session reading; not something to re-measure unless the store were empty.
- Limits: motion floor machine Z320, park/traverse height machine Z328.
- Tool setter: configured, but its measurement history must be read (`get_tool_setter_config`) before the eventual tool-change flow can claim any same-tool/same-session reuse — not decided yet since no tool change has happened this session.
- Head identity: `connectedHead.toolHead` is withheld; `headType: cnc` and the compatible-head list do not settle standard-vs-200W, and `spindle_mode` (`cnc_200w_rpm` vs `power_percent`) cannot be chosen without it.
- Landmarks: a rotary landmark exists in stored state; whether this boss is bed-clamped (as "a clamp nearby" suggests) or rotary-held is not stated, and its clearance requirement is only relevant once an actual path is planned.
- No Machining Doctor export exists yet. Only the qualitative spec is known: external M8x1, left-hand, conventional milling, 6 mm thread length, a shoulder immediately below the thread and a nearby clamp, cutter described only as "D4x50L, triple flute." `convert_thread_milling_gcode` needs the complete source text plus `source_controller` and the two required declarations (`tool_center_path`, `tool_length_applied`) — none of these can be produced or honestly declared from what is stated.
- Per the setup reference, in vendor thread-mill designations "D4" is typically the **shank** diameter and "50L" the **overall length**, not the cutting/thread-form OD, neck, reach or effective cutting length; "triple flute" is a circumferential-edge count, independent of the number of axial thread forms ("Three flutes do not mean three axial teeth"). None of the dimensions the converter/generator actually need are established by "D4x50L, triple flute" alone.
- The M2.5 fixture in the repo is unrelated regression evidence for a different (internal, RH) thread and must not be reused as a stand-in for this cutter's geometry or this thread's programmed diameters.

## Questions for the operator (one message)

1. What is the thread mill's actual **cutting/thread-form OD** (diameter across the crests)? Please confirm whether "D4" in "D4x50L" is the shank diameter (the setup reference's convention) or the cutting OD — they are not interchangeable.
2. Neck diameter (if different from the shank), **effective cutting length** / number of axial thread forms (or confirm it is single-form and covers the full 6 mm in one turn), usable reach, and solid vs. indexable. Triple-flute alone does not establish any of these.
3. The boss's diameter, centre (work XY), and height, and the shoulder's exact height/position relative to the thread ("immediately below" needs a number) plus any undercut.
4. The clamp's position and extent in machine coordinates, so it can be checked as an obstacle for the cutter, neck, shank and holder through the whole orbit, lead-in/out and withdrawal — not just at the deepest pass.
5. The generator's **programmed** major and pitch diameters and fit class for M8x1 (a nominal thread name alone is not the programmed size), plus the source controller dialect to select in `convert_thread_milling_gcode` (default is `fanuc` — confirm or override).
6. Material, cutting speed, feed per tooth, number and depth of radial passes, and entry feed.
7. Which head is fitted — standard CNC or 200 W — since `connectedHead.toolHead` is withheld from this fixture; this decides `spindle_mode` (`power_percent` + an explicit 1–100 percentage, or `cnc_200w_rpm` retaining source RPM in 8000–18000).
8. Is there already a verified, measured work datum/WCS registered to this boss (survives or is transferable through the cut), or does one still need establishing before finishing CAM and before the probe-to-cutter swap?
9. Confirm the touch probe is indeed the tool currently fitted and that it (not some other tool) is what the live work origin was referenced to, so the outgoing-tool measurement in the tool-change flow is against the right history.

## Steps

1. `get_connection_status {}` — read-only, no approval.
2. `get_position {}` — read-only, confirms reliability/homed/idle before relying on the fixture's stated values.
3. `get_stored_state {}` — read-only: landmarks (including the rotary box), limits, probe geometry, tool-setter config, camera.
4. `get_machine_profile {}` — read-only: `connectedHead.toolHead`, `toolHeads` list (background only — the operator's answer to Q7 is still required since the list alone does not settle it).
5. `get_tool_setter_config {}` — read-only: existing measurement history, for later reuse-eligibility checks at tool-change time.
6. Ask the operator the nine-item batched question above. [WAIT]
-- end turn --
7. (After the answers land.) The operator runs the Machining Doctor generator with the confirmed thread/cutter/controller/datum inputs and supplies the complete export text — an operator action, not an MCP call. [WAIT]
-- end turn --
8. Tool-change flow A, touch probe → D4x50L thread mill (only once Q9's history is confirmed and Q1/Q2 give a declared, conservatively-low protrusion for the incoming tool):
   a. `run_tool_setter {bit_length_mm: <operator-stated touch-probe protrusion>, accept_probe_contact: true, reason: "measure outgoing touch probe before thread-mill swap"}` [APPROVAL], then `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [WAIT]
-- end turn --
   b. `goto_tool_change_position {}` [APPROVAL], then `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [WAIT]
-- end turn --
   c. Operator swaps to the D4x50L thread mill by hand and states its approximate protrusion. [WAIT]
-- end turn --
   d. `run_tool_setter {bit_length_mm: <operator-stated thread-mill protrusion, declared low>, reason: "measure incoming thread mill"}` [APPROVAL], then `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [WAIT]
-- end turn --
   e. `apply_tool_length_offset {reason: "tool change: touch probe -> D4x50L thread mill, feature <name>"}` [APPROVAL], then `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [WAIT]
-- end turn --
   f. `get_position {}` — verify `originOffset.z` changed by the expected delta; operator sanity-checks the displayed work Z against physical reality.
9. Only if Q8's answer says the boss WCS is not yet established or independently checked: run the appropriate `cnc-probing` measurement (e.g. `probe_stock_outline` for the boss centre/diameter/top, then a wall/corner check of the shoulder standoff) as its own `probe_program` [APPROVAL] + `start_gcode_job` [WAIT], then `set_workspace_origin`/verification per work-datums.md, before continuing. This branch is deferred to that skill and not expanded further here.
-- end turn --
10. `convert_thread_milling_gcode {gcode: "<complete generator export>", source_controller: "<confirmed>", tool_center_path: true, tool_length_applied: true, spindle_mode: "<confirmed cnc_200w_rpm|power_percent>", spindle_power_percent?: <if power_percent>, chord_tolerance_mm: 0.002}` — offline, read-only, no approval, no motion. `tool_length_applied: true` is only honest once step 8 has actually completed and been verified.
11. Review the returned `gcode`, `changes`, `warnings`, `sourceSpindleRpm`, arc/full-circle/segment counts and `validation` against the source: confirm LH + conventional direction is preserved (signed Z travel, G2/G3 sense — never inferred or hand-mirrored), the deepest cutting point clears the measured shoulder height, radial passes/feeds/entry match the operator's cutting-condition answers, axial repositions match the confirmed effective cutting length (no unthreaded bands), and the whole route including the first XY move before the first Z positioning block clears the motion floor, any landmarks and the clamp's stated extent.
12. `validate_gcode {gcode: "<reviewed converted text>"}` — free, static check, read-only.
13. Preflight recheck, asked as its own single batch immediately before submission (state can have changed since step 6): same tool still fitted as when this work origin was last referenced? clamp still clear of the XY extents just reviewed? deepest Z still clear of the shoulder given current stock? door shut, extraction on? [WAIT]
-- end turn --
14. Only if the operator then explicitly requests execution: `submit_gcode_job {gcode: "<reviewed converted text>", name: "m8x1-external-LH-thread.nc", head_type: "cnc", frame: "work"}` [APPROVAL] — deliver the confirm URL as the last line and end the turn, then `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [WAIT]
-- end turn --
15. `get_gcode_job_status {job_id, wait_ms: 110000, since_event}` — long-poll to completion; report `ending` and the actual final position before any next feature or job.

## Readiness

- Conversion declarations: neither can be truthfully made yet. `tool_center_path: true` requires inspecting the actual generated export's D=0/centre-path header once it exists (never assumed from the M2.5 fixture's numbers, which belong to a different thread). `tool_length_applied: true` requires the tool-change flow (step 8) to have actually run and been verified against a reliable position — right now the fitted tool is the touch probe, not the thread mill.
- Submission: needs (a) the real Machining Doctor export text: (b) the operator's answers to all nine questions, especially the true cutting OD/neck/effective-length of the D4x50L cutter and the boss/shoulder/clamp geometry; (c) a completed, verified tool change to the thread mill; (d) a verified work datum for the boss in the same frame as the export's XYZ; (e) a clean `validate_gcode` pass and a human review confirming shoulder and clamp clearance through the whole orbit and withdrawal; (f) the preflight recheck; and (g) the operator's explicit request to execute — none of which exist yet, matching "there is no export yet; do not move anything."

Counts: logical approvals = 1 tool change x 4 + 1 feature job = 5 (+1 more, a `probe_program` datum measurement, only if Q8's answer says the boss WCS is not yet established); literal [APPROVAL] tags in Steps = 5 (the conditional datum-probe step is described but its own tag depends on that answer); operator waits = 8 (the batched setup question, the export text, 4 tool-change clicks plus the manual swap itself counted once, the preflight-recheck answer, and the submission click) — 9 if the conditional datum probe is also needed; questions = 1 batched message (9 numbered items) + 1 conditional just-in-time preflight recheck before submission.
