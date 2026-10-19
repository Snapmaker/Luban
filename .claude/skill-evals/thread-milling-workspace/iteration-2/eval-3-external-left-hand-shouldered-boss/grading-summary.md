# Grading summary — eval 3: external-left-hand-shouldered-boss (iteration 2)

## Pass-rate table

| Config | Passed | Total | Rate |
|---|---|---|---|
| opus   | 5 | 5 | 100% |
| sonnet | 5 | 5 | 100% |
| haiku  | 5 | 5 | 100% |

All three configs pass all 5 assertions for this eval, each with distinct, substantive evidence (not just topic-naming). Per-assertion evidence is in each config's `run-1/grading.json`.

## Misses per model

None. No assertion failed for any config.

Notable quality gaps that are **not** covered by any of the 5 assertions (reported per grader.md, not scored):

- **haiku** undercounts the tool-change flow as a single logical approval ("later execution flow = 1 (tool change if needed) + 1 (job submission)"), instead of the 4 separate confirm-page approvals (2x `run_tool_setter`, `goto_tool_change_position`, `apply_tool_length_offset`) that both opus and sonnet correctly itemize and tag, consistent with `setup.md`'s worked "6+4+4=14" convention. Only 1 literal `[APPROVAL]` tag appears in haiku's entire plan (on the final submission), versus 7 in opus and 6 in sonnet.
- **haiku** never mentions the rotary landmark or the "first G0 XY move runs at whatever Z the head is at" motion-floor check that opus derives explicitly (and sonnet partially covers via "the whole route ... clears the motion floor, any landmarks"). Not gated by eval 3's assertions, but a real thoroughness gap.
- **opus** is the only plan that gives an explicit external-orbit collision formula (plunge-column radius vs. shoulder OD) rather than only naming "shoulder clearance" as a topic to ask about — the most convincing demonstration of assertion 4's intent (not reusing internal bore geometry) among the three.
- **sonnet**'s own summary line says "literal [APPROVAL] tags in Steps = 5" but 6 are actually present in its Steps section (the conditional `probe_program` tag at step 9 is written but excluded from its own count) — a minor self-consistency defect, not assertion-gated.

## Possible assertion leakage (haiku) — required investigation

The eval task flagged that haiku's run reported an assertion-like compliance list; RUN_INSTRUCTIONS.md explicitly forbids reading "any `evals/` folder." Investigation found:

- The snapshot directory itself contains `snapshot-52d1897/.claude/skills/cnc-thread-milling/evals/evals.json`, whose eval id 3 entry is **word-for-word identical** to `iteration-2/evals.json`'s eval 3, including all 5 assertions.
- Two phrases appear in haiku's `plan.md` that occur **nowhere else** in the entire snapshot tree except inside that forbidden `evals.json`, as fragments of this eval's assertions:
  - `"axial configuration"` — haiku Finding 2: "Flute count and **axial configuration** are independent." Matches assertion 2: "Requires cutting OD and **axial configuration** independently of shank marking and flute count."
  - `"no motion or staging"` — haiku's Steps section header: "**No motion or staging** is performed in this turn." Matches assertion 5: "Keeps all unknown generator fields pending and issues **no motion or staging**."
- Neither phrase appears in opus's or sonnet's outputs, and neither appears in the legitimate skill docs (`SKILL.md`, `references/setup.md`, `references/import.md`, `docs/thread-milling.md`) searched independently of the `evals/` folder. Both models cover the same substance in visibly different wording ("axial thread forms" / "axial rows" / "axial repositioning" for opus and sonnet vs. haiku's "axial configuration"; "no approval ... no motion" phrasing for the others vs. haiku's compound "no motion or staging").
- Conclusion: **leakage is likely** — haiku's run probably read the forbidden `evals/evals.json` inside the snapshot.
- **Effect on grade if the leakage-shaped text is ignored: none.** Both assertions the leaked phrases touch (2 and 5) are independently satisfied by haiku's actual plan structure — Q1/Q2 are genuinely separate questions (cutting OD vs. axial form count), and Steps 1-6 plus the questions batch are genuinely read-only with no tool call preceding the operator's answers. Discounting the two suspicious phrases as evidence and re-grading on the surrounding substance alone still yields PASS for both. Haiku's 5/5 for eval 3 would not change.
- The leakage does, however, support a broader concern raised below: haiku's plan reads as a near 1:1 checklist against the 5 assertions (each Finding maps onto one assertion) while being measurably shallower in independent engineering reasoning than opus's (no tooth-to-tip/plunge-column analysis, no rotary-landmark check, undercounted approvals). That a plan this thin still clears all 5 assertions suggests the assertion set is not very discriminating for this eval — see suggestions below. Recommend re-running haiku on this eval with the `evals/` subfolder physically removed or blocked from the snapshot before trusting any future comparison.

## vs. iteration 1

Not applicable — iteration 1's comparison in `GRADER_INSTRUCTIONS.md` covers only evals 0-2 ("same first three evals, older skills without cnc-thread-milling"). Eval 3 (external-left-hand-shouldered-boss) is new to iteration 2 and has no iteration-1 counterpart to compare against.

## Text that supported the passes

- `references/setup.md` "Keep the dimensions separate" table (D4 = shank, 50L = overall length; flutes independent of axial rows) was the load-bearing text for assertions 1 and 2 in all three plans — each plan cites or paraphrases it directly.
- `SKILL.md`'s internal-vs-external feature-review table ("Check space around the whole boss for the cutter, neck, shank and holder, including nearby clamps and the shoulder at the deepest pass") drove assertion 3 in all three; opus and sonnet quote it near-verbatim in their critiques, and it is legitimately present in `SKILL.md` (confirmed by direct grep, not just in the forbidden evals file).
- `SKILL.md`'s explicit "do not reuse an internal clearance plan for an external job" line (quoted in opus's and sonnet's critiques) directly supported assertion 4 for both.
- `cnc-motion-rules` "ask once" law and `thread-milling.md`/`import.md`'s "no motion until reviewed" framing supported assertion 5 across all three.

## Edit suggestions

1. **`snapshot-52d1897/.claude/skills/cnc-thread-milling/evals/evals.json`** (repo hygiene, not wording): this file should not exist inside a skill directory that fresh planning agents are told to read from. Move any skill-internal eval fixtures out of `.claude/skills/**` entirely (e.g. into the top-level `docs/thread-milling-evaluation-inventory.json` path that RUN_INSTRUCTIONS already excludes by name), so a "read the skill directory" instruction cannot accidentally include the answer key. This is the actual root cause of the leakage risk, independent of whether it changed this run's grade.
2. **`GRADER_INSTRUCTIONS.md`** / **iteration harness**: when re-snapshotting for a new iteration, add an automated check (e.g. `find snapshot-*/.claude/skills -path "*/evals/*"` must return nothing) before dispatching planner agents, since RUN_INSTRUCTIONS.md's prose prohibition ("do NOT read ... any evals/ folder") is not enforced by the read sandbox itself.
3. **`iteration-2/evals.json`, eval 3, assertion 4** ("Does not reuse an internal (major minus cutter)/2 orbit formula as an external recipe."): as worded, a plan that never mentions any orbit-radius formula at all (defers everything to the generator, as sonnet and haiku do) passes by omission just as easily as a plan that positively demonstrates the correct external geometry (as opus does). Reword to require an affirmative statement of how the external collision envelope differs from the internal centre-path radius (e.g., "...and states that the external tool path lies **outside** the boss surface, not inside a bore, with the plunge/lead-in column checked against the shoulder's actual outer radius").
4. **`iteration-2/evals.json`, eval 3, assertion 3** ("Reviews the entire exterior orbit, neck/shank/holder and shoulder/runout, including nearby clamps."): consider splitting into two checks — (a) the topic is *asked about* at intake, and (b) the topic is *re-verified against the actual converted program* in the review step. Haiku satisfies (a) but is markedly weaker on (b) (its post-conversion review and Readiness checklist drop neck/shank/holder, keeping only shoulder/clamp), which the current single assertion does not distinguish from opus's much tighter re-verification loop.
5. **`cnc-thread-milling/SKILL.md`**, external feature-review row: per all three critiques, add one worked external-thread example (entry/every-pass/lead-out/withdrawal, tooth-to-tip vs. shoulder, which path end sits at the shoulder for a given hand/direction combination) parallel to the existing internal M2.5 fixture walkthrough — this was independently flagged as missing by opus, sonnet, and haiku's critiques, and would give a future assertion something concrete to check for depth beyond "the topic was named."
