# Real-Time Jog — Firmware Project Scoping & Transport Analysis

**Date:** 2026-06-20
**Status:** Scoping / design only. No implementation.
**Goal:** True press-and-hold continuous jog (hold an axis → moves continuously; release → stops promptly and position-safely) for the Snapmaker 2.0 (A350, 10W laser).
**Prereq reading:** `docs/superpowers/audits/2026-06-20-realtime-jog-feasibility.md`.

## 1. Why this needs firmware + the existing precedent

Host-reachable XYZ motion today is **discrete, fire-and-wait** (SACP `0x01/0x34` move, or HTTP `execute_code` G-code). There is no continuous-jog or out-of-band move-cancel for XYZ. So real-time jog cannot be done purely in Luban — the controller firmware must expose a "move-while-held + stop" primitive for XYZ.

**It already exists for the extruder (E) axis** — this is the template:
- `DoEInfinityMove` queues a 100000 mm E move ("move forever") — `event_handler.cpp:1041-1069`.
- `StopEMoves` → `stepper.e_moves_quick_stop_triggered()`, wait ≤300 ms, then resync position from steppers — `event_handler.cpp:1071-1103`.
- Stepper-ISR abort is gated E-only: `if (abort_e_moves) … TEST(axis_did_move, E_AXIS)` — `stepper.cpp:1363-1383`.

## 2. Firmware changes (Snapmaker2-Controller)

1. **Generalize the abort to X/Y/Z.** Extend the ISR abort (`stepper.cpp:1363-1383`) and `*_quick_stop_triggered()` so a per-axis (or all-axes) "stop" can drop the current block for X/Y/Z, not just E. Resync position from steppers afterward (mirror `quickstop_stepper()` in `Marlin.cpp:420-425`, which is already position-safe — no re-home).
2. **Add XYZ infinity-move opcode(s).** Mirror `DoEInfinityMove`: start a long move on the chosen axis (sign = direction) at a given feedrate, bounded by the soft endstop / axis travel (never a literal 100000 — clamp to `[min,max]` so a lost stop can't drive past the envelope).
3. **Add an XYZ stop opcode.** Mirror `StopEMoves` (abort + resync).
4. **SAFETY — deadman/heartbeat (critical).** A naive "infinity move until stop" is dangerous: if the stop command is lost (network/USB drop, app crash), the head runs to the soft limit. Mitigations (do at least one):
   - **Bounded ticks instead of true infinity:** each "hold tick" commands a short move (e.g. 2-5 mm); the client must send ticks at interval T to keep moving. If ticks stop (release or comms loss), motion ends within one tick. This is the streamed-small-step model but *firmware-assisted* (the controller can blend consecutive ticks for smoothness, unlike host G-code).
   - **Firmware watchdog on the infinity move:** auto-stop if no keepalive packet within e.g. 150-300 ms. Truly continuous while held, but self-stops on comms loss.
   - Always clamp to soft endstops so worst case is a limit stop, not a crash.
5. **Expose via SACP** (new command IDs in set `0x01`): `jogStart(axis, dir, feedrate)`, `jogKeepAlive()`, `jogStop()` — so the host can drive it.

## 3. Transport analysis (the real constraint)

The motion controller (open firmware) is **not directly on the network** — over Wi-Fi the **closed-source touchscreen** mediates Luban↔controller. This gates every networked option.

| Transport | Path to controller | Can carry NEW jog opcodes? | Latency / stop promptness | Verdict |
|---|---|---|---|---|
| **USB-serial SACP** | Luban → controller (screen not in the command path for serial) | **Yes** — we own both ends (Luban + controller firmware) | Low latency; M410/stop acts mid-stream (`queue.cpp:671-681`). Best stop promptness. | **Primary path.** The only transport where the firmware change is reliably usable. |
| **SACP over TCP (8888)** | Luban → screen → controller | Only if the closed screen **transparently relays** unknown SACP opcodes. Unknown. AND this machine has 8888 **refused** (audit). | Would be good if it worked (persistent socket). | Blocked: port off on this machine + screen-relay behavior unverified. |
| **SACP over UDP (8889)** | Luban → screen → controller | Same screen-relay unknown; this machine didn't answer the probe. | Datagram, lossy → bad for a safety-critical stop. | Not recommended. |
| **HTTP (`execute_code`)** | Luban → screen → controller | No — screen only accepts known G-code/endpoints; no streaming, stop not out-of-band. | Worst. | Not viable for real-time. |
| **Raw-TCP serial bridge (ser2net etc.)** | Luban → TCP → small bridge (Pi) → controller USB | Yes (bridge forwards serial bytes verbatim) | LAN latency + USB; decent. But needs **extra hardware** always-attached. | Niche; works but adds a device. |
| **WebSockets** | Luban-UI ↔ Luban Node server only | N/A — no websocket endpoint on the machine; server still talks discrete SACP/HTTP to the machine. | Doesn't change machine-side latency. | Not a machine transport. Doesn't help. |

**Transport conclusion:** real-time jog is realistically a **USB-serial** feature. The user's "raw TCP serial" idea is viable only as an external **serial-over-TCP bridge** (extra hardware); "WebSockets" only exists Luban-internally and can't reach the controller. The closed screen makes the native Wi-Fi paths a dead-end for new opcodes (and SACP-TCP is off on this machine anyway).

> Worth a one-time test on a machine with SACP-TCP open: does the screen relay an *unknown* SACP command ID to the controller? If yes, networked real-time jog becomes possible on SACP-capable screens. On the current A350 (HTTP-only), it's USB-serial or nothing.

## 4. Luban client design (USB-serial)

- Jog UI: on keydown/buttondown → `jogStart(axis, dir, feedrate)`; while held → `jogKeepAlive()` at the watchdog interval (or repeated bounded ticks); on keyup/buttonup → `jogStop()`. **Ignore OS key auto-repeat** (use real keydown/keyup, not Mousetrap repeat).
- New `SacpClient` methods + `SacpSerialChannel` wiring + a `ConnectionManager.jog{Start,Stop}` surface and `SocketEvent`s.
- Fallback: if the connection isn't USB-serial (e.g. Wi-Fi), the UI hides/disables continuous jog and uses the **safe discrete jog** (the anti-flood fix) instead.

## 5. Phasing & risks

- **Phase 0 (do regardless, any transport):** the anti-flood safety fix — ignore key auto-repeat + one-move-in-flight. Removes the current dangerous overrun on Wi-Fi today. (Small Luban change.)
- **Phase 1 (firmware):** XYZ abort generalization + jogStart/keepAlive/stop opcodes + deadman + soft-endstop clamp; flash via USB; bench-test with a serial terminal.
- **Phase 2 (Luban):** SACP-serial jog commands + UI; USB-only, with the Wi-Fi fallback.
- **Risks:** building/flashing controller firmware (recoverable but real); the deadman is **safety-critical** — a continuous move with a missed stop must fail safe; maintaining a firmware fork against upstream; feature only available on USB (most users jog on Wi-Fi).

## 6. Recommendation

True real-time jog is feasible **only over USB-serial with a controller-firmware change**, using the E-axis infinity-move/stop as the template, gated behind a **deadman + soft-endstop clamp**. Networked (Wi-Fi) real-time jog is blocked by the closed screen; "raw TCP" means an external serial bridge; "WebSockets" doesn't reach the machine. Given most jogging happens over Wi-Fi, **do Phase 0 now** (kills the danger) and treat Phases 1-2 as an opt-in USB power-user feature if the firmware investment is worthwhile.
