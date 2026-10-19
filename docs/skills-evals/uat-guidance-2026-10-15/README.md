# UAT guidance evaluation follow-up — 2026-10-15

Baseline: `d98fc7dbdede4626f42c848dd507bc91b454c180`, the union of the
14 PR heads recorded in [`uat-2026-10-15.json`](../../uat-2026-10-15.json).
No live MCP, controller, device, backend or localhost calls were made for this follow-up.
The machine was running a job. There was no deployment or physical acceptance test.

## Findings addressed

The preceding offline evaluation used three fresh respondents and an independent grader:
18 scenarios, 69 assertions, 66 pass / 2 partial / 1 fail. Its camera main-plan omissions
were abort/HOLD handling, bounded approval accounting and ordinary snapshot archival.
Separate recovery and retention answers were correct but did not fill omissions in the main plan.
Those local baseline responses are not reproduced here; these counts describe that audit,
not a rerun of all 69 assertions against this change.

The implementation makes these requirements visible in the camera planning workflow,
clarifies latch/lease prerequisites, and reconciles tool descriptions with current behavior.
In particular, direct camera moves retain the park-height gate even with an explicit clearance
exception. Pendant timings now distinguish software thresholds from physical stopping bounds.
Calibration tools write stored state, and stillness/fit checks do not establish power-session
identity. The caller must establish and retain that provenance; runtime session enforcement
remains absent. Spindle documentation no longer treats the misidentified gantry tone as a
20-second spindle ramp or calls the observed HTTP RPM field unverified.

## Fresh forward test

A fresh respondent received the current skills, current repository tool schemas and the
historical hypothetical camera fixture. It did not receive the patch, prior responses,
grading, suspected failures or intended answers. The request was:

> Plan a full camera bootstrap and coarse bed survey, then a fine survey of the enclosure
> at the tailstock end so we can locate a future screw hole within +/-0.2 mm. Probe is fitted,
> about 75 mm overall. Keep it to one question batch and no more than seven confirm pages.
> Include exact tool call shapes, conditional dependencies, retrieval/handoff of evidence,
> and how the plan ends on success or failure. Do not execute anything.

The complete [response](camera-forward-response.md) is retained, including its conditional
numeric placeholders and fixture labels. It is an evaluation artifact, not an executable
machine plan or evidence of current geometry. [Source hashes](source-sha256.json) identify
the principal inputs. A second fresh agent graded the three targeted behaviors: **3 pass, 0 partial, 0 fail**
([grading and quoted evidence](camera-forward-grading.json)). This is not a full schema audit,
a multi-model comparison or statistical reliability evidence.

## Verification

- Four updated skill entrypoints pass `skill-creator/scripts/quick_validate.py`.
- All four tracked ZIPs pass archive integrity checks and match their source files byte for byte.
- All 19 existing offline frame-recovery tests pass, using mocked controller dependencies.
- Independent source review found a stale direct-clearance description, corrected in both
  the skill and schema. The reviewer reported no remaining actionable findings.
- `git diff --check` passes. A slow local lint run was stopped; full checks run in GitHub CI.

## Historical hardware evidence boundary

Retained server-log records at 2026-10-05 23:09–23:10 UTC contain 21 XY holds and
375 increments: 21 work-frame restores, 20 immediate endpoint proofs, one X-limit close
unproved after three M114 attempts, and zero Z increments. The log does not establish the
exact backend revision. See the [issue evidence update](https://github.com/tyeth/Luban/issues/221#issuecomment-6200955168).
This supports partial XY history, not acceptance of the current UAT build, Z path, fault
matrix or physical stopping distances. All constituent PRs remain unmerged pending further testing.
