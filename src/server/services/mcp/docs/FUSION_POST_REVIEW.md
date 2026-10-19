# Snapmaker Fusion 360 post processor — review for 3+2 probing jobs the Luban MCP can run

Date: 2026-09-07. Reviewer notes: everything marked **[verified]** was read in the actual post
source or in a live HTTP response recorded in this session; **[inferred]** is reasoning on top of
that. No repository file was modified.

Downloaded artefacts (all under
`C:\Users\tyeth\AppData\Local\Temp\claude\C--dev-software-snapmaker-Luban-mcp\7f3da915-cd97-4783-be04-153e73290ae0\scratchpad\posts\`):

| file | source | notes |
|---|---|---|
| `snapmaker.cps` | `https://raw.githubusercontent.com/Snapmaker/snapmaker_cnc_post_process/master/snapmaker-fusion360-configuration-20180730/snapmaker.cps` | official 3-axis, 384 lines, md5 `43f92cb2de6f51f4a90b8c51f1457299` |
| `snapmaker-baxis.cps` | same repo/dir | official 4-axis, 2808 lines, md5 `627c2b60bef6a0254995c0dc90285aa9` |
| `repo-README.md`, `gcode_reference.md`, `f360-readme.txt` | same repo | |
| `SM2.0_NrvO.cps`, `SM2.0_NrvO_versionhistory.md` | `nunorvoliveira/snapmaker-2.0` | community post, v20230108.1 |
| `haas.cps`, `fanuc.cps`, `grbl.cps` | `https://cam.autodesk.com/posts/posts/<name>.cps` | current Autodesk posts (rev 44241 / 2026-09-02 for haas) |
| `haas_inspect_surface.cps`, `fanuc_inspection.cps` | same | inspection-capable posts, rev 44210 / 2026-01-20 |
| `result_generator_probing.cps` | same | **Autodesk "Results file generator for probing and inspection"**, rev 44149 / 2024-10-30 — authoritative G800/G801 writer |
| `posts-website.json` | `https://cam.autodesk.com/posts/posts/posts-website.json` | full library index, 594 posts |
| `probe38/buildbotics.cps` | same library | the only post in the library that emits `G38.2` |
| `probe38/{linuxcnc,mach3mill,centroid,masso}.cps` | same library | checked, no `G38` |

Download mechanics worth recording: `https://cam.autodesk.com/posts/download.php?name=<n>&type=post`
returns **HTTP 200 with an 85-byte body "Failed to download file…"** [verified], but the direct path
`https://cam.autodesk.com/posts/posts/<name>.cps` (with a `Referer: https://cam.autodesk.com/hsmposts`)
serves the real file [verified]. Post names with spaces are URL-encoded (`result%20generator%20probing.cps`).

---

## 1. Which Snapmaker post(s) exist, and what they do today

### 1.1 There is no Autodesk-maintained Snapmaker post [verified]

`posts-website.json` contains 594 entries; a case-insensitive search of the whole JSON for
`snapmaker` and for `marlin` returns **zero** hits. The Snapmaker post is only distributed by
Snapmaker itself (GitHub / wiki), so any change is ours to make and to ship — there is no upstream
Autodesk revision to wait for and no `minimumRevision` gate managed by Autodesk.

The library does contain 23 posts whose description ends in "Inspection"/"Inspect Surface"
(haas, fanuc, hurco, datron, mazak, okuma, siemens-840d, heidenhain, brother, several BTC machine
posts) plus `result generator probing`.

### 1.2 Official Snapmaker repo

`https://github.com/Snapmaker/snapmaker_cnc_post_process` (default branch `master`; repo
`pushed_at` 2024-05-02) [verified]. Both `.cps` files live in
`snapmaker-fusion360-configuration-20180730/` and their last commit is **2021-04-14 by
`zhangjiefeng`, message "Move file"** [verified via the commits API] — i.e. the posts have not been
functionally touched since at least 2021, and their internal version strings are older still.

The repo also ships Aspire (`Snapmaker_cnc_4axis_mm.pp`, `Snapmaker_cnc_mm.pp`), VCarve, ArtCAM and
FreeCAD (`snapmaker_freecad_post.py`) configurations, plus three Fusion tool libraries
(`Snapmaker 2.0 CNC Tool Library.tools`, `Snapmaker Artisan CNC tool library.tools`,
`Snapmaker CNC tool library.tools`) [verified from the tree listing]. **Machine variants:** the post
files themselves are variant-agnostic — no A150/A250/A350/Artisan/Ray branching, no travel limits, no
machine definition; only the tool libraries distinguish Artisan [verified]. The Snapmaker wiki has
two pages (`.../snapmaker_post_process_in_fusion360` and `..._4aixs`) but both render their body via
JavaScript and returned title-only content to a fetch, so I could not quote them.

#### `snapmaker.cps` — "Generic Snapmaker (Marlin)" [verified]

```js
description = "Generic Snapmaker (Marlin)";
vendor = "SNAPMAKER";
legal = "Copyright (C) 2016-2018 by Snapmaker, Inc.";
certificationLevel = 2;
minimumRevision = 24000;
longDescription = "Generic milling post for Snapmaker.v20180725";
extension = ".cnc";
capabilities = CAPABILITY_MILLING;
allowedCircularPlanes = 0; // circular interpolation is not supported
```

* **Probing / inspection: none.** The file defines no `onCyclePoint`, no `onCycle`, no
  `isProbeOperation()`, no `TOOL_PROBE` awareness and no `probeMultipleFeatures`. Fusion probe and
  inspect operations cannot be posted with it at all.
* **Rotary: refused.** `onRapid5D`/`onLinear5D` both call
  `error(localize("Multi-axis motion is not supported."))`, and `onSection` errors with
  `"Tool orientation is not supported."` for any work plane whose forward is not `(0,0,1)`.
* **Header** (from `onOpen`): `;<programName>`, `;<programComment>`, `;Machine` / `;vendor: Snapmaker`
  / `;model:` / `;description: Generic Snapmaker (Marlin) v20180725`, then `M3 P100`, `G4 S2`, `G21`,
  `G90`. No `G17`, no `G94`, no `G54`, no `G20` (inches raise an `error()` — and the message still
  says "not recommended by the BoXZY team", a leftover from the post it was forked from).
* **Footer** (`onClose`): `G0 X0 Y0` then `M5`. No `M2`/`M30`.
* **Tool change:** none — the `onSection` comment literally reads `// tool change not supported`;
  no `T`/`M6` is written. Coolant: `// coolant not supported`.
* **WCS:** never emitted. Programs are written in the Fusion WCS and rely on the machine's live
  work origin — which happens to be exactly the convention `probeCam.ts` assumes.
* **Comments:** `formatComment` = `";" + text` with `()` stripped, so comments are `;…` lines,
  mixed case preserved.
* **Feeds:** `F` on every `G1` (`feedOutput` is `force:true`), `G0` for rapids.
* **Arcs:** `allowedCircularPlanes = 0` means the kernel linearizes every arc, so despite the
  `onCircular` body that would write `G2/G3 … I … J`, no arcs reach the file [inferred, but the
  flag is unambiguous].

#### `snapmaker-baxis.cps` — the 4-axis post is an unbranded Autodesk **Fanuc** post [verified]

The file header was never rewritten:

```js
/** FANUC post processor configuration.
    $Revision: 42172 bd19858a62e243c722de6e4753876abf77ff3fb6 $
    $Date: 2018-11-06 13:08:35 $ */
description = 'FANUC - Inverse Time and A-axis';
vendor = 'Fanuc';
capabilities = CAPABILITY_MILLING;
```

So in Fusion's post list this appears as "FANUC - Inverse Time and A-axis", not as a Snapmaker post.
The only Snapmaker-specific edits are: the A axis replaced by a B axis, `zInitialHeight`,
`useClockwise`, the `T…M6` line commented out, `G54–G59` output commented out, the `G28` in
`writeRetract` commented out, and `;`-style comments.

* **Rotary [verified]** — `onOpen`:

  ```js
  var bAxis = createAxis({coordinate:1, table:true,
      axis:[0, (properties.makeAAxisOtherWay ? -1 : 1) * -1, 0], cyclic:true, preference:1});
  machineConfiguration = new MachineConfiguration(bAxis);
  setMachineConfiguration(machineConfiguration);
  optimizeMachineAngles2(1); // map tip mode
  ```

  Fixed settings are `useMultiAxisFeatures = false`, `forceMultiAxisIndexing = false`,
  `useABCPrepositioning = false`, `cancelTiltFirst = false`. Consequence: **3+2 indexing emits a bare
  `G00 B<angle>` and nothing else** — no `G68.2`, no `G53.1`, no `G54.x`:

  ```js
  // setWorkPlane(abc), the !useMultiAxisFeatures branch
  writeBlock(gMotionModal.format(0),
    conditional(machineConfiguration.isMachineCoordinate(0), 'A' + abcFormat.format(abc.x)),
    conditional(machineConfiguration.isMachineCoordinate(1), 'B' + abcFormat.format(properties.useClockwise ? abc.y : -abc.y)),
    conditional(machineConfiguration.isMachineCoordinate(2), 'C' + abcFormat.format(abc.z)));
  ```

  and `getWorkPlaneMachineABC(..., rotate=true)` runs `setRotation(R)` with `tcp = false`, i.e. **XYZ
  are post-transformed into the rotated frame**. This is already the scheme we want (see §2.4).
  `abcFormat` is `{decimals:3, forceDecimal:true, scale:DEG}`, so the word looks like `B-90.000`.
  Simultaneous 4-axis sections instead go through `onRapid5D`/`onLinear5D`, which write
  `G0/G1 X… Y… Z… B…` (optionally with inverse-time `F`).
  **Sign trap:** the axis vector is `[0,-1,0]` *and* the output negates `abc.y` again when
  `useClockwise` is false. That double negation must be validated against the real machine before it
  is trusted — treat the post's default as unverified.
* **Header [verified]** (`onOpen` tail): `;NNNN (PROGRAM COMMENT)` (program name must be an integer),
  optional `;Machine`/tool-list comments, then `G90`, `G94`, `G00 Z50` (`zInitialHeight`),
  `G00 X0 Y0`, `G21`. No `G17` (`// writeBlock(gPlaneModal.format(17));` is commented out in
  `onSection`; `onCycle()` does write `G17`). Inches are allowed here (`G20`).
* **Footer [verified]** (`onClose`): blank line, `M05`, coolant-off, `writeRetract(Z)`,
  `disableLengthCompensation(true)` → `G49`, `setWorkPlane(new Vector(0,0,0))` → `G00 B0.000`,
  `writeRetract(X, Y)`. **No `M2`/`M30`** — the trailing `// writeln("%")` is commented out.
* **`writeRetract` emits no motion at all [verified]** — the retract block is
  `// writeBlock(gFormat.format(28), gAbsIncModal.format(91), words); // retract` followed by
  `writeBlock(gAbsIncModal.format(90));`. So a call that is supposed to lift Z to the retract plane
  writes only `G90`. **This matters enormously for us: the post therefore rotates B without any
  guaranteed Z retract.** (The `G28` being commented out is good — we refuse `G28` — but the
  replacement never got written.)
* **Tool change [verified]:** `// writeBlock("T" + toolFormat.format(tool.number), mFormat.format(6));`
  — no `M6`. But `properties.preloadTool` defaults to `true` and still writes a bare `T<n>` line.
  (Harmless to us: `probeGcode.ts` treats `T` as an axis-family word, finds no X/Y/Z, and returns
  early as a "pure modal line" [verified against the parser source].)
* **Spindle [verified]:** `M03 S<rpm>` is written in `onSection` guarded by `if (!isProbeOperation() && …)`,
  so probe sections already suppress it. `onClose` writes `M05`.
* **WCS [verified]:** `G54–G59` output is commented out (`// writeBlock(gFormat.format(53 + workOffset));`),
  so nothing is emitted for offsets 1–6; offsets >6 emit `G54.1 P<n>` (which our parser rejects —
  `unsupported G54.1`). Fusion warns once when the setup has no WCS: *"Work offset has not been
  specified. Using G54 as WCS."*
* **Length compensation [verified]:** the `G43 … H…` line is commented out for table configurations
  (`lengthCompensationActive` is set anyway); `G49` is written by `disableLengthCompensation`.
* **Comments [verified]:** `formatComment` upper-cases and filters:

  ```js
  var permittedCommentChars = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,=_-';
  function formatComment(text) { return ';' + filterText(String(text).toUpperCase(), permittedCommentChars).replace(/[()]/g, '') + ''; }
  ```

  Lower case, `/`, `:` and `(` `)` are destroyed. A `(PROBE id=1 name=top nominal=…)` comment comes
  out as `;PROBE ID=1 NAME=TOP NOMINAL=…`. **That still parses:** `parseProbeMeta`'s key regex is
  `/([a-z_]+)\s*=\s*…/gi` and lower-cases keys, `frame` values are lower-cased, and `-`/`.`/`,`/`=`
  are all permitted characters [verified against `probeGcode.ts`]. Good luck rather than design;
  worth a code comment when we patch.
* **Probing today [verified]:** the post carries the *complete* Renishaw Inspection Plus macro suite
  inherited from Fanuc — `isProbeOperation()` is `getParameter('operation-strategy') == 'probe'`, a
  `G65 P9832` "spin the probe on" in `onSection`, `G65 P9810` protected moves, and in `onCyclePoint`
  a case per cycle type:

  | cycleType | macro emitted |
  |---|---|
  | `probing-x`, `probing-y`, `probing-z` | `G65 P9811 X/Y/Z… Q… S…` |
  | `probing-x-wall`, `probing-y-wall`, `probing-x-channel`(+`-with-island`), `probing-y-channel`(+`-with-island`) | `G65 P9812 …` |
  | `probing-xy-circular-boss` | `G65 P9814 D… Q… R… S…` |
  | `probing-xy-circular-hole`(+`-with-island`) | `G65 P9814`/`P9823`-family |
  | `probing-xy-rectangular-hole/boss`(+`-with-island`) | `G65 P9812` twice (X then Y) |
  | `probing-xy-inner-corner` | `G65 P9815 X… Y… [I…] [J…] Q… S…` |
  | `probing-xy-outer-corner` | `G65 P9816 X… Y… [I…] [J…] Q… S…` |
  | `probing-x-plane-angle`, `probing-y-plane-angle` | `G65 P9843 X/Y… D… Q…` |

  `onCycleEnd` adds `G65 P9810 Z<clearance>` and `G65 P9833` (probe off), and `setProbingAngle()`
  can emit `G68 … R[#139]` or `#26010=#135 … G54.4 P1`.
  **None of this is executable on a Snapmaker** (the firmware has no Renishaw macros, no `#`
  variables, no `G65`) and every line of it is refused by `probeGcode.ts` (`G65` → `unsupported G65`;
  `#`/`[` → the macro-variable error; `G68`/`G54.4` → unsupported).
* **Inspect-surface: not supported.** `capabilities = CAPABILITY_MILLING` only, no
  `probeMultipleFeatures`, no `inspectionCycleInspect`, no `onProbe`, no `G800`/`G801`.

#### Community post: `SM2.0 (NrvO).cps` [verified]

`nunorvoliveira/snapmaker-2.0` (mirrored as `brent113/f360_SM2_PP`), version **20230108.1**, GPL-3.0,
`capabilities = CAPABILITY_MILLING`. Nicely engineered for milling (grouped properties, pause/raise-Z
action, feed manipulation) but **no probing and no rotary**: `onRapid5D` merely writes
`;WARNING: Unsupported "onRapid5D(...)" was invoked and ignored`. Ships Fusion `.machine` definitions
for A150/A250/A350T (with and without enclosure) — those are the only real machine-variant
definitions in the ecosystem and are useful if we want Fusion to know the travel limits.

### 1.3 Reference points from the Autodesk library

* **`grbl.cps` emits no probing at all** [verified]: `capabilities = CAPABILITY_MILLING | CAPABILITY_MACHINE_SIMULATION`;
  a grep for `G38` in the file returns nothing; the only probe-aware line is
  `if (tool.type && tool.type == TOOL_PROBE) { // avoid coolant output for probing`.
* **`buildbotics.cps` is the only library post that emits `G38.2`** [verified] — "Buildbotics 4-Axis
  CNC Controller", rev 44229 / 2026-06-12. Its pattern is exactly the shape we need, except it uses
  `G91` + `G92` (both a problem for us — see §2.5):

  ```js
  case "probing-x":
    writeComment(cycleType);
    writeBlock(gMotionModal.format(0), "Z" + xyzFormat.format(-tool.diameter / 2));
    writeBlock(gAbsIncModal.format(91));
    writeBlock(gFormat.format(38.2), "X" + xyzFormat.format(value * (cycle.retract + cycle.probeOvertravel)), feedOutput.format(F));
    writeBlock(gFormat.format(92), "X" + xyzFormat.format(x + value * (offset - tool.diameter / 2)));
    writeBlock(gAbsIncModal.format(90));
    writeBlock(gMotionModal.format(0), "Z" + xyzFormat.format(cycle.retract));
    writeBlock(gMotionModal.format(0), "X" + xyzFormat.format(0), "Y" + xyzFormat.format(0));
    break;
  ```

  with, just above the `switch`:

  ```js
  value  = (cycle.approach1 == "positive") ? 1 : -1;
  offset = cycle.probeClearance + tool.diameter / 2;
  ```

  It also proves the `cycle` fields available for every probing cycle type on a Grbl-class control:
  `approach1`, `approach2`, `probeClearance`, `probeOvertravel`, `retract`, `depth`, `width1`,
  `width2`, `probeSpacing`, `feedrate`, `nominalAngle`.
* **Inspect-surface posts** are built as *base post + include*: `haas_inspect_surface.cps` ends its
  copy of `haas.cps` and then does [verified]

  ```js
  capabilities |= CAPABILITY_INSPECTION;
  description += " Inspect Surface";
  longDescription += " This postprocessor has inspect surface & Live connection capabilities.";
  ```

  with `probeMultipleFeatures = true` in the base. Dispatch is:

  ```js
  function onCyclePoint(x, y, z) {
    if (isInspectionOperation()) {
      if (typeof inspectionCycleInspect == "function") { inspectionCycleInspect(cycle, x, y, z); return; }
      else { cycleNotSupported(); }
    } else if (isProbeOperation()) { writeProbeCycle(cycle, x, y, z); }
    …
  ```

  and `inspectionCycleInspect` expects **exactly three cycle points per inspection point** —
  `if (getNumberOfCyclePoints() != 3) error(localize("Missing Endpoint in Inspection Cycle, check Approach and Retract heights"))`
  — approach, measure, retract; the measure point carries `cycle.nominalX/Y/Z`,
  `cycle.nominalI/J/K`, `cycle.safeFeed`, `cycle.measureFeed`, `cycle.linkFeed`, and the operation
  carries `operation:inspectSurfaceOffset`, `operation:inspectUpperTolerance`,
  `operation:inspectLowerTolerance`.
  `isProbeOperation()` and `isInspectionOperation()` are **kernel functions**, not post-defined
  (they appear only as call sites in the modern posts) [verified].

---

## 2. What must change in the post to emit programs `probeGcode.ts` accepts

### 2.0 The dialect budget (what the parser accepts today) [verified from `probeGcode.ts`]

Allowed G: `G0 G1 G4 G17 G20 G21 G38.2 G38.3 G38.4 G38.5 G53 G54 G90 G91 G94 G43 G49 G40 G80`
(`G43`/`G49` warn and are ignored). Allowed/ignored M: `M5 M9 M400 M114 M117 M118`; `M2/M30` end the
program. Words: `X Y Z F P S T H I J K R Q D` are consumed, `G`/`M` are codes, **anything else —
including `A`, `B`, `C`, `E`, `N`… (N is stripped only as a leading line number) — throws
`unsupported word`**. `#` or `[` anywhere throws. Explicitly refused with a helpful message:
`M3/M4`, `M0/M1`, `M6`, `G28`, `G92`, `G55–G59`, `G2/G3`.
Not in the list and therefore fatal: **`G61`, `G64`, `G65`, `G68/G69`, `G98/G99`, `G54.1`, `G54.4`,
`G05.1`, `M7/M8`, `M98`, `M99`**. `%` lines and bare `O1234` are stripped.

Extra constraints applied by `probeCam.ts` at staging [verified]: `MAX_STEPS = 400` motion steps per
program; `MAX_PROBE_TRAVEL_MM = 150` per cycle; every target must satisfy
`0 <= Z <= safeTraverseZ` (320) and be inside the machine envelope; `G38.2/G38.3` with any upward
component is refused ("the probe cannot measure the gantry"); a `G38.x` with no travel is refused;
programmed feeds are ignored with a warning.

### 2.1 Capability flags and which operation types to enable

Base the probing post on `snapmaker.cps` (clean, small, `;` comments, already Marlin-ish) rather than
on `snapmaker-baxis.cps` (a Fanuc post with a Renishaw macro suite bolted on). Then:

```js
capabilities = CAPABILITY_MILLING | CAPABILITY_INSPECTION;
probeMultipleFeatures = true;   // Fusion may put several features in one probe operation
allowedCircularPlanes = 0;      // keep arcs linearized - we refuse G2/G3
minimumRevision = 45917;        // matches current library posts using getProperty()/settings
extension = "nc";               // or keep ".cnc"
```

*Note the two different Fusion feature families, both wanted:*
1. **Milling → Probe (WCS/geometry) operations** — `isProbeOperation()` is true, `cycleType` is one
   of the `probing-*` strings, driven through `onCyclePoint`. These are available under
   `CAPABILITY_MILLING` alone [inferred from `buildbotics.cps`, which has only MILLING and handles
   `probing-*`]. On our machine they must **not** be allowed to update a work offset (no `G92`, no
   `G10`); they become pure measurements and the MCP report carries the numbers.
2. **Inspection → Inspect Surface operations** — `isInspectionOperation()` is true, needs
   `capabilities |= CAPABILITY_INSPECTION`, three cycle points per point, and gives us true nominal
   point + normal + per-operation tolerances. This is the family that maps *perfectly* onto
   `run_probing_gcode` + `(PROBE …)` metadata + the G800/G801 report. **Prioritise this one.**

Also declare a probe tool so Fusion lets the user pick one (`tool.type == TOOL_PROBE`,
`tool.diameter` = stylus diameter) and add the machine's real stylus diameter to the Snapmaker tool
library, because the post needs `tool.diameter/2` for every stand-off computation.

### 2.2 Mapping each Fusion probing cycle to explicit `G38.2` sequences

Our translator has **no canned cycles**: every measurement must be an explicit
*approach → `G38.2` → retreat* triple, in absolute `G90` work coordinates, and the `G38.2` target is
a *travel limit* (the march stops on contact and then retreats to the cycle start by itself, so the
post does **not** need a retract move after a probe — but writing one is harmless and keeps the
program readable outside our runner).

Shared symbols (Fusion `cycle` fields, all present on a Grbl-class post [verified in
`buildbotics.cps`]):

```
r   = tool.diameter / 2                       // stylus radius
c   = cycle.probeClearance                    // stand-off from the nominal surface
ot  = cycle.probeOvertravel                   // how far past the nominal we may travel
sx  = approach(cycle.approach1)               // +1 / -1
sy  = approach(cycle.approach2)
zc  = cycle.clearance, zr = cycle.retract, d = cycle.depth
```

| Fusion `cycleType` | emit | geometry |
|---|---|---|
| `probing-z` | 1 cycle | `G0 X<x> Y<y>`; `G0 Z<min(z-d+c, zr)>`; `G38.2 Z<z-d-ot>` |
| `probing-x` | 1 cycle | `G0 X<x + sx*(c+r)> Y<y>`; `G0 Z<z-d>`; `G38.2 X<x + sx*(-ot-r)>` — i.e. march inward past the wall by `ot` |
| `probing-y` | 1 cycle | mirror of `probing-x` in Y |
| `probing-x-wall` (boss width in X) | 2 cycles | probe `-X` face from `x - w1/2 - c - r` toward `x - w1/2 + ot - r`, then `+X` face from `x + w1/2 + c + r` toward `x + w1/2 - ot + r`; both at `Z = z-d`; centre = mean, width = difference − 2r (we report the raw contacts; the pairing is a report-grouping concern, §3.6) |
| `probing-y-wall` | 2 cycles | mirror in Y |
| `probing-x-channel` / `probing-y-channel` (bore/slot) | 2 cycles | same two contacts but approached from **inside**: start at the nominal centre at `Z = z-d`, march out to `±(w1/2 + ot - r)` |
| `probing-xy-outer-corner` | 2 cycles | X face probed at `Y = y + sy*2*(c+r)`, then Y face probed at `X = x + sx*2*(c+r)` — exactly the `buildbotics.cps` layout, so the stylus is clear of the corner on each pass |
| `probing-xy-inner-corner` | 2 cycles | from the inside: X face at `Y = y + sy*(c+r)`, Y face at `X = x + sx*(c+r)` |
| `probing-xy-circular-boss` | 3–4 cycles | radial marches at 0°/90°/180°/270° from `R+c+r` inward to `R-ot-r`, each a diagonal `G38.2 X… Y…` at `Z = z-d`. Our parser and translator already accept a `G38.2` with simultaneous X and Y (the march runs along the unit vector) [verified in `probeGcode.ts`/`probeCam.ts`] |
| `probing-xy-circular-hole` (+`-with-island`) | 3–4 cycles | same angles, outward from the nominal centre to `R+ot-r` |
| `probing-xy-rectangular-boss` / `-hole` (+`-with-island`) | 4 cycles | the X pair then the Y pair, as two wall/channel pairs |
| `probing-xy-rectangular-hole/boss-with-z`, `-circular-*-with-z` | as above **+ 1** `probing-z` cycle |
| `probing-x-plane-angle`, `probing-y-plane-angle` | 2 cycles | two contacts on one face separated by `cycle.probeSpacing`; the angle is derived in the report, never fed back into a rotation |
| `probing-xy-pcd-hole`/`-boss`(+`-with-island`), `probing-*-partial-*` | **refuse** with `error(localize("Cycle '%1' is not supported by the Snapmaker probing post."))` |
| `probing-x/y-channel-not-symmetric`, `-wall-not-symmetric` | refuse initially (same two-contact geometry but the widths come from `width1`/`width2` asymmetrically — enable once tested) |
| anything with `cycle.probeMode`/WCS update, `cycle.wrongSizeAction`, `outOfPositionAction` set to a machine action | **ignore the action, warn** — we cannot stop the machine mid-program (`M0` is refused) and we do not update offsets |

Every cycle keeps `|target − start| <= 150 mm` (`MAX_PROBE_TRAVEL_MM`) and the post should
`error()` if `c + ot + r` ever exceeds that. Total motion steps must stay under 400, so the post
should count emitted cycles and `error()` past ~120 probes (each probe costs ~3 steps).

Generosity rule: our march treats the target as the travel *limit*, so `ot` should be **bigger**
than a Fanuc post would use (the sample program's comment says "keep cycle travel GENEROUS"). Default
`probeOvertravel` in Fusion is ~2 mm; recommend the post add a property `minOvertravel` (default 5 mm)
and use `max(cycle.probeOvertravel, minOvertravel)`.

### 2.3 The `(PROBE …)` metadata comment

Written **immediately before** each `G38.x` line (the parser attaches pending metadata to the next
probe and clears it) [verified]. Field grammar from `parseProbeMeta`: `id`, `name`, `nominal=x,y,z`,
`normal=i,j,k`, `tol=upper,lower` (one value = symmetric), `frame=work|machine`; the comment must
*start* with the word `probe` (case-insensitive); values may not contain spaces or `=`.

For **Inspect Surface** points the data is exact and already in the right frame:

```js
function writeProbeMeta(id, name, nominal, normal, upper, lower) {
  writeComment("PROBE id=" + id +
    " name=" + safeName(name) +                         // strip spaces -> "_", uppercase-safe
    " nominal=" + xyzFormat.format(nominal.x) + "," + xyzFormat.format(nominal.y) + "," + xyzFormat.format(nominal.z) +
    " normal="  + ijkFormat.format(normal.x)  + "," + ijkFormat.format(normal.y)  + "," + ijkFormat.format(normal.z) +
    " tol=" + xyzFormat.format(upper) + "," + xyzFormat.format(Math.abs(lower)) +
    " frame=work");
}
```

with `nominal = cycle.nominalX/Y/Z`, `normal = cycle.nominalI/J/K`,
`upper = getParameter("operation:inspectUpperTolerance")`,
`lower = getParameter("operation:inspectLowerTolerance")`. Apply `getRotation()` to both vectors
first, exactly as `inspectionWriteNominalData` does [verified], so the metadata is in the same
(rotated) frame as the emitted XYZ.

For **`probing-*`** cycles there is no CAD nominal: use the cycle's nominal feature geometry
(the wall/centre position offset by the stylus radius along the approach) as `nominal`, the approach
vector negated as `normal`, and `cycle.tolerancePosition`/`toleranceSize` as `tol` when present.
When nothing is known, omit `nominal` — the report then falls back to the programmed target
[verified in `inspectionReport.ts:nominalWorkOf`].

**Beware the comment filter** if the post is derived from `snapmaker-baxis.cps`: `permittedCommentChars`
would survive this (all of `A–Z 0–9 . , = _ -` and space are permitted) but any lower-case name is
upper-cased and a `/` or `:` in a feature name is deleted. Sanitise names in the post
(`replace(/[^A-Za-z0-9_.-]/g, "_")`) so ids stay stable between the program and the report.

### 2.4 Rotary positioning for 3+2

**Recommendation: post-transformed coordinates + a bare `B` word. No `G68.2`, no `G54.x`, no
`G53.1`.** This is what `snapmaker-baxis.cps` already does with `useMultiAxisFeatures = false` and
`setRotation(R)` (`tcp = false`) [verified], and it is the only scheme the Snapmaker firmware could
ever honour. So the change is not "invent 3+2", it is "keep the existing scheme and make it safe".

Required post behaviour:

```js
function setWorkPlane(abc) {                 // indexing only
  if (!abcFormat.areDifferent(abc.y, currentB)) return;
  writeBlock(gMotionModal.format(0), zOutput.format(traverseZ));   // REAL retract, in machine Z
  writeBlock(gMotionModal.format(0), "B" + abcFormat.format(sign * abc.y));
  currentB = abc.y;
}
```

* the `B` line carries **no X/Y/Z and no F** (that is the shape our new parser rule will accept);
* it is preceded by a real raise to the traverse height — today `writeRetract(Z)` writes only `G90`
  [verified], which is the single most dangerous defect in the existing 4-axis post for our purposes;
* `abcFormat` should be `{decimals:3, forceDecimal:true, scale:DEG}` (already is);
* the sign must be pinned by a post property and **validated on the machine**, not inherited from
  `useClockwise`/`makeAAxisOtherWay`;
* **the Fusion machine configuration must place the rotary axis correctly**: `createAxis` in the
  existing post has no `offset:`, so the B axis is assumed to pass through the WCS origin
  [verified]. With `optimizeMachineAngles2(1)` ("map tip mode") the transformed XYZ are only correct
  if the setup WCS origin lies on the rotary axis. Practically: either set the Fusion WCS origin on
  the rotary centreline (which our measured `axis.x ≈ 169.7`, `axis.z_physical ≈ 112.4` describe), or
  give `createAxis` an `offset:[ax, 0, az]` measured from the WCS origin. State this in the post's
  `longDescription` — it is the most likely source of a silent 3+2 misplacement.
* refuse *simultaneous* 4-axis for probing: `onRapid5D`/`onLinear5D` should
  `error(localize("Simultaneous multi-axis motion is not supported in a probing program."))`.
  Rotating while probing is meaningless to our sensor-gated march anyway.

**What our side must grow (exact list):**

1. `probeGcode.ts`
   * add `'B'` to the accepted word set, but only in a dedicated branch: a line whose codes are
     `G0` (or `G1`) with a `B` word **and no `X`/`Y`/`Z`** becomes a new step
     `{ kind: 'rotate'; line; source; bDeg: number }`. A `B` word together with any of X/Y/Z must
     still throw ("simultaneous rotary + linear motion is not supported"), as must `A`/`C`.
   * track a modal `bDeg` in the simulator so consecutive identical rotations collapse and the plan
     description can print the rotation schedule.
   * export the B angle on `ParsedProbeGcode` (e.g. `rotations: number[]`, `endB`) so the confirm
     page can enumerate the schedule like `probe_program` does.
   * `G91` + `B` (incremental rotation) — either resolve it against the modal B or refuse; refusing
     is simpler and the post will only ever emit absolute.
2. `probeCam.ts`
   * translate `kind: 'rotate'` into the existing `rotate_b` op semantics: **refuse at plan time
     unless the toolhead is at/above `safeTraverseZ()`**, which means the planner must insert (or
     require) a raise before it — mirror `probe_program`'s rule (absolute B on the direct path,
     verified by the `M114` in the same batch or the heartbeat's `b`).
   * feed the rotation into `camMotion()` so the keep-out check sees it, including the
     `insideSweptCylinder` test with an optional per-program `swept_radius_mm` (same argument
     `probe_program` already takes).
   * record the active B on every `ProbeResultRecord` (a new field `bDeg`) so the inspection report
     can group by station and so a Fusion import can be told which work plane a point belongs to
     (see §4 on `G330`).
   * `describeProbeCamPlanAsGcode` must print the rotation as its own approval line.
3. `inspectionReport.ts` — see §4.

### 2.5 What the post must NOT emit

| must not emit | why | how to suppress |
|---|---|---|
| `M3`/`M4` (+`S`) | parser refuses: *"would start the spindle with the touch probe fitted"* | gate the whole spindle block on `!isProbeOperation() && !isInspectionOperation()`; the baxis post already gates on `isProbeOperation()` only — extend it. Also drop `snapmaker.cps`'s unconditional `M3 P100` in `onOpen`. |
| `M6`, `T…M6` | refused | already commented out; also suppress `properties.preloadTool`'s bare `T<n>` for tidiness (it parses harmlessly today) |
| `G28` | refused ("homing also turns the rotary") | already commented out in `writeRetract` — replace with a real `G0 Z<traverse>` instead of leaving it empty |
| `G92` | refused (changes the work origin) | **do not port the `buildbotics.cps` pattern** — its whole point is `G92` after each probe. Our probing programs never set an offset. |
| `M0`/`M1` | refused ("the confirm page is the approval") | set `properties.optionalStop = false` and make `onCommand(COMMAND_STOP/COMMAND_OPTIONAL_STOP)` a no-op in probing sections; also neutralise Fusion's `wrongSizeAction`/`outOfPositionAction` "stop" actions |
| `G2`/`G3` | refused | `allowedCircularPlanes = 0` (and never call `onCircular` for probing) |
| `#…`, `[…]`, `G65`, `G68`/`G69`, `G54.4`, `G53.1` | refused (macro variables / expressions) | delete the entire Renishaw/angle-probing block: `writeProbeCycle`, `setProbingAngle`, `getAngularProbingMode`, `probeVariables`, `probeWorkOffsetCode` |
| `G61`/`G64` (exact stop), `G05.1` (smoothing), `G98`/`G99` (cycle retract modal), `G80` is fine, `G54.1 P…` | **not in `SUPPORTED_G`** → `unsupported Gxx` | never call them; force `workOffset <= 6`; `properties.useSmoothing = false` |
| `M7`/`M8`, `M9` is fine | coolant on is unsupported | `setCoolant` no-op (both Snapmaker posts already have coolant disabled) |
| `M30`/`M2` | *allowed* (ends the program) — recommended, the baxis post emits neither | write `M30` in `onClose` |
| `G20` (inches) | converted with a warning, but the deviations/tolerances get messy | keep `snapmaker.cps`'s hard `error()` on inch units |

Do emit, once, in the header: `G90 G94 G17 G21` (all four are accepted; `G17` and `G94` are
no-ops for us but make the file valid elsewhere), and optionally `G54` (accepted, no-op).

### 2.6 Feeds and clearance planes

* **Feeds are ignored** by `probeCam.ts` (the march's own coarse F100 / fine F60 bound the press) and
  produce one plan warning [verified]. So `cycle.measureFeed`/`safeFeed`/`linkFeed` values are
  cosmetic. Still emit `F` on the `G38.2` line: it documents intent, it keeps the file usable on a
  real Grbl box, and it costs nothing. Do **not** emit a bare `F` line with no motion — the parser
  treats it as a modal line and ignores it, which is fine, but it is noise.
* **Clearance planes barely matter.** With the default `link_mode: "raise"` every XY link is
  re-planned as *raise to Z320 → traverse → guarded segmented descent*, whatever Z the post
  programmed [verified in `camMotion`/`describeProbeCamPlanAsGcode`]. What the post's heights *do*
  still control:
  1. the **descent target** of each link (the Z the guarded descent stops at) — so `cycle.retract`
     and the approach Z must be real, achievable, above the stock;
  2. **envelope validity** — every programmed Z must satisfy `0 <= Z <= 320` in machine coordinates
     after the work-origin shift, or staging is refused with the line number;
  3. the **keep-out check** — the descent columns and the link hops are checked against landmark
     obstacle boxes, so a clearance plane placed inside the rotary footprint at a low Z will refuse
     the program.
  In `link_mode: "stepped"` the programmed link height *is* used (a touch-probing traverse at that
  height that lifts on contact), so a post that wants that mode must place its links deliberately.
* Set `machineConfiguration.setRetractPlane()` / the post's own `traverseZ` property to **320**
  (`mcpSafeTraverseZ`), not 334 and not the homing height 328, so the post's own retract matches
  law 2. Note the recorded gotcha: the `rotary-axis` landmark declares clearance 328 while the
  operator's traverse height is 320, and segments at/above 320 are exempt from crossing landmarks by
  decree — but a program `keep_out` volume can still refuse them.

---

## 3. Proposed patch outline for the Snapmaker post

New file, e.g. `snapmaker-probing.cps`, forked from `snapmaker.cps` (not from the Fanuc-derived
`snapmaker-baxis.cps`), with the B axis machinery copied over from the latter. Functions to add or
change:

### 3.1 Globals / `onOpen`

```js
description = "Snapmaker (Marlin) - Probing & Inspection";
vendor = "Snapmaker";
extension = "nc";
capabilities = CAPABILITY_MILLING | CAPABILITY_INSPECTION;
probeMultipleFeatures = true;
allowedCircularPlanes = 0;
tolerance = spatial(0.002, MM);

properties = {
  traverseZ:       {value: 320,  scope: "post"},  // mcpSafeTraverseZ - law 2
  minOvertravel:   {value: 5,    scope: "post"},  // G38.2 target = travel LIMIT: be generous
  bAxisSign:       {value: 1,    scope: "post"},  // VERIFY ON THE MACHINE
  writeProbeMeta:  {value: true, scope: "post"},
  probeFeed:       {value: 100,  scope: "post"}   // cosmetic; the MCP ignores feeds
};

var abcFormat = createFormat({decimals:3, forceDecimal:true, scale:DEG});
var bOutput   = createVariable({prefix:"B", force:true}, abcFormat);
var currentB  = undefined;
var probeId   = 0;

function onOpen() {
  var bAxis = createAxis({coordinate:1, table:true, axis:[0, 1, 0], cyclic:true, preference:1
                          /* , offset:[axisX, 0, axisZ] if the WCS origin is NOT on the rotary axis */});
  machineConfiguration = new MachineConfiguration(bAxis);
  setMachineConfiguration(machineConfiguration);
  optimizeMachineAngles2(1);              // map tip mode -> post-transformed XYZ, bare B word
  if (unit == IN) { error(localize("Use millimetres for Snapmaker probing programs.")); return; }

  writeComment(programName || "PROBING");
  writeComment("Luban MCP run_probing_gcode - Grbl/Marlin dialect, WORK frame");
  writeComment("Feeds are advisory: the MCP runs its own sensor-gated march.");
  writeBlock(gAbsIncModal.format(90), gFeedModeModal.format(94), gPlaneModal.format(17), gUnitModal.format(21));
  // NO M3, NO G28, NO G92, NO tool call.
}
```

### 3.2 `onSection` — probing/inspection sections only

```js
function onSection() {
  if (!isProbeOperation() && !isInspectionOperation()) {
    error(localize("This post only outputs Probe and Inspect Surface operations."));
    return;
  }
  writeln("");
  if (hasParameter("operation-comment")) writeComment(getParameter("operation-comment"));

  // 3+2: rotate first, at the traverse height, then position.
  var abc = defineWorkPlane(currentSection, true);   // -> setWorkPlane() below

  var p = getFramePosition(currentSection.getInitialPosition());
  writeBlock(gMotionModal.format(0), zOutput.format(getProperty("traverseZ")));
  writeBlock(gMotionModal.format(0), xOutput.format(p.x), yOutput.format(p.y));
  writeBlock(gMotionModal.format(0), zOutput.format(p.z));
  // no spindle, no coolant, no G43
}
```

### 3.3 `setWorkPlane` / rotary — raise, then rotate, nothing else

```js
function setWorkPlane(abc) {
  if (currentB !== undefined && !abcFormat.areDifferent(abc.y, currentB)) return;
  if (abcFormat.areDifferent(abc.x, 0) || abcFormat.areDifferent(abc.z, 0)) {
    error(localize("Only a B rotation is available on the Snapmaker rotary module."));
    return;
  }
  writeComment("B rotation: raise to the traverse height first (law 2)");
  writeBlock(gMotionModal.format(0), zOutput.format(getProperty("traverseZ")));
  writeBlock(gMotionModal.format(0), bOutput.format(getProperty("bAxisSign") * abc.y)); // no XYZ, no F
  currentB = abc.y;
}

function onRapid5D()  { error(localize("Simultaneous multi-axis motion is not supported in a probing program.")); }
function onLinear5D() { error(localize("Simultaneous multi-axis motion is not supported in a probing program.")); }
```

`defineWorkPlane` / `getWorkPlaneMachineABC` can be copied verbatim from `snapmaker-baxis.cps` with
`useMultiAxisFeatures = false`, `forceMultiAxisIndexing = false`, `tcp = false` — that is the branch
that already produces post-transformed coordinates and a bare `B` word [verified].

### 3.4 One helper for every measurement

```js
/** approachPoint -> G38.2 target, with the (PROBE ...) comment. Absolute, G90. */
function writeProbe(name, approach, target, nominal, normal, tolU, tolL) {
  var travel = Vector.diff(target, approach).length;
  if (travel > 150) { error(localize("Probe travel exceeds the 150 mm limit of run_probing_gcode.")); return; }
  if (target.z > approach.z + 1e-6) { error(localize("Upward probing is refused by the MCP translator.")); return; }
  writeBlock(gMotionModal.format(0), zOutput.format(getProperty("traverseZ")));
  writeBlock(gMotionModal.format(0), xOutput.format(approach.x), yOutput.format(approach.y));
  writeBlock(gMotionModal.format(0), zOutput.format(approach.z));
  if (getProperty("writeProbeMeta")) writeProbeMeta(++probeId, name, nominal, normal, tolU, tolL);
  writeBlock(gFormat.format(38.2), xOutput.format(target.x), yOutput.format(target.y),
             zOutput.format(target.z), feedOutput.format(getProperty("probeFeed")));
  // no retract needed: the MCP retreats to the cycle start after every G38.x
}
```

(Only emit the axis words that actually change — `createVariable` handles that; a `G38.2` with no
travel is refused by the parser.)

### 3.5 `onCyclePoint` / `onCycle` — the two families

```js
function onCyclePoint(x, y, z) {
  if (isInspectionOperation()) { inspectionCycleInspect(cycle, x, y, z); return; }
  if (!isProbeOperation())     { expandCyclePoint(x, y, z); return; }   // drilling etc. never reaches us
  var r = tool.diameter / 2;
  var c = cycle.probeClearance;
  var ot = Math.max(cycle.probeOvertravel, getProperty("minOvertravel"));
  var sx = approach(cycle.approach1), sy = approach(cycle.approach2);
  switch (cycleType) {
  case "probing-z":
    writeProbe("z", new Vector(x, y, Math.min(z - cycle.depth + c, cycle.retract)),
                    new Vector(x, y, z - cycle.depth - ot),
                    new Vector(x, y, z - cycle.depth), new Vector(0, 0, 1),
                    tolUpper(), tolLower());
    break;
  case "probing-x":
    writeProbe("x", new Vector(x + sx * (c + r), y, z - cycle.depth),
                    new Vector(x + sx * (r - ot) * -1 /* march inward past the wall */, y, z - cycle.depth),
                    new Vector(x, y, z - cycle.depth), new Vector(sx, 0, 0), tolUpper(), tolLower());
    break;
  // probing-y: mirror; probing-*-wall / -channel: two writeProbe() calls;
  // probing-xy-*-corner: two writeProbe() calls at the offset stand-offs;
  // probing-xy-circular-*: 4 radial writeProbe() calls (diagonal X+Y targets);
  // probing-xy-rectangular-*: the X pair then the Y pair;
  // probing-*-plane-angle: two contacts separated by cycle.probeSpacing;
  default:
    error(subst(localize("Probing cycle '%1' is not supported by the Snapmaker probing post."), cycleType));
  }
}

/** Inspect Surface: 3 cycle points - approach, measure, retract. */
function inspectionCycleInspect(cycle, x, y, z) {
  if (getNumberOfCyclePoints() != 3) {
    error(localize("Missing endpoint in the inspection cycle - check the approach and retract heights."));
    return;
  }
  if (isFirstCyclePoint()) { pendingApproach = new Vector(x, y, z); return; }   // approach point
  if (isLastCyclePoint())  { return; }                                          // retract - the MCP retreats itself
  var m = getRotation();                          // same transform as inspectionWriteNominalData
  var nominal = m.multiply(new Vector(cycle.nominalX, cycle.nominalY, cycle.nominalZ));
  var normal  = m.multiply(new Vector(cycle.nominalI, cycle.nominalJ, cycle.nominalK)).normalized;
  // travel limit = the measure point pushed past the nominal along -normal
  var target = Vector.sum(new Vector(x, y, z), Vector.product(normal, -getProperty("minOvertravel")));
  writeProbe(getParameter("operation-comment", "pt") + "_" + (probeId + 1),
             pendingApproach, target, nominal, normal,
             getParameter("operation:inspectUpperTolerance", 0),
             getParameter("operation:inspectLowerTolerance", 0));
}
```

### 3.6 `onCommand`, `onSectionEnd`, `onClose`

```js
function onCommand(command) {
  switch (command) {
  case COMMAND_START_SPINDLE: case COMMAND_SPINDLE_CLOCKWISE:
  case COMMAND_SPINDLE_COUNTERCLOCKWISE: case COMMAND_STOP_SPINDLE:
  case COMMAND_COOLANT_ON: case COMMAND_COOLANT_OFF:
  case COMMAND_STOP: case COMMAND_OPTIONAL_STOP:      // never M0/M1
  case COMMAND_LOCK_MULTI_AXIS: case COMMAND_UNLOCK_MULTI_AXIS:
  case COMMAND_TOOL_MEASURE: case COMMAND_BREAK_CONTROL:
    return;                                            // deliberately silent
  }
  onUnsupportedCommand(command);
}

function onClose() {
  writeBlock(gMotionModal.format(0), zOutput.format(getProperty("traverseZ")));
  if (currentB !== undefined && abcFormat.areDifferent(currentB, 0)) {
    writeBlock(gMotionModal.format(0), bOutput.format(0));   // unwind at the traverse height
  }
  writeBlock(mFormat.format(30));
}
```

### 3.7 Where our code must grow (summary)

| file | change |
|---|---|
| `probeGcode.ts` | accept `B` on a `G0`/`G1` line **with no X/Y/Z** → new `CamStep` `{kind:'rotate', bDeg}`; keep rejecting `A`/`C` and `B`+XYZ; track modal B; expose the rotation schedule on `ParsedProbeGcode`; decide `G91 B` (refuse) |
| `probeCam.ts` | plan/run the `rotate` step as `rotate_b` (absolute B on the direct path, refused unless Z >= `safeTraverseZ()`, verified by the same-batch `M114` / heartbeat `b`); include it in `camMotion()` and the keep-out check; accept an optional `swept_radius_mm` for `insideSweptCylinder`; stamp the active B on each `ProbeResultRecord`; print the rotation on the confirm page |
| `probeCam.ts` | *(nice to have)* raise `MAX_STEPS` or make it a property — an Inspect Surface operation with 100+ points costs ~3 steps each and hits the 400 cap fast |
| `inspectionReport.ts` | see §4: `START`/`END` envelope, `TOOLPATHID`/`TOOLPATH`, `G330`/`G331`, `O` semantics, tip-radius compensation of `deviationMm` |
| `inspectionReport.ts` | cycle-type/feature **grouping**: the post emits pairs/quads for walls, channels, corners, bosses and holes; the report should carry the group (a `group=` key in the `(PROBE …)` comment, e.g. `group=boss1 role=x_minus`) so a boss centre/diameter can be reported, not just four raw contacts. This needs a small `parseProbeMeta` extension (`group`, `role`) — cheap, and the parser's generic key/value loop already tolerates unknown keys by ignoring them |

---

## 4. Fusion's inspection-results format vs `renderFusion()`

### 4.1 The format, field by field [verified from `result_generator_probing.cps` and `haas_inspect_surface.cps`]

`result generator probing.cps` (Autodesk, rev 44149, 2024-10-30, `extension = "txt"`,
`capabilities = CAPABILITY_SETUP_SHEET`, `probeMultipleFeatures = true`) is Autodesk's own writer of
a *mock* results file, so it is the definitive statement of the syntax Fusion reads. It writes:

```
START
RESULTSFILE <job-description|operation-comment>-RESULTS      ; ':' -> '-', non-alnum stripped, spaces -> '-'
DOCUMENTID <document-id>
MODELVERSION <model-version>
TIMESTAMP <yy><MM><dd> <H><mm><ss>

TOOLPATHID <operationId + cycleId*0.01 + patternId*0.0001 + 0.00001>   ; 5 decimals
TOOLPATH <operation comment>
G331 N<n> A<eulerX> B<eulerY> C<eulerZ> X<-originX> Y<-originY> Z<-originZ>
G330 N<n> A<abcX> B<abcY> C<abcZ> X0 Y0 Z0 I0 R0
G800 N<n> X<x> Y<y> Z<z> I<i> J<j> K<k> O<surfaceOffset> U<upperTol> L<lowerTol>
G801 N<n> X<x> Y<y> Z<z> R<probeRadius>
... (repeat per point / per toolpath)
END
```

* `G331` = CAD transform: `currentSection.getModelPlane().getTransposed().getEuler2(EULER_XYZ_S)` and
  the negated model origin.
* `G330` = workplane transform: `currentSection.workPlane.getEuler2(EULER_XYZ_S)`, then the literal
  `X0 Y0 Z0 I0 R0`.
* `G800` = **nominal**. `X/Y/Z` = nominal surface point, `I/J/K` = surface normal, `O` =
  `operation:inspectSurfaceOffset`, `U` = `operation:inspectUpperTolerance`, `L` =
  `operation:inspectLowerTolerance`.
* `G801` = **measured**. `X/Y/Z` = the measured **probe-tip centre**, `R` = the probe/stylus radius.
  The generator computes it as `nominal + normalize(I,J,K) * (toolRadius + deviation)` [verified],
  and the Haas post fills it from the corrected machine measured position
  (`inspectionVariables.xMeasured/yMeasured/zMeasured`) with `R = inspectionVariables.probeRadius`.
  **So Fusion subtracts `R` along the normal itself; the file must contain the tip centre, not the
  surface point.**
* `G802 N<n> DEVIATION <value>` — optional, written by the Haas post only when
  `cycle.outOfPositionAction == "stop-message"`.
* Number formats: `xyzFormat` = 4 decimals in mm (5 in inch), `forceDecimal:true`;
  `ijkFormat` = 6 decimals in mm (8 in inch); `abcFormat` = 4 decimals, `scale:DEG`.
  Every numeric field carries an explicit decimal point.
* Word separator: the generator writes real spaces; the on-machine posts write
  `DPRNT[G800*N1*X…*Y…]`, where the `*` is the DPRNT separator that prints as a space (which is why
  Autodesk's own troubleshooting advice is to replace `*` and `/` with spaces in a captured file)
  [the `DPRNT[...]` forms are verified; the `*`→space claim is inferred from the two posts writing
  the same logical line with `*` vs. space, plus the KB search snippet].
* Fusion's requirement per Autodesk's KB (search snippet, article itself returned HTTP 403):
  *the results file must begin with a `START` entry and contain `G800` and `G801` results* —
  **[inferred/secondary]**, but consistent with the generator writing exactly that.

### 4.2 Our `renderFusion()` [verified from `inspectionReport.ts`]

```
(Luban MCP inspection results: <source>; <n>/<m> contacts; work frame)
G800 N1 X0.000 Y0.000 Z0.000 I0.0000 J0.0000 K1.0000 O1.250 U0.100 L0.100
G801 N1 X0.100 Y0.050 Z1.312 R1.250
```

### 4.3 Mismatches, precisely

1. **No `START` … `END` envelope, and no `RESULTSFILE`/`DOCUMENTID`/`MODELVERSION`/`TIMESTAMP`
   header.** Our first line is a `(…)` comment instead. If Fusion requires `START` first (KB), our
   file is rejected outright with the "wrong type of file or it's incomplete" error. **Fix: emit
   `START`, `RESULTSFILE <source>-RESULTS`, `DOCUMENTID`, `MODELVERSION`, `TIMESTAMP yyMMdd HHmmss`,
   and a trailing `END`.** `DOCUMENTID`/`MODELVERSION` should be carried through the program (a
   `(RESULTS documentid=… modelversion=… toolpath=…)` comment the post writes and the parser stores
   would be the clean route) — Fusion uses them to match the file to the right document/version.
2. **No `TOOLPATHID` / `TOOLPATH` blocks.** Fusion associates points with the operation that made
   them via `TOOLPATHID <5-decimal id>`. Without it, imported points cannot be attributed. **Fix:
   have the post write the id into the program (`(RESULTS toolpathid=1.00001 toolpath=INSPECT_TOP)`)
   and echo it in the report before each group.**
3. **No `G330`/`G331`.** For a flat, untilted setup these are effectively identity and their absence
   may be tolerable; for a **3+2 job they are exactly the information that says which rotated work
   plane a point was measured in**, so a rotary inspection import without them will place points
   wrongly. **Fix: the post must emit its CAD/workplane transforms into the program as metadata (per
   B station), and `renderFusion` must reproduce `G330`/`G331` per group** — this is the single most
   important report change for 3+2.
4. **`O` means the wrong thing.** We write `O<tip radius>`; Autodesk writes
   `O<operation:inspectSurfaceOffset>` (a stock/offset allowance on the inspected surface), and the
   tip radius belongs in `G801`'s `R` only. **Fix: `O` should be the surface offset (0 when unknown,
   sourced from a new `offset=` key in the `(PROBE …)` comment), never the tip radius.**
5. **Number formats.** We print `X/Y/Z` and `O/U/L` with 3 decimals and `I/J/K` with 4; Autodesk uses
   4 for `xyzFormat` and 6 for `ijkFormat`. Probably tolerated, but it silently truncates our
   0.001 mm resolution and normals. **Fix: 4 and 6 decimals.**
6. **Tolerance signs.** We store `upperTolMm`/`lowerTolMm` as absolute values
   (`Math.abs`) and print `L<positive>`. Fusion's `operation:inspectLowerTolerance` is the parameter
   as configured (commonly negative), and the Haas post's on-machine check is
   `IF [dev GT <lowerTolerance>] → under tolerance`, i.e. it compares against a **signed** lower
   bound. **Fix: preserve the sign from the `tol=` metadata (`tol=0.1,-0.1` in the sample program is
   already signed and we throw the sign away in `parseProbeMeta`) and print `L` signed.**
7. **A miss emits only `G800`.** That matches "the point shows as unmeasured" in intent, but no
   Autodesk source confirms Fusion accepts an unpaired `G800`. **Recommend also writing
   `G802 N<n> DEVIATION` … no — better: keep `G800` alone but say so in the JSON report, and treat
   Fusion's behaviour on unpaired nominals as untested.** [inferred]
8. **`G801 X/Y/Z` convention is right.** Our `contactWork` is the tip-centre position
   (`frame.convention` says `contacts are tip-centre positions` [verified]) and `R = tipDiameter/2`,
   which is exactly what Autodesk writes. No change needed.
9. **Bug found in our own deviation, independent of Fusion.**
   `probeCam.ts` computes
   `deviationAlongNormal(contactWork, nominalWork, normal, …)` where `contactWork` is the
   **tip centre** and `nominalWork` is the **surface** nominal [verified at `probeCam.ts:489-495`
   and `inspectionReport.ts:deviationAlongNormal`]. For a perfectly-on-nominal surface this returns
   `+tipRadius` (≈ +1.25 mm with the measured 2.5 mm tip), so `deviationMm`, `withinTolerance`,
   `summary.maxAbsDeviationMm` and the CSV are all biased by one stylus radius. Fusion's importer
   does not see this (it does its own `R` subtraction from `G801`), which is why it has not shown up.
   **Fix: subtract the tip radius along the normal before computing the deviation** —
   `contactSurface = contactWork - normal * tipRadius` — or pass the radius into
   `deviationAlongNormal` and let it do the correction; when the tip diameter is unknown, report
   `deviationMm: null` rather than a wrong number.

### 4.4 Smallest useful change to `renderFusion`

```
START
RESULTSFILE <source>-RESULTS
DOCUMENTID <from program metadata or "">
MODELVERSION <from program metadata or "">
TIMESTAMP <yyMMdd> <HHmmss>

TOOLPATHID <group id, 5 decimals>
TOOLPATH <group name>
G331 N<n> A.. B.. C.. X.. Y.. Z..            ; from program metadata (identity if absent)
G330 N<n> A0.0000 B<activeB> C0.0000 X0 Y0 Z0 I0 R0
G800 N<n> X<4dp> Y<4dp> Z<4dp> I<6dp> J<6dp> K<6dp> O<surfaceOffset> U<signed> L<signed>
G801 N<n> X<4dp> Y<4dp> Z<4dp> R<4dp>
END
```

Keep the existing `json` / `csv` / `grbl` renderers untouched; they are ours and are unaffected.

---

## 5. Bottom line

* There is **no Autodesk-maintained Snapmaker post**; Snapmaker's own 3-axis post is a 2018 Marlin
  post with **zero** probing/inspection support, and its "4-axis" post is an unmodified 2018 Autodesk
  **Fanuc** post with a B axis substituted and a Renishaw macro probing suite that cannot run on a
  Snapmaker and that our parser refuses line by line.
* The one genuinely good thing the 4-axis post already does is exactly what we want for 3+2:
  `useMultiAxisFeatures = false` + `optimizeMachineAngles2(1)` + `setRotation(R)` ⇒
  **post-transformed XYZ and a bare `G00 B<angle>`**, no `G68.2`.
* Its worst defect for us is that `writeRetract(Z)` emits **no motion at all** (only `G90`), so B
  rotates without a guaranteed Z retract. Any patched post must raise to Z320 immediately before
  every `B` word.
* On our side the required additions are small and well-bounded: a `B`-word/`rotate` step in
  `probeGcode.ts`, a `rotate_b`-equivalent op with the Z>=traverse gate and keep-out/swept-cylinder
  checks in `probeCam.ts`, group metadata for feature-level reporting, and a `renderFusion()` that
  wraps the `G800`/`G801` pairs in the real `START`/`TOOLPATHID`/`G330`/`G331`/`END` envelope with
  the correct `O` semantics and signed tolerances — plus the tip-radius fix to `deviationMm`.
