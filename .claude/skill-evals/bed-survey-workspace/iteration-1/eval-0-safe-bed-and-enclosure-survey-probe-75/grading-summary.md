# Grading summary: eval 0 `safe-bed-and-enclosure-survey-probe-75` (iteration 1, PR #219 snapshot bbef661ad)

Grader: dry-run plans graded against A1-A20 in `evals.json`. The grading was strict and literal, and a partial pass counts as FAIL. The per-run evidence is in `<config>/run-1/grading.json`.

## Pass rates

| config | pass | rate | [APPROVAL] tags in Steps (grader count) | plan's stated literal / logical | grader logical approvals | question batches |
|---|---|---|---|---|---|---|
| opus | 17/20 | 85 % | 7 (5 + 2 conditional) | 7 / 5 (up to 7) | 5, max 7 | 1 |
| sonnet | 15/20 | 75 % | 4 (the probe_program step is untagged) | 5 / 5 | 5 | 1 |
| haiku | 4/20 | 20 % | 16 (8 phase + 8 step) | 6 / 5 | 5 real pages; plan tags home/select_camera/verify too | 4 rounds |
| sonnet-noskill | 11/20 | 55 % | 7 (6 + 1 conditional) | 7 / 8 (counts `home`) | 6, max 7 | 1 |

Executor time and tokens (agent-map.txt):

| config | time | tokens |
|---|---|---|
| opus | 609 s | 213k |
| sonnet | 270 s | 151k |
| haiku | 222 s | 101k |
| noskill | 270 s | 134k |

## Per-assertion grid

| | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 | A10 | A11 | A12 | A13 | A14 | A15 | A16 | A17 | A18 | A19 | A20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| opus | P | P | P | P | **F** | P | P | P (used) | P | P | P | **F** | **F** | P | P | P | P | P | P | P |
| sonnet | P | P | P | P | **F** | P | **F** | n/a-P | P | P | **F** | **F** | **F** | P | P | P | P | P | P | P |
| haiku | **F** | **F** | **F** | P (unused) | **F** | P | **F** | n/a-P | **F** | **F** | **F** | **F** | **F** | **F** | **F** | **F** | **F** | **F** | P | **F** |
| noskill | P | P | **F** | P | **F** | P | P | n/a-P | P | **F** | **F** | **F** | **F** | **F** | P | **F** | **F** | P | P | P |

## Misses per model

### opus (17/20)
- **A5.** Every camera XY stays at Z328 or Z320, but the plan never recognises that an active tool opens sub-floor XY for survey_bed, move_and_capture and camera_program. It claims only that setting 75 "equals the existing 75 mm worst case, so no clearance shrinks". This behaviour is undocumented (see gap G1).
- **A12.** A find op, a stepped grid, bounds taken from the mosaic, and the event budget (about 4,400 against 2000, raise requested in Q5) are all present. However, the 7x5 pitch over a 30 mm band is not argued from the screw hole, and the hole's size and tolerance are never asked.
- **A13.** Datum references are only *offered* after the survey ("choose and probe a milling datum before the probe comes out"). Nothing staged measures the XY edges or orientation needed to mill the hole.
- Strengths:
  - the only plan to use `camera_program`, flagging its `kind` key as a guess;
  - the only plan to solve the verify-pose problem: T4 is held out of the fit, placed last, with a conditional traverse;
  - keep_out volumes for both the tailstock and the chuck jaws;
  - after any setter run, it re-asserts the active tool at 75 (PR #219 does overwrite it);
  - it noticed the stale Sonix camera in the README.

### sonnet (15/20)
- **A5.** It states the opposite: "Both landmarks are legacy 328, so route checks are not relaxed by the active tool".
- **A7.** Step 14 calls `plan_view_pose` on the model `set_camera_model` has just stored, which is unverified. The tool contract refuses this, so the hold-out verification cannot be reached as written.
- **A11.** It has no chuck-jaw exclusion; the grid's y_max is left as `<>`.
- **A12.** The 5 mm pitch is self-declared a guess; there is no tolerance argument. The event budget (16.6k, Q7) is good.
- **A13.** It identifies no datum references.
- Minor: the step-20 probe_program staging has no [APPROVAL] tag, so the literal count is 4 while the plan claims 5.

### haiku (4/20)
- Multiple safety-relevant errors:
  - the fine grid at Y90-110 lies inside the tailstock keep-out (Y<110, height unmeasured), with no keep_out at all (A11);
  - the coarse survey runs at Z320 with bounds X140-200, entirely inside the legacy-328 rotary box, so every waypoint would be dropped. It also passes `plane_z: 320`, the camera height, not the surface (A5, A9);
  - the find uses invented `probe_sequence` fields and starts from the stale 136.5 record (A10);
  - it uses guarded hops on an unknown pocketed top (A12).
- Tool misconceptions:
  - home, select_camera and verify_camera_model are tagged [APPROVAL], but none of them stages a confirm page;
  - it says "one approval covers both bootstrap stages", but each stage needs its own approval;
  - it treats verify_camera_model as a motion;
  - it never calls start_gcode_job (A16);
  - it has no `camera_bootstrap.py` solve and no `set_camera_model` (A7).
- Process errors:
  - four question rounds (A15, A20);
  - the position is labelled "work frame" (A1, A17);
  - the 75-vs-70.9 question is ignored (A3);
  - it invents "Enclosure Y span ~Y90-120 ... memory (2026-09-21 probing job)" without retrieving the job (A14). This is possible auto-memory leakage or plain invention.
- The critique makes false claims:
  - that the fixture lacks landmarkClearances;
  - that probe_program is "partly future work";
  - that awaiting-resync is cured by restore_work_frame.

### sonnet-noskill (11/20)
- **A10/A12.** There is no find op. The fine grid's start_z_machine is `P + 80`, where P is the top Z from the 2026-09-21/22 reports or an operator figure. It also uses guarded hops and computes no event budget.
- **A3.** It mixes the two lengths deliberately: 75 in start heights, 70.9 in the floor, both on contact maths.
- **A11.** It has no chuck jaws exclusion.
- **A13.** It identifies no datums.
- **A14.** The old reports feed plane_z and start_z, and there is no branch for "clamping changed".
- **A16.** It never states that the confirm URL is delivered as the last line.
- **A17.** It takes plane_z and P from jobs at B180 and applies them at B0 after homing.
- Strong points: state, homing, one batch, camera identity, a full bootstrap with a hold-out traverse, all XY at 328, and an accurate critique of the docs. The critique's notes on the traverse_xy contradiction, the undocumented camera_program, and the legacy-328 boxes that make the 320 floor useless are all correct.

## What the skills vs no-skill difference shows

- Sonnet with skills (15) vs without (11): the skill-only content is exactly what noskill missed:
  - the **find-then-scan `probe_program`** with references and `between` (A10). This is in cnc-motion-rules §8 and cnc-probing "Unknown surface"; TOOLS.md has no example;
  - **stepped hop_mode for unknown or pocketed tops**, from cnc-motion-rules §4 (A12);
  - the **event budget formula**, from cnc-probing (A12);
  - **probe-length roles**: §2 of cnc-motion-rules pushed sonnet to keep 70.9 for conversion (A3);
  - **evidence reuse conditional on unchanged setup** (A14), from measurement-evidence.md;
  - **the link-first handoff**, cnc-motion-rules law 6 (A16; TOOLS.md says it too but noskill still dropped the "URL last line").
- Neither Sonnet run excluded the chuck jaws. The rule lives only in a parenthesis inside the §8 flatness example and in a cnc-probing jig-table row, so it is not salient enough (G9).
- Skills did not help A5, A12 (pitch from tolerance) or A13 for any model:
  - A5 is undocumented everywhere;
  - A12 and A13 rules exist (cnc-probing "Choose measurements that answer the machining question", motion-rules §2 "Choose the milling datum before ... removing the probe"), but nothing ties them to a *survey* request that names a future cut.
- Haiku with skills (4) did worse than Sonnet without (11):
  - the skills were read but the canonical calls were not copied (invented fields);
  - law 4's legacy-box consequence was not applied;
  - "which calls stage a page" was misread.
  - Weaker models need a compact "call → page? motion?" table and a stated consequence of legacy 328 boxes (G5, G13).
- Opus vs Sonnet: the gap is planning depth (keep_out for the jaws, a held-out pose without plan_view_pose, a camera_program attempt, re-asserting the active tool after setter runs), not rule knowledge.

## Gaps exposed (skills / TOOLS.md / tool descriptions)

Numbered for reference by the edit list below. The "Evidence" column says who hit it.

| # | Gap | Where | Evidence |
|---|---|---|---|
| G1 | The active tool lowers route clearance below the motion floor:<br>• survey_bed (tool): XY below 320 allowed whenever an active tool is set; only stored landmarks are obstacles.<br>• camera_program survey_bed op: below 320 whenever ANY protrusion is known, including the longest bit 75, so it is open on this rig even with no active tool.<br>• move_and_capture (tool and camera_program op): with an active tool and no landmark on the route, the Z gate floor becomes 0.<br>None of this is documented, and the descriptions contradict it: survey_bed "each at or above the motion floor unless the operator has confirmed clearance"; move_and_capture "raised to 328 first". | cnc-motion-rules §0 item 3, §1 law 2, law 4, law 7; TOOLS.md "Transport and direct motion" + "Camera and vision" survey_bed/move_and_capture; tools-list descriptions of survey_bed, move_and_capture, camera_program, set_active_tool | A5 failed by all 4 |
| G2 | `set_active_tool` / `get_active_tool` appear in no skill or TOOLS.md:<br>• its relation to law 4's "longest of setter, probe_effective_length, longest_bit — a measurement only ever lengthens" (now false when an active tool is set);<br>• "protrusion below toolhead" vs operator "overall length";<br>• persistence across reconnect, home or tool change;<br>• that `run_tool_setter` success overwrites it (source tool_setter / spindle_probe). | cnc-motion-rules §1 law 4, §0 item 5, §2 "Probe length"; tool-change SKILL; TOOLS.md | opus critique 2/3, sonnet critique, noskill critique |
| G3 | `camera_program` is undocumented:<br>• the op discriminator key, per-op fields and the result shape are unknown;<br>• fit_calibration stores a 2x2 calibrationStore entry, not a camera model;<br>• overlap_fraction still needs a verified model;<br>• tracking is a fixed 41 px template / 120 px search;<br>• fit_calibration rejects residual > 5 px.<br>`ops.items` is a bare object. | TOOLS.md "Camera and vision"; cnc-visual-alignment (no section); cnc-motion-rules §8 canonical calls; tools-list camera_program | sonnet and noskill avoided it; opus guessed `kind` |
| G4 | Probe-length roles are not separated. Three numbers overlap: the operator's clearance length (75), the calibrated `probe_effective_length` (70.9) and `landmarkClearances.toolProtrusionMm` / active protrusion. The 0.3 mm "ask" rule reads as if 75 must be reconciled against 70.9 before converting. No mention of trigger pretravel in a setter-derived probe length. | cnc-motion-rules §2 "Numbers carry their qualifiers ... Probe length"; cnc-probing "Probe calibration" | haiku ignored 75; noskill used 75 in contact maths; no plan mentioned pretravel |
| G5 | The consequence of legacy `clearance_z` 328 boxes is not spelled out. A rotary box over X140-200 for the full Y means any z_level, pose or XY below 328 over the workpiece is dropped or refused, so the 320 floor gives nothing there. | cnc-motion-rules law 4; cnc-visual-alignment "Survey first"; TOOLS.md survey_bed | haiku surveyed at 320 inside the box; noskill critique "the docs never say this plainly" |
| G6 | `plane_z` semantics are unclear:<br>• "Machine Z of the surface" never says *physical* surface Z (contact − probe length) as opposed to the camera or toolhead Z;<br>• the default 0 "(the bed)", yet no bed plane is stored;<br>• no guidance for a whole-bed mosaic vs a raised workpiece;<br>• a wrong plane_z causes seam mismatch, which marks the model unverified and is indistinguishable from "camera moved". | tools-list survey_bed.plane_z; TOOLS.md survey_bed; cnc-visual-alignment "Survey first" | haiku plane_z 320; opus used setter plate 100.5; sonnet 0; noskill used old B180 top; opus critique 7 |
| G7 | The bootstrap verification pose has a chicken-and-egg problem:<br>• plan_view_pose refuses an unverified model;<br>• verify_camera_model works only at the current pose;<br>• where the poses stage leaves the head is undocumented;<br>• how to choose a held-out pose is undocumented. | cnc-visual-alignment "camera_bootstrap: solving it from nothing"; TOOLS.md camera model; tools-list camera_bootstrap | sonnet A7 (plan_view_pose on unverified); opus critique 5; noskill critique |
| G8 | Where bootstrap and survey frames live, and how a remote agent reads them, is undocumented:<br>• `get_frame {file}` reads only the program-frame directory;<br>• where `scripts/camera_bootstrap.py` runs (agent host or box) and how to obtain `<directory>`. | cnc-visual-alignment bootstrap section; TOOLS.md get_frame / survey_bed | opus critique 6, sonnet critique (conditional [WAIT]), noskill critique |
| G9 | The chuck-jaw keep-out is not a rule; it appears only as an aside in the §8 flatness example and as a cnc-probing jig-table row. | cnc-motion-rules §8; cnc-probing "Whole-stock programs → Keep-out for this clamping" | sonnet, noskill (A11) |
| G10 | "Survey for a future cut" does not trigger the datum and tolerance rules:<br>• pitch from the hole tolerance;<br>• measuring the XYZ and orientation references while the probe is fitted;<br>• asking hole size, position and tolerance in the batch. | cnc-probing "Choose measurements that answer the machining question"; cnc-motion-rules §2 "Choose the milling datum"; work-datums.md | A12/A13 failed by all 4 |
| G11 | The event cost of `hop_mode: "stepped"` is not given; only guarded at 20 / 5. | cnc-probing "Event budget" | opus critique 9, sonnet critique |
| G12 | Exposed stylus length and probe body diameter have no store key, although cnc-probing requires them for every descent near a rim, pocket or wall. | cnc-probing "Stylus reach"; set_probe_geometry | opus Q3, sonnet Q6 |
| G13 | No compact table says which calls stage a confirm page, move on the call, or neither. Weaker models tag home, select_camera and verify_camera_model as [APPROVAL] and count home as an approval. | cnc-motion-rules law 6 / §8 | haiku (16 tags), noskill counts home |
| G14 | traverse_xy's description says "Refused unless at or above mcpSafeTraverseZ (328) ... no override", but TOOLS.md and law 2 say floor 320. move_and_capture's description says "raised to 328 first", contradicting PR #219 route clearance. | tools-list traverse_xy, move_and_capture; TOOLS.md line 38/39 | sonnet, noskill critiques |
| G15 | After homing, B is 0. Evidence and heights recorded at B180 are in the rotated pose; nothing near `home` or the evidence-reuse rule says "a home invalidates B-indexed reuse until rotated back". | measurement-evidence.md; cnc-probing "Recover existing measurements"; cnc-motion-rules §0 item 1 | noskill A17 (B180 plane_z at B0) |
| G16 | It is undocumented whether move_z or traverse_xy refuse while unhomed (only move_and_capture / visual_servo are documented to). | cnc-motion-rules §0 item 1 / law 2; TOOLS.md | sonnet critique |
| G17 | The bootstrap pose budget is undocumented:<br>• the setter, which is the target, sits in a legacy-328 box, so poses must keep the TOOLHEAD outside it;<br>• there is no minimum pose count;<br>• there is no remedy when drops starve the solve (re-state the setter with `obstacle_top_z`);<br>• the search's `y_span_mm` default of 0 assumes an X offset. | cnc-visual-alignment bootstrap section; tools-list camera_bootstrap | opus critique 8/11 and Q7; noskill phase 2 |
| G18 | The README's "Deployment notes" are stale: the toolhead camera is named "Sonix USB 2.0 Camera", but the box now lists Generic + icSpring. | src/server/services/mcp/README.md:1634 | opus critique 4 |
| G19 | `get_inspection_report` is described as "run_probing_gcode job" only, yet the fixture says the probe_program and sequence enclosure jobs are retrievable with it. | tools-list get_inspection_report; TOOLS.md "CAM probing programs" | noskill used it for non-CAM jobs |
| G20 | Risks in the new tools, raised in the critiques:<br>• `camera_program.operator_confirmed_clearance` is top-level and waives the clearance gate for every op;<br>• `set_active_tool` has no expiry or invalidation on tool change, home or reconnect, and does not appear on confirm pages;<br>• inside camera_program, re-gating after a program `move_z` is undocumented. | tools-list camera_program, set_active_tool | opus, sonnet and noskill critiques |

## Edit suggestions

### (a) Skill and doc edits (proposed wording)

1. **cnc-motion-rules/SKILL.md §1 law 4 (G1, G2).** Replace the sentence "The server adds how far the fitted tool hangs below the toolhead (the longest of the last tool-setter measurement, `probe_effective_length` and `longest_bit_length_mm` — a measurement only ever lengthens the requirement) plus a 5 mm margin." with:
   > The server adds the **active tool's protrusion** (`get_active_tool`) plus a 5 mm margin. When no active tool is set, it falls back to the longest of the last tool-setter measurement, `probe_effective_length` and `longest_bit_length_mm`. An active tool can therefore SHORTEN the requirement: set it only from the operator's stated protrusion (`set_active_tool {protrusion_mm, source: "operator", note}`) or from a measurement. A successful `run_tool_setter` overwrites it with the measured value (source `tool_setter` / `spindle_probe`). Re-read `get_active_tool` after every setter run and every tool change, and re-assert the operator's figure if it should govern clearance.

2. **cnc-motion-rules/SKILL.md §1 law 2, new paragraph after "The floor is not the park height" (G1, G5).**
   > **The active tool and sub-floor routes (PR #219).** With an active tool set, `survey_bed` levels and `move_and_capture` / `camera_program` routes may run BELOW the 320 floor. The only obstacles they check are the STORED landmarks (and a program's keep-outs). For `move_and_capture` and a camera_program `move_and_capture` op, the Z gate drops to 0 when no landmark lies on the route. A `camera_program` `survey_bed` op allows sub-floor levels whenever ANY protrusion is known (active tool, last setter measurement, probe length or longest bit). On this rig that means always.
   >
   > The tools will not stop you surveying low over an unmapped bed. Unless the operator has stated that nothing unmapped stands above (floor − tool − margin), or every obstacle is a stored landmark, keep every camera XY at or above the motion floor. Say this in the plan. Legacy `clearance_z` boxes still demand their full toolhead Z, so with the rotary-axis box (X140–200, full Y, 328) any level below 328 over the workpiece drops every waypoint there.

3. **cnc-motion-rules/SKILL.md §0 item 5 "Tool" (G2, G4).** Append:
   > Read `get_active_tool`. `active: null` means route planners use the configured worst case. If the operator states the fitted tool's protrusion, record it with `set_active_tool` (source `operator`, with a note) before staging. That figure is CLEARANCE. It never replaces the calibrated `probe_effective_length` used to convert contacts.

4. **cnc-motion-rules/SKILL.md §2 "Probe length" (G4).** Replace from "**Probe length**: an operator naming a length..." to "...ask before converting anything." with:
   > **Probe length has two roles. Keep them apart.**
   > (1) *Clearance*: the protrusion route planners add to obstacle tops. That is the active tool, else `landmarkClearances.toolProtrusionMm`. A conservative operator figure ("take it as ~75") belongs here.
   > (2) *Conversion*: `geometry.probe_effective_length`, the setter-derived toolhead-Z-to-trigger distance. Surface = contact toolhead Z − this value. Report its source job and date. It includes the probe's trigger pretravel, so a probe-on-stock contact and a cutter's touch-off differ by that pretravel.
   >
   > An operator's rough overall length is not a calibration. Never write it to `set_probe_geometry` and never use it in contact maths. State the gap between it and the stored value in the plan instead. Ask only if the operator says the probe was refitted or swapped since the stored measurement, in which case add one `run_tool_setter accept_probe_contact` + `set_probe_geometry`. The 0.3 mm rule applies when the operator states a *calibrated* effective length that differs from the store.

5. **cnc-motion-rules/SKILL.md law 6 or §8, new table "Which calls stage a page" (G13).**
   > | Call | Confirm page? | Moves? |
   > |---|---|---|
   > | `traverse_xy`, `move_z`, `goto_*`, `submit_gcode_job`, `probe_*`, `probe_program`, `run_tool_setter`, `survey_bed`, `camera_bootstrap`, `camera_program`, `set_workspace_origin`, `select_workspace`, `apply_tool_length_offset` | yes (1 approval each; count them) | yes / no |
   > | `home`, `move_and_capture` | no — operator's chat word | yes |
   > | `select_camera`, `set_active_tool`, `set_camera_model`, `verify_camera_model`, `plan_view_pose`, `set_landmark`, `set_probe_geometry`, `preview_cameras`, `capture_frame` | no | no |
   >
   > Count approvals as confirm pages only; `home` is 0 approvals but needs the word.

6. **cnc-motion-rules/SKILL.md §8 canonical calls (G3, G9).**
   - Add a `camera_program` example once the op schema is fixed (see b2). Show at least `move_z` (machine_z), `survey_bed` (machine_z, z_levels, overlap_fraction, plane_z) and `capture`, with the discriminator key.
   - Promote the chuck-jaw note out of the flatness parenthesis into its own line:
     > **On the rotary, every scan program carries both keep-outs:** `{"name": "tailstock", "machine": {"x0": 140, "y0": 0, "x1": 200, "y1": 110}, "clearance_z": 328}` and `{"name": "chuck jaws", "machine": {"x0": 140, "y0": 269, "x1": 200, "y1": 342}, "clearance_z": 328}` — until a sensor-gated march has measured them and `set_landmark` retires them.

7. **cnc-probing/SKILL.md "Whole-stock programs → Keep-out for this clamping" (G9).** Append:
   > Both rotary keep-outs (tailstock Y < ~110 and chuck jaws Y > ~269, X over the rotary box) go into EVERY program whose ops come near the rotary. Leaving one out is not a narrower plan; it is an unbounded obstacle.

8. **cnc-probing/SKILL.md "Choose measurements that answer the machining question" (G10).** Add a sub-paragraph:
   > **A survey that names a future cut ("we want to mill a screw hole there later") is a datum job.**
   > - In the one question batch, ask the feature's position, size and positional tolerance, and the face/B.
   > - Choose the grid pitch so that pitch/2 is no more than the tolerance you must resolve, and say so ("hole Ø3 ± 0.2 at 10 mm from the end: 2 mm pitch on the edge band, 10 mm on the flat").
   > - In the same `probe_program`, while the probe is fitted, measure the references that will register the cut. For example: two `wall_follow` / `sequence` side marches per axis for X/Y edges and yaw, and the top for Z (see work-datums.md).
   > - Report them as the datum candidates. Write no origin.

9. **cnc-probing/SKILL.md "Event budget" (G11).** Replace "Cost ≈ 100 + stations × (110 at `z_safe_delta_mm` 20, 60 at 5)" with:
   > Cost ≈ 100 + stations × (110 guarded at `z_safe_delta_mm` 20, 60 at 5, **<N> stepped at `hop_lift_mm` 2**)

   Fill N from a measured stepped job. Until then: "budget stepped as 110 per station".

10. **cnc-probing/SKILL.md "Stylus reach" (G12).** Append:
    > Neither the exposed stylus length nor the probe body diameter is stored. Ask for both in the question batch for any survey of a rimmed, pocketed or walled part. If they are not given, cap every descent next to an edge at a stated conservative figure (e.g. 5 mm) and say so.

11. **cnc-probing/SKILL.md "Probe calibration" (G4).** Append:
    > The setter-derived effective length includes the probe's trigger pretravel. Heights converted with it are probe-consistent, not cutter-consistent. A cutter's Z0 comes from its own touch-off.

12. **cnc-visual-alignment/SKILL.md, new section "Composite camera programs (`camera_program`)" after "Survey first" (G3).**
    > One approval for an ordered list of camera ops: `move_z {machine_z}`, `survey_bed` (same fields as the tool, `machine_z` asserted before any XY), `move_and_capture`, `capture`, `track_feature`, `fit_calibration`, `verify_calibration`.
    > - **`fit_calibration` stores the legacy 2×2 pixel→mm matrix** (`set_camera_calibration` store, keyed by Y/Z and surface). It is NOT the camera model. `overlap_fraction`, `plane_view_pose`, mosaics and `visual_servo plane_z` still need a solved and **verified** model (`camera_bootstrap` → `set_camera_model` → `verify_camera_model`).
    > - Tracking uses a fixed 41 px template in a 120 px search window. `fit_calibration` rejects residuals above 5 px by default.
    > - The program's `operator_confirmed_clearance` applies to every op. Never pass it on your own judgement.
    > - Read the exact Z list on the confirm page to the operator.
    > - Sub-floor rules: motion-rules law 2 (active tool).

13. **cnc-visual-alignment/SKILL.md "camera_bootstrap: solving it from nothing" (G7, G8, G17).** Append:
    > - **Hold-out pose.** `plan_view_pose` refuses an unverified model, so choose the verification pose the same way as the fit poses, from the search frames. Either make it the LAST pose of the `poses` stage and exclude it from the solve (the head ends there), or stage one `traverse_xy` to it after `set_camera_model`. Never verify on a frame that was in the fit.
    > - **Where the head ends.** <document: last pose at its lowest Z, or raised to park>.
    > - **Frames.** The job result names the frame directory on the server. <document how a remote agent fetches it (tool or path) and where `camera_bootstrap.py` runs>.
    > - **Pose survival.** The setter (the target) sits inside a legacy-328 box (X38–89, Y269–303). Poses whose TOOLHEAD lies in that box, or in the rotary box, are dropped below 328. Pick poses with the toolhead outside every box while the camera looks in. If fewer than 2 fit poses + 1 hold-out survive, re-state the box with `obstacle_top_z` on the operator's word, or widen the search.
    > - The search `y_span_mm` default 0 assumes the camera is offset mostly in X. Use about 80 when the offset direction is unknown.

14. **cnc-visual-alignment/SKILL.md "Survey first" (G5, G6).** Append:
    > - `plane_z` is the **physical** machine Z of the surface you want sharp (contact toolhead Z − probe effective length), never the camera or toolhead height. The default 0 is a placeholder, not a measured bed. For a whole-bed coarse pass, state the plane you used (e.g. the setter plate 100.5, or a probed bed point) and treat raised objects as parallax-shifted search hints. For a workpiece pass, use the probed top at the SAME B.
    > - A wrong `plane_z` produces seam disagreement that the tool reads as camera drift and marks the model unverified. Before re-bootstrapping, re-verify at a known target.
    > - On this rig both landmarks are legacy 328. Any `z_levels` below 328 drops every waypoint over the rotary (X140–200) and the setter, so survey the bed at 328.

15. **TOOLS.md "Camera and vision" and "Tool setter and tool change" (G2, G3).**
    - Add `camera_program` and `set_active_tool` / `get_active_tool` bullets with the wording from edits 1–3 and 12.
    - Amend the `survey_bed` bullet with the active-tool sub-floor rule (edit 2) and the plane_z semantics (edit 14).

16. **TOOLS.md lines 38–39 (G14).** Make the traverse_xy and move_and_capture text match the live behaviour, and fix the tool descriptions at the same time (b4).

17. **measurement-evidence.md and cnc-probing "Recover existing measurements" (G15).** Append:
    > `home` turns B to 0. Evidence taken at another B (e.g. the 2026-09-21/22 pocket jobs at B180) describes the rotated pose. Reuse it only after `rotate_b` back to that B and the operator's word that the clamping is unchanged. Otherwise it locates the region, and a find re-measures it.

18. **cnc-motion-rules §0 item 1 (G16).** Add one line stating which motion tools refuse while unhomed: <document the actual behaviour of move_z and traverse_xy>.

19. **src/server/services/mcp/README.md "Deployment notes" (G18).** Replace the Sonix line with:
    > Two cameras are attached; identify the toolhead camera from `preview_cameras` frames every session (the device set changes between deployments).

20. **TOOLS.md "CAM probing programs" (G19).** State whether `get_inspection_report` works for probe_program / probe_sequence jobs. If it does not, point to `get_gcode_job_status.result`.

### (b) Product and tooling changes

1. **Tool descriptions disagree with the PR #219 behaviour (G1, G14).** Update the live descriptions:
   - `survey_bed`: "levels below the motion floor are allowed when an active tool is set; then only stored landmarks are obstacles";
   - `move_and_capture`: route clearance, floor 0 with an active tool and no landmark on the route;
   - `camera_program`: its survey_bed op opens sub-floor with any known protrusion;
   - `traverse_xy`: 320, not 328.

   Better: unify the two survey gates. The camera_program op ("any protrusion") is looser than the tool ("active tool"), and one of them is wrong.
2. **`camera_program.inputSchema.ops.items` (G3).** Replace the bare `object` with a `oneOf` keyed on the discriminator. Give each op kind its fields, minima and descriptions, as probe_program's description does for its kinds. Add the result shape (per-op status, frames, the fitted matrix with residual).
3. **Sub-floor survey safety (G1).** Below 320 the only guard against unmapped objects is the landmark store, which on this rig is legacy and coarse. Pick one:
   - require `operator_confirmed_clearance` (or a stated `unmapped_top_z`) for any survey level below the floor, even with an active tool;
   - show on the confirm page "levels below 320: obstacles checked = stored landmarks only (N boxes)".
4. **`camera_program.operator_confirmed_clearance` (G20).** Make it per-op, or require it to list the op ids it applies to. The confirm page should name them.
5. **`set_active_tool` lifecycle (G2, G20).**
   - Show the active tool (value, source, age) on every confirm page.
   - Invalidate it, or mark it stale, on `goto_tool_change_position`, `home`-after-reconnect and Luban reconnect.
   - Have `run_tool_setter` report in its result that it replaced the active tool, with old → new.
   - Separate the schema field for "overall length (operator rough)" from "protrusion (clearance)", or document that `protrusion_mm` takes the conservative figure.
6. **Bootstrap hold-out and frames (G7, G8).**
   - Add `holdout: true` on a `camera_bootstrap` pose, excluded from the solve and the head ends there.
   - Report the head's final position in the result.
   - Let `get_frame` read the bootstrap and survey directories.
   - Or add a `get_survey_frames {job_id}` tool returning the index and files, so a remote agent can run `camera_bootstrap.py`.
   - Or run the solver server-side as a `camera_bootstrap stage: "solve"`.
7. **plan_view_pose for verification (G7).** Optionally allow `plan_view_pose {for_verification: true}` on an unverified model, returning the pose with an "unverified" flag so the hold-out can be planned. It is read-only, so no safety cost.
8. **Seam-drift vs plane_z (G6).** When seams disagree, report the plane_z that would reconcile them before marking the model unverified. A stored `bed_plane_z` (set_probe_geometry) would give the default a real value.
9. **Probe geometry store (G12).** Add `probe_stylus_exposed_mm` and `probe_body_diameter_mm` keys to `set_probe_geometry`, and expose them as `axis.*`-style references for max_travel bounds.
10. **Event-cost estimate (G11).** Have `probe_program` and `probe_surface_grid` return the event estimate in a dry `validate` mode, or on refusal, so planners need no formula for stepped mode.
11. **Rotary keep-outs (G9).** Consider a stored "clamping" record (tailstock Y, chuck face Y, jaws reach) that `probe_program` adds as default keep-outs on the rotary. `rotary_tailstock_y` / `rotary_chuck_face_y` already exist in geometry but are unset and unused for keep-outs.
12. **get_inspection_report scope (G19).** Either accept probe_program / sequence jobs or refuse them with a pointer to `get_gcode_job_status.result`.
13. **Legacy landmark re-statement (G5, G17).** `get_stored_state.landmarkClearances` could include a one-line consequence per legacy box, such as "survey or pose levels below 328 inside X140–200 are dropped". It could also offer an `obstacle_top_z` re-statement template.

## Other notes (not graded)
- **Possible auto-memory leakage or invention:** haiku's "Enclosure Y span ~Y90–120 ... memory (2026-09-21 probing job)" is not in the fixture or the snapshot. Haiku's "camera sees −X, at standoff ~250 mm" is an example, not used. No leakage was found in opus, sonnet or noskill: every number they use traces to the fixture, the snapshot or the prompt (QuadEink appears in the fixture's job history).
- **Wrong claims about tools or rules:**
  - sonnet: plan_view_pose usable on an unverified model.
  - haiku:
    - bootstrap is one approval;
    - verify_camera_model moves;
    - home and select_camera have confirm pages;
    - restore_work_frame cures awaiting-resync;
    - the fixture lacks landmarkClearances;
    - probe_program is future work;
    - `descend` takes start/expected Z;
    - a 2–3 px verify threshold.
  - noskill: camera_bootstrap.py run on the search frames.
- **Ambiguous assertions:**
  - A5's recognition clause is unattainable from the docs at this snapshot (G1). It measures the doc gap.
  - A12 bundles five conditions; split pitch-justification from event budget.
  - A17 "every height" is hard to grade literally; B is implied after homing in most plans.
  - A20 counts only upper bounds; add "no no-page call tagged [APPROVAL]".
- **Missing assertions worth adding:**
  - real argument names from tools-list;
  - plane_z is the surface's physical Z;
  - the hold-out pose is chosen without plan_view_pose;
  - both rotary keep-outs in every rotary program;
  - re-read `get_active_tool` after any `run_tool_setter`.
