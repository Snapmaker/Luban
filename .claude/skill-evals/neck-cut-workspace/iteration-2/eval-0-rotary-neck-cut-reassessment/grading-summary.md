# Grading summary: eval-0 rotary neck-cut reassessment (iteration 2)

Grader: one pass over each run's `outputs/`: plan, critique, scripts, SVGs and ledger. There were no transcripts.

- **Sonnet:** I ran `neck_geometry_check.py` from a scratch copy. I also added probes of my own: slice counts per Y, the C variant without the centre gap, and the tab-column Z profile.
- **Haiku:** its `review_fixture_plan.FCStd` is a byte-identical copy of the prior `neck_cut_fixture_plan.FCStd` (same md5), so I did not open it.
- **FreeCADCmd:** not run.
- **Skill diff:** `532c46234`.

## Pass rates

| Config | 26 assertions | A1-A20 + A22-A23 (vs it1) | it1 same subset | Tokens | Duration | Tool uses | [APPROVAL] counted / stated literal / stated logical |
|---|---|---|---|---|---|---|---|
| sonnet | **20/26** (77 %) | 17/22 | 14/22 | 265,714 | 1256 s (20.9 min) | 48 | 11 / 11 / 11 |
| haiku | **7/26** (27 %) | 6/22 | 4/22 | 112,727 | 434 s (7.2 min) | 26 | 6 / 8 / 7 |

Both runs have `run-1/timing.json`, sonnet's included. Iteration 1 used different wording for A7, A9, A11, A14 and A15, so the subset comparison is indicative only.

## The three checks you asked for

### 1. Did the runs read and apply the new skill text?

**Sonnet read and applied all four.**

- **`cutting-programs.md`:**
  - It quotes the flat-endmill sentence and models the rounding in the travel plane.
  - It follows the release route (one Path Job per visit, a real post rather than the emitter, `validate_gcode`, then an independent parse from first move to final retraction).
  - It does not apply the tip-centre wall rule: it bounds the grooves at the Y253.5 midpoints instead of the measured Y252.15 wall.
  - It does not apply the rule to subtract from the shell.
  - Its "sensitivity" shift moves the grooves and the cuts together, so it tests nothing.
- **`rotary-axis.md`:** it uses the formula, the 71.3 mm basis and the "not the CAD nominal" thickness.
- **`work-datums.md` new paragraphs:**
  - The recheck is now non-circular: it uses the B180 rim, citing the new "a contact that fed the origin cannot also verify it" line.
  - Each indexed visit is its own setup.
  - It retracts to Z328 before `goto_work_origin`.
- **Stylus reach:** it applied the 16.5 mm example, but misattributed it to `probe-inspection.md`; it lives in `cnc-probing/SKILL.md` "Stylus reach".

**Haiku did not read `rotary-axis.md`, and said so.** Its critique asks for a rotary-axis re-verification procedure, then adds: "`cnc-probing/references/rotary-axis.md` exists and was not read; it may answer this". So the file did reach it; haiku saw the link and chose not to open it.

It did read `cnc-probing/SKILL.md`:
- It quotes the jig-table row ("2026-09-05 ... 71.3 mm").
- Its `evidence_ledger.txt` borrows the stylus-reach margin, but miscomputes the limit as 21 − 1.25 − 2 = 17.8, using the radius where the rule uses the ball diameter. The plan never applies the limit.

The link placement contributed:
- In `cnc-probing/SKILL.md`, `rotary-axis.md` is linked only inline: in a jig-table cell, at the end of the Stylus-reach paragraph, and in the Programs section.
- The explicit read pointers under "Choose measurements" name only `planning.md` and `cam-probing.md`.
- `cnc-motion-rules/SKILL.md` does not link it at all; only `work-datums.md` does.

Of the other new text:
- **`cutting-programs.md`:** no evidence haiku read it. It has no independent parse and no word list, and its critique asks for a "retained-connection strategies" reference.
- **`work-datums.md` new paragraphs:** not applied. Haiku rechecks the origin on the same rim that fed it.
- **Goto-origin retract:** applied, although the brief/README say the same.
- **`tool-change`:** "Not fully read", per its critique.

### 2. Sonnet: a real 3D sweep (not extruded), and the extra centre cut for two C's

**The sweep claim is partly true.**

What is real:
- The side passes, C bites and centre slot are Minkowski dilations (`rounded_rect`) on a 0.2 mm 3D voxel grid.
- The cutter radius appears at the Y ends of travel.
- My per-slice rerun shows the piece count changing along Y: tabs 1 → 2 → 4 → 3 → 2, C 1 → 2 → 1.
- So this is not iteration 1's extruded section. The numbers reproduce exactly:

| Variant | Section left | Pieces × area |
|---|---|---|
| Tabs | 120 mm² | 4 × 30 mm² |
| C | 174 mm² | 2 × 87 mm² |
| C, r = 3.15 mm | 164 mm² | — |

What is not a real sweep:
- **The four-tab variant.** The tabs are hand-placed "exclusion notches" subtracted from a pass labelled top/bottom. In the tab column (x = −7.5, Y256) the model keeps Z9.2–15.0 and Z24.2–30.0 and removes Z15–24.2 between them. No top or bottom cutter can remove material under a retained tab, so the plan's "round 2 is B0-finish + B180-finish only" cannot be machined. It would need side passes from B90/B270. Topologically it is the C variant with deeper bites.
- **The ±0.5 mm "registration" test.** It shifts the grooves and the cuts together, so the relative geometry never changes.

Consequences:
- Nothing in the model stops the Y251–261 sweep at the measured enclosure wall (Y252.15), so it cuts ~1.15 mm past it. This is the overcut iteration 1 found in the prior agent's paths.
- The SVG draws a 6 mm spine and 8 mm legs, but the computed ones are 3 mm and 5 mm. The 4 mm gap core dilates to a 10 mm slot.

**The centre-cut claim is true for its geometry.** With the gap removed, each slice is one piece of 384 mm² (the critique says ≈337), against 2 × 87 mm² with it. But the need comes from sonnet's round-1 choice: side cuts leave a full-height 20 mm central bar, and the C's are 2 mm bites into its ends. It also depends on reading "two C" as two separate pieces, which the brief does not say (see ambiguities).

Two further problems with the centre slot ("B0 or B180, full remaining bar height"):
- It reaches 30.2 mm below the B0 top, or 27.2 mm from B180.
- At the rounded kerf ends it runs through full-height stock that has no groove.

So the 25 mm flute and the 29 mm reach are both exceeded, and sonnet did not notice (A26 fail).

### 3. Haiku: "four corner tabs cannot fit in the Y254–259 span"

**False, and it rests on a geometry misreading.**

- Haiku lays the tabs side by side along Y: "Tab width (Y) 3 mm ... Tab height (X) full width 64 mm". It then computes "Y254+3=Y257 to Y259−3=Y256 ... negative".
- But corner tabs sit at the corners of the X–Z neck section, and each one spans the kerf in Y. The Y length of the kerf does not limit how many tabs there can be.
- The Y254–259 figure is also the tip-centre floor band. Physically the walls are about 6.5–6.8 mm apart.
- Sonnet's voxel model fits four 5 × 6 mm tabs, 30 mm² each, in the same section.
- Haiku's recommendation of the C variant rests on this false infeasibility. It also puts the C's at the Y ends ("West C at Y254, East C at Y259") rather than at the X side ends, and misreads the 21.3 mm side silhouette as an X corridor, giving "side walls 21.4 mm".

## Misses per model

**Sonnet (6 misses):**
- **A5:** B is still not mapped into the WCS. There is no axis in work coordinates and no per-B face table.
- **A9:** it re-probes the jaws at B90/B270 by default and never separates the Z328 transfer rule from holder clearance.
- **A13:** the tab variant is not a cutter sweep, and the shift test is vacuous.
- **A16:** it treats the neck as solid, ignores the ball radius at the walls, and overcuts to Y251.
- **A19:** it makes the probe setter run conditional on the stored probe calibration, which the tool-change skill forbids.
- **A26:** it treats 29 mm only as a cap, with no flute/shank analysis, and misses the centre slot's reach.
- **Not graded, but a real error:** round 1 says B90 cuts the "west face". At B90 the original east face is up; sonnet's own round 2 and SVG say so.

**Haiku (19 misses):**
- **Passes only** A2, A3, A6, A7, A8, A12, A21.
- **Assumes the endmill is fitted.**
- **Converts cutter Z with the probe's 70.95 mm**, e.g. "toolhead Z≈191.1 for the cutter tip".
- **Plans `probe_point` jaw descents with the endmill fitted:** `max_travel_mm: 100`, an unsensed plunge toward the fixture. A8 passes on its wording anyway.
- **Rechecks the origin circularly.**
- **Puts B180 physical Z beside B0 values.**
- **Adopts the prior 23 mm / 9.2 / 6.2 figures and the 380 / 72.7 mm² areas.**
- **Wrong axis check:** same X at B180, a "+Z probe", ±1 mm tolerance, and `set_landmark` instead of `set_probe_geometry`.
- **Skips the old-tool setter run.**
- **Its SVG labels the removed C openings,** not retained C connections.
- **Stated approvals:** 8 literal, but 6 are present.

## Vs iteration 1: which skill edits fixed what

Sonnet's iteration-1 misses were A5, A7, A8, A10, A13, A14, A16, A20 and A21.

**Fixed:**
- **A7 and A8:** `work-datums.md` "Work zero is not a clearance move" (retract to Z328, state the traverse height) and `cnc-motion-rules/SKILL.md` §2.
- **A10:** `cnc-probing/SKILL.md` "Stylus reach". Sonnet used the 16.5 mm worked example verbatim.
- **A14:** the `cutting-programs.md` "Retained connections" bullet "radius appears in plan view and at the ends of travel, not in the section".
- **A20:** `cutting-programs.md` "Releasing a cutting file", plus `cam-probing.md` "The emitter is for PROBING only".
- **A21:** the assertion reword and the RUN_INSTRUCTIONS Steps rule. No skill edit was involved.

**Half-fixed:**
- **A5:** the circular-recheck half was fixed by `work-datums.md` "a contact that fed the origin cannot also verify it". The per-B mapping is still missing, and no edit asks for the axis to be written in work coordinates.
- **A13:** `cutting-programs.md` "Count connected solids across the whole kerf band" moved sonnet from an extruded section to a real voxel sweep. The text does not say that every removed voxel must be reachable from the named approach, and it does not say that a registration shift must move the cuts relative to the measured stock. Both gaps let the unmakeable tab model through.

**Not fixed:**
- **A16:** `cutting-programs.md` "Subtract from the measured stock ... the hollow interior of a shell ... Bound a groove from its two walls after that conversion" was read. Sonnet chose "I do not assume the neck is hollow" and bounded the grooves with the Y253.5 tip-centre midpoints.

**New sonnet misses:**
- **A9:** reworded this iteration.
- **A19:** `tool-change` was unchanged. Its step 1 already says "Stored probe calibration ... and a live tool-setter pair ... are different evidence", and sonnet still conflated them.
- **A26:** a new assertion.

**Haiku** gained A2, A7, A8 and A21 and lost A23. Its gains trace to the brief/README and the `work-datums.md` retract sentence. It did not open the two new reference files that address its largest misses (A13, A20 and A24).

## What the brief left ambiguous

1. **Whether the two C's must be separate pieces.** If they must, it is unclear which setup removes the centre. Sonnet had to add a seventh operation (a B0/B180 centre slot). The brief's "west then east" sequence names only two side visits.
2. **Which face is up at each B.** The brief fixes the B direction via the 9 mm groove but never says "at B90 the original east face is up". Both runs mislabelled the round-1 B90/B270 faces.
3. **"Corner tabs" is undefined.** Haiku placed them along Y. The brief could say "at the four corners of the X–Z neck section, each bridging the kerf in Y".
4. **Whether the neck Y band is the enclosure's end wall or separate stock.** The CAD's solid ends (local Y1–10, 2304 mm²) could be either. A16 presumes that the hollow shell matters to the cuts, and sonnet reasonably argued it does not at the neck. The real miss is that the cut passes the measured wall.
5. **The 5 mm jaw margin: which tool/holder and which B it was established for.** A9 wants it applied per B pose, not re-probed, but gives no way to check it at other B's without probing.
6. **Groove X extent.** Only X195/X198 were sampled, so full width is an assumption for every model.

## Concrete edits

- **`cnc-probing/SKILL.md`, "Choose measurements" pointer paragraph.** Add: "Before any CAM rotates about the stored axis, or before you mix readings from different B angles, read [rotary-axis](references/rotary-axis.md); it is the opposite-face check." Also add the link to `cnc-motion-rules/SKILL.md` §2, next to the rotary text.
- **`cutting-programs.md`, "Retained connections".** Add a bullet: "**Reachability.** Every voxel a pass removes must be reachable from that pass's approach. A top/bottom pass removes nothing below material it leaves in the same column; material under a retained tab is removed by a side pass at the B that faces it. A tab made by an exclusion mask on a pass that cannot reach under it is not proven."
- **`cutting-programs.md`, "Report" bullet.** Add: "The registration shift moves the CUTS relative to the measured stock, not both together. The enclosure-plus-tenon solid count is 1 by construction, so report the per-slice piece count across the kerf band."
- **`cutting-programs.md`, "Subtract from the measured stock" (worked example).** Add: "Floor contacts Y254–259 at tip-centre put the walls at ≤Y252.75 and ≥Y259.25; the measured B0 enclosure-side wall is Y252.15. Tracks 254/256/258 with r = 3 reach Y251, past that wall. Size the end tracks from the walls."
- **`cutting-programs.md` (new bullet, tool reach).** Add: "For every setup state the tip depth below the highest material the tool passes, including at the rounded ends of travel, the flute length, and which material the flute contacts. Beyond the flute only the shank may sit in an already-opened corridor."
- **`work-datums.md`, "Reuse one WCS".** Add: "Write the checked axis in work coordinates (axis work X = axis machine X − origin X; axis work Z = physical axis Z + fitted tool length − origin toolhead Z), and give a per-B table: which original face is up, and its predicted work Z. On this jig B90 puts the original east face up (the B0 groove appears on the west)."
- **`tool-change/SKILL.md` step 1.** Lead with, in bold: "**The probe's stored effective length never lets you skip measuring it on the setter.**"
- **Brief.** Add "the two C's are separate pieces; say which setup removes the material between them", the per-B face mapping, and the corner-tab definition above.
- **evals.json.**
  - A13: add "...and every removed region is reachable from the stated approach; the registration shift moves the cuts relative to the stock."
  - A23: add "...and the drawn dimensions match the computed geometry; labelled items are retained material."
  - New: "No planned cut passes the measured Y252.15 wall; groove walls are bounded with the 1.25 mm ball radius."
  - New: "The plan's B-to-face mapping agrees with the groove-shift evidence."
  - A8: add "...and no sensing procedure is planned with a non-probe tool fitted."
- **Leakage.** Haiku's critique cites "the memory note on the MCP stack" and "the memory note" for the rotary wording. The rotary wording is actually in `cnc-probing/SKILL.md`, and no plan fact depended on memory, but the run consulted the auto-memory index against RUN_INSTRUCTIONS. Disable auto-memory for eval runs.
