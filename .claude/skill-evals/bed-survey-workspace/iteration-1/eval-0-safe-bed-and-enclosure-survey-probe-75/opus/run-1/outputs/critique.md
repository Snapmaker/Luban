# Critique: bed + enclosure survey dry run (PR #219, bbef661ad)

## What helped
- **cnc-motion-rules §0 checklist + §1 laws 1/2/6/8.** Not homed means homing first. Homing runs on the operator's word and turns B. The checklist also separates the floor (320) from the park height (328), and fixes the order stage → URL → end turn → background `start_gcode_job`. Together these gave the plan its skeleton.
- **Law 4 + `landmarkClearances` (fixture).** They made it clear that both boxes are legacy 328, so 328 passes (equal passes) and 320 does not. That decided the coarse survey at `z_levels [328]` only.
- **cnc-visual-alignment, "camera is session state" + bootstrap section, and CAMERA_SURVEY_PLAN §4-D.** Search → poses → solve → set (unverified) → verify on a held-out pose. No offset is ever carried in memory.
- **cnc-visual-alignment camera table + `preview_cameras` / `select_camera` descriptions.** "Identify by what it sees, pin with a frame id." The rig-mounted vs scene heuristic gives a clean discriminator using previews before and after homing.
- **cnc-probing.** The find-then-scan program and the event-budget formula (100 + stations×110, ~3/mm for a find) gave the plan two things:
  - the Q5 question;
  - the 4×3 fallback.
- **cnc-probing, keep-out vs crossing semantics.** The find column wholly inside the rotary box is allowed, and the tailstock is a program `keep_out` volume.
- **measurement-evidence.md.** Retrieve jobs 031c3eb1fe38 / d677bd88d31a first, and never reinterpret old contacts with today's probe length.
- **tools-list descriptions for `survey_bed`.** `machine_z`, `plane_z` "stated, never inferred", and volumes with `dropped` / lifted links.

## Missing, unclear or contradictory for this task
1. **`camera_program` has no op schema.** `ops.items` is `{"type": "object"}`. The description names the ops (move_z, survey_bed, move_and_capture, capture, track_feature, fit_calibration, verify_calibration) but not:
   - the discriminator key (`kind`? `op`?);
   - the fields of `fit_calibration` / `verify_calibration`;
   - whether `survey_bed` inside a program takes every standalone argument.

   Nothing in TOOLS.md, README.md or any skill mentions `camera_program`. I guessed `kind` plus the standalone arguments. A live agent would learn the real shape only from a staging refusal.
2. **`set_active_tool` / `get_active_tool` are undocumented outside tools-list.** No skill or TOOLS.md entry mentions them. Unclear points:
   - Does an active tool *replace* law 4's "longest candidate known (setter measurement, probe_effective_length, longest_bit)" rule, so that a shorter active tool lowers `requiredToolheadZ`? The description says it "becomes the active protrusion".
   - Does `run_tool_setter` overwrite it ("measurement procedures write their own source")?
   - Does a reconnect or home clear it?

   I set 75 (equal to the existing worst case) and re-check it after any setter run.
3. **Probe length semantics.** The skill (§2) says that if operator and store disagree by more than 0.3 mm, ask before converting. It does not distinguish an operator's conservative *overall length for clearance* (75) from the *calibrated effective length* (70.9). The new `set_active_tool.protrusion_mm` vs `geometry.probe_effective_length` vs `landmarkClearances.toolProtrusionMm` are three numbers with overlapping meaning, and nothing explains which feeds what.
4. **Camera identity contradicts the README.** README "Deployment notes" says the toolhead camera is the **Sonix** "USB 2.0 Camera". The fixture lists a **Generic USB Camera** (pinned) and the icspring camera, with no Sonix. The skill's "identify by evidence" rule saves the day, but the README is stale.
5. **Verification pose chicken-and-egg.** `verify_camera_model` checks "at the CURRENT toolhead position". `plan_view_pose` refuses an unverified model. No doc says:
   - where `camera_bootstrap` poses leaves the head (last pose? raised? home?);
   - how to choose a held-out pose without the model.

   I ordered the held-out pose last and kept a conditional `traverse_xy` approval.
6. **Where do bootstrap/survey frames live, and how does the agent read them?** `survey_bed` says "read the files directly". On the Ubuntu box the agent is remote, and `get_frame {file}` only reads the program-frame directory. Also undocumented: where `scripts/camera_bootstrap.py` is meant to run (agent host or box).
7. **`plane_z` default 0 "(the bed)".** The bed or wasteboard physical Z is not stored anywhere, and the fixture has no number for it. More dangerous is the E4 seam-drift check: a wrong `plane_z` produces seam mismatch that the tool may read as "camera moved" and mark the model unverified. The docs never say how to tell those two causes apart.
8. **Legacy 328 boxes vs the bootstrap Z sweep.** The rotary box spans X140..200 over the full Y, and the setter box sits on the bootstrap target. Every pose or waypoint inside either is dropped below 328. Re-stating them with `obstacle_top_z` needs the tailstock and setter-post tops: the first is unmeasured, the second "~106.9". The docs give no guidance on a minimum pose count, or on what to do when drops starve the solve.
9. **Event cost for `hop_mode: "stepped"` is not given.** Only guarded at 20 / 5 is. I used the conservative 110 per station.
10. **Stylus exposed length and probe body diameter are not stored anywhere.** cnc-probing requires them for any descent near an edge, rim or pocket, which the QuadEink rim and window are. They had to go into the question batch.
11. **`camera_bootstrap` search `y_span_mm` defaults to 0 (one row).** That quietly assumes the camera offset lies mostly in X. I used 80 to tolerate a Y offset; nothing documents the risk.

## What I had to guess
- `camera_program` op key and field names.
- That "the enclosure" is the QuadEink workpiece, not the machine enclosure (asked in Q2).
- The hole face (asked).
- The find travel of 140 mm. It rests on the historical axis physical Z of 112.4, used only as a search floor, never as a clearance.
- The grid size (7×5, 30 mm band) and its 8 mm inset from camera-seen edges.
- The 5 mm drop cap when stylus reach is unknown.
- The setter plate (100.5) as the coarse mosaic plane.
- That poses end at the last pose.

## Risks in the new tools themselves
- **`camera_program.operator_confirmed_clearance` is top-level.** One flag could waive the clearance gate for every op in an 80-op program, including `move_z` + `move_and_capture` / `survey_bed` below the floor. Clearance waivers should be per-op, and the confirm page should name each op they apply to.
- **`camera_program` bundles `move_z` with XY ops under one approval.** That is lawful under law 1's procedure resolution, but nothing in the description says that XY inside the program is re-gated at the floor after a program `move_z` lowers the head. It also does not say whether `move_and_capture`'s own Z-gate (raise to 328) still runs inside a program.
- **`set_active_tool` lets a no-motion call change clearance math.** If it overrides the "longest candidate" rule, a mistaken or stale short protrusion (for example, written by a setter run for one tool and then the probe refitted) silently lowers every physical-basis obstacle requirement. It has no expiry, no B or tool-change invalidation, and no read-back on the confirm pages that I can see.
- **`survey_bed` seam drift → model unverified.** This can fire on a wrong `plane_z` and then block `plan_view_pose` and `overlap_fraction`. That costs an extra traverse approval to re-verify.
