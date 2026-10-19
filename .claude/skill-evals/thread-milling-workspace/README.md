# Thread-milling skill evaluation runs (2026-09-27)

Committed deliberately (force-added under the otherwise ignored `.claude/skill-evals/`) as the
record behind the thread-milling skill work; **scheduled for removal in the 2027 purge**.

Dry-run plans by fresh agents (opus / sonnet / haiku), one grader per eval. No machine calls.

| Iteration | Snapshot | Eval set | Opus | Sonnet | Haiku |
|---|---|---|---|---|---|
| 1 | PR #191 head `44cf04d8d` (no thread skill) | `evals.json` here (3 evals) | 94 % | 53 % | 29 % |
| 2 | startup/base `52d189714` (+ `cnc-thread-milling`) | `iteration-2/evals.json` (6 evals) | 100 % | 81 % | 54 % |

- `iteration-N/REVIEW.md` — results, misses, doc/product findings, suggested edits.
- `iteration-N/RUN_INSTRUCTIONS.md`, `GRADER_INSTRUCTIONS.md` — what planners and graders were told.
- `iteration-N/eval-*/<model>/run-1/outputs/{plan,critique}.md`, `grading.json`, `timing.json`;
  `eval-*/grading-summary.md` per eval.
- `iteration-2/skill-hashes.txt` — git tree hashes of the skills evaluated.

Not committed: the `snapshot-*` directories and `snap*.tar` (recreate with
`git archive <commit> .claude/skills src/server/services/mcp/docs ...`; exclude `evals/` so
planners cannot read assertions — iteration 2's snapshot included it and haiku likely read it).
