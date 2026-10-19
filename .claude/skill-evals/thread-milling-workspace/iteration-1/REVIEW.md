# Thread-milling skill eval, iteration 1 (2026-09-27)

Snapshot: tyeth/Luban PR #191 head 44cf04d8d. Dry-run plans, 3 evals x opus/sonnet/haiku, one sonnet grader per eval.
Operator's cutters: M2.5x0.45xD4x50L (1.38 neck, 7.5 long incl. triple-row teeth, 3 flutes); M4x0.7xD4x50L single-row and triple-row.

| Eval | Opus | Sonnet | Haiku |
|---|---|---|---|
| 0 M2.5 supplied program (13) | 13 | 7 | 4 |
| 1 M4 single-row, no program yet (11) | 9 | 5 | 6 |
| 2 plate 4xM2.5 + 2xM4, tool changes (10) | 10 | 6 | 0 |
| **Total (34)** | **32 (94%)** | **18 (53%)** | **10 (29%)** |

Motion-only evals (iteration 3, 2026-09-14) were Opus 100 / Sonnet 97 / Haiku 92 %: thread milling is a new gap, and it is a docs gap, not a motion-law gap.

## Real-world findings for the operator
- The supplied M2.5 program was generated with CUTTER DIAM=1.38 (arc radius 0.575 = (2.53-1.38)/2) - the NECK. Tooth OD is larger (~1.9 typical), so it would cut the major ~0.5 mm oversize. Measure the tooth OD.
- L=2.25 [MULTI TOOTH] = 5 rows x 0.45. A triple-row cutter covers ~1.35 mm; the 2.25 mm axial step leaves ~0.9 mm unthreaded bands. Regenerate with L = rows x pitch.
- One generator program = one hole at the XY datum; N holes = N programs (datum per hole) = N jobs. Merging would travel between holes at work Z20, below the Z320 floor.
- M4 8 mm depth needs > 8 mm reach; a 7.5 mm neck like the M2.5 cutter's would not reach.
- README line 5: the rig is the 200 W head, so cnc_200w_rpm with S17991 is in range (8000-18000) - still read get_machine_profile live.
- Live check on the deployed build: fixture converts to 234 G1 segments, work Z -5.056..20, warnings as expected.

## What caused the misses (docs/skills)
1. `docs/TOOLS.md` does not list `convert_thread_milling_gcode` (all 9 plans noticed); no skill routes to it; cnc-motion-rules §7 reads as "any CAM file goes straight to submit_gcode_job".
2. thread-milling.md never says "generator cutter diameter = tooth OD, not the vendor's neck/shank figure", nor "L = rows x pitch; check the header against the fitted cutter". Sonnet and haiku declared the geometry fine.
3. `tool_length_applied` is not linked to the tool-change skill; haiku planned to cut with the probe fitted.
4. No multi-hole guidance (haiku tried traverse-then-run, which returns to work X0 Y0).
5. Sonnet computed old_trigger_z = 100.5 + 71.3 by hand to skip a measurement - unsanctioned (tool-change skip = same tool, this session; §2 names 71.3 historical); cnc-probing's `effectiveLength = trigger - 100.5` formula invites the reverse use.
6. "power_percent does not rescale feeds" is buried mid-paragraph; haiku read the converter as auto-selecting spindle mode.
7. Single tooth: no "turns = length / pitch" line; no model stated the ~11-12 turns.

## Suggested edits (for PR #191 or a follow-up)
- TOOLS.md: add the tool row + args, point to thread-milling.md.
- cnc-motion-rules §7 (and §8): "a Machining Doctor / thread-milling export goes through convert_thread_milling_gcode first"; add the canonical call.
- thread-milling.md Usage: a pre-convert checklist - header CUTTER DIAM equals measured tooth OD (verify: 2 x arc radius + D = major); L equals rows x pitch; reach > thread length + approach; one program per hole; tool_length_applied only after tool-change flow A with THIS cutter; bold the feeds-not-rescaled sentence; single tooth = length/pitch turns.
- tool-change SKILL.md step 1: removing the touch probe = measure it with accept_probe_contact; never derive a trigger Z from stored constants.
- cnc-probing calibration line: the formula derives effectiveLength FROM a live reading, never the reverse.
- Eval set: eval 2 assertion 9 should say "one job per hole"; split eval 1 assertion 9 (convert-early vs submit-early).
