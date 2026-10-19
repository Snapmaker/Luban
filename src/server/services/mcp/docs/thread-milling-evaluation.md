# Thread-milling baseline evaluation review (2026-09-27)

Reviewed the supplied `skill-evals-iteration1-thread-milling-no-skills-yet.zip`
before finalizing the new skill. This is an audit of an existing evaluation, not a
new model evaluation or a machine acceptance test. The operator will update Claude's
installed skills before running the next evaluation.

## Archive coverage and provenance

The [file inventory](thread-milling-evaluation-inventory.json) accounts for all
**95 non-directory entries**: 74 outer entries and 21 members inside `snap.tar`
and four skill zip packages. There are 78 byte-distinct versions, or 66 distinct
leaf texts after normalizing CRLF/LF. Exact duplicates were compared rather than
treated as independent evidence. The outer zip passed its CRC check.

Inspected all nine plans, nine critiques, nine grading records and nine timing
records; all three grading summaries; the thread scenario set, run/grader
instructions and review; ten historical motion scenarios and three historical
reviews; the PR snapshot and tar copy; all skill sources and nested packages;
both Python helpers; and the archived Claude settings. The inventory states the
inspection method for each entry. Large supporting documents were compared in
full with the checkout, surveyed by section, and inspected for relevant contracts;
this was not a line-by-line correctness audit of unrelated server functionality.

The snapshot and tar's matching files are identical to PR head `44cf04d8d` after
line-ending normalization. The top-level `skills/` is not that snapshot: motion
rules still describe staged homing/older handoff behavior, probing lacks newer
wall/corner/perimeter guidance, and visual alignment has an older work-origin
entry. The nested probing package is older still (capture/home and CAM guidance).
Several other package differences are only line endings. Do not install these
archived copies as the revised skill set.

Archived `RUN_INSTRUCTIONS.md`, `GRADER_INSTRUCTIONS.md`, permission configuration,
Windows paths, shell allowlist and historical recommended reruns were read as
artifacts, not adopted as current instructions. No archived script, machine call,
permission command or evaluation runner was executed. The metrology helper is
image analysis; the bootstrap helper reads captured frames/JSON and optionally
writes a model payload. Neither replaces verified live geometry. They are unchanged.

## Reported baseline results

| Model label in archive | M2.5 supplied file | M4 single form | Six-hole plate | Total |
| --- | --- | --- | --- | --- |
| Opus | 13/13 | 9/11 | 10/10 | 32/34 |
| Sonnet | 7/13 | 5/11 | 6/10 | 18/34 |
| Haiku | 4/13 | 6/11 | 0/10 | 10/34 |

Recomputed these totals from all 102 assertion records. They reproduce the archive;
no grades were silently changed. Each model has one run per case. Timing records
report total planning durations of 1234.685 s, 1056.374 s and 452.055 s respectively;
these are historical executor metrics, not measurements of the revised skill.
All three thread scenarios are internal; they cannot establish external-thread
planning quality. Historical motion-evaluation percentages use different cases and
rubrics and are not a before/after test of this skill.

## Findings carried into the changes

| Evidence in the runs | Change |
| --- | --- |
| Converter missing from tool index and skill routing; raw-CAM pass-through appeared applicable. | Add dedicated `cnc-thread-milling`, index/README links, TOOLS entry and motion-rules conversion call/exception. |
| Neck, cutting OD, D4 shank, overall length, reach and cutting length conflated. | Separate these dimensions; check source header against the actual cutter; regenerate mismatches. |
| Fixture L=2.25 accepted for three axial rows at pitch 0.45; all models missed explicit single-form turn count. | Explain coverage versus axial reposition, verify effective-length convention, and show nominal length/pitch arithmetic. |
| Probe left fitted for cutting, or flags asserted before reference transfer. | Explicit fitted-cutter/reference precondition and tool-change routing; converter declarations remain truthful even though conversion is offline. |
| Stored probe length plus setter surface fabricated into an old trigger Z. | Distinguish calibration from same-connection setter measurements in both probing and tool-change skills; document `accept_probe_contact`. |
| Replaying X0 Y0 after traversing to another hole treated as relocation. | Per-feature generator datums in the shared work frame, per-feature jobs, grouping by cutter and correct conditional approval arithmetic. |
| Source work Z20 or an unknown initial XY path treated as safe. | Review actual start and complete segment, motion floor/landmarks, G54 datum and fresh post-job position. |
| Blind-hole point depth, through-plate overrun, neck/shank and holder clearance missed. | Separate internal bore and external boss reviews, including shoulder/under-plate clearance. |
| Head inferred from historical README; percentage mode said to fix feeds. | Document actual `connectedHead` fields versus compatible `toolHeads`, null/ambiguous fallback, explicit mode, no feed rescaling. |
| Thread completion equated with fit or a generic probe measurement. | Distinguish execution status from thread gauging; check stylus fit before any requested bore probing. |

## Claims not adopted as established facts

- `17991 > 18000` is false; the supplied speed is inside the documented RPM range.
  The converter rejects out-of-range RPM; it does not clamp or select a head mode.
- A 2.05 minus 1.38 diameter difference is 0.67 mm **diametral**, 0.335 mm radial
  when concentric; the critique calls it radial. Cutting clearance still needs the
  actual tooth OD, not the neck difference.
- The illustrative 1.9 mm M2.5 or 3.0–3.15 mm M4 cutting ODs are not measurements.
  No typical OD, universal extra 1 mm depth margin, default 100% power, default
  two-pass strategy or fixed one-third force ratio was promoted into instructions.
- Three rows × pitch is a useful coverage check, not proof of a manufacturer's
  effective cutting-length definition or an exact uncut-band width. The new text
  requires verified geometry and describes the incomplete-thread risk.
- The grader marks the probe-pretravel claim verified without a measurement. The
  snapshot does document different trigger behavior, but does not establish this
  setup's residual magnitude or sign. The skill flags reference-method uncertainty;
  it does not invent a Z correction or declare the residual harmless.
- A completed source file's final work Z20 is not the actual final machine position:
  the repository documents a firmware completion raise. Re-read position; stopped
  file jobs have different behavior. Some high-scoring plans missed this.
- The offline converter's validation is not live machine-resolved clearance. Several
  plans claimed more from it than the API provides. The staged job supplies the live
  frame resolution; the unknown initial path and swept tool remain review tasks.

## Rubric corrections for the next evaluation

The [updated scenario set](../../../../../.agents/skills/cnc-thread-milling/evals/evals.json)
retains the three baseline scenarios with corrected expectations and adds external
LH/conventional, multiple external bosses on the standard head, and refusal/reference
cases. These are unexecuted next-run cases, not new passing results.

1. Separate declaration truthfulness from submission readiness. Some baseline plans
   passed despite declaring `tool_length_applied` before the swap; equivalent behavior
   failed in the M4 case. Current API wording says *already*, so the new rubric
   rejects future-intent flags and independently checks execution readiness.
2. Replace “one job per cutter” and the expected concatenated program with the actual
   per-feature workflow. Report logical approval counts for each branch and repeats;
   literal tags alone are a formatting metric. Eight tags in a main path with six
   approvals plus a documented two-approval branch are not a contradiction.
3. Supply tool details explicitly in each prompt. The original M4/mixed-plate
   expectations relied on M2.5 dimensions stated in another scenario. Do not require
   a fresh agent to know another prompt or infer a cutter's flute count.
4. Check measurement provenance before accepting a “correctly ordered” offset, and
   make cutting with a probe fitted its own failure. A present origin offset does
   not prove tool identity or a valid old/new reference chain.
5. Grade the actual calls/branches, not just a correct prose sentence elsewhere.
   Several plans mention a head check but hardcode RPM mode; others describe URL-first
   handoff yet list the start call before the end of the staging turn.
6. Do not turn speculative model claims or a grader's `verified: true` into domain
   ground truth. Require source/measurement support. Keep software geometry evidence
   distinct from real cutting and thread-fit evidence.
7. Refresh all installed source/reference files and zip packages, snapshot the exact
   revised commit, and record hashes before rerunning. Do not reuse the stale copies
   or treat the archived Claude permissions as installation instructions.

No post-edit model scores, machine measurements or cutting results are claimed.

## Validation of this documentation update

All 78 existing thread-milling regression tests passed, covering importer geometry,
controller variants and offline tool registration. The complete MCP runner could not
start in this checkout because React is unavailable; its earlier PR result of 420
passes is historical, not a new full-suite result. Changed skill frontmatter, JSON,
relative documentation links and whitespace were checked. All five installable skill
zip files were rebuilt and compared byte-for-byte with their source directories.
No machine tools or new model evaluations were run.
