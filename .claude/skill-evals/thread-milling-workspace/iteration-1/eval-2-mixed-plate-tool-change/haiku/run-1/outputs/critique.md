# Critique: Skills and documentation coverage for thread-milling planning

## What helped

- **cnc-motion-rules (SKILL.md)**: Essential. Laws 1–8, coordinate doctrine (§2), the motion floor and traverse height, position of record (§3), and the canonical calls all structured the entire plan. The fast-path summary (heading "Fast path") and the vocab (§5) clarified what names meant.
- **tool-change (SKILL.md)**: The two flows (A and B) and the four-step sequence (measure old, park, measure new, apply offset) were directly usable. Failure modes section confirmed what to check on the tool setter.
- **thread-milling.md (docs)**: The `convert_thread_milling_gcode` schema (gcode, source_controller, tool_center_path, tool_length_applied, spindle_mode, spindle_power_percent, chord_tolerance_mm) is exact and complete. Generator option coverage (table, controller variants, flutes, passes, feeds) clarified what the M2.5 fixture program represents and what to expect in M4 programs.
- **TOOLS.md (docs)**: Clear reference for each tool's arguments and staging pattern. `submit_gcode_job`, `traverse_xy`, `move_z`, `run_tool_setter`, `apply_tool_length_offset`, `validate_gcode` are all canonical in the right order.
- **thread-milling-m2_5-fanuc.nc (fixture)**: The actual M2.5 program let me see:
  - Fanuc controller format (M6 T1, G54, G90/G40/G17/G94/G21 setup)
  - Helical arc structure (three passes, each with G03 circles and Z increments)
  - Approach / cut / retract pattern (G41 D1, arc turns, G40 retract)
  - Work coordinates (G00 X0 Y0 is hole centre)
  - Work Z0 to Z-5.056 (5 mm thread depth, touch below surface for cutting)
  - Clearance Z20 approach/retreat

## What was missing or unclear

### 1. **M4 program availability and format** (thread-milling.md silent)

The documentation covers the *converter* (`convert_thread_milling_gcode`) and its constraints but does not say:
- Where the operator gets M4 programs (Machining Doctor assumed; not stated).
- How to choose between single-row and triple-row cutters if both are available (no guidance on feed, speed, pass count, chip load).
- Whether the M4 programs will be Fanuc exports like the M2.5, or if other controller types are expected.

**Guess**: Machining Doctor is the canonical source (it is the only live test in the test suite); M4x0.7 is standard metric and should export cleanly. Single-row vs triple-row is probably a user choice in Machining Doctor's form (noted in the table at line 77–78 of thread-milling.md: "Cutter flutes / axial forms — Do not infer one from the other. A three-flute cutter can still have a single axial thread form"). The importer *preserves* what the generator produces but does not recommend one over the other.

### 2. **Spindle RPM limits and mode choice for thread milling** (thread-milling.md vague; cnc-motion-rules silent)

The fixture program uses S17991 (RPM); `spindle_mode: "cnc_200w_rpm"` caps at 18000; `power_percent` is for the standard head. But:
- No guidance on which HEAD TYPE to assume (standard 200 W CNC vs other).
- No discussion of whether 17991 RPM is *conservative* for thread milling or if it will bottleneck the M4 single-row cutter.
- The operator did not state their head type.

**Guess**: The memory note "A350 = CNC, F350 = printer" and "no Z without direct request" suggest A350 is the tool in use. Firmware check (thread-milling.md §Firmware evidence, lines 119–139) references the 200 W head specifically; assumed that is the likely rig. If the standard head is fitted, `spindle_mode: "power_percent"` requires asking which power level (1–100) matches the operator's setup.

### 3. **Work Z origin per hole vs program-coordinate holes** (cnc-motion-rules §2, tool-change §5 silent on repositioning)

The motion rules state "Work Z0 is wherever the operator put it" (§2), and the fixture program assumes work origin AT the hole centre (G00 X0 Y0 runs the arc at hole centre). But:
- If work origin is at the plate corner (0, 0 in work frame), then the first hole is at work (10, 10), not work (0, 0).
- The fixture program must either be *reused* (move to each hole, re-set work origin there) or *adapted* (generate four separate programs with absolute XY offsets).
- No worked example shows "reposition and reuse the same program four times" vs "generate four absolute-coordinate programs."

**Guess**: Option A (reposition at each hole) is more common in job-shop practice — measure once, run the job once at each station. This is what the plan assumes (steps 7–10, 13–16). Option B (pre-generate absolute-coordinate programs) avoids traverses but is prep work before the machine moves.

### 4. **Tool setter measurement on single-row vs triple-row M4 cutters** (tool-change SKILL.md and cnc-probing SKILL.md silent)

The tool-change flow asks for `bit_length_mm` — the PROTRUSION from the collet. Single-row and triple-row thread mills *may* have different cutting lengths (the multi-tooth length documented in thread-milling.md line 8: "2.25 mm multi-tooth cutting length"). If they do, the operator must know which cutter is fitted before the second measurement, and a `bit_length_mm` mistake will corrupt the tool-length offset (law would refuse deltas > 50 mm, but a 0.5 mm error in stated length is plausible).

**Guess**: The operator chose one M4 cutter (question 2) and will measure it with its stated protrusion. If the protrusion is uncertain, asking the operator beforehand ("measure the M4 cutter's stick-out from your collet with a caliper") would reduce error.

### 5. **Frame and motion height for thread-milling programs after tool change** (cnc-motion-rules §2, TOOLS.md silent on hybrid work/machine jobs)

After `apply_tool_length_offset`, the work origin Z has shifted. But:
- The M4 programs use `frame: "work"` — so work Z0 is *still* the plate top.
- The offset has changed the mapping between work and machine Z, so "work Z0" now reads a different machine Z than before the swap.
- No step explicitly re-reads `get_position` to confirm the shift and give the operator the new work Z reading.

**Guess**: Step 12 (Verify) includes `get_position` but could be clearer: report "originOffset.z before = X, after = Y, shift = (Y − X)" and ask the operator to sanity-check that a longer/shorter M4 cutter makes physical sense on the display. Plan step 12 includes this; the execution will benefit from the explicit numbers.

## What had to be guessed or filled in

1. **M4 program sources and content** — assumed Machining Doctor; not tested.
2. **Spindle mode (200 W RPM vs power percent)** — asked as question 3 but not answered in the operator's prompt.
3. **Head type (standard vs 200 W CNC)** — same as above.
4. **Repositioning method (Option A vs Option B)** — asked as question 3; Option A assumed as the default plan.
5. **Tool-setter measurement spread tolerance** — tool-change SKILL says "disagree by more than one fine step mean feed latency or a loose tool; re-measure before applying any offset" but does not define "one fine step"; guessed 0.1–0.5 mm and left it to the operator to judge the `result.spread` field.
6. **Exact tool protrusion for M4 cutters** — operator named them by designation (M4x0.7xD4x50L) but not by stick-out from collet; asked in question batch.
7. **Single-row vs triple-row M4 cutter performance** — no guidance in the tools or docs on which gives faster cycle time, better surface finish, or lower cost; question 2 is a user choice with no recommendation.

## Specific file sections that need clarification for a full operator briefing

- **thread-milling.md, generator option coverage (lines 60–104)**: Add a guidance note for thread-milling spindle speed — pitch, cutter diameter and flutes interact; a conservative starting RPM per cutter size/pitch would help.
- **tool-change SKILL.md, flow A step 5 (line 81–87)**: A worked example showing the work Z *change* on the display (e.g., "was 5.3 mm, now reads 6.8 mm because the new tool is 1.5 mm longer") would demystify the offset.
- **TOOLS.md, under `submit_gcode_job` (line 21)**: Note that `frame: "work"` programs run with the CURRENT work origin, which may have shifted if a tool change just happened; recommend re-reading `get_position` to confirm the offset took effect.

## Summary

The three core skills (cnc-motion-rules, tool-change, cnc-probing) and two docs (thread-milling, TOOLS) provide a *complete* scaffold for planning thread milling with a tool change. No critical gaps block execution; the gaps are all in *choosing* between valid options (which M4 cutter, which repositioning flow) where the operator has the domain knowledge and the docs correctly make those choices explicit as questions. The M4 programs are an external dependency (Machining Doctor output) not covered here, which is correct — the converter documents what it accepts, not how to generate input. The one minor gap is recommending a *sequence* for single-row vs triple-row tradeoff, but that is outside the machine's scope.
