# Curved-Surface Laser Etching (Z-Modulated Toolpaths) — Design Spec

**Date:** 2026-06-13
**Status:** Design only (no implementation). Future feature.
**Target:** Snapmaker A350, 10W laser module, HTTP Wi-Fi (Marlin G-code flavor).
**Grounded in:** code research (laser toolpath pipeline) + the Wi-Fi audit; file:line references throughout.

## Problem & goal

Laser etching today runs on a single fixed Z plane: focus height `Z = laserFocalLength + materialThickness` is set once before the job (`ConnectionManager.ts:705,711`) and the toolpath contains no Z moves (`ConnectionManager.ts:684` comment). On a curved or uneven surface the beam goes out of focus across the work, giving inconsistent burn depth/width. Goal: etch on a curved surface by **modulating Z per move to follow a height map**, keeping the focal distance constant across the surface.

## Key feasibility findings (from code research)

**Encouraging — the output path already supports per-move Z:**
- The toolpath JSON point schema already has an optional `Z` key per point (`src/server/lib/ToolPath/ToolPathGeometryConverter.ts:122-125`).
- The **Marlin** laser G-code emitter already writes `Z` per move when a point carries one (`src/server/lib/GcodeGenerator/GcodeGenerator.js:146-147`). The A350-over-HTTP path uses Marlin, so **no firmware or emitter change is needed to *emit* Z-modulated moves.**
- The 3D toolpath preview already renders per-point Z and tracks a Z bounding box (`ToolPathGeometryConverter.ts:124-163`, `generateGcode.js:177-220`), so curved paths will visualize.

**Hard blocker — height-map acquisition:**
- The 10W laser module has **no distance/depth/proximity sensor** (`Snapmaker2-Modules/.../laser_head_10w.cpp:40-41,97-115`); "auto-focus" is a visual ladder test, not a measurement (`Snapmaker2-Controller/.../toolhead_laser.cpp:922-1019`).
- Probing / G38 / bed-leveling exists but is **gated to 3DP/dual-extruder toolheads** and uses the nozzle optocoupler — unavailable to the laser (`bed_level.cpp:108,185,448,488`).
- `getLaserMaterialThickness` (SACP `0xb0/0x09`) yields a **single** camera-derived Z at one XY, not a queryable height field, and is a SACP/touchscreen path not used on HTTP.
- **Conclusion: Luban cannot auto-acquire a height map on this hardware.** The height map must come from elsewhere (see options).

**Engine constraint:**
- The laser toolpath itself is produced by the closed-source native engine `@snapmaker/snapmaker-lunar` (`call-engine.js`, `generateToolPath.ts:12,59`); we can't make it emit Z. The rotary B-axis precedent (`XToBToolPath.js`) is **CNC-only and computes B inside the engine**, so it's a *pattern* reference, not reusable code.

## Recommended approach: post-process Z-modulation (avoids the closed engine)

Add a JS post-processing pass that runs **after** the engine returns its flat X/Y toolpath JSON and **before** G-code emission, rewriting each point's `Z` from a height map. This is a `ZModulatedToolPath` sibling in spirit to `XToBToolPath` but operating on the returned JSON (since the engine is closed and `XToBToolPath` is CNC-only).

Pipeline insertion point: between `generateLaserToolPathFromEngine` producing `modelInfo.toolpathFileName` (`generateToolPath.ts:44`) and `generateGcode.js:121-122` consuming it — apply Z-modulation to the toolpath JSON `data[]` points.

### Components

1. **Height map model** (`src/server/lib/heightMap/HeightMap.js`, net-new): a grid `{ originX, originY, stepX, stepY, rows, cols, z[][] }` plus a `sampleZ(x, y)` that bilinearly interpolates Z at an arbitrary XY (clamped to bounds). Pure, unit-testable.
2. **Z-modulation pass** (`src/server/lib/ToolPath/applyHeightMap.js`, net-new): for each point in the engine's toolpath `data[]`, set `point.Z = round(heightMap.sampleZ(point.X + offsetX, point.Y + offsetY) + focusOffset, 3)`. Insert intermediate points on long segments so Z tracks curvature (configurable max segment length, e.g. 1–2 mm) — without subdivision, a straight G1 between two points ignores curvature between them. Pure, unit-testable.
3. **Safety clamp** (in the same pass): clamp Z to `[surfaceZ, surfaceZ + maxLift]`; never command Z below the lowest height-map point minus a margin; abort generation with a clear error if the map's Z range exceeds machine travel. (Ties to the audit's bed-crash theme — a wrong map must not drive the head down.)
4. **Skip the fixed-Z preamble** when Z-modulation is active: the `G0 Z{focal+thickness}` move (`ConnectionManager.ts:705,711`) must be suppressed/replaced so it doesn't fight per-move Z; instead move to the first point's Z. Gate on a new job flag.

### Height-map acquisition options (UI lets the user pick)

| Option | How | Pros | Cons | Recommendation |
|---|---|---|---|---|
| **A. Import** | Load a height map / mesh (CSV grid, or sample a Z field from an STL aligned to the work) | Accurate; no hardware limit; deterministic | User must produce it externally | **Primary** — most robust given the sensing blocker |
| **B. Manual probe grid** | User jogs to focus at an N×M grid of XY points, records Z at each (reuses the visual focus ladder) | No extra hardware | Tedious, operator-dependent accuracy | Secondary — good for small/simple curves |
| **C. Camera/thickness grid** | Drive `getLaserMaterialThickness` over a grid | Semi-automated | SACP-only (not the A350/HTTP path), single-point + slow, camera-derived accuracy | Out of scope until SACP-on-this-machine is viable |

Primary = **A (import) with B (manual grid) as a fallback**; C is parked behind the transport/firmware blocker.

## UI changes (minimal)

- **Job Setup** (`src/app/ui/pages/laser-main/modals/JobSetupView.tsx:52`): add a workpiece type "Curved (height map)" alongside the existing Rectangle/Cylinder(rotary) options — mirrors the rotary `WorkpieceShape` pattern.
- **Height-map panel**: choose source (import file / start manual grid), preview the map (reuse the 3D preview), set focus offset and max-lift safety.
- **Laser process panel** (`LaserParameters.jsx`): note that multi-pass depth stepping (`processGcodeMultiPass`, `GcodeGenerator.js:165-202`) composes additively with per-move Z (passes offset the whole map).

## Data flow

UI (workpiece=curved + height map) → toolpath `materials`/flags (`ToolPath.ts`) → `generateToolPath.ts` (engine produces flat X/Y JSON) → **`applyHeightMap` pass rewrites per-point Z (net-new)** → `generateGcode.js` emits Marlin G1 with Z (existing) → HTTP job start with fixed-Z preamble suppressed.

## Testing

- Unit (tape, pure helpers): `HeightMap.sampleZ` (corners, interpolation, out-of-bounds clamp); `applyHeightMap` (Z assignment, segment subdivision, safety clamp, abort-on-out-of-range).
- Integration: feed a known flat toolpath JSON + a synthetic dome height map → assert emitted G-code Z follows the dome within tolerance.
- Manual (machine, hand on e-stop): low-power test on a gently curved scrap; verify focus stays consistent and no plunge. Reuse the audit's motion-safety mindset.

## Risks

- **Acquisition blocker** is the dominant risk — without import/manual data there is no map. The spec leans on import precisely because on-device sensing isn't available.
- **Z feedrate coupling**: per-move Z adds to path length; combined XY+Z feedrate must keep the *XY* engraving speed constant or burn density varies. The pass must compute F so the XY component matches the requested engrave speed.
- **Wrong/misaligned map → crash**: mitigated by the safety clamp + abort + the new R10 origin-descent confirm already added in Phase 2.
- **GRBL portability**: GRBL emitter drops Z (`GcodeGenerator.js:84`); curved etching would need that implemented for Ray/GRBL machines. Out of scope for A350.

## Out of scope

- Auto height-sensing hardware/firmware (no sensor exists).
- Modifying the closed LunarTPP engine.
- GRBL/Ray support.
- 5-axis / surface-normal beam orientation (Snapmaker can't tilt the head).

## Success criteria

A height map (imported or manually probed) drives per-move Z in the emitted Marlin G-code such that focal distance stays within tolerance across a curved test surface, with hard safety clamps preventing any below-surface plunge, and the feature is gated behind an explicit "Curved (height map)" workpiece type.
