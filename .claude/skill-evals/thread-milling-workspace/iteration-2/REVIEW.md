# Thread-milling skill eval, iteration 2 (2026-09-27)

Snapshot: tyeth/Luban startup/base 52d189714 (PR #192 merge: new `cnc-thread-milling` skill + references,
TOOLS.md entry, motion-rules/tool-change/probing updates). Skill tree hashes in `skill-hashes.txt`.
Eval set = `.claude/skills/cnc-thread-milling/evals/evals.json` (6 evals: 0-2 reworded from iteration 1, 3-5 new).
18 dry-run plans (opus/sonnet/haiku), one sonnet grader per eval.

| Eval | Opus | Sonnet | Haiku |
|---|---|---|---|
| 0 M2.5 supplied program | 13/13 | 9/13 | 4/13 |
| 1 M4 single-row | 12/12 | 10/12 | 7/12 |
| 2 plate 4xM2.5 + 2xM4 | 12/12 | 10/12 | 6/12 |
| 3 external LH shouldered boss | 5/5 | 5/5 | 5/5 |
| 4 two external bosses, standard head | 5/5 | 4/5 | 4/5 |
| 5 refusals (D=0.12, S7958, unknown head/origin) | 5/5 | 4/5 | 2/5 |
| **Total** | **52/52 (100%)** | **42/52 (81%)** | **28/52 (54%)** |
| Evals 0-2 only (iteration 1) | 37/37 (32/34, 94%) | 29/37 = 78% (18/34, 53%) | 17/37 = 46% (10/34, 29%) |

Mean planning time: opus 258 s, sonnet 284 s, haiku 160 s (iteration 1: 412 / 352 / 151 s).

## Fixed since iteration 1
- Everyone finds `convert_thread_milling_gcode` (TOOLS.md entry + skill routing).
- Sonnet now separates neck from cutting OD and flags the 2.25 mm step; no fabricated `old_trigger_z`; no README head type.
- Nobody plans traverse-then-replay for multiple holes; per-hole exports + per-hole jobs is universal.

## Remaining misses
- **Sonnet, recurring:** calls `convert_thread_milling_gcode` with `tool_length_applied: true` BEFORE its own tool change
  (eval 0 and eval 1, same as iteration 1) - prose hedges, call order unchanged. Also omits "power_percent does not rescale
  feeds" (evals 0, 5), a post-job `get_position` (eval 4), the motion-floor check (eval 1), and puts `start_gcode_job`
  before `-- end turn --`.
- **Haiku:** declares `tool_length_applied: true` unconditionally (eval 0); sets cutting OD = 4 mm (eval 1); reuses the
  fixture's L=2.25 / 2.53 as a recipe (eval 2); invents a 4.5 mm single/triple-row cutoff (eval 2); says S7958 is inside
  8000-18000 and ignores "do not stage" (eval 5); invents an RPM mapping on the confirm page (eval 4); approval arithmetic wrong.

## Real doc/product findings
1. **Confirm page will never show machine-resolved Z for a converted program.** The converter always emits `G54`;
   `validator.ts:548-555` sets `machineZExtents = null` for any work-frame file with a workspace select
   (work-datums.md: "including a single explicit G54"). `cnc-thread-milling/SKILL.md:106` and motion-rules §7 step 4 tell
   the agent to read those extents. Only Opus hedged. (The eval-1 grader concluded plain G54 resolves - that is wrong per
   the code.) Fix: either the converter omits G54 / the validator treats a lone leading G54 as the current workspace, or
   the skill says "extents are UNRESOLVED for converted files; check the source Z range against the verified G54 offset".
2. `goto_tool_change_position`: TOOLS.md "two approved steps" vs tool-change SKILL "one approval, two start_gcode_job calls";
   haiku followed TOOLS.md and counted 5 approvals per tool change.
3. `setup.md` pre-answers eval 0 assertions 1/3/9 and eval 1 assertions 3/4 nearly verbatim - those now test reading, not
   reasoning.

## Eval-hygiene caveat
The snapshot included `.claude/skills/cnc-thread-milling/evals/evals.json`; the eval-3 grader found two phrases in the
haiku plan that exist only there (likely read despite the prohibition; grade unaffected). Exclude `evals/` from the next
snapshot. Agent transcript files were empty, so reads cannot be audited directly.

## Suggested edits
- `cnc-thread-milling/SKILL.md` + import.md: "Convert only AFTER the tool change / reference is complete; the declarations
  are truth claims, not modes" as a numbered order (convert-early is sonnet's persistent miss); bold "feeds are not rescaled".
- SKILL.md:106 / motion-rules §7: finding 1.
- TOOLS.md `goto_tool_change_position`: one approval.
- setup.md: "never carry a fixture-diagnosed number into a real conversion"; "no documented single/triple-row threshold".
- evals.json: split eval 5 assertion 4 (bypass refusal vs feeds-not-rescaled); add an eval-4 assertion for unresolved extents.
