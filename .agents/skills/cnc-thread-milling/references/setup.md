# Cutter, generator and feature setup

Read this before supplying generator inputs or accepting a source program's cutter
header. The importer checks syntax and geometry, not whether the real tool matches.

## Keep the dimensions separate

| Quantity | What it controls |
| --- | --- |
| Cutting/thread-form OD | Diameter across the cutting crests; the generator's **Cutter Diameter**. Obtain it from a tool drawing or measurement. |
| Neck diameter | Clearance while inserting, orbiting and retracting; never substitute it for cutting OD. |
| Shank diameter | Collet fit and shoulder collision. In the evaluated `M4x0.7xD4x50L` designation, D4 is the 4 mm shank. Confirm vendor notation for other tools. |
| Overall length | In that designation, 50L is overall length, not reach, cutting length or collet protrusion. |
| Usable reach | Tip/active form to the larger shank or obstruction; must accommodate actual deepest travel, tooth-to-tip geometry and clearance. A 7.5 mm reach cannot provide an 8 mm thread. |
| Effective cutting length | Axial coverage of the cutting forms, used for multi-tooth configuration and axial repositioning. Separate from neck length. |
| Flutes | Circumferential cutting edges used in feed calculations; independent of the number of axial rows. |
| Protrusion | Collet-to-tip distance used for tool-setter approach bounds; not any diameter or total tool length. |

A three-row cutter at pitch 0.45 mm suggests about 3 × 0.45 = 1.35 mm axial
coverage per revolution, not 2.25 mm. Check the manufacturer's usable cutting
length and generator convention, including incomplete end teeth: rows × pitch is
an initial consistency check, not a substitute for the tool specification. Distance
between first and last crest is another measurement, not automatically the same
as effective coverage. Too large an axial reposition can leave unthreaded bands.

For a single-form cutter, nominal revolutions are thread length / pitch: 8 / 0.7
is about 11.43 turns. Check the actual export for whole-turn rounding, lead-in/out
and overrun instead of insisting on exactly 11.43 turns. A multi-form cutter with
sufficient cutting length can cut in one turn; a shorter one repeats at different
axial positions. Choose using confirmed reach/profile and allowable cutting load:
single-form generally reduces simultaneous engagement at the cost of more turns;
multi-form reduces turns but engages more forms. Do not promise a fixed force ratio
or reuse one cutter's feeds for another. No documented numeric threshold chooses
between them. Do not invent one, such as a cutting-length cutoff; give the tradeoff
and let confirmed reach, profile and load decide.

## Generator input checklist

Use the [Machining Doctor generator](https://www.machiningdoctor.com/calculators/thread-milling-gcode-generator/).
The captured form calls its cutter choice **Tooth Configuration** and its multi-form
length **Efective Length**. Labels can change; use the field's meaning.

- Thread: internal/external, standard/size or specified diameters, pitch, thread
  length, RH/LH and climb/conventional. Do not silently answer an open question
  about handedness or cutting direction with a default.
- Tool: single tooth, multi-tooth longer than thread, or multi-tooth shorter than
  thread; measured cutting OD, effective length where applicable, flute count,
  solid/indexable and compatible pitch/profile.
- Cutting conditions: material, speed/feed per tooth, actual head's RPM capability,
  radial passes/depth percentages and entry feed. Use tool data and the operator's
  setup; no universal feed, pass count, safety distance or spindle percentage.
- Output: supported controller, D=0/tool-centre path, explicit program units,
  sufficient precision, XYZ datum in the existing work frame, axial/radial safety
  distances and rapid feed. Review them rather than accepting defaults as safe.

Read `get_machine_profile.connectedHead.toolHead` for the reported module identity;
`connectedHead.headType: "cnc"` alone does not distinguish standard from 200 W.
`toolHeads` lists compatible heads, not the fitted one, and `machineSettings` is
configuration, not proof of the current attachment. If connected identity is null,
ambiguous or disagrees with the operator, ask which head is fitted. Historical README
hardware notes and this skill's RPM example do not choose the head for this job.

**The converter never chooses spindle mode, maps RPM to percent, or rescales feeds.**
`S17991` is inside 8000–18000; `cnc_200w_rpm` retains it. Percentage mode needs an
explicit selected percentage and feeds appropriate to the actual spindle speed.

## The supplied M2.5 fixture is regression evidence

The repository fixture declares `CUTTER DIAM=1.38, L=2.25 [MULTI TOOTH]`, major
2.53 mm, pitch 0.45 mm, thread length 5 mm. If the actual cutter is described as
having a **1.38 mm neck and three axial rows**, these are mismatches to resolve:

- Its nominal internal helix centre radius is 0.575 mm, and
  `2 × 0.575 + 1.38 = 2.53`. The cutting OD is built into that path. If the actual
  cutting OD is larger, this path overcuts; do not invent a typical OD or accept
  the matching neck dimension as evidence that the cutter matches.
- The source advances `0.056 + 0.45 + 0.056 + 1.688 = 2.25 mm` between successive
  axial cutting positions. That exceeds the approximately 1.35 mm coverage suggested
  by three rows at 0.45 mm pitch. Regenerate with verified cutting OD and effective
  length; do not hand-patch the helix or reuse the fixture's values for new holes.
- Its deepest point is **work Z−5.056**, final cutting point **work Z+0.006**, and
  programmed retract **work Z20**. A blind hole's quoted depth may include its drill
  point rather than full-diameter depth; a through hole also needs clearance below
  the plate for overrun and the tool. Neither “6 mm drilled” nor “5 mm plate” proves
  clearance. Include neck/shank/holder clearance at all axial positions.
- The first `G00 X0 Y0` precedes the source `G43 H1 Z20` positioning block. It moves
  XY at the actual starting height. Check the motion floor and the whole approach
  segment before running; conversion does not add a raise. Any separate Z move
  follows the motion-rules authority requirements.

These observations concern this file and the stated cutter, not all M2.5 tooling.
Keep the fixture unchanged as a parser regression case. None of its numbers (1.38,
2.25, 2.53, S17991, its feeds, work Z−5.056) may be carried into a real generator
entry, conversion call or approval count. They are what the diagnosis found wrong,
not a recipe.

## Establish the work datum before generating feature coordinates

Apply [work-datum selection and verification](../../cnc-motion-rules/references/work-datums.md).
Choose reachable probing references for the actual bore/boss and mounted stock, with verified
ball/body clearance and a reference that can survive or be transferred through the cut. A hole
centre can be derived from accessible measured features; do not insert a probe into a bore that
cannot accommodate its ball and required travel. A nominal boss centre or CAD rotary axis is not
a measured work origin.

Record how the common work frame was established, its axis/B registration and an independent
reference check while the probe is still fitted. Verify the approach to work XY zero and the
feature's full entry/exit route with the actual cutter/holder. `goto_work_origin` does not raise,
set the datum or descend to Z0. Transfer the verified tool-tip Z during the tool change; a setter
pair cannot fix an unregistered model or missing X/Y datum. Preserve a valid existing origin
rather than re-zeroing for each feature or indexed B angle. Multiple indexed operations can
share one WCS when their CAM placements/post account for the measured rotary axis and B datum.
After indexing, that zero may be obstructed even while the WCS remains valid. Do not return
to it or reuse the old entry path automatically; verify the new route or approach the feature
through a separate clear entry point in the same work frame.

## Multiple holes or bosses

A G90 program's datum is fixed in its work frame. Moving the head to another
feature does not translate the program: an unchanged `X0 Y0` returns to work zero.
`goto_work_origin` moves XY to the existing origin; it neither sets the origin nor
moves Z. `set_landmark` also does not set the work origin.

For this generator/import workflow, generate and convert **one program per feature**
with that feature's XYZ work datum. Preserve the common work origin and group jobs
by cutter. For a plate with work zero at its corner, a hole at work (10,10) needs
that generator XY datum, not a preliminary traverse followed by the (0,0) export.
Do not concatenate source programs (terminators/tool setup conflict), or join
converted files assuming work Z20 is safe inter-feature transport. A custom
multi-feature CAM program requires its own complete motion/clearance review and is
not produced by this importer.

Count one file approval per feature, plus the actual tool-change stages and any
necessary separately authorised transport. Six holes and two flow-A tool changes
normally mean 6 + 4 + 4 = 14 approvals; 13 only when the second old-tool measurement
qualifies for the documented same-tool, same-session reuse. Read-only calls,
conversion and polling do not add approvals. Count conditional branches separately.
Do not obtain a smaller total by inventing a setter reading or skipping a swap.

After each completed file job, re-read position before the next job; the documented
Snapmaker file-job completion raises at the finish XY, but the source's work Z20
alone proves nothing about actual final machine Z. A stopped job does not retract.
A completed job proves execution, not thread fit: have the operator inspect with
an appropriate thread gauge. A general touch-probe circle or a camera image does
not certify thread profile/pitch/fit. If centre measurement is needed before cutting,
first check stored probe-tip diameter against the bore and required probing travel;
never propose inserting an oversized stylus into the hole.
