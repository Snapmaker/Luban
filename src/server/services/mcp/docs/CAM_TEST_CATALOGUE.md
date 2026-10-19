# Existing test material for a probing-gcode translator and an inspection-report renderer

Collected 2026-09-07 for `src/server/services/mcp/probeGcode.ts` (parser) and
`src/server/services/mcp/inspectionReport.ts` (renderers). Everything catalogued
here is **pre-existing public material** unless a row says otherwise; the only
files authored during this survey live in `converted-mine/` and each one names
its upstream source and the transformation applied.

Local root: `cam-tests/`. No file in the Luban-mcp repository was modified.

## What our parser accepts, restated

Accepts `G0 G1 G4 G17 G20 G21 G38.2 G38.3 G38.4 G38.5 G53 G54 G90 G91 G94 G43
G49 G40 G80`; ignores `M5 M9 M400 M114 M117 M118`; ends on `M2`/`M30`. Refuses
`M3`/`M4` (spindle), `M0`/`M1` (pause), `M6`, `G28`, `G92`, `G55`-`G59`,
`G2`/`G3`, and - the decisive one for this survey - **any line containing `#` or
`[`**, i.e. every macro variable and every expression. Structured metadata comes
from a comment `(PROBE id= name= nominal=x,y,z normal=i,j,k tol=u,l
frame=work|machine)`.

`PARSER-COMPAT.txt` in this folder is a machine-generated verdict for every
downloaded file that mentions G38, produced by a scratchpad re-implementation of
those accept/refuse rules. **Exactly one upstream file in the whole collection
runs unmodified: `adamlange/probe_surface.ngc`.** Everything else in the hobby
ecosystem is a parameterised macro, because that is what these programs are -
GUI-driven subroutines, not posted programs. That is the single most important
finding of the survey and it shapes the recommended verification set below.

Two robustness findings fell out of preparing the fixtures:

- **Nested parentheses in a comment break the comment scanner.** `splitLine`
  closes a `(` comment at the *first* `)`, so `(a (b) c)` leaves `c)` as code
  and the parser throws `unrecognised text`. LinuxCNC's own `(MSG, ...)` and
  `(DEBUG, EVAL[...])` lines do this, and so did the first draft of every header
  comment in `converted-mine/` until I flattened them.
- **Grbl jog lines appear inside real sender macros.** `openbuilds/PROBEX.PRB`
  ends with `$J=G91G21X-2F1000`; a `$` line is neither a comment nor gcode and
  currently throws. Senders strip or forward these; we should skip them.

---

## 1. Probing GCODE test programs - Grbl / Marlin / LinuxCNC / sender ecosystems

| Item | Local path | URL | Licence | Dialect | What it verifies | Runs as-is? | Expected results shipped |
|---|---|---|---|---|---|---|---|
| **adamLange `probe_surface.ngc`** - 80-point Z grid, PocketNC | `adamlange/probe_surface.ngc` | https://github.com/adamLange/probing_routines | MIT | LinuxCNC, **literal numbers only** | Long flatness/autolevel scan, `(PROBEOPEN path)` result logging, G90 absolute links, 80 cycles | **YES - the only one** | No; the result file is written by the controller |
| adamLange corner / centre / B-axis-align routines | `adamlange/probe_bottom_left_corner.ngc`, `probe_bottom_right_corner.ngc`, `center_x_on_part.ngc`, `align_b_axis*.ngc` | same | MIT | LinuxCNC, `#5063` feedback | Corner finding from three probes, using the probed Z to set the sideways probing height | No - `#`/`[ ]`, `M0`, `M70`/`M72` | No |
| adamLange probe calibration (rotate the probe 90 deg, four times, on one face) | `adamlange/probe_xy_cal_y_plus.ngc`, `probe_z_calibration.ngc`, `probe_tool_change.ngc` | same | MIT | LinuxCNC | Tip runout/offset derivation `dx,dy = (p3-p1)/2` - the cheapest real calibration procedure in the collection | No - `o...repeat`, `M0`, `#` | No, but the arithmetic *is* the assertion |
| **jpieper `pnc_probe`** - Pocket NC ID/OD centre probing | `artefacts/community/pnc_probe/ncfiles/pnc-probe-center-{id,od}.ngc`, `subroutines/pnc-probe-center.ngc`, `subroutines/pnc-probe-xyz.ngc` | https://github.com/jpieper/pnc_probe | **Apache-2.0** - the most permissive licence in the whole gcode set | LinuxCNC | Bore-centre (ID) and boss-centre (OD) finding that works in any of G54-G59.3 and in either unit system, choosing the first probing axis from the start position; sets G54 to the fitted centre. Includes the hardware design for the probe mount | No - `o<...> CALL`, `#`, and `M5` is ignored but the sub is not | No, but the README states the required start position precisely |
| **Probe Basic macro library** - 44 probing subroutines incl. round/square boss and pocket **calibration** | `probe-basic/probe_basic-master/config/probe_basic/subroutines/probe_*.ngc` | https://github.com/kcjengr/probe_basic | GPL-3.0 | LinuxCNC, NGCGUI-style subs | The canonical routine set: inside and outside corners (4 each), edges, ridges, valleys, rect/round boss and pocket, edge angle, spindle nose, and `probe_cal_*` calibration against a known boss or pocket | No - every file is `#`/`[ ]` | No numbers, but each header comment states the required start position and every argument's meaning |
| **LinuxCNC `gridprobe.ngc`** | `linuxcnc/gridprobe.ngc` | https://github.com/LinuxCNC/linuxcnc | GPL-2.0 | LinuxCNC, **G20 inches** | Grid probing with `(PROBEOPEN probe-results.txt)`; the reference implementation of serpentine grid order | No - `O...while`, `#` | Writes `probe-results.txt`, format documented (see section 3) |
| **LinuxCNC `smartprobe.ngc`** | `linuxcnc/smartprobe.ngc` | same | GPL-2.0 | LinuxCNC | Uses **G38.5 then G38.3 in a retry loop** on `#5070` to un-stick a triggered probe before each G38.2 - the only upstream file that exercises probe-away cycles | No | Writes `probe-results.ngc` as `G1 X.. Y.. Z..` lines via `(LOG,...)` |
| LinuxCNC `rectangle_probe.ngc`, `probe-hole.ngc`, `probe.ngc`, `qt_auto_probe_tool.ngc` | `linuxcnc/` | same | GPL-2.0 | LinuxCNC | Rectangle-boss probing (NGCGUI), lathe hole probing (5 cycles), a 3-axis probe sub, automatic tool-length probing via remap | No | No |
| LinuxCNC G38 spec + probe-logging spec | `linuxcnc/g-code.adoc` (G38._n_ Straight Probe), `linuxcnc/overview.adoc` (Probe Logging) | same | GPL-2.0 docs | - | **Authoritative** semantics for all four cycles, `#5061`-`#5069` results in the *work* frame, `#5070` success flag, and the documented work-to-machine conversion | - | Carries the canonical `G38.2 Z-100 F100` tool-height example |
| **CNCjs macro library** - 3-axis probe with hole, hole centre, BitSetter/tool-change | `cncjs-macros/*` (12 files) | https://github.com/cncjs/CNCjs-Macros | **No LICENSE file** - reference only, do not vendor | Grbl plus the CNCjs `%VAR` / `[expr]` preprocessor | Two-pass coarse/fine probing, hole centre from two chords, `G10 L20` zeroing, tool-length comparison between two tools | No - `%`, `[ ]`, `G10` | No |
| **gSender probing generator** (AutoZero, Block, 3D-plate routines) | `gsender/Probing.ts` | https://github.com/Sienci-Labs/gsender | GPL-3.0 | Grbl/grblHAL, mostly literal | The best real-world **G91-relative** two-pass routine; 10 cycles for XYZ AutoZero. All probe targets and hops are literal; only the `%VAR` and `G10` lines are symbolic | No as shipped - see `converted-mine/` | No |
| gSender probing UI regression test | `gsender/probing_grblHal.cy.js` | same | GPL-3.0 | Cypress | Confirms only that the UI drives a probe; contains no gcode assertions | n/a | n/a |
| **OpenBuilds CONTROL probe wizard templates** | `openbuilds/PROBEXYZ.PRB`, `PROBEX.PRB`, `PROBEY.PRB`, `PROBEZ.PRB` | https://github.com/OpenBuilds/OpenBuilds-CONTROL | GPL-3.0 | Grbl, **literal apart from three `G10` lines** | XYZ touch-plate probing on the 45x45 mm OpenBuilds XYZ Probe Plus: Z touch-off, then X edge, then Y edge, with `G4 P0.4` settling and G91/G90 flips. The closest thing to a *posted* probing program in the hobby world | Almost - delete the `G10 P0 L20` lines. `PROBEX/Y/Z.PRB` also carry grbl jog lines `$J=G91G21X-2F1000`, which we currently reject on `$` | No |
| OpenBuilds hole finder, centre finder, stock size | `openbuilds/holefinder.js`, `probev2.js`, `centercircle.js`, `find_center.txt`, `stocksize.txt` | same | GPL-3.0 | JS emitting Grbl | Bore centring and stock-size measurement; `holefinder.js` shows the literal `G38.2 X10 F50` / `G38.2 X-10 F50` chord pattern | No | No |
| **UGS hole-centre probe service** | `ugs/ProbeService.java` | https://github.com/winder/Universal-G-Code-Sender | GPL-3.0 | Grbl | An 8-cycle inside-circle routine. Uniquely, the source carries the **exact emitted gcode in trailing comments** for a stated case ("radius 25 and retract 2, G21, G54"), including `G53` recentring moves and `G49` | No (Java) - transcribed in `converted-mine/` | No |
| **ioSender probing module** | `iosender/ProbingMacros.cs`, `CenterFinderControl.xaml.cs`, `EdgeFinderControl.xaml.cs`, `HeightMap.cs` | https://github.com/terjeio/ioSender | MIT | Grbl/grblHAL | Edge and centre finders, and a height-map probe; `HeightMap.cs` also defines a **result format** (section 3) | No (C#) | No |
| **bCNC autolevel scanner** | `bcnc/CNC.py` (`class Probe`), `bcnc/ProbePage.py` | https://github.com/vlachoudis/bCNC | GPL-2.0 | Grbl | `Probe.scan()` emits **pure literal** `G0Z/G0X..Y../G38.2Z..F..` grid gcode plus `%wait`; `ProbePage.py` adds the probe camera and the centre/edge finders; `Probe.save()` defines the `.probe`/`.xyz` result formats | Its generated output does, once `%wait` is stripped - see `converted-mine/` | No |
| **FreeCAD CAM Probe operation** | `freecad/Probe.py` | https://github.com/FreeCAD/FreeCAD | LGPL-2.1+ | LinuxCNC-flavoured | Generates literal `G0` / `G38.2 Z<FinalDepth> F<VertFeed>` / `G0` grids bracketed by `(Begin Probing <file>)` ... `(PROBECLOSE)`. The only **CAM system** here whose probing output is literal by construction, and therefore the easiest third-party CAM to test against | Its output would; the generator is Python | No |
| LinuxCNC Probe Screen v2 macros | `probe-screen/xplus.ngc`, `xminus.ngc`, `yplus.ngc`, `yminus.ngc`, `probe_down.ngc`, `block_down.ngc`, `gotots.ngc`, `manual_change.ngc` | https://github.com/verser-git/probe_screen_v2 | not stated in repo | LinuxCNC plus HAL pin refs | The classic search-vel / latch / probe-vel three-move pattern, parameterised from HAL pins | No - `#<_hal[...]>` | No |
| **MillenniumOS** - G6500 bore through G6520 vise corner | `millenniumos/G6500.g`, `G6500.1.g`, `G6501.g`, `G6501.1.g`, `README.md` | https://github.com/MillenniumMachines/MillenniumOS | GPL-3.0 | **RepRapFirmware meta-gcode** (`if`, `M291`, `G6512`) - a different language | The best-documented *desktop-CNC* cycle semantics: 3-point bore fit, corner/block/vise probing, a repeat-until-converged gate, and a probe-deflection calibration on a 1-2-3 block | No, and never will | **Yes** - see section 4: `deflection = (measured - nominal)/2 >= 0`, convergence `A10 S0.01` |
| Marlin G38 reference | `marlin/G038.md` | https://github.com/MarlinFirmware/MarlinDocumentation | GPL-3.0 | Marlin | All four cycles, `X/Y/Z/F` words, `G38_PROBE_TARGET` / `G38_PROBE_AWAY` gating, default = homing feedrate | - | No coordinates given |
| **Snapmaker firmware G38** | `snapmaker/G038-firmware-notes.md` | https://snapmaker.github.io/Documentation/gcode/G038 | docs | Marlin fork | **Our own machine documents only G38.2 and G38.3** - no probe-away, probe input is the Z endstop. Our parser accepts G38.4/G38.5, which only our server-side march can honour | - | - |
| Grbl interface spec | `grbl/interface.md` (~line 403), `commands.md`, `settings.md`, `change_summary.md` | https://github.com/gnea/grbl | GPL-3.0 | Grbl | **Authoritative** `[PRB:0.000,0.000,0.000:0]` syntax including the trailing success boolean - exactly what `renderGrbl` emits | - | The doc's own literal example line |
| g2core probe report | `g2core/gcode-probes-wiki-notes.md` | https://github.com/synthetos/g2/wiki/Gcode-Probes | BSD-2 (code) | g2core JSON | A fourth controller-native result shape: `{"r":{"prb":{"e":1,"x":0,"y":0,"z":-8.804,...}}}` | - | The wiki's own example line |
| GRBL-Plotter automatic probing | `grbl-plotter/automatic-probing-notes.md` | https://github.com/svenhb/GRBL-Plotter/wiki/Automatic-probing | GPL-3.0 | Grbl | A literal **G53 machine-frame** tool-setter program - the shape our per-line G53 handling must get right | Almost - drop `G43.1 Z@PRBZ` | No |

### `converted-mine/` - six fixtures derived during this survey (explicitly not upstream)

All six pass the accept/refuse rules. None has been run on a machine.

| File | Derived from | Transformation | Cycles | Exercises |
|---|---|---|---|---|
| `openbuilds-probexyz-literal.nc` | OpenBuilds `PROBEXYZ.PRB` (GPL-3.0) | deleted the three `G10 P0 L20` lines | 3 | Z-then-X-then-Y touch plate, `G4` dwells, G91/G90 flips |
| `openbuilds-probexyz-annotated.nc` | the above | added our `(PROBE id= nominal= normal= tol=)` comments | 3 | the **only** fixture exercising `parseProbeMeta` -> deviation -> tolerance -> G800/G801 nominals end to end |
| `gsender-autozero-xyz-literal.nc` | gSender `Probing.ts`, AutoZero XYZ branch (GPL-3.0) | removed `%VAR`/`[expr]`/`G10`; `PROBE_DELAY` resolved to 0.15 s; the two run-time-computed centring moves left as comments | 10 | pure G91 relative probing, coarse+fine pairs, `G4 P0.15` |
| `ugs-hole-center-literal.nc` | UGS `ProbeService.java`, transcribed from its own trailing comments (GPL-3.0) | dropped `G10 L20`; kept upstream's `G53 X-336.29` / `Y-322.116` verbatim | 8 | bore probing, G91/G90/G53 mixed frames, the `G49` warning path |
| `bcnc-autolevel-5x4-literal.nc` | a faithful re-run of bCNC `Probe.scan()` (GPL-2.0) | `%wait` commented out; 5x4 grid over 40x30 mm, feed 60 | 20 | serpentine grid order, bCNC's 4-decimal formatting, and the "motion before any G90/G91" warning path since bCNC emits no `G21` |
| `linuxcnc-gridprobe-unrolled-inch.nc` | LinuxCNC `gridprobe.ngc` (GPL-2.0) | unrolled the O-while loops using the file's own shipped defaults | 65 | **G20 inch-to-mm conversion** and its warning, 13x5 grid |

---

## 2. Fusion 360 / HSMWorks / Inventor CAM probing and inspection samples

Per-file detail is in `fusion/NOTES.md` (the summary, the word-letter table and
the citations), `fusion/VERBATIM_EXTRACTS.md` (the quoted `.cps` source),
`fusion/subset_check_postlib.md` (a per-file parser verdict for all 28 shipped
`.nc` outputs) and `fusion/forum-samples/SOURCES.md` (provenance for every real
user-posted file, including which are byte-exact attachment downloads).

| Item | Local path | URL | Licence | Format | What it verifies | Runs as-is? | Expected results |
|---|---|---|---|---|---|---|---|
| **Autodesk inspection post sources - 23 posts** (haas, haas NG, fanuc, heidenhain, mazak, okuma, siemens-840d, hurco, brother speedio, datron next, kern, doosan mynx, grob, hermle, dmg mori, renishaw equator, plus the **results file generator**) | `fusion/autodesk-postlib/inspection-cps/*.cps` | https://cam.autodesk.com/hsmposts (catalogue: `posts/posts/posts-website.json`) | **ADSK-LSA** - proprietary; free to download and use with Fusion/HSMWorks/Inventor CAM, **not** redistributable | `.cps` JavaScript | **The authority for the G800/G801 contract.** Every post emits the nominal/measured pair through `DPRNT[...]`, with `*` as the field separator that DPRNT prints as a space | n/a | n/a |
| **`result generator probing.cps`** - Autodesk's own "Results file generator for probing and inspection", `extension = "txt"` | `fusion/autodesk-postlib/inspection-cps/result generator probing.cps` | same | same | The results `.txt` Fusion imports | **The complete file envelope, not just the point lines** - see below. Also generates synthetic deviations, so it doubles as a reference implementation for a results file with known injected error | n/a | Its `pointDeviation` / `sizeDeviation` / `angleDeviation` / `positionDeviation` properties *are* the injected expected error |
| **Autodesk post-library inspection test outputs - 13 machine posts** | `fusion/autodesk-postlib/inspection-nc/*.nc` | same | **ADSK-LSA** | Vendor-specific `.nc` | **Little, and this is worth knowing:** despite the "inspection" filenames these are all the same "Automatic test" milling benchmark part, and `grep -cE 'G38|G31 |G65|G800|G801|DPRNT'` returns **0 across all 28**. Useful only as a negative fixture set | No - `M3` on the first tool, plus `G2`/`G3` arcs, `M6`, `G28`, `G43`; the two 5.1 MB DATRON files are *simpl* source, not gcode, and `shopbot.nc` is OpenSBP | The files are the expected output of Autodesk's own post regression suite, but of *milling*, not probing |
| CAM post editor - the only Autodesk-owned openly-licensed CAM repo | `fusion/cam-posteditor/` (git clone), plus the catalogue itself at `fusion/posts.js` and `fusion/posts-website.json` (594 posts, 22 declaring `INSPECTION`) | https://github.com/Autodesk/cam-posteditor | **MIT** (ships one 2017-era `fanuc.cps`) | `.cps` + the post API reference | The post-processor API reference and one archival post. **`github.com/Autodesk/fusion360-post-processors` does not exist** - the library is served from `cam.autodesk.com/hsmposts` and downloaded post by post; the endpoints are listed in `fusion/NOTES.md` §0 | n/a | n/a |
| CAM Post Processor Training Guide | `fusion/autodesk-postlib/Post_Processor_Training_Guide.pdf` (8.6 MB) | https://cam.autodesk.com/posts/posts/guides/ | **ADSK-LSA** | PDF | The probing and inspection chapters | n/a | n/a |
| **Real Fusion inspection RESULTS files from the wild - 4 of them** | `fusion/forum-samples/13_haas_ngc_DPRNT_OUT_inspect_surface_results.txt`, `01_autodesk_forum_sinumerik840d_resultsfile.txt`, `05_kitamura_..._missing_decimals.txt`, `06_kitamura_..._g800_mislabelled_g801.txt` | Autodesk community / vendor forums (URLs in `fusion/forum-samples/SOURCES.md`) | forum posts, reference only | The results `.txt` | **The single most valuable find for `inspectionReport.ts`.** Genuine machine output: full `RESULTSFILE`/`START`/`DOCUMENTID`/`MODELVERSION`/`TOOLPATHID`/`TOOLPATH`/`G331`/`G330` header, then G800/G801 pairs. Two of the four are **known-broken** - one with missing leading decimals, one with a G800 mislabelled as G801 - so they are ready-made negative fixtures | n/a - these are report files | The files are the ground truth |
| **Real Fusion probing programs from the wild** | `fusion/forum-samples/14_linuxcnc_forum_fusion_probing_post_output.ngc`, `03_autodesk_forum_fanuc_inspect_surface_doosan_full.nc`, `04_..._haas_inspect_surface_one_point.nc`, `07_kitamura_inspect_surface_10.nc`, `08_..._11_macrovar_dprnt.nc`, `09_..._probe_wcs_angle_renishaw_macros.nc`, `11_..._haas_probe_geometry_renishaw_macros.nc`, `12_..._renishaw_equator_inspect.dmi` | same | forum posts, reference only | vendor `.nc` / `.ngc` / `.dmi` | What Fusion probing operations actually post for real machines. The LinuxCNC one is the closest public example of a Fusion post driving Grbl/LinuxCNC-style probing | No - see the caveat below | n/a |
| Autodesk docs | `fusion/autodesk-docs/` (19 files incl. `import_inspection_results.md`, `inspect_surface_reference.md`, `inspection_results_overview.md`, `kb_results_file_wrong_type.md`), `fusion/view_fanuc_inspection.html`, `fusion/view_result_generator.html` | help.autodesk.com | **CC BY-NC-SA 3.0** (stated on the pages) | HTML/MD | "Inspect Surface", "Probe WCS", the Inspection Results window reference, and why an import is rejected | n/a | n/a |

### Which Fusion operation emits what

Stated plainly by an Autodesk PM in one of the captured threads and borne out by
every sample: **Probe WCS and Probe Geometry emit `G65 P98xx` Renishaw macro
calls; only Inspect Surface emits measure moves**, and on a Fanuc-class control
those moves are **`G31` skip-signal probes reading `#5061/#5062/#5063`**, not
`G38.2`. `fusion/NOTES.md` §3 has the full `cycleType` to Renishaw macro map
(`P9811` single surface, `P9812` wall/channel/rect boss, `P9814` circular
boss/hole, `P9815`/`P9816` inner/outer corner, `P9819` PCD, `P9823` partial
circle, `P9843` plane angle, `P9832`/`P9833` probe on/off, `P9810` protected
positioning).

**`buildbotics.cps` is the one Autodesk post that emits real `G38.2`** - and its
pattern is `G0` reposition, `G91`, one single-axis `G38.2` with an F word, `G92`
to plant the offset, `G90`, retract, return to XY origin. The `G92` is the
sticking point for us: we refuse it, so the probe result has to be read out of
band. Otherwise our parser's dialect and Fusion's output do not overlap at all,
and the shared surface is the *results* file, not the program.

### The G800 / G801 contract, verbatim from the posts

From `btc haas vf-2yt.cps` (and identically in five other posts), the nominal:

```
DPRNT[G800*N<point>*X<nom>*Y<nom>*Z<nom>*I<nomI>*J<nomJ>*K<nomK>
      *O<operation:inspectSurfaceOffset>*U<operation:inspectUpperTolerance>*L<operation:inspectLowerTolerance>]
```

and the measured:

```
DPRNT[G801*N<point>*X<xMeasured>*Y<yMeasured>*Z<zMeasured>*R<probeRadius>]
```

`result generator probing.cps` writes the same two lines as plain text (no
`DPRNT`, spaces instead of `*`), with `O`, `U` and `L` **conditional** on the
parameters existing, and it computes the measured point as
`nominal + normalize(I,J,K) * (toolRadius + deviation)` with `R = toolRadius`.

**Three corrections this implies for `renderFusion`:**

1. **`O` is not the tip radius.** It is `operation:inspectSurfaceOffset`, the
   inspection operation's surface offset. The tip radius appears only as `R` on
   the G801 line. We currently put the tip radius in `O`, which will mis-state
   every nominal we hand to Fusion.
2. **The G801 point is the probe-centre point, offset from the surface along the
   normal by the tip radius** - which is what our `contactWork` already holds, so
   our G801 is right, and `R` lets the consumer back out the surface point.
3. **A bare list of G800/G801 pairs is probably not an importable file.** The
   generator wraps them in an envelope:

```
START
RESULTSFILE <job-description>-RESULTS
DOCUMENTID <document-id>
MODELVERSION <model-version>
TIMESTAMP YYMMDD HHMMSS

TOOLPATHID <toolpath id>
TOOLPATH <operation comment>
G331 N<n> A<cadEulerX> B<..> C<..> X<-cadOriginX> Y<..> Z<..>
G330 N<n> A<abcX> B<..> C<..> X0 Y0 Z0 I0 R0
G800 N1 ...
G801 N1 ...
...
END
```

`G331` carries the CAD model plane as XYZ-static Euler angles plus the negated
model origin; `G330` carries the active work-plane orientation. Both are
per-toolpath, and `END` terminates the file.

Autodesk's own help page confirms the envelope is load-bearing:
`fusion/autodesk-docs/import_inspection_results.md` (CC BY-NC-SA 3.0) says a
results file may contain "multiple sets of inspection results (marked by START)"
and that **Fusion imports only the last set** unless "Import All Results" is
checked. So `START` is the record delimiter, not decoration.

The real Haas NGC file (`fusion/forum-samples/13_...results.txt`) confirms all of
this on hardware, and adds three wrinkles no source file shows:

```
RESULTSFILE Test_Inspect_RESULTS
START
DOCUMENTID 4a24d32b-789a-4c30-a286-8a683609e60c
MODELVERSION e51e3474-5f4d-4c8c-ab1e-b96f738be16b
TOOLPATHID 12
TOOLPATH Sleeve
G331 N1 A-90. B0. C0. X0. Y1.8 Z0.
G330 N1 A0. B0. C0. X0 Y0 Z0 I0 R0
G800 N1 X-0.4394 Y0.5291 Z-0.0753 I0.63893 J-0.76927 K0. O0. U0.005 L0.005
G801 N1 X-.4187 Y.5040 Z-.0753 R.0345
```

- `RESULTSFILE` comes **before** `START` here, and there is no `TIMESTAMP` -
  a real importer therefore tolerates header reordering and omissions.
- `O0.` is zero on every point, consistent with `O` being the inspection surface
  offset rather than a tip radius; `R.0345` is the tip radius.
- **G800 and G801 use different number formatting in the same file**: the
  nominal writes `X-0.4394` and the measured writes `X-.4187`, and trailing
  `0.` appears as `0.`. A parser must accept a leading-dot number and a bare
  trailing dot.

Before claiming `renderFusion` output is importable, emit this envelope and diff
against both the result-generator output and this real Haas file.

Two more words exist that we do not emit at all:

- **`G802 N<n> DEVIATION <d>`** - an optional on-control deviation report,
  emitted only when the operation's *Out of Position* action is `stop-message`,
  with `d = sign(n . d) * |measured - nominal|`. That is exactly our
  `deviationMm`, so it is a one-line addition.
- **`G330` / `G331`** carry Euler **XYZ-static** angles; `G331`'s XYZ is the
  *negated* CAD model origin and `G330`'s is always the literal `X0 Y0 Z0 I0 R0`.

### The Renishaw printout is *also* a Fusion format

The single most useful cross-section finding of the survey:
`result generator probing.cps` shows that **Probe WCS and Probe Geometry results
are not G800/G801 at all** - Fusion's importer parses the human-readable
**Renishaw Inspection Plus print-out lines** for those:

```
-------------------------------------------------------------------
   COMPONENT NO <n>                    FEATURE NO <m>
-------------------------------------------------------------------
SIZE D<nominal>   ACTUAL <measured>   TOL <tol>   DEV <deviation>
          +++++OUT OF TOL+++++ ERROR <error>
ANG <nominal>   ACTUAL <measured>   TOL <tol>   DEV <deviation>
POSN X<nominal>   ACTUAL <measured>   TOL TP <tol>   DEV <deviation>
          +++++OUT OF POS+++++ ERROR TP <radial> RADIAL
```

So the Renishaw format in section 3 is not a *second* ecosystem - it is the other
half of Fusion's own results contract, and Autodesk's KB even warns to "add a
blank space character after all SIZE and POSN phrases". Implementing the Renishaw
renderer therefore buys us both a real second format *and* Fusion compatibility
for geometric (as opposed to surface) inspection. It is the highest-value single
change in this whole survey.

---

## 3. Inspection report standards and sample files

Detail and format anatomies: `report-formats/NOTES.md` (119 files, ~189 MB, most
of that the 174 MB NIST DMIS zip).

| Item | Local path | URL | Licence | Format | What it verifies | Mapping cost onto our point list | Expected results |
|---|---|---|---|---|---|---|---|
| **PC-DMIS-style CMM text report** - 5 genuine production reports | `report-formats/opensource/ddatainfo-conversion/{302.TXT,901.TXT,MILLING.TXT,1_SLOT.TXT,AJE3.txt}` | https://github.com/ddatainfo/conversion | **No licence** - reference only, do not redistribute | Fixed-width text: `AX NOMINAL +TOL -TOL MEAS DEV OUTTOL` | The closest real-world analogue of our own model; `DEV = MEAS - NOMINAL`, pass/fail is `OUTTOL == 0` | **Trivial** - one row per axis of one dimension; `AX` is `X|Y|Z|D|M` | Yes - real measured values with their own deviations, usable as a decoder oracle |
| **QIF Results XML** (ISO 23952) - 6 official instances plus a plan sample | `report-formats/qif/*.QIF`, `nist_QIF_Results_Sample.xml` | https://github.com/QualityInformationFramework/qif-community , https://github.com/usnistgov/QIF | **Boost Software License 1.0** (NIST file: US-Gov work) - freely vendorable | XML | The one standardised, vendorable results schema; full traceability, units with SI factors, datum reference frames, PASS/FAIL status | **Hard-ish** - nominal, tolerance and actual live in three elements joined by integer ids; deviation is not stored, you compute it | Yes - complete measured instances |
| **DMIS 5.2** (ANSI/CAM-I 105.0, ISO 22093) - NIST DMIS Test Suite 2.2.1, 78 files incl. all 53 Annex A examples | `report-formats/dmis/nist-dmis-testsuite-2.2.1/`, whole zip at `dmis/nistdmistestsuite2.2.1.zip` | https://www.nist.gov/document/nistdmistestsuite221zip | **US Government work - public domain** | `.dmi` programs; output shown inline as `$$` comments; one `.out` | The official conformance suite for the DMIS language; nominal `F(x)` vs measured `FA(x)`, tolerance `T(x)` vs evaluated `TA(x),<actual>,INTOL|OUTOL` | **Moderate** - pairing is by name, which is convenient, but feature parameters are positional lists whose meaning depends on the feature type | Yes for the language; `A.21.dmi` embeds its own expected output text |
| **Renishaw Inspection Plus printout** (DPRNT, macro O9730) | `report-formats/renishaw/renishaw-appendixG-sample-printout.txt`, `renishaw-chapter4-variable-outputs.txt`, full manual PDF | Renishaw H-2000-6222, mirrored by Haas | Renishaw copyright, redistribution restricted - reference only | Plain text, one line per measurement | The on-machine equivalent of our report: `SIZE D71.0000  ACTUAL 71.9072  TOL 0.1000  DEV 0.9072`, plus explicit out-of-tolerance banners and a true-position `ERROR ... RADIAL` line | **Trivial** - already `label nominal ACTUAL measured TOL tol DEV dev`; **the cheapest second renderer to add** | Yes - the manual's own worked printout |
| **Heidenhain TNC measuring log** (Cycles 400-431) | `report-formats/heidenhain/heidenhain_cycle421_measuring_log_EXAMPLE.txt`, `heidenhain_H_program_TCHPROBE_snippets.txt`, iTNC530 + TNC640 manuals | content.heidenhain.de | Heidenhain copyright, free download, redistribution restricted | Sectioned text (`TCHPR4xx.TXT` / `.html`) | A section-oriented rather than row-oriented report: all nominals, then all limit values, then all actuals, then all deviations; results also in Q150-Q166, Q180-Q182 | **Easy but transposed** - four blocks joined by characteristic name; limits are absolute max/min, not +/- tol | Yes - the manual's full Cycle 421 log, plus 44 real `TCH PROBE 4xx` `.H` snippets |
| Siemens Sinumerik measuring cycles (CYCLE977/978/979, log via CYCLE150) | `report-formats/siemens-fanuc-haas/siemens_CYCLE977_result_parameters_EXCERPT.txt`, full manual PDF | cache.industry.siemens.com | Siemens copyright, free download | `_OVR[]` / `_OVI[]` GUD arrays; log as TXT or CSV | Documented setpoint / actual / difference index triples per measuring variant | Easy in principle, fixed index layout per cycle | **No - documentation only.** The manual never prints a sample log and none is committed anywhere public |
| Fanuc / Haas DPRNT transport | `report-formats/siemens-fanuc-haas/DPRNT-syntax-reference.txt` | cncmacrosimulator.com, Haas KB | third-party docs | `POPEN` / `DPRNT[...]` / `PCLOS`, `#nnn[wf]` fixed-point spec | The wire format under the Renishaw printout, not a schema | n/a | Syntax and example lines only |
| Open-source CMM report parser fixtures | `report-formats/opensource/hexafe-metroliza/*.json`, `cmm_report_parser.py` | https://github.com/hexafe/metroliza | **No licence** - reference only | JSON: raw report lines paired with expected parsed rows | Someone else's expected parse of format 1, including true-position rows and `D1/D2/D3` axis sub-rows - **a ready-made test oracle** | Direct | Yes, that is the whole point of the fixtures |
| OpenCMM / cnceye | not downloaded | https://github.com/OpenCMM/opencmm , `/cnceye` | MIT | - | Nothing usable: fixtures are STL, gcode and raw sensor CSV; no inspection-report output at all | n/a | No |
| **LinuxCNC `probe-results.txt`** | spec in `linuxcnc/overview.adoc`; synthetic sample at `converted-mine/result-format-samples/linuxcnc-probe-results.txt` | https://github.com/LinuxCNC/linuxcnc | GPL-2.0 (docs) | 9 whitespace numbers per successful probe: `X Y Z A B C U V W`, **in the current work frame** | The simplest real-world point-list format there is, and the natural output of any `(PROBEOPEN)` program in section 1 | Trivial - it is our point list with the rotary axes zero-filled | Format documented; no upstream sample file exists |
| **bCNC `.probe` / `.xyz` autolevel file** | spec in `bcnc/CNC.py` `Probe.save()`; synthetic sample at `converted-mine/result-format-samples/bcnc-autolevel.probe` | https://github.com/vlachoudis/bCNC | GPL-2.0 | 3 header lines (`xmin xmax xn`, `ymin ymax yn`, `zmin zmax feed`), blank, then `x y z` rows row-major | The grid-flatness result format used across the hobby world; `.xyz` variant drops the header | Trivial for `probe_surface_grid` output | Format defined in code; no upstream sample file exists |
| **ioSender height map XML** | spec in `iosender/HeightMap.cs`; synthetic sample at `converted-mine/result-format-samples/iosender-heightmap.xml` | https://github.com/terjeio/ioSender | MIT | `<heightmap MinX MinY MaxX MaxY SizeX SizeY ZOffset>` with `<point X="i" Y="j">z</point>` on **integer grid indices** | A structured grid result format; note the indices are cell numbers, not coordinates | Trivial, but requires a regular grid | Format defined in code; no upstream sample file exists |
| LinuxCNC `(LOG,...)` gcode result file | `linuxcnc/smartprobe.ngc` | same | GPL-2.0 | A runnable gcode file of `G1 X.. Y.. Z..` lines, one per point | The cheapest interchange format of the lot: the result is itself a program | Trivial | Format shown in the program |

**Verdict on "two real-world formats beyond Fusion":** comfortably met. The
strongest pair to implement is the **Renishaw Inspection Plus printout** (a
near-identical row shape to ours, a real worked sample to diff against, and -
per section 2 - the format Fusion's own importer expects for Probe WCS and Probe
Geometry results, so it is not really "beyond Fusion" at all) and
**QIF Results XML** (the only standardised, permissively licensed schema, so it
is the one worth *emitting* for anyone downstream). The **PC-DMIS-style text
report** is the best *decoder* target because we have five genuine files plus
someone else's expected-parse fixtures.

---

## 4. Standard test artefacts and procedures

Detail, tolerance tables and the full assertion list: `artefacts/NOTES.md`
(70 files, 29 MB; 20 PDFs, 17 gcode/macro files).

| Item | Local path | URL | Licence | What it defines | Expected numbers | Usable on our machine? |
|---|---|---|---|---|---|---|
| **ISO 10360-5 probing-error tests** via NPL Good Practice Guide 42 | `artefacts/iso-10360/`, `artefacts/_snippets/` | NPL | Crown copyright, free | The 25-point hemisphere distribution (1 pole, 4 at 22.5 deg, 8 at 45 deg, 4 at 67.5 deg, 8 on the equator, each group rotated 22.5 deg) and `P_FTU = r_max - r_min` | Sphere dia 10-50 mm with certified form <= 20 % of `P_FTU,MPE`; worked `E_L = 4 + L/200` um | **Yes** - a calibration sphere and a 25-point sequence is within reach |
| **ISO 3650 gauge blocks** | `artefacts/gauge-blocks/` | ISO / secondary | table reproduced from free sources | Grade K/0/1/2 length tolerances | Grade 0 at 25 mm: **+/-0.14 um**, variation in length 0.10 um; grade 2: **+/-0.60 um** | **Yes** - the single best linear assertion, because the artefact is 5-20x tighter than any probe |
| **Ring and pin gauges** | `artefacts/gauge-blocks/` | secondary tables | free | Class XXX-ZZ metric tolerances | Class XX in the 20.96-38.35 mm band: total tolerance **0.00076 mm** | **Yes** - the strongest traceable bore/diameter assertion |
| **ISO 10791-7 M1_320 circle-diamond-square** | `artefacts/iso-10791/`, `artefacts/_snippets/` | recovered verbatim from a Renishaw white paper | Renishaw copyright (reference) | The complete 31-row target tolerance table for the machined test piece | roundness 0.020, concentricity to datum hole 0.025, central hole cylindricity 0.015, side straightness 0.015, corner hole position 0.050 mm | Structure yes, magnitudes no - these are normal-accuracy machining-centre targets; use NIST's measured 0.094-0.352 mm circularity on real parts as the realistic band |
| **ISO 230-2:1988 positioning accuracy** | `artefacts/iso-230-2/` | free copy located | as retrieved | Unidirectional/bidirectional repeatability `R`, accuracy `A`, reversal `B`; 5 approaches per direction, `k = 2.326` for `n = 5`, 20 +/- 0.5 deg C | The standard's own worked example: **A = 18.03 um, R = 13.49 um**, mean reversal -1.5 um | Procedure yes; a belt/leadscrew desktop machine will be much worse - measure, do not assume |
| **NAS 979 test piece** | `artefacts/nas979/` | NIST paper (copyright-free) | US-Gov | The circle-diamond-square geometry | **Geometry only - the tolerance table is paywalled** | Geometry yes |
| **Renishaw probe calibration** (ring gauge and datum sphere, sphere fit) | `artefacts/renishaw/TE415-machine-tool-probe-calibration.pdf` and siblings | Renishaw | Renishaw copyright, reference only | How effective tip diameter and stylus offsets are derived, and why the effective radius is smaller than the physical ball | OMP400-class 2D lobing **+/-0.25 um 2 sigma**; OMP40-2-class unidirectional **1.00 um 2 sigma** | **Yes** - the procedure transfers directly to a ring gauge on the bed |
| **MillenniumOS calibration + convergence gates** | `millenniumos/`, `artefacts/community/` | https://github.com/MillenniumMachines/MillenniumOS | GPL-3.0 | Probe-deflection derivation on a **1-2-3 block** and a repeat-probe convergence gate | `deflection = (measured - nominal)/2`, **must be >= 0**, order 0.05 mm; convergence `A10 S0.01` (10 tries, 0.01 mm); 300 then 50 mm/min, 2 mm dive | **Yes, and it is the most directly reusable** - same class of machine as ours |
| Ooznest/OpenBuilds XYZ-plate tool-radius check | `artefacts/community/` | Ooznest docs | vendor docs | Offset shift when the tool diameter changes | 6.35 mm vs 3.175 mm tool: X and Y offsets shift by exactly **1.5875 mm**; Z offset = plate thickness **8.000 mm**, plate tolerance 0.1 mm | **Yes** - a zero-cost logic check |

---

## 5. Community "probe test block" designs with gcode

| Item | Local path | URL | Licence | What it is | Gcode shipped? | Expected numbers |
|---|---|---|---|---|---|---|
| **OpenBuilds XYZ Probe Plus** (45x45 mm plate) | `openbuilds/PROBEXYZ.PRB` and the Ooznest sheet in `artefacts/community/` | https://github.com/OpenBuilds/OpenBuilds-CONTROL | GPL-3.0 | The most widely used touch plate, with the wizard program that goes with it | **Yes** - the `.PRB` templates above | Plate thickness 8.000 mm, plate tolerance 0.1 mm, and the 1.5875 mm tool-radius shift |
| Carbide 3D BitZero V2 | `artefacts/community/` | guides.carbide3d.com | vendor docs | The Shapeoko equivalent plate; geometry documented | No - Carbide Motion is closed and emits no user-visible probing gcode | Plate geometry only |
| gSender AutoZero plate | `gsender/Probing.ts`, `converted-mine/gsender-autozero-xyz-literal.nc` | https://github.com/Sienci-Labs/gsender | GPL-3.0 | The Sienci plate; the 13 mm step-off and the two-pass feeds are the plate's geometry expressed in the program | **Yes**, in the generator | No dimensioned drawing found |
| `hausen8/EasyProbe` | identified, not downloaded | https://github.com/hausen8/EasyProbe | GPL-3.0 | LinuxCNC Axis probe panel that calibrates against a **ring gauge of known diameter**, storing per-angle radius deviation in the tool table | Yes (panel macros) | User-supplied ring-gauge certificate |
| 1-2-3 block as the community's actual artefact | `millenniumos/`, `artefacts/community/` | - | - | The de-facto test block: 25.4 / 50.8 / 76.2 mm, squareness ~ +/-0.0003 in/in | Yes, via MillenniumOS block probing | 25.4 / 50.8 / 76.2 mm; squareness **0.0076 mm over 25.4 mm** |

**Plainly: no community "probe test block" exists that ships a model with
published nominal feature sizes *plus* a matching probing program.** Thingiverse,
Printables, GitHub, OpenBuilds, Shapeoko, MPCNC and Millennium Machines were all
searched; every hit was a *probe* (the instrument) or a *touch plate*, never a
certified artefact. The community's answer to "what do I check my probe against"
is a 1-2-3 block, a ring gauge, or a gauge block. If we want a millable test
block with declared nominals we will have to design it, and it should be
described as ours.

---

## Recommended verification set

Ten items, in the order they should be run. The first six are pure software and
cost nothing; the last four need hardware and an artefact.

### Software, no machine

1. **`adamlange/probe_surface.ngc` - the only unmodified upstream program.**
   Parse it. Assert: no throw, no warnings, `probeCount == 80`, `steps` contains
   exactly 80 `probe` steps and 161 `move` steps, every probe target is
   `Z = -1 mm` converted to machine frame, and `end` equals the final `G0 Z1`
   position. This is the regression test that says "we can read a real
   third-party probing program".

2. **`converted-mine/linuxcnc-gridprobe-unrolled-inch.nc` - the inch path.**
   Assert: `probeCount == 65`; a warning naming G20 on the `G20` line; the first
   probe target Z equals `-0.5 in x 25.4 = -12.700 mm` in work terms; the X step
   between the first two probes is `0.25 in = 6.350 mm`; and the row order
   alternates direction (probe 13 and probe 14 share an X). Inch conversion is
   the single easiest thing to get silently wrong.

3. **`converted-mine/bcnc-autolevel-5x4-literal.nc` - the grid, and the missing
   distance mode.** Assert: `probeCount == 20`; a warning about motion before
   any G90/G91 is *not* raised, because the file I generated adds `G90 G21`
   explicitly - so also parse the same file with those two lines removed and
   assert the warning *is* raised and absolute is assumed. Assert the 20 probe
   XY positions form a 5x4 grid on 10 mm x 10 mm pitch over 40 x 30 mm, in
   serpentine order.

4. **`converted-mine/ugs-hole-center-literal.nc` - mixed frames.** Assert:
   `probeCount == 8`; the two `G53 G0` links land at machine X `-336.290` and
   machine Y `-322.116` **regardless of the work-origin offset** passed in
   `ParseOptions`; the interleaved `G91` probes are relative to the position of
   record after each link; and the `G49` line produces the tool-length-ignored
   warning rather than a throw. Frame handling is where a probing translator
   actually kills a probe.

5. **`converted-mine/openbuilds-probexyz-annotated.nc` - metadata to report,
   end to end.** Parse, simulate three contacts at known positions, then render
   all four report formats. Assert: `renderFusion` emits three `G800` lines with
   `I J K` equal to the stated normals `(0,0,1)`, `(-1,0,0)`, `(0,-1,0)` and
   `U`/`L` equal to `0.050`; three `G801` lines follow with the work-frame
   contacts; a simulated *miss* on probe 2 drops only its `G801` and leaves the
   `G800`; `renderCsv` reports `deviation_mm` signed along the normal and
   `within_tolerance` false when the deviation exceeds 0.050; `renderGrbl` emits
   `[PRB:...:0]` for the miss. Also feed it the *unannotated* twin and assert
   the nominal falls back to the programmed target and the normal to the reverse
   of the probe direction. **Then assert against Autodesk's own contract, not
   ours:** `O` must be the inspection surface offset (0 when we have none), not
   the tip radius; and the file must carry the
   `START / RESULTSFILE / DOCUMENTID / MODELVERSION / TIMESTAMP / TOOLPATHID /
   TOOLPATH / G331 / G330 / ... / END` envelope that
   `fusion/autodesk-postlib/inspection-cps/result generator probing.cps` writes.
   Diff our output against `fusion/forum-samples/13_haas_ngc_DPRNT_OUT_inspect_surface_results.txt`,
   a genuine machine-written results file; two of the three findings in
   section 2 are outright bugs in `renderFusion` today. And if we ever write an
   importer, `fusion/forum-samples/05_..._missing_decimals.txt` and
   `06_..._g800_mislabelled_g801.txt` are two real broken files to reject
   loudly.

6. **Refusal set - assert we say no, with the right message.** Take, unmodified:
   `probe-basic/.../probe_round_pocket.ngc` (macro variables), `cncjs-macros/Hole_Center.macro`
   (`%VAR` and `[expr]`), `cncjs-macros/Precision_ToolChange_Macro.txt` (also
   `M6`), `linuxcnc/gridprobe.ngc` (O-words), `openbuilds/PROBEX.PRB` (a `$J=`
   jog line), `fusion/autodesk-postlib/inspection-nc/fanuc inspection.nc`
   (`M3`, `M6`, `G28`, arcs). Assert each throws a `ProbeGcodeError` on the
   expected line with the expected reason. Then decide the two open questions
   this raises: **skip `$` lines instead of throwing**, and **fix the nested-paren
   comment bug** so `(MSG, do (this))` does not become unrecognised text.

### On the machine, with an artefact

7. **Ring gauge - fitted bore diameter.** Run the UGS/OpenBuilds bore routine on
   a class-XX master ring gauge, nominal 25.000 mm. Assert
   `|fitted_diameter - certified_diameter| <= 2 x probe_2D_lobing + gauge_tol`,
   i.e. **<= 0.0013 mm** with an OMP400-class probe, **<= 0.0028 mm** with a
   kinematic probe. Separately assert the fitted centre repeats across runs
   within the unidirectional repeatability, and that the ID-versus-OD diameter
   difference equals exactly `2 x effective tip radius` - never the physical ball
   radius.

8. **Gauge block - probed length.** Probe opposite faces of a grade-0 ISO 3650
   block, nominal 25.000 mm. Assert
   `|probed_length - 25.000| <= 0.00014 + 2 x probe_repeatability`, i.e.
   **<= 0.00214 mm** for a 1 um 2-sigma probe. Because the block is 20x tighter
   than the probe, **any failure here is the probe or the translator, never the
   block** - which is exactly what makes it the best first hardware test.

9. **1-2-3 block - corner and block routines, MillenniumOS's own assertions.**
   Run our corner routine against a 1-2-3 block on nominals 25.4 / 50.8 /
   76.2 mm. Assert, exactly as MillenniumOS does, that
   `deflection = (measured - nominal)/2` is **>= 0 on both axes** (a negative
   value on an external feature is a sign error, and MillenniumOS treats it as a
   bug) and **<= 0.05 mm**; and that adjacent probed faces are perpendicular
   within **0.0076 mm over 25.4 mm**. Also assert the fitted corner agrees with a
   caliper-measured edge within 0.05 mm - the caliper is the weakest link, so
   band it honestly.

10. **Calibration sphere - 25-point ISO 10360-5 form check, and the repeat gate.**
    Probe the prescribed 25 points on a Ø25 mm calibration sphere, least-squares
    fit, and assert `P_FTU = r_max - r_min <= P_FTU,MPE` (**<= 0.001 mm**
    strain-gauge, **<= 0.004 mm** kinematic) and
    `P_STU = |fitted_radius - certified_radius| <= P_FTU,MPE`. Then assert the
    MillenniumOS convergence gate on a single point: repeated probes converge
    within **0.01 mm in at most 10 attempts** at 300-then-50 mm/min with a 2 mm
    dive. This is the honest end of the survey: it is the only test that
    separates "our maths is right" from "our machine is good enough".

---

## Gaps I could not fill

Stated plainly.

- **No upstream project commits a sample of its own probe-result file.** Not
  LinuxCNC, not bCNC, not ioSender. All three formats are fully specified in
  their source or docs, so the three samples in
  `converted-mine/result-format-samples/` were written from those specs; they are
  structurally faithful but the numbers are invented, and they are labelled as
  such.
- **No community probe test block with published nominals plus a matching
  probing program exists.** See section 5.
- **No *file* of Fusion-posted G38.2 probing exists anywhere public**, only the
  post source that would produce it. `fusion/subset_check_postlib.md` shows the
  blunt result: **not one** of Autodesk's 28 shipped `.nc` regression outputs -
  including every `inspection` and `inspect surface` one, and including
  `grbl.nc` and `reprap.nc` - contains a single `G38`, because the regression
  models carry no probing operations. On the source side, `grbl.cps`,
  `linuxcnc.cps`, `reprap.cps`, `carbide3d.cps`, `centroid.cps`, `tormach.cps`,
  `masso.cps`, `mach3mill.cps` and `shopbot.cps` emit no probing at all, and
  there is **no Marlin milling post in the library**. The single exception is
  **`buildbotics.cps`**, which does emit real `G38.2`:
  `G0 Z<retract>` / `G91` / `G38.2 Z<-(retract+overtravel)> F<f>` / `G92 Z0` /
  `G90` / retract / return to XY origin, for four cycle types only
  (`probing-x`, `probing-y`, `probing-z`, `probing-xy-outer-corner`; everything
  else calls `cycleNotSupported()`). **Note the `G92`** - the offset is planted
  in the program, which our parser refuses outright, so even this post's output
  needs the probe result read out of band. If we want an actual Fusion-posted
  file our parser can read, someone has to post a job with `buildbotics.cps` or
  write a post; there is nothing to download. The nearest public artefact is
  `fusion/forum-samples/14_linuxcnc_forum_fusion_probing_post_output.ngc`, a
  community `LinuxCNCWithProbing.cps` output that only *calls* O-word
  subroutines whose G38.2 moves live in separately installed macros.
- **NAS 979's own tolerance table is paywalled.** Only the geometry was
  recovered, from a copyright-free NIST paper.
- **ISO 10791 parts 1-6 clause tolerances were not obtained.** iso.org returned
  403 on every abstract and no free secondary source reproduces them. Part 7's
  M1_320 table was recovered from a Renishaw white paper.
- **Siemens Sinumerik measuring-cycle logs: documentation only.** The result
  variable index tables and the CYCLE150 TXT/CSV log description are captured,
  but the manual never prints a sample log and none is committed publicly.
  Mazak and Okuma: nothing freely available at all.
- **No real DMIS `.dmo` output file exists publicly.** The NIST suite gives 53
  conformance programs and `A.21.dmi` embeds its expected output as comments,
  which is the closest available substitute.
- **Heidenhain `TCHPRAUTO.html` / `TCHPRMAN.html`**: behaviour documented, no
  public copy of an actual generated log file.
- **Estlcam and Carbide Motion emit no user-visible probing gcode**, so neither
  contributes a fixture. Forum posts show fragments only (`G38.2 Z-50 F10` then
  `G92 Z1.9`), and the `G92` in the Estlcam idiom is something we refuse
  outright - worth knowing if anyone ever pastes an Estlcam tool-change script
  at us.
- **Three of the strongest report samples are unlicensed or restricted**: the
  PC-DMIS-style production reports and the metroliza fixtures have no licence
  file, and the Renishaw and Heidenhain manuals restrict redistribution. Use
  them to develop against; do not vendor them into the repository. QIF (Boost
  licence) and the NIST DMIS suite (public domain) are the two that can be
  committed if we ever want fixtures in-tree.
