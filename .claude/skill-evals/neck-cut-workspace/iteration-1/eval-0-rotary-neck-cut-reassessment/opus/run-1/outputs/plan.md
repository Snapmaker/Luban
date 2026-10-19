# Neck-cut reassessment: four 6 x 4 mm corner tabs in one axis-centred G54, reached through a continuous-web round 1 and a 3-setup round 2, after a fresh axis and fixture survey

Dry run, 2026-09-28. Nothing here has moved the machine, set an origin, swapped a tool or cut anything.
Every step below is a plan. Each staging step needs an explicit instruction in the operator's latest
message, and the operator's click on its confirm page.

Frame notation used throughout:
- **M-X / M-Y**: machine X and Y.
- **TZ**: machine toolhead Z with the named tool fitted.
- **PZ**: physical height, which is TZ minus the fitted tool length. For the probe that length is the stored 70.95 mm.
- **W**: the proposed work frame (see WCS).
- **CAD**: the operator's enclosure model frame.

Geometry scripts, results and the review model are all in this directory:
- `registration_check.py` (with `_output.txt`)
- `neck_sweep_model.py`, `neck_sweep_results.json`, `neck_cut_T4_review.FCStd`
- `holder_clearance.py` (with `_output.txt`)
- `inspect_enclosure_cad.py` and `enclosure_cad_inspection.txt`
- diagram: `neck_tabs_diagram.svg` / `.png`

## Evidence ledger

| # | Item | Value | Frame | Source | Status |
|---|---|---|---|---|---|
| 1 | Probe length / ball / exposed stylus | 70.95 mm / 2.5 mm / about 21 mm | TZ minus tip | brief, `probe_measurements_20260927.json` | measured 27 Sep; live-unknown (`get_stored_state`) |
| 2 | B0 X faces at Y245 | 137.85 and 201.95, so W = 64.10, centre 169.90 | M-X physical faces | brief; +X face from `4a426e131af8` (tip centre 203.1 at TZ197.3) | measured |
| 3 | B0 rim | TZ201.3 = PZ130.35 at X195/Y250. Flat within 0.1 at X145/170/195 (the Y of the X145/170 contacts is unclear) | TZ | `7685888d887d`, `4a426e131af8`, `b32add0404af` | measured |
| 4 | B0 groove floor | TZ192.2 = PZ121.25, Y254.0-259.0 at X195; 192.1-192.2 at X145/170 | TZ | `7685888d887d`, `b32add0404af` | measured |
| 5 | B0 groove, enclosure-side wall | M-Y252.15 (tip centre 253.4 at TZ197.3, 2.75 below the rim). Rim edge by ball model about 252.3 | M-Y | `4a426e131af8` | measured, one point |
| 6 | B0 groove, chuck-side wall | Between Y260.25 (floor contact at 259.0) and Y260.75 (stepped-link hit at 195/259.5/TZ200.2). Scan aborted; not extrapolated | M-Y | `7685888d887d` | inferred bracket |
| 7 | B-180 profile at M-X198 | Rim TZ204.5 = PZ133.55. Floor TZ198.3 = PZ127.35 at Y254-258. Walls about Y252.8 and Y259.6 (ball model). Tenon plateau TZ207.2-207.5 at Y259.5-263 | TZ, rotated pose | `f8f12d4a4b3e` | measured; walls inferred |
| 8 | B90 / B270 side silhouettes at TZ213 (tip centres) | Y245: 151.5 / 190.4 and 148.3 / 187.1. Y256: 160.5 / 184.3 and 154.3 / 178.1 | M-X | `97ff89e230a5` via README | measured |
| 9 | Section thickness T | 36.35 (36.40 at B90 / 36.30 at B270). Neck height from the floors is 21.05; side-on it reads 21.30 | physical | derived from #8, #4, #7 | inferred |
| 10 | +B direction | +B turns B0 +Z toward -X. The 9 mm B0 groove appears west at B90 and east at B270 | - | #8 shifts | measured |
| 11 | Stored rotary axis | X170.1, PZ112.4 | M-X / PZ | brief (stored geometry) | nominal estimate; contradicted by #12 |
| 12 | Derived rotary axis | X169.33, PZ113.78 (TZ-probe equivalent 184.73) | derived | `registration_check_output.txt` | inferred. The thickness-centre offset agrees to 0.025 (1.600 from B0/B180 tops vs 1.625 from B90/B270 centres). B90/B270 Y256 faces predicted from the directly probed floors within 0.20. With the stored axis the same checks miss by 2.0-2.75 mm |
| 13 | Tenon (chuck-held raw stock) | B0 X195: TZ207.0 at Y263, 206.4-206.5 at Y270-270.5. X205/Y263: TZ206.7. X210/Y263: no contact to TZ200, and no contact on a +Y march Y263-290 at TZ200 | TZ | `e185e35d0536`, `cc6e2592ccd6`, `99156aca920d`, `6f844b2af53c`, `6429cd27c354` | measured at points and lines only |
| 14 | Tenon width | About 69.5 (raw stock, X134.75-204.25) | M-X | README 2026-09-02 survey plus #13 | inferred |
| 15 | Jaw / raised surface | Step between Y270.5 and 271.0, then TZ213.5-214.3 over Y271-278, at X195 B0 only (PZ143.25). Material and X/B extent unknown | TZ | `cc6e2592ccd6` | measured, one line |
| 16 | Enclosure CAD | 64 x 36 x 119, hollow. Solid 0-12 mm end. 3.5 mm solid end at Y115.5-119, then a 10 mm backplate (Z-26..-36) at Y109.5-115.5. 4 mm walls; ledge at \|x\|>22.5 below Z-26 | CAD | `reference_enclosure_20260922.FCStd`, my `enclosure_cad_inspection.txt` | nominal CAD |
| 17 | CAD registration, X | The old G54 X169.953 ±32 lands at 137.95 / 201.95, against measured 137.85 / 201.95 | CAD to M-X | live_g54 JSON + CAD | inferred (0.1 mm) |
| 18 | CAD registration, Y and end orientation | **H1**: thin 3.5 mm end at the chuck. G54 Y133.632 + 119 = 252.63, 0.48 past the measured wall. **H2**: 12 mm end at the chuck. The uncalibrated camera views favour H1 (thinner chuck-end wall, a floor visible in the window near the chuck) | CAD to M-Y | camera frames, CAD | live-unknown; P1 `cavity_test` decides |
| 19 | 27 Sep G54 | Origin M(169.953, 133.632, TZ208.5); tool unknown | TZ | `live_g54_registration_20260927.json` | stale snapshot; not a datum |
| 20 | Prior air-side WCS | X230/Y245/TZ231.30 (PZ160.35) | - | `proposed_safe_wcs_20260927.json` | proposed, never set |
| 21 | Clear column | X230/Y245 down to TZ197.3 | TZ | `4a426e131af8` | measured, B0 only |
| 22 | Endmill | 6 mm, >25 mm flutes, 75 mm OAL. Protrusion, nut, nose, runout and corner radius unknown | - | brief | nominal / unknown |
| 23 | Tool setter | Surface M-Z100.5, centre X79/Y293. The setter switch fires before the probe's own switch | - | MCP README | historical; live-unknown |
| 24 | Grain | Along the rotary axis (Y); long streaks in the B90/B270 frames | - | camera | inferred |
| 25 | Tailstock support of the free end | unknown | - | - | live-unknown (Q3) |
| 26 | Position, B, workspace, fitted tool, probe feed, stored geometry, landmarks, history of the cited jobs | unknown on 28 Sep | - | - | live-unknown |

**What changed against the brief and the prior agent.**
1. The live contract now has a human-gated `set_workspace_origin` for measured XYZ, with Z as TZ for the fitted tool. The prior note "MCP has no sanctioned direct XYZ work-origin write" is superseded.
2. The stored axis (#11) is inconsistent with the 26-27 Sep contacts. Rotating CAM about it would displace the cuts in the stock (see Retained connections):
   - B180 by (-1.55, +2.75) mm
   - B90 by (-2.15, +0.60) mm
   - B270 by (+0.60, +2.15) mm
3. The skill jig table ("axis ≈ 170 / 112") is stale for this clamping.

**Prior agent's paths, checked only after my own geometry.**
- Its three Y tracks (254/256/258) sweep Y251-261. That cuts 1.15-1.8 mm into the enclosure end face (#5, #7) and into the tenon wall.
- Its B90/B180/B270 paths rotate about the stored axis.
- Its two bridges (36.3 mm² each) are diagonal, inside an 18 mm central web, away from the enclosure's side walls.
- Its zero was in air.

I reuse none of its paths or dimensions.

## Live-state re-read (before anything)

All of these are read-only and need no approval.

1. `get_connection_status` must show connected over the expected channel.
2. `get_position` must show:
   - `reliability` verified, heartbeat or cached-offset (never awaiting-resync or stale), with `warnings` empty
   - `isHomed` true, `machineStatus` idle
   - B angle and the raw `originOffset` (expect a changed or zero offset after any power cycle).
   If it shows `frame: machine-frame`, use `restore_work_frame`. If awaiting-resync, re-read after about 3 s. If still odd, use `query_firmware_position` and `get_mcp_diagnostics`.
3. `get_stored_state`, recording:
   - `geometry.probe.effectiveLength` (compare with 70.95; ask if they differ by more than 0.3)
   - tip diameter, `geometry.rotary` (expect the stale 170.1 / 112.4)
   - landmarks with `requiredToolheadZ`
   - limits (floor 320, park 328)
   - camera stream URL
4. `get_machine_profile`: `connectedHead` (50 W or 200 W), which sets the M3 form.
5. `get_probe_feed_status`: transport (GPIO means `sensor_delay_ms` 50; MQTT means 250), probe, setter and overtravel channels green, tripwire armed.
6. `get_tool_setter_config`: centre and reference, plus `measurements.last` / `previous` (a record, not a fresh pair).
7. `get_mcp_diagnostics`: `buffers.mcpJobEventLimit` (P1 needs about 5,400 events and P2 about 7,900).
8. `get_gcode_job_status {"job_id": ...}` for `4a426e131af8`, `7685888d887d`, `f8f12d4a4b3e`, `cc6e2592ccd6`, `e185e35d0536`, `97ff89e230a5` and `b32add0404af`:
   - Confirm the stored results match the committed JSON.
   - Find the Y of the X145/X170 rim contacts. A solid-top contact at X170 with Y below 248.6 would favour H2.
   - If the history is gone, re-measure everything in P1 anyway.
9. `list_cameras` (give the operator the stream URL) and `capture_frame`, with no motion. Use the frame qualitatively: what is in the spindle, and the B pose.

Branches:
- **Not homed / power-cycled:** home only on the operator's word, saying B will home and the stock will turn. The old G54 is gone either way.
- **Endmill fitted instead of the probe:** add `goto_tool_change_position` and a swap to the probe before P1. No tool-length transfer is needed, because no valid Z datum exists yet.
- **Anything re-clamped:** all contacts in the ledger become history, and P1 is the only geometry source.

## WCS

**Choice: one G54 for all seven indexed setups, centred on the measured rotary axis.**
- W X0 is the derived axis X (today's estimate 169.33).
- W Y0 is the enclosure's chuck-end face in the B0 groove (Y252.15, direct contact).
- W Z0 is the axis height. W Z is physical height above the axis. The controller's G54 Z is the TZ of the fitted tool with its tip at the axis height: 184.73 with the probe (today's estimate), then shifted by the setter difference for the endmill.

The zero is **derived**, not touchable: it lies inside the neck. Only Y is a direct contact.
- X comes from the B90 and B270 tops with the B0 X faces.
- Z comes from (B90 top + B270 top)/2 - W/2. The cross-check is (B0 top + B180 top)/2 - T/2.
- The two estimates must agree within 0.15 mm, or the section or the indexing is not what the model assumes and the plan stops.

The probe length cancels because everything is kept in probe-contact TZ.

**Why this frame.** Every indexed setup is then a pure rotation of the measured stock about W's Y axis, so the post needs no rotary offset. The controller does not rotate frames or apply TCP. A rim-top Z0 is equally valid, but it forces the -16.6 mm axis offset into every rotated setup, which is the classic 4-axis error.

**Stock and CAD pose per B.** p is a W point in the B0 pose.

| B | Stock point p=(x, y, z) goes to | Tool axis in the stock frame | Faces (W, derived model) |
|---|---|---|---|
| 0 | (x, y, z) | +Z (from the B0 top) | rim +16.57, groove floor +7.47 |
| 90 | (-z, y, x) | +X (from the B0 +X face) | enclosure top +32.62 |
| 180 | (-x, y, -z) | -Z (from the B0 bottom) | rim +19.77, floor +13.57 |
| 270 | (z, y, -x) | -X | enclosure top +31.48 |

Machine from W:
- M-X = G54.x + X_w
- M-Y = G54.y + Y_w
- TZ = G54.z(fitted tool) + Z_w
- PZ = 113.78 + Z_w

CAD to W, under H1: X_w = x_cad + 0.575, Y_w = y_cad - 119, Z_w = z_cad + 16.575. The Y term carries ±0.5 uncertainty.
Under H2: X_w = -x_cad + 0.575, Y_w = -y_cad.

The CAD is used only for the shell and load path. The cut geometry comes from contacts.

**How it is set.**
1. P1 measures.
2. `set_workspace_origin` is staged while parked at TZ328, B0 (probe fitted). It needs no visit to zero.
3. `get_position` readback.
4. P3 checks it independently, at points not used to build it:
   - B0 rim at X160: predicted work Z +16.575.
   - B0 enclosure wall at X170: tip-centre work Y +1.25.
   - B180 X faces at Y249.9: work X -32.625 / +31.475 (mid -0.575). This checks X0 without using the B90/B270 tops.
   - B90 top at X171: work Z +32.625, which checks Z0 at a rotated pose.
   Tolerance is ±0.10 mm. The numbers are recomputed from P1 before staging.
5. After the swap, the operator does a feeler check at the B0 groove floor. Expected work Z = 7.47 + feeler ± 0.15. This catches probe-pretravel bias (the setter fires before the probe).

**Return route.** Nothing ever returns to work zero. `goto_work_origin` would put the head over the neck at the current Z, and the axis column is inside stock. It is never used as a check or a clearance move.

Each setup file enters at its own verified column:
- over the open B0 or B180 groove
- or over the measured neck face at B90 or B270

All XY rapids are at machine at least 320 (TZ = G54.z + Zc_w, resolved on the confirm page). Rotating does not move the datum. A B0 route is never reused as clearance at another B.

## Stock and fixture reconstruction

- **Enclosure shell (Y < 252.15):** CAD registered by the X faces (0.1 mm) and the chuck-end wall. The end orientation (H1/H2) is unresolved until P1 `cavity_test`.
  - At X170/Y245, from TZ top_a + 4, march at most 16 mm.
  - H1 means no contact: the window reaches 26 mm down. The probe body stays 9 mm above the rim.
  - H2 means contact at about TZ201.3.
  No cut enters the shell. The kerf starts 1.15 mm from the face, and the nearest cavity is at least 3.5 mm behind the face under H1 and 12 mm under H2.
- **Existing grooves (neck zone, Y252.15 to about 260.3):**
  - B0 groove: 9.1 mm deep, about 8.3 wide.
  - B180 groove: 6.2 deep, about 6.8 wide.
  - Floors are flat across X: B0 at X145-195; B180 at the B0-equivalent X of about 141 and 197.6 (#8, #7).
  - Between the floors the neck is solid raw stock, 64.10 x 21.05 (1349 mm²), attached to the enclosure face and the tenon.
  - **Assumed and to be measured:** the neck's X faces are flush with the enclosure. If P1 finds them proud, as the 69.5 mm tenon suggests, S3/S4 gain a facing pass to u = ±32.05. The tabs then stay inside the enclosure's end-face footprint.
- **Tenon (Y above about 260.3):** chuck-held raw stock, wider and taller than the enclosure. Its top is PZ136.05 at B0 and 136.35 at B180; its side about PZ148.7 / 148.4 at B90 / B270 (inferred).
  The **Y259-263 rise** is the tenon's end face. At B0 X195 the wall is between Y260.25 and 260.75, and the top is flat at TZ207.0 by Y263. At B180 it rises Y258.5 to 259.5 to a flat 207.2-207.5.
  P1 closes the gap with two ±Y wall contacts at mid-groove depth (X145, X195) and a 13-station stepped profile from Y264 to 261 at X195 (`max_drop_mm` 3 so it cannot dive into the groove). B180 walls are measured the same way.
- **Jaws / chuck (Y above about 270.5):** known only on one line at B0 (PZ143.25, 29.5 above the axis, probably a jaw on the tenon top). The jaws rotate with B, so the envelope must hold at all four B.
  - The collet nut (radius at most about 12) never reaches Y270.5 from track Y256.3.
  - The spindle nose or body can. P2 therefore checks it: for B in 0, 90, 180, 270, six sensor-gated -Z marches from TZ328 (X150/170/190 at Y276 and Y281), each stopping at the height the spindle body needs.
    - A miss certifies that column clear at that B.
    - A contact stops the plan.
  - Operator calipers (chuck OD, jaw tip radius, nut and nose dimensions) give the cross-check.
  - A photo is context only.
- **Probe limits:** every planned contact keeps the ball within 21 mm of the highest nearby surface under the body:
  - B0 groove walls at TZ floor + 3 (body about 9 mm above the tenon top)
  - cavity test at most 12 mm below the rim
  - side marches 4 mm below the tops
  - no probing inside the kerf after round 1

## Retained connections: four corner tabs vs two C

**Method.** `neck_sweep_model.py` builds exact FreeCAD B-rep sweeps of a 6 mm flat endmill.
- Each sweep is two cylinders plus a prism along the tool axis in the stock frame, so it includes the R3 ends of travel and the flat tip.
- The sweeps are applied in setup order to the measured neck block.
- Connectivity is counted as solids in the kerf slab Y253.35-259.25, and each solid is checked to span it.
- Sections are taken every 0.5 mm, with chords at mid-kerf.
- The cut shifts from axis errors (R⁻¹ - I)δ, runout and Y error are rerun.
- The kerf track is Y256.30, so the kerf is Y253.30-259.30. This is centred in the tighter B180 groove.
- Shared round 1:
  - B0 and B180 bands to ±2.5 mm of mid-height, leaving a 5 mm web
  - B90 and B270 notches 3 mm deep over |v| < 6.52 at mid-kerf.

| At mid-kerf (saw plane Y256.30) | Round 1 only | **T4: four corner tabs** | C2: two C's |
|---|---|---|---|
| Solids spanning the kerf (3D) | 1 (continuous web) | **4** | 2 |
| Pieces in every section Y253.35-259.25 | 1 | 4 | 2 |
| Retained area / sawn with a 1 mm blade | 434.7 mm² | **96.0 mm² / about 96 mm³** | 174.2 mm² / about 174 mm³ |
| Share of the 1349 mm² neck | 32 % | **7.1 %** | 12.9 % |
| Each piece | - | 6.0 (u) x 4.0 (v) = 24 mm², centres (±29.05, ±8.52) from the neck centre | 6.0 x 21.05 minus a 3 x 13.04 outward notch = 87.1 mm² |
| Smallest ligament | 5.0 (web) | **4.0** (tab v at mid-kerf) | 3.0 (spine at mid-kerf) |
| Growth toward the kerf edges (R3 sweep ends) | - | tabs flare to 8.45 x 6.45 (218 mm² total at Y253.35) | spine 3.0 to 5.1 (307 mm²) |
| Connection volume | 2724 mm³ | 728 mm³ | 1223 mm³ |
| Σ A·r² (torsion / bending proxy) | - | about 88 000 mm⁴ | about 149 000 mm⁴ |
| Share of footprint backed by enclosure walls behind the 3.5 mm end (H1) / H2 | - | top tabs 67 %, bottom 99 % / 99 % | 62 % / 100 % |

- **Corner radii.** In section the internal corners are sharp (flat endmill; a corner radius, if the tool has one, only adds fillets). Along Y every cut face is an R3 cylinder, so each tab is smallest at mid-kerf. The external arris is the old groove floor meeting the side face.
- **Grain.** Along Y, so the tabs are long-grain ligaments loaded in tension, compression and shear. The risk is splitting along Y when a spine notch breaks through.
- **Load path.** From the enclosure's 4 mm side walls and backplate, through the tabs, into the tenon, then the jaws. It also runs through the tailstock if engaged (Q3).
- **Tool entry.** B0 and B180 enter down the existing grooves: 1.15 / 0.95 mm wall clearance at B0, but only 0.48 / 0.30 at B180 (inferred; P1 measures). B90 and B270 enter on the neck side face and make their own tool-width slot.

**The mid-plane trap, shown numerically.** If the round-2 spine notch depth is taken from the mid-plane band edge (tip at u = ±25.55), the mid-kerf section still shows 4 tabs, but the B-rep has only **2** solids. The band end retreats 3 mm toward the kerf edges, so each side's corners stay joined there (diagram panel c). The notch tip must reach u = ±22.55, which is 3.5 mm past the mid-plane band edge.

**Sensitivity (reruns of the B-rep model):**

| Case | T4 smallest tab | C2 spine | Topology |
|---|---|---|---|
| Nominal | 6.0 x 4.0 | 3.0 | 4 / 2 |
| Axis ±0.15 mm (target after P1) | 5.7 x 3.7 (22.8 mm²) | 3.0-3.3 | unchanged |
| **Stored axis used for CAM** | **6.0 x 1.85 (11.1 mm²)**; another tab 4.46 wide | **0.85** | unchanged but fragile |
| Runout / oversize r_eff 3.10 / 3.25 | 5.9 x 3.9 / 5.75 x 3.75 | 2.9 / 2.75 | unchanged |
| Track Y +0.5 | topology unchanged | unchanged | but B180 enclosure-side clearance becomes 0 |

**Recommendation: T4, four 6.0 x 4.0 mm corner tabs, sawn at Y256.30.**
1. It leaves 45 % less wood to saw than C2, as four short 6 x 4 blocks, all reachable from inside the open 6 mm kerf.
2. The tabs sit on the section's extremes and over the enclosure's side walls and backplate.
3. There are four redundant connections. Stiffness is ample even for T4: roughly 16 000 N/mm in shear for the four 6 mm-long tabs, against tens of newtons of cutting force.
4. The last cut (S7) is the central web, made with all four tabs already formed.

C2 is stiffer and degrades more gracefully under registration error. But its spines land over the hollow window behind the thin end wall (H1), and it doubles the sawing. It remains the **fallback stop point**: round 1 plus S7 alone gives C2 exactly, if the round-1 inspection shows movement or cracking.

The T4 choice depends on P1 bringing the axis uncertainty to ±0.15 mm or better. With the stored axis, T4 must not run.

## Machining plan

W numbers come from today's derived model; they are regenerated from P1 before any CAM.

Common to every setup:
- Tool: the same 6 mm endmill, always machine-vertical.
- Track: Y_w 4.15 (M-Y256.30).
- Feeds: cut F600, ramp at most 5.7° (at most 1.5 mm over 15 mm), stepdown at most 1.5 mm in full-width slots. Spindle per `connectedHead` (for example M3 S12000 on the 200 W head). All subject to the operator's species and tool answers.
- Each file:
  1. `G21`, `G90`, `G54` on their own lines
  2. `G0 Z<Zc>` to machine about 322
  3. `G0 B<θ-5>`, then `G0 B<θ>` (approach from below; drop this if P1 shows backlash under 0.05°)
  4. `G0 X Y` to the entry column
  5. M3 and dwell
  6. `G0` to face + 12, then `G0` to face + 2
  7. zigzag ramped levels in the slot, with no retract between levels
  8. a clean-up pass at the final depth
  9. `G1` to face + 2, `G0 Z<Zc>`, `M5`
  No G53, G92 or G28.
- Holder sweep:
  - Nut rule P ≥ 31.3 mm, driven by S7 (tenon top + 3).
  - Longest tool length inside a tool-width slot 13.5 mm (S7), well inside the >25 mm flutes.
  - P + nut (+ nose) must clear the P2 envelope at S7's tip, PZ107.73 (`holder_clearance_output.txt`). Planned P = 50 ± 1 mm, with at least 25 mm gripped.

**Round 1 (continuous web remains; S1-S4 in order):**

| Setup | B | Tool from | Entry column (machine) | Material face, then final tip (W Z; PZ) | Levels | Travel | Removes |
|---|---|---|---|---|---|---|---|
| S1 R1-B0 band | 0 | B0 top, in the existing groove | X146.85 Y256.30 | floor +7.47, then -0.55 (PZ113.23) | 6 x 1.337 | X146.85 to 192.95 | 2445 mm³ |
| S2 R1-B180 band | 180 | B0 bottom, in the B180 groove | X191.81 Y256.30 | floor +13.57, then +5.55 (PZ119.33) | 6 x 1.337 | X191.81 to 145.71 | 2445 mm³ |
| S3 R1-B90 notch | 90 | B0 +X face | X175.90 Y256.30 | face +32.62 (measured value from P1), then +29.62 (PZ143.40) | 2 x 1.5 | X175.90 to 168.86 | 212 mm³ |
| S4 R1-B270 notch | 270 | B0 -X face | X162.76 Y256.30 | face +31.48, then +28.48 (PZ142.26) | 2 x 1.5 | X162.76 to 169.80 | 212 mm³ |

**Hold and inspection gate** (operator, camera, chip clearing): continue to T4, or stop the variant at C2.

**Round 2 (tab-forming finishing, distinct setups, inputs are S4's output):**

| Setup | B | Entry | From, then to (W Z) | Levels | Removes | Result |
|---|---|---|---|---|---|---|
| S5 R2-B270 spine break | 270 | X162.76 Y256.30 (already at B270, no rotation, but a new file) | +28.48 to +21.98 (PZ135.76) | 5 x 1.3 | 337 mm³ | -X corners separated |
| S6 R2-B90 spine break | 90 | X175.90 Y256.30 | +29.62 to +23.12 (PZ136.90) | 5 x 1.3 | 337 mm³ | +X corners separated; web now a 5th connection |
| S7 R2-B0 web break (last) | 0 | X146.85 Y256.30, descending the cleared band to +0.35 above the web top (W Z -0.35) | -0.55 to -6.05 (PZ107.73) | 4 x 1.375 | 1353 mm³ | 4 tabs |

- **B order and rotations:** 0, 180, 90, 270 | 270, 90, 0.
- **Why this order.** The top and bottom bands go first so wood stress relief is symmetric. The spines break while the central web still braces the section. The web breaks last, at the centre, with four finished tabs.
- **Removal against measured material.** Every removal lies in the measured neck between the probed floors and walls. The only unmeasured assumption, the X faces, is closed by P1. None enters the shell (Y_w ≥ 1.15).
- **Removal against the hollow interior.** It matters only for the load path (see the backing table).
- The review model `neck_cut_T4_review.FCStd` has one group per setup, S1-S7, each with its B-posed input stock, cutter sweep, output stock and tip-centre path in W. It also holds context (neck, tenon proxy, CAD under H1 and H2, axis) and the C2, T4-naive and R1 results.
- These are **review geometry**, not posted G-code.

## Release gate

Complete these in order. A failure stops the plan at that point.

1. Live state re-read clean. The probe is confirmed fitted (or swapped in), and the operator confirms nothing has moved.
2. **P1 accepted:**
   - The two Az estimates agree within 0.15 mm, and the Ax estimates within 0.15.
   - B0 top tilt at most 0.05 mm over 40 mm. If larger, the model is rotated by the measured tilt.
   - Backlash (B90 approached from 85 vs from 95) is measured. If over 0.05°, keep the -5° pre-position in every file.
   - H1 or H2 is determined.
   - Groove walls allow at least 0.3 mm on the enclosure side at the chosen track. If not, bias the track toward the tenon. If a groove is narrower than 6.6 mm, re-plan.
   - The neck faces are known (flush, or add facing).
   - Tenon tops under the nut footprint are at most PZ136.5 at B0 and B180.
   - The sweep model is rerun with the measured values and still gives 4 spanning solids with a smallest tab at least 3.5 mm.
3. **P2:** no contact above the spindle-body threshold at any B. Otherwise lengthen P, staying within the grip limit, or stop.
4. **G54:** `set_workspace_origin` readback verified. P3 contacts match the predictions within ±0.10 mm. The shell exposes no other tool-change or datum hazard.
5. **Probe-to-endmill transfer (flow A):**
   1. `run_tool_setter` probe with `accept_probe_contact` (old); spread at most 0.05.
   2. Park.
   3. Swap. The operator measures P (tip to nut face), nut OD and length, nose OD, cutter diameter and TIR at the flutes (at most 0.05, which sets r_eff in CAM).
   4. `run_tool_setter` endmill (new); spread at most 0.05.
   5. `apply_tool_length_offset`. `originOffset.z` must change by new minus old within 0.01.
   6. P ≥ 31.3 and P + nut + nose ≥ the P2 requirement.
6. **G54 recheck with the cutter:** the operator's feeler check at the B0 groove floor, work Z = 7.47 + feeler ± 0.15.
7. **CAM:**
   - One FreeCAD CAM Job per setup.
   - Model: the P1-updated stock in that B pose. Stock: the previous setup's output. Job origin: W (G54).
   - Tool: the measured diameter.
   - A post that emits G21/G90/G54 and M3/M5 and nothing else modal (no M6/G53/G92/G28).
   - The setup preamble (Zc raise, B pre-position and approach) and exit are prepended and appended as text.
8. **Independent file check**, with my own parser and sweep, not FreeCAD's preview:
   - the first move raises Z to machine at least 320
   - B words only at Zc, and XY rapids only at Zc
   - the descent column lies over the measured open groove or face
   - depths per level
   - final raise, then M5
   - The cutter plus the full holder stack is swept along the parsed path through the measured stock, tenon and jaw envelope in that pose. The removed volume must match the setup's planned removal within 2 %. There must be zero intersection with Y_w < 0.3 or with the shank above the flutes, and at least 3 mm to the nut and body.
   - Output-stock connectivity: 1 solid after S1-S4; 4 spanning solids after S7 (2 for C2).
9. `validate_gcode` for each file. Expect "work" frame, G54-only. Expect negative work Z warnings on S1/S7 (the axis-centred zero), and no out-of-travel Z.
10. `submit_gcode_job` for each setup, one at a time. Read the operator the confirm page's Frame row and the machine-resolved Z extents "if G54 is the active workspace", against the predictions (TZ = G54.z + W Z).
11. Operator preflight before each: door shut, extraction on, chips cleared from the kerf, clamps and tailstock clear.

## Remaining measurements and operator actions

1. The question batch (Q1-Q11 in the Steps).
2. P1 probe survey:
   - axis: 4 tops, B0 and B90 widths
   - B0 tilt and B90 backlash
   - B0 and B180 groove walls and floors at 2 X each
   - tenon tops and profile
   - neck side faces at B90 and B270
   - H1/H2 cavity test
3. The operator measures the chuck body OD, jaw-tip radius and chuck-face Y, plus the spindle nut and nose dimensions. P2 then runs the go/no-go envelope marches at all four B.
4. Set G54 from P1 (`set_workspace_origin`), then P3's independent check.
5. Tool change, flow A:
   1. probe on the setter
   2. park
   3. swap to the endmill at P = 50 ± 1
   4. the operator measures P, TIR, diameter and nut
   5. endmill on the setter
   6. `apply_tool_length_offset`
   7. `get_position`
6. The operator's feeler check of work Z at the B0 groove floor.
7. CAM per setup from the measured model, the independent file check and `validate_gcode`.
8. Round 1 (S1-S4), then the operator's inspection and chip clearing, then the T4-or-C2 decision.
9. Round 2 (S5-S7), then park, then the operator saws the four tabs at Y256.30 inside the kerf, supporting the enclosure. They trim the about 1.15 mm skin and tab stubs on the enclosure end by hand, to CAD length (±0.5 until the H1/H2 Y registration is known).

## Steps

1. `get_connection_status {}`
2. `get_position {}`
3. `get_stored_state {}`
4. `get_machine_profile {}`
5. `get_probe_feed_status {}`
6. `get_tool_setter_config {}`
7. `get_mcp_diagnostics {}`
8. `get_gcode_job_status {"job_id": "4a426e131af8"}`, then the same for `7685888d887d`, `f8f12d4a4b3e`, `cc6e2592ccd6`, `e185e35d0536`, `97ff89e230a5` and `b32add0404af`
9. `list_cameras {}`, then `capture_frame {}` (no motion)
10. Reply with the live-state block (motion-rules §0, a line per item, quoting the results) and ONE question message [WAIT]:
    - **Q1.** What is in the spindle now: the touch probe from 27 Sep, or the endmill?
    - **Q2.** Since 27 Sep 17:30, has anything been re-clamped, re-fitted, bumped or power-cycled?
    - **Q3.** Is the tailstock engaged on the enclosure's free end?
    - **Q4.** Endmill and holder: flute length, shank diameter, flutes, corner radius, material, collet type, nut OD and length, spindle-nose OD and height, and which head. Is P = 50 ± 1 mm OK?
    - **Q5.** Chuck body OD, largest jaw-tip radius and chuck-face Y (for P2's cross-check)?
    - **Q6.** Wood species; is the grain along the axis?
    - **Q7.** Tool-change flow A (MCP offset) or B (touchscreen wizard)? I plan A.
    - **Q8.** Please raise Settings → MCP Server → Diagnostic buffers to a 9000 job-event limit (P1 is about 5 400 events, P2 about 7 900).
    - **Q9.** Saw and blade thickness? Is an about 1.15 mm skin plus tab stubs on the enclosure end, trimmed by hand, acceptable? What is the final enclosure length?
    - **Q10.** If homing is needed, may I home? (B homes, so the stock will turn.)
    - **Q11.** Target four 6 x 4 mm corner tabs, with the option to stop at two C-shapes after round 1?

-- end turn --

11. Conditional on the answers:
    - `home {}` only on Q10's "yes" and only if not homed.
    - `restore_work_frame {"reason": "controller left in machine frame"}` if `get_position` says machine-frame.
    - If the endmill is fitted: `goto_tool_change_position` and a swap to the probe, adding one approval and one wait.
12. Stage P1 [APPROVAL]. W, T, tilt, backlash, walls, faces and cavity are all from one approval. Z values are TZ with the probe; `sensor_delay_ms` is set per transport from step 5.

    ```
    probe_program {"name": "neck axis + groove + fixture survey 2026-09-28",
     "reason": "Measure rotary axis, B tilt/backlash, groove walls, neck faces, tenon tops and enclosure orientation before choosing G54 and CAM",
     "keep_out": [{"name": "chuck jaws (step Y270.5-271 at X195 B0)", "machine": {"x0": 100, "y0": 268, "x1": 240, "y1": 342}, "clearance_z": 328}],
     "ops": [
      {"id": "r0a", "kind": "rotate_b", "b": -5, "swept_radius_mm": 60},
      {"id": "r0", "kind": "rotate_b", "b": 0, "swept_radius_mm": 60},
      {"id": "t0", "kind": "sequence", "steps": [
        {"kind": "hop", "x": 150, "y": 250.4}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "top_a", "dz": -1, "max_travel_mm": 35, "on_miss": "abort"},
        {"kind": "hop", "x": 190, "y": 250.4}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "top_b", "dz": -1, "max_travel_mm": 35, "on_miss": "abort"},
        {"kind": "hop", "x": 145, "y": 256.3}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "floor_x145", "dz": -1, "max_travel_mm": 45, "on_miss": "abort"},
        {"kind": "hop", "x": 195, "y": 256.3}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "floor_x195", "dz": -1, "max_travel_mm": 45, "on_miss": "abort"},
        {"kind": "hop", "x": 145, "y": 264}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "tenon_x145", "dz": -1, "max_travel_mm": 35, "on_miss": "continue"},
        {"kind": "hop", "x": 195, "y": 264}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "tenon_x195", "dz": -1, "max_travel_mm": 35, "on_miss": "abort"}]},
      {"id": "s0", "kind": "sequence", "steps": [
        {"kind": "hop", "x": 128, "y": 250.4}, {"kind": "descend", "z": {"from": "t0.top_a.z", "minus": 4, "between": [195, 200]}}, {"kind": "probe", "name": "west", "dx": 1, "max_travel_mm": 15},
        {"kind": "hop", "x": 212, "y": 250.4}, {"kind": "descend", "z": {"from": "t0.top_b.z", "minus": 4, "between": [195, 200]}}, {"kind": "probe", "name": "east", "dx": -1, "max_travel_mm": 15},
        {"kind": "hop", "x": 170, "y": 245}, {"kind": "descend", "z": {"from": "t0.top_a.z", "plus": 4, "between": [203, 208]}}, {"kind": "probe", "name": "cavity_test", "dz": -1, "max_travel_mm": 16, "on_miss": "continue"},
        {"kind": "hop", "x": 145, "y": 256.3}, {"kind": "descend", "z": {"from": "t0.floor_x145.z", "plus": 3, "between": [193, 197]}}, {"kind": "probe", "name": "encl_wall_x145", "dy": -1, "max_travel_mm": 5, "capture": {"label": "B0 enclosure wall X145"}},
        {"kind": "hop", "x": 145, "y": 256.3}, {"kind": "descend", "z": {"from": "t0.floor_x145.z", "plus": 3, "between": [193, 197]}}, {"kind": "probe", "name": "tenon_wall_x145", "dy": 1, "max_travel_mm": 6},
        {"kind": "hop", "x": 195, "y": 256.3}, {"kind": "descend", "z": {"from": "t0.floor_x195.z", "plus": 3, "between": [193, 197]}}, {"kind": "probe", "name": "encl_wall_x195", "dy": -1, "max_travel_mm": 5},
        {"kind": "hop", "x": 195, "y": 256.3}, {"kind": "descend", "z": {"from": "t0.floor_x195.z", "plus": 3, "between": [193, 197]}}, {"kind": "probe", "name": "tenon_wall_x195", "dy": 1, "max_travel_mm": 6, "capture": {"label": "B0 tenon wall X195"}}]},
      {"id": "p0", "kind": "surface_path", "start_x": 195, "start_y": 264, "end_x": 195, "end_y": 261, "stations": 13,
       "start_z_machine": {"from": "t0.tenon_x195.z", "plus": 2, "between": [204, 212]}, "expected_z_machine": {"from": "t0.tenon_x195.z", "between": [203, 211]},
       "hop_mode": "stepped", "hop_lift_mm": 1, "max_drop_mm": 3, "sensor_delay_ms": 50},
      {"id": "r180a", "kind": "rotate_b", "b": 175, "swept_radius_mm": 60}, {"id": "r180", "kind": "rotate_b", "b": 180, "swept_radius_mm": 60},
      {"id": "t180", "kind": "sequence", "steps": [
        {"kind": "hop", "x": 150, "y": 250.4}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "top_a", "dz": -1, "max_travel_mm": 35, "on_miss": "abort"},
        {"kind": "hop", "x": 190, "y": 250.4}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "top_b", "dz": -1, "max_travel_mm": 35, "on_miss": "abort"},
        {"kind": "hop", "x": 145, "y": 256.3}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "floor_x145", "dz": -1, "max_travel_mm": 40, "on_miss": "abort"},
        {"kind": "hop", "x": 198, "y": 256.3}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "floor_x198", "dz": -1, "max_travel_mm": 40, "on_miss": "abort"}]},
      {"id": "s180", "kind": "sequence", "on_fail": "skip", "steps": [
        {"kind": "hop", "x": 145, "y": 256.3}, {"kind": "descend", "z": {"from": "t180.floor_x145.z", "plus": 2.5, "between": [199, 203]}}, {"kind": "probe", "name": "encl_wall_x145", "dy": -1, "max_travel_mm": 5},
        {"kind": "hop", "x": 145, "y": 256.3}, {"kind": "descend", "z": {"from": "t180.floor_x145.z", "plus": 2.5, "between": [199, 203]}}, {"kind": "probe", "name": "tenon_wall_x145", "dy": 1, "max_travel_mm": 5},
        {"kind": "hop", "x": 198, "y": 256.3}, {"kind": "descend", "z": {"from": "t180.floor_x198.z", "plus": 2.5, "between": [199, 203]}}, {"kind": "probe", "name": "encl_wall_x198", "dy": -1, "max_travel_mm": 5},
        {"kind": "hop", "x": 198, "y": 256.3}, {"kind": "descend", "z": {"from": "t180.floor_x198.z", "plus": 2.5, "between": [199, 203]}}, {"kind": "probe", "name": "tenon_wall_x198", "dy": 1, "max_travel_mm": 5}]},
      {"id": "r90a", "kind": "rotate_b", "b": 85, "swept_radius_mm": 60}, {"id": "r90", "kind": "rotate_b", "b": 90, "swept_radius_mm": 60},
      {"id": "t90", "kind": "sequence", "steps": [
        {"kind": "hop", "x": 160, "y": 250.4}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "top_a", "dz": -1, "max_travel_mm": 35, "on_miss": "abort"},
        {"kind": "hop", "x": 182, "y": 250.4}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "top_b", "dz": -1, "max_travel_mm": 35, "on_miss": "abort"},
        {"kind": "hop", "x": 172.4, "y": 256.3}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "neck_face", "dz": -1, "max_travel_mm": 35, "on_miss": "continue", "capture": {"label": "B90 neck face"}},
        {"kind": "hop", "x": 172.4, "y": 264}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "tenon_side", "dz": -1, "max_travel_mm": 35, "on_miss": "continue"}]},
      {"id": "s90", "kind": "sequence", "steps": [
        {"kind": "hop", "x": 143, "y": 250.4}, {"kind": "descend", "z": {"from": "t90.top_a.z", "minus": 4, "between": [208, 218]}}, {"kind": "probe", "name": "west", "dx": 1, "max_travel_mm": 15},
        {"kind": "hop", "x": 199, "y": 250.4}, {"kind": "descend", "z": {"from": "t90.top_b.z", "minus": 4, "between": [208, 218]}}, {"kind": "probe", "name": "east", "dx": -1, "max_travel_mm": 15}]},
      {"id": "r270a", "kind": "rotate_b", "b": 265, "swept_radius_mm": 60}, {"id": "r270", "kind": "rotate_b", "b": 270, "swept_radius_mm": 60},
      {"id": "t270", "kind": "sequence", "steps": [
        {"kind": "hop", "x": 157, "y": 250.4}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "top_a", "dz": -1, "max_travel_mm": 35, "on_miss": "abort"},
        {"kind": "hop", "x": 179, "y": 250.4}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "top_b", "dz": -1, "max_travel_mm": 35, "on_miss": "abort"},
        {"kind": "hop", "x": 166.3, "y": 256.3}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "neck_face", "dz": -1, "max_travel_mm": 35, "on_miss": "continue"},
        {"kind": "hop", "x": 166.3, "y": 264}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "tenon_side", "dz": -1, "max_travel_mm": 35, "on_miss": "continue"}]},
      {"id": "r95", "kind": "rotate_b", "b": 95, "swept_radius_mm": 60}, {"id": "r90b", "kind": "rotate_b", "b": 90, "swept_radius_mm": 60},
      {"id": "t90b", "kind": "sequence", "steps": [
        {"kind": "hop", "x": 160, "y": 250.4}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "top_a_from95", "dz": -1, "max_travel_mm": 35},
        {"kind": "hop", "x": 182, "y": 250.4}, {"kind": "descend", "z": 230}, {"kind": "probe", "name": "top_b_from95", "dz": -1, "max_travel_mm": 35}]},
      {"id": "rea", "kind": "rotate_b", "b": -5, "swept_radius_mm": 60}, {"id": "re", "kind": "rotate_b", "b": 0, "swept_radius_mm": 60}]}
    ```

    Reply with one sentence and the `confirm_url` as the last line.

-- end turn --

13. `start_gcode_job {"job_id": "<P1>", "wait_for_approval_ms": 110000}` (background), then `get_gcode_job_status {"job_id": "<P1>", "wait_ms": 110000, "since_event": <next>}` until `ending`. Then offline:
    - Recompute Ax, Az (both estimates), T, W, tilt, backlash, wall Ys and yaw, neck faces and H1/H2.
    - Rerun `neck_sweep_model.py` and `holder_clearance.py` with the measured values.
    - Apply gate item 2.
14. Stage P2 [APPROVAL]. M = 328 - (107.73 + P + L_nut - 3 + 70.95), from the Q4 answers. For P 50 and nut 15, M = 87.3.

    ```
    probe_program {"name": "jaw/chuck envelope go-no-go 2026-09-28",
     "reason": "Certify the spindle-nose/body columns over the jaws at every B for the deepest cut (S7 tip PZ107.73)",
     "ops": [{"id": "env", "kind": "group", "for_b": [0, 90, 180, 270], "ops": [{"id": "env_${b}", "kind": "sequence", "steps": [
       {"kind": "hop", "x": 150, "y": 276}, {"kind": "probe", "name": "y276_x150", "dz": -1, "max_travel_mm": 87.3, "on_miss": "continue"},
       {"kind": "hop", "x": 170, "y": 276}, {"kind": "probe", "name": "y276_x170", "dz": -1, "max_travel_mm": 87.3, "on_miss": "continue"},
       {"kind": "hop", "x": 190, "y": 276}, {"kind": "probe", "name": "y276_x190", "dz": -1, "max_travel_mm": 87.3, "on_miss": "continue"},
       {"kind": "hop", "x": 150, "y": 281}, {"kind": "probe", "name": "y281_x150", "dz": -1, "max_travel_mm": 87.3, "on_miss": "continue"},
       {"kind": "hop", "x": 170, "y": 281}, {"kind": "probe", "name": "y281_x170", "dz": -1, "max_travel_mm": 87.3, "on_miss": "continue"},
       {"kind": "hop", "x": 190, "y": 281}, {"kind": "probe", "name": "y281_x190", "dz": -1, "max_travel_mm": 87.3, "on_miss": "continue"}]}]},
      {"id": "ea", "kind": "rotate_b", "b": -5}, {"id": "e", "kind": "rotate_b", "b": 0}]}
    ```

    Deliver the URL.

-- end turn --

15. `start_gcode_job {"job_id": "<P2>", "wait_for_approval_ms": 110000}`, then poll. Any contact means stop and re-plan.
16. `set_workspace_origin` [APPROVAL], staged parked at TZ328, B0, probe fitted. Values are from P1; today's estimate is shown.

    ```
    set_workspace_origin {"workspace": "G54", "origin_machine": {"x": 169.33, "y": 252.15, "z": 184.73},
     "datum_reference": "P1 <job id> 2026-09-28, touch probe fitted, B0 approached from -5. X: derived rotary axis (B90/B270 tops + B0 X faces). Y: B0 enclosure-side groove wall, tip-corrected. Z: probe TZ with tip at axis height (B90/B270 tops minus half width; cross-checked by B0/B180 tops minus half thickness). Independent check: P3",
     "reason": "One axis-centred WCS for all indexed neck setups; replaces the 27 Sep G54 of unknown tool history"}
    ```

-- end turn --

17. `start_gcode_job {"job_id": "<set>", "wait_for_approval_ms": 110000}`, then `get_position {}`. The originOffset must read back the staged XYZ.
18. Stage P3 [APPROVAL]. Descents use today's P1 contacts plus the stated margins.

    ```
    probe_program {"name": "G54 independent check 2026-09-28", "reason": "Check G54 at points not used to build it",
     "ops": [
      {"id": "a", "kind": "sequence", "steps": [
        {"kind": "hop", "x": 160, "y": 250.4}, {"kind": "descend", "z": <P1 t0.top_a + 5>}, {"kind": "probe", "name": "rim_x160", "dz": -1, "max_travel_mm": 10},
        {"kind": "hop", "x": 170, "y": 256.3}, {"kind": "descend", "z": <P1 t0.floor_x195 + 3>}, {"kind": "probe", "name": "encl_wall_x170", "dy": -1, "max_travel_mm": 5}]},
      {"id": "r175", "kind": "rotate_b", "b": 175, "swept_radius_mm": 60}, {"id": "r180", "kind": "rotate_b", "b": 180, "swept_radius_mm": 60},
      {"id": "b", "kind": "sequence", "steps": [
        {"kind": "hop", "x": 128, "y": 249.9}, {"kind": "descend", "z": <P1 t180.top_a - 4>}, {"kind": "probe", "name": "west180", "dx": 1, "max_travel_mm": 15},
        {"kind": "hop", "x": 212, "y": 249.9}, {"kind": "descend", "z": <P1 t180.top_b - 4>}, {"kind": "probe", "name": "east180", "dx": -1, "max_travel_mm": 15}]},
      {"id": "r85", "kind": "rotate_b", "b": 85, "swept_radius_mm": 60}, {"id": "r90", "kind": "rotate_b", "b": 90, "swept_radius_mm": 60},
      {"id": "c", "kind": "sequence", "steps": [
        {"kind": "hop", "x": 171, "y": 249.9}, {"kind": "descend", "z": <P1 t90.top_a + 5>}, {"kind": "probe", "name": "top90_x171", "dz": -1, "max_travel_mm": 10}]},
      {"id": "rea", "kind": "rotate_b", "b": -5, "swept_radius_mm": 60}, {"id": "re", "kind": "rotate_b", "b": 0, "swept_radius_mm": 60}]}
    ```

-- end turn --

19. `start_gcode_job {"job_id": "<P3>", "wait_for_approval_ms": 110000}`, then poll. Predicted work readings (today's model): Z +16.575, Y +1.25 (tip centre), X faces -32.625 / +31.475, Z +32.625. The tolerance is ±0.10.
20. `run_tool_setter` [APPROVAL] with the probe as the old tool:

    ```
    run_tool_setter {"bit_length_mm": 65, "accept_probe_contact": true, "reason": "Old tool = touch probe that set G54 Z (job <set>); declared low; for the probe-to-endmill transfer"}
    ```

-- end turn --

21. `start_gcode_job {"job_id": "<setter1>", "wait_for_approval_ms": 110000}`. Check spread at most 0.05 and `result.finalZ` 328.
22. `goto_tool_change_position {"reason": "Park for the manual probe-to-6 mm endmill swap"}` [APPROVAL]

-- end turn --

23. `start_gcode_job {"job_id": "<park>", "wait_for_approval_ms": 110000}`, twice (Z up, then XY).
24. The operator removes the probe, fits the endmill at P = 50 ± 1, and measures P, TIR, cutter diameter, nut OD and length, and nose OD. They confirm the probe channel reads released or disabled as they configure it [WAIT].

-- end turn --

25. `get_probe_feed_status {}`: setter and overtravel green; probe channel not triggered.
26. `run_tool_setter` [APPROVAL] with the endmill as the new tool:

    ```
    run_tool_setter {"bit_length_mm": <P - 5>, "reason": "New tool = 6 mm flat endmill, protrusion <P> mm by calipers; declared low"}
    ```

-- end turn --

27. `start_gcode_job {"job_id": "<setter2>", "wait_for_approval_ms": 110000}`. Check spread at most 0.05.
28. `apply_tool_length_offset {"reason": "Transfer G54 Z from probe (setter <setter1>) to 6 mm endmill (setter <setter2>)"}` [APPROVAL]

-- end turn --

29. `start_gcode_job {"job_id": "<offset>", "wait_for_approval_ms": 110000}`, then `get_position {}`. `originOffset.z` must have changed by new minus old.
30. Operator: a touchscreen feeler check of work Z at the B0 groove floor. Expected 7.47 + feeler thickness ± 0.15. They report the value [WAIT].

-- end turn --

31. Offline:
    - Build FreeCAD CAM Jobs S1-S7 from the measured model.
    - Post them and prepend/append the preamble and exit.
    - Run the independent parse-and-sweep check (gate item 8).
    - Run `validate_gcode {"gcode": "<S1 text>"}` and so on for each of S1-S7, and read the warnings.
32. `submit_gcode_job {"gcode": "<S1 text>", "name": "neck_S1_R1_B0_band.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]. Read the Frame row and the machine Z extents to the operator.

-- end turn --

33. `start_gcode_job {"job_id": "<S1>", "wait_for_approval_ms": 110000}`, then `get_gcode_job_status {"job_id": "<S1>", "wait_ms": 110000, "since_event": <next>}` until `ending.kind` is completed.
34. `submit_gcode_job {"gcode": "<S2 text>", "name": "neck_S2_R1_B180_band.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]

-- end turn --

35. Start and poll S2.
36. `submit_gcode_job {"gcode": "<S3 text>", "name": "neck_S3_R1_B90_notch.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]

-- end turn --

37. Start and poll S3.
38. `submit_gcode_job {"gcode": "<S4 text>", "name": "neck_S4_R1_B270_notch.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]

-- end turn --

39. Start and poll S4. Then `capture_frame {}` (qualitative).
40. Round-1 gate: the operator inspects for movement or cracks, clears chips, and chooses T4 (continue) or C2 (skip S5/S6) [WAIT].

-- end turn --

41. `submit_gcode_job {"gcode": "<S5 text>", "name": "neck_S5_R2_B270_spine.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]

-- end turn --

42. Start and poll S5.
43. `submit_gcode_job {"gcode": "<S6 text>", "name": "neck_S6_R2_B90_spine.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]

-- end turn --

44. Start and poll S6.
45. `submit_gcode_job {"gcode": "<S7 text>", "name": "neck_S7_R2_B0_web.nc", "head_type": "cnc", "frame": "work"}` [APPROVAL]

-- end turn --

46. Start and poll S7.
47. `goto_tool_change_position {"reason": "Park clear of the neck for the hand saw"}` [APPROVAL]

-- end turn --

48. `start_gcode_job {"job_id": "<park2>", "wait_for_approval_ms": 110000}`, twice.
49. With the spindle stopped and the machine idle, the operator supports the enclosure and saws the four tabs at Y256.30 inside the kerf [WAIT].

-- end turn --

Counts: logical approvals=16, literal [APPROVAL] tags=16, operator waits=5, questions=11
(Main path assumes the probe is still fitted and the machine is homed. The endmill-fitted branch adds 1 approval and 1 wait. The C2 fallback removes 2 approvals. Homing, if needed, is a direct call on Q10's answer.)
