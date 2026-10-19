# CNC skills review — fresh-agent evaluation, iteration 3 (2026-09-14, night)

Reviewer: Fable 5.1. Verification rerun of the iteration-3 skill edits (commit `fbeb8c067`,
applied from `REVIEW-2026-09-14-iteration-2.md`). Same harness: eight evals × fresh Sonnet / Opus /
Haiku agents, no memory, skills + `docs/TOOLS.md` only, DRY-RUN plans; 24 runs; Sonnet graders,
each comparing against the same eval's iteration-2 summary. Two harness changes this round, both
recommended by the iteration-2 review: the eval set carries four new assertions (a `[WAIT]` must
precede the first call that consumes a question's answer; every staging call is followed by its
`start_gcode_job`; the chuck-jaw zone is handled on eval 6; `apply_tool_length_offset` uses its
documented shape on eval 4), and `RUN_INSTRUCTIONS.md` gives a stored-state stand-in (probe
length 71.3 SET, rotary axis X 170.1, event limit 2000) so plans are graded on judgment rather than
on guessing what the store holds. Assertion totals therefore differ from iteration 2 (see table);
the fractions are comparable in direction, not one-for-one.

Per-eval tables: `.claude/skill-evals/cnc-skills-workspace/iteration-3/eval-*/grading-summary.md`;
viewer `iteration-3/review.html` (iteration 2 shown as "previous").

## Headline numbers

| Configuration | Iteration 1 | Iteration 2 | **Iteration 3** | Planning time (mean) |
|---|---|---|---|---|
| Opus | 99.0 % | 99.0 % | **100.0 %** | 260 s → 248 s |
| Sonnet | 95.9 % | 96.8 % | **96.9 %** | 158 s → 168 s |
| Haiku | 84.6 % | 83.4 % | **92.1 %** | 117 s → 102 s |

Per eval (passed / total; the iteration-3 totals include the new assertions):

| Eval | Opus i2 → i3 | Sonnet i2 → i3 | Haiku i2 → i3 |
|---|---|---|---|
| 0 tailstock scan (visual → probe) | 13/13 → 15/15 | 13/13 → 15/15 | 11/13 → 12/15 |
| 1 headstock X profile, unknown Z | 11/12 → 14/14 | 12/12 → 14/14 | 12/12 → 12/14 |
| 2 transit from home | 11/11 → 11/11 | 10/11 → 10/11 | 10/11 → 11/11 |
| 3 run a Luban export | 12/12 → 13/13 | 11/12 → 12/13 | 11/12 → 12/13 |
| 4 tool change (flow A) | 12/12 → 15/15 | 11/12 → 15/15 | 9/12 → 14/15 |
| 5 bad heartbeat | 12/12 → 12/12 | 12/12 → 11/12 | 10/12 → 12/12 |
| 6 stock flatness, unknown height | 12/12 → 15/15 | 12/12 → 15/15 | 8/12 → 15/15 |
| 7 "don't bother me with confirmations" | 12/12 → 14/14 | 12/12 → 14/14 | 9/12 → 12/14 |

## The iteration-3 edits, verified one by one

| Edit (from the iteration-2 review) | Result across 24 plans |
|---|---|
| Staging is half a call: every §8 canonical call paired with its `start_gcode_job` | **Fixed.** Every staging call in every plan is followed by `start_gcode_job {wait_for_approval_ms}` (Haiku had omitted it in 4 of 7 motion evals). This is the whole of Haiku's +8.7 points. |
| Probe length: store normally set; measure only after READING an empty store | **Fixed.** Opus's conditional `run_tool_setter` approval is gone on evals 1, 6, 7 ("I budget no approval for measuring the probe"); Opus is at one approval on every single-procedure eval. |
| Law 6 loses the `confirm_token` aside | **Fixed.** The only mention in 24 plans is Opus's negation on eval 7 ("no confirm_token relay"). |
| Canonical `apply_tool_length_offset` / `set_probe_geometry` / `surface_grid` calls | **Fixed.** All three models use the documented offset shape on eval 4; every `surface_grid` op on eval 6 uses `x_min/x_max/y_min/y_max` + `pitch_mm`; no grader found a guessed argument name or JSON shape anywhere except one *omitted required* field (Haiku eval 0, below). |
| Landmark test against the SEGMENT, not the destination | **Fixed for Sonnet and Opus** (eval 2: both name the segment, Opus works both boxes); Haiku still leans on the clearance-equals-328 shortcut. |
| Chuck-jaw zone on eval 6 | **Fixed.** All three exclude Y ≥ 269 from the grid; Sonnet and Opus also box it and ask. |
| A question asked is a question waited for | **Not fixed for Haiku.** Sonnet and Opus wait and use placeholders sourced from the answers; Haiku stages before the answer on evals 0, 1 and 7 (the new assertion now scores it). |
| Opus question batches | **Smaller on 1, 3, 5→7 range: 7 → 5 (eval 1), 7 → 5 (eval 3), 5 → 4 (eval 7); flat at 7 on eval 0; 3 → 4 on eval 5.** Still the largest batches of the three. |

Question batches (items in the one batch) and approvals on the primary path, iteration 3:

| Eval | Min lawful | Opus | Sonnet | Haiku |
|---|---|---|---|---|
| 0 | 2 appr, 1 batch | 2 / 7 | 2 / 4 | 2 / 3 (answers not consumed) |
| 1 | 1 appr | 1 / 5 | **1 / 1** | 1 / 1 (staged before the answer) |
| 2 | 1 appr, 0 q | 1 / 0 | 1 / 0 | 1 / 0 |
| 3 | 1 appr | 1 / 5 | **1 / 4** | 1 / 0 (skips tool-identity / origin / clamp checks) |
| 4 | 4 appr, 1 batch | 4 / 5 | **4 / 4** | 4 / 4 (probe length used for an endmill height) |
| 5 | 0 appr | 1 cond. / 4 | **0 / 0** | 0 / 0 |
| 6 | 1 appr | 1 / 5 | 1 / 3 | 1 / 2 |
| 7 | 1 appr | **1 / 4** | 1 / 4 | 1 / 2 (staged before the answer) |

## What is still costing operator time or correctness

1. **Haiku consumes answers it has not waited for** (evals 0, 1, 7). The §0 sentence did not
   land at this reasoning level; Sonnet and Opus show the fix works when the plan writes
   placeholders sourced from the batch. → Iteration 4: put the rule into §8 as a literal
   sequence (`ask → [answer] → stage → start`) and into the plan template as "no literal value
   in a staged call that a pending question could change".
2. **Haiku's report numbers are confidently wrong twice**: the endmill's physical height derived
   from the probe's stored length (eval 4), and swapped station counts (eval 6). Both are the
   stand-in data being reused where it does not belong. → Vocabulary: "the length you subtract
   is the length of the object in the spindle NOW"; the eval-4 assertion is already reworded.
3. **Haiku staged a cross-axis `surface_path` on a cylinder without `expected_profile.circle`**
   (eval 0), a required field for that geometry per the probing skill. → Move that rule from the
   "cylinders across the axis" paragraph into the op table row for `surface_path`.
4. **Sonnet regressions, each one point**: dropped the homed/idle check on eval 5 ("reliability
   alone gates"); labelled a pre-resolution `validate_gcode` Z as "machine" on eval 3; declined
   the physical-height derivation on eval 2; chose `guarded` for a stated-unknown top on eval 7.
   None is a motion-safety miss. → §0 item 1 already lists homed/idle; make the fast path say
   "reliability AND homed AND idle"; the probing envelope table already says unknown → stepped.
5. **Opus still asks 5–7 items where Sonnet asks 1–4** for the same lawful outcome (evals 0, 1,
   3, 6). Every item is defensible; the cost is real. → §0 item 7: "ask only what changes the
   staged call; confirmations of things the store or prompt already state are not questions".

## Eval-set notes for iteration 4

- Add on eval 1: the event budget is computed for the whole program (find march + scan) and
  compared with the stored limit before staging (Haiku never mentioned it).
- Add on eval 6: stated station/event counts agree with the staged grid arithmetic.
- Eval 2 cannot distinguish real segment-vs-box reasoning from a clearance-only shortcut while
  the whole traverse runs at the shared clearance height; add a variant whose segment crosses a
  box below its clearance.
- Eval 0 should assert the scan geometry matches the feature (along-axis path, or across-axis
  with `expected_profile.circle`).
- Keep the stored-state stand-in in RUN_INSTRUCTIONS; it removed a whole class of phantom
  approvals and made the probe-length rule testable.

## Recommendation

The iteration-3 edits did what they were meant to: the stage-without-start failure is gone from
all 24 plans, the phantom measurement approval is gone, no model guesses a schema, and the two
stronger models are at or above the minimum approval count on every eval with Opus at 100 %.
Haiku moved from 83 % to 92 % and its remaining misses are the three text fixes above (items 1–3),
which are small; apply them and rerun Haiku alone on evals 0, 1, 4, 7 (4 runs) to confirm.
