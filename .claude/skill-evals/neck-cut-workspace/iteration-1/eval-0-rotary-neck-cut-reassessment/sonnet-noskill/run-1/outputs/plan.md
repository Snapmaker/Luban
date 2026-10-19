# Neck-cut reassessment: relieve the rotary neck to two diagonal C-brackets, in two separate indexed rounds, after re-verifying live state and WCS from scratch

This is a **dry run**. No MCP tool was called while producing this plan; no machine state below dated
2026-09-27 or earlier is treated as current. Every step below that would touch the machine is written
as the call I would make, but none of it has been executed.

## Evidence ledger

Frame key: **mZ** = machine toolhead Z (probe fitted), **pZ** = physical surface/tip Z (mZ − probe
effective length), **CAD** = reference_enclosure_20260922.FCStd local frame, **work** = G54 work frame.

| Item | Value | Frame | Source | Status |
| --- | --- | --- | --- | --- |
| B0 outside stock X faces @ Y245 | ~137.85, ~201.95 (64.1 mm wide) | machine physical X | brief table | measured (2026-09-26/27 session) |
| Side silhouette (other orientation) | 36.3–36.4 mm | machine physical | brief table | measured |
| B0 rim contact | mZ 201.3 @ X195/Y250 | mZ | job `7685888d887d` | measured |
| B0 rim physical | pZ 130.35 (201.3 − 70.95) | pZ | derived | derived from measured |
| B0 groove floor | mZ 192.2 @ X195, Y254.0–259.0 | mZ | job `7685888d887d` | measured, 19 stations; scan **aborted** past Y259 — "do not extrapolate" |
| B0 groove depth below rim | 9.1 mm | relative | derived | derived |
| B−180 rim | mZ 204.5 (Y245–250), 204.4 (Y250–253) @ X198 | mZ | job `f8f12d4a4b3e` | measured, 38 stations, completed |
| B−180 groove floor | mZ 198.3 @ X198, Y254.0–258.0 | mZ | job `f8f12d4a4b3e` | measured; **closes** by Y259 (back to mZ 204.6) |
| B−180 groove depth below rim | 6.1–6.2 mm | relative | derived | derived |
| B90/B270 side opening | 21.3 mm physical @ Y256 | machine physical | prior README | measured (prior session) |
| B90/B270 edge shifts vs Y245 | B90: −9.0 mm west / −6.1 mm east; B270: −6.0 mm west / −9.0 mm east | machine physical | brief table | measured; used only to confirm B rotation **sign**, not as a second cross-section boundary |
| Chuck-side raised transition, B0/X195 | mZ 206.4–206.5 through Y270.5, mZ 213.5 @ Y271.0, mZ ≈214.2 by Y272+ | mZ | jobs `e185e35d0536`, `cc6e2592ccd6` | measured **at X195, B0 only**; material identity and X-extent unresolved |
| Historical jaw-front proxy | Y269 | machine Y | CAD display box | **nominal display estimate, not a probed boundary** |
| Fresh datum contacts | rim (X195,Y250,mZ201.3); +X face tip-centre (X203.1,Y245,mZ197.3)→physical X≈201.85; channel-wall tip-centre (X195,Y253.4,mZ197.3)→physical Y≈252.15 | machine | job `4a426e131af8` | measured, zero repeat spread |
| Clear column check | no contact X230/Y245 down to mZ197.3 | machine | job `4a426e131af8` | measured (negative result — clears only that one line to that one height, not a volume) |
| Rotary axis stored geometry | X170.1 (machine), physical Z112.4 | config | stored machine geometry | **estimate only** — never a travel target or a verified toolhead-Z registration |
| CAD nominal enclosure | outside 64×36 mm, local Y 0–119 mm; wall sections 2304 mm² (solid ends, Y1–10 & Y118) vs 404 mm² (hollow shell, Y19–100) | CAD | `reference_enclosure_20260922.FCStd` inventory | nominal CAD; **Y placement and B datum not registered to machine frame** |
| Tool (endmill) | 6 mm dia, >25 mm cutting edge, 75 mm OAL, ~20–30 mm nominal in collet | nominal | brief | operator-stated; **fitted protrusion, collet nose dia, runout NOT measured** |
| 27-Sep G54 snapshot | origin machine (X169.953,Y133.632,mZ208.5); work read (X−69.953,Y122.368,Z119.5) while probe held at machine X100/Y256/mZ328 | machine+work | `live_g54_registration_20260927.json` | measured snapshot, **stale by definition — must not be assumed current** |
| Proposed (unset) safe WCS | machine X230/Y245, physical tip pZ160.35 (mZ231.30 with probe fitted) | machine | `proposed_safe_wcs_20260927.json` | **PROPOSED, explicitly not written to the controller** |
| Probe geometry | effective length 70.95 mm, tip exposed ≈21 mm, tip radius 1.25 mm | config | stored | stored value; **prior findings flag this length as possibly stale (~73.5 mm) — must be reverified, not trusted** |
| Prior agent's own residual-section check | 2 components, 36.3–37.4 mm² each, Y253.1–258.9 | CAD (prior review model) | `fixture_section_checks.txt` | prior hypothesis — inspected only **after** building my own model below, per brief instruction |
| My cross-section model (this run) | see "Retained connections" below | planning frame (u,v) | `neck_cross_section.py` (this run) | CHOSEN/DERIVED — a plan, not a measurement |

## Live-state re-read (before anything)

Nothing below is assumed. In order, before any motion is planned in detail:

1. `get_connection_status` — confirm Luban↔machine link is up before trusting any later call.
2. `get_stored_state` — calibrations, landmarks, tool region, probe feed, camera state, connection, in one call. This is the fresh-session starting point.
3. `get_machine_profile` — read `connectedHead` (`headType`, `toolHead`). Branch: if it reports neither a
   probe nor the endmill fitted, or is null, **stop and ask the operator what is in the spindle** — never
   plan as though it is empty, and never assume the 26–27 Sep tool-setter history still describes today.
4. `get_position` — machine XYZ, B, `reliability`, work report, `originOffset`. Branch:
   - `reliability` not in {verified, heartbeat, cached-offset} → no motion; if `awaiting-resync`/`stale`,
     wait for the next coherent beat (~2 s) rather than re-homing.
   - Compare the reported G54 offset to the 27-Sep snapshot above. If it matches, that is **corroboration**,
     not proof — a coherent offset can still be the old, unintended one (this is exactly the eval's stated
     failure mode: do not assume the 27-Sep G54 was set to the proposed zero). Treat it as "still whatever
     it was" until independently re-checked against a physical feature (WCS section below).
   - Read B. If B≠0, every "B0" coordinate in the ledger needs the rotary transform applied before use.
5. `query_firmware_position` — only if step 4's report looks suspect (out of travel, B not settled).
6. `get_probe_feed_status` — transport up, tripwire state. If down, `connect_probe_feed` (arms the
   tripwire) before any touch-probe step.
7. `get_tool_setter_config` — read stored setter centre/trigger Z/reference lengths; do not assume they
   match today's physical setter without the tool-setter sequence in the release gate.
8. `get_camera_model` — expect `unverified` or `superseded`; the 26–27 Sep pose is not reusable. Plain
   qualitative viewing (per-index camera JPEGs already on file) needs no calibration, but no pixel-to-mm
   or pose-planning claim may use it until `verify_camera_model` passes.
9. Check MCP history for the cited job IDs (`7685888d887d`, `f8f12d4a4b3e`, `cc6e2592ccd6`, `4a426e131af8`)
   via `get_gcode_job_status` per ID if the history is retained. Branch: if unavailable, the committed
   JSON/README copies remain the only record and are treated as *prior-session* evidence, not re-verified.

`-- end turn --` (these are read-only; no approval needed, but I would not proceed past this point in the
same turn as an unread live state).

## WCS

**Choice:** one G54 for all four B indices (per doctrine: prefer a single WCS across indexed cuts).

**Touchable vs derived:** the proposed origin (machine X230/Y245, physical tip pZ160.35, i.e. mZ231.30
*with the probe fitted*) is **derived**, not touchable — it sits 28.15 mm outside the measured X face and
30 mm above the measured rim, deliberately in air so work zero itself is never set by touching the fragile
groove. That Z value is only valid **while the probe is the fitted tool** at the moment `set_workspace_origin`
is called; if a swap to the endmill has already happened, it must be re-derived for the endmill's length,
or (preferred) set now with the probe fitted and carried through the later swap via `apply_tool_length_offset`
rather than re-touched off.

**CAD mapping:** the CAD's local Y 0–119 has **not** been registered to machine Y (evidence ledger). I
therefore only use the CAD's cross-section dimensions (64×36 mm) as corroboration of the measured stock
envelope, never its channel/recess Y positions or its B datum. Any future use of the CAD for the enclosure
cavity itself needs a physical axial landmark match first (see Remaining measurements #10).

**Rotary mapping per B:** B0/B180 are opposite faces of the same 64.1×36.4 mm cross-section; B90/B270 are
the other pair, confirmed by the edge-shift sign test in the ledger. The stored rotary axis (X170.1,
physical Z112.4) is used **only** as a kinematic estimate for CAM transform math — never as a toolhead-Z
target, never as evidence the WCS is registered.

**Setting it (human-gated):**
1. With the probe fitted and B0, call `set_workspace_origin {workspace: "G54", origin_machine: {x:230, y:245, z:231.30}, datum_reference: "job 4a426e131af8 rim/face contacts, air-side, probe fitted", reason: "establish single WCS for neck-cut evaluation, replaces unverified 27-Sep offset"}`. **[APPROVAL]**
2. Deliver the confirm URL, end the turn. `-- end turn --`
3. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` **[APPROVAL][WAIT]**. If `timed_out`, call again — never restage.

**Independent check (required — do not treat the write as proof):** after the origin is live, probe a
known feature and confirm it reads the expected work coordinate:
4. `probe_program {ops:[{kind:"sequence", steps:[{kind:"hop", x:195, y:250}, {kind:"descend", z:{from: "current", to_machine: 210}}, {kind:"probe", name:"rim_check", dz:-1, max_travel_mm:5}]}]}` — expect work Z
   consistent with rim pZ130.35 minus the new origin's pZ160.35 (i.e. work Z ≈ −30.0 at the rim, within
   probe repeatability). **[APPROVAL]**, then `start_gcode_job {..., wait_for_approval_ms:110000}` **[WAIT]**.
5. Repeat at B180 (rotate_b −180 first, in the same `probe_program`) against the X198 rim, to confirm the
   WCS is still geometrically sane after rotation, understanding the rotary-axis numbers feeding that
   prediction are estimates to be refined, not ground truth.

`-- end turn --`

## Stock and fixture reconstruction

**Registration:** the two independent physical-X-face estimates (201.95 from the B0 outside-stock scan,
201.85 from job `4a426e131af8`'s dedicated tip-centre contact) agree to ~0.1 mm — within probe/tip-radius
bookkeeping differences. Not alarming, but not silently averaged either; both are cited above.

**Shell vs groove vs tenon vs jaws — the load-bearing open question:** the brief frames the neck as
material *between* a hollow enclosure and a solid, chuck-held tenon, which is the working assumption
below. But the CAD inventory shows the *enclosure itself* has both solid-end sections (2304 mm², matching
a 64×36 mm solid block) and thin-shell sections (404 mm² at a nominal 0.1 mm wall) along its own local Y —
and that CAD is **not** registered to machine Y. I cannot rule out, from evidence alone, that the currently
probed neck band coincides with a thin-shell region rather than solid waste stock. This is more fundamental
than a clearance question: if the neck is a shell, both tab designs below are wrong (they assume solid
material). See Remaining measurements #7 for how I propose to bound this cheaply, and the machining plan's
staged-depth-first-pass practice, which exists specifically to catch this before committing to full-depth
finishing cuts.

**Open dimensions to resolve or bound (only where the plan needs the number):**
- Y259–263 raised transition on both B0 (unmeasured past the Y259.5 abort) and B180 (rim only, no profile
  between Y258.5 and Y263) — needed only to bound Round-1 pass Y-extent safely; see Remaining measurements
  #3–4.
- Jaw/holder envelope characterized **only** at X195/B0. Not measured at B90/B180/B270. A single-X,
  single-B transition is not a clearance map for the other three indices; see Remaining measurements #5.
- Fitted endmill protrusion, collet nose diameter, runout — all unmeasured; the release gate blocks on
  these (a 20 mm vs 28 mm collet nose was already shown in the prior evidence to be the difference between
  an 8 mm and a −3 mm gap to the historical jaw estimate, so this is not a formality).

I deliberately do **not** propose a dense re-survey of the whole neck; the existing B0/B180 floor contacts
already bound the region I use below (Y254–258, see next section), and `probe-inspection.md`'s efficient-
planning guidance is to bracket unknown transitions coarsely and reuse valid measurements rather than
resample known flat banks.

## Retained connections: four corner tabs vs two C

**Method.** I built my own prismatic cross-section model (`neck_cross_section.py`, this run's output, not
inspected from the prior agent's FCStd until after this was written) over the stock's measured 64.1×36.4 mm
envelope. Working Y-band: **Y254.0–258.0** — the exact intersection of the B0 and B180 *floor* contacts (not
their rims, not the unmeasured Y259+ region), so every millimetre of Y used here is already contact-verified
on both sides. This is narrower than, and independently derived from, the prior agent's Y251–261
axial-extent band.

Each face's contribution (B0=top/B180=bottom/B90=west/B270=east, my own local u/v labels) is modelled as a
region removed from that face's side, with the tab/bracket shapes defined as the *un-removed* complement,
and a 3 mm cutter-radius fillet correction applied at every concave (pocket-side) internal corner —
material a round cutter physically cannot leave sharp. A raster sanity check (0.1 mm grid) cross-checks
every analytic area, and a 3D voxel BFS (the neck band sandwiched between full-section "body" and "tenon"
layers) confirms each variant really does bridge the two sides through only the declared connections, and
counts the connected islands in the cross-section itself.

**Four corner tabs (S = 8 mm square posts, one per corner):**
- Retained area: 248.3 mm² total, **62.1 mm² per tab** (fillet-corrected from a nominal 64 mm²/tab).
- 4 separate connections confirmed by the voxel check (`components_check: 4`, bridges body→tenon: True).
- Each tab is defined by only 2 of the 4 face cuts (its own corner is never directly engaged by any single
  pass), so no extra tool reach is needed beyond each face's own programmed depth.
- Smallest ligament = 62.1 mm² per tab, identical ×4 (prismatic design, no Y-taper in this pass).

**Two diagonal C/L brackets (leg 16 mm, thickness 8 mm, at NW and SE corners):**
- Retained area: 376.3 mm² total, **188.1 mm² per bracket** — roughly **3×** the material of a single
  corner tab, concentrated in 2 connections instead of 4.
- 2 separate connections confirmed by the voxel check (`components_check: 2`, bridges body→tenon: True).
- Minimum ligament along the narrower leg cross-section: 124.1 mm² per bracket (thickness×leg minus its
  2 concave-corner fillets) — still roughly double a single corner tab's ligament.

**Numbers file:** `neck_cross_section_results.json`; script: `neck_cross_section.py`; sanity image:
`cross_section_variants.png`.

**Corner radii:** every concave internal corner (where a cut meets a kept tab/bracket) is rounded to the
cutter radius, 3 mm — this is physical, not a drafting choice, and is already subtracted from the areas
above. The tab/bracket's own *outer* corners (the original stock's corners) stay sharp; nothing touches
them.

**Likely grain direction:** the stock is a rotary-chucked blank with its long axis along machine Y; wood
grain on a piece meant to be turned/indexed this way almost certainly runs axially (along Y), so **every**
tab or bracket, regardless of shape, is a cross-grain connection — the weak axis for snapping. This favours
concentrating retained material into fewer, thicker cross-grain sections rather than many thin ones, because
cross-grain shear/tear strength scales with cross-sectional area, and a 62 mm² post is much closer to a
practical splinter than a 188 mm² bracket is.

**Fixture load path / entry:** both variants are cut from the existing open top (B0) and bottom (B180)
channels and the existing side opening (B90/B270) — no new entry point is invented. The C-bracket design's
larger, contiguous kept-face segments (a 16 mm run along one face, not a small isolated square) also mean
the cutter's radial engagement per pass is more consistent across a track, versus the four-tab layout where
every track that approaches a tab immediately loses/regains full engagement at the tab boundary — this
raises the deflection/vibration risk near a corner-tab track's transition, another mark against Variant A
under interrupted, wood cross-grain cutting.

**Recommendation: two diagonal C-brackets (Variant B).** Reasoning, not area alone:
- **Deflection/accidental release:** ~3× the cross-grain material per connection substantially lowers the
  chance a connection snaps mid-machining under the vibration of the *other* three faces being cut. An
  unplanned release with a spinning cutter engaged is the worse failure mode to guard against here, worse
  than extra sawing afterward.
- **Registration/runout sensitivity:** a corner tab's boundary is set by the convergence of two
  *perpendicular* cuts at a single point — a small B-index or runout error erodes a disproportionate
  fraction of a small tab. A bracket's 16 mm leg absorbs the same absolute error as a much smaller fraction
  of its length, i.e. it is materially less sensitive to exactly the registration/runout uncertainty this
  evaluation has repeatedly flagged as unverified.
- **Trade-off acknowledged honestly:** Variant B leaves 52% *more* total material (376 vs 248 mm²) and only
  2 connections instead of 4, so it needs slightly more final sawing and has **less redundancy** — losing
  one of two diagonal brackets is a worse single-point failure than losing one of four tabs. I do not
  consider this decisive against B given the wood cross-grain argument above, but it is the operator's call
  if they weight "short final saw cut" or "redundancy under a single failed connection" higher than
  "minimize risk of an in-process release." **This is a recommendation to confirm, not a settled choice** —
  see Remaining measurements #9 and #12.
- Diagonal placement (NW+SE) is a default hypothesis pending Remaining measurements #3–5; if those show one
  side of the stock has materially less margin, swap to the diagonal (NE+SW) that avoids it.

## Machining plan

Both rounds use the **same WCS** established above, across all four B indices, per doctrine (one verified
WCS can serve multiple B orientations; the rotary transform is accounted for in CAM, not by re-zeroing).
**Round 1 and Round 2 are separate indexed setups even at repeated B angles**, per the brief's explicit
requirement — Round 1 leaves a continuous connecting web everywhere; only Round 2 removes material down to
the corner-tab/bracket boundary, and doing that in the same pass as roughing would remove the safety margin
Round 1 exists to keep.

### Round 1 — initial channel/side reopening (continuous web retained everywhere)

Four indexed setups, each with its own input stock, output stock, and toolpath review; stepdown ≈2 mm;
entry from the existing open channel/opening (no fresh plunge into solid where the existing groove/opening
already provides one); links at clearance; exit to machine Z328; holder sweep checked against the
**unverified** 8 mm jaw margin with a conservative allowance until Remaining measurement #5 lands. Target
depth stops well short of the final tab/bracket boundary (e.g. roughly halfway from the existing groove
floor to the target), specifically so the neck-solidity question (Stock/fixture section) can be caught by
inspection before Round 2 commits deeper.

1. **Setup 1 — B0 rough.** Tool 6 mm endmill, spindle vertical, B0 (as-mounted). First entry ramps in from
   the existing groove floor (mZ192.2 known-open at Y254–259). 2–3 stepover tracks across a bounded X span
   informed by, but not reaching, the final NW/NE tab or bracket boundary. Exit raised to Z328.
2. **Setup 2 — B180 rough.** Same pattern from the existing B180 floor (mZ198.3, Y254–258).
3. **Setup 3 — B90 rough.** `rotate_b 90` as the file's own leading G53 B move; rough the west opening
   toward, not to, the final boundary.
4. **Setup 4 — B270 rough.** Mirror of Setup 3.

After each setup: inspect (camera + a light manual check, not a probe into a live cut) for unexpected
breakthrough before starting the next setup — this is the cheap, non-blocking version of the solidity check
from the Stock/fixture section.

### Round 2 — tab/bracket-forming finishing cuts (separate setups from Round 1, same B angles)

Lighter stepdowns (~0.5–1 mm) since the remaining cross-section is now thinner and more deflection-prone.
Unlike a design that only finishes B0/B180, **the recommended C-bracket variant needs precise boundaries on
both the top/bottom (X-limited) and the side (Z-limited) legs of each bracket**, so all four indices get a
finishing setup, each still a distinct setup from its own Round-1 rough setup even though the B angle
repeats:

5. **Setup 5 — B0 finish.** Deepen/trim the top cut to the exact NW/SE-bracket top-leg boundary
   (u∈[0,16] for NW, u∈[W-16,W] mirrored logic for the SE leg's top contribution — see script for exact
   corner geometry). Input stock = Setup 1's output.
6. **Setup 6 — B180 finish.** Mirror, bottom-leg boundary. Input stock = Setup 2's output.
7. **Setup 7 — B90 finish.** West-leg boundary (only the NW bracket has a west leg in this layout). Input
   stock = Setup 3's output.
8. **Setup 8 — B270 finish.** East-leg boundary (SE bracket). Input stock = Setup 4's output.

Each setup's G-code is `validate_gcode`-checked (frame declared, extents, spindle state) before staging,
and its confirm page's machine-resolved Z extent is read against the jaw-margin and collet-envelope numbers
from the release gate before approval — not assumed safe because Round 1 was.

## Release gate

Ordered, every step gates the next; none of this has been run:

1. Confirm current fitted tool from `get_machine_profile`/operator statement (Live-state re-read #3).
2. `run_tool_setter {store_as_reference: true}` with the probe fitted — establishes/confirms today's probe
   effective length; **do not reuse the stored 70.95 mm figure for anything until this returns**, given the
   prior flag that it may be stale (~73.5 mm).
3. WCS establishment + independent check (WCS section above), done **with the probe still fitted**.
4. `goto_tool_change_position` **[APPROVAL]**, then the operator physically swaps to the 6 mm endmill
   **[WAIT]** — this is also when the operator states/measures actual fitted protrusion and collet nose
   diameter (Remaining measurement #6); do not proceed on the nominal 20–30 mm collet-in figure.
5. `run_tool_setter {stay_at_trigger/start_from_current: true}` with the endmill fitted.
6. `apply_tool_length_offset` — confirmed G92, keeps the WCS true across the swap without re-touching stock.
7. `select_workspace {workspace: "G54"}` to verify/reselect before the first file job (other MCP procedures
   commonly restore G54; confirm it is still the intended one after the swap sequence).
8. B-zero/backlash check: a `probe_program` cycling `rotate_b` 0→90→180→270→0 with a light contact check
   at each stop against a known feature, confirming repeatable return before any multi-index toolpath is
   trusted.
9. `validate_gcode` on every Round-1 and Round-2 file before staging.
10. A real FreeCAD Path Job with a distinct setup per indexed visit (its own input/output stock, registered
    WCS, inspectable toolpath) is **not produced in this dry run** — see critique.md. Before release it must
    exist and be independently reviewed end-to-end (approach → first entry → all links → final retraction),
    not just the finishing depth in isolation.
11. `submit_gcode_job` per setup with explicit `frame`; read the confirm page's Frame and machine-resolved
    Z extents before approving — never assume machine-Z resolution just because staging succeeded.
12. Recommended (not yet mandatory-costed into the step count below): an air-cut pass per setup, run with
    the head raised clear of stock, to visually confirm the path tracks the real fixture before the first
    material-engaged pass.
13. Operator's final manual saw cut through the two (or four) remaining connections — outside CNC scope.

## Remaining measurements and operator actions

1. Fresh `get_position`/`get_stored_state`/tool-identity confirmation — do not reuse any 26–27 Sep number
   as current.
2. Reverify probe effective length via `run_tool_setter {store_as_reference:true}` before trusting any Z
   derived from the stored 70.95 mm.
3. Bounded `probe_surface_path` extension at X195/B0 from Y259.0 toward Y263, sensor-gated, small steps,
   to safely bound Round-1's Y-extent before it is finalized (currently unmeasured past the Y259.5 abort).
4. Same extension at X198/B180 from Y259 toward Y263 (currently only rim height known there).
5. Repeat the raised/jaw-boundary scan style of job `cc6e2592ccd6` at B90 and B270 — currently only
   characterized at B0/X195; a single-X/single-B transition is not a clearance map for the other three
   indices.
6. Operator states/measures actual fitted endmill protrusion, collet nose diameter, and runout before the
   8 mm nominal jaw margin is trusted for any setup.
7. A staged, incremental-depth Round-1 first pass plus inspection (camera/tap-test) to catch unexpected
   shell/hollow material before Round 2 commits to the bracket depth (Stock/fixture section).
8. One-line note reconciling the ~0.1 mm gap between the two independent physical-X-face estimates
   (201.95 vs 201.85) — likely within tolerance, not silently averaged.
9. Operator sign-off on the CHOSEN tab/bracket sizes (S=8 mm; leg=16 mm, thickness=8 mm) against the actual
   wood species' cross-grain strength — these are planning-stage values, not validated against material
   properties.
10. CAD-to-machine Y registration remains unresolved; not needed for this plan (which uses only the CAD's
    cross-section dimensions), but flagged for any future use of the CAD's channel/recess geometry.
11. Confirm current G54 via a fresh `get_position` before anything else — never assume the 27-Sep snapshot
    persisted.
12. Choose the final bracket diagonal (NW+SE vs NE+SW) using the outcome of items 3–5, favouring the side
    with more confirmed margin.

## Steps

1. `get_connection_status` — -- end turn -- not needed, read-only.
2. `get_stored_state`
3. `get_machine_profile` — branch on `connectedHead`; if ambiguous, ask the operator what is fitted.
4. `get_position` — branch on `reliability`; if not verified/heartbeat/cached-offset, stop.
5. `query_firmware_position` (only if #4 looks suspect)
6. `get_probe_feed_status`; if down, `connect_probe_feed`
7. `get_tool_setter_config`
8. `get_camera_model`
9. `get_gcode_job_status` for each cited job ID, if MCP history is retained
`-- end turn --` (live state fully re-read; branch on what came back before continuing)
10. `run_tool_setter {store_as_reference: true}` (probe fitted) **[APPROVAL]**
11. `start_gcode_job {..., wait_for_approval_ms:110000}` **[APPROVAL][WAIT]**
`-- end turn --`
12. `set_workspace_origin {workspace:"G54", origin_machine:{x:230,y:245,z:231.30}, datum_reference:"job 4a426e131af8, air-side, probe fitted", reason:"single WCS for neck-cut evaluation"}` **[APPROVAL]**
13. `start_gcode_job {..., wait_for_approval_ms:110000}` **[APPROVAL][WAIT]**
`-- end turn --`
14. `probe_program` — independent rim check at B0 (X195/Y250) **[APPROVAL]**
15. `start_gcode_job {...}` **[APPROVAL][WAIT]**
`-- end turn --`
16. `probe_program {ops:[{kind:"rotate_b", b:-180}, {kind:"sequence", ... rim check at X198}]}` **[APPROVAL]**
17. `start_gcode_job {...}` **[APPROVAL][WAIT]**
`-- end turn --`
18. `probe_program` — bounded Y259→263 extension at X195/B0 **[APPROVAL]**
19. `start_gcode_job {...}` **[APPROVAL][WAIT]**
`-- end turn --`
20. `probe_program {ops:[{kind:"rotate_b", b:-180}, {kind:"surface_path", ...Y259→263 @X198}]}` **[APPROVAL]**
21. `start_gcode_job {...}` **[APPROVAL][WAIT]**
`-- end turn --`
22. `probe_program {ops:[{kind:"rotate_b", b:90}, {kind:"surface_path", ...raised-boundary style scan}]}` **[APPROVAL]**
23. `start_gcode_job {...}` **[APPROVAL][WAIT]**
`-- end turn --`
24. `probe_program {ops:[{kind:"rotate_b", b:270}, {kind:"surface_path", ...raised-boundary style scan}]}` **[APPROVAL]**
25. `start_gcode_job {...}` **[APPROVAL][WAIT]**
`-- end turn --` (all bounded reconnaissance done; decide final bracket diagonal and Round-1/2 X spans from what came back)
26. `goto_tool_change_position` **[APPROVAL]**
27. `start_gcode_job {...}` **[APPROVAL][WAIT]**
28. Operator swaps to the 6 mm endmill; states measured protrusion and collet nose diameter. **[WAIT]**
`-- end turn --`
29. `run_tool_setter {stay_at_trigger/start_from_current: true}` (endmill fitted) **[APPROVAL]**
30. `start_gcode_job {...}` **[APPROVAL][WAIT]**
31. `apply_tool_length_offset` **[APPROVAL]**
32. `start_gcode_job {...}` **[APPROVAL][WAIT]**
33. `select_workspace {workspace:"G54"}` **[APPROVAL]**
34. `start_gcode_job {...}` **[APPROVAL][WAIT]**
`-- end turn --`
35. `probe_program` — B-zero/backlash cycle 0→90→180→270→0 with light contact checks **[APPROVAL]**
36. `start_gcode_job {...}` **[APPROVAL][WAIT]**
`-- end turn --` (release-gate items 1–8 complete; only now is a cutting file staged)
37. `validate_gcode` on Round-1 Setup-1 (B0 rough) file
38. `submit_gcode_job {frame:"machine", ...}` (Round-1 Setup-1) **[APPROVAL]**
39. `start_gcode_job {...}` **[APPROVAL][WAIT]**
`-- end turn --`
40. Repeat 37–39 for Round-1 Setup-2 (B180), Setup-3 (B90), Setup-4 (B270) — 3 more validate/submit/start
    cycles, each its own `-- end turn --`, each inspected (camera/manual) before the next.
41. Repeat 37–39 for Round-2 Setup-5..8 (B0/B180/B90/B270 finish) — 4 more validate/submit/start cycles,
    each its own `-- end turn --`.
42. Operator performs the final manual saw cut through the retained connections. **[WAIT]**

Counts: logical approvals=20, literal [APPROVAL] tags=20, operator waits=22 (20 `start_gcode_job` waits +
tool-swap wait + final saw-cut wait), questions=12 (Remaining measurements list).
