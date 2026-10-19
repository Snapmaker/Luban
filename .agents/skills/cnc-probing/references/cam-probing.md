# CAM probing programs: `run_probing_gcode`

Read this when handling an imported or hand-written probing program, or assessing whether
planned mixed-direction stations fit the existing CAM link modes. Prefer the native surface,
wall, trace or outline procedure when it directly fits the measurement. The motion laws are
in `cnc-motion-rules`; this runner does not bypass entry-clearance or approval requirements.

`stepped` / `wall` already support local continuation between planned stations. Each G38.2 /
G38.3 cycle nevertheless retreats to its own start after contact or a continuing miss; it does
not retain the measured endpoint or dynamically branch on it. The program raises at completion,
and rotary indexing requires full clearance. Read the live schema and hardware-validation
status before choosing this route.

Pass the program text as `gcode` with a `reason`; it is **translated, never sent raw** (the
Snapmaker controller compiles G38 in but on the 3DP probe input, so a raw G38 never touches the
CNC probe):

- each `G38.2` / `G38.3` becomes a sensor-gated march to its target — the target is the travel
  limit, so post the cycles with GENEROUS travel (a short cycle silently misses, the same lesson
  as `probe_stock_outline`);
- `G38.4` / `G38.5` become a probe-away until release;
- `G0`/`G1` links follow law 2: `link_mode` `"raise"` (default; XY at the traverse height with
  guarded segmented descents), `"stepped"` (a touch-probing traverse at the programmed height) or
  `"wall"`. A stepped link heading for a TOP station (a −Z cycle) lifts `hop_lift_mm` (+Z) on
  contact and retries; a stepped link heading for a SIDE-MARCH station (a pocket wall) treats a
  contact as a WALL: back off 1 mm, retreat `hop_lift_mm` along the path just travelled (never
  +Z), record it as a `link_contact` wall point (tip centre, travel direction, the station it was
  heading for), mark that station `blocked` and continue — `"wall"` forces this on every link. A
  contact during the guarded descent at a stepped link's destination is a `blocked` station too
  (the head lifts straight back to the link height and continues), never a crash. Pass
  `top_z_machine` (a MEASURED top, never a guess): a +Z lift that would rise above it marks the
  station blocked instead of climbing out of the pocket, and a raise-mode descent contact AT the
  top (within one guarded 1 mm step) is a blocked station rather than a collision. `blocked`
  stations appear in the report with `blockedBy`, link contacts under `linkContacts` (and as extra
  CSV rows), `summary.blocked` counts them. An abort follows law 8; a nested held-contact decision remains held even if the sensor
  later releases;
- a bare `G0 B<angle>` line is a 3+2 station (raise, then the verified rotation); `B` with XYZ,
  incremental `B` and `A`/`C` are refused;
- feeds in the file are ignored; `M3`/`M4` (a spinning tool during a probe is a crash), `M0`/`M1`,
  `M6`, `G28`, `G92`, `G55`–`G59`, arcs and `#` macro variables are refused with the line number
  — fix the post, do not strip lines by hand without telling the operator.

**Wall clearance is checked at staging.** Declare every wall you have MEASURED (an earlier
program's contacts, a fitted corner arc) as `known_walls` — `{kind: "line", a, b, normal}` (the
normal points to the FREE side; the surface = tip-centre contact + tip radius along the material
side) or `{kind: "arc", center, radius, material: "outside" | "inside", from_deg?, to_deg?}`,
optional `z_top` / `z_bottom`, in the program's frame — with `wall_margin_mm` (required; the
walls' measurement uncertainty, 0–20). Every station start and every link path must keep the
tip (stored `probe_tip_diameter` / 2, refused when unset) plus the margin clear of them, or the
program is refused naming the station, the wall and the shortfall (pass 2 of 2026-09-21 parked
station 68 0.5 mm from a wall measured the day before). Walls the program's own `(PROBE nominal=
normal=)` side marches describe are checked too and only WARN (CAD intent, extent unknown).
Approach a corner arc RADIALLY from its fitted centre: each march into a known arc is reported by
its angle off the radial, and `radial_tolerance_deg` (optional) turns a larger angle into a
warning. Station plans: start ≥ tip radius + margin inside every wall, few points on straight
walls, dense in corners. The FreeCAD emitter runs the same start check with
`known_walls=` / `tip_radius=` / `wall_margin=` (`wall_clearance_issues`).

Coordinates are the CAM WCS (work frame) unless `frame: "machine"`; the work origin must be live
and reliable on the heartbeat (the tool refuses a work-frame program while the offset is
`assumed-zero`).

Metadata: put `(PROBE id=.. name=.. group=.. role=.. nominal=x,y,z normal=i,j,k tol=u,l offset=..)`
before a cycle so the report carries nominals, normals, tolerances and the surface offset; a
`(RESULTS documentid=.. modelversion=.. toolpathid=1.00001 toolpath=NAME)` comment fills the
Fusion results envelope.

**The tip convention (one, everywhere).** A recorded contact is the tip REFERENCE point: the
stylus ball's CENTRE in X/Y (the toolhead XY) and its BOTTOM in Z — `probe_effective_length` is
measured on the tool setter to the tip bottom, so a −Z contact's Z already is the surface. The
SURFACE compared with a nominal is `contact + (0, 0, r) − r·normal`: no correction on a −Z march,
one tip radius on a side march. Nominals (CAD, the emitter) are surface points in the same frame.
`report.tipConvention` spells this out; deviations need `set_probe_geometry`'s tip diameter and
are null without it. (Before #175 the radius was taken off −Z contacts too, and pass 1 of the
pocket read every top 1.25 mm low.)

Reports: `reportText` in `report_format` — `fusion` (default; Fusion "inspection results"
G800/G801 text for Inspect Surface points), `renishaw` (the Inspection Plus print-out Fusion
imports for Probe WCS / Probe Geometry — needs `group=`/`role=` (`x_minus`, `x_plus`, `y_minus`,
`y_plus`) and `feature=`/`nominal_size=`/`nominal_center=`/`tol_size=`/`tol_pos=`), `csv`, `grbl`
(`[PRB:]` lines), `json`. `get_inspection_report` re-renders a finished or aborted run in any
format; the file lands under the app data dir `mcp-inspection/`.

The repo ships a Fusion post that writes all of this: `src/server/services/mcp/docs/post/snapmaker-probing.cps`
(unverified in Fusion; review in `docs/FUSION_POST_REVIEW.md`).

**FreeCAD: do not post-process a Probe operation - emit the program from the CAD.** FreeCAD's
`Path.Op.Probe` carries no nominals, normals, tolerances or point identity, so no post can write the
`(PROBE ...)` metadata, and its trajectory is discarded by the runner anyway. Use
`src/server/services/mcp/docs/post/freecad_probe_emitter.py` inside FreeCAD (GUI console, macro, or
headless `FreeCADCmd.exe -c` on the saved `.FCStd` - the headless route never opens a dialog):
`emit_probe_program(doc, [{object, face: "FaceN", name, group, role, grid|points, inset, depth, tol}],
out.nc, frame="work"|"machine", placement=None, clearance=10, overtravel=10)`. Each face is probed
along its inward normal from `clearance` outside to `overtravel` past the CAD surface; grid samples that
fall in a hole (a rim around a window) are DROPPED with a warning, never snapped to the lip - name the
points instead. Pass the MEASURED model-to-machine `App.Placement` with `frame="machine"` for a
re-clamped part; CAD coordinates alone only ever describe the nominal. `describe(doc, spec)` is the dry
run. `run_probing_gcode` and `get_inspection_report` are still HARDWARE-UNTESTED: the first run is
three points on a known flat face, not a real inspection. The emitter is for PROBING only: a
cutting file comes from a real Path Job with a verified post and is released per
`cnc-motion-rules/references/cutting-programs.md`.
