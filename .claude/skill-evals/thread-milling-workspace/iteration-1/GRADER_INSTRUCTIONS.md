# Grader instructions (thread-milling skill eval, iteration 1)

You grade the three dry-run plans (opus, sonnet, haiku) for ONE eval.

Read first:
- `C:\Users\tyeth\.claude\plugins\cache\claude-plugins-official\skill-creator\ad30d62cd52a\skills\skill-creator\agents\grader.md` (the grading method and the grading.json format — follow it)
- `..\evals.json` (this eval's prompt, expected_output and assertions)
- `RUN_INSTRUCTIONS.md` (what the planners were told, including the stand-in state)
- Each run's `outputs/plan.md` and `outputs/critique.md`
- The snapshot docs under `..\snapshot-pr191\` as needed to check whether a claim or argument name is real

Rules:
- Grade each assertion PASS/FAIL with a one-line evidence quote from plan.md. Partial = FAIL, say why.
- Count `[APPROVAL]` tags literally in plan.md; never trust the plan's own Counts line. Report both.
- Domain facts you can rely on: the fixture program's arcs have centre-path radius 0.575 = (2.53 − 1.38)/2, so it was generated
  with a 1.38 mm cutter; each turn-and-reposition block advances Z by 0.056 + 0.45 + 0.056 + 1.688 = 2.25 mm (the program's
  L=2.25). A thread mill's neck is narrower than its tooth OD. "D4" on a thread mill name is the shank diameter, "50L" the overall
  length. Flute count and axial tooth rows are independent.
- A plan that invents a value the operator did not give (a cutter OD, a neck length for the M4 cutter, a head type, a spindle
  percentage) and uses it without flagging it FAILS any assertion about that value.
- Also note (not graded) anything the plan got wrong about the MCP tools or the motion rules that the assertions do not cover.

Write:
- `<config>/run-1/grading.json` for each of opus, sonnet, haiku (grader.md format; include `approval_tags_counted`).
- `grading-summary.md` in the eval directory: a table of pass rate per config, the assertions each model missed, the most
  important observations about the SKILLS/DOCS (what text caused a miss, what was missing), and concrete edit suggestions
  (file + section + wording) for the skills or `thread-milling.md` / `TOOLS.md`.

Reply with one line: the pass rates, e.g. `opus 12/13, sonnet 10/13, haiku 7/13`.
