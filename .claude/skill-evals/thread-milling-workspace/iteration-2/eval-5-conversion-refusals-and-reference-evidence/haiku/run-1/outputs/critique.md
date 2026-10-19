# Critique: Skill coverage for conversion refusals and reference evidence

## What the skills and docs provided

The **cnc-motion-rules** skill is very clear on:
- Coordinate doctrine (machine vs work frames) and why every staged job must declare its frame
- Position-of-record rules and reliability states
- Approval handshake and the link-first pattern (stage → deliver URL → end turn → wait with start_gcode_job)
- Tool setter flow and `apply_tool_length_offset` as the sanctioned origin adjustment
- Why a tool or probe is ALWAYS in the spindle and must be identified

The **cnc-thread-milling** skill and its **setup.md** reference provided:
- Clear statement that nonzero D compensation is unsupported ("D compensation is zero. D1 selects register 1, not a 1 mm correction")
- The exact declarations required for conversion: `tool_center_path: true`, `tool_length_applied: true`
- The preconditions for `tool_length_applied: true`: "the operator must re-establish the reference before cutting" if origin history is unknown or broken
- Example call shapes with both spindle modes (cnc_200w_rpm vs power_percent) and clear guidance that the converter "never chooses spindle mode, maps RPM to percent, or rescales feeds"
- Why asking which head is fitted is essential when `connectedHead` is null: "toolHeads lists compatible heads, not the fitted one; generic headType: 'cnc' alone does not distinguish standard from 200 W"

The **tool-change** skill stated clearly:
- Step 1 precondition: "establish that the work Z reference belongs to the outgoing tool" and "if that history is unknown or broken, measuring an arbitrary old/new pair cannot repair it"
- Why origin history cannot be inferred from `originOffset` alone
- The flow of measuring old tool → park → swap → measure new → apply offset

The **TOOLS.md** reference (convert_thread_milling_gcode entry) pointed to **thread-milling.md** and the agent skill for full details.

## What was missing or unclear

- **No worked example of a D compensation refusal.** The siemens_d.nc fixture uses G41 D1, but there is no explicit error message or conversion attempt shown for how that fails. A comment or marked-up example showing "this is what a D≠0 export looks like and why it is rejected" would have helped immediately.

- **No explicit table or tree for the pre-conversion checklist.** The setup.md "Generator input checklist" is good, but the flow between "read export header" → "check D value" → "determine what to regenerate" could be more prominent, especially the consequence of missing D=0: "cannot proceed, must ask operator to regenerate".

- **No guidance on how to detect or verify D compensation in an export before attempting conversion.** The importer presumably rejects it, but what line in the G-code shows D≠0? Is it `G41 D1`, or could it be `D2`, `D3`, etc.? The import.md statement is clear on the policy, but not on the textual signature to grep for.

- **The connection between `connectedHead: null` and the spindle-mode choice is stated in setup.md but not cross-referenced in import.md.** A reader of import.md might choose `spindle_mode: "cnc_200w_rpm"` based on the example call shape without re-reading setup.md's warning about null identity.

## What was guessed

- **How to regenerate the export in Machining Doctor.** The setup.md checklist says "Output: supported controller, D=0/tool-centre path", but this is an abstraction. The actual UI labels on Machining Doctor are not specified — I assumed "D=0" or "tool-centre path" is a single toggle in the generator output settings, but the exact menu path and option name are not shown. This is reasonable to guess (regnerate with different settings), but a screenshot or step would make it foolproof.

- **The severity of S7958 vs 8000–18000 range.** I noted that 7958 is slightly below the 200 W head's stated minimum of 8000 RPM. The importer may refusal on this grounds, but I did not see a tool refusal message or explicit RPM guard stated in the docs. I guessed that the importer would accept 7958 if it is within a permissible range, but conversion might later emit warnings or the MCP might clamp it.

## Summary

The skills and docs are *very* clear on the policy: D must be zero, spindle mode must be chosen by the operator based on the fitted head, and origin history must be known before asserting `tool_length_applied: true`. The plan directly applies these rules without ambiguity.

The missing pieces are not rule gaps but implementation details: a worked example of a D-compensation export and its refusal, and clearer UI guidance for the Machining Doctor regeneration step. Both are edge-case details that did not block planning.
