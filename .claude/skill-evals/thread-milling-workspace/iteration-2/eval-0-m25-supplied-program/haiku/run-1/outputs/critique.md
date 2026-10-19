# Critique: M2.5 thread-milling conversion plan

## What helped

**cnc-motion-rules SKILL.md**: The preflight checklist (§0), frame handshake doctrine (§2), and canonical tool calls provided the hard boundaries and approval structure. The "ask once" law (§7) was essential to batching the five operator questions. The coordinate frame rules clarified that the converted file's G54 declaration means `frame: "work"` must be used on submit, never G53 injection. Law 1 (one motion per instruction) anchored the tool-change flow as four distinct approve-and-wait steps, not a chained sequence.

**cnc-thread-milling SKILL.md**: Clearly stated that conversion is offline-only (no connection needed), that the source file goes through unchanged once reviewed, and that work origin Z must already reference the fitted tool. The requirement to use `tool-change` before asserting `tool_length_applied: true` connected the two skills cleanly.

**cnc-thread-milling/references/setup.md**: The fixture notes and explicit M2.5 trap warnings were load-bearing. The warning that "1.38 is the neck diameter, not the cutting OD" and the 2.25 mm axial spacing concern directly led to question 2 and shaped the review scope.

**cnc-thread-milling/references/import.md**: The spindle-mode selector (table: `cnc_200w_rpm` vs `power_percent`) and the list of refusals were precise. No ambiguity about the required declarations (`tool_center_path: true`, `tool_length_applied: true`).

**tool-change SKILL.md**: Flow A (measure old, park, swap, measure new, apply offset) and its four-approval structure were clearly mapped. The failure-mode discussion (spread disagreement, delta over 50 mm) provided guardrails.

## What was missing or unclear

1. **Spindle head identity**: The fixture comment says "200W" but cnc-thread-milling/references/setup.md warns that `headType: "cnc"` and `toolHeads` lists do not identify the fitted head. No direct tool to read current head type; `get_machine_profile.connectedHead.toolHead` is withheld. The plan must ask the operator because the import choice (`cnc_200w_rpm` vs `power_percent`) gates the entire conversion (question 1). Setup.md's advice to read "get_machine_profile.connectedHead.toolHead" is not actionable in this dry run.

2. **Cutter effective cutting length vs. overall length**: The fixture declares "L=2.25 [MULTI TOOTH]" but setup.md distinguishes cutting OD, neck, effective cutting length, and overall length in separate rows (§keep dimensions separate). The operator's description "7.5mm long including triple row threads" remains ambiguous — is that overall length, protrusion, or effective cutting length? The fixture notes that three rows at 0.45 mm pitch = ~1.35 mm coverage, but the source advances 2.25 mm, exceeding that. Setup.md advises "do not replace its path with one helix" and "regenerate with verified cutting OD and effective length." This is correct guidance, but the plan must ask (question 2) because the conversion is offline and takes no measurements.

3. **Blind vs. through hole clearance**: The operator states "about 6 mm deep." Setup.md notes that "6 mm drilled" may include the drill point and a through hole needs overrun clearance. The fixture thread length is 5 mm, deepest point is work Z−5.056, and the programmed retract is work Z20. The math (−5.056 + 6 mm = 0.944 mm clearance above retract at work Z20) doesn't directly resolve whether the 6 mm depth measurement is from stock top to blind bottom or from stock top to full-diameter depth. The plan asks (question 3) because this is setup knowledge only the operator has.

4. **Work origin Z establishment method**: The fixture has no comment on whether the work origin Z0 was probed (common for thread-milling setups) or set with the cutter itself. Setup.md's tool-change precondition is "verify reference history" and tool-change SKILL.md says "originOffset does not record tool identity." The conversion validity depends on this (question 4), and dry-run instructions forbid calling `get_tool_setter_config.measurements` to infer the history. The plan must ask.

5. **Conversion arc segmentation**: The import.md mentions "chord_tolerance_mm" (optional, default 0.002 mm) but provides no recommendation for this specific M2.5 thread. The fixture uses G2/G3 circular interpolation; the converter emits explicit G1 segments. No warning or calibration for whether 0.002 mm is appropriate for the 2.53 mm major diameter and a 1.38 mm cutter. The plan assumes the default is safe (typical for sub-mm features) but notes it as a review point.

## What I had to guess

1. **Spindle head**: The plan assumes the 200 W head is more likely than the standard head because the fixture RPM (17991) is 200W-compatible and thread milling typically demands higher speed. But this is a guess, not a read from the machine. Question 1 is mandatory.

2. **Tool protrusion estimates**: The plan suggests `bit_length_mm: 70` for the touch probe and `bit_length_mm: 40` for the thread mill cutter (based on typical ranges from the probe geometry jig facts and cutter 7.5 mm total length − collet grip). These are low estimates to be safe; the operator must provide actual protrusion values (cnc-motion-rules §2: "declare it low rather than high").

3. **Offline conversion safety**: The plan stages the conversion offline with the standard default arguments. No live machine or tool validation happens at conversion time. The plan must ask the operator to review warnings against the real bore and cutter (dry-run instructions forbid calling probing or measurement tools). This is correct per the skill but means the offline conversion is a dry run until the staged job is clicked.

4. **Work Z0 retract height (work Z20)**: The source program's `G00 Z20.0` retract assumes work Z20 is above all obstacles at work XY 0,0. In a dry run, I cannot call `get_position` or `get_stored_state` to verify the work frame and landmarks. The plan assumes this is safe based on the fixture design (thread length 5 mm, retract 15 mm above the finished part depth) but must rely on the operator's confirm-page review.

5. **Conversion output stability**: The plan assumes that a Machining Doctor Fanuc export with explicit units (G21), distance mode (G90/G94), plane (G17), and arc format (G2/G3 with I/J incremental centres) will convert successfully without refusals. No refusal list is hit by this fixture. But if the operator's real file differs (e.g., from a different controller dialect or setup), the conversion might refuse and the plan would need a re-generate loop. The dry run cannot stage a job to see refusals.

## Summary

The skills (motion-rules, thread-milling, tool-change, import reference) provided complete coverage of the approval structure, frame rules, and offline-conversion flow. The setup and import references were exact and load-bearing. The blind spots are all operator knowledge: which head is fitted, cutter dimensions, hole clearance, and work origin history. The plan is data-complete but cannot move without those five answers; the plan structure correctly batches them into one question phase before staging.
