# Internal and external thread-milling program import

`convert_thread_milling_gcode` converts Machining Doctor thread-milling output to an
explicit absolute G0/G1 program for Snapmaker. It runs offline: no connection,
origin modification, staging or motion. The source file is not modified.

Use the dedicated [cnc-thread-milling skill](../../../../../.agents/skills/cnc-thread-milling/SKILL.md)
for the agent workflow, with [cnc-motion-rules](../../../../../.agents/skills/cnc-motion-rules/SKILL.md)
loaded first. The [setup reference](../../../../../.agents/skills/cnc-thread-milling/references/setup.md)
covers cutter measurements, generator fields, internal/external preparation and
multiple-feature datums. Successful conversion is not approval of cutter geometry,
stock preparation, collision clearance or thread fit.

The supplied regression fixture is the user's Machining Doctor program: 2.53 mm
programmed major diameter, 0.45 mm pitch, 5 mm thread length, 1.38 mm cutter diameter
and 2.25 mm multi-tooth cutting length. It contains nine arcs, including three full
helical turns. Its final cutting position is work Z +0.006 mm because of the
source's rounded increments; conversion preserves that result rather than changing
it to zero. The final rapid returns to the source's work Z20.

## Usage

The same importer arguments cover internal and external threads. Thread side,
handedness, climb/conventional direction, axial forms and radial passes are encoded
in the source path; change them in the generator and reconvert.

```json
{
  "gcode": "<complete generator output>",
  "source_controller": "fanuc",
  "tool_center_path": true,
  "tool_length_applied": true,
  "spindle_mode": "cnc_200w_rpm",
  "chord_tolerance_mm": 0.002
}
```

`source_controller` accepts `fanuc` (default), `okuma`, `mazak`, `haas`,
`siemens_c`, `siemens_d`, `mitsubishi` and `mori_seiki`. These are the generator's
observed export variants, not general emulators of each controller. Okuma maps
only its standalone G15 H1 workspace selection to the target G54 origin and
removes G56/H length lookup under the tool-tip declaration. Mazak's initial T0
preselection is removed; Siemens H on G0 is removed while retaining the move.
All these transformations are reported, and a mismatched source-controller
selection refuses unfamiliar setup syntax.

For the standard CNC head, choose `spindle_mode: "power_percent"` and supply
`spindle_power_percent` (integer 1–100). This deliberately replaces source RPM;
**it does not infer a motor calibration or rescale feeds.** The caller must select
the mode from the actual head, not a historical rig note or the example above. The 200 W RPM mode keeps
the source RPM and rejects values outside the firmware's 8000–18000 range instead
of silently clamping. Material, chip load and spindle settings need to agree in
the generator before importing.

The two required declarations have specific meanings:

- `tool_center_path`: the generator has already offset the path by cutter radius
  and the Fanuc D compensation value is zero. `D1` selects register 1; it is not a
  1 mm compensation. Nonzero radius/wear compensation is not implemented.
- `tool_length_applied`: the work origin already accounts for the fitted tool tip.
  The converter removes G43/H lookup but preserves the block's inherited move,
  including the sample's initial G0 Z20. It does not apply a tool-length offset.
  Confirm which tool established work Z and which is fitted now; `originOffset`
  alone cannot establish that history. Complete the applicable
  [tool-change flow](../../../../../.agents/skills/tool-change/SKILL.md) or operator
  re-reference before declaring this true. Offline conversion cannot verify it.

Review `gcode`, `changes`, `warnings`, `sourceSpindleRpm` and `validation`. The
standard validator now sees all relative motion and full-circle bounds because
it inspects the actual emitted polygon. These are tool-centre bounds, not a swept
cutter/holder clearance calculation, and they exclude the unknown initial position.
The converter retains the source approach order and does not invent clearance.
After review, submit the returned program through `submit_gcode_job` with
`head_type: "cnc"` and `frame: "work"`; the existing approval flow applies.

## Setup and path review

Compare source headers against measured tool geometry before conversion. **Cutter
Diameter means cutting/thread-form OD, not neck or shank diameter.** In the evaluated
`M4x0.7xD4x50L` name, D4 is shank diameter and 50L overall length. Neither is usable
reach or effective multi-form cutting length. Keep flutes and axial rows separate.
A single-form thread of length 8 mm at pitch 0.7 mm nominally needs 8/0.7 ≈ 11.43
turns; inspect actual rounding and overrun. For multi-form tools, rows × pitch is
an axial-coverage sanity check; verify effective length against the tool drawing
and generator convention rather than treating it as an unconditional formula.

The supplied fixture's `CUTTER DIAM=1.38, L=2.25` must not be accepted for a cutter
described as a **1.38 mm neck with three rows**. The nominal internal orbit gives
`2 × 0.575 + 1.38 = 2.53`; the real cutting OD is unknown. Its repeated axial
positions advance 2.25 mm, whereas three rows at pitch 0.45 suggest about 1.35 mm
coverage. That mismatch risks unthreaded bands. Obtain the cutting OD and effective
length, then regenerate; keep this fixture unchanged as software regression evidence.

| Check | Internal thread | External thread |
| --- | --- | --- |
| Prepared stock | Existing bore centre, full-diameter depth and bore diameter; this export does not drill the hole. | Existing boss centre, diameter, height and shoulder/undercut; this export does not rough out the boss. |
| Access and reach | Cutter must enter the bore; neck/shank must clear throughout the orbit and withdrawal. Distinguish blind full-diameter depth from drill-point depth. | Cutter, neck, shank and holder need space around the complete boss and above its shoulder, including clamps. |
| Axial extent | Deepest actual tool position, tooth-to-tip distance and under-plate clearance for through holes. | Deepest actual tool position versus shoulder and fixture clearance. |
| Entry/exit | Into free bore space, engage the wall, disengage and withdraw. | Through free exterior space, engage the boss, disengage and withdraw. |

Read `get_machine_profile.connectedHead.toolHead`; generic `headType: "cnc"` does
not distinguish standard from 200 W, and `toolHeads` lists supported heads. Ask
if the identity is missing or ambiguous. `S17991` is within the 200 W 8000–18000
range; conversion retains it in RPM mode. Select feeds and speed together, using
the actual cutter and material, before generating.

The fixture moves XY before its first Z positioning block. Check actual starting
machine Z against the motion floor and the entire initial segment against landmarks;
source work Z20 is not machine park height. Conversion invents no approach. Verify
the intended G54 origin (the output emits G54), validate the converted text and stage
it as a CNC work-frame job, following the link-first approval handoff. Do not assert
machine-resolved bounds from the offline report alone. The confirm page resolves
machine Z for G54, and `start_gcode_job` verifies G54's offset before streaming
(see [workspaces](workspaces.md#file-review)).

## Multiple features and completion

Choose and verify [accessible work references](../../../../../.agents/skills/cnc-motion-rules/references/work-datums.md)
before removing the probe. A feature's generator coordinates must be registered to the
measured work frame, including tool-tip Z and B orientation; a live offset alone is not
physical datum evidence. Check approach, tool/holder clearance and repeatable datum access.
A common verified WCS can serve multiple indexed B operations; retain it when the mounting
and rotary registration remain valid, and use the corresponding CAM placements/post rather
than re-zeroing at each angle. Rotation can nevertheless obstruct the old zero or approach;
retain the WCS but use a separately verified entry instead of automatically returning to zero.

Generate one program per hole or boss with its XYZ datum in the existing work frame.
For example, with work zero at the plate corner, the feature at work (10,10) uses
that generator XY datum. Traversing there first does not translate an absolute
`X0 Y0` program. Neither `goto_work_origin` nor `set_landmark` sets a new work origin.
Group jobs by cutter and preserve the common datum through measured tool changes.
Do not concatenate the exports or join converted files assuming work Z20 is safe
inter-feature travel. Custom multi-feature CAM needs its own complete review.

Count one approval per feature plus the actual tool-change stages. Do not count
read-only calls, conversion or polling as approvals; distinguish conditional
branches and multiply repeated stages explicitly. The
[setup reference](../../../../../.agents/skills/cnc-thread-milling/references/setup.md)
works through six holes and two swaps, including the legitimate measurement-reuse
condition. It never substitutes stored probe length for a live setter reading.

After completion, read actual position before the next job. The documented firmware
file-job completion raises Z at the finish XY; a source work Z20 retract is not
proof of the final machine position. A stopped file job does not automatically
retract or resume. Completion is not a thread-fit measurement: use an appropriate
thread gauge; a general touch-probe circle does not certify thread profile or pitch.

## Generator option coverage

Reference: [Machining Doctor thread-milling generator](https://www.machiningdoctor.com/calculators/thread-milling-gcode-generator/).
The documented machining choices are represented by the source path; conversion
preserves them rather than generating new cutting parameters.

| Generator choice | Import behavior / verification |
| --- | --- |
| Internal / external | Preserve source centre, approach, cutting radius and retract; both covered by live and synthetic tests. |
| RH / LH, climb / conventional | Preserve G2/G3 direction and signed Z travel; all eight combinations tested using live and synthetic outputs. |
| Single tooth | Preserve continuous helical turns; nominal turn count is thread length / pitch, subject to actual source rounding and entry/exit. |
| Multi tooth, longer than thread | Preserve one full turn. |
| Multi tooth, shorter than thread | Preserve repeated approach/turn/retract and axial repositioning; exact supplied fixture plus synthetic tests. |
| Multiple radial passes | Preserve each pass and its feeds/radius; tested with both internal and external radii. |
| Dimensions, pitch, cutting length and offsets | Follow numeric XYZ/IJ values without hard-coded thread sizes; the matrix uses 0.7 mm pitch as well as the supplied 0.45 mm case. |
| Metric / inch | G20/G21 input converts to mm and mm/min; RPM remains RPM. |
| Material, feeds, entry feed and cutting conditions | Preserve source feeds; no machining recommendation or automatic feed correction. |
| Cutter flutes / axial forms | Do not infer one from the other. A three-flute cutter can still have a single axial thread form. |
| Tool-centre / zero compensation | Supported with the explicit declaration above; G40/G41/G42 and D selectors removed. |
| Nonzero controller compensation | Not implemented; known nonzero generator headers rejected even with a zero-compensation declaration. Regenerate a tool-centre path. |
| Coolant | M7/M8/M9 removed and reported; coolant is not controlled by the emitted file. |
| Tool change and length register | One initial M6 Tn removed; tool must already be fitted. Mid-program tool changes rejected. G43/H handled as above. |
| Controller selection | All eight live dropdown variants captured and tested; explicit dialect selection handles the differing setup blocks. |

The page HTML and public calculation entry point were obtained through a visible
Playwright session after HTTP/headless requests encountered Cloudflare. The form
calls a server-side generator; its backend implementation is not public page code.
Live fixtures cover all eight controller selections, the 24 machining combinations
with two radial passes, and ten further cases: precision 1–5, one/ten flutes, five
radial passes, nonzero XYZ datum and independent input/output units. They supplement
the synthetic matrix and geometry invariants rather than replacing them.

Additional form choices are accounted for as follows:

| Form control | Behavior |
| --- | --- |
| Unified UNC/UNF/UNEF or metric; standard or special size | Source dimensions and pitch carry the choice. The importer does not implement a separate thread lookup or infer a nominal diameter. |
| Input units vs program units | Only G20/G21 in the exported program determines scaling; captured mixed-unit cases verify this. |
| Precision 1–5 | All five captured outputs tested. Preserve rounded coordinates; refuse inconsistent arcs and suggest increasing precision. No promise of thread accuracy from coarse input. |
| Solid/indexable, material, cutting speed, feed per tooth, approach factor, maximum RPM | These produce source S/F values. Preserve feeds and apply the explicit spindle policy; no duplicated material database or feed recommendation. |
| Flutes 1–10; radial passes 1–5 and individual depth percentages | One/three/ten flutes and one/two/five passes exercised. Preserve the resulting speeds, feeds and radial paths. |
| Program/tool/D/H numbers | Program metadata removed, one pre-fitted tool required, D/H declarations enforced; nondefault identifiers tested. |
| XYZ datum, axial/radial safety distance and rapid feed | Preserve source coordinates, sequence and feed; nonzero datum and changed clearances tested. No invented clearance. |
| Centre/peripheral toggle | In the inspected page, the toggle did not enter the server request or change the D=0 export. Do not assume it applies compensation; nonzero compensation remains unsupported. |

The live dropdown duplicates the Siemens C-Type label; its `sd` value produces a
D-Type program. Mori Seiki's output has a blank controller-name comment. Fixtures
record these observations; `source_controller` avoids guessing from the comment.

Unsupported input includes non-XY planes, G93/G95 feed modes, R-format arcs,
absolute arc centres, macros/subroutines, canned cycles, rotary axes, workspace
changes and origin writes. They fail explicitly rather than being discarded.
Unit-system changes after feed or motion are refused.
Only G54 (or the mapped Okuma G15 H1), explicitly declared units/distance mode/G17/G94, incremental I/J and
one pre-fitted tool are accepted. M2/M30 must terminate the program.

## Firmware evidence

Checked [Snapmaker2-Controller commit 314c167b](https://github.com/Snapmaker/Snapmaker2-Controller/tree/314c167b0a1ce331d867b10abd32e00908e4aa9c).
This is the checked upstream source, not a claim about the connected machine's
installed firmware version.

- [Configuration_adv.h](https://github.com/Snapmaker/Snapmaker2-Controller/blob/314c167b0a1ce331d867b10abd32e00908e4aa9c/Marlin/Configuration_adv.h):
  ARC_SUPPORT enabled, MM_PER_ARC_SEGMENT = 1, MIN_ARC_SEGMENTS = 24;
  ARC_P_CIRCLES, CNC_WORKSPACE_PLANES and GCODE_MOTION_MODES disabled.
- [G2_G3.cpp](https://github.com/Snapmaker/Snapmaker2-Controller/blob/314c167b0a1ce331d867b10abd32e00908e4aa9c/Marlin/src/gcode/motion/G2_G3.cpp):
  supports full XY circles with omitted XY and linear Z interpolation. Native arc
  support exists, but its fixed segmentation is not the importer's tolerance.
- [Snapmaker M3-M5.cpp](https://github.com/Snapmaker/Snapmaker2-Controller/blob/314c167b0a1ce331d867b10abd32e00908e4aa9c/snapmaker/src/gcode/M3-M5.cpp):
  standard CNC uses P percent (S alone does not select RPM); 200 W CNC has separate
  P percentage and S RPM paths. M4 does not provide a CNC direction reversal here,
  so the importer refuses M4.
- [toolhead_cnc_200w.h](https://github.com/Snapmaker/Snapmaker2-Controller/blob/314c167b0a1ce331d867b10abd32e00908e4aa9c/snapmaker/src/module/toolhead_cnc_200w.h):
  RPM limits 8000 and 18000; the implementation clamps to them.
- [gcode.cpp](https://github.com/Snapmaker/Snapmaker2-Controller/blob/314c167b0a1ce331d867b10abd32e00908e4aa9c/Marlin/src/gcode/gcode.cpp):
  no Fanuc G41/G43/G94 or M6 semantics. G42 is a mesh-positioning command when that
  feature is enabled. M30 means SD file deletion when SDSUPPORT is enabled;
  SDSUPPORT is disabled in the checked configuration. It is never Fanuc program
  end here. The importer emits explicit M5 instead.

Every emitted command occupies its own block. Arcs become G1 segments with a
0.002 mm default chord tolerance, at most 10 degrees and approximately 0.25 mm per
segment. Source endpoint radius mismatch up to the smaller of 0.002 mm or 1% of radius is separately reported
and linearly blended to retain exact endpoints; larger mismatch is refused with a precision diagnostic.
Output coordinates use six decimal places. Segmentation tolerance describes
geometry, not machine accuracy. Input is capped at 2 MB and output at 200000 moves.

## Validation

The MCP suite includes the supplied export, full-circle winding/radius/pitch and
chord checks, partial helices, inch conversion, modal/compact blocks, feed/RPM
handling, the 24-case machining option matrix, parser refusal cases, live controller/option fixtures, and an offline
MCP registration test. No cutting run or machine acceptance test is performed by
these tests.
