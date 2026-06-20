# Real-Time Jog Feasibility — Snapmaker 2.0 (A350, 10W laser)

**Date:** 2026-06-20
**Question:** Can Luban do true press-and-hold continuous jog (move while held, stop promptly on release), and over which connection?
**Method:** read-only research across Luban, `Snapmaker2-Controller`, `Snapmaker2-Modules`, the SACP SDK, and the screen HTTP API. File:line evidence below.

## Bottom line

**True real-time hold-to-jog is NOT achievable on a stock Snapmaker 2.0 over either HTTP/Wi-Fi or USB-serial SACP — it requires a firmware change.** Neither the SACP protocol nor the HTTP screen API exposes a continuous-jog or a move-cancel command for X/Y/Z; every host-reachable move is a discrete, fire-and-wait absolute/relative move. The firmware already contains the exact primitive needed (an "infinity move + abort-and-resync" pair) **but it is wired only to the extruder (E) axis** and is not surfaced over either host transport.

- **Over HTTP (this machine's Wi-Fi path):** not possible; only streamed-small-step *emulation*, and even the stop isn't out-of-band.
- **Over USB-serial SACP:** also not true real-time, but the *emulation* is meaningfully better — lower latency and a prompt, position-safe `M410` stop.
- **With a firmware change:** yes — mirror the E-axis infinity-move/stop for X/Y/Z and expose it via SACP. The hardware/firmware can clearly do it; the capability just isn't exposed.

## Evidence

### Firmware (Snapmaker2-Controller)
- **Touchscreen XYZ jog is itself discrete + blocking.** `DoXYZMove` brackets each absolute/relative move in `planner.synchronize()` (queues one move, blocks until done, then ACKs) — `snapmaker/src/hmi/event_handler.cpp:932-980` (synchronize at :956, :971). There is no continuous XYZ jog opcode even for the screen.
- **The "move-while-held + stop" primitive exists — E axis only.**
  - `MOTION_OPC_DO_E_INFINITY_MOVE` → `DoEInfinityMove` queues a 100000 mm E move ("move forever") — `event_handler.cpp:1041-1069`.
  - `MOTION_OPC_STOP_AXES_MOVE` → `StopEMoves` → `stepper.e_moves_quick_stop_triggered()`, wait ≤300 ms, then **resync position from steppers** — `event_handler.cpp:1071-1103`.
  - The stepper-ISR abort only drops the current block for E: `if (abort_e_moves) … TEST(axis_did_move, E_AXIS)` — `Marlin/src/module/stepper.cpp:1363-1383`. So this does **not** stop an XYZ move; it's E-only by construction.
- **`M410` quickstop IS position-safe here (no re-home).** `quickstop_stepper()` = `planner.quick_stop(); synchronize(); set_current_from_steppers_for_axis(ALL_AXES); sync_plan_position()` — `Marlin/src/Marlin.cpp:420-425`. It reads actual stepper counts and resyncs.
- **M410/M112 act mid-stream, ahead of the queue.** `EMERGENCY_PARSER` is disabled (`Configuration_adv.h:1232`), so `get_serial_commands` special-cases them at read time: `M112→kill()`, `M410→quickstop_stepper()` — `Marlin/src/gcode/queue.cpp:671-681`. So an M410 on the serial wire stops immediately (not after the queue drains). Over HTTP it has to ride the same queued POST path, so it is **not** out-of-band there.
- `QuickStopService` (`snapmaker/src/service/quick_stop.cpp`) is a heavier pause/stop-button/power-loss path with parking/retract — job-oriented, not a lightweight jog-cancel.

### SACP protocol
- Motion set `0x01` exposes only `0x34` (absolute/relative move, sent `isRTO=true`, awaits ACK — `SacpClient.ts:684-688`) and `0x35` (home). No "stop motion", "cancel move", "jog", or "continuous" verb. Only stop-like verbs are job-control `0xac`: `pausePrint 0x04`, `stopPrint 0x06` (heavy QuickStop park). The E-axis infinity/stop opcodes are SSTP/HMI-only and not in SACP.

### Marlin G-code
- No GRBL-style continuous jog: **no `$J`, no `0x85` jog-cancel** in this firmware. Stop levers are `M410` (quickstop, position-safe here), `M112` (kill — needs reset), `M0/M1` (pause), `M400` (wait). Jog must be emulated with `G91/G0/G90` discrete moves (what Luban does today).

### Connection / latency
- **HTTP** `/api/v1/execute_code` is discrete request/response, serial per line (`SstpHttpChannel.ts:394-454`); each jog = 3 POSTs (`G91`,`G0`,`G90`). No streaming/websocket/realtime jog endpoint on the screen API. M410 isn't out-of-band here.
- **USB-serial SACP** — same discrete move command, but lower latency and M410 can be injected mid-stream for a prompt, position-safe stop.
- **No realtime path to the machine** — the only socket.io is Luban-UI ↔ local Node server; the server still talks discrete HTTP/SACP to the controller.

## Current bug (independent of the above)
The keyboard jog uses Mousetrap, which fires on **OS key auto-repeat** — holding an arrow floods the planner with discrete buffered moves, causing the stutter and the **dangerous overrun after release** (the buffer keeps draining). `JogPadShortcut.tsx` binds `relativeMove` to arrow keydown with no repeat-guard and no one-in-flight limit. This must be fixed regardless of which jog approach is chosen.

## Options

| Option | Real-time? | Effort | Stop promptness | Notes |
|---|---|---|---|---|
| **A. Safety fix only** | No | S | n/a | Ignore key auto-repeat + one-move-in-flight. Removes the flood/overrun danger. Stays discrete (one bounded step per press). Should be done in all cases. |
| **B. Streamed small-step emulation** | Approx | M | ≤1 step overrun | Hold = short relative moves, one in flight; release = stop (optionally M410). Best over USB-serial (prompt, position-safe stop); laggier over HTTP. Closest non-firmware feel. Includes A. |
| **C. Firmware change (true real-time)** | **Yes** | L | Excellent | Add XYZ infinity-move + stop-axes opcodes mirroring `DoEInfinityMove`/`StopEMoves`, extend the ISR abort to XYZ, expose via SACP, build matching Luban client. Requires building/flashing Snapmaker2-Controller (USB) + new SACP wiring. The firmware already proves the pattern (E axis). |

## Recommendation
- **Always do A** (it's the safety fix for a real hazard).
- For the user's goal of true hold-to-move: only **C** delivers it, and it's a firmware project (feasible — the E-axis code is the template). **B** is the best you can get without touching firmware and is much better over USB-serial than HTTP.
