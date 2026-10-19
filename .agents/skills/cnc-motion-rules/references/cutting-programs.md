# Cutting programs: proving the geometry and releasing the file

Read before declaring a cutting geometry (tabs, bridges, a neck left for sawing) proven, and
before a CAM cutting file — FreeCAD Path, Fusion, hand-assembled — goes to `submit_gcode_job`.
Planning guidance under `cnc-motion-rules` §7; it grants no motion authority. Probing programs
are a different pipeline: `cnc-probing/references/cam-probing.md`.

## Reconcile evidence before constructing the model

Apply [measurement evidence](measurement-evidence.md) first: recover completed surveys,
resolve conflicting axis/stock assumptions and record the registration with its measurement
sources. Reuse saved independent checks. Model/post agreement alone cannot release a cut.
The release record must bound actual engagement at every indexed first pass and later level
against measured starting stock, including uncertainty; nominal stepdown differences do not.

## Retained connections: prove them in 3D, never from a section

A tab, bridge or neck is proven only by subtracting the cutter's actual sweeps from the measured
stock and counting what is left connected. A sketch of one section proves nothing.

- **Model every pass as a solid.** Cutter radius r (plus the measured runout) swept along the
  programmed path, at its axial depth. A flat endmill's sweep has a half-cylinder of radius r at
  each end of travel in plan view and a flat bottom, so its SECTION corners are sharp; the radius
  appears in plan view and at the ends of travel, not in the section. A ball or bull-nose cutter
  rounds the section too. A slot several passes wide is the union of its passes, not one box.
- **Subtract from the measured stock, registered to the machine.** Use the as-measured outside
  faces, the existing grooves and the hollow interior of a shell — not an axis-aligned block, and
  not CAD placed by its own origin (`work-datums.md`, "Keep the model, work frame and tool
  reference distinct"). Contacts are TIP-CENTRE: a wall is the contact plus the ball radius
  toward the material, a −Z contact is the floor itself (`cam-probing.md`, tip convention).
  Bound a groove from its two walls after that conversion, not from the floor-contact band.
- **Count connected solids across the whole kerf band** (every Y of the cut, edge to edge). A
  mid-plane section, or a section extruded along the kerf (every slice identical), is not a 3D
  check: at the ends of travel the sweep retreats by r, so a notch or depth sized from the
  mid-plane band edge leaves the features joined near the kerf edges. Size the notch so the
  count is right at the edges, then confirm the count on the solid.
- **Indexed cuts are separate setups.** Each visit at a B angle, and a later finishing visit at
  the same angle, is its own setup: its input stock is the previous setup's output, and its
  toolpath is inspectable on that stock. Readings taken at another angle are in that rotated
  pose — rotate them about the MEASURED axis (`cnc-probing/references/rotary-axis.md`) before
  subtracting them in B0 coordinates.
- **Report** the number of connected solids, the smallest ligament (its minimum section, in
  mm²), the total section left to saw, where each corner radius sits, and the sensitivity: move
  the registration by its uncertainty, the axis by its check residual, r by the runout, and
  recount. A geometry whose solid count changes under those shifts is not proven. Say which cut
  the tool enters from (an existing groove or side corridor) and that the cutter, shank and
  holder clear the fixture and jaws along the whole approach at that B.

## Releasing a cutting file

`src/server/services/mcp/docs/post/freecad_probe_emitter.py` writes PROBING programs for
`run_probing_gcode`; it has no cutting role. A cutting file comes from a real Path Job (FreeCAD) or a CAM setup with a post whose
output has been read against the list below, per setup, with the measured cutter diameter, the
registered stock and the verified WCS.

**What the MCP accepts.** The validator warns; it refuses only a file that declares no frame.
Every warning is a defect of the post until explained to the operator.

| Word | Cutting file | Why |
|---|---|---|
| `G21` | required, and read the numbers as mm yourself | the validator does not inspect units; an inch file passes with extents 25.4× wrong |
| `G90` before the first move | required | motion before `G90`/`G91` runs in whatever mode is current (warned) |
| `G54` on its own line before the first move, or no selector + `frame: "work"` | one of the two | machine extents resolve "if G54 is the active workspace"; `G55`–`G59.3` leave them unresolved |
| `G0`/`G1`, `G2`/`G3` | accepted | arc extents come from endpoints only (warned) — check the arcs in your own parse |
| `M3 P<percent>` (standard head) or `M3 S<rpm>` (200 W head) … `M5` | the file owns its spindle | unmatched `M3`, or spindle-on below work Z0, is a warning to read to the operator |
| `G53` in a work-frame file, inline `G53 G0`, `G92`, `G28`, `G91` | must not appear | mixed frames, an ignored one-shot G53, an origin rewrite, a home that also turns B, unreliable extents — all warned, none refused |
| `M6`, `G43`/`G41`/`G42`, `M30` | must not appear | Fanuc semantics, warned as such; the tool is changed by `tool-change`, never by the file |
| `G38.x` | never | probing goes through `run_probing_gcode` |

Configure the post's preamble and postamble to produce this; do not strip lines by hand without
telling the operator which ones.

**`B` words in a cutting file — the truth as of 2026-09-28.** `submit_gcode_job` streams the
file's non-comment lines unchanged, and the controller accepts a `B` word on `G0`/`G1`, so an
in-file `G0 B<angle>` DOES pass through and rotates the stock: the validator only reports it
(`fourAxis`, the confirm page's "B extents" row). Nothing else happens: no raise before the turn,
no check that the swept stock clears the tool, no verification that the turn finished, and no
landmark check — file jobs are never checked against landmarks at all. The refusals of `B` with
XYZ, incremental `B` and `A`/`C` belong to `run_probing_gcode`; a cutting file gets none of them.
So either:

- **Preferred — one file per index, rotation between files with `rotate_b`.** A `probe_program`
  of `rotate_b` (absolute B, refused below the traverse height, `swept_radius_mm` for the
  tip-outside-the-cylinder check, completion verified on the chuck) plus a `capture` to record the
  pose is one click and has run on hardware (2026-09-21). This also matches the one-setup-per-visit
  rule above, and the transfer between files is `move_z` / `traverse_xy`, never the file.
- **In-file `B` only if the operator wants it**, and then: absolute mode, a bare `G0 B<angle>` line
  with no XYZ or F, reached only after a raise that resolves to the park height machine Z328 (what
  `rotate_b` demands), one index per file, and your parse proves the raise, the bare line and the
  clearance of the swept stock — the MCP will not.

**Then, in this order:**

1. `validate_gcode {gcode}` — read every warning; the Frame row must say work (declared by
   argument or by a G54 line) and the machine-resolved Z extents must be resolvable.
2. **Independent parse, first move to final retraction** — your own parser over the emitted
   text, not the CAM preview. It states, in machine Z (work Z + the verified `originOffset.z`):
   the first move (a raise to the clearance plane, and that plane's machine Z against the
   measured stock, jaws and stored landmarks — the file is not landmark-checked for you); every
   XY rapid and its height; the descent column, which must land over open material; the depth of
   every level against the measured surfaces and the shell interior; where the cutter, shank,
   nut and spindle nose come nearest the fixture at that B; the final raise and `M5`, with no
   motion after them. Sweep the cutter and holder along the parsed path through the registered
   stock; the removed volume must match the setup's planned removal.
3. Preflight and staging per `cnc-motion-rules` §7: `submit_gcode_job {gcode, name, frame:
   "work"}` unchanged; read the operator the Frame row and the machine-resolved Z extents with
   their "if G54 is active" condition; confirm URL as the last line; end the turn;
   `start_gcode_job` in the background.

A setup whose file fails any of these is not released; say which item and what measurement or
post change closes it.
