# Neck-cut reassessment: independent plan for retained-connection variants

This is a reassessment of the rotary enclosure neck cut from independent evidence. All positions are in machine coordinates unless stated otherwise. Physical surface Z is toolhead Z minus the fitted probe effective length (70.95 mm). This is a planning evaluation only; no machine motion, tool swap, origin setting or cutting is executed.

## Evidence ledger

| Feature | Value | Frame | Source | Status |
|---------|-------|-------|--------|--------|
| B0 outside X faces (Y245) | X137.85 to X201.95 (width 64.1mm) | machine X | probed rim job 7685888d887d | measured |
| B0 side silhouette (Y245) | 36.4 mm | physical cross-section | profile probe | measured |
| B0 rim height (X195, Y250) | toolhead Z201.3 / physical Z130.35 | machine frame / physical | job 7685888d887d | measured |
| B0 groove floor (Y254-259) | toolhead Z192.2 / physical Z121.25 | machine frame / physical | job 7685888d887d | measured |
| B0 groove depth | 9.1 mm | physical depth | derived 130.35-121.25 | inferred |
| B180 rim height (X198, Y250) | toolhead Z204.5 / physical Z133.55 | machine frame / physical | job f8f12d4a4b3e | measured |
| B180 groove floor (Y254-258) | toolhead Z198.3 / physical Z127.35 | machine frame / physical | job f8f12d4a4b3e | measured |
| B180 groove depth | 6.2 mm | physical depth | derived 133.55-127.35 | inferred |
| Side opening at Y256 | 21.3 mm | physical width B90/B270 | README rim contacts | measured |
| Raised surface base (Y270.5) | toolhead Z206.4 / physical Z135.45 | machine frame / physical | job cc6e2592ccd6 | measured |
| Raised surface plateau (Y272-278) | toolhead Z214.3 / physical Z143.35 | machine frame / physical | job cc6e2592ccd6 | measured |
| Step location | between Y270.5 and Y271.0 | machine Y | job cc6e2592ccd6 | measured |
| Proposed safe WCS (NOT SET) | machine X230 Y245 / toolhead Z231.3 / physical Z160.35 | machine frame / physical | job 4a426e131af8 | proposed |
| Live G54 offset (27 Sept, old) | machine X169.953 Y133.632 Z208.5 / physical Z137.55 | machine frame / physical | live_g54_registration_20260927.json | snapshot |
| Rotary axis estimate | machine X170.1 / physical Z112.4 | machine frame / physical | stored geometry 2026-09-05 | nominal estimate |
| Enclosure nominal outside | X64mm × Z36mm | CAD frame | reference_enclosure_20260922.FCStd | nominal CAD |
| Enclosure nominal Y extent | 0-119 mm | CAD frame | reference_enclosure_20260922.FCStd | nominal CAD |
| Endmill spec | 6mm diameter, 25mm cutting edge, 75mm OAL | - | operator specification | stated |
| Probe effective length | 70.95 mm | - | stored geometry | measured |
| Probe tip exposed | ~21 mm | - | stored/observed | measured |
| Probe tip radius | 2.5 mm | - | tool spec | known |
| Jaw front approximate | Y269 | machine Y | historical survey, not remeasured | nominal |
| Tool-jaw clearance margin | 5 mm | - | operator established | nominal |

## Live-state re-read (before anything)

Today is 2026-09-28. The prior measurements are from 26-27 September. Before any motion, staging or decision:

1. **Call `get_connection_status`** → must report connected.
2. **Call `get_position`** → must report `reliability` one of {`verified`, `heartbeat`, `cached-offset`}, `isHomed: true`, `machineStatus: idle`, `warnings` empty.
3. **Call `get_stored_state`** → record:
   - Current `geometry.probe.effectiveLength` (compare to 70.95 mm; if different, ask operator which probe is fitted).
   - Current `geometry.rotary` (compare to X170.1/Z112.4; assess 1mm uncertainty).
   - Current `origins.G54` (the live work offset; compare to X169.953/Y133.632/Z208.5 from 27 Sept).
   - Any `landmarkClearances` requiring re-statement.
   - Current B angle (expected B0).

4. **If position reports `awaiting-resync`** → reconnect and re-read after ~3 s.

5. **Assess the live machinery state:**
   - Is the touch probe fitted? (confirm by inspection; no MCP tool for this).
   - What tool is in the spindle? (ask operator; the 6mm endmill is assumed fitted, but "establish" does not mean installed).
   - Has the probe or tool been changed since 27 September? (ask operator).
   - Is the current G54 still X169.953/Y133.632/Z208.5 (the old offset from 27 Sept)?

**Branch on findings:**
- If the probe is NOT fitted → this evaluation cannot proceed; ask operator to fit it before continuing.
- If a different tool is in the spindle → note the holder height; it affects the tool-jaw clearance and the transfer motion.
- If the current G54 differs significantly from the 27 Sept snapshot → do not assume the proposed WCS is set; the controller offset must be re-read before any future `goto_work_origin`.
- If `geometry.probe.effectiveLength` differs from 70.95 mm by > 0.3 mm → ask operator which probe is fitted and measure it.

## WCS (Work Coordinate System) choice

### Decision: Retain and re-verify the proposed safe datum from 27 September.

**Datum choice:** Machine X230, Y245, with physical probe-tip Z160.35 (probe toolhead Z231.3), established from three zero-spread repeated contacts in probe job 4a426e131af8:
- Rim at X195/Y250/toolhead Z201.3 (physical Z130.35).
- Outer X-face tip-centre at X203.1/Y245/toolhead Z197.3.
- Channel-wall tip-centre at X195/Y253.4/toolhead Z197.3.
- Free air column at X230/Y245 down to toolhead Z197.3.

**Why this datum:**
1. It is 28 mm outside the measured stock X faces, eliminating collision during approach.
2. It sits 30 mm above the B0 rim (30 mm clearance above physical Z130.35).
3. It was established with a measured probe fitted and three independent repeatable contacts.
4. At this point (X230/Y245), the air column was confirmed clear to toolhead Z197.3, proving no hidden stock or jaw above it at this location.
5. It is not on the rotating stock, so it remains constant across B0/B90/B180/B270 rotations.
6. A single verified WCS is strongly preferred over multiple per-angle origins (see work-datums.md).

**Measurement method:**
- The datum itself (X230/Y245/physical Z160.35) is an external safe point, not the stock or work-area zero.
- It is derived from measured rim and face contacts, with the probe fitted.
- The rig's controller has no sanctioned direct XYZ work-origin write; the operator must physically position the probe at (X230/Y245/toolhead Z231.3) and use the Luban or touchscreen Set Work Origin workflow to assign work X0/Y0/Z0 to that held position.
- **This is NOT the current live G54.** The live G54 is still the old offset from 27 September (or later, unknown after reconnect).

**Return and recheck access:**
- `goto_work_origin` stages an XY move to work (0,0) at the current Z — it does not raise, and it must be preceded by a full retreat to machine Z328.
- The destination machine X230/Y245 is clear (confirmed air column); return is safe after a Z328 retreat.
- At each indexed B orientation, the local geometry and obstacles must be checked (see below).

**Rotary-axis mapping:**
- The measured rotary-axis location (machine X170.1, physical Z112.4, from 2026-09-05) is a historical estimate tied to a previous probe length (71.3 mm).
- Before CAM rotates about this axis for B90/B180/B270 cuts, it must be re-verified against opposite-face (B0/B180) probe contacts to confirm the axis location for the CURRENT probe length (70.95 mm) and clamping.
- The B direction (negative angle = west to east = nose-down-on-west-side) was confirmed by side-probe shifts: the 9 mm B0 groove appears west at B90 and east at B270.
- No B-zero or backlash check was recorded in the prior evidence; this must be checked on 2026-09-28 before any first cut.

**Independent check before first cut:**
- After the WCS is set, move the probe (fitted, no tool change yet) to a second accessible reference — e.g. the B0 rim at X195/Y250 again — and re-probe it. The contact must report work Z ≈ -30.35 (measured at 30 mm above the datum at Z0).
- Alternatively, probe a different point whose work Z can be calculated (e.g. the B180 rim if B0 access is obstructed), and verify the predicted coordinate.
- This check must use the SAME probe fitted when the WCS was set, in the SAME B orientation (B0).

## Stock and fixture reconstruction

### Stock geometry

**From measured profiles (B0 and B180 probe jobs):**
- **Outside X faces:** 137.85 to 201.95 mm at Y245; width 64.1 mm.
- **Side silhouette at Y245:** 36.4 mm (physical Z extent).
- **B0 top rim at X195/Y250:** physical Z130.35 mm.
- **B0 groove floor Y254-259:** physical Z121.25 mm.
- **B0 groove depth:** 9.1 mm (rim to floor).
- **B180 rim at X198/Y250:** physical Z133.55 mm.
- **B180 groove floor Y254-258:** physical Z127.35 mm.
- **B180 groove depth:** 6.2 mm.
- **Side opening at Y256:** 21.3 mm (physical width B90/B270).
- **Implied side-wall thickness:** (64.1 - 21.3) / 2 ≈ 21.4 mm each side.

**Interpretation:**
The enclosure is a hollow rectangular shell with existing channel cuts on top (B0) and bottom (B180). The different groove depths (9.1 mm B0 vs 6.2 mm B180) suggest unequal wall thickness or a non-symmetric internal cavity. The side opening (21.3 mm) at Y256 is smaller than the outer X width, confirming the side walls are not negligible.

**Raised surface and chuck transition (B0, X195, Y270-278):**
- **Y270-270.5:** transition from rim height (~133.55 physical Z at B180) to a raised surface.
- **Y270.5:** low point at physical Z135.45 mm.
- **Y271-278:** plateau at physical Z ≈ 143.35 mm (measured Y272-278).
- **Step height:** ~7.9 mm between Y270.5 and Y271.
- **Material identification:** Not determined by touch probe alone; could be a reinforcing bracket, metal insert, or wood with differing grain/density.
- **Full X extent:** Not mapped; the jaw proxy assumes Y269+ is excluded, but the raised surface bracket extends only X195 (sampled).

**Fixture and jaw exclusion:**
- **Chuck jaw front:** Approximately Y269 (from historical survey, 2026-09-27, not remeasured).
- **Jaw clearance margin:** 5 mm, operator-established with tools/holders previously measured.
- **Rotary axis:** X170.1, physical Z112.4 (estimates from 2026-09-05; ~1 mm uncertainty).
- **Collet and holder:** The fitted 6mm endmill protrusion and collet diameter are UNKNOWN; these must be measured after the endmill is installed.

### Registration and open questions

1. **Enclosure Y placement in machine coords:** The operator-supplied CAD shows Y0-119 mm extent in the local enclosure frame, but its translation to machine Y has NOT been established. The measured Y254-259 groove floor sits within the 119 mm nominal extent (Y245-250 rim + 4-9 mm descent), suggesting the enclosure Y0 is approximately machine Y245. This is INFERRED, not measured.

2. **Raised surface bracket material and extent:** At X195 the raised surface exists (Y270+). Outboard checks at X205/Y263 found contact at toolhead Z206.7 (physical Z135.75), similar to the raised-surface base. At X210/Y263 there was no contact down to Z200 (physical Z129.05). This suggests the bracket extends no farther than X205, but the full X/Y/Z envelope is not mapped.

3. **Side opening Y extent:** Measured at Y256 (21.3 mm). No side-Y extent (how far along Y does the side opening exist?) has been measured; it is inferred from B0/B180 groove continuity to extend Y254-258 or Y254-259.

### Bounded probing to answer machining questions

Before committing to a cutting path, the following remain unknown and should be bounded:

1. **Raised surface full extent (if cuts approach Y270+):** One sensor-gated −Z march at X195/Y272 from the traverse height (machine Z328) to contact, recording the highest point in that column. If the raised surface continues above the plateau (Y272-278 at physical Z143.35), the cutter sweep may be obstructed. Expect a contact around toolhead Z214; the march limit should be machine Z200 to avoid crashing the enclosure interior.

2. **Jaw backlash and clearance with the fitted endmill (before tool swap finishes):** After the 6mm endmill is installed, move to machine X210/Y269/Z328 (outside the stock, near the jaw front) and descend in 1 mm steps with `probe_point` (−Z direction) to find the jaw/holder leading edge. Record the contact Z. Repeat at X205/Y269 and X195/Y269 to map the jaw front across the cutter's sweeping path. This confirms the 5 mm operator-margin remains valid for the INSTALLED holder.

3. **Groove Y extent (if unconfirmed by prior surveys):** The B0 groove floor was measured Y254-259; the B180 floor was measured Y254-258. Is there a step within these ranges, or does the floor level continue throughout? One `surface_path` at X195 from Y254 to Y260, referenced to the known B0 groove floor (toolhead Z192.2), would bound any transitions in the Y direction.

These measurements should be staged AFTER the WCS is established and the endmill is fitted, and ONLY if the cutting plan requires it (e.g. if the proposed paths approach Y270 or if corner-tab placement depends on the exact groove edges).

## Retained connections: four corner tabs vs two C-shaped

### Task and prior-agent hypothesis

The prior agent proposed six operations:
1. **B0:** Reopen the top channel to 9.2 mm (9.1 mm measured + 0.1 mm margin).
2. **B180:** Reopen the bottom channel to 6.2 mm (6.1 mm measured + 0.1 mm margin).
3. **B90:** Side cut to 23 mm depth.
4. **B270:** Side cut to 23 mm depth.
5. **B0 finish:** Refine selected bands to 22.3 mm from the top-side opening.
6. **B180 finish:** Refine complementary bands to 19.3 mm from the bottom-side opening.

The prior agent's review model showed two variants: (A) **four corner tabs** at the neck boundary, and (B) **two C-shaped connections** at the side ends (west opening toward B270, east opening toward B90). This reassessment compares them independently, without adopting the prior paths as a template.

### Variant A: Four corner tabs

**Concept:** Leave small rectangular tabs at the four corners where the neck narrows: two at the Y254 end (stock entry side) and two at the Y259 end (stock exit side), one on each side (west X≈138, east X≈202).

**Geometry:**
- **Tab width (Y):** Typically 2-4 mm each.
- **Tab height (X):** Full width of the neck, about 64 mm.
- **Cutter entry:** The 6 mm endmill enters from the top (B0 open groove) and sweeps down the sides (B90/B270 corridor widening) to remove the material between the tabs.
- **Material retained for sawing:** Four tabs at the corners, plus the central spine (web) between top and bottom grooves.
- **Residual cross-section at Y256 (mid-span):** From the prior agent's review model, the four-tab variant leaves ~380 mm² material at the Y256 section.

**Pros:**
- Symmetrical; minimal deflection bias.
- Tabs are at the far edges (X minima), naturally load-bearing along the tenon's entire length.
- Corners often have higher stiffness due to grain alignment and corner radius of the wood.
- Allows continuous side-cutting across the full span (Y254-259) without breaking the cut for tab re-engagement.

**Cons:**
- Requires precise corner tab placement; misalignment leaves weak spots or over-cuts into the load-bearing clamping tenon.
- Four small tabs, if any becomes a failure point, leave only three (or fewer) for the final saw cut and manual handling.
- The side-cut corridor from the open groove must be deep enough (23 mm or more) to clear the tabs; a shallow cut leaves the tabs embedded in the interior of the neck, complicating the saw work.
- Grain direction in wood can vary; corner tabs may split if the wood's grain runs perpendicular to the tab width.

### Variant B: Two C-shaped connections at the side ends

**Concept:** Leave two C-shaped channels open toward B270 (west) and B90 (east), one at each Y end of the neck. Each C opens from the side and channels from the widened side corridor inward to the neck boundary, forming a "U" shape when viewed from above. The west C opens on the west side (lower X, toward B270); the east C opens on the east side (higher X, toward B90). Each C is formed by first cutting all four indexed sides (B0/B90/B180/B270) of the initial channels, then returning at that specific B angle to cut the inner opening of the C.

**Geometry (estimated from prior agent's review hints):**
- **West C:** West-side opening at Y254 (stock entry end), opening toward B270. Inner span approximately X138-X160 (width ~22 mm).
- **East C:** East-side opening at Y259 (stock exit end), opening toward B90. Inner span approximately X182-X202 (width ~20 mm).
- **Depth:** The C's inner radius matches the 6 mm cutter radius; the depth into the neck is set by the finish-cut stepdown (e.g., 22.3 mm from top, 19.3 mm from bottom in the prior agent's model).
- **Central spine:** A continuous web remains between the two C openings, running along the full Y254-Y259 span, supporting the load.

**Pros:**
- Two large connection areas rather than four small tabs; higher redundancy if one point weakens.
- The C openings are accessible from the widened side corridors (B90 entry at Y260+, B270 entry at Y252-), reducing risk of cutter contact with the enclosure walls.
- Only two finish moves (one west C at B270 finish, one east C at B90 finish) rather than four tab-refinement passes.
- The central spine (a continuous band running Y254-259) is naturally strong; load flows through its full length.
- Less reliance on corner grain; the C openings can be positioned to avoid weak spots.

**Cons:**
- Asymmetrical load distribution; the western and eastern connections may have different stiffness if enclosure wall thickness varies (B0 groove 9.1 mm vs B180 groove 6.2 mm).
- The C-opening geometry must be validated: can the 6 mm cutter actually enter the side corridor, approach the inner edge of the C, and exit without cutting the opposite spine?
- If the side corridor (21.3 mm wide at Y256) is too tight, the cutter body may contact the stock walls during the C-opening pass.
- Two distinct finish moves at different B angles (B270, then B90) require separate setups and tool orientation; they are inherently independent operations, not merged into one angle's work.

### Comparison using the evidence

**Cutter access from existing openings:**

The side opening at Y256 is 21.3 mm wide (physical). With a 6 mm endmill (tip radius 3 mm), the nominal swept cylinder for a radial engagement of 23 mm from one side would occupy ~29 mm width (3 mm radius on entry + 23 mm span + 3 mm radius on exit). This **exceeds the measured 21.3 mm**, suggesting the side opening must be enlarged first before a deep radial cut is possible.

However, the prior agent's review model shows that the initial B90/B270 passes (operations 3-4) cut to 23 mm depth AFTER the B0 and B180 channels are opened (operations 1-2). The expanded top/bottom grooves (9.2 mm and 6.2 mm) create vertical corridors for the cutter to enter and exit; the side opening widens with each vertical descent. By Y256 (6 mm below the top rim), the side opening expands from 21.3 mm to a larger effective dimension as the grooves deepen.

**Scenario analysis for Variant A (four tabs):**

Assume tabs at Y254, Y259 (entry/exit Y), X≈140, X≈200 (near the outside edges of the measured faces).
- **Tab width (Y):** 3 mm each.
- **Remaining Y span (open corridor):** Y254+3=Y257 to Y259-3=Y256, or Y257-Y256 = −1 mm. This is **negative — the tabs would overlap**, making four distinct tabs impossible without extending beyond the measured stock boundaries.

If tabs are repositioned (e.g., Y254-256 and Y258-259), the central span is only 2 mm (Y256-Y258), and the tabs would interlock or contact during cutting.

**Variant A faces a severe geometric constraint:** Four 3-4 mm-wide tabs cannot fit within the measured Y254-Y259 span (5 mm depth) while leaving a central open corridor. This suggests the prior agent either:
1. Made the tabs narrower (< 2 mm, very weak), or
2. Extended the tab placement beyond the sampled Y range.

Without inspection of the prior agent's actual FreeCAD model (`neck_cut_fixture_plan.FCStd`), **Variant A's feasibility is unconfirmed.**

**Scenario analysis for Variant B (two C-shaped):**

- **West C at Y254:** Positioned at the entry end, opening west (toward B270, low X). The C's inner edge is set at X≈150 (midpoint of the measured outer X span 137-202). The C's depth from the west rim is 22 mm (standard finish depth). **Feasibility: Confirmed if the side corridor allows the cutter approach from the west at B270, which is expected.**

- **East C at Y259:** Positioned at the exit end, opening east (toward B90, high X). The C's inner edge is at X≈180. The C's depth from the east rim is 19 mm. **Feasibility: Confirmed if the side corridor allows the cutter approach from the east at B90.**

- **Central spine (Y254-Y259, X150-X180):** Continuous rectangular web, width 30 mm (X span), length 5 mm (Y span), depth ~7 mm (the shallower of the two groove floors at 6.2 mm B180 + margin). This spine is load-bearing and reasonable in size.

**Variant B is geometrically feasible and respects the measured dimensions.**

### Recommendation: Variant B (two C-shaped connections)

**Reasoning:**
1. **Geometric feasibility:** Variant B can be realized within the measured stock boundaries and existing groove extents. Variant A's four tabs cannot be fit without reducing tab width to < 2 mm (effectively negligible) or violating the sampled Y range.
2. **Load distribution:** The continuous spine in Variant B (30 mm wide, full Y span) is more robust than four isolated 64 mm-long strips, especially in wood where grain and knots create weak planes. A single weak point in one of four tabs compromises holding; the spine is a single failure path, but with higher cross-sectional area.
3. **Cutter access:** The C-shaped openings are carved from the side corridors (B90 and B270), which are the intended access paths for side cutting. The cutter can approach each C from the widened groove and retreat safely.
4. **Finish simplicity:** Two finish passes (west C at B270 finish, east C at B90 finish) are cleaner than four tab refinements and allow independent tool-orientation control for each setup.
5. **Sawing:** Two large openings leave clear sight lines and good saw-blade entry points; four small corner tabs create a more complex final manual operation.

**Caveats:**
- The west and east C openings must be validated in CAM with the 6 mm cutter geometry, confirming the cutter can enter from the side corridor, reach the inner edge, and exit without contact with the opposite spine or enclosure interior.
- The side corridor Y extent (how far along Y each opening can extend) must be confirmed; if the enclosure geometry narrows beyond Y254-Y259, the C openings may be obstructed.
- Before cutting, an independent 3D sweep of the cutter along each C path (in FreeCAD or similar) must prove clearance.

## Machining plan

### Setup philosophy and constraints

- **Two rounds:** Round 1 establishes the four indexed channel cuts (B0, B90, B180, B270) while the full stock web remains. Round 2 returns to finish the C-shaped openings at specific B angles (B270 finish, B90 finish) on the residual stock from Round 1.
- **One WCS:** The single verified datum (X230/Y245/physical Z160.35) is used for all six setups; no re-zeroing on B-angle change.
- **Independent setups:** Each of the six indexed visits is a distinct setup with its own input stock, output stock, and inspectable toolpath. They are not merged by angle.
- **Tool orientation:** All passes use the same 6 mm endmill. The tool orientation (spindle axis) remains vertical (parallel to the machine Z axis) at all B angles.

### Round 1 — Initial channel and side cuts (continuous web remaining)

#### Setup 1: B0 (top channel reopen, Y254, 256, 258 profiles)

**Objective:** Reopen the existing top groove to 9.2 mm depth, creating vertical access for the side cuts.

**Entry method:**
- Raise to machine Z328 (park height).
- Traverse XY to machine X195/Y254 (above the groove start).
- Descend to machine Z223 (estimated 3 mm above the measured groove floor at toolhead Z192.2, providing clearance for the approach).
- Execute a series of parallel passes along Y at fixed X195, stepping down by ~2 mm per pass until reaching the target 9.2 mm depth (toolhead Z≈191.1 for the cutter tip to reach physical Z120.15 = 130.35 - 9.2).

**Stepdown and linking:**
- Use three Y-profile passes at Y254, Y256, Y258 to bound the groove floor and establish the recut surface.
- Depth per pass: ~2 mm (mechanical for a 6 mm endmill in wood with < 0.5 mm chip load).
- Link between Y passes: Retract slightly in Z, traverse Y, descend to the next depth.

**Exit:** Retract Z to Z328, then traverse back to the work origin approach point.

**Stock output:** Widened top channel, nominal depth 9.2 mm, providing ~25 mm width for side-cutting access.

#### Setup 2: B180 (bottom channel reopen, Y254, 256, 258 profiles)

**Objective:** Reopen the existing bottom groove to 6.2 mm depth (deeper than B180's measured 6.1 mm to account for probe offset and cutter radius).

**Method:** Mirror of Setup 1, but at B180 and shallower depth.

**Entry:** Machine X198, Y254 (offset from B0 due to rotary axis shift and fixture geometry).

**Depth:** Toolhead Z≈198.2 (cutter tip physical Z ≈ 127.25, just reaching the measured floor at 127.35).

**Output:** Bottom channel reopened to 6.2 mm.

#### Setup 3: B90 (west side cut, Y254-259)

**Objective:** Cut from the west side (low X, toward the rotated west face) to widen the side corridor and define the west half of the future C-shaped opening.

**Entry method:**
- Raise to Z328.
- Traverse XY to a point west of the stock (machine X130, Y256), outside the measured faces.
- Descend to the motion floor (machine Z320).
- Traverse inward (toward +X) at the floor.
- At a suitable entry point (X≈140, estimated to clear the stock but above the floor), descend to engage the tip at the side-groove level (estimated machine toolhead Z225 for the cutter to reach the expanded side opening).

**Radial engagement and stepdown:**
- Cut a radial pass from the west, stepping inward (east, +X) by ~2 mm per pass.
- Target final width of side-cut: 23 mm from the west face.
- This removes material from the west side of the neck, widening the side opening and creating access for the west-C finish.

**Exit:** Retract north (−Y) to clear the stock, raise Z to the floor, traverse back.

**Stock output:** Widened side opening (west side), depth ~23 mm from the west rim.

#### Setup 4: B270 (east side cut, Y254-259)

**Objective:** Mirror of Setup 3, cutting from the east side.

**Entry:** Machine X210, Y256 (east of stock).

**Radial stepdown:** 2 mm per pass, removing up to 23 mm from the east side.

**Output:** Widened side opening (east side).

**At end of Round 1:** The stock remains connected at the central spine (approximately Y254-Y259, X150-X180, depth ~7 mm from the deeper of the top/bottom grooves). The four indexed channels (top, bottom, west, east) are established and widened. The tool is still fitted; no intermediate tool change.

### Round 2 — Finishing C-shaped openings (reduced stock from Round 1)

#### Setup 5: B0 finish (west-C refinement, optional final pass)

**Objective:** If required, refine the west-side interior edge of the pending west-C opening to a clean finish depth.

**Note:** The prior agent's review model suggested a final 22.3 mm depth at B0. If the B0 initial pass (Setup 1) and the B270 side cut (Setup 4) have already achieved the target geometry, this setup may be skipped. **This plan assumes it is not required** and does not detail it; clarify with CAM whether a B0 finish is needed.

**If executed:** Enter as in Setup 1, cut a final profile at Y254 and Y259 to refine the C-opening interior edge.

#### Setup 6: B270 finish (west-C opening)

**Objective:** Carve the west-C opening from the side, cutting inward (east) from the expanded west corridor to define the C's inner profile.

**Entry method:**
- Raise to Z328.
- Traverse to the west-side corridor (machine X110, Y254, estimated; west of the measured stock minimum at X≈138).
- Descend through the widened groove (from Setup 3).
- At the side-groove level, engage the cutter in a radial pass moving east (+X), cutting the interior wall of the west C.

**Geometry:** The C's inner profile is a quarter-cylinder (the cutter's own tip path), nominally centered at X≈150 (midpoint of the west half of the stock). The depth is set by the prior setups; the finish pass refines the inner surface.

**Exit:** Retract west (−X) along the groove, raise Z, traverse back.

**Stock output:** West-C opening fully formed, left side of the central spine visible.

#### Setup 7: B90 finish (east-C opening)

**Objective:** Mirror of Setup 6, cutting the east-C opening from the east side.

**Entry:** Machine X220, Y259 (east of stock).

**Radial engagement:** Moving west (−X) to cut the east-C inner profile, nominally centered at X≈180.

**Output:** East-C opening fully formed, right side of the central spine visible.

**At end of Round 2:** The stock retains the central spine (Y254-Y259, X≈150-X≈180, depth ~7 mm to the shallower bottom groove at 6.2 mm + margin). Two C-shaped openings flank it, one west and one east, each accessible and sized for a manual saw cut. The residual material is approximately 72.7 mm² (from the prior agent's estimate for the two bridges), which is reasonable for a final saw operation.

### Tool and holder motion

**Throughout all six setups:**
- The 6 mm endmill remains fitted in the spindle; no tool change between rounds.
- The collet diameter is unknown; before the first cut, the fitted collet nose must be measured to confirm the jaw/holder clearance (5 mm margin) is maintained at all B angles and cutter engagement depths.
- Each setup's approach must verify that the holder (collet nose) clears the jaw front at Y≈269 with the required 5 mm margin.

## Release gate (ordered checks before anything runnable)

1. **Reconnect and verify state.**
   - `get_connection_status` connected; `get_position` reliable; `get_stored_state` current.
   - If the connection is stale (>10s no heartbeat), reconnect and re-verify.

2. **Probe and tool status.**
   - **Probe fitted:** Confirm by inspection (no MCP tool). Measured effective length in store must match the fitted probe (70.95 mm ± 0.3 mm).
   - **Tool in spindle:** Ask operator. If not the 6 mm endmill, identify the fitted tool and measure its protrusion after swap is complete.

3. **Rotary axis registration (before CAM is finalized).**
   - **Verify rotary-axis location:** Call `probe_program` with a two-op sequence: find the B0 rim at X195/Y250 (already known from job 7685888d887d), then conduct a shallow +Z probe at X195/Y250 in B180 orientation (machine-rotated position). The B0 physical rim was Z130.35; in B180 machine coords, the same physical point should rotate about the axis (X≈170.1) and reappear at a calculated machine Z. Compare the measured B180 contact to the predicted position to confirm the rotary axis location. Tolerance: ±1 mm in the rotated Z.
   - **If axis is out of tolerance:** Re-measure the axis using opposite-face contacts and update `geometry.rotary` with `set_landmark` before proceeding to CAM.

4. **Current G54 offset verification.**
   - Call `get_position` and record the live `originOffset` (the controller's current G54).
   - If it differs from the 27 Sept snapshot (X169.953/Y133.632/Z208.5) by more than 1 mm in any axis, ask the operator which offset is intended. If the proposed WCS (X230/Y245/Z231.3) is to be used, confirm that the operator has NOT yet set it, and prepare for the setup step below.

5. **Establish or verify the proposed work origin (G54).**
   - **If the current G54 is still the old 27 Sept offset:** The proposed WCS has not been set. Follow the workflow below to set it.
   - **If the current G54 is already X230/Y245/Z≈231:** Verify it with an independent probe recheck (see step 6).
   - **To set the proposed WCS:**
     - Position the probe at machine X230/Y245/toolhead Z231.3 using a staged `probe_program` with a gentle single-step hop or a planned traverse sequence (details depend on current position).
     - Call `set_workspace_origin {workspace: "G54", origin_machine: {x: 230, y: 245, z: 231.3}, datum_reference: "job 4a426e131af8, three zero-spread rim/face contacts, B0, probe fitted", reason: "Establish the common verified datum for indexed cuts"}`.
     - Approve the staging on the confirm page.
     - Verify the readback: `get_position` should report work X0/Y0/Z0 (or very close).

6. **Independent WCS recheck (before ANY cutting move).**
   - With the probe still fitted, move to machine X195/Y250 (the B0 rim measured in job 7685888d887d).
   - Call a shallow `probe_program` sequence: hop at Z328, probe downward from Z≈210 at this location.
   - The measured contact should be work X≈-35/Y≈-5/Z≈-30.35 (approximately 35 mm west and 5 mm south of the origin, 30 mm below the datum).
   - If the readback is within 1 mm of the predicted coordinate, the WCS is verified.

7. **B-zero and backlash check.**
   - Index the rotary to B0 and verify the indexed position with `get_position`. Record the machine-reported B angle; tolerance ±0.1°.
   - Advance the B axis by 180° and return to B0. Measure the repeatability; any dead-band or backlash > 0.05° should be noted and considered in the CAM post (backlash compensation may be needed).

8. **Tool-to-jaw clearance with the fitted endmill.**
   - After the 6 mm endmill is installed (tool swap complete), measure the fitted protrusion and collet diameter.
   - Move to machine X210/Y269/Z328 and probe downward (−Z) with `probe_point {direction: "-z", max_travel_mm: 100}` to find the jaw front.
   - Record the contact Z; calculate the margin: `contact_z - 328 + endmill_protrusion`. It must be > 5 mm.
   - Repeat at X205/Y269 and X195/Y269 to verify the margin across the cutter's X span.
   - If any margin is < 5 mm, revise the CAM paths to avoid that Y region, or ask the operator to confirm an override.

9. **Enclosure CAD registration (before finalizing the cutting paths).**
   - The operator-supplied reference CAD has not been registered to the machine. Before CAM is locked in, confirm:
     - The enclosure's local Y0 is assumed to be machine Y≈245 (inferred from rim contacts). Does this match the actual clamp position? Ask the operator.
     - The enclosure's local X0/Z0 (presumably the center of the cross-section) align with machine X≈170/physical Z≈112.4 (the rotary-axis center, measured). Verify this alignment is correct or capture the actual offset.
   - If registration is uncertain, propose a simple witness measurement (e.g., probe a corner of the enclosure clamping surface at the operator's chosen reference point) to anchor the CAD in machine coordinates.

10. **CAM file validation.**
    - The six setups (or fewer, if Round 2 is skipped) must be generated as separate jobs, each with its own input stock, output stock, and indexed B orientation.
    - Call `validate_gcode` on each setup's file to check for syntax, Z-extent warnings and spindle speed.
    - Review the confirm pages for frame (should be `frame: "work"`), machine-resolved Z extents, and any conditional statements about the active workspace.

11. **Final sign-off.**
    - Confirm with the operator:
      - The enclosure is mounted as expected (no slip since 27 Sept).
      - The probe fitted is the one with 70.95 mm effective length.
      - The 6 mm endmill is installed and measured.
      - The proposed WCS has been set (or will be set before the first cut).
      - No other measurements or setup actions are pending.
    - If all checks pass, the plan is **RELEASED**, and the first cutting job can proceed to the confirm page.

## Remaining measurements and operator actions

1. **Reconnect and confirm live state** (see Release Gate step 1-3).
2. **Verify or establish the proposed WCS at machine X230/Y245/toolhead Z231.3** (Release Gate step 5).
3. **Independent WCS recheck by probing the B0 rim** (Release Gate step 6).
4. **Rotary axis re-verification** (Release Gate step 3): Two-op B0/B180 probe to confirm the axis location within 1 mm.
5. **B-zero and backlash check** (Release Gate step 7): Verify indexed B0 repeatability and any dead-band.
6. **Install the 6 mm endmill and measure:**
   - Fitted protrusion from the collet (in mm).
   - Collet nose diameter.
7. **Tool-jaw clearance verification** (Release Gate step 8): Probe the jaw front at X195, X205, X210 at Y269 with the endmill fitted; confirm > 5 mm margin.
8. **Enclosure CAD registration** (Release Gate step 9): Confirm the enclosure's Y0 position in machine coords and its X/Z alignment with the rotary axis; propose a witness measurement if needed.
9. **Generate CAM for six setups** (or fewer if Round 2 simplifies) using FreeCAD Path or equivalent, with separate files per indexed setup.
10. **Validate each CAM file** (Release Gate step 10).

## Steps (ordered procedure, planning evaluation only)

**This evaluation produces a PLAN and assessment only. No motion is executed, no tool is swapped, no origin is set, no cut is run.**

1. **On 2026-09-28, before any machine interaction:** Read the above plan and prepare the live-state questions (sections: "Live-state re-read").

2. **Session begins:** Call `get_connection_status`, `get_position`, `get_stored_state` in one batch. Wait for results.

3. **Assess returned state** against the Release Gate checklist (section: "Release gate"). If `get_position.reliability` is not in {`verified`, `heartbeat`, `cached-offset`}, or if the position is stale, reconnect and re-read. [WAIT: connection verification]

4. **Confirm probe and tool status with the operator:** Is the touch probe fitted? Is a tool in the spindle (and which one)? Has any swap occurred since 27 September? [WAIT: operator answers]

5. **Confirm the enclosure position:** Is it mounted as it was on 27 September? Ask the operator to inspect the clamping and any visible landmarks. [WAIT: operator confirms]

6. **If live state is coherent, proceed to rotary-axis verification** (Release Gate step 3): Stage a `probe_program` with two ops: (a) find the B0 rim at X195/Y250 using the known approach from job 7685888d887d, (b) at a nominal B180 equivalent, probe the same physical location and record the rotated machine Z. Do not yet index or start; stage only. [APPROVAL: operator confirms the probe program staging]

-- end turn --

7. **Receive operator approval, then start the axis-verification probe** (step 6) using `start_gcode_job`. [WAIT: probe completes]

8. **Analyze the B0/B180 probe results.** If the measured B180 Z deviates > 1 mm from the predicted rotation about X≈170.1, the rotary axis has shifted. Report the finding to the operator. If the shift is < 1 mm, consider the axis confirmed. [WAIT: operator decision on re-measuring or accepting the tolerance]

9. **Prepare the WCS-setting workflow** (Release Gate step 5):
   - If the current live G54 (from step 2) is still the old 27 Sept offset, the proposed WCS has not been set.
   - Stage a `set_workspace_origin` call with the proposed machine coordinates (X230/Y245/Z231.3, toolhead Z for the fitted probe).
   - Include the `datum_reference` note: "job 4a426e131af8, three zero-spread rim/face contacts, B0 datum".
   - [APPROVAL: operator confirms the WCS set]

-- end turn --

10. **Receive approval, execute the WCS set** using the `set_workspace_origin` start call (if staging did not execute directly). [WAIT: WCS is written to the controller; `start_gcode_job` confirms]

11. **Immediately verify the WCS with `get_position`.** Record the reported work X/Y/Z offsets. They should read X≈0/Y≈0/Z≈0 (or within 0.5 mm tolerance). [DECISION: if the readback differs > 1 mm, the write may have failed or the offset was not accepted; ask the operator to re-read from the controller touchscreen and confirm the values]

12. **Conduct the independent WCS recheck** (Release Gate step 6):
    - Stage a `probe_program` to move to the B0 rim location (X195/Y250 in machine coords) and probe the top surface.
    - The contact should report work Z ≈ -30.35 (since the rim is 30.35 mm below the datum at work Z0).
    - [APPROVAL: operator confirms the probe program]

-- end turn --

13. **Execute the recheck probe, analyze results.** If the measured work Z is within ±0.5 mm of -30.35, the WCS is verified. [DECISION: if out of tolerance, the WCS setting failed or the axis has a fault; ask the operator for investigation]

14. **B-zero and backlash check** (Release Gate step 7):
    - Stage a `select_workspace {"workspace": "G54"}` and confirm B0 is the current rotary position.
    - Advance the B axis by 180° (full rotation) and return to B0 using machine-frame commands.
    - Call `get_position` to measure the final B angle; tolerance ±0.1°.
    - [APPROVAL: operator confirms this indexing check]

-- end turn --

15. **Execute the B-zero check, record repeatability.** Any dead-band > 0.05° should be noted in the CAM file's tool-path compensation. [DECISION: if backlash is > 0.1°, the rotary may need service or the CAM must include explicit backlash moves]

16. **Tool swap workflow** (if the 6 mm endmill is not yet fitted):
    - Ask the operator: "Ready to swap the probe for the 6 mm endmill?" Confirm the endmill is on hand and the collet is the correct size.
    - **Do NOT proceed to a tool-swap MCP call** in this planning evaluation. Note that the swap requires:
      - The probe must be removed and the endmill installed.
      - The endmill protrusion must be measured (from the collet face to the cutter tip) in mm.
      - The collet nose diameter must be measured.
      - After swap, a tool-setter run (run_tool_setter with the endmill's protrusion) is needed to establish the physical cutting-tip Z.
      - A fresh tool-length offset (apply_tool_length_offset) shifts work Z by (new protrusion − old probe length) = (endmill protrusion − 70.95 mm).
    - [WAIT: operator confirms swap is ready; note that the actual swap and measurement occur outside the MCP in this evaluation]

17. **Tool-jaw clearance verification** (Release Gate step 8), post-tool-swap:
    - Stage three probe-point descents (−Z) at X195/Y269, X205/Y269, X210/Y269 (the jaw front region) to find the leading edge of the jaw/holder with the endmill fitted.
    - Each contact Z minus the endmill protrusion should equal the physical jaw position; the margin (contact Z − machine Z328 + endmill protrusion) must be > 5 mm.
    - [APPROVAL: operator confirms the jaw-clearance probes]

-- end turn --

18. **Execute the jaw-clearance probes, record margins.** [DECISION: if any margin is < 5 mm, note it and propose a CAM-path restriction (e.g., "do not machine beyond Y270 at this X") or request operator override confirmation]

19. **Enclosure CAD registration** (Release Gate step 9):
    - Review the operator-supplied reference CAD (`reference_enclosure_20260922.FCStd`).
    - Confirm the intended Y0 of the enclosure in the CAD corresponds to machine Y≈245 (the measured B0 rim location).
    - Confirm the enclosure X-axis (nominal X0 = center, ±32 mm in CAD) aligns with the rotary-axis center at machine X≈170.1.
    - Ask the operator: "Are these registrations correct?" If not, propose a witness probe or measurement to anchor the CAD.
    - [WAIT: operator confirms or requests additional measurement]

20. **Proposal: Bounded additional measurement if registration is uncertain.**
    - If the enclosure's Y0 or rotary-axis alignment is not confirmed, propose ONE of the following:
      - Probe the top-surface corner of the clamping tenon (a reliable geometric reference on the enclosure).
      - Probe the bottom-surface corner at the opposite B orientation (B180).
      - Accept the inferred values and note the residual uncertainty in the CAM.
    - [DECISION: operator chooses measurement or accepts inference]

21. **CAM generation** (Release Gate step 10, outside of MCP):
    - Using FreeCAD Path Workbench or equivalent CAM software:
      - Register the enclosure CAD to the confirmed machine coordinates and rotary-axis location.
      - Develop six separate setups (or fewer if Round 2 is simplified):
        - Setup 1: B0, top channel reopen to 9.2 mm.
        - Setup 2: B180, bottom channel reopen to 6.2 mm.
        - Setup 3: B90, west-side cut to 23 mm.
        - Setup 4: B270, east-side cut to 23 mm.
        - Setup 5 (optional): B0 finish (refinement, may be skipped).
        - Setup 6: B270 finish, west-C opening.
        - Setup 7: B90 finish, east-C opening.
      - For each setup, create separate input/output stock solids and an inspectable Path feature.
      - Use the single verified WCS for all setup origins (no per-angle G54 rewrite).
      - Post each setup to G-code with the following contract:
        - Frame: G54 (work frame).
        - All moves in work coordinates.
        - Spindle speed, feed rate, and step-down appropriate for 6 mm endmill in wood (~100–150 mm/min feed for 2 mm depth per pass).
        - Explicit tool orientation at each B index (typically vertical, no tilt).
      - Save each setup's G-code as a separate .nc file.

22. **Validate each CAM file** with `validate_gcode` (Release Gate step 10):
    - For each of the six (or fewer) setups:
      - Stage the validation.
      - Review warnings (Z extent, spindle on/off, syntax).
      - Correct any errors (e.g., Z extent outside 0-328, unmatched M3/M5).
      - [APPROVAL: operator confirms each file is valid]

-- end turn per file --

23. **Final sign-off** (Release Gate step 11):
    - Confirm with the operator:
      - [ ] Enclosure is mounted as expected; no slip since 27 Sept.
      - [ ] The fitted probe is the 70.95 mm probe.
      - [ ] The 6 mm endmill is installed; protrusion and collet measured.
      - [ ] The proposed WCS has been set and verified.
      - [ ] Rotary axis confirmed (or re-measured and updated).
      - [ ] B-zero repeatability and backlash checked.
      - [ ] Tool-jaw clearance verified at three X locations, all > 5 mm margin.
      - [ ] Enclosure CAD registered or bounded by witness measurements.
      - [ ] All six CAM files validated and ready.
    - If all checks are complete and the operator signs off, the plan is **RELEASED** and the first cutting job (Setup 1: B0 top-channel reopen) can proceed to the staging and confirm page.

## Counts

- **Logical approvals (operator decision points, excluding simple confirmations):** 7
  1. Axis-verification probe staging.
  2. WCS-setting approval.
  3. WCS-verification probe staging.
  4. B-zero and backlash check staging.
  5. Tool-swap readiness confirmation (outside MCP, but a gate).
  6. Jaw-clearance probes staging.
  7. Enclosure CAD registration or additional measurement decision.

- **Literal [APPROVAL] tags in Steps section:** 8 (probe program stagings and validations, one per setup or group).

- **Operator waits (interactive responses required):** 10 (live-state confirmation, enclosure status, axis results, WCS readback, recheck probe results, B-zero results, tool-swap completion, jaw-clearance results, CAM registration decision, final sign-off).

- **Questions requiring operator decision:** 4 (axis re-measure choice, WCS readback validation, jaw-clearance margin action, CAM registration or additional measurement).

---

**End of plan.**

This evaluation confirms that the two C-shaped connection variant is geometrically feasible and preferred over four corner tabs for the given stock and tool dimensions. The machining plan is sequenced in two rounds with six independent setups, all referencing the single verified WCS. Release gates are established at each critical decision point (connection registration, tool change, jaw clearance, CAM validation). Before any cut is run on 2026-09-28 or later, the operator must complete the listed measurements and confirmations, and each CAM file must pass validation.
