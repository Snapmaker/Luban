# Bed + enclosure survey evaluation (2026-10-04)

Operator request 2026-10-04, on the PR #219 build (`codex/camera-program-active-tool`, bbef661ad:
`camera_program`, `set_active_tool` / `get_active_tool`, `survey_bed machine_z`, route clearance from the
active tool), deployed to the box the same day. A safe survey of the bed and the workpiece, with the touch
probe fitted (~75 mm, the operator's safe assumption): basic checks, camera alignment / calibration at safe
heights, a coarse survey, then a fine survey of the enclosure's tailstock end where a screw hole will be
milled later. The same eval is id 17 in `.agents/skills/cnc-motion-rules/evals/evals.json`.

Committed deliberately (force-added under the otherwise ignored `.claude/skill-evals/`); **scheduled for
removal in the 2027 purge**, like the other workspaces here.

- `evals.json` - the current specification (one prompt, 30 assertions A1-A30).
- `iteration-2/evals.json` - the updated specification and changes from iteration 1; **not run**, at the operator's request. Refresh tool schemas before a future run; iteration-1 fixtures describe the old deployment.
- `iteration-1/RUN_INSTRUCTIONS.md`, `GRADER_INSTRUCTIONS.md` - what planners and the grader were told.
- `iteration-1/fixtures/live-state.md` - stand-in read-only results modelled on the box on 2026-10-04
  (connected, NOT homed, B180, no active tool, no camera model, two cameras, probe 70.9 stored).
- `iteration-1/fixtures/tools-list.json` - the live `tools/list` of the deployed build (70 tools). This records the historical deployment, before the skills and tool contracts were updated; it is not the current schema.
- `iteration-1/eval-0-.../<config>/run-1/{outputs/plan.md, outputs/critique.md, grading.json}`,
  `grading-summary.md` - results and the grader's gap/edit list.
- The completed skills-update handoff was removed after implementing the fixes. Its original
  [brief remains in commit 1fbb0b1ca](https://github.com/tyeth/Luban/blob/1fbb0b1cae1e8abb4bd715bf3d785339812295d6/.claude/skill-evals/bed-survey-workspace/iteration-1/HANDOFF-skills-update.md).
  The updated iteration-2 specification remains unrun.

Iteration 1 (snapshot bbef661ad): opus 17/20, sonnet 15/20, haiku 4/20, sonnet-noskill 11/20. A5 (the
active tool opens sub-floor camera routing) failed for every model: it is undocumented.

Configs: opus, sonnet, haiku (with skills), sonnet-noskill (docs + fixtures only). No Fable model was used
(operator instruction 2026-10-04).

Not committed: `snapshot-it1/` (recreate with `git archive bbef661ad .agents/skills
src/server/services/mcp/docs src/server/services/mcp/README.md`, excluding `evals/`, `*.zip` and
`*thread-milling-evaluation*`).
