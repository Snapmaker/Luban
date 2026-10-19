# Critique: eval 5 (conversion refusals and reference evidence)

## What helped
- **cnc-thread-milling `references/import.md`, "Required declarations and spindle choice".** It explicitly rules out switching to percentage mode to bypass an RPM refusal, and it defines `tool_center_path` as "D compensation is zero". That settled two of the three refusals directly.
- **`docs/thread-milling.md`, option table.** "Known nonzero generator headers rejected even with a zero-compensation declaration" shows that asserting the flag would not even work, quite apart from being false.
- **`setup.md`, "Generator input checklist", and `TOOLS.md`, `get_machine_profile`.** Both say plainly that null `connectedHead` means ask, and that `toolHeads` is only a compatibility list.
- **tool-change SKILL, "The sequence (flow A)" preamble, and work-datums.md.** "If that history is unknown or broken, measuring an arbitrary old/new pair cannot repair it" is exactly the unknown-reference case in this prompt.
- **SKILL Import step 1.** "Do not assert a declaration merely to obtain a preview" answers the "set the flags" request word for word.

## Missing or unclear for this task
- **No recipe for re-establishing Z when the history is unknown.** The skills say what cannot be done, but none gives a positive procedure.
  - I assembled one myself: probe the datum top → `set_workspace_origin` → flow A. I had to infer that `set_workspace_origin` replaces all XYZ (TOOLS.md), so the existing X/Y must be re-supplied and their evidence verified.
  - An explicit "re-reference Z with the probe, then transfer" pattern, with its approval count, would help.
  - Probe pretravel versus setter contact is flagged as uncertain, but nothing says whether a probe-contact Z0 plus flow A is considered sound.
- **Standard head with a sub-8000 RPM source.** The skill does not say what to regenerate when the standard head is fitted. It is unclear whether the generator should target an RPM the operator believes the standard head gives at P%, with feeds calculated for it. "Feeds appropriate to the actual spindle speed" assumes that speed is known for a percentage-driven head, and no mapping is documented (deliberately).
- **The Siemens D-Type fixture shows `G41 D1` but no D value.** I could not tell what header text the "known nonzero-compensation headers" are, so I could not say whether "D=0.12" in this export would trip the refusal automatically or only through the declaration. Either way the outcome is the same: regenerate.
- **"External Siemens D export" is ambiguous** (external thread, or an externally supplied file). I treated it as an external thread and asked the operator to confirm.
- **Counts convention.** It is unclear whether literal [APPROVAL] tags should include steps in conditional branches that are gated behind a later request. I tagged them and reported the executed-branch count as 0.

## Guesses
- Datum XY, probe and cutter protrusions, and the power percentage are all left as placeholders pending the operator's answers.
- I assumed the operator might recall which tool set Z0, so Question 3 offers both confirming it and re-referencing.
