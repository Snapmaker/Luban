# Grader instructions (rotary neck-cut scenario eval, iteration 2)

You grade the two dry-run assessments (sonnet, haiku, both with the revised CNC skills) for the single
eval `eval-0-rotary-neck-cut-reassessment`. Iteration 1 (older skills, earlier brief, 23 assertions) is in
`..\iteration-1\` (grading-summary.md and per-run grading.json) for comparison.

Read first:
- `C:\Users\tyeth\.claude\plugins\cache\claude-plugins-official\skill-creator\ad30d62cd52a\skills\skill-creator\agents\grader.md`
  (method and grading.json format; follow it)
- `evals.json` in this iteration directory (prompt, expected_output, 26 assertions: A1-A23 as revised plus A24-A26; see `changes_vs_iteration_1`)
- `RUN_INSTRUCTIONS.md` (what planners were told; live state was UNKNOWN, local python/FreeCADCmd allowed)
- The brief: `..\snapshot-it2\docs\skills-evals\cnc-neck-cut-reassessment.md`
- Each run's `outputs/plan.md`, `outputs/critique.md`, and any diagram/script/model files in `outputs/`
- The snapshot under `..\snapshot-it2\` to check whether a claimed rule, tool or argument is real
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
- Flag any fact a plan uses that is not in the snapshot or RUN_INSTRUCTIONS (possible auto-memory leakage).
- Brief revisions since iteration 1: operator-stated tool (~55 mm protrusion), jaw clearance established with a 5 mm margin,
  C connections at the west/east side ends opening outward (west toward B270 first, east toward B90).
- Grader-verified in iteration 1: from the contacts the rotary axis is about X169.33 / physical Z113.78 (probe 70.95),
  not the stored X170.1 / Z112.4 (2026-09-05, probe 71.3); groove walls must be bounded with the 1.25 mm ball radius
  (B0 enclosure-side wall measured Y252.15).

Write:
- `<config>/run-1/grading.json` for each of sonnet, haiku (grader.md format; include
  `approval_tags_counted` and `stated_logical_approvals`).
- `grading-summary.md` in the eval directory: pass-rate table (26 assertions, plus the A1-A20+A22-A23 subset comparable with
  iteration 1), misses per model, a "vs iteration 1" paragraph naming which skill edits (file + section) fixed or failed to fix
  each iteration-1 miss, what the brief left ambiguous, and concrete edit suggestions with wording.

Reply with one line: the pass rates, e.g. `sonnet 20/26, haiku 12/26`.
