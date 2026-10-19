# Critique: Thread-milling skill docs for M4 single-form job

## What helped

- **cnc-motion-rules SKILL.md**: The eight laws, motion-floor / park-height distinction, the checklist (state, frame, height, obstacles, tool, authority), and the `get_connection_status` / `get_position` / `get_stored_state` triad were essential for structuring the preflight and avoiding unlawful assumptions. Law 7 (ask once, batch unknowns) directly shaped the questions block.

- **cnc-thread-milling/setup.md**: The cutter-dimension table (cutting OD vs. neck vs. shank vs. effective cutting length) immediately exposed the reach shortfall and justified asking for effective cutting length and bore depth. The setup checklist embedded in the generator input section provided the exact fields to specify.

- **cnc-thread-milling/import.md**: The declarations table (`tool_center_path: true`, `tool_length_applied: true`) and the controller selection (`source_controller: "fanuc"`) are clear. The spindle-mode branching (rpm-retained vs. power-percent) and refusal list (no rotary-axis moves, no mid-program tool changes, etc.) shaped what inputs to request.

- **cnc-thread-milling SKILL.md main**: The feature-review table (internal vs. external checks) was consulted but the job is internal, so internal path applied. The instruction to "preserve the complete source export separately" and "do not assert declarations merely to obtain a preview" correctly informed step 5's validation approach.

- **tool-change SKILL.md**: The flow-A sequence (measure old, park, swap, measure new, apply offset) and the precondition about work-origin history (the chain of tool-length transfers, `originOffset` does not record tool identity) drove the conditional branch for existing vs. new datum and the reuse-check rule.

- **M2.5 fixture (thread-milling-m2_5-fanuc.nc)**: Showed the actual structure of a Fanuc export — M06 T1 header, G54 origin, G00 XY at starting height, G43 H1 Z20 positioning, G90/G01/G03 spiral paths, G40 lead-out, final Z20 retract, M30 terminator. This pattern confirmed format expectations for the operator's Machining Doctor output.

## What was missing or unclear

- **No Machining Doctor link or preview in the context.** The import.md references "the captured form" and labels but does not provide a screenshot or field-by-field map to Machining Doctor's web UI. The operator has to navigate the tool independently. A short "Machining Doctor gen inputs for internal threads" checklist keyed to specific form fields would reduce back-and-forth.

- **Flute count and feeds are assumed known.** The setup.md says "use tool data and the operator's setup; no universal feed, pass count, safety distance or spindle percentage" but does not explain how a thread-milling cutter's flute count differs from multi-form coverage. For a single-form cutter at an unknown RPM and feed, I had to ask the operator directly rather than applying a default. A worked example of "if the cutter is 2 flute, pitch 0.7, and aluminium at 10k RPM, feeds are ~X" would contextualize the ask.

- **Bore depth and thread runout tolerance.** The statement "rounded source endpoints can stop slightly above/below the intended datum" is present in import.md §3 but does not quantify the tolerance or discuss what happens if the bore is shallower than requested thread length. For an 8 mm thread in a 3.3 mm bore, I had to infer that the bore must be at least 8 mm deep and ask the operator. A note on bore-vs.-thread-length contingencies (e.g., "if bore is only 6 mm deep, thread will be 6 mm, not 8 mm") would preempt confusion.

- **No head-type detection guidance.** The setup.md table says "Read `get_machine_profile.connectedHead.toolHead` for the reported module identity; `connectedHead.headType: "cnc"` alone does not distinguish standard from 200 W" but does not say what to do if the field is null or ambiguous. I had to ask the operator. A fallback or diagnostic suggestion would help.

- **Tool-setter history chain.** The tool-change SKILL.md says "If that history is unknown or broken, measuring an arbitrary old/new pair cannot repair it" but does not explain how to **inspect** the history. Do I read `get_tool_setter_config.measurements` and check the `timestamp` or `tool_id`? The fixture only shows the M2.5 cutter comment header; a real history example with tool IDs or descriptions would clarify.

- **Landmarks and rotary-axis B-registration.** The cnc-motion-rules setup mentions landmarks and a rotary axis; the work-datum guidance says "B-rotary context" but the M4 job does not specify whether B is involved. A rotary setup would change the operator's probe-reference and motion-rules questions. I guessed B is not in play for a single hole and did not ask, but a note on recognizing "this job is rotary-indexed" vs. "this is a single-position bore" would be useful.

## What I had to guess

1. **Bore is pre-drilled to at least 8 mm deep.** The operator said "8 mm thread depth wanted" and "3.3 mm drilled hole" but did not confirm the hole's axial depth. I assumed a separate drilling step already completed the bore and that thread milling will cut the helical form into that existing hole, not start from solid stock. If the hole is only 4 mm deep, the thread will be shorter.

2. **Aluminium feedrate starting point.** The operator said "aluminium" but I did not assume specific RPM or feed rates. I asked the operator for spindle choice and preference rather than inverting typical thread-milling speeds from the Machining Doctor calculator. (This is correct per the skill, but it means 6 questions instead of 3.)

3. **No pre-existing landmarks or rotary setup.** The checklist includes "obstacles" and "landmarks" but the job description does not mention a rotary B-angle or any fixture boxes. I assumed single-position milling and did not ask for rotary context. If the stock is mounted on the rotary, the work datum and the clearance envelope change.

4. **Tool change uses flow A (MCP-managed offset), not flow B (firmware wizard).** The operator did not specify which tool-change flow they prefer. I wrote flow A in the plan but flagged it as a question (item 6). The skills do not say which is more common or when to prefer one; I should have asked in the same message as the other unknowns.

5. **Spindle is idle and ready for the swap.** The preconditions section in tool-change says the probe feed must be connected and the machine homed and idle. The RUN_INSTRUCTIONS state "idle, machine X-19 Y342 Z328" so I assumed this is met, but a fresh `get_connection_status` call is staged (step 1) to verify rather than asserted.

6. **Initial position does not collide with the bore's location.** The M2.5 fixture shows the first move is `G00 X0 Y0` at the starting Z height. I do not know the bore's XY coordinates relative to the machine starting position, so I flagged in step 5 that "motion-floor and landmark checks from initial machine position through first approach segment" must be verified after conversion. This is correct per cnc-motion-rules law 2, but the operator must provide bore centre in the work frame or the plan cannot clear initial XY approach.

## Summary for iteration 2

The skills are well-structured and unambiguous for **motion laws** and **tool-change mechanics**, but assume the operator and CAM inputs are complete. For a **new cutter with unknown specs**, the front-end questions grow (6 in this plan). The skills do not prescribe Machining Doctor UI navigation or default feedrates, leaving those as operator-supplied. The fixture M2.5 program is a strong regression case, but a single worked example with spindle choice, bore probing, and tool-change history annotations would reduce rework cycles.

**Files in snapshot that were most useful:**
- `.claude/skills/cnc-motion-rules/SKILL.md` (motion law foundation)
- `.claude/skills/cnc-thread-milling/SKILL.md` (job handoff and review structure)
- `.claude/skills/cnc-thread-milling/references/setup.md` (cutter dimensions and generator checklist)
- `.claude/skills/tool-change/SKILL.md` (flow A sequence and preconditions)
- `src/server/services/mcp/tests/fixtures/thread-milling-m2_5-fanuc.nc` (format reference)

**Files consulted but not essential:**
- `.claude/skills/cnc-thread-milling/references/import.md` (importer arguments clear, but no UI walkthrough)
- `.claude/skills/cnc-probing/SKILL.md` (included for completeness; bore probing only needed if no existing datum)
- `.claude/skills/tool-change/SKILL.md` (flow B option exists but not chosen for this operator setup)
