# Neck-cut reassessment: independent re-derivation favours the two-C variant, but nothing is cleared to cut until nine specific live measurements land

## Evidence ledger

| Item | Value | Frame | Source | Status |
|---|---|---|---|---|
| B0 outside stock width @ Y245 | physical X faces 137.85 / 201.95 (width 64.1 mm) | physical | evidence table | measured |
| B0/B180 side silhouette @ Y245 | 36.3–36.4 mm | physical | evidence table | measured |
| B0 rim contact | toolhead Z201.3 @ X195/Y250 → physical Z130.35 | machine toolhead → physical | job `7685888d887d` | measured |
| B0 existing top groove | floor toolhead Z192.2, Y254.0–259.0 → depth 9.1–9.2 mm from rim | physical depth | job `7685888d887d` | measured; **Y259.5 edge aborted on a rising wall — do not extrapolate past Y259** |
| B180 existing bottom groove | rim toolhead Z204.5 (Y245–253), floor Z198.3 (Y254–258) → depth 6.1–6.2 mm | physical depth, **rotated (B180) pose** | job `f8f12d4a4b3e` | measured; Y-unchanged by rotation (axis is along Y) so this Y-band is directly comparable to the B0 groove's |
| B90/B270 side opening @ Y256 | 21.3 mm physical opening; edge shifts vs Y245: B90 −9.0 mm W / −6.1 mm E, B270 −6.0 mm W / −9.0 mm E | physical | evidence table (job `97ff89e230a5` family) | measured; **this is the SAME top/bottom groove seen in profile, not an independent third groove** — confirms B-direction sign (9 mm = B0 groove) |
| Chuck-side raised transition @ X195 | Z207.0 (Y263) → Z206.4–206.5 (Y270–270.5) → step to Z213.5 (Y271) → ~Z214.2 (Y272–278) | physical, **one X line only** | jobs `e185e35d0536`, `cc6e2592ccd6` | measured bracket; material/X-extent unidentified; historical jaw proxy starts Y269 |
| Fresh datum contacts | rim (195,250,tZ201.3); outer-X tip-centre (203.1,245,tZ197.3)→physX≈201.85; channel-wall tip-centre (195,253.4,tZ197.3)→physY≈252.15; free column (230,245) clear to tZ197.3 | machine | job `4a426e131af8` | measured, zero reported spread |
| Rotary axis | X170.1, **physical** Z112.4 | physical, **historical** (2026-09-05, 71.3 mm probe, raw stock) | `get_stored_state.geometry.rotary` (per skill) | historical estimate; 2026-09-27 contacts put it ~0.8 mm off in X, ~1 mm off in physical Z for this clamping — **never a toolhead target, must be re-checked (rotary-axis.md) before CAM rotates anything about it** |
| Enclosure CAD nominal | 64×36 mm outside section, local Y 0–119 mm, `Stock_T8c_ExistingEnclosure` volume 83372.368 mm³ | CAD | `reference_enclosure_20260922.FCStd` / inventory | nominal; **local Y↔machine Y and B-datum registration NOT established** |
| Tool | 6 mm endmill, 25 mm cutting edge, 75 mm OAL, ~20 mm in collet (~55 mm protrusion) | operator-stated | brief | **unverified — no tool-setter measurement on record for this tool** |
| Fixture clearance | jaw front ~Y269 (historical, one X line); operator states 5 mm margin already established | physical, machine Y | evidence + brief | inferred/nominal — **not a full clearance map**, must be re-checked per B pose, not assumed from the B0/X195 line |
| Origin snapshot, 27 Sep | old G54: work X≈−69.953/Y122.368/Z119.5 at machine X100/Y256/toolhead Z328, B0; g54 origin machine (169.953,133.632,toolhead 208.5) | machine+work | `live_g54_registration_20260927.json` | historical; **controller state on 2026-09-28 is unknown — must not be assumed current** |
| Proposed (NOT set) safe WCS | machine X230/Y245, physical tip Z160.35 (toolhead Z231.30 with the 27-Sep probe length) | machine | `proposed_safe_wcs_20260927.json` | `PROPOSED_NOT_SET_ON_CONTROLLER` — never treat as the live offset |
| Probe (27 Sep) | effective length 70.95 mm, ~21 mm exposed stylus, tip diameter 2.5 mm (radius 1.25) | stored | evidence | stored as of 27 Sep — **re-read `get_stored_state.geometry.probe.effectiveLength` fresh; do not reuse the remembered figure** (motion-rules §2: "figures remembered from text ... are historical") |
| My own 3D connectivity check (this session) | four-corner-tabs: 4 pieces, ~120 mm² total (~30 mm² each); two-C: 2 pieces, ~174 mm² total (~87 mm² each). Both remain ONE connected 3D solid Y248→Y264 at r=3.0, r=3.15 (runout), and Y±0.5 mm (registration) | LOCAL PHYSICAL, unregistered | `neck_geometry_check.py`, `neck_geometry_results.json` (this session's outputs) | computed, sensitivity-tested; itself depends on the unverified groove X-extent and Y259/253.5 edges below — see "Remaining measurements" |

## Live-state re-read (before anything)

Everything below is dated 26–27 September; today is 2026-09-28 and the brief says treat live state as **unknown**. No step past this list is authorised until it returns.

1. `get_connection_status` — is Luban connected, over what channel. Not connected → stop, tell the operator, nothing else below runs.
2. `get_position` — read `reliability` (must be `verified`/`heartbeat`/`cached-offset`), `warnings` (must be empty), `isHomed`, `machineStatus`, the current `b`, and `originOffset`. Branches:
   - `awaiting-resync` or `stale` → refused for motion; re-read once after ~3 s; if still stuck, `query_firmware_position` + `get_mcp_diagnostics.machinePosition` and report a connection/controller fault, not a wait.
   - `isHomed: false` → homing is itself motion (law 1) and turns B (stock rotates) — this needs the operator's explicit word before it is even staged, and is asked for in the single question batch below, not assumed.
   - `originOffset` compared against the historical `live_g54_registration_20260927.json` g54 origin (machine 169.953/133.632/toolhead 208.5) — if it matches, that is *consistent*, not proof it is still the intended cutting frame (an origin can coincidentally survive a reboot's default). If it differs, the 27-Sep offset is gone and must not be assumed recoverable.
3. `get_stored_state` — in one call: `geometry.probe.effectiveLength` (do not reuse 70.95 from memory), `geometry.rotary` (historical X170.1/Z112.4, flag as such), `landmarkClearances`, tool-setter config, camera state, probe-feed state, `limits` (motion floor / park height for this rig).
4. `get_probe_feed_status` — transport, per-channel readings, tripwire armed state. Confirms whether the probe feed is even connected right now.
5. `get_tool_setter_config` → `measurements.last` — which tool was measured last, and when. Tells us whether the endmill has ever actually been touched off, or whether only the probe has stored history.
6. `query_firmware_position` — cross-check if step 2 looks at all suspicious (frame-flip signature, machine-frame stuck beat, etc.).
7. `get_machine_profile` → `connectedHead` — confirms CNC head is fitted (not printer/laser), which the brief assumes but the tool contract says to verify, never infer.

**Single question batch to the operator** (law 7 — asked once, before anything is staged):
- What is currently fitted in the spindle right now — the touch probe, the 6 mm endmill, or something else? (Evidence says the probe was still fitted as of 27-Sep with the feed released at machine Z328, B0 — but "historical position notes from a closed session are never live position.")
- Has anything moved, been probed, or been cut on this setup since 27 September?
- Is homing authorised if `isHomed` comes back false (it will also turn B — stock will rotate)?
- Which physical side of the stock should be called "west" (B270-facing) vs "east" (B90-facing) for a fixed, checkable reference — e.g., a paint mark, cable-entry side, or other landmark — since the evidence only fixes the *rotation sign*, not a compass label?
- Has the endmill (6 mm dia, 25 mm flute, 75 mm OAL) actually been measured on the tool setter yet, or is `bit_length_mm` still to be declared from the operator's stated ~55 mm protrusion?
- Is the historical jaw-front estimate (~Y269, one X line only) still physically accurate, or has fixturing changed since 27-Sep?
- Which work-origin flow does the operator want to use: the proposed air-side `set_workspace_origin` (X230/Y245/physical-tip-Z160.35), or a different accessible reference they'd rather touch off directly?

Nothing after this point runs until that batch is answered; the first tool call that uses an answer comes after the answer, never before it.

## WCS

**Candidate: the proposed air-side origin** — machine X230, Y245, physical tip Z160.35 (`proposed_safe_wcs_20260927.json`). This is a **derived**, not directly-touchable, zero: X/Y sit in free air 28.15 mm outside the measured X face (201.85) and the physical Z is the measured B0 rim (130.35) + 30 mm clearance. It qualifies under work-datums.md ("the mathematical origin need not itself be touchable ... when derived from accessible measured references, with an explicit recheck method") **only if**:

1. **Re-measured fresh, not reused.** The three contacts it depends on (rim 195/250/tZ201.3; outer-X-face tip-centre 203.1/245/tZ197.3; channel-wall tip-centre 195/253.4/tZ197.3, job `4a426e131af8`) are re-taken on 2026-09-28 with the touch probe confirmed fitted and its effective length freshly read from the store (not assumed 70.95). If they agree with the 27-Sep numbers within the probe's repeat spread, treat the derivation as still valid; if not, re-derive.
2. **Set, not merely computed.** `set_workspace_origin {workspace: "G54", origin_machine: {x:230, y:245, z:231.30-or-whatever-today's-toolhead-Z-at-that-physical-tip-is}, datum_reference: "rim 195/250 + outer-X-face 203.1/245 + channel-wall 195/253.4, job <today's job id>, B0, probe <today's effective length>", reason: "common measured datum for the indexed neck-cut visits"}` — human-gated, no travel required (the head can stay parked; per work-datums.md do not spend an approval positioning at the proposed zero first).
3. **Independently checked**, using a reference **not** used to derive the origin — the contact that fed the origin cannot also verify it. Candidate: the B180 rim (toolhead Z204.5 historically, X198) predicts a specific work Z once G54 is set; probe it fresh and compare to the CAM-predicted value within the cut's tolerance (I propose 0.3 mm, matching the rotary-axis check tolerance used elsewhere in this rig's skills). If the readback disagrees by more, stop and ask before continuing.

**Touchable vs derived.** X/Y at (230,245) touch nothing; Z is anchored to a real measured rim (130.35) by a fixed clearance offset, not touched directly either. This is acceptable as a *safe, air-side* zero precisely because it is always reachable without threading through the stock, but it is not itself a witness feature. If the operator would rather have a directly-probeable zero (e.g., the B0 rim itself, or the pre-existing groove wall) I will use that instead — see the question batch above.

**CAD and rotary-axis mapping across B.** G54 is a *fixed machine-frame point*; it does not rotate with B. What changes per B is where the *stock's* features sit relative to that fixed point, via the rotary axis. Before any CAM rotates geometry about the stored axis (X170.1, physical Z112.4, from the 2026-09-05 four-face survey with a 71.3 mm probe on then-raw, now-differently-clamped stock), it must be checked per `rotary-axis.md`:
- **Z check**: a fresh B0 top contact and a fresh B180 top contact at the *same* physical Y and mirrored X, plus the measured thickness T from the B90/B270 side silhouette (36.35 mm @ Y245, itself re-verified, not the CAD nominal 36 mm) → axis contact Z = (top0 + top180 − T)/2, physical axis Z = that minus the *current* probe length.
- **X check**: B90/B270 side contacts at the same feature and Y → axis X = (centre90 + centre270)/2.
- Compare against the stored X170.1/Z112.4; if they disagree by more than the cut's tolerance, re-store with `set_probe_geometry` and a reason naming the new job IDs, probe length, clamping and date — never a hand edit.

The enclosure CAD (`reference_enclosure_20260922.FCStd`, `Stock_T8c_ExistingEnclosure`) is **not** used to place any cut until its local Y and B-datum are matched to a physical landmark or shoulder — it is nominal-only per the evidence and the brief explicitly forbids treating it as registered.

**Return route.** `goto_work_origin` is XY-only at the current Z, never a clearance move; every approach to or near work zero is preceded by its own `move_z` to the park height (machine Z328). After any B rotation, the previous approach to zero may now be obstructed by the rotated stock or jaw — I will not call `goto_work_origin` automatically after indexing; each setup gets its own explicitly checked entry point (see Machining plan).

## Stock and fixture reconstruction

- **Registration.** The only defensible physical registration today is the measured evidence table above, all keyed to machine X/Y at B0 (or B180 in its own rotated pose, Y unchanged). The CAD file's local frame is *not* used for placement until a physical landmark ties it down (see remaining measurements).
- **Shell vs groove vs tenon vs jaws.** The neck region (Y≈250–263) is being read as a locally near-solid transition between the (elsewhere hollow) enclosure and its chuck-held tenon — the CAD's thin-wall hollow sections (≈404 mm² inside a 2304 mm² bbox) apply to the enclosure body proper (its own local Y range), **not** demonstrated to apply at this neck without registration, so I do not assume the neck is hollow. The already-cut B0/B180 grooves are read as a *pre-existing* parting feature (not something this plan proposes), leaving a central bar of physical height ≈21.05–21.3 mm (9.1–9.2 mm off the top + 6.1–6.2 mm off the bottom of the 36.35 mm section) at full 64.1 mm width, over the verified Y-band 254–258 (259 on the B0/top side only). The chuck-side raised transition (Y270.5–271 step, one X line) and the historical jaw front (~Y269) are kept as *separate, unresolved* obstacles, not folded into the neck geometry.
- **Open questions / bounded measurements proposed** (see "Remaining measurements" for the exact calls):
  1. X-extent of the existing top/bottom grooves — only sampled at X195/X198; assumed full-width in this plan's geometry model, flagged as an assumption, not evidence.
  2. The Y259–259.5 edge of the B0 groove (aborted on a rising wall) and the Y258–259 return of the B180 groove — do not extrapolate; a short bounded `surface_path` continuation is proposed.
  3. The Y259–263 raised-surface rise (5.7 mm higher than the Y250 rim) versus the flat-top assumption baked into the six-op prior review model — must be resolved before any cut whose axial reach nears Y261 (both my variants' round-1/round-2 cutter reach already touches Y261 at the rounded end of travel).
  4. Full extent and material identity of the chuck-side raised transition and the true current jaw-front X/Z — the historical Y269 line is a conservative proxy, not a map.

## Retained connections: four corner tabs vs two C

**Method.** I built my own local-physical 3D voxel model (0.2 mm grid, `neck_geometry_check.py`, this session's outputs) of the measured stock and existing grooves, then subtracted the *actual 6 mm cutter's swept volume* for round-1 (side) and round-2 (finishing) passes — rounded in the plane of tool travel (Y-Z for a side/B90/B270 approach, X-Y for a top-or-bottom/B0/B180 approach) and flat/sharp along the tool's own plunge axis, exactly as `cutting-programs.md` specifies ("radius appears in plan view and at the ends of travel, not in the section"). I counted 3D-connected solids with `scipy.ndimage.label` (6-connectivity) across the whole kerf band (Y248–264, i.e. well outside the Y251–261 cutter reach on both sides) — not a mid-plane section — and re-ran at a runout-inflated radius (r=3.15 mm) and at the Y-band shifted ±0.5 mm, to test sensitivity rather than reading one snapshot.

Both variants share round-1: side cuts from each face to depth 22.05 mm (leaving a 20.1 mm-wide central bar), 3 Y-tracks (254/256/258), same 6 mm cutter — this is *my* chosen depth, not copied from the prior agent's 22–24 mm figures, picked to leave enough width for round-2 to still form a legible connection while keeping collet reach well inside the ~29 mm caution noted in the evidence.

**Four corner tabs** (round 2 = B0 top-deepen + B180 bottom-deepen, each a full-width pass with two explicit tab-corner exclusion notches, tab_w=5 mm, tab_h=6 mm):
- 4 separate pieces, ≈30 mm² each, ≈120 mm² total.
- Unaffected by the runout test in this idealised model (the notch boundary is a sharp exclusion, not itself dilated) — **flagged as an optimistic simplification**: a real tool will round the tab's own corner too, so the true surviving tab is smaller than 30 mm²; final tab size needs a real CAM tool-path simulation, not this idealised notch.
- Least material to saw off at the end (120 mm² total).
- Four independent, smaller connection points: losing one to tool deflection or wood failure leaves an asymmetric 3-tab hold, which can let the stock work under the next cut.

**Two C-shapes** (round 2 = B270 finish, west bite, formed first; B90 finish, east bite, formed second; **plus a third operation I added myself** — a B0-or-B180 centre-separating cut, X≈±2 mm, full remaining bar height — needed to make the two C's genuinely separate pieces rather than one wide notched bridge; see critique.md):
- 2 separate pieces, ≈87 mm² each, ≈174 mm² total.
- Responds to runout as expected (≈164 mm² at r=3.15, a 6% reduction) — behaves like a real cut, not an idealised one.
- Each opening faces directly out of the corridor round-1 already cleared on that side (west bite starts exactly at round-1's X=−10.05 boundary; the spine sits on the *inward* side, never between the tool and its entry) — satisfies "accessible from the corresponding side corridor, not hidden behind a spine."
- Deepest reach from a face: 24.05 mm (the bite), still ≈5 mm inside the ~29 mm caution reach noted in the evidence for an opened 24 mm corridor.
- More material to saw off at the end (174 mm² vs 120 mm²), but each surviving connection is ≈3× the single-tab area, and there are only two failure points to track instead of four (fewer stops to re-verify holder clearance for).

**Recommendation: two-C.** Per-piece robustness dominates the choice here: 87 mm² per C versus 30 mm² per tab is a large margin against deflection or an unnoticed partial break mid-program, and the C's own opening direction is fixed by which B angle cuts it (B270/west, B90/east), which is exactly what the brief asks for and removes an axis of ambiguity that the 4-tab plan doesn't need but also doesn't resolve for you. The extra 54 mm² of final hand-sawing is a small cost next to the ~1300 mm² of original neck cross-section already gone. This recommendation is sensitive to the assumptions above (groove X-extent, Y259 edge, runout) and should be re-run through this same script once those are measured — it is not a final release-quality number.

Diagram: `retained_connections.svg` (X-Z section at Y=256, dimensions from the computed geometry, both variants' numbers captioned).

## Machining plan

All Y positions below are physical/machine Y (unchanged by B). All depths are **from the relevant outer face**, physical, not toolhead Z — CAM must convert through the verified WCS and the checked rotary transform before any file is generated.

**Round 1 — initial indexed cuts, continuous web retained throughout:**

| # | B | Tool orientation | First entry | Stepdown | Links | Exit | Holder sweep note |
|---|---|---|---|---|---|---|---|
| 1 | B0 | vertical plunge into existing top groove | descend into already-open groove (top open, no fresh plunge into solid) | ~2 mm/level to enlarge depth modestly (this round does not reach the tab/C depth) | 3 Y-tracks 254/256/258, straight XY moves at depth | raise to park (Z328) | holder stays well above the Y269 jaw proxy; re-check once jaw front is confirmed |
| 2 | B180 | vertical plunge into existing bottom groove | same, from the rotated pose's "top" (=true bottom) | ~2 mm/level | same 3 tracks | raise to park | same holder caveat, now with stock rotated 180° — re-verify approach clearance fresh, do not reuse the B0 approach |
| 3 | B90 | side plunge from west face | enters the corridor already opened by the B0/B180 grooves (top-to-bottom through-opening at Y256) | ~2 mm/level to 22.05 mm depth | 3 Y-tracks, Z sweep across the open bar height | raise to park | shank/holder clearance to the now-side-facing chuck jaws must be re-checked at B90, not inferred from the B0 jaw line |
| 4 | B270 | side plunge from east face (mirror of #3) | same | ~2 mm/level to 22.05 mm | same | raise to park | same, mirrored |

Each of these four is its own setup: its own input stock (the previous setup's output), its own registered-WCS reference, its own inspectable toolpath. None of them is merged with its later finishing visit at the same B merely because the angle matches (this is exactly the failure mode the brief calls out).

**Round 2 — tab/C-forming finishing cuts (two-C recommendation):**

| # | B | Tool orientation | First entry | Stepdown | Links | Exit | Holder sweep note |
|---|---|---|---|---|---|---|---|
| 5 | B270 | side plunge, west | into the round-1-opened west corridor, middle-Z band only (leg_h reserved top/bottom) | ~2 mm/level to 24.05 mm | 3 tracks | raise to park | west C's opening faces directly out this corridor — confirm nothing (chip, clamp) obstructs it before descent |
| 6 | B90 | side plunge, east (mirror) | same | ~2 mm/level to 24.05 mm | same | raise to park | mirrored |
| 7 | B0 or B180 | vertical plunge, centre-separating slot | into the already-open groove at the bar centreline (X≈±2 mm), full remaining bar height | ~2 mm/level | single narrow pass | raise to park | **this is my addition, not in the brief's two-sentence description — flag it to the operator explicitly before it is cut; see critique.md** |

For the four-corner-tab alternative, round 2 is B0-finish + B180-finish only (no side-approach finishing needed), each a full-width pass with the two tab-corner exclusions, same Y-tracks.

## Release gate

Ordered, each item blocking the next:

1. **Datum closed out** — WCS section above completed and independently checked (not merely computed), while the probe is still fitted.
2. **Tool-setter sequence, probe → endmill:**
   - Measure the probe (if the stored value is not trusted / store came back empty): `run_tool_setter {bit_length_mm: <low estimate>, accept_probe_contact: true}`, then `set_probe_geometry`.
   - `goto_tool_change_position` (park), operator swaps probe → 6 mm endmill by hand, confirms.
   - `run_tool_setter {bit_length_mm: <operator's ~55 mm stated protrusion, declared low>}` — this is the FIRST real measurement of this tool; do not invent `old_trigger_z`.
   - `apply_tool_length_offset {reason: "..."}` — shifts work Z by new−old; verify `get_position.originOffset.z` moved by the delta and the operator sanity-checks displayed work Z.
3. **Collet/holder clearance check** — with the endmill now fitted and measured, re-derive the actual reach numbers in this plan (22.05 mm / 24.05 mm) against the *measured* protrusion and collet nose diameter (currently "unknown" per the evidence — the ~29 mm reach caution assumed a corridor already opened to 24 mm, which round-1 provides, but the collet body's own diameter must still be measured or bounded).
4. **G54 recheck** — fresh `get_position.originOffset` compared to what was set in step 1; re-verify after the tool change too (a swap moves work Z, per `tool-change` skill).
5. **B-zero/backlash check** — before any rotated-frame CAM is trusted, a small indexed check (e.g. return to B0 after a full B90→B180→B270→B0 cycle, compare a fixed feature's contact) per the rotary-axis provenance requirement.
6. **FreeCAD Path Job / post** — built from the *measured* stock reconstruction above (not the unregistered CAD), one Path Job per indexed visit (7 setups total for the two-C plan), each with its own input/output stock and inspectable toolpath; posted through the sanctioned post, not the probing emitter.
7. **Controller validation, per `cutting-programs.md`, in order, per file:**
   - `validate_gcode` — read every warning.
   - Independent parse, first move to final retraction, in machine Z: the raise/clearance plane against the measured stock and jaw/landmark state, every XY rapid and height, the descent column landing over open material, each level's depth against measured surfaces, where cutter/shank/holder come nearest the fixture at that B, the final raise and `M5` with nothing after.
   - `submit_gcode_job {gcode, name, frame: "work"}` unchanged; read the operator the Frame row and machine-resolved Z extents (with the "if G54 is active" condition, if any); confirm URL as the last line; end the turn; `start_gcode_job` in the background.
8. **Never**: send an unverified FreeCAD Path feature straight to `submit_gcode_job`, call the stored rotary physical Z112.4 a toolhead target, assume the 27-Sep G54 is today's G54, or treat the one-X-line jaw transition as a full clearance map at every B.

## Remaining measurements and operator actions

1. Fresh `get_connection_status` / `get_position` / `get_stored_state` / `get_probe_feed_status` / `get_tool_setter_config` (Live-state re-read, above) — blocks everything.
2. Answer the single question batch above (spindle contents, anything moved since 27-Sep, homing authorisation, west/east naming, endmill setter history, jaw-front currency, WCS preference).
3. Bounded `surface_path` continuation of the B0 groove past Y259 (currently aborted on a rising wall) and the B180 groove's Y258–259 return, to resolve the true Y-extent my geometry model currently assumes.
4. A short side-march or two at additional X (not just X195/X198) to bound the groove's X-extent, since the current model assumes full 64.1 mm width from a single-X sample.
5. Resolve the Y259–263 raised-surface rise (5.7 mm above the Y250 rim) against the flat-top assumption — matters because both variants' cutter reach touches Y261 at the rounded end of travel.
6. Extend the chuck-side raised-transition bracket (currently one X line, Y270.5–271) with at least one more X line, and re-confirm the current jaw-front X/Z at B90 and B270 specifically (not inferred from the B0/X195 line).
7. Opposite-face rotary-axis check (`rotary-axis.md` formula) using fresh B0/B180 top contacts and the measured 36.35 mm thickness, before any CAM rotates geometry about the stored X170.1/Z112.4.
8. Tool-setter measurement of the actual 6 mm endmill's protrusion (release gate step 2) and, if obtainable, the collet nose diameter/body clearance — currently unknown and load-bearing for the 22.05/24.05 mm reach numbers.
9. Re-run `neck_geometry_check.py` with the above measurements substituted once available, before treating any of this session's areas/ligament numbers as release-quality.

## Steps

1. `get_connection_status {}` — verify Luban is connected to the machine.
2. `get_position {}` — read `reliability`, `warnings`, `isHomed`, `machineStatus`, `b`, `originOffset`.
3. `get_stored_state {}` — `geometry.probe.effectiveLength`, `geometry.rotary`, `landmarkClearances`, tool-setter config, probe-feed state, `limits`.
4. `get_probe_feed_status {}` — confirm transport and tripwire state.
5. `get_tool_setter_config {}` — read `measurements.last`.
6. `get_machine_profile {}` — confirm `connectedHead` is the CNC head.
-- end turn -- *(post the single question batch here: spindle contents, anything moved since 27-Sep, homing authorisation if step 2 shows not-homed, west/east naming convention, endmill setter history, jaw-front currency, WCS preference)*

*(the following come only after the operator answers; each still branches on what steps 1–6 actually returned)*

7. If `isHomed: false` and the operator authorised it: `home {}` — runs on the call, no confirm page; state clearly that B will also turn. [WAIT for the operator's explicit "yes, home it" before this call — not inferred from anything above.]
8. If the probe is confirmed fitted and its stored effective length is trusted (or freshly re-measured per step 8 below): stage a `probe_program` re-taking the three datum contacts fresh (rim 195/250; outer-X-face 203.1/245; channel-wall 195/253.4, all at B0) as a `sequence` of hop/descend/probe steps, bounded `max_travel_mm` per the 21 mm exposed stylus limit (margin 2 mm → no floor contact more than ~16.5 mm below the rim under the probe body). [APPROVAL — deliver the `confirm_url` as the last line, end the turn.]
-- end turn --
9. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` for the program staged in step 8. [WAIT for the operator's click.]
10. Compare the fresh contacts to the 27-Sep numbers (rim, outer-X-face, channel-wall) within the probe's repeat spread. If they disagree beyond spread, stop and ask before proceeding — do not average or override.
11. If they agree: stage `set_workspace_origin {workspace: "G54", origin_machine: {x: 230, y: 245, z: <today's toolhead Z at physical tip 160.35, computed from today's rim contact + 30 mm>}, datum_reference: "rim/outer-X-face/channel-wall job <today's id>, B0, probe length <today's value>", reason: "common measured datum for the indexed neck-cut visits"}`. [APPROVAL — confirm URL last line, end turn.]
-- end turn --
12. `start_gcode_job {job_id, wait_for_approval_ms: 110000}`. [WAIT.]
13. `get_position {}` — verify `originOffset` changed to the expected value with two agreeing reports (the tool does this internally; re-read to confirm to the operator).
14. Stage an independent check contact (B180 rim, or another feature **not** used in step 11's derivation) as a bounded `probe_sequence`/`probe_program` step. [APPROVAL.]
-- end turn --
15. `start_gcode_job {...}`. [WAIT.] Compare the predicted vs measured work coordinate at that contact against the stated tolerance (0.3 mm proposed). Disagreement beyond tolerance stops the plan here.
16. Bounded `probe_surface_path` continuations past the current Y259 (B0 groove) and Y258–259 (B180 groove) edges, and one or two extra-X side marches to bound the groove's X-extent (remaining-measurements items 3–4). [APPROVAL per staged program.]
-- end turn --
17. `start_gcode_job {...}`. [WAIT.]
18. Bounded top-surface scan resolving the Y259–263 raised-surface rise against the flat-top assumption (remaining-measurements item 5). [APPROVAL.]
-- end turn --
19. `start_gcode_job {...}`. [WAIT.]
20. Additional X line(s) on the chuck-side raised transition, plus fresh jaw-front checks at B90 and B270 specifically — each its own `rotate_b` + bounded march inside one `probe_program` (remaining-measurements item 6). [APPROVAL for the whole program, one click.]
-- end turn --
21. `start_gcode_job {...}`. [WAIT.]
22. Opposite-face rotary-axis check per `rotary-axis.md`: fresh B0/B180 top contacts at the same physical Y/mirrored X (remaining-measurements item 7), reusing the `rotate_b` group construct if convenient. [APPROVAL.]
-- end turn --
23. `start_gcode_job {...}`. [WAIT.] Compute axis Z/X per the formula; compare to stored X170.1/Z112.4; `set_probe_geometry` with a reason naming today's job IDs if it needs updating.
24. Re-run `neck_geometry_check.py` locally with the measured groove X-extent, Y-edges, and rotary-axis correction substituted, to confirm the two-C recommendation and its numbers still hold. (Local computation — no tool call, no approval.)
25. Tool-setter sequence for the probe→endmill swap (Release gate step 2): `run_tool_setter` (probe, if not already trusted) [APPROVAL] → `goto_tool_change_position` [APPROVAL] → operator swap [WAIT for their word] → `run_tool_setter` (endmill, bit_length_mm from the operator's stated protrusion, declared low) [APPROVAL] → `apply_tool_length_offset` [APPROVAL].
-- end turn --
26. `start_gcode_job {...}` for each staged step above in turn. [WAIT after each.]
27. `get_position {}` — verify `originOffset.z` moved by the expected delta; operator sanity-checks displayed work Z.
28. Stop here. Building the seven-setup FreeCAD Path Job, running `validate_gcode` and the independent parse, and staging any `submit_gcode_job` are **out of scope for this dry run** and belong to a later session once every item above has returned real numbers — this evaluation stages no cut.

Counts: logical approvals=11, literal [APPROVAL] tags=11, operator waits=10, questions=7
