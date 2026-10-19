# Critique

## What helped

- `cnc-thread-milling/references/setup.md`'s dimension table plus the line "A 7.5 mm reach cannot
  provide an 8 mm thread" directly named the exact failure mode this task sets up (8 mm depth vs an
  unconfirmed reach) — without that sentence I would have treated reach as a nice-to-have rather
  than a hard blocker, and might have been tempted to reuse the operator's M2.5 comparison figure.
- The M2.5 fixture (`thread-milling-m2_5-fanuc.nc`) plus its regression notes in `setup.md`/
  `docs/thread-milling.md` gave concrete, checkable numbers (cutting OD vs neck, axial advance vs
  rows x pitch) that made the "cutting OD ≠ neck diameter, D4 ≠ cutting diameter" distinction
  concrete rather than abstract — useful for phrasing question 1 precisely.
- `import.md`'s required-declarations table made it clear `tool_length_applied` is an assertion
  about *history*, not something the converter checks, which is what drove the ordering constraint
  (tool-change before the "real" conversion, not just before submission).
- `tool-change/SKILL.md`'s explicit "Flow A is four approvals" statement gave a citable approval
  count to use in the Counts line instead of guessing from the individual tool descriptions.
- `cnc-motion-rules` §0 rule 7 ("ask once... a question you ask is a question you WAIT for") shaped
  the batching of all eight questions into one message rather than trickling them out.

## What was missing, unclear or contradictory

- **`goto_tool_change_position` approval count is inconsistent between documents.**
  `src/server/services/mcp/docs/TOOLS.md` describes it as "two approved steps: Z up, then XY to the
  operator-set park spot," which reads as two separate confirm-page clicks. But
  `tool-change/SKILL.md` states the whole flow (measure old, park, measure new, apply) is "four
  approvals," treating park as ONE approval. I followed the tool-change skill's explicit count
  since it's the more specific, task-scoped source, but the two documents do not obviously agree,
  and nothing flags which one is authoritative for counting purposes.
- **No explicit worked rule connecting bore diameter to required cutter reach/shank clearance.** I
  had to derive "the 4 mm shank is wider than the 3.3 mm hole, so only the necked portion can enter,
  and only up to the reach" myself from the general "usable reach... must accommodate actual deepest
  travel" sentence in `setup.md`. A short worked example analogous to the M2.5 "2 x 0.575 + 1.38 =
  2.53" arithmetic, but for reach-vs-bore-vs-shank, would have made this less inferential.
  Fit/class field guidance is thin. `docs/TOOLS.md`'s generator-option-coverage table mentions
  "Unified UNC/UNF/UNEF or metric; standard or special size" as a form control but says nothing
  about a fit/class selector (e.g. 2B/3B/6H); I could not tell from the docs whether the Machining
  Doctor generator even exposes a fit-class field, so question 6 has to stay open-ended rather than
  naming the exact control to set.
- **Feature-centre / work-datum timing for a brand-new hole is spread across three files**
  (`cnc-thread-milling/SKILL.md`, its `setup.md`, and `cnc-motion-rules/references/work-datums.md`)
  with no single "first hole in a fresh setup" walkthrough; I had to assemble the probe-circle
  gating (check stored probe-tip diameter against the bore before proposing it) from one sentence
  at the very end of `setup.md` and combine it with the generic work-datum selection guidance
  myself. It would help to have this stated once, next to the "one program per feature" section.
- **Which spindle mode/feed data question belongs where is unstated.** The skill is explicit that
  the converter never rescales feeds or chooses spindle mode, but gives no guidance on *how* to get
  legitimate speed/feed numbers for a customer-supplied cutter with no prior job history (unlike the
  M2.5 fixture, which already has known-good source feeds to preserve). I had to invent question 7
  rather than finding a pointed instruction for "new tool, no established feeds" in the docs.
- Guessed / assumed, flagged in the plan as needing confirmation: that "single thread (one tooth
  row)" maps exactly to the generator's "single tooth" option (very likely, but not stated verbatim
  anywhere); that `source_controller: "fanuc"` is still the right default absent the operator's
  actual generator dialect choice for this new job.
