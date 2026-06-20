# Luban Wi-Fi Reliability Audit & Fixes — Engagement Design

**Date:** 2026-06-13
**Machine:** Snapmaker 2.0 (Wi-Fi, SACP-capable recent firmware), 10W Laser Module, enclosure
**Baseline branch:** `chore/update-webpack-4-to-5` (user's fork, builds locally)
**Budget:** ~10 hours

## Problem

Luban works in general but is unreliable when running laser/3D-printing jobs
directly from the app over Wi-Fi:

1. **Slow homing** — go-to-home sometimes runs much slower than expected.
2. **State desync** — Luban's view of machine state (e.g. laser module on/off,
   module attach state) goes stale or out of sync with the machine.
3. **Unsafe origin moves** — "go to work origin" can drive the toolhead into
   the bed (Z ordering / origin validation suspected).

## Goals

1. Root-cause the three symptoms via a structured audit of the Wi-Fi
   machine-control path, cross-referenced against the actual firmware
   (`Snapmaker2-Controller`, `Snapmaker2-Modules` repos, available locally).
2. Fix the top-ranked concrete bugs.
3. Produce design specs (no implementation) for two future features:
   curved-surface laser etching (Z-modulated toolpaths via height sensing) and
   better camera-module utilization.

## Non-goals

- Slicing engines, UI/editor features, print-profile system, build/webpack work.
- Implementing the curved-surface or camera features (spec only).
- Pushing firmware changes to the machine. Firmware repo edits, if any, stay
  local and uncommitted-to-remote.

## Scope — code under audit

| Component | Path | Role |
|---|---|---|
| ConnectionManager | `src/server/services/machine/ConnectionManager.ts` | Command orchestration incl. `goHome`, work-origin moves |
| SACP Wi-Fi channel | `src/server/services/machine/channels/SacpTcpChannel.ts`, `SacpChannel.ts` | Subscriptions, heartbeat, events |
| SACP protocol client | `src/server/services/machine/sacp/SacpClient.ts` | Encoding, acks, timeouts |
| HTTP fallback channel | `src/server/services/machine/channels/SstpHttpChannel.ts` | Legacy polling path |
| Machine model / channel choice | `src/server/services/machine/instances/SM2Instance.ts`, `ProtocolDetector.ts` | Capability & protocol selection |
| Socket handlers | `src/server/services/socket/machine-handlers.ts` | Server→client event surface |
| Client state | app-side machine redux state | Where stale state reaches the UI |
| Firmware cross-ref | `../Snapmaker2-Controller`, `../Snapmaker2-Modules` | Ground truth for homing, module state reporting, SACP/HTTP handlers |

## Phase 1 — Audit (~3–4h)

Four parallel audit dimensions (subagent per dimension), each producing
structured findings (`file:line`, severity, mapped symptom, proposed fix,
confidence):

1. **State synchronization** — subscriptions vs polling; how laser on/off,
   module attach, coordinates flow to the UI; where state goes stale. (→ symptom 2)
2. **Motion safety** — homing command path & feedrates; go-to-work-origin
   sequencing (Z-before-XY ordering, origin validation); boundary checks.
   (→ symptoms 1, 3)
3. **Connection lifecycle** — connect/disconnect/reconnect, heartbeat timeouts,
   duplicate listeners, SACP-vs-HTTP channel-switch races.
4. **Command/ack robustness** — fire-and-forget commands, missing timeouts,
   unhandled rejections, races in `SacpClient`.

Top findings are then verified against firmware source before ranking.

**Deliverable:** `docs/superpowers/audits/2026-06-13-wifi-connection-audit.md`
— ranked findings + improvement roadmap.

**Tooling:** Serena symbolic tools for code exploration; Chrome DevTools MCP
attached to the Electron renderer (dev mode) to observe live redux state vs
server channel state — read-only, no motion risk.

## Phase 2 — Fixes (~4–5h)

- New branch off `chore/update-webpack-4-to-5`.
- Fix top-ranked issues (expect 3–6 fixes; exact list comes from audit ranking).
- TDD for unit-testable logic (protocol parsing, state reducers, sequencing
  decisions). Motion-sequencing fixes additionally get a **manual live test
  script** for the user to execute under supervision.
- Firmware-side root causes that can't be fixed in Luban: document with
  Luban-side guard recommendations; local firmware patches only if clearly
  warranted, left local.

## Phase 3 — Feature specs (~1–2h)

1. **Curved-surface laser etching:** height-probing strategy comparison
   (laser-module IR/induction sensing vs camera vs manual probe grid) →
   height map → Z-modulated G-code in the laser toolpath generator.
2. **Camera module improvements:** survey of existing capture/calibration
   path; opportunities for focus/height measurement and toolhead-position
   awareness.

## Live-machine safety protocol (hard limits)

**Allowed:** Wi-Fi connect/disconnect; read-only state queries (position,
module info, subscriptions); enclosure light + exhaust fan toggles; camera
capture from the 10W laser module.

**Forbidden:** any motion command (homing, jog, go-to-origin, run boundary);
laser power on at any level; heater commands; writing the saved work origin;
starting any job.

Motion-related fixes are validated only by tests + firmware cross-reference
during the session; physical validation is done by the user afterwards using
the provided manual test scripts.

## Risks & mitigations

- *Intermittent bugs may not reproduce on demand* → static-analysis-first;
  machine time confirms root causes, not hunts for them.
- *Firmware-side bugs* → documented with Luban-side guards; firmware repos
  available for deeper investigation, changes stay local.
- *Fork drift vs upstream* → findings annotated for upstream relevance so
  fixes can be PR'd to Snapmaker/Luban later if desired.

## Success criteria

1. Audit report exists with each of the three symptoms traced to at least one
   credible, firmware-cross-referenced root cause (or explicitly ruled
   Luban-side-unfixable).
2. Top-ranked fixes implemented on a branch, with tests passing and a manual
   validation script per motion-related fix.
3. Two feature design docs written, grounded in audited SACP/camera
   capabilities.
