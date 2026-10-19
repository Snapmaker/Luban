# Rotary neck-cut scenario evaluation runs (2026-09-28)

Committed deliberately (force-added under the otherwise ignored `.claude/skill-evals/`) as the record
behind PR #202's scenario brief `docs/skills-evals/cnc-neck-cut-reassessment.md`; **scheduled for removal
in the 2027 purge**.

Dry-run assessments by fresh agents (no MCP, no machine; local python and headless FreeCADCmd allowed),
one Opus grader. Evidence = `docs/skills-evals/cnc-neck-cut-evidence/` (pre-brief copy; the post-brief
`build_four_tab_plan.FCMacro` was excluded, see its `PROVENANCE.md`).

| Iteration | Snapshot | Opus | Sonnet | Haiku | Sonnet, no skills |
|---|---|---|---|---|---|
| 1 | PR #202 `1778779c0` (skills tree `463084d40`; brief BEFORE the `04a54a149`/`9261b5812` revisions) | 22/23 (96 %) | 14/23 (61 %) | 4/23 (17 %) | 11/23 (48 %) |
| 1, A21 dropped (it contradicted the brief; every run failed it) | | 22/22 | 14/22 | 4/22 | 11/22 |
| 2 (26 assertions) | skill edits `532c46234`, brief `9261b5812` | - | 20/26 (77 %) | 7/26 (27 %) | - |
| 2, subset comparable with it1 (22) | | - | 17/22 | 6/22 | - |

- `evals.json` - the eval (one prompt, 23 assertions A1-A23).
- `iteration-1/RUN_INSTRUCTIONS.md`, `GRADER_INSTRUCTIONS.md` - what planners and the grader were told.
- `iteration-1/REVIEW.md` - headline findings and the edit list.
- `iteration-1/eval-0-rotary-neck-cut-reassessment/grading-summary.md` - full grading, claim checks, edits.
- `iteration-1/eval-0-.../<config>/run-1/{outputs/,grading.json,timing.json}` per run.

Not committed: `snapshot-1778779/`, `snapshot-it2/` (same recipe at `532c46234`) (recreate with `git archive 1778779c0 .claude/skills
src/server/services/mcp/docs src/server/services/mcp/README.md docs/skills-evals`, excluding `evals/`,
`*.zip` and `*thread-milling-evaluation*`), `__pycache__`, FreeCAD `.FCBak` backups.
