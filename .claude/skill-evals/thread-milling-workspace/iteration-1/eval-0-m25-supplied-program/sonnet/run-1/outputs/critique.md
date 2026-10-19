# Critique: thread-milling-m2_5-fanuc.nc conversion plan

## What helped

- `docs/thread-milling.md` is the load-bearing document for this task and it is good: it states
  the exact meaning of `tool_center_path` and `tool_length_applied`, that neither one applies a
  live offset, the spindle-mode split (200 W keeps source RPM and just range-checks it;
  standard needs an operator-chosen percent with no RPM mapping), and the exact follow-up call
  (`submit_gcode_job` with `head_type: "cnc"`, `frame: "work"`). Cross-checking the fixture's own
  header comments against the required declarations (controller name, D=0 compensation) was only
  possible because that doc spells out what each flag asserts.
- `cnc-motion-rules` §7 ("Running a program someone else generated") gave the whole downstream
  shape for free — one approval, `validate_gcode` first, `frame: "work"` passthrough, read back
  Frame + Z extents, delivered confirm URL, then `start_gcode_job` — without it I'd have had to
  guess whether a converted program is "someone else's program" (it is: the converter doesn't
  stage or run, per its own doc) or something needing bespoke motion planning.
- Law 7 ("ask once") is what stopped me from asking four separate questions in four separate
  turns — tool-fitted state, protrusion, spindle percent and the clamps/door check all belong in
  one message, and the law says so explicitly with a cost story attached, which made it an easy
  call rather than a judgment call.

## What was missing, unclear, or contradictory

- **`convert_thread_milling_gcode` is absent from `TOOLS.md`.** That file bills itself as "Terse
  per-tool reference" for the "54 tools," and I grepped it for `thread`, `convert_thread`, and
  `head_type` — nothing. The only two mentions of the tool anywhere in the read set are
  `README.md`'s one-paragraph pointer (which doesn't give the schema) and `docs/thread-milling.md`
  (which gives usage but not a formal parameter table — I had to read prose to reconstruct it).
  A fresh agent that discovers this tool from `TOOLS.md` alone (as the motion-rules skill tells
  you to do — "Call `get_stored_state` first... `TOOLS.md`" is the implied index) would not know
  it exists. I only had the schema because it was pasted directly into my prompt; without that I
  would have had to guess argument names from `thread-milling.md`'s one JSON example, which
  happens to be complete but is easy to miss (it's mid-document, not at the top).
- **Nothing tells an agent how to determine whether `tool_length_applied` is actually true for
  THIS run.** The doc defines what the flag means but never says which live call proves it (there
  isn't one — it's inferable only from tool-change history and operator memory of what was
  fitted when the origin was zeroed). I ended up treating it as an operator question by analogy
  with `cnc-motion-rules` §2's "an operator naming a length in chat tells you WHICH probe is
  fitted, not its calibration" — the same shape of problem — but nothing in the thread-milling
  doc itself flags this as a thing to check before trusting the declaration. Worth a line in
  `thread-milling.md` under the `tool_length_applied` bullet: "the converter cannot verify this;
  confirm the fitted tool and origin history before declaring it."
- **No stated way to reconcile the cutter's physical description with the file's assumptions.**
  The operator gave "1.38 mm neck, 7.5 mm long, triple row threads, triple flute"; the file says
  `CUTTER DIAM=1.38, L=2.25 [MULTI TOOTH]`. Nothing in `thread-milling.md`'s generator-option
  table tells you what to do if the file's stated cutter and the operator's stated cutter
  disagree (they don't, here, but the doc gives no guidance on WHAT to check for a match beyond
  "the importer does not implement a separate thread lookup or infer a nominal diameter" — true
  but doesn't tell an agent it should still eyeball diameter/length agreement as a sanity check).
  I had to invent that as a reasonable check rather than follow a stated one.
- **`get_machine_profile`'s return shape for head type is never shown.** The stand-in explicitly
  routes around this ("If your plan depends on the CNC head type... say which call reads it and
  branch on the answer, or ask") which is fair for a dry run, but neither `TOOLS.md` nor
  `thread-milling.md` states what field of `get_machine_profile`'s result actually names the head
  (`toolhead`? `moduleType`? a string like `"cnc_200w"`?). I planned to "read" it but had to guess
  at the branching logic rather than quote a field name — flagged in the plan as a guess.
- **Small thing, not a blocker:** the fixture's trailing disclaimer comment and the `%`
  start/end markers are part of "complete generator output... including M30/M2" per the tool
  schema in the prompt, but `thread-milling.md` never explicitly says whether the `%` bookends
  and the disclaimer comment line must be included verbatim or are stripped/ignored. I planned to
  pass the file through byte-for-byte to be safe, since the doc says "the source file is not
  modified" for the input side, but this is inference, not a stated rule.

## What I had to guess

- That `get_machine_profile`'s result contains an unambiguous head-type field to branch on (name
  and shape unknown).
- That passing the fixture through with its `%` markers and trailer comment intact is correct
  (vs. some implicit expectation that only the `O0101 ... M30` body is "the generator output").
- That the right question to ask about `tool_length_applied` is "was the origin zeroed with this
  same tool," rather than some other live-state check I don't have visibility into.
