# Critique: what helped, what was missing, and risks identified

## What in the skills/docs helped

### `cnc-motion-rules` SKILL.md (the operator law)

**Invaluable for this task:**
- **Law 2** (XY transport at or above motion floor Z320, not 328) — directly enables the coarse camera survey at Z320. Without this distinction, every optical pass over the bed would need to traverse at the old safe height (328), tripling the travel distance and time.
- **Law 3** (no invented clearance; measure or operator-state) — enforced by the tools' refusal to move near unmeasured landmarks. Kept the plan from assuming the enclosure height; instead, the plan includes a find-probe to measure it before any nearby grid.
- **§3 on position-of-record reliability** — the distinction between `verified`, `heartbeat`, `cached-offset`, `awaiting-resync` and `stale` is critical. The plan uses this to know when motion is safe and when to recover.
- **§8 (abort recovery)** — straight-up to traverse height (Z328), not a "return to start height" — shaped the recovery section. This rule has been written in blood (appendix A, incident 2026-09-16).
- **Authority (law 6)** — staging returns a confirm URL which is the motion gate. This structure is why the plan can safely defer questions (batch them in one message, then stage once the operator has answered). The handoff contract is explicit: link first, then wait.

### `cnc-visual-alignment` SKILL.md

**Shaped the camera calibration phase:**
- **"Camera is session state, not a rig constant"** (§1) — directly informed the decision to verify or bootstrap every session, not assume a remembered offset. The session history in CAMERA_SURVEY_PLAN.md §5 (operator corrections) shows why: the old doctrine used "the camera looks −X, 90–150 mm" as remembered fact; three corrections later, it became "measure it with `verify_camera_model`, never derive by hand".
- **`camera_bootstrap` (§2, Luban MCP surface)** — the two-stage procedure (stage 0: direction-finding grid, stage 1+2: poses at multiple Z) is elegant because stage 0 *requires no prior assumption* about which way the camera points. This solved the "sign hunting" problem that cost three approvals in the 2026-09-19 session.
- **The bootstrap integrity check** — verify against a pose NOT in the fit (§3, camera_bootstrap). This is how you know the model is not just tuned to its own data.
- **Servo loop semantics** (§3: Positioning, steps 1–4) — the requirement to derive a calibration at the working Z, use matched-Y calibrations, and check the Jacobian prediction before trusting a servo step. The plan doesn't do open-loop visual servo (it uses the touch probe for fine measurement), but the principles inform the survey approach: the camera is used for coarse location and feature identification, not metric positioning.

### `cnc-probing` SKILL.md

**Probe planning and envelope safety:**
- **"Recover existing measurements before planning more"** (§2) — a search of prior jobs (2026-09-21, IDs 031c3eb1fe38 and d677bd88d31a) would retrieve the last enclosure survey. The plan mentions this but does not retrieve it (a dry run cannot call `get_gcode_job_status`). In a live session, this doctrine would let us reuse the measured enclosure top rather than re-measuring it.
- **Surface envelope parameters** (§5: flatness and height maps) — the table of `z_safe_delta_mm`, `max_hop_mm`, `max_drop_mm`, `hop_mode` and `coarse_step_mm` is specific enough that the plan can populate these values (5, 60, 15, guarded, 1) with confidence. Without this guidance, a guess would risk a slow scan or a collision.
- **Find-then-scan pattern** (§1: "Unknown Z, no stored axis, no operator number") — the plan uses this: sequence probe to find the enclosure top, then surface_grid using the measured contact as a reference. This is the "lawful route" per the skill.
- **Stylus reach bounds** (§1) — the touch probe's exposed length under the probe body determines how far down we can descend beside a wall. The plan does not compute this (we'd need the probe body height, which is not in the fixture), but the skill raises the issue for future fine measurement on the enclosure sides.

### `CAMERA_SURVEY_PLAN.md` and `COMPOSITE_PROBE_PROGRAM.md`

**Cleared up the floor/clearance confusion:**
- **§2: Motion floor vs park height** — 320 vs 328. The old doctrine had a single safe height (328) because clearances were toolhead-based and conflated tool length. Separating them allowed the floor to drop to 320, where XY is legal but no hop is granted without a landmark check. This is why the coarse survey can happen at Z320.
- **§2: Clearance is the obstacle's height** — the plan uses `obstacle_top_z` (physical height) instead of the old `clearance_z` (toolhead basis). The server computes `requiredToolheadZ = topZ + protrusion + 5 mm margin`. Knowing this, the plan can state "we will descend to Z250 (well above the bed) and measure where the enclosure sits", then compute safe traverse heights from the result.
- **Composite probe program sketch** (§3) — the `probe_program` tool concept is shown with example JSON. The plan does not use `probe_program` (it uses individual `probe_sequence` and `probe_surface_grid` calls, which are simpler), but the sketch shows the intended future: one approval for a multi-op survey (rotate B, probe center, surface scan, side marches). This is worth noting as a simplification path for the next iteration.

---

## What was missing, unclear, or contradictory

### 1. Landmark clearance basis conflict

**Location**: `get_stored_state.landmarks`, entry `rotary-axis`; vs `cnc-motion-rules` law 4 on the new physical-basis clearances.

**Issue**: The stored rotary-axis landmark has `clearanceZ: 328` (the old toolhead-basis number). The new law says legacy boxes keep their toolhead-basis semantics, so a box with `clearanceZ: 328` means "require toolhead at 328", not "obstacle is 328 mm tall". When the plan stages `survey_bed {plane_z: 320, ...}`, it asks for XY motion at Z320. The landmark check will compare Z320 (toolhead) against `requiredToolheadZ` (from legacy clearance, = 328). The move is refused.

**Where it matters**: The rotary box is at X 140–200 (±30 from axis), Y 0–350, and its `requiredToolheadZ` is 328. The coarse survey crosses this box. Law 2 says we can traverse at Z320 (the floor), but a legacy landmark says we must stay at 328.

**Clarification needed**: The skill says `get_stored_state.landmarkClearances` reports which landmarks "still want re-stating" in the new physical basis. The plan should read that field and, if rotary-axis is listed, either:
- Re-state it before the survey: `set_landmark {name: "rotary-axis", obstacle_top_z: <physical_height>, ...}`, or
- Raise the traverse height to 328 for this survey (losing the 8 mm advantage that C was supposed to gain).

The plan assumes the landmark will be re-stated (or that the tools will accept Z320 under the new rules), but does not verify this explicitly. **Risk: survey_bed could be refused at staging.**

**What I had to guess**: That the landmark clearance issue is resolved by PR B1–B4 (the new basis), and that `get_stored_state.landmarkClearances` will guide us. The fixture does not include that field, so the plan cannot check it.

### 2. Probe program (`probe_program`) tool schema

**Location**: `tools-list.json`, tool `probe_program`; also `COMPOSITE_PROBE_PROGRAM.md` §3.

**Issue**: The tool is defined in the fixture as a staging tool (like `submit_gcode_job`), but the detailed `ops[]` schema (which operation types, which fields per type, reference semantics like `{from: "op_id.field_name", plus: N}`) is not shown in the tools-list excerpt. The COMPOSITE_PROBE_PROGRAM.md sketch gives an example with `rotate_b`, `sequence`, `surface_path`, but it doesn't say:
- Is `rotate_b` implemented yet (or is it "open" / TBD)?
- Can a `sequence` op reference another op's result for `expected_z_machine`?
- What are the exact field names and constraints?

**Where it matters**: The plan does NOT use `probe_program` — it stages `probe_sequence` and `probe_surface_grid` separately, which are simpler and don't need the reference syntax. But if the operator asks "can we do this in one approval?", the answer depends on whether `probe_program` can chain the operations. The plan should note this as a potential simplification.

**What I had to guess**: That `probe_program` with the reference syntax is real and available (the COMPOSITE_PROBE_PROGRAM.md doc is written as a design brief ("Proposal", "What the tooling lacks today"), so it is partly future work). The plan uses only the stable, documented tools (`probe_sequence`, `probe_surface_grid`), which is safer.

### 3. Camera model `centralRegion` boundary

**Location**: `cnc-visual-alignment` SKILL.md §2, D3; not in the tool schemas.

**Issue**: The camera bootstrap solves a model and marks it `verified` if a test pose's residual is acceptable. The model includes a `centralRegion` (fractional UV bounds in the frame) outside which `pixelToMachine` refuses to operate (says D3: "refuse a pixel outside it rather than returning a confident wrong number"). This is good, but:
- The plan cannot know the exact bounds without running the bootstrap (they depend on the target positions and the fit data).
- The plan assumes the tool setter and other landmarks are *inside* the centralRegion (which is reasonable: they are prominent, near-frame-centre features). But if the bootstrap solves a model with a very narrow region (e.g. because targets were all in one corner), subsequent moves might be refused if they ask for a pose outside that region.

**Where it matters**: If the operator asks "move the camera to see the tailstock live" and the bootstrap model has a narrow region, the move might be refused with "pixel out of central region". The plan does not pre-compute the region; it trusts the bootstrap to be wide enough (a reasonable assumption for three targets spread over X and Z).

**What I had to guess**: That the bootstrap at the tool setter, rotary axis, and a point in clear bed will yield a wide enough centralRegion to cover the tailstock and enclosure (Y 90–120). This is likely true, but not guaranteed.

### 4. Recover existing measurements doctrine vs the dry-run boundary

**Location**: `cnc-probing` SKILL.md §2; the plan's footnote on 2026-09-21 jobs.

**Issue**: The plan mentions that `get_gcode_job_status` could retrieve prior enclosure surveys (jobs 031c3eb1fe38 and d677bd88d31a from 2026-09-21), but this is a dry run: we cannot call `get_gcode_job_status`. In a live session, the first step after basic checks should be to retrieve those results, parse the contact Z, and reuse it if the stock hasn't been unclamped. The plan asks the operator "has the stock moved since 2026-09-21?" but does not retrieve the evidence.

**Where it matters**: If the operator says "no, the stock is still clamped the same way", a live agent could skip the find-probe (step 5.1) and use the measured Z from the prior job directly. The plan conservatively re-measures, which is safe but slower.

**What I had to guess**: That asking the operator about stock state is sufficient (law 7: ask once). A live session would strengthen this by retrieving the prior data, then asking for confirmation. The dry-run plan cannot do that.

### 5. Probe tip diameter and effective length calibration

**Location**: `get_stored_state.geometry`; `cnc-probing` SKILL.md §1.

**Issue**: The fixture gives `probe_effective_length: 70.9` (2026-09-29) and `probe_tip_diameter: 2` (operator-stated). The plan assumes these are current. But:
- If the probe was refitted, the length changes.
- If the tip is worn or damaged, the diameter and effective length both drift.
- The skill says "never a remembered figure; measure if unset". The 70.9 is set, but how stale is "too stale"?

**Where it matters**: The fine surface grid uses this to compute physical Z from toolhead Z. If the effective length has drifted by 1 mm, the reported surface height is off by 1 mm. The plan does not include a `run_tool_setter {accept_probe_contact}` step to re-calibrate.

**What I had to guess**: That 70.9 mm is fresh enough (only 5 days old, fixture date 2026-10-04). A more conservative plan would include a one-step `run_tool_setter` at the start to measure the current length, but that would add an approval and slow the survey. The plan trades off speed for the assumption that the stored value is good enough.

### 6. First-station search window in surface_grid

**Location**: `probe_surface_grid` tool schema (tools-list.json); `cnc-probing` SKILL.md §5, parameter table; `COMPOSITE_PROBE_PROGRAM.md` §1, item 4.

**Issue**: When `expected_z_machine` is provided for station 1 (the first station of a grid), the search window is nominally `expected_z − max_drop_mm` to `expected_z + coarse_step_mm`. But COMPOSITE_PROBE_PROGRAM.md item 4 says "Add `first_station_search_mm` (bounded by the floor) or honour the explicit floor for station 1 only when no expected_z is given". This suggests there's a potential gap: if the surface is actually 20 mm below the expected_z (e.g. a pocket), the station aborts because max_drop_mm=15.

**Where it matters**: The plan uses `expected_z_machine: 205` (from the measured enclosure top) and `max_drop_mm: 15`. If the enclosure surface slopes down more than 15 mm in the grid, the grid could abort on station 1. The plan would then need to re-measure and adjust.

**What I had to guess**: That the 15 mm margin is sufficient for a ~25×20 mm enclosure area at 10 mm pitch. This is a conservative guess; if we see no-contact aborts, we can increase max_drop_mm or reduce the grid size.

### 7. Event budget computation

**Location**: `cnc-probing` SKILL.md §5, "Event budget"; fixture shows `jobEventLimit: 2000`.

**Issue**: The plan stages a survey_bed and a probe_surface_grid. The event cost for each is not pre-computed. The plan says "if estimate exceeds limit, ask the operator", but does not show the math. For the guessed parameters (survey: ~20 waypoints at Z320; grid: 2×3 = 6 stations), the event cost should be within 2000, but the plan should spell this out.

**Where it matters**: If the operator later asks for a finer grid (e.g. 5 mm pitch instead of 10 mm), that's 4×5 = 20 stations, cost ≈ 100 + 20×110 = 2300 events, which exceeds the limit. The plan should pre-compute for the guessed parameters and warn if they are refined.

**What I had to guess**: That 10 mm pitch and the coarse survey will fit within the 2000-event budget. A more thorough plan would show: `survey_bed ~20 stations × 50 events/station + 100 = ~1100 events; probe_surface_grid 6 stations × 110 = 760 events; total ~1860 events (within budget)`.

---

## What I had to guess (beyond the above)

1. **Coarse survey bounds (X 140–200, Y 80–330)**: These bracket the rotary (X~170, Y full range) and enclosure area. The operator might refine them after seeing what enclosure features matter.

2. **Z search parameters for the enclosure find-probe**:
   - `start_z_machine: 250` — well above the bed
   - `expected_z_machine: 200` — near the 2026-09-02 stale landmark (136.5 mm physical ≈ 207 mm toolhead)
   - `max_travel_mm: 60` — enough to reach the surface and a bit deeper
   These are conservative and should work, but finer guidance would come from the fixture field `probe_effective_length` (it is provided) and operator experience.

3. **Whether the rotary landmark clearance will block Z320 traverses**: Law 4 (new basis) says legacy entries keep their toolhead semantics, but the fixture does not show whether the rotation-axis entry is flagged for re-stating. The plan assumes it will not block, but cannot verify without calling `get_stored_state` and reading `landmarkClearances`.

4. **Camera model verification threshold**: The plan says "residual within a few pixels" passes. The exact threshold (2 px? 1 px? 5 px?) is tool-internal and not in the schema. A real session would see the number in the verify result.

5. **Whether the enclosure area has landmarks or keep-out zones we haven't read**: The fixture mentions "probing jobs of the QuadEink enclosure pocket from 2026-09-21/22 exist on the server" but does not list the full results. If there are keep-out zones or measured landmark boxes already stored, the plan should read them and adjust the survey bounds to avoid them.

---

## Risks in the new tools

### 1. Camera bootstrap assumes the tool setter is visible and distinctive

**Risk**: If the camera is blocked (by a clamp, stock, or the toolhead itself) or the tool setter is not in frame, stage 0 (direction-finding grid) returns no frames containing the gold disc. The job succeeds (no contact), but the result is "camera position unknown". The plan then has no offset to bootstrap poses with. The agent must ask the operator to unblock the camera or declare an estimated offset.

**Mitigation**: The plan's phase 3a includes an explicit step: "preview cameras" if two are plugged in, or "get position to identify where the toolhead is". Before staging bootstrap stage 0, the agent should verify the tool setter is in the workspace (likely, given our home Z=328 at the park position).

### 2. Motion floor (Z320) + legacy landmark clearances

**Risk**: Described in §1 above. A legacy landmark with `clearanceZ: 328` will refuse XY moves at Z320, even though law 2 says Z320 is now the floor. This could silently break existing procedures until the landmarks are re-stated in the new physical basis.

**Mitigation**: The plan should explicitly call `get_stored_state`, inspect `landmarkClearances` (which lists landmarks still on the old basis), and either:
- Refuse to proceed with coarse survey until the operator re-states them, or
- Raise the traverse height to 328 for this survey (accepting the loss of the 8 mm advantage).

The fixture does not include the `landmarkClearances` field, so this risk cannot be ruled out in the dry-run plan.

### 3. Camera model `centralRegion` is narrow

**Risk**: If the bootstrap samples targets in one corner of the frame, the fitted model will have high uncertainty outside that region. Asking for a pose (via `plan_view_pose`) that projects outside the centralRegion is refused. This is safe (it prevents confident-wrong numbers), but it limits where the agent can look.

**Mitigation**: The bootstrap should use targets spread across the depth (different Z) and breadth (different X) of the expected workspace. The plan's assumption (tool setter, rotary axis at different X/Z, clear-bed reference) is reasonable. If the bootstrap model is still narrow, the plan must ask the operator to move targets or accept a limited view.

### 4. Probe effective length staleness

**Risk**: The stored value (70.9 mm, 5 days old) may have drifted. If the probe was removed and refitted, or the tip is worn, the effective length is off. Physical Z values reported by the probe are then incorrect.

**Mitigation**: The plan trades off speed (no re-calibration) for the assumption that 70.9 mm is still good. A more conservative approach would include a `run_tool_setter` step at the start (phase 1 or 2) to measure the current length. The plan could mention this as an optional step if the operator is unsure about the probe's state.

### 5. Event budget can be exceeded without warning

**Risk**: The plan stages operations based on guessed parameters (survey: ~20 waypoints, grid: 2×3 stations). If the operator asks for finer resolution later ("5 mm pitch instead of 10 mm"), the event cost jumps. The plan will stage it anyway, and the runner will keep the first 20 events and the newest tail, trimming the log — but the summary results are never trimmed, so the data is preserved. However, diagnostics become hard to read.

**Mitigation**: The plan should pre-compute the event cost for the guessed parameters and state it in the approval message. If the operator refines the resolution, re-compute and ask again. The fixture shows `jobEventLimit: 2000` and `diagnosticsRecentLimit: 40`, so we have headroom, but it is not unlimited.

### 6. `probe_surface_grid` with unknown surface slope

**Risk**: If the enclosure top slopes steeply (e.g. 10 mm drop across 25 mm), the grid's first station might find contact, but subsequent stations could no-contact because they are beyond `max_drop_mm` from the first. The grid aborts, and we learn the slope only after the fact.

**Mitigation**: The plan uses `max_drop_mm: 15` (generous) and `z_safe_delta_mm: 5` (tight, since we know the surface). If a first abort occurs, the plan includes a recovery step (phase 5 in §8: "If any job aborts..."). The agent then retrieves the partial result, finds the first contact, and re-plans with adjusted bounds.

---

## Strengths of the plan relative to the tools

1. **Respects the staging/approval boundary**: The plan correctly separates reading-only calls (which are cheap and can happen in the same turn) from staging calls (which return a confirm URL and must pause for the operator). This is law 6.

2. **Batches questions up front**: The plan asks all four operator questions in one batch (§3), avoiding the "question per turn" anti-pattern (law 7, cnc-motion-rules §0).

3. **Uses find-then-scan for unknown geometry**: The plan probes the enclosure top to find its Z, then uses that for the grid's `expected_z_machine`. This is the lawful pattern from cnc-probing §1.

4. **Computes the fine-grid parameters dynamically**: After the find-probe result, the plan computes `start_z`, `expected_z`, and `z_safe_delta_mm` from the measured value. This avoids invented numbers.

5. **Includes recovery section**: The plan describes how to handle aborts, held contact, and position-of-record errors (§8). This is often left to the operator to reason out, but the plan makes it explicit.

---

## Recommendation for live use

1. **Before staging anything**, retrieve job 031c3eb1fe38 or d677bd88d31a to see the last measured enclosure top. If it is recent (< 7 days) and the stock has not moved, skip the find-probe and reuse the measured Z. This saves one approval.

2. **Check `get_stored_state.landmarkClearances` before coarse survey**. If rotary-axis is listed as needing re-statement, either re-state it now (new physical-basis clearance) or raise the coarse-survey height to Z328.

3. **After camera bootstrap, verify the model's centralRegion is wide enough** for the planned survey bounds. If narrow, ask the operator to re-bootstrap with wider-spread targets, or accept a limited view.

4. **If events exceed 1500 during the survey**, ask the operator whether to (a) increase the event limit, (b) coarsen the grid pitch, or (c) split into multiple approvals.

5. **Document the enclosure top Z and the fine-grid residuals** for the next session's recovery step (rule: "Recover existing measurements before planning more").

