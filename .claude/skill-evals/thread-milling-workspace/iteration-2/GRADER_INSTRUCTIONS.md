# Grader instructions (thread-milling skill eval, iteration 2)

You grade the three dry-run plans (opus, sonnet, haiku) for ONE eval.

Read first:
- `C:\Users\tyeth\.claude\plugins\cache\claude-plugins-official\skill-creator\ad30d62cd52a\skills\skill-creator\agents\grader.md` (method and grading.json format — follow it)
- `evals.json` in this iteration directory (the eval's prompt, expected_output, assertions)
- `RUN_INSTRUCTIONS.md` (what planners were told, including the hypothetical tool results)
- Each run's `outputs/plan.md` and `outputs/critique.md`
- The snapshot under `..\snapshot-52d1897\` as needed to check whether a claim, rule or argument name is real
  (skills: `.claude/skills/cnc-thread-milling/**`, `cnc-motion-rules/**`, `tool-change`, `cnc-probing`; docs: `src/server/services/mcp/docs/*.md`)

Rules:
- Grade each assertion PASS/FAIL with a one-line evidence quote from plan.md. Partial = FAIL, say why.
- Count `[APPROVAL]` tags literally; compare with the plan's stated logical count. Report both.
- Domain facts you can rely on: the fixture program's arcs have centre-path radius 0.575 = (2.53 − 1.38)/2 (generated with a
  1.38 mm cutter); each turn-and-reposition block advances Z by 2.25 mm (L=2.25). A thread mill's neck is narrower than its tooth
  OD. "D4" = shank diameter, "50L" = overall length. Flute count and axial tooth rows are independent. The 200 W head's RPM
  mode accepts 8000–18000 (17991 in range, 7958 below).
- A plan that invents a value the operator did not give (cutter OD, reach, head type, spindle percentage, setter trigger Z)
  and uses it without flagging it FAILS any assertion about that value.
- Note (not graded) anything the plan got wrong about the MCP tools or the rules that the assertions do not cover,
  and any assertion you judge ambiguous or wrong.

Iteration 1 (same first three evals, older skills without cnc-thread-milling, some assertions since reworded) scored:
eval 0 opus 13/13 sonnet 7/13 haiku 4/13; eval 1 opus 9/11 sonnet 5/11 haiku 6/11; eval 2 opus 10/10 sonnet 6/10 haiku 0/10.
Its grading summaries are at `..\iteration-1\eval-*\grading-summary.md` if you want the comparison.

Write:
- `<config>/run-1/grading.json` for each of opus, sonnet, haiku (grader.md format; include `approval_tags_counted` and `stated_logical_approvals`).
- `grading-summary.md` in the eval directory: pass-rate table, misses per model, a "vs iteration 1" paragraph (evals 0-2 only),
  the text in the skills/docs that caused or prevented each miss, and concrete edit suggestions (file + section + wording).

Reply with one line: the pass rates, e.g. `opus 12/13, sonnet 10/13, haiku 7/13`.
