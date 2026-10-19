# Grading summary — eval 4 (external-multiple-bosses-standard-head), iteration 2

## Pass-rate table

| Model  | Passed | Total | Rate |
|--------|--------|-------|------|
| opus   | 5      | 5     | 100% |
| sonnet | 4      | 5     | 80%  |
| haiku  | 4      | 5     | 80%  |

Literal `[APPROVAL]` tags in the numbered steps vs. each plan's own stated logical-approval count (both counts exclude the self-referential mention of "[APPROVAL]" inside each plan's own "Counts:" summary line, which a naive regex also matches):

| Model  | Literal tags in steps | Stated logical approvals |
|--------|------------------------|---------------------------|
| opus   | 3 (1 conditional)      | 2 (3 if the conditional between-job raise is needed) |
| sonnet | 2                      | 2 |
| haiku  | 2                      | 2 (or 3 if the conditional traverse is needed) |

All three are internally consistent (literal tags match the model's own stated count once the conditional branches are accounted for).

## Misses per model

**opus** — no misses against the 5 assertions.

**sonnet** — assertion "Preserves per-boss datums and plans one job per boss, with initial-path/clearance verification and fresh position after each completion" FAILS: the plan re-reads `get_position` after job A completes (step 15) but never does so after job B completes (steps 18-20 go straight from `start_gcode_job` → `get_gcode_job_status` → a final report, with no matching `get_position` call). The other four assertions pass with solid evidence.

**haiku** — assertion "Specifies source_controller okuma, spindle_mode power_percent and spindle_power_percent 65 without asserting RPM mapping" FAILS: the confirm-page narration in steps 4 and 11 states "Spindle state: S command present (work speed mapped to 65% for standard head)". This both invents an emitted "S command" (power_percent mode replaces the source RPM value; only `cnc_200w_rpm` mode retains source S) and frames the 65% setting as being "mapped" to a work speed — exactly the RPM-inference the docs disclaim. The tool-call arguments themselves (`source_controller: "okuma"`, `spindle_mode: "power_percent"`, `spindle_power_percent: 65`) were correct in all three runs; only the confirm-page narration text carries the violation, so this required reading past the JSON call into the surrounding prose. The other four assertions pass.

## vs iteration 1

Not applicable. Iteration 1 only re-ran evals 0-2 (`m25-supplied-program`, `m4-single-form-cutter`, `mixed-plate-tool-change`) against the older skill set before `cnc-thread-milling` existed. Eval 4 (`external-multiple-bosses-standard-head`) has no iteration-1 counterpart, so there is no earlier score to compare against.

## Docs cross-check: "machine-resolved Z extents" claim vs an explicit G54 (per grader instructions)

The task asked to check whether each plan's claim about reading the confirm page's "machine-resolved Z extents" is consistent with `docs/workspaces.md` for a program that carries an explicit G54 (the converter always emits one).

**What the docs say:**
- `src/server/services/mcp/docs/workspaces.md`, "File review": "The validator recognises G54–G59.3 but leaves machine extents unresolved for named-workspace files, mixed frames and origin rewrites... An unchanged file with no workspace selectors, declared `frame: "work"`, can still resolve against the reliable current offset."
- `.claude/skills/cnc-motion-rules/SKILL.md` (lines ~181-184) repeats the same rule for the confirm page itself: it shows "the **machine-resolved Z extents** when resolvable"; "Files selecting named workspaces, mixing frames or rewriting an origin have unresolved machine extents."
- `.claude/skills/cnc-thread-milling/references/import.md`: "Output uses G21/G90/G54 and ends with explicit M5/G90..." — every converted program carries a literal G54.
- `.claude/skills/cnc-thread-milling/SKILL.md` (line 95): "The converter emits G54." Its own staging instruction two paragraphs later (line 106) nonetheless says flatly to "Read the confirm page's frame and machine-resolved Z extents to the operator" — with no caveat.

**Conclusion:** A converted thread-milling program is always a "named-workspace file" (it always contains G54), so per `docs/workspaces.md` its machine extents are unresolved on the confirm page — `cnc-thread-milling/SKILL.md`'s own staging instruction (read the extents, unqualified) contradicts `docs/workspaces.md` and `cnc-motion-rules/SKILL.md`'s "when resolvable" qualifier for this exact case. **Only opus's plan and critique caught and resolved this**: step 14 says to "Read the operator the Frame row and the machine-resolved Z extents, **or state that they are unresolved because of the explicit G54** and give the reviewed work-frame extents," and the critique names the contradiction directly under "Machine-resolved Z extents vs an explicit G54." Sonnet and haiku both state flatly that the confirm page's machine-resolved Z extents will be read out, with no hedge and no mention of the tension in either critique.

This is not one of the five graded assertions for this eval, so it did not change any pass/fail count above, but it is flagged as an eval-feedback item below since it is a real, model-discriminating gap.

## Leakage check

Searched all six output files (`plan.md`, `critique.md` × 3 models) for near-verbatim assertion wording or a "compliance with assertions" section. **No matches found** — no leakage observed in this eval's outputs.

## Concrete edit suggestions

1. **`.claude/skills/cnc-thread-milling/SKILL.md`, line 106** ("Read the confirm page's frame and machine-resolved Z extents to the operator..."): add a clause covering the fact that every converted program contains a literal G54, e.g. "...or, since the converted file always carries G54, state that the machine extents are unresolved per `docs/workspaces.md` and read the reviewed work-frame extents instead." This is the single documented instruction most likely to mislead an agent into promising a confirm-page field that will not actually resolve.

2. **`src/server/services/mcp/docs/thread-milling.md`, "For the standard CNC head..." section (~line 47-53)**: add one sentence naming the actual emitted spindle command for `power_percent` mode (e.g. whether it is `M3 P<percent>` or something else, and explicitly that no `S` word remains). Two of three runs correctly avoided inventing an RPM mapping in their tool-call arguments, but nothing in the docs stops a plan from later narrating an invented `S` value in the confirm-page description (haiku's actual failure mode here); a concrete example output line would remove the guess.

3. **`.claude/skills/cnc-thread-milling/references/setup.md`, "Multiple holes or bosses" section**: the worked approval-count example given there is for holes with tool changes ("6 + 4 + 4 = 14"); add a second, simpler worked example for the no-tool-change, two-feature, same-cutter case (exactly this eval's shape) with an explicit reminder to re-read `get_position` after **every** job completion, not just the first — this is precisely the gap sonnet's plan fell into (position re-read after job A but not after job B).

4. **Eval-authoring suggestion** (not a doc-text fix): add a sixth assertion to `evals.json` id 4 along the lines of "Does not assume the confirm page's machine-resolved Z extents will be available for a converted (G54-carrying) file; states they are likely unresolved and substitutes the reviewed work-frame extents" — this is a genuine, discriminating outcome (2 of 3 models missed it) that currently has no assertion coverage and would otherwise only surface via a grader's manual doc cross-check.
