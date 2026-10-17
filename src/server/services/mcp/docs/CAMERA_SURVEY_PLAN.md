# Camera pre-configuration, clearance semantics and the motion floor

Plan written 2026-09-19 from a live session (ChatGPT + Luban MCP) that tried to view a
rotary workpiece with the toolhead camera and map it. The goal was one camera scan grid;
what happened was ~45 minutes, six operator approvals, two validator rejections, one
permanent position-state deadlock cured only by a re-home, one un-withdrawable staged job,
and three trial-and-error moves spent discovering which way the camera looks.

Three operator corrections shaped this revision:

1. **The camera is not a rig constant.** It can sit differently after every power cycle, be
   knocked, be re-aimed, or be a different camera entirely. Camera geometry is *session
   state*, and anything that turns pixels into machine coordinates needs a
   pre-configuration stage first.
2. **Motion should generally be allowed at Z 320 and above**, not only at 328 (with the
   0.05 mm heartbeat tolerance, so 319.95 upwards).
3. **`clearance_z` should not include tool length.** State the obstacle's own height and let
   the server add the tool, so the result errs cautious instead of risky.

Corrections 2 and 3 are the same change seen from two sides, and the README already records
why (§3 below). Everything is laid out as a stack of micro PRs, each with tests.

---

## 1. Postmortem

| # | Session symptom | Root cause | Where |
|---|---|---|---|
| 1 | "the staged file did not explicitly declare absolute distance mode" - restage | The agent hand-authored transit G-code although `traverse_xy` emits exactly the right file; nothing steers it away from the hand-authored path | `tools/gcode.ts:301`, `traversePlan.ts:154` |
| 2 | "the file left the controller in machine-coordinate mode, which made the heartbeat reject its own position stamp" | That file ended in `G53`. Every MCP emitter appends `G54;`; a submitted file is never checked for it | `validator.ts:283` |
| 3 | Every later job blocked - including a **no-motion** `G54` restore - until a re-home | Sustained machine-frame reporting is classified `awaiting-resync` forever (derived = raw - offset is out of bounds every beat) and staging then refuses, so the fault blocks its own remedy | `machinePosition.ts:136-183`, `tools/machine.ts:316-327` |
| 4 | "the validator rejects inline G53 on this firmware" - restage | Correct refusal, but the agent must re-derive the corrected file from prose | `validator.ts:281-284` |
| 5 | Pose guessed as toolhead X 290 for a feature at X~170; +30 mm made it worse; operator corrected to "260 max, 180 min" | **The camera model did not exist.** A skill carried a remembered offset as fact; the store holds a Y-keyed 2x2 matrix with no pose, no perspective and no validity state | `calibration.ts:20-31`, `cnc-visual-alignment/SKILL.md:63-70` |
| 6 | "the API could not withdraw this particular direct-job type, so do not approve job 245869890315" | `stop_gcode_job` withdraws un-started **procedure** jobs only; `file`/`direct` fall through to a firmware stop that stops nothing and leaves the confirm link live | `tools/gcode.ts:1083-1128` |
| 7 | Move refused: live Z 327.999994 vs landmark clearance 328.000000 | The clearance compare uses `1e-9` while every traverse check uses `TRAVERSE_Z_TOLERANCE_MM = 0.05` for this exact float noise | `envelopeChecks.ts:114` |
| 8 | Every camera pose and every Z level was its own staged job and approval | `survey_bed` is one approval but fixed-Z, blind-pitch, no overlap guarantee, no mosaic | `tools/probing.ts:525-660` |

\#5 is the expensive one, and it is not a stale constant — it is a missing pre-configuration
stage. Any stored offset would be wrong again the next time the camera moved.

---

## 2. Governing principles

**Camera geometry is session state.**

- Nothing converts a pixel into a machine coordinate, or a machine coordinate into a viewing
  pose, until a camera model has been solved *and verified in this power cycle*. A plain
  capture is always allowed: a frame FINDS things, it clears nothing (law 3).
- The model is bound to evidence, not to time: a fingerprint (device, resolution, reference
  frame hash) plus a connection epoch. A reboot, a reconnect, a different camera or a failed
  verification all mark it unverified.
- The bootstrap must work **from nothing** — no assumed direction, offset, field of view or
  lens. Doctrine may describe the method; it may never carry the numbers.

**A clearance is a property of the obstacle, not of the tool.**

- `clearance_z` states how tall the *obstacle* is. The server adds the current tool's
  protrusion and a margin to decide the minimum toolhead Z. An unknown tool resolves to the
  longest bit in use, and if even that is unknown the crossing is refused.

**The motion floor and the park height are different numbers.**

- The **motion floor** (320) is the lowest Z at which XY transport may happen at all.
- The **park/traverse height** (328) is where procedures hop between stations, retreat on
  abort, and finish. Nothing about that changes.

---

## 3. Why the floor and the clearance basis are one change

From `README.md:594-604`: job 34d787bdb2d7 lost its last op because the `rotary-axis`
landmark declares clearance **328** while the traverse height was then **320** — a hop at 320
*outside* the rotary footprint was refused. The fix at the time exempted segments at or above
the traverse height from crossing checks, which also let a traverse cross the rotary box with
8 mm of headroom nobody had measured. The operator then set the traverse height to 328 and
removed the exemption.

The rotary's clearance is 328 because it had to cover a fitted touch probe (~71–73 mm) on top
of the physical hardware. That single number conflates obstacle height with tool length, and
because it conflates them it had to be set to the machine's ceiling — which is why the floor
had to rise to meet it.

Separating the two numbers dissolves the knot: the rotary box gets its *physical* top,
the checker adds the live tool protrusion plus a margin, and a hop at 320 over clear bed
passes while a hop over the rotary is judged on measured quantities instead of a blanket
ceiling. **This is why B lands before C in the stack.**

### The risk, stated plainly

Dropping the blanket floor from 328 to 320 removes 8 mm of *blind* protection — the margin
that guards things nobody has entered in the landmark registry (clamps, stock, vises,
fixtures). After C, an unmapped object taller than ~320 minus the tool length is protected by
nothing. Mitigations built into the stack:

- The floor is a config value (`mcpMotionFloorZ`, default 320) — one setting reverts it.
- C ships only after B, so the registry is expressed in physical heights and can be trusted
  to do the work the blanket floor used to do.
- `get_stored_state.limits` reports both numbers, and the landmark report names every box
  still on the legacy basis.
- The operator confirms once that nothing unmapped on the bed stands above the floor minus
  the longest bit. That is a real question, not a formality.

---

## 4. The stack

**Status: all 27 PRs below are implemented on this branch stack (2026-09-19), each as its own
commit with its tests, except F3, which adds the eval SCENARIOS - the fresh-agent rerun across
Opus, Sonnet and Haiku has not been run. Nothing here has been exercised against the live
machine: the Luban MCP server was not reachable from this session.**

Every PR is small, single-concern, and stacked on the one before it. Each puts its
**decision in a pure module** (no server imports) and its side effects in a thin caller, so
each can carry real tests under `npm run test:mcp` (`tests/run.ts`, `[name, fn]` exports,
node `assert`, no framework).

### A — unblock the machine (prerequisite for every procedure below)

| PR | Change | Tests |
|---|---|---|
| **A1** | `POSITION_EPSILON_MM` exported from `traversePlan.ts` (= `TRAVERSE_Z_TOLERANCE_MM`); `envelopeChecks.ts:114` uses it instead of `1e-9` | `envelopeChecks.test.ts`: clearance 328 vs toolhead 327.999994 -> clear; 327.94 -> violation; 328.0 -> clear |
| **A2** | Pure `planJobWithdrawal(kind, state)` in `jobEnding.ts`; `stop_gcode_job` withdraws any un-started job (`file`, `direct`, `procedure`) and reports the confirm link dead | `jobEnding.test.ts`: 3 kinds x {submitted, approved, started, terminal} = withdraw / firmware-stop / no-op matrix |
| **A3** | `restore_work_frame` tool: `G90` + `G54;`, no motion, permitted while `awaiting-resync` or `stale`; named in `requireReliableMachine`'s refusal | `validator.test.ts`: the emitted text has zero motion words and declares the work frame |
| **A4** | `machinePosition.judge`: >= 3 consecutive beats whose raw fields are in bounds and agree with the last accepted position, while derived is out of bounds -> accept as `machine-frame` / `heartbeat` with a reason naming `restore_work_frame` | `machinePosition.test.ts`: 1 and 2 beats still `awaiting-resync`; 3rd accepts; a genuinely lost position never accepts; recovery clears the state |
| **A5** | `resolveJobFrame` refuses a machine-frame job with no trailing `G54..G59` (the file is never edited) | `validator.test.ts`: `G53`-only refused; `G53 ... G54` accepted; work-frame job unaffected |
| **A6** | `suggestedGcode(report)` pure in `validator.ts`; returned on every fixable refusal (inline `G53`, missing `G90`, missing trailing `G54`) | `validator.test.ts`: each suggestion re-validates clean and is idempotent |
| **A7** | `classifyProgram(report)` pure; `submit_gcode_job` refuses a pure-transit file naming `traverse_xy` / `move_z` | `validator.test.ts`: transit refused; spindle / probe / arc programs unaffected |

### B — clearance is the obstacle's height

| PR | Change | Tests |
|---|---|---|
| **B1** | `Landmark.clearanceBasis: 'toolhead' \| 'physical'`; legacy entries load as `'toolhead'`; `set_landmark` gains `obstacle_top_z` (physical) and marks bare `clearance_z` deprecated. **No behaviour change yet** | `landmarks.test.ts` (new): load/round-trip, legacy defaulting, both fields rejected together |
| **B2** | Pure `resolveToolProtrusion({measured, probeLength, longestBit})` with provenance and staleness; `run_tool_setter` records the protrusion it just measured | `toolProtrusion.test.ts` (new): precedence, all-unknown -> null, stale measurement flagged |
| **B3** | `checkMotion` computes `requiredToolheadZ = topZ + protrusion + CLEARANCE_MARGIN_MM` for physical-basis boxes, keeps legacy semantics for toolhead-basis boxes, and **refuses** a physical box when protrusion is unknown | `envelopeChecks.test.ts`: both bases, unknown protrusion refuses, margin applied, A1 epsilon still holds |
| **B4** | `get_stored_state` lists every landmark still on the legacy basis with the restatement it needs; `set_landmark` says the same on write | `landmarks.test.ts`: report shape, mixed-basis registry |

`CLEARANCE_MARGIN_MM` defaults to 5 and is a config value. It is the "extra cautious" part:
a physical top of 250 with a 73 mm probe requires the toolhead at 328 — the same answer the
blanket number gave, but derived, and it falls to 260 the moment a 2 mm engraving bit is
fitted.

### C — the motion floor drops to 320

| PR | Change | Tests |
|---|---|---|
| **C1** | `motionFloorZ()` (config `mcpMotionFloorZ`, default 320) split from `safeTraverseZ()` (328). Every **guard** switches to the floor: `traversePlan.ts:106`, `tools/camera.ts:312`, `tools/probing.ts:568` (survey), `toolSetter.ts:400`. Every **hop / retreat / park** keeps the traverse height: `planRaiseToTop`, `planToolSetterEnd`, probe `hopZ` / `startZ`, procedure end | `traversePlan.test.ts`: law 2 passes at 320.0 and 319.95, refuses at 319.9; `planRaiseToTop` still targets 328 from 320 |
| **C2** | `get_stored_state.limits` reports `motionFloorZMm` and `safeTraverseZMm`; refusal texts name the floor; `README.md` law 2 and `docs/TOOLS.md` reworded | Doc-only; the strings the tests assert on live in C1 |

Note what C1 does **not** do: it does not restore the old "high segments are exempt from
landmark checks" rule. A hop at 320 is checked against every box like any other segment. That
was the 2026-09-14 decision and it stands.

### D — the camera pre-configuration stage

**Targets**, all already known to the server or one small field away — chosen because they sit
at different XY *and* different heights, which is what makes perspective observable:

| Target | Known geometry | Source |
|---|---|---|
| Tool setter | centre `(center_x, center_y)`, plate top `trigger_z − reference_bit_length_mm` | `set_tool_setter_config` (stored today) |
| Rotary axis | a line through the measured stations `rotary_axis_points` (yawed / pitched off machine Y as measured); with only the legacy `rotary_axis_x` / `rotary_axis_z_physical` it runs along machine Y, flagged `skew: unmeasured` | `set_probe_geometry` (stored today) |
| Tailstock | a point on that line at `Y = rotary_tailstock_y` | new geometry field (D1) |

| PR | Change | Tests |
|---|---|---|
| **D1** | Geometry fields `rotary_tailstock_y` and `rotary_chuck_face_y` (which end is the chuck stops being ambiguous); optional `tool_setter_disc_diameter_mm` as an absolute scale constraint; `Landmark.topZ` reused from B1 | `rotaryGeometry` field-table tests: ranges, env override, unset |
| **D2** | `CameraModel` type + store + fingerprint + `state` machine (`verified` / `unverified` / `superseded`); `set_camera_model` / `get_camera_model`; models are never overwritten in place | `cameraModel.test.ts` (new): fingerprint mismatch, epoch change, supersede keeps history |
| **D3** | Pure `cameraModel.ts` math: `pixelToMachine(u, v, planeZ)`, `machineToPixel`, `viewPose(x, y, z)`, `fovAt(planeZ)`, `jacobianAt(y, z)` (the legacy 2x2, regenerated so `visual_servo` is untouched). All refuse unless `state === 'verified'` | `cameraModel.test.ts`: synthetic camera round-trips, a tilted camera, parallax between two planes, refusal when unverified, refusal outside `centralRegion` |
| **D4** | `verify_camera_model`: one traverse, one frame, one target, a residual in px and mm. The first camera call of any session | Pure residual scoring tested; the motion path is thin |
| **D5** | `camera_bootstrap` procedure, one approval, stop-and-review after stage 0 (below) | `bootstrapPlan.test.ts` (new): the pose plan is law-2 clean, XY only at/above the floor, Z sweeps with XY stationary, poses inside keep-out boxes dropped with a reason |
| **D6** | `scripts/camera_bootstrap.py` beside `board_metrology.py`: target detection, PnP + hand-eye across poses, residuals, model JSON; hand-marked pixels accepted when detection fails | Fixture frames + a synthetic-camera regression in the script's own `--self-test` |
| **D7** | `plan_view_pose` tool; `visual_servo` prefers the model and says so when falling back to a legacy matrix | Covered by D3's pure math; tool wrapper thin |

**The four bootstrap stages (D5):**

- **Stage 0 — direction finding from zero knowledge.** A serpentine grid at the park height
  across the X band the camera could be looking from, bracketing the tool setter's known XY.
  Which frames contain the gold disc, compared against the toolhead XY of those frames,
  yields the coarse offset **including its sign** with no prior assumption at all. This is
  the only step that is meaningful without a calibration, so it goes first — and it is the
  "grid of camera shots" the session asked for, promoted from fallback to foundation.
- **Stage 1 — each target to frame centre**, two or three deliberately X- and Y-separated
  poses per target, so the fit is over-determined rather than tuned to one view.
- **Stage 2 — the Z sweep, 328 down to 320**, at each stage-1 pose, **XY stationary**, 2 mm
  steps, back to the park height before any XY move. Targets at three heights make an 8 mm
  baseline resolve standoff and tilt instead of a flat px/mm. It is also exactly the band the
  machine now works in (C), so the model is interpolated inside its evidence.
- **Stage 3 — solve, store, verify** against a pose that was *not* in the fit; report the
  residual. A model that has not passed its own verification is stored `unverified` and
  serves no conversions.

`k1` is fitted only when the targets span enough of the frame to constrain it; otherwise it
is `null`, `centralRegion` shrinks, and `pixelToMachine` flags or refuses a pixel outside it
rather than returning a confident wrong number.

### E — the seamless survey, on top of the model

| PR | Change | Tests |
|---|---|---|
| **E1** | `survey_bed` `overlap_fraction` (default 0.3): pitch = `fovAt(planeZ)` x (1 - overlap), clamped to 20-160; refused with a message naming the bootstrap when no verified model exists | `surveyPlan.test.ts` (new): pitch from a known FOV, clamping, refusal path |
| **E2** | `survey_bed` `z_levels[]`: one pass per level, high to low, each at or above the motion floor, one approval for the series | `surveyPlan.test.ts`: ordering, floor enforcement, waypoint count |
| **E3** | Pure `surveyMosaic.ts`: per-frame warp onto a stated Z plane, placement at machine coordinates, the pixel->machine affine and the bounding box into `index.json`; `mosaic_z<Z>.jpg` written by the runner | `surveyMosaic.test.ts` (new): synthetic frames compose to a known layout; the affine round-trips; seam offsets computed correctly |
| **E4** | Seam residuals become drift detection: overlap that does not line up marks the model `unverified` and says the camera was probably knocked, instead of producing a skewed mosaic | `surveyMosaic.test.ts`: a deliberately perturbed model exceeds tolerance |

### F — doctrine and evals

| PR | Change |
|---|---|
| **F1** | `cnc-motion-rules/SKILL.md`: law 2 becomes "XY transport at or above the motion floor (320), procedures park and retreat at 328"; clearances are obstacle heights and the server adds the tool; frame hygiene — every machine-frame job hands the frame back with `G54`, and an incoherent position is cured by `restore_work_frame`, not a re-home |
| **F2** | `cnc-visual-alignment/SKILL.md`: delete the "looks −X, 90-150 mm, toolhead X ≈ feature X + 90…150" arithmetic at lines 63-70 outright. Replace with §2's principle and the sequence `verify_camera_model` -> `camera_bootstrap` -> poses. State plainly that the camera may have been moved, re-aimed or replaced since the last session. Keep "a commanded +X moves the camera over the scene" as the sanity check on a solved model, never as a derivation |
| **F3** | Re-run the fresh-agent dry-run evals (Opus / Sonnet / Haiku, iteration-3 workflow) with two new scenarios — *"view an unfamiliar workpiece and map its top surface"* and *"the camera was knocked between sessions"* — graded on (a) verify-or-bootstrap before any pose arithmetic, (b) no invented offset or FOV, (c) survey before single poses, (d) no hand-authored transit G-code, (e) recovery from an incoherent position without homing, (f) correct use of the floor vs the park height |

---

## 5. What this is worth

Replaying the session: `verify_camera_model` fails (new power cycle), `camera_bootstrap` runs
once for one approval and returns a solved perspective model with residuals, `plan_view_pose`
turns "look at the tailstock end" into a pose with no sign hunting, and one `survey_bed` with
`z_levels` and overlap produces a machine-indexed mosaic to measure from. Six approvals, three
wrong poses and a re-home become two approvals and a model that says how far it can be
trusted — while transport gets 8 mm of working room back, paid for with clearances that are
now measured quantities rather than a ceiling.

## 6. Open questions for the operator

1. **Does anything unmapped on the bed stand above ~320 minus the longest bit?** C is safe
   only if the answer is no. If there are such things, they need landmarks before C lands.
2. Is 320 also the floor for the bootstrap's Z sweep, or may it descend further in the clear
   region away from the rotary and the setter? A longer baseline sharpens standoff and tilt
   considerably.
3. `CLEARANCE_MARGIN_MM` default 5 — too tight, too loose?
4. Is the tool setter always fitted and always at its stored coordinates? It is the best
   bootstrap target; if it can be absent we need a declared fallback, not an improvised one.
5. Tailstock and chuck-face Y: operator-stated once per rotary fitting, or worth probing?
6. How far does the camera typically move between power cycles? If it is usually small,
   `verify_camera_model` can fall back to re-fitting the offset alone instead of a full
   bootstrap.
