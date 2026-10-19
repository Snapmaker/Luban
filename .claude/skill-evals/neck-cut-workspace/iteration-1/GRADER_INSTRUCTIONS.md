# Grader instructions (rotary neck-cut scenario eval, iteration 1)

You grade the four dry-run assessments (opus, sonnet, haiku with the CNC skills; sonnet-noskill without them)
for the single eval `eval-0-rotary-neck-cut-reassessment`.

Read first:
- `C:\Users\tyeth\.claude\plugins\cache\claude-plugins-official\skill-creator\ad30d62cd52a\skills\skill-creator\agents\grader.md`
  (method and grading.json format; follow it)
- `evals.json` in this iteration directory (prompt, expected_output, 23 assertions A1-A23)
- `RUN_INSTRUCTIONS.md` (what planners were told; live state was UNKNOWN, local python/FreeCADCmd allowed)
- The brief: `..\snapshot-1778779\docs\skills-evals\cnc-neck-cut-reassessment.md`
- Each run's `outputs/plan.md`, `outputs/critique.md`, and any diagram/script/model files in `outputs/`
- The snapshot under `..\snapshot-1778779\` to check whether a claimed rule, tool or argument is real
  (skills `.claude/skills/**`; tool contract `src/server/services/mcp/docs/TOOLS.md`; evidence `docs/skills-evals/cnc-neck-cut-evidence/`)

Rules:
- Grade each assertion PASS/FAIL with a one-line evidence quote (file + short quote). Partial = FAIL; say what is missing.
- A13/A14: a number counts only if the plan shows where it came from (a script in outputs, a section table, or
  arithmetic you can follow). If a script is present, you may run it with `python` to confirm it produces the
  claimed number; do not run FreeCADCmd for more than one check per run (it is slow). A mid-plane-only
  sketch with no statement that connectivity is unproved FAILS A13.
- A23: open or inspect the diagram file (read an SVG as text; view a PNG/JPG) and check the labels.
- Count `[APPROVAL]` tags literally; compare with the plan's stated count. Report both (not graded).
- Domain facts you can rely on: probe effective length 70.95 (toolhead Z = physical Z + 70.95 with the probe);
  B0 rim toolhead Z201.3 = physical 130.35; B0 groove floor toolhead Z192.2 (9.1 mm down); motion floor Z320,
  park/traverse Z328; `goto_work_origin` is XY at the current Z; the MCP has `set_workspace_origin` only as an
  operator-approved (confirm page) action. Check TOOLS.md for the exact contract before failing a plan on it.
- A plan that invents a live value (current G54, fitted tool, B angle, protrusion, collet diameter) and uses it
  without flagging FAILS any assertion about that value.
- Also note (not graded): wrong claims about MCP tools or motion rules, geometry errors you can demonstrate, and
  any assertion you judge ambiguous, too strict or wrong for this brief.
- The noskill run is a baseline: grade it the same way; in the summary say which misses the skills prevented.

Write:
- `<config>/run-1/grading.json` for each of opus, sonnet, haiku, sonnet-noskill (grader.md format; include
  `approval_tags_counted` and `stated_logical_approvals`).
- `grading-summary.md` in the eval directory: pass-rate table, misses per model, the text in the skills/docs
  (file + section) that caused or prevented each miss, what the brief itself got wrong or left ambiguous, and
  concrete edit suggestions (skills, docs, or the brief) with wording.

Reply with one line: the pass rates, e.g. `opus 20/23, sonnet 17/23, haiku 11/23, sonnet-noskill 9/23`.
