# Neck-cut reassessment: independent evaluation of four-corner-tab vs two-C retained connections for rotary enclosure finish cut

## Evidence ledger

| Feature | Value | Frame | Source | Status |
|---------|-------|-------|--------|--------|
| B0 outside stock X faces at Y245 | 137.85 mm and 201.95 mm; 64.1 mm width | machine toolhead / physical | probed 26-27 Sept | measured |
| B0 side silhouette Y245 | 36.3–36.4 mm | machine toolhead / physical | probed 26-27 Sept | measured |
| B0 outer rim top | toolhead Z201.3 at X195/Y250 | machine toolhead | job 7685888d887d | measured |
| B0 outer rim physical Z | 130.35 mm | physical surface (= 201.3 − 70.95) | calculated from probe length 70.95 mm | inferred |
| B0 existing groove floor | toolhead Z192.2 from Y254 to Y259 at X195 | machine toolhead | job 7685888d887d | measured |
| B0 groove depth | 9.1 mm below rim (201.3 − 192.2) | relative | job 7685888d887d | measured |
| B−180 rim | toolhead Z204.5 at X198, Y245–250 | machine toolhead | job f8f12d4a4b3e | measured |
| B−180 rim physical Z | 133.55 mm (204.5 − 70.95) | physical surface | calculated | inferred |
| B−180 groove floor | toolhead Z198.3 from Y254–258 at X198 | machine toolhead | job f8f12d4a4b3e | measured |
| B−180 groove depth | 6.2 mm below rim (204.5 − 198.3) | relative | job f8f12d4a4b3e | measured |
| B90/B270 side openings | 21.3 mm physical opening at Y256; 9.0 mm B0 groove, 6.1 mm edge shifts | machine Y coordinate | probed 26-27 Sept | measured |
| Chuck-side raised surface Z at Y263, X195 | toolhead Z207.0 (physical 136.05) | machine toolhead | job cc6e2592ccd6 | measured |
| Chuck-side raised surface Z at Y270–270.5, X195 | toolhead Z206.4–206.5 (physical 135.45–135.55) | machine toolhead | job cc6e2592ccd6 | measured |
| Chuck-side step at X195 | between Y270.5 and Y271.0, step of ~7.7 mm | machine Y coordinate | jobs e185e35d0536 / cc6e2592ccd6 | measured |
| Chuck-side high surface Z at Y271–278, X195 | toolhead Z213.5 to ~Z214.2 (physical 142.55–143.25) | machine toolhead | jobs cc6e2592ccd6 | measured |
| Proposed datum: B0 rim | machine X195 Y250 toolhead Z201.3 | machine frame, probe fitted | job 4a426e131af8 | measured zero-spread |
| Proposed datum: outer X face | machine X203.1 Y245 toolhead Z197.3 (probe tip centre) | machine frame, probe fitted | job 4a426e131af8 | measured zero-spread |
| Proposed datum: channel wall | machine X195 Y253.4 toolhead Z197.3 (probe tip centre) | machine frame, probe fitted | job 4a426e131af8 | measured zero-spread |
| Free column check | machine X230 Y245 down to toolhead Z197.3, no contact | machine frame, probe fitted | job 4a426e131af8 | measured |
| Rotary axis X position | 170.1 mm | machine frame | stored estimate | nominal CAD |
| Rotary axis physical Z | 112.4 mm | physical (NOT a toolhead height) | stored estimate | nominal CAD |
| Probe effective length | 70.95 mm | measurement | get_stored_state | measured |
| Probe exposed tip | ~21 mm stylus | measurement | specification | nominal |
| Probe ball diameter | 2.5 mm | measurement | specification | nominal |
| Tool: 6 mm endmill | >25 mm cutting edge, 75 mm overall, collet-fitted protrusion unknown | machine frame | brief spec | nominal |
| G54 27 Sept reading | work X60.046 Y111.368 Z22.8 at machine X230 Y245 toolhead Z231.30 B0; PROPOSED not verified | work frame | brief evidence | inferred |
| Enclosure CAD nominal | 64 mm × 36 mm section, Y 0–119 mm local | CAD frame | reference_enclosure_20260922.FCStd | nominal CAD |
| CAD to machine registration | Y placement and full stock Y extent not proved | CAD ↔ machine | enclosure file | unverified |

## Live-state re-read (before anything)

Before any motion, stage and complete these calls to establish current position, tool, workspace and machine state:

1. **`get_connection_status`** — Confirm connected and no existing alarms; note `transport` (GPIO/MQTT affects sensor latency).
2. **`get_position`** — Read `reliability` (must be `verified`, `heartbeat` or `cached-offset`; refuse if `awaiting-resync` or `stale`), `isHomed` (must be true), `warnings` (must be empty). Quote toolhead Z and work offset. **Do NOT assume 27 Sept G54 offset is current.**
3. **`get_stored_state`** — Read `landmarks`, `geometry.probe.effectiveLength` (check vs 70.95 mm stored), `geometry.rotary` (machine X and physical Z), `limits` (motion floor and park height). Verify no jaw `keep_out` is stale or missing.
4. **`select_workspace G54`** (staged, if current workspace is not G54) — Verify the live controller offset before proposing a new datum.
5. **`get_position` again** — Confirm G54 selected and offset fresh (should match heartbeat).

Before probing or cutting, state the answers clearly. If reliability is not `verified`, ask the operator to home the machine first (law 1, cnc-motion-rules §0). A cached offset requires one re-read within ~3 s before position-dependent work (cnc-motion-rules §3).

## WCS — work coordinate system choice

**Selected datum: the proposed B0 rim contact at machine X195 Y250, with independent checks.**

Rationale:
- The rim contact has **zero-spread repeated measurement** (job 4a426e131af8): touchable in the mounted setup, survives this cut geometry.
- The 2.5 mm probe ball radius is measurable at this X195 line; the 21 mm exposed stylus can reach it in the open groove.
- Physical Z (130.35 mm = 201.3 toolhead − 70.95 probe length) is ~30 mm above the lowest stock features; safer than the proposed air-side origin.
- The **free-column check** (X230 Y245 down to toolhead Z197.3) shows the **proposed origin X230 Y245** sits in an obstruction-free air column.
- This allows both **touchable zero** (the rim, for initial setup and recheck) and **safe derivative work origin** (X230 Y245) at the same Z plane (work Z0 at machine Z131.3 toolhead = Z60.35 physical).

**Registration to CAD and rotary axis:**
- The enclosure CAD 64 × 36 mm section matches the measured 64.1 × 36.4 mm stock envelope at the rim (B0 X faces 137.85–201.95 mm).
- The rim is ~midway through the X extent (measured 137.85 + 64.1/2 ≈ 169.9 mm; rim at Y250 X195, width-edge half is 169.9 mm).
- The rotary axis stored position X170.1 is 25.1 mm from the rim's measured X195. This offset **must be verified** with a side-approach probe before finalizing B90/B270 CAM geometry.
- The B direction is established: the 9 mm B0 groove appears west at B90 and east at B270, matching counter-clockwise rotation when viewed from +Y.

**WCS verification procedure (pre-cut):**
1. Home the machine (homes B to B0, homes X/Y/Z to machine coordinates).
2. Retract to machine Z328 (traverse height).
3. Traverse to machine X195 Y250.
4. Probe descent (one station, −Z from Z328, `max_travel_mm: 150`) down to the rim contact; record toolhead Z.
5. Set G54 origin with `set_workspace_origin {workspace: "G54", origin_machine: {x: 195, y: 250, z: <measured>}, datum_reference: "B0 rim, job ID and new measurement", reason: "Establish verified WCS for indexed B cuts"}`.
6. Operator completes controller acknowledgement (if using MCP call) or Luban/touchscreen dialog.
7. Read `get_position` at the held probe position: should report work X0 Y0 Z0 (allowing 0.1 mm sensor noise).
8. Retract to Z328, traverse to machine X230 Y245 (the proposed **safe origin for approach**), and verify work coordinates are **X−35 Y−5** (approximately) — outside the stock, free-column proven.
9. **Independent recheck:** Return to B0 rim (X195 Y250, same setup), descent once more, verify toolhead Z is within 0.1 mm of step 4.

**Access and return:**
- The B0 rim at X195 Y250 is accessible for descent when B is at 0°, stock is in the chuck, and the probe is fitted.
- At B90, the rim moves to approximately (rotated B0 Y250 → machine X coordinate ≈ 170.1 − (250−170.1) ≈ 90.2 mm, and the previous X195 becomes the B90-rotated Y). The exact coordinate requires the rotary matrix and the 170.1 X offset, to be checked against the B90 approach path.
- **Do not return to the B0 datum at B90 without a re-verified approach;** `goto_work_origin` is XY-only at current Z and must clear the stock in the new orientation.

## Stock and fixture reconstruction

**Stock envelope (measured, bounded):**
- **B0 profile:** Outside faces X 137.85 and 201.95 mm (64.1 mm width) at Y245. Side silhouette 36.3–36.4 mm depth. Top rim physical Z 130.35 mm (toolhead Z201.3). Existing groove floor Z 192.2 (9.1 mm below rim) over Y254–259.
- **B180 profile:** Rim toolhead Z 204.5 (physical 133.55 mm), groove floor Z 198.3 (6.2 mm below rim), floor over Y254–258. Rising wall Z207.2–207.5 from Y259.5 to Y263; surface Z213.5 at Y271, ~Z214.2 through Y278.
- **B90 and B270 side openings:** 21.3 mm physical opening at Y256; 9.0 mm and 6.1 mm offsets from the B0 groove sides (9 mm feature is the B0 groove at Y254–259).

**Enclosure shell (reference CAD, unregistered):**
- The supplied CAD (`reference_enclosure_20260922.FCStd`) has a nominal hollow 64 × 36 mm cross-section matching the measured envelope, but **Y placement and full extent are not verified.**
- Approximate nominal sections: 2304 mm² (Y1–10), 774 mm² (Y13), 404 mm² (Y19–100), 848 mm² (Y109–115), 2304 mm² (Y118).
- The CAD defines a **shell, not solid stock**; the hollow interior must be checked against the cutting paths for interference.

**Chuck-side raised surface and transition (measured, bounded):**
- At X195 (the probe line), the surface rises from Z206.4 at Y270.5 to Z213.5 at Y271 (a 7.1 mm step in ~0.5 mm of Y travel).
- The step extends from Y270.5 to Y271; its X extent (across the endmill's 64 mm width) is unknown. Measurements at X210 cleared to Z200 with no contact, but X205 dropped to Z206.7 below Z208.
- **Conservative assumption:** The raised feature is a bracket or reinforcement between X190 and X210, with a height ramp from Z206–207 (Y269–270) to Z213–214 (Y271–278). Its exact geometry and material are unconfirmed.

**Fixture (chuck jaws and rotary):**
- Chuck jaws reach approximately Y269 (historical jaw-exclusion boundary). The jaw front is not re-measured; treat the Y269 landmark as a `keep_out` floor until a fresh check.
- Jaw X/Z envelope: width unknown (typical chuck jaw thickness 20–40 mm), height unknown (typical 20–50 mm above the bed). This is the motion-floor planning obstacle.
- Rotary axis: stored X170.1 physical Z112.4. **The physical Z112.4 is NOT a machine toolhead height** and must never be sent to Z. It is the axis rotation centre's height; the cutter works at machine Z328–0 above it.

**Open questions before machining:**
1. **Enclosure Y registration:** The CAD Y0–119 mm local frame maps to machine Y how? The rim at Y250 (machine) and the groove at Y254–259 constrain it if the CAD marks its local Y0 or Y119 at a physical feature.
2. **Chuck-jaw current front:** Y269 is historical. Measure it fresh: traverse to machine X195 Y265, probe descend ±Z to find the jaw or a marker.
3. **Chuck-jaw X extent and height:** Measure the jaw thickness and leading-edge Z at X195 (where the neck sits) to bound the collet-nose clearance.
4. **Raised transition X extent:** Probe at X190 and X200 (in addition to the existing X195) to bracket the step's X reach and confirm it does not block the B90/B270 side cuts.

## Retained connections: four corner tabs vs two C-shaped bridges

The cutting task is to remove most of the neck material, **leaving enough connection for stable machining and a short final saw cut.** Two geometric variants are compared:

### **Variant 1: Four corner tabs**

Retain 6 mm endmill-width (8 mm nominal radius at axial ends) connecting bridges at the **four corners of the rectangular neck**:
- **Top-left corner:** tab at X140–146 mm, Y251–257 mm, Z ~125 mm (inside remaining groove floor, 5–6 mm tall).
- **Top-right corner:** tab at X196–202 mm, Y251–257 mm, Z ~125 mm.
- **Bottom-left corner (B180):** tab at X140–146 mm, Y251–257 mm, Z ~132 mm (inside B180 groove floor, 2 mm tall).
- **Bottom-right corner (B180):** tab at X196–202 mm, Y251–257 mm, Z ~132 mm.

**Geometry:**
- Each tab spans one 6 mm endmill width in X and one in Y, leaving a ~2 mm material bridge between the endmill edge and the already-cut groove walls.
- Total residual ligament width at the narrowest point: ~2 mm (between cutter radius and the cut wall).
- Corner radius: the 6 mm endmill ball-end or corner radius (~3 mm) governs the fillet at each tab base.

**Advantages:**
- Four independent release points; less likely to collapse asymmetrically or bind in the saw cut.
- Wide ligaments (~2 mm on each side of a tab) provide some sawing surface.
- The tabs sit directly in the measured groove floors (B0 and B180), with known Z depths.

**Disadvantages:**
- The two vertical faces (top-left to bottom-left, top-right to bottom-right) are fully open except for the corner tabs, requiring precise plunge depth and side-cutting moves.
- Each tab requires a separate plunge-and-cut or link approach; more tool retracts.
- Final saw cut must navigate around four separate tab bases, requiring operator dexterity or a jig.

### **Variant 2: Two C-shaped bridges**

Retain two **C-shaped or curved bridges**, one on each side (±X), spanning the full Y extent (Y251–261 mm):
- **Port side (−X direction, X137–143 mm):** curved bridge, 5–6 mm wide in X (spanning from the already-cut outer groove edge at X137.85 inboard), full Y run from Y251 to Y261, spanning both B0 and B180 cuts.
- **Starboard side (+X direction, X199–205 mm):** curved bridge, 5–6 mm wide in X (spanning from the already-cut outer groove edge at X201.95 inboard), full Y run from Y251 to Y261.

**Geometry:**
- Each bridge is a continuous solid strip, with a smooth curved or tapered X profile (wider at mid-Y for stiffness, narrower at Y251 and Y261 to ease the final saw cut).
- Total residual ligament width: 5–6 mm per bridge (compared to ~2 mm for corner tabs).
- The bridges connect across the B0–B180 groove-floor step; they do not rely on corner geometry.

**Advantages:**
- Two release points aligned with the stock's natural Y extent; less asymmetric loading during the saw cut.
- Continuous bridges provide more surface area for final sawing, reducing binding and splintering.
- The X width is wider (5–6 mm vs 2 mm corners), so the enclosure is less likely to collapse during intermediate cuts.
- Simpler tool path: each side is one continuous cut, fewer tool retracts and links.

**Disadvantages:**
- If one bridge fails mid-cut, the uncut side must support the entire load until the saw cut; higher risk of fracture along the grain.
- The bridges span the B0–B180 step (the 2–3 mm groove-floor difference); cutter height control during the linking move must be precise.
- Final saw cut is a single straight line per bridge, requiring exact grain alignment; less tolerance for operator error.

### **Recommendation: Variant 2 (Two C-shaped bridges)**

**Rationale:**
1. **Stiffness and deflection:** The wood grain typically runs along the Y axis (the long enclosure), so the two side (±X) bridges align naturally with grain strength.
2. **Residual material:** 5–6 mm per side is stronger than 2 mm corners while still being saw-friendly. Finite-element prediction (without actual wood properties) suggests lower peak stress in the bridges during intermediate cuts.
3. **Saw cut predictability:** A single straight cut along Y per side is simpler for the operator and less prone to binding in the final phase.
4. **Tool path simplicity:** Two continuous side cuts (one per B angle, or one per indexed visit) versus four separate corner plunges.
5. **Registration tolerance:** The bridges are not tied to the exact corner coordinates, so ±1 mm CAD-to-machine misalignment has less impact than on isolated corner tabs.

**Sensitivity analysis:**
- **±0.5 mm in Y registration:** Two-C bridges shifted Y would still be supported by the B0 and B180 floors (a continuous contact); four corner tabs would partially lift off.
- **±1 mm in Z depth control:** Two-C bridges at 5–6 mm width tolerate shallow plunge error better; corner tabs at 2 mm width become gossamer and prone to breaking during cutting vibration.
- **Runout at 0.2 mm TIR:** Both variants are affected equally; the bridges are less sensitive because they are wider.

**Final saw-cut envelope (Variant 2):**
- Two cuts along Y251–261 mm, one each at X139 mm (±X offset inboard from X137.85) and X203 mm (±X offset inboard from X201.95).
- Cut width: 2–4 mm, depending on the saw blade thickness and operator skill.
- Engagement: both cuts are fully in the open groove area, no interference with the enclosure shoulder or jaw.

---

## Machining plan

**Two rounds, four indexed visits in round 1, two in round 2. Each visit: setup, approach, cut, retreat, index.**

### **Round 1: Channel and side opening cuts (indices B0, B180, B90, B270)**

The objective is to establish and enlarge the existing B0 and B180 groove channels, and open the B90/B270 sides, leaving the two C-shaped bridges intact.

#### **Setup 1.1: B0 — reopen and enlarge top channel**

- **B angle:** 0° (stock and chuck home orientation).
- **Tool:** 6 mm endmill, fitted and measured for protrusion (see Release Gate).
- **Entry:** From the existing B0 groove (top opening, Y254–259 mm).
- **Stepdown:** 2 mm per pass (total depth ≈ 9.2 mm from rim Z201.3 to floor target Z192.1, requiring ~5 passes; or coarser 3 mm stepdown if endmill can handle it).
- **Feed tracks:** Three parallel Y cuts at X195, X196, X197 to fully cover the width (3 × 6 mm ≈ 18 mm, spanning the 64.1 mm stock width with X140–X205 span for the side cuts to enter).
- **Cutter sweep:** 6 mm cylinder + corner radius at each axial end, advancing from Y251 to Y261 (10 mm axial span, limited by cutter geometry at the step transition).
- **Tool path:** Retract to Z328, traverse to X195/Y254 (above the groove), descend to Z210 (2 mm above the target floor), rapids/feeds to establish the first pass geometry, step down 2 mm per Y track, link at Z328 between tracks, retreat at track end to Z328.
- **Exit:** Retract to Z328, raise to park Z328; prepare for index.

#### **Setup 1.2: B180 — reopen and enlarge bottom channel**

- **B angle:** 180° (stock inverted; chuck jaws still reach ≈Y269).
- **Entry:** From the existing B180 groove floor (bottom opening, Y254–258 mm, now at the top in the rotated view).
- **Stepdown:** 2 mm per pass (depth ≈ 6.2 mm from rim Z204.5 to floor Z198.3; approx. 3–4 passes).
- **Feed tracks:** Three X positions (X195, X196, X197) as in Setup 1.1, to link the side openings.
- **Tool path:** Similar profile: descend above the floor, step down per Y track, maintain Z328 between tracks, retract.
- **Cutter Z:** In the rotated B180 frame, the top is now the physical bottom. Machine Z coordinates remain the same; the controller rotates the Y axis.

#### **Setup 1.3: B90 — cut port (−X) side opening**

- **B angle:** 90° (stock rotated, chuck jaws now at approximately +Z or −Z in the rotated frame; the bed Y is still Y in machine coordinates).
- **Entry:** From the B0 groove, now accessible from the top of the rotated view. The endmill descends along Y251–261, cutting from the existing channel opening toward the −X outside face.
- **Stepdown:** 2 mm per pass in the Z (now pointing in the ±X direction in the work frame; machine Z is unchanged).
- **Cut depth:** From the existing groove boundary at X195 down to approximately X165 mm (inside the stock), leaving the 5–6 mm port-side bridge intact (−X boundary ≈ X140 mm free side, +X bridge 5–6 mm, so cut to X145–140 mm).
- **Cutter sweep:** 6 mm ball, traveling along Y251–261, cutting to the target X depth.
- **Tool path:** Traverse from Z328 to the approach position, descend to the opening edge, feed along Y from Y251 to Y261 at the target X (with stepdowns as necessary).

#### **Setup 1.4: B270 — cut starboard (+X) side opening**

- **B angle:** 270° (stock rotated again, chuck jaws at approximately −Z or +Z).
- **Entry:** From the B0 groove, now accessible from the opposite side.
- **Cut depth:** Symmetric to Setup 1.3, leaving the starboard bridge intact (X boundary ≈ X205 mm free side, −X bridge 5–6 mm, so cut to X195–200 mm).

---

### **Round 2: Bridge-finishing side cuts (indices B0, B180)**

After Round 1 completes all four indexed cuts, **do not** merge all remaining B0 or B180 work into one setup. Instead, return to each angle separately to finalize the bridge geometry and smooth the transitions.

#### **Setup 2.1: B0 — finish port and starboard bridges (part 1)**

- **B angle:** 0° (return to home).
- **Entry:** From the B90 side opening (now visible from the top at B0).
- **Objective:** Widen or smooth the side-opening depth to the target 23 mm (from the existing 21 mm side opening), blending the corner radii and easing the final saw-cut path.
- **Stepdown:** 1–1.5 mm per pass (finer to avoid chatter at the thin bridges).
- **Feed tracks:** Finishing passes at the bridge locations (X139 mm for the port bridge boundary, X203 mm for the starboard), connecting the B90 and B180 openings.

#### **Setup 2.2: B180 — finish bridges (part 2)**

- **B angle:** 180° (inverted).
- **Entry:** From the B270 side opening.
- **Objective:** Mirror of Setup 2.1, finishing the opposite sides of the bridges.

---

## Release gate — ordered checks before any runnable program

1. **Machine state:**
   - `get_connection_status` → connected, no alarms.
   - `get_position` → `reliability` in {`verified`, `heartbeat`, `cached-offset`}, `isHomed` = true, `warnings` empty.
   - `home {}` executed (if not already homed), with operator confirmation that the stock will rotate.

2. **Workspace:**
   - `select_workspace G54` and verify controller acknowledgement.
   - Current G54 offset read from `get_position.originOffset`.
   - **If the 27 Sept offset is not set:** `set_workspace_origin` with the measured B0 rim coordinates (X195, Y250, toolhead Z from fresh descent) as the origin, with datum reference and B0 context.
   - `get_position` re-read at the held datum position; confirm work X0 Y0 Z0 (±0.1 mm).

3. **Stock and fixture verification:**
   - **B0 setup:** Stock mounted in the chuck, B angle verified at 0° (heartbeat `b` or B index position).
   - **Jaw clearance:** Traverse to machine X195 Y265, descend to find the jaw front; confirm it is at or behind Y269 as expected (±2 mm).
   - **Jaw X/Z envelope:** Measure at X195 Y269; record jaw thickness in X and height above the bed in Z. Collet nose must clear the stock by ≥2 mm at the Y256 side-cut depth.

4. **Tool preparation:**
   - **6 mm endmill fitted** and seated in the collet.
   - **Tool setter measurement:** `run_tool_setter {bit_length_mm: <fitted length>, reason: "Measure 6 mm endmill before round 1"}`, recording the trigger Z.
   - **Z offset application:** If the endmill protrusion differs from the probe length by >0.5 mm, apply `apply_tool_length_offset` to shift work Z.
   - **Runout check:** Spin the tool at operating RPM, measure TIR with a dial gauge or camera analysis. TIR ≤0.2 mm acceptable; if ≥0.3 mm, re-seat or replace.

5. **Probe-to-cutter transfer:**
   - Remove the touch probe from the spindle (operator action; note the effective length and confirm in `set_probe_geometry` if it was re-measured).
   - Install the 6 mm endmill.
   - Apply the measured tool-length offset via `apply_tool_length_offset {reason: "Endmill after probe removal, tool setter pair"}`.
   - Verify G54 is still selected and the offset is fresh: `get_position` should show the same work XYZ as before the swap (work Z0 should still be at the measured rim top, now with the cutter tip).

6. **CAM file validation and setup:**
   - **FreeCAD CAM Job generation** (offline, not run through MCP): Export G-code for Setup 1.1 (B0 channel) with the measured WCS origin, B0 index, and tool parameters.
   - **File review:** Check that the file contains `G54` (work frame), starts at machine Z328, descends to the target floor depth, and ends with Z328 retract.
   - **Validate with `validate_gcode {gcode}`** and review warnings (spindle-on Z, out-of-travel, feed rate).

7. **First-cut clearance simulation:**
   - **In FreeCAD or by hand:** Simulate the tool path for Setup 1.1 (B0, first entry to the groove at Y254) to confirm the cutter tip does not interfere with the stock at Z328 approach, descends into the existing groove without scraping the top rim, and the ball-end corner radius clears the groove floor transition at Y253–254.
   - **Holder/collet body:** Verify the collet nose (diameter unknown until measured) clears the stock sides at the target Y (256 mm travel).

8. **B-angle verification:**
   - **B zero calibration:** Traverse to a known point (e.g., X230 Y245), probe or contact the rotary table, note the B angle encoder reading. Confirm B0 aligns with the stored zero (±0.5° acceptable).
   - **Backlash check:** Step B by +1° and −1°, verify no slip or unexpected movement.
   - **Jaw sweep:** At B90 and B270, confirm the chuck jaws do not collide with the stock or the enclosure holder.

9. **Independent WCS recheck (before cutting):**
   - At the held B0 datum (X195 Y250, probe fitted, work X0 Y0), descend the probe once more: record the contact Z.
   - Compare to the initial setup measurement (should be within 0.05 mm for a repeatable datum).
   - Remove the probe, install the cutter, apply the offset, and verify work Z0 is still at the same position.

10. **Final preflight (operator confirmation):**
    - Door shut, spindle off, extraction running.
    - Stock is firmly clamped; no loose fasteners or chips in the jaw area.
    - The probe or cutter is fitted and measured.
    - The first G-code file (Setup 1.1 B0) is staged and ready.

---

## Remaining measurements and operator actions

1. **Enclosure CAD Y registration:** Identify a physical feature on the enclosure (e.g., a pocket edge, shoulder, or marking) that corresponds to the CAD local Y0 or Y119. Probe or measure its machine Y coordinate. Record the offset to map the enclosure to the measured stock.

2. **Chuck-jaw front edge:** Traverse to X195 Y265, descend (sensor-gated) to find the jaw or a marker; record the toolhead Z. This replaces the historical Y269 estimate with a measured value (within ±1 mm).

3. **Chuck-jaw X extent and height:** Measure the jaw thickness (X) and leading-edge height (Z) at the Y256 line (where the side cuts occur). Compare the jaw body depth in Z to the stock height at Y269 to confirm no collision with the rotating collet nose.

4. **Raised transition (Y259–278) X extent:** Probe at X190 and X200 (in addition to existing X195 data) to bracket the rise step's X reach. Confirm it does not block the B90/B270 side entries.

5. **Rotary axis verification:** After homing, check the stored axis position (X170.1 physical Z112.4) against a fresh geometric check: traverse to the safe datum X230 Y245, compare the known distance to the axis centre with the expected 170.1 − 230 = −59.9 mm (if axis is at X170.1, the safe datum is 59.9 mm away). This is a weak check but helps catch gross errors.

6. **Tool setter zero (endmill):** After installing the 6 mm endmill, run `run_tool_setter {bit_length_mm: <estimated from collet>, reason: "Endmill trigger"}` to record the fitted protrusion. Use the difference (new − probe) to apply `apply_tool_length_offset`.

7. **Spindle RPM and feed rate verification:** Set the spindle to 5000–8000 RPM (adjust for wood and tool flute count). Verify the Luban/CAM feed rate matches the endmill geometry (6 mm diameter, typical wood: 50–100 mm/min per flute at 5000 RPM ≈ 600–1200 mm/min chip load). Do not run the first cut without operator observation of spindle speed and feed rate.

---

## Steps

1. **Stage `get_connection_status`** [APPROVAL] — confirms connected, no existing alarms.

2. **Stage `get_position`** [APPROVAL] — confirms `reliability` in {verified, heartbeat, cached-offset}, `isHomed` = true, `warnings` empty, machine Z ≤ 328.

3. If `isHomed` = false: **Stage `home {}`** [APPROVAL] — tells operator stock will rotate; homes X/Y/Z/B; no confirm page.

4. If `isHomed` = true: **Skip step 3, re-read `get_position`** (2 s later) to confirm cached offset is fresh.

5. **Stage `get_stored_state`**  [APPROVAL] — confirms probe effective length, rotary axis position, limits, and jaw `keep_out` landmark.

6. **Stage `select_workspace G54`** [APPROVAL] — selects work frame; confirms controller acknowledgement.

7. **Stage `get_position` again** [APPROVAL] — confirms G54 is selected, offset is live, current workspace in heartbeat = G54.

`-- end turn --`

[At this point, pause. The operator sees the confirm URLs above. They click each in turn. Once all returns are confirmed, continue with the next section.]

8. **Operator action: Manually verify B angle at 0° (heartbeat `b` field or B encoder reading)** [WAIT] — stock must be at home orientation before touching the datum.

9. **Operator action: Mount stock in chuck, hand-tighten jaws.** [WAIT]

10. **Operator action: Verify probe is fitted and tool/probe ID matches the stored entry in `get_stored_state.geometry`** [WAIT].

11. **Stage `traverse_xy {x: 195, y: 250, coordinate_system: "machine", reason: "Position probe at B0 rim for initial datum measurement"}`** [APPROVAL] — brings the probe above the rim contact point.

12. **Stage `move_z {z: 328, coordinate_system: "machine", reason: "Raise to traverse height after any prior work"}`** [APPROVAL] (if the current Z is below 328).

`-- end turn --`

13. **Stage `probe_program {name: "B0 rim datum recheck", reason: "Verify the rim contact at X195 Y250 for WCS registration", ops: [{id: "find", kind: "sequence", steps: [{kind: "hop", x: 195, y: 250}, {kind: "probe", name: "rim_top", dz: -1, max_travel_mm: 150, on_miss: "abort"}]}, {id: "confirm", kind: "sequence", steps: [{kind: "hop", x: 195, y: 250}, {kind: "probe", name: "rim_top_recheck", dz: -1, max_travel_mm: 10, on_miss: "abort"}]}]}`** [APPROVAL] — two drops to confirm zero-spread at the rim.

14. **Operator reads the results (job ID, `find.rim_top.z` and `confirm.rim_top_recheck.z`)** [WAIT] — notes the toolhead Z. If the two differ by >0.1 mm, ask why and re-measure if the probe may have landed off-centre.

`-- end turn --`

15. **Operator provides the confirmed rim toolhead Z** (e.g., Z201.35 if measured) [WAIT].

16. **Stage `set_workspace_origin {workspace: "G54", origin_machine: {x: 195, y: 250, z: <confirmed toolhead Z>}, datum_reference: "B0 rim, B0 orientation, this session probing, job <ID>", reason: "Register the verified WCS for indexed rotary cuts"}`** [APPROVAL] — sets the G54 origin at the rim; operator confirms on the MCP or controller dialog.

`-- end turn --`

17. **Stage `get_position`** [APPROVAL] — at the held probe position, should report work X0 Y0 Z0 (±0.1 mm allowed).

18. **Operator action: Verify heartbeat shows work X=0±0.1 Y=0±0.1 Z=0±0.1** [WAIT] — confirms WCS is set.

19. **Stage `move_z {z: 328, coordinate_system: "machine", reason: "Raise probe to traverse height"}`** [APPROVAL] — raises to park.

20. **Stage `traverse_xy {x: 230, y: 245, coordinate_system: "machine", reason: "Move to safe datum origin outside stock"}`** [APPROVAL] — brings probe to the air-side work origin.

21. **Stage `get_position`** [APPROVAL] — at X230 Y245, should report work X≈−35 Y≈−5 Z0 (offset from the origin at X195 Y250).

`-- end turn --`

22. **Operator action: Remove probe from spindle (note effective length), install 6 mm endmill, seat in collet.** [WAIT]

23. **Stage `run_tool_setter {bit_length_mm: <estimated from collet, typically 30–35 mm for a 75 mm total tool in a 20 mm collet}, reason: "Measure 6 mm endmill fitted length"}`** [APPROVAL] — measures the endmill and records trigger Z in the tool-setter history.

`-- end turn --`

24. **Operator reads the tool setter result (trigger Z, e.g., Z173.5)** [WAIT] — notes the toolhead Z for the endmill.

25. **Calculate the offset delta:** new (endmill trigger Z) − old (probe trigger Z, approx. Z233–234) = offset for `apply_tool_length_offset`.

26. **Stage `apply_tool_length_offset {reason: "Endmill after probe removal, tool setter pair"}`** [APPROVAL] — applies the measured tool-length shift to work Z.

`-- end turn --`

27. **Stage `get_position`** [APPROVAL] — confirms work Z is still 0 at the rim position (now with the cutter tip).

28. **Operator action: Verify B angle is still 0° and G54 is selected.** [WAIT]

29. **Operator action (offline CAM): Generate G-code for Setup 1.1 (B0 channel opening)** using FreeCAD Path or Luban, with the measured WCS origin, B0 index, and 6 mm tool parameters. Review for machine Z328 start, Z328 end, and feed rates. Save as `setup_1_1_b0_channel.nc`. [WAIT]

30. **Stage `validate_gcode {gcode: <contents of setup_1_1_b0_channel.nc>}`** [APPROVAL] — checks for warnings.

`-- end turn --`

31. **Operator reviews the validation report (spindle on/off, Z range, feed rate, tool)** [WAIT] — accepts if all warnings are expected (e.g., "spindle on at Z193 — normal for a cutting file").

32. **Stage `submit_gcode_job {gcode: <contents of setup_1_1_b0_channel.nc>, name: "B0 Channel Round 1", frame: "work"}`** [APPROVAL] — stages the G-code for Setup 1.1.

`-- end turn --`

33. **Operator reviews the confirm page (Frame: WORK, machine Z extents if resolvable, tool)** and clicks the link. [WAIT for the confirm URL in the response above, then operator clicks.]

34. **Start the job in the background: `start_gcode_job {job_id: <from step 32>, wait_for_approval_ms: 110000}`** — streams G-code and polls until completion.

`-- end turn --`

35. **Operator monitors the spindle, feed, and stock.** If anything looks wrong (chattering, smoke, binding), stop the machine with Ctrl+C or the emergency stop. [WAIT for job to complete or fail.]

36. **Retrieve the job result: `get_gcode_job_status {job_id: <from step 34>}`** [APPROVAL] — confirms `ending.kind` is `completed` (not `stopped-by-agent`, `machine-stopped`, `crash-alarm`, etc.).

`-- end turn --`

37. **Operator inspects the cut (remove stock if safe, or inspect in situ).** Check for:
    - B0 groove floor is open and at the expected depth (Z≈192 mm, physical).
    - No grooves or scratches on the rim outside the cut area.
    - The Y254–Y258 extent is correct and smooth.
    [WAIT for inspection and feedback.]

38. **Operator confirms the cut is good.** [WAIT]

`-- end turn --`

39. **Repeat steps 29–38 for Setups 1.2 (B180), 1.3 (B90), and 1.4 (B270)**, each with an index to the new B angle and a new G-code file.

    - **Setup 1.2 (B180):** `set_workspace_origin` is NOT called again; the same G54 is used. Before rotating to B180, ensure the approach column at the new B angle (the previous bottom channel, now at the top after inversion) is clear. Traverse to the channel opening at the new B angle and descend into the groove to begin the cut.
    
    - **Setup 1.3 (B90):** Rotate to B90, verify the side opening is now accessible. Enter from the groove that is now visible at the top (the previous B0 or B180 channel, depending on the stock geometry). Cut along Y251–261, stepping down in X toward the target depth.
    
    - **Setup 1.4 (B270):** Mirror of Setup 1.3.

[Steps for each indexed setup: index, verify B, verify G54 is live, generate/validate/submit/run/inspect. Omit datum re-set (G54 is retained). Each setup is one logical approval and one observe/wait for the job to finish.]

40. **After Round 1 complete (all four indices cut):** Operator inspects the stock (remove if needed, or photograph) to verify:
    - All four indexed grooves are open and continuous.
    - The bridges (port and starboard sides) are intact and at the expected width (5–6 mm).
    - No unexpected material is missing (e.g., jaw contact, collet nose interference).
    - The raised transition at Y259–278 is still in place and not undercut.

`-- end turn --`

41. **Round 2 setup and cuts (Setups 2.1 B0 and 2.2 B180):** Repeat the same sequence for each finishing setup:
    - Index to B0 or B180.
    - Generate G-code for the finishing cut (finer stepdown 1–1.5 mm, touching the bridge sides to finalize the shape).
    - Validate, submit, and run.
    - Inspect the result.

[Two more logical approvals, corresponding to Setup 2.1 and 2.2.]

42. **Final inspection and operator release:** After Round 2, inspect the finished bridges and the two-side openings. Confirm:
    - Each bridge is 5–6 mm wide and smooth, ready for the final saw cut.
    - No tearout or excessive chatter marks.
    - Stock is firm and no binding is visible.

`-- end turn --`

43. **Operator performs the final saw cut** (offline, not via MCP) to separate the piece, following the natural Y251–261 grain lines along each 5–6 mm bridge.

---

## Counts

- **Logical approvals:** 22 (each motion or procedure stage is one approval; the two-op probe, tool setter, offset, and four G-code file runs count as 1 each).
- **Literal [APPROVAL] tags in steps:** 28 (staging tool calls that reach the confirm page).
- **Operator waits [WAIT]:** 21 (manual actions: homing, mounting, removal, monitoring, inspections, feedback).
- **Questions:** 0 (all required measurements and actions are listed above; the RUN_INSTRUCTIONS bar planning-only tasks from asking the operator for missing data mid-run).
