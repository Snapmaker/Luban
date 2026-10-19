# Neck-cut reassessment: two C-shaped ribs recommended over four corner tabs, on a 5.0 mm axial band that is shorter and less symmetrically bounded than the prior agent assumed

Independent dry-run reassessment, 2026-09-28. Built from the brief's evidence table, the raw
`probe_measurements_20260927.json` contacts, and my own geometry (`neck_sweep_check.py`,
`make_diagram.py` in this outputs directory) — not from the prior agent's
`neck_cut_fixture_plan.FCStd` tab dimensions, which I only looked at after finishing the
independent build (see "Comparison with the prior agent's file" at the end of the machining-plan
section, and `critique.md`).

## Evidence ledger

| Item | Value | Frame | Source | Status |
|---|---|---|---|---|
| B0 outside X width @ Y245 | physical X137.85 to X201.95, 64.1 mm | machine, physical | brief table | measured |
| B0 side silhouette @ Y245/other orientations | 36.3-36.4 mm | machine, physical | brief table | measured |
| B0 outer rim contact | toolhead Z201.3 @ X195/Y250 (+ earlier X/Y samples); physical Z130.35 | machine, toolhead + derived physical | brief table | measured |
| B0 groove floor | toolhead Z192.2, Y254.0-259.0 confirmed contact (job `7685888d887d`, 19 stations); scan **aborted** past Y259 on a rising wall, probe still triggered after 1 mm backoff | machine, toolhead | `probe_measurements_20260927.json` | measured (Y254-259 only) / **far edge (Y>259) UNKNOWN — do not extrapolate** |
| B0 groove depth | 9.1-9.2 mm below Y250 rim; I use avg **9.15 mm** | derived | brief + `README_previous_proposal.md` | measured |
| B-180 groove rim | toolhead Z204.5 (Y245-250), Z204.4→204.2 (Y250-253.5) | machine, toolhead | `probe_measurements_20260927.json` (`f8f12d4a4b3e`) | measured |
| B-180 groove floor | toolhead Z198.3, Y254.0-258.0 contact; **returns to rim Z199.0→204.6→207.x by Y259.0** — this groove is bounded on **both** ends | machine, toolhead | same job | measured, fully bounded |
| B-180 groove depth | 204.5 − 198.3 = **6.2 mm** | derived | same job | measured |
| Jointly-confirmed neck band (both grooves present) | **Y253.75 - Y258.75 (5.0 mm)**, transitions placed at the midpoint of each measured step | derived (my choice of transition midpoints) | derived from the two profiles above | inferred from measured brackets |
| Web height in that band | H = 36.4 − 9.15 − 6.2 = **21.05 mm** | derived | derived | inferred |
| B90/B270 side opening @ Y256 | physical 21.3 mm (`(east−west) − 2.5 mm` probe diameter) | machine, physical | brief table | measured — corroborates H (21.05 mm) to within 0.25 mm, **not identical evidence** |
| B90 edge shifts | west −9.0 mm, east −6.1 mm (inward, relative Y245) | machine | brief table | measured |
| B270 edge shifts | west −6.0 mm, east −9.0 mm | machine | brief table | measured |
| B-rotation sign | 9 mm feature (B0 groove) appears west at B90, east at B270 | inferred | brief table | inferred, not independently re-derived here (see "Remaining measurements") |
| Chuck-side raised surface (bracket?) | B0/X195: Z207.0@Y263, Z206.4-206.5@Y270-270.5, step to Z213.5@Y271, Z214.2@Y272-278 | machine, toolhead | `probe_measurements_20260927.json` | measured **at X195 only** — material and X-extent unidentified |
| Outboard misses | X205/Y263: no contact to Z208, contact at Z206.7 further down; X210/Y263: no contact to Z200; +Y marches at X205 and X210 found nothing to Y290 | machine, toolhead | `probe_measurements_20260927.json` | measured (constrains sampled lines/heights only — not a clearance map) |
| Historical jaw front | ~Y269 | machine | `cnc-probing` jig facts + brief | historical estimate, not re-measured this band |
| Fresh candidate datum contacts | rim (X195,Y250,toolhead Z201.3); outer X face tip-centre (X203.1,Y245,toolhead Z197.3 → physical X≈201.85); channel-wall tip-centre (X195,Y253.4,toolhead Z197.3 → physical Y≈252.15); zero reported spread on all three | machine | `proposed_safe_wcs_20260927.json`, job `4a426e131af8` | measured, **not re-verified on the eval date** |
| Proposed air-side WCS | machine X230/Y245/**toolhead** Z231.3 (physical tip Z160.35) | machine | `proposed_safe_wcs_20260927.json` | **PROPOSED_NOT_SET_ON_CONTROLLER** as of 2026-09-27 — must not be assumed set |
| 27-Sept live G54 snapshot | origin machine X169.953/Y133.632/**toolhead** Z208.5 (physical tip Z137.55); work reading at the time X−69.953/Y122.368/toolhead Z119.5 | machine | `live_g54_registration_20260927.json` | measured snapshot of an **unrelated stale offset** — explicitly "must not be used as the intended cutting WCS" |
| Rotary axis store | X≈170.1, **physical** Z≈112.4 | machine, physical, **estimate** | `cnc-probing` jig facts / brief | stored estimate — **not a safe toolhead Z, never a travel target** |
| Enclosure CAD (`Stock_T8c_ExistingEnclosure`) | nominal 64×36 mm outside section, local Y 0-119 mm; hollow (2 solids) local Y≈19-100, solid caps at Y≈1-10 and Y118 | CAD (unregistered to machine/work frame) | `reference_enclosure_inventory.txt` | nominal CAD, **Y placement and orientation on the physical stock unproven** |
| Probe effective length | 70.95 mm, ≈21 mm exposed stylus | machine | brief + evidence files | stated as current on 26-27 Sept; **must be re-read from `get_stored_state`, not assumed**, on the eval date |
| Tool (proposed) | 6 mm endmill, >25 mm cutting edge, 75 mm OAL, ~20-30 mm in collet (estimate) | operator statement | brief | nominal — **actual fitted protrusion, collet nose OD, runout unmeasured** |
| Tool-setter surface | machine Z100.5 | machine | `cnc-probing` jig facts | stored reference |

## Live-state re-read (before anything)

Today (2026-09-28) is at least one day after every dated measurement above; the brief states live
state is UNKNOWN. None of the following may be assumed from the 26-27 Sept evidence.

1. `get_connection_status` — machine actually connected, over what channel.
2. `get_position` — `reliability` (must be `verified`/`heartbeat`/`cached-offset`, never
   `awaiting-resync`/`stale`), `warnings` empty, `isHomed`, `machineStatus`, current **B angle**,
   `originOffset`. **Branch:**
   - Offset ≈ the 27-Sept stale snapshot (X169.953/Y133.632/toolhead Z208.5) → G54 confirmed still
     unrelated to this job; proceed to re-establish a datum (below).
   - Offset ≈ the proposed-but-unset origin (X230/Y245/toolhead Z231.3) → someone set it since
     27 Sept; still independently re-verify (step 8 below) before trusting it — do not accept a
     matching number as proof.
   - Offset is neither → unexplained change since 27 Sept; stop, ask the operator what happened,
     before any further step.
3. `get_stored_state` — `geometry.probe.effectiveLength` (compare with the 70.95 mm figure — do
   not silently reuse a remembered number), `geometry.rotary` (X≈170.1/physical Z≈112.4 — an
   estimate, confirm it is still flagged as such), landmarks (jaw box, any new ones), tool
   region, camera calibration state, probe feed status.
4. `get_probe_feed_status` — Probe / Tool Setter / Setter Overtravel pills green before any
   probing is planned.
5. `get_tool_setter_config` — setter reference and `measurements.last`: tells us what was **last
   measured**, not necessarily what is **currently fitted** — a tool or the probe is always
   assumed in the spindle (law 5); this must still be asked of the operator (batched question
   below), never inferred from `measurements.last` alone.
6. Attempt `get_gcode_job_status` for the four cited job IDs (`7685888d887d`, `f8f12d4a4b3e`,
   `cc6e2592ccd6`, `4a426e131af8`) if MCP history retention still covers them, per the brief's
   "check their actual results if MCP history is available." **Branch:** if retained, compare
   `result` against the evidence-file transcriptions above (a transcription error would show up
   here); if expired/not found, proceed on the evidence-file numbers only, flagged as
   unverified-against-source.
7. If a camera is fitted: `get_camera_model` state (verified/unverified/none) — needed only if
   visual grain/registration checks (below) are pursued; `verify_camera_model` before any metric
   use, never before.

**Ask once** (one batched message, before any staging): is the touch probe still the fitted tool,
and has anything (tool, stock, fixture, offsets) been touched since 27 Sept? The endmill's actual
installed protrusion and collet nose OD (both unmeasured per the brief — needed for the release
gate's jaw-clearance check); tool-change flow preference (A: MCP-managed offset, B: touchscreen
wizard) per `tool-change` SKILL.md; OK to overwrite the stale G54 offset with the new datum, or
keep it and use a spare workspace (I recommend reusing G54 — motion rules prefer one WCS and this
G54 is already flagged as not the intended cutting frame) — recommendation, not a decision I make
myself; any operator knowledge of wood grain direction in the neck (helps judge tab-vs-rib fragility,
see "Retained connections" below) or a stated preference between the two variants compared below.

## WCS

**Choice:** the proposed air-side datum (machine X230/Y245, **toolhead** Z231.3 with the touch
probe fitted; physical tip Z160.35) — a **derived**, not directly-on-stock, zero. It is legitimate
under `work-datums.md` ("the mathematical origin need not itself be touchable... with an explicit
recheck method") because it is pinned by two independent tip-centre contacts with zero reported
spread (outer X face X203.1/Y245/toolhead Z197.3 → physical X≈201.85; channel-wall tip-centre
X195/Y253.4/toolhead Z197.3 → physical Y≈252.15) plus a third corroborating rim contact
(X195/Y250/toolhead Z201.3 → physical Z130.35). It sits in a column sensor-checked clear to
toolhead Z197.3, 28.15 mm outside the measured X face — comfortably outside the stock for every B
index, which is exactly why a derived point rather than a touchable corner was chosen.

**It has never been set on the controller** (`PROPOSED_NOT_SET_ON_CONTROLLER`, 27 Sept) and must
not be treated as live without the fresh `get_position.originOffset` read in step 2 above. The
27-Sept G54 snapshot is a **different, unrelated, stale** offset and is never to be read as "the
proposed zero, just not yet confirmed" — that conflation is one of the brief's explicit failure
modes.

**B mapping:** the rotary axis (X≈170.1, physical Z≈112.4) is a stored **estimate**, not a
verified transform and never a toolhead target. The B90/B270 side-probe shifts (9 mm feature on
the west at B90, east at B270) are the only *independent* evidence for rotation sign so far, and
even that is the prior agent's reading of the numbers, not something I re-derived here — flagged
under "Remaining measurements" as worth a direct check (predict the B90 west/east X positions
from the B0 outer-face contacts through the stored rotary transform, then compare against the
measured B90 X151.5/X190.4 — I did not have a trustworthy B0 Z reference for that specific X to
run this prediction from the existing evidence, so I am not asserting a residual here).

**Touchable vs derived:** the zero itself is derived (see above); its two X/Y-fixing contacts and
the corroborating rim contact are directly touchable and were the walls/rim of the *existing*
groove — features that will very largely survive round 1 (round 1 only narrows the web in X; it
does not touch the Y245-253 rim band or the X203.1 outer face) and round 2 (round 2 only removes
material inside the neck band, W1 = 26 mm wide, nowhere near X203.1 or Y245-253). All three
recheck references remain valid throughout both rounds in the same B0 mounting.

**Independent check (how it is set):**
1. Re-touch the same three contacts fresh (bounded `probe_program`, one approval): rim
   (X195/Y250), outer X face (near X203/Y245), channel wall (X195/Y≈253.4). Compare against the
   26-27 Sept values; **stop and ask before proceeding** if any disagree by more than ~0.3 mm
   (probe-length/positional tolerance).
2. `set_workspace_origin {workspace: "G54", origin_machine: {x: 230, y: 245, z: <freshly
   re-measured toolhead Z at the same X230/Y245 column, expected ≈231.3>}, datum_reference: "rim
   X195/Y250 + outer-face X203.1/Y245 + channel-wall X195/Y253.4, job <fresh job id>, probe
   effective length <fresh get_stored_state value>, B0", reason: "common indexed-B datum for the
   neck-cut reassessment"}` — human-gated, no motion, no need to visit the point itself.
3. **Independent recheck after set** (kept separate from the measurements that built the datum,
   per `work-datums.md`): re-touch the B0 rim (X195/Y250) again and predict the resulting **work**
   Z reading from the new origin: physical rim Z130.35 is 30.0 mm below the origin's physical tip
   Z160.35 (matches the evidence file's own `rim_clearance_mm: 30.0`), so work Z should read
   ≈ **−30.0 mm** at that contact — a genuine before-the-fact prediction, not a re-statement of a
   number used to build the origin. For a stronger check independent of *every* point used to
   construct the datum, also re-touch the B-180 rim (X198/Y250, toolhead Z204.5) and predict its
   work Z/X from the same origin — flagged under "Remaining measurements" since I have not
   pre-computed that prediction (it needs the fresh contact first).
4. Reuse this one WCS across B0/B90/B180/B270 in this mounting (`work-datums.md`) — no re-zero
   for indexing. After each rotation, do not `goto_work_origin` automatically: assess the route at
   the new B (rotation can put stock/fixture over the old approach) before any return, per the
   same reference.

## Stock and fixture reconstruction

**Registration:** the enclosure CAD (`Stock_T8c_ExistingEnclosure`, local Y0-119, hollow with
solid caps at both ends) is a strong dimensional match (64×36 mm vs measured 64.1×36.4 mm) but its
Y placement/orientation on the physical part is **unproven** — the brief says so explicitly, and I
am not resolving it here. My working hypothesis, stated as a hypothesis: the measured groove band
(machine Y253.75-258.75) sits near the CAD's solid-cap-to-hollow transition (local Y≈100-119,
where the section drops from 848 mm² through the hollow region back up to the 2304 mm² solid cap)
— i.e. the "neck" is the CAD's transition from shell to clamping boss, not a feature inside the
hollow shell proper. **Bounded check to confirm or refute this**, not a full CAD registration:
probe for the wall-thickness transition (where the physical cross-section stops being hollow-shell
thin and becomes the solid tenon) somewhere clear of the existing groove, and compare its Y offset
from the groove against the CAD's Y13/Y109 transition Y-distances. This is a single-purpose,
bounded measurement, not a full outline.

**Shell vs groove vs tenon vs jaws:**
- Groove (Y253.75-258.75, both faces confirmed): the "neck" itself — the target of this job.
- Enclosure shell: presumed to be the material beyond Y258.75 toward lower Y (unconfirmed
  registration, see above).
- Clamping tenon / chuck-held stub: presumed beyond Y259 toward higher Y — this is exactly the
  region the B0 scan aborted into (Y259.5, probe still triggered), so its start is not solidly
  bounded on the B0 line either.
- Chuck jaws: historical front ≈Y269, characterized **only at B0/X195** where a step from
  toolhead Z206.4-206.5 to Z213.5-214.2 occurs between Y270.5-271. Material/X-extent unidentified;
  X205/X210 misses at Y263 (down to Z208/Z200) and +Y marches to Y290 constrain only those two
  lines, not a clearance volume, and **not at any B other than 0**.

**Open questions / bounded probe-work proposed (all separately approved, all after the WCS
recheck above, none of them a rescan of what is already measured):**
1. **B0 groove far edge (Y>259).** Currently unknown past the aborted station. A fresh, cautious
   `probe_surface_path` restart just past Y259 (not repeating Y254-259) with `stepped` linking and
   a conservative `hop_lift_mm`, stopping the instant the wall is found — this directly bounds
   whether the usable neck band can be longer than the 5.0 mm I used below, which materially
   affects tab/rib length.
2. **Jaw/bracket X-extent at Y270-271, B0.** March a few more X stations at that Y (reusing the
   already-cleared X205/X210 columns as starting evidence, not re-probing them) to bound where the
   step actually begins in X.
3. **Same jaw/bracket check at B90, B180, B270.** The historical Y269 estimate and the X195
   bracket step were only characterized at B0 — a jaw or bracket is not guaranteed rotationally
   symmetric. A shallow single-line check per orientation (not a full re-survey) resolves this
   before round-1's B90/B270 setups are finalized.
4. **CAD-registration check** described above (shell/tenon transition Y-offset from the groove).
5. **Grain direction.** Not directly probeable; propose a `capture_frame` at each B index (no
   motion beyond an already-planned rotation, or piggybacked on the bracket checks above) to look
   for visible grain orientation, plus ask the operator (batched question above) — this feeds the
   tab-vs-rib fragility judgement below, not a hard requirement to have before that recommendation.

## Retained connections: four corner tabs vs two C

**Method.** Built from the measured groove depths and widths only (not the prior agent's
`neck_cut_fixture_plan.FCStd`), as a parametrized 3D voxel model with a true round-cutter sweep
(a straight tool-centre path clearing a rectangular footprint leaves the four internal corners
rounded to the tool radius — not a square-cornered mid-plane sketch), then a 3D connected-
component check (`scipy.ndimage.label`, 6-connectivity) confirming each retained feature is a
single solid that independently spans the whole neck band end-to-end (enclosure side to tenon
side), not just present in isolated cross-section slices. Full script: `neck_sweep_check.py`;
diagram: `neck_cut_connections.png` (this directory). Geometry used (all independently derived
from the evidence table above, not copied from the prior agent's numbers):

- Neck band: **Y253.75-258.75 (5.0 mm)** — the jointly-confirmed band only (see evidence ledger).
  This is shorter, and asymmetrically bounded (B-180 groove closes at both ends; the B0 groove's
  far end is simply unmeasured, not closed), than the prior agent's assumed Y251-261 (10 mm)
  cutter extent.
- Web height H = 21.05 mm (measured, both faces).
- Round-1 intermediate width **W1 = 26 mm** (my choice: 19.05 mm removed per side from the 64.1 mm
  outside width — comfortably under the tool's stated >25 mm usable flute, unlike the prior
  agent's 24 mm/side which used nearly the whole flute; also enough width left for two 8 mm
  features either side of a clearable ≥6 mm-tool centre pocket).
- Corner tab / C-rib width **TX = 8 mm** each edge; four-tab height **TZ = 6 mm** (top and
  bottom), leaving a 9.05 mm mid-height gap for the splitting pass (6 mm tool, ~1.5 mm/side
  clearance — deliberately looser than the prior agent's flagged 0.25 mm/side, which they
  themselves called too tight for the runout/registration risk).

**Numbers for both (computed, not estimated):**

| | components (3D, span full band) | cross-section per feature | total retained cross-section | round-2 setups |
|---|---|---|---|---|
| Four corner tabs | 4, each independently spans the band | 8 × 6 = 48 mm² | **≈192 mm²** | B0, B180, B90, B270 (4) |
| Two C-ribs | 2, each independently spans the band | 8 × 21.05 ≈ 168 mm² | **≈337 mm²** | B0, B180 only (2) |

Both variants were verified to actually separate into the stated number of solids (four-tab: 4
components; two-C: 2 components) end to end across the band — not merely at one mid-plane slice —
by the connected-component check.

**Recommendation: two C-ribs**, for four reasons, in the order the brief asks for (not "select by
area alone," which the brief explicitly warns against even though the four-tab design leaves
~43% less material to saw):
1. **Fewer setups, fewer registration exposures.** Two finishing setups (B0, B180) vs four
   (all indices revisited) — each setup is a place the datum/tool/B chain can go wrong; two-C
   halves that exposure for the *most* material-removal-heavy round.
2. **Stiffer retained sections.** A 21.05 mm-tall rib resists bending/deflection under cutting
   loads far better than a 6 mm-tall isolated square post at the same 8 mm width — the four-tab
   posts are the more slender, more registration/runout-sensitive feature, which is exactly the
   sensitivity the brief asks me to weigh instead of area.
3. **Easier, safer final saw cut.** A single continuous 8 × 21 mm face gives the saw full bearing
   support; four small isolated posts (8×6 mm, no counter-support) are more prone to splitting or
   crushing under hand-saw pressure, especially cross-grain.
4. **Shell registration risk.** Given the unresolved CAD/physical registration and the unbounded
   B0 groove far edge, a design that needs fewer independently-registered finishing setups is
   lower-risk while those open items remain open.

The four-tab design is the better choice **if** the operator's priority is minimizing sawn
material specifically (43% less) and grain runs favorably along the tab's short axis rather than
the neck's length — this is exactly the kind of judgement the brief says needs the operator's
grain-direction knowledge, which I do not have; see the batched question above.

## Machining plan

All setups below are **separate indexed visits** — round 1's B0/B180/B90/B270 are not merged with
round 2's B0/B180 finishing even though the B angles repeat, per the brief's explicit instruction.
All depths/positions are stated in the recommended WCS above (work frame, once verified per §WCS);
every setup also needs the machine-frame equivalent read fresh from `get_position` at execution
time — I am not pre-computing machine coordinates for cuts that have not been through the
live-state re-read.

**Round 1 — establish the four indexed cuts (continuous web remains throughout):**

| Setup | B | Tool orientation | First entry | Stepdown | Links | Exit | Holder sweep |
|---|---|---|---|---|---|---|---|
| 1 | 0 | endmill axial (Z) | **re-enters the already-open groove** (Y253.75-258.75, confirmed contact Y254-259) — no blind plunge | ~2 mm/pass to the established 9.15 mm floor (conservative for a 6 mm 2-flute wood cutter) | full-width passes within the confirmed band only (do not extend past Y259 until item 1 above is answered) | straight retract to clearance | check against the Y270-271 bracket at B0 (item 2 above) before finalizing feed extents |
| 2 | 180 | endmill axial (Z) | re-enters the already-open groove (Y253.75-258.75, fully bounded both ends) | ~2 mm/pass to 6.2 mm floor | same | straight retract | jaw check at B180 (item 3) |
| 3 | 90 | endmill radial (side-milling into the rotated X) | starts **outside stock** at the original edge (physical, ≈X±32) and feeds inward — no plunge, uses the already-confirmed 21.3 mm side opening at Y256 as the visual/contact check that the pass is in the right band | radial passes down to W1/2 = 13 mm from centre, ~2-3 mm radial stepover per pass given side engagement | full band, band-bounded like setup 1 | retract outward, straight | jaw check at B90 (item 3) |
| 4 | 270 | same, opposite side | mirror of setup 3 | mirror | mirror | mirror | jaw check at B270 (item 3) |

**Round 2 — tab-forming finishing cuts (two-C recommended):**

| Setup | B | Tool orientation | First entry | Stepdown | Links | Exit | Holder sweep |
|---|---|---|---|---|---|---|---|
| 5 | 0 | axial (Z), centre pocket only | **ramped/helical entry** into solid material at the pocket centre (X∓5..+5 of the recommended frame) — this is a blind pocket, not a re-opened channel; the FreeCAD Path Job must specify a real ramp/helix entry, never a straight vertical plunge | ~2 mm/pass, target depth ≈ H/2 + ~1.5 mm overlap past the web midplane (registration margin) — this reaches only ≈12 mm past the *existing* round-1 floor, well inside the tool's stated >25 mm flute, shallower than the prior agent's single-side 22.3 mm figure because round-1 already removed the outer 9.15/6.2 mm | serpentine within the 10 mm-wide pocket (W1 − 2·TX) | retract straight after the last pass | recheck against the raised transition/jaw before deepest pass |
| 6 | 180 | axial (Z), centre pocket only | mirror ramped entry from the bottom groove floor | mirror, ≈H/2 + 1.5 mm past midplane from this side, overlapping setup 5's cut | mirror | mirror | mirror |

*(If the operator instead chooses four corner tabs: add Setup 7 (B90) and Setup 8 (B270), each
entering through the already-open side window at the tab-strip X range and side-milling the
9.05 mm mid-height gap to split each edge strip into its top and bottom tab — same band, same
entry-from-open-air logic as round-1 setups 3/4.)*

**Comparison with the prior agent's file.** After building the above independently, I opened
`neck_cut_fixture_plan.FCStd`'s description (`README.md`) as a hypothesis check, not before. Their
round-1 (B0/B180 reopen to 9.2/6.2 mm, B90/B270 side cut) matches mine in kind, though they used a
24 mm/side reduction (to 16.1 mm final width) against my 19.05 mm/side (to 26 mm) — theirs uses
more of the stated flute length per side. Their round-2 finishing depths (22.3 mm B0 / 19.3 mm
B180, measured from the original outer surface) go substantially deeper on a single side than
mine (≈12 mm past the already-cut round-1 floor) because their tab geometry (two 4.8×8 mm
diagonal bridges) isn't either of the two variants the brief asks me to compare, and reaches
further to isolate a smaller, off-corner feature. I have not adopted their 24 mm/16.1 mm numbers
or their diagonal-bridge geometry; the two-C/four-tab numbers above are mine, with the reasoning
stated so a reviewer can independently agree or disagree with the choice of W1/TX/TZ.

## Release gate

Ordered; nothing before it is authorization to cut.

1. Live-state re-read (above) fully resolved, including the batched question answers.
2. WCS establishment + independent recheck (above) complete, with `get_position.originOffset`
   confirmed by two fresh agreeing reports (the tool's own contract).
3. Item 1-3 bounded probes above resolved (B0 groove far edge; jaw/bracket X-extent at B0 and at
   B90/B180/B270).
4. Tool-change sequence (flow chosen by the operator in the batched question):
   - Flow A: `run_tool_setter {accept_probe_contact: true}` to log the outgoing probe (skip only
     if a same-session, same-tool measurement already exists) → `goto_tool_change_position` →
     operator swaps by hand → `run_tool_setter {bit_length_mm: <operator estimate, declared LOW>}`
     for the new endmill → `apply_tool_length_offset` → verify `originOffset.z` changed by exactly
     the measured delta.
   - Flow B: `run_tool_setter {stay_at_trigger: true}` for the probe, operator confirms and swaps
     on the touchscreen, `run_tool_setter {stay_at_trigger: true, start_from_current: true}` for
     the endmill, operator confirms the wizard's own offset — no `apply_tool_length_offset` in
     this flow.
5. **Physical measurement, not MCP**: operator measures the newly-fitted endmill's actual
   protrusion from the collet and the collet nose OD with calipers, and reports both — this
   directly resolves the brief's flagged "collet nose diameter UNKNOWN" (a 20 mm nose left only a
   1 mm gap to the historical Y269 jaw estimate; a 28 mm nose overlapped it) against whatever the
   item-2/3 bounded jaw checks above actually find.
6. G54 recheck (`get_position.originOffset` fresh read) after the tool-length transfer.
7. **B-zero/backlash check**, not done in the prior evidence: after round 1's B0→B90→B180→B270
   sequence, rotate back through to B0 and re-touch one already-known B0 feature (e.g. the rim)
   to bound repeatability before round 2 relies on the same WCS at B0/B180 again.
8. Build the actual FreeCAD Path Job from this reassessment's geometry (W1/TX/TZ or the C-rib
   dimensions above, the recommended WCS, real ramp/helix entries for the round-2 pockets, the
   `docs/post/freecad_probe_emitter.py`-style measured placement rather than a CAD-origin
   assumption) — the six setups above as six distinct Path setups, each with its own input/output
   stock, matching the brief's "each indexed visit is a distinct setup" requirement. Not done in
   this dry run.
9. `validate_gcode` on the emitted program; read every warning, do not edit around one.
10. `submit_gcode_job {frame: "work"}`; read the confirm page's **Frame** row and
    machine-resolved Z extents (or the explicit "if G54 is active" condition) to the operator
    before anything is approved.
11. **Independent end-to-end review** of the final file — initial approach, first plunge/ramp,
    every link, deepest cut per setup, withdrawal, holder sweep against the (by-then-resolved)
    jaw/bracket geometry at all four B indices — by someone who did not write it, per the brief's
    explicit requirement 6.

## Remaining measurements and operator actions

1. Fresh `get_position`/`get_stored_state`/`get_probe_feed_status` read (live-state re-read §, all
   branches).
2. Attempt to pull the four cited historical job records via `get_gcode_job_status`.
3. Batched operator question (fitted tool + nothing-moved confirmation; endmill protrusion/collet
   OD; tool-change flow A/B; G54-overwrite OK; grain direction / variant preference).
4. Re-touch the three datum contacts fresh; compare to 26-27 Sept values within ~0.3 mm.
5. `set_workspace_origin` (human-gated) at the freshly-confirmed values.
6. Independent recheck of the new origin against the B0 rim (predicted work Z ≈ −30.0 mm) — and,
   for a check independent of every point used to build the datum, against the B-180 rim once its
   fresh contact is in hand (prediction not pre-computed here).
7. Bounded probe: B0 groove far edge past Y259 (stepped links, conservative hop, stop on the wall).
8. Bounded probes: jaw/bracket X-extent at B0/Y270-271, and equivalent single-line checks at
   B90/B180/B270.
9. Bounded probe or reasoning: shell/tenon transition Y-offset vs the groove, to sanity-check the
   CAD-registration hypothesis above.
10. Physical caliper measurement of the fitted endmill's protrusion and collet nose OD, after the
    tool change.
11. B-zero/backlash recheck after the first full B0→B90→B180→B270→B0 traverse.
12. FreeCAD Path Job build-out for the six setups (or eight, if four-tab is chosen instead),
    including real ramp/helix entries for the two blind round-2 pockets.
13. Independent end-to-end file review before any `submit_gcode_job`.

## Steps

1. [Operator question, batched] "Before I plan anything further: (a) is the touch probe still
   fitted, and has the tool/stock/fixture/any offset been touched since 27 Sept? (b) once the new
   endmill is fitted, please measure its actual protrusion from the collet and the collet nose OD
   with calipers — the brief flags both as unmeasured and they gate the jaw-clearance check. (c)
   which tool-change flow do you want — MCP-managed offset (flow A) or the touchscreen wizard
   (flow B)? (d) the 27-Sept G54 is a stale, unrelated offset — OK to overwrite it with the new
   datum, or would you rather I use a spare workspace? (e) any knowledge of the wood's grain
   direction through the neck, or a preference between the two tab designs below?" [WAIT]
-- end turn --
2. (after answers) `get_connection_status`, `get_position`, `get_stored_state`,
   `get_probe_feed_status`, `get_tool_setter_config`, `get_machine_profile` — read-only batch, no
   confirm page. Report `reliability`, B angle, `originOffset`, pill states, stored probe length
   and rotary geometry.
-- end turn --
3. (branch on step 2) If `reliability` is `awaiting-resync` or `stale`: stop, tell the operator,
   re-read once more after ~3 s; do not stage anything. If `originOffset` matches neither the
   stale 27-Sept snapshot nor the proposed origin: stop and ask what changed. Otherwise continue.
4. `get_gcode_job_status` for each of `7685888d887d`, `f8f12d4a4b3e`, `cc6e2592ccd6`,
   `4a426e131af8` (read-only, no confirm page). Report whether each is still retained and whether
   its `result` matches the evidence-file numbers above.
5. [Stages a bounded `probe_program`] Re-touch the three datum contacts (rim X195/Y250; outer
   X face near X203/Y245; channel wall X195/Y≈253.4), all as a `sequence` inside one program.
   [APPROVAL] [WAIT]
-- end turn --
6. (after approval/run) Compare fresh contacts to the 26-27 Sept values. If any disagree by more
   than ~0.3 mm: stop, report the discrepancy, ask before proceeding. Otherwise:
7. [Stages] `set_workspace_origin {workspace: "G54", origin_machine: {x: 230, y: 245, z:
   <fresh toolhead Z from step 5>}, datum_reference: "<job id from step 5>; rim/outer-face/
   channel-wall contacts; B0; probe effective length <fresh value>", reason: "common indexed-B
   datum, neck-cut reassessment 2026-09-28"}` [APPROVAL] [WAIT]
-- end turn --
8. (after approval) `get_position` — confirm `originOffset` changed to the requested values via
   two fresh agreeing reports (the tool's own verification).
9. [Stages] Independent recheck: re-touch the B0 rim (X195/Y250) alone; report the resulting work
   Z against the ≈−30.0 mm prediction. [APPROVAL] [WAIT]
-- end turn --
10. [Stages a bounded `probe_program`] Item 1 (B0 groove far edge past Y259, stepped links,
    conservative hop) + item 2 (jaw/bracket X-extent at B0/Y270-271) in one program, since both
    are simple bounded extensions of already-measured columns. [APPROVAL] [WAIT]
-- end turn --
11. [Stages] `rotate_b 90` inside a bounded `probe_program`, then the equivalent single-line
    jaw/bracket check at B90, `capture` for grain inspection, back to B0. Repeat as separate
    approvals for B180 and B270 (each rotation + check is its own program per the "ask once, not
    per rotation" reading of law 7 — but each is a *different* physical check, not a repeat, so
    each gets its own approval). [APPROVAL] each [WAIT] each
-- end turn -- (after each)
12. Reconcile items 9 (CAD-registration hypothesis) from whatever the above found; report the
    updated evidence ledger to the operator before proposing cut parameters as final.
13. [Operator action] Tool change per the chosen flow (release-gate step 4/5). [WAIT]
-- end turn --
14. `get_position` — confirm G54 offset shifted by the applied tool-length delta.
15. [Stages] B-zero/backlash recheck: rotate B0→B90→B180→B270→B0, re-touch the B0 rim once more,
    compare against step 9's value. [APPROVAL] [WAIT]
-- end turn --
16. [Operator/offline] Build the FreeCAD Path Job for the six (or eight) setups above, using the
    dimensions and entries in "Machining plan," registered to the datum established in step 7-9
    and the bracket/groove findings from steps 10-11. Not an MCP call.
17. `validate_gcode` on the emitted program.
18. [Stages] `submit_gcode_job {frame: "work"}`. [APPROVAL] [WAIT]
-- end turn --
19. Independent end-to-end review of the confirm page (Frame, machine-resolved Z extents) and the
    file itself, by someone other than the author, before `start_gcode_job` is ever called. This
    evaluation ends here — no cut is run.

Counts: logical approvals=10, literal [APPROVAL] tags=8, operator waits=10, questions=1 (one
batched message covering five items).
