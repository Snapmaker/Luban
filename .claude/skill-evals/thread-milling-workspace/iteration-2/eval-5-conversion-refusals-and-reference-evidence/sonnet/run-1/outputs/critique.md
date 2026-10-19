# Critique

## What helped

- `cnc-thread-milling/references/import.md`'s declaration table plus "Known nonzero-compensation
  headers are rejected" pinned the D=0.12 refusal precisely — no need to guess at intent.
- The same file's line "An RPM refusal calls for revisiting the cutting conditions, not silently
  clamping RPM or switching to percentage mode to bypass the limit" mapped directly onto the
  operator's "switch to power mode" ask once I noticed S7958 is below the stated 8000 RPM floor
  for `cnc_200w_rpm`. Without that explicit sentence I might have treated a mode switch as a
  reasonable accommodation instead of the forbidden workaround it is.
- `cnc-thread-milling/SKILL.md`'s "Stage only when the operator requests execution" section and
  `tool-change/SKILL.md`'s "If that history is unknown or broken... the operator must
  re-establish the reference before cutting. For thread milling, this is the precondition behind
  `tool_length_applied: true`" gave an exact citation for refusing that declaration, including the
  cross-reference between the two skill files.
- `cnc-thread-milling/references/setup.md`'s paragraph on `get_machine_profile.connectedHead`
  ambiguity told me to ask which head is fitted rather than infer it from `toolHeads` or guess
  from context (`headType: cnc` alone was flagged as insufficient in the same paragraph).
- The supplied Fanuc fixture's own header (`CUTTER COMPENSATION D=0 - TOOLPATH FOR TOOL CENTER`)
  paired with in-code `G41 D1` let me confirm, by direct comparison, that a header's D-value is
  the compensation magnitude while an in-code `D1` is a register index — so "D=0.12" in the
  operator's Siemens description reads as a real nonzero value, not a register label.

## What was missing, unclear or contradictory for this task

- No file states whether `convert_thread_milling_gcode`'s schema even accepts
  `tool_center_path`/`tool_length_applied` as `false` for an honest "not yet verified" preview, or
  whether the two arguments are effectively assertions with no legitimate false value. I inferred
  from "do not assert a declaration merely to obtain a preview" (`cnc-thread-milling/SKILL.md`)
  that the correct behavior is to not call the tool at all until both are true, rather than call
  it with `false` — but the docs never say outright whether a false-flag call is even meaningful
  or refused outright.
- Nothing in the read files gives a Siemens-D-specific worked example of a header D-value versus
  an in-code register selector; the only concrete example is the Fanuc fixture. I reasoned by
  analogy across dialects (`references/import.md`'s "Siemens: H on G0 is removed but the
  positioning move remains" tells me Siemens headers are parsed similarly, but doesn't confirm
  the D-header convention specifically) rather than finding a same-dialect confirmation, and
  turned that gap into question 1 for the operator instead of asserting it silently.
- `references/import.md` says `power_percent` mode is "for the standard CNC head" but never says
  whether it is invalid, merely inadvisable, or simply undiscussed on a 200 W head. If the
  operator answers "200 W is fitted," it's unclear whether percent mode remains an option at all
  or whether `cnc_200w_rpm` (with corrected cutting conditions) is the only path — I left this
  unresolved in the plan rather than guessing a combination the docs don't confirm.
- The 8000-18000 RPM bound for `cnc_200w_rpm` is stated as a closed range ("accepts 8000-18000
  RPM"); I read 7958 as below the closed lower bound. This is arithmetic rather than a genuine
  guess, but it's the one numeric judgment call in the refusal and is worth flagging since no
  file spells out inclusive/exclusive boundary behavior explicitly.
