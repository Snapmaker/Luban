---
name: cnc-thread-milling
description: "Prepare, import and review internal or external thread-milling jobs for Snapmaker through Luban MCP. Use for Machining Doctor thread-milling exports, cutter and thread setup, conversion refusals, and staging a converted thread-milling program. Load cnc-motion-rules first for motion and coordinate rules."
---

# CNC thread milling

Read [cnc-motion-rules](../cnc-motion-rules/SKILL.md) first. It owns machine state,
coordinates, transport, work origins and the approval handoff. This skill owns the
thread-specific preparation and review; it grants no additional motion authority.

`convert_thread_milling_gcode` is an **offline importer**, not a thread generator.
It accepts the observed Machining Doctor export dialects and returns a reviewable
Snapmaker program. A request to prepare or convert a file does not request a cut.
Do not send the source controller program directly to `submit_gcode_job`.

## Establish the job

Read [the setup reference](references/setup.md) for cutter dimensions, generator
fields, the supplied M2.5 fixture traps and multiple-feature jobs. Select a
[measurable, recheckable work datum](../cnc-motion-rules/references/work-datums.md) before CAM
preparation and the probe-to-cutter swap. Feature centre coordinates and generator offsets must
be registered to that verified work frame; a CAD origin or live G54 snapshot alone is insufficient.

Use the supplied drawing, cutter specification and generator settings; batch only
the missing information into one question. Keep these with the source export:

- Internal or external thread, standard/profile, required diameter and fit, pitch,
  thread length, RH/LH, climb/conventional and material. Preserve the generator's
  programmed diameters; a nominal thread name alone is not the programmed size.
- Cutter diameter, pitch/profile compatibility, single or multiple **axial thread
  forms**, effective cutting length, reach, neck/shank dimensions and flute count.
  Three flutes do not mean three axial teeth. A short multi-form cutter may need
  repeated axial positions; do not replace its path with one helix.
- Prepared bore or boss dimensions, blind/through or shoulder conditions, feature
  centre and datum, usable depth, fixture clearance and the fitted tool's work Z.
- Radial passes, feeds (including entry), spindle/head choice, units, source
  controller, source precision and axial/radial safety distances.

The source program carries internal/external, handedness, cutting direction,
passes and cutter configuration. There are no importer flags for these choices.
Change them in the generator and reconvert; do not mirror coordinates, reverse
arcs, change Z signs or infer handedness from G2/G3 alone.

## Choose the feature review

| Internal: thread inside a prepared bore | External: thread around a prepared boss |
| --- | --- |
| Establish the existing bore diameter, centre, depth and bottom/through clearance. The thread path does not drill the starting hole. | Establish the existing boss diameter, centre, height and shoulder/undercut clearance. The thread path does not rough out the boss. |
| Check that the cutter, neck and shank fit the bore for the entire insertion and cut; verify the deepest tip position against a blind bottom. | Check space around the whole boss for the cutter, neck, shank and holder, including nearby clamps and the shoulder at the deepest pass. |
| Review approach into the bore, lead-in to the wall, every helical pass, lead-out into free bore space and the axial withdrawal. | Review approach outside the boss, lead-in to its surface, every helical pass, lead-out into free exterior space and the axial withdrawal. |
| Check actual source radii and axial coverage against the intended internal thread and tool specification. | Check actual source radii and axial coverage against the intended external thread and tool specification. |

Do not reuse an internal clearance plan for an external job. Converter bounds are
tool-centre bounds, not swept cutter/holder bounds; even a successful conversion
does not establish stock preparation, collision clearance or thread fit.

## Import and review

Read [the import reference](references/import.md) for arguments, spindle modes,
controller mapping and refusal handling before converting.

The two declarations are **truth claims about the machine now, not conversion
modes**, so the order is fixed:

- (a) review the raw export's header and source against the measured cutter
  (setup reference);
- (b) finish any tool change or reference transfer, so the cutter that will cut is
  fitted and work Z is referenced to it;
- (c) convert;
- (d) validate;
- (e) stage.

A plan that calls `convert_thread_milling_gcode` with `tool_length_applied: true`
before its own tool-change steps is wrong even if the prose says the flag means
"after the swap". With the probe fitted or the origin's tool history unknown, stop
at (a).

1. Preserve the complete source export separately. Verify zero cutter compensation
   and work Z referenced to the fitted tool tip before making the two required
   declarations. If setup is unfinished, retain the source and explain what is
   missing; do not assert a declaration merely to obtain a preview.
2. Convert offline using the actual controller selection and explicit spindle
   policy. **Feeds are never rescaled**: `power_percent` replaces the source RPM
   and nothing else, so feeds generated for a different spindle speed must be
   regenerated, not converted. Keep the returned `gcode`, `changes`, `warnings`,
   `sourceSpindleRpm`, arc/full-circle/segment counts and `validation` together.
3. Compare source and result: units, datum, first positioning moves, entry/exit,
   direction with signed Z travel, pitch per turn, repeated axial positions,
   every radial pass, feeds, spindle commands, deepest point and final retract.
   Full turns can extend past nominal thread length; rounded source endpoints
   can stop slightly above/below the intended datum. Review actual extents.
4. Resolve warnings against the specific bore/boss review above. Chord tolerance
   describes segmentation, not thread accuracy; a finer polygon cannot repair a
   coarsely rounded source. Regenerate unsuitable geometry or cutting conditions.

## Stage only when the operator requests execution

Apply the motion-rules preflight with fresh connection, position, origin and
stored-state evidence. If a probe or another cutter established the origin, use
[tool-change](../tool-change/SKILL.md) before asserting fitted-tool work Z.
The touch probe cannot stay in the spindle
for cutting. `originOffset` alone does not identify which tool established Z0;
verify the reference history. Measure an outgoing probe with
`accept_probe_contact: true`; never reconstruct a setter trigger from stored
probe length plus a remembered setter height. Use
[cnc-probing](../cnc-probing/SKILL.md) for requested missing measurements.

Prefer one established WCS across rotary angles. Multiple workspaces are frowned upon but
supported when necessary for an existing G-code job; this does not expand the converter's
input restrictions. Use the human-gated workspace tools for measured registration/selection,
then restage the job after verification. Setting an origin requires no travel to zero.
The converter emits G54. The heartbeat does not name the active workspace, so the
confirm page resolves machine Z with the live offset **on the stated condition that
it is G54's**. Before streaming, `start_gcode_job` selects G54 (no motion) and
refuses to start unless G54 reports that offset. A refused start (`ending.kind:
"workspace-unverified"`) means another workspace was active when you staged. Verify
G54's origin and tool reference, then restage. Never strip the G54 line or manually
translate work coordinates into machine coordinates. The initial machine
position is unknown to offline conversion, so review the route from the actual
position through the source's first moves. An initial XY move before the source's
first Z move must already satisfy the motion floor and landmark checks. Source
clearance is not machine park height, and conversion adds no safe approach.

Validate the exact converted text with `validate_gcode`, then stage that text via
`submit_gcode_job` with `head_type: "cnc"`, `frame: "work"` and a descriptive name.
Do not strip warnings, inject an origin change, or submit the original export.
Read the operator the confirm page's frame and machine Z extents, including their
"if G54 is the active workspace" condition. Then follow the motion-rules link-first
handoff and start/status flow (§7–§8).

A stopped file job has no automatic retract and cannot resume the interrupted
cut. Report its `ending` and establish recovery with the operator; do not restart
from an arbitrary segment or issue a blind withdrawal with the cutter engaged.
