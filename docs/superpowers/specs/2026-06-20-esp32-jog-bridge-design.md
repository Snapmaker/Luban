# ESP32 Real-Time Jog Bridge — Scoping & Design

**Date:** 2026-06-20
**Status:** Scoping / design only. No implementation.
**Goal:** True low-latency real-time jog (hold → continuous move; release → prompt, position-safe stop) by adding a user-supplied **ESP32** that bridges Wi-Fi (raw TCP / WebSocket) ↔ a controller UART, **bypassing the closed-source touchscreen**.
**Builds on:** `2026-06-20-realtime-jog-feasibility.md`, `2026-06-20-realtime-jog-firmware-design.md`. Research this doc is grounded in: two firmware investigations (controller UART topology; CAN/module bus), summarized inline with file:line.

## 1. Why this architecture works (and CAN doesn't)

- The motion controller (open firmware, **GD32F105VET6**, Cortex-M4 @120 MHz) is **not on the network** — over Wi-Fi the **closed touchscreen** mediates and won't forward new opcodes. An ESP32 wired to a controller UART removes the screen from the path.
- **CAN is a dead end for jog:** modules are peripheral slaves (limit/temperature reporting, fan/heater/laser/spindle setpoints); they never command coordinated motion, and `FUNC_SET_STEP_CTRL` is defined-but-dead. Motion only enters via the controller's **host-command intake (UART)** — G-code or SSTP events → Marlin planner. (Modules research: `registry.cpp:348-351`, `route.cpp:28-185`, `linear_module.cpp:37-49`.)
- **Precedent:** the 10W laser toolhead has its **own onboard ESP32** that already speaks SSTP to the controller over USART3 (`toolhead_laser.cpp:283`). An ESP32↔controller UART link is proven on this hardware.

## 2. Hardware: where the ESP32 taps in

Controller USARTs (all 3.3 V CMOS, 115200 8N1) — from `board.h`, `HAL.h`, `HardwareSerial.cpp`:

| USART | Pins | Use today | Tap for ESP32? |
|---|---|---|---|
| **USART1** | PA9/PA10 | **Host serial** (USB-C path), Marlin G-code | **Primary tap** — firmware already parses it; `M410` is an out-of-band position-safe stop here (`queue.cpp:671-681`). |
| USART2 | PD5/PD6 | Touchscreen (SSTP) | **No** — point-to-point to screen; sharing = bus contention + 100 ms screen-loss watchdog aborts jobs (`snapmaker.cpp:209-216`). |
| USART3 | PB10/PB11 | Laser ESP32 (SSTP); pins are also the E-axis stepper port | **No** — not a free header. |
| UART4/UART5 | — | Not instantiated in firmware | Possible *dedicated* port if pins are broken out on the PCB — needs physical inspection + firmware instantiation. |

**Recommended:** wire the ESP32 to **USART1** (controller TX PA9 → ESP32 RX; controller RX PA10 ← ESP32 TX; common ground; 3.3 V — no level shifter). Caveat: USART1 is shared with the USB-C serial, so the ESP32 bridge and a simultaneous USB connection contend — use one at a time (the ESP32 *is* the connection). If a truly independent port is wanted, confirm UART4/UART5 pin breakout on the board and instantiate it in firmware (cleaner, more work).

> Open hardware questions (physical inspection, not in repo): exact solder point for USART1 (direct MCU pins vs. through the USB-serial bridge IC), and whether UART4/UART5 are reachable.

## 3. Data path & protocol

```
Luban UI ──socket.io──> Luban Node server ──(raw TCP / WebSocket over Wi-Fi)──> ESP32 ──UART G-code──> GD32 controller ──> planner/stepper
                                                                                  └── local deadman ──> M410 / jog-stop on keepalive loss
```

- **ESP32 ↔ controller:** Marlin **G-code** over USART1 (primary). Reuses existing intake — *zero* new controller command-plumbing for basic moves; `M410` already stops promptly and position-safely. (SSTP is the alternative but needs a new UART poller; G-code is lower-risk.)
- **ESP32 ↔ Luban:** see §6 for raw-TCP vs WebSocket vs UDP. The ESP32 runs a small server; the Luban **Node server** is the client (not the browser).
- **Jog protocol (Luban↔ESP32), minimal:** `JOG_START {axis,dir,feedrate}`, `JOG_KEEPALIVE` (every ~50-100 ms while held), `JOG_STOP`. The ESP32 translates these to controller commands and enforces the deadman.

## 4. Two delivery levels

**Level A — Streamed-G-code jog with local deadman (NO controller firmware change).**
- On `JOG_START`+keepalives, the ESP32 streams short relative moves (`G91 / G0 <axis><step> F<feed>`) to the controller, **one in flight at a time**.
- On `JOG_STOP` *or* keepalive timeout, the ESP32 stops streaming and sends **`M410`** (position-safe quickstop) over UART.
- Result: bounded overrun (≤ one short step), prompt stop, and — crucially — **a much lower-latency link than Wi-Fi-via-screen**, with the stop enforced *locally* on the ESP32 (Wi-Fi drop → ESP32 still stops the machine in ~ms). This already delivers a big improvement and needs only ESP32 + Luban work.
- Limitation: motion is still stepwise (not perfectly continuous), smoothness bounded by step size vs UART round-trip (fast, since local).

**Level B — True continuous jog (adds controller firmware change).**
- Controller firmware adds **XYZ infinity-move + stop** primitives (mirror the E-axis `DoEInfinityMove`/`StopEMoves`, generalize the ISR abort from E to XYZ, clamp to soft endstops), exposed as **custom G/M-codes** (e.g. `M2000 <axis><dir> F<feed>` = jog-start, `M2001` = jog-stop) so the ESP32 triggers them as plain text on USART1. (Per `2026-06-20-realtime-jog-firmware-design.md` §2.)
- On `JOG_START`: ESP32 sends `M2000` → controller moves continuously. On `JOG_STOP`/timeout: ESP32 sends `M2001` (or `M410`).
- Result: genuinely smooth continuous jog; ESP32 deadman still guarantees a safe stop.

## 5. Safety (non-negotiable)

- **Local deadman on the ESP32:** Luban must send keepalives while a key is held; if none arrive within a short window (~150 ms), the ESP32 *immediately* issues the stop over UART. This is the central safety property — it does not depend on Wi-Fi reliability.
- **Soft-endstop clamp** in the firmware infinity-move (Level B) so a worst-case runaway hits a limit, not a crash.
- **`M410` is position-safe here** (`quickstop_stepper()` resyncs from steppers, no re-home — `Marlin.cpp:420-425`).
- ESP32 should also stop on TCP/WebSocket disconnect, not just keepalive timeout.
- Anti-flood on the Luban side (ignore key auto-repeat; one logical jog session per physical hold).

## 6. ESP32 ↔ Luban transport choice

| Transport | Latency | Framing | ESP32 effort | Notes |
|---|---|---|---|---|
| **Raw TCP** | Lowest | none (define a tiny line/JSON framing) | Low | Best for jog latency; Node `net.Socket` client. **Recommended.** |
| **WebSocket** | ~TCP + small | message frames built-in | Medium (ESPAsyncWebServer) | Nicer framing/debugging; negligible LAN overhead; easy `ws` client in Node. Good alternative. |
| **UDP** | Lowest, lossy | none | Low | Keepalive loss = deadman trip (safe but jittery). Could use UDP for keepalive + TCP for control; likely over-engineering. |

Recommendation: **raw TCP** (or WebSocket if you prefer framed messages) for the Luban↔ESP32 link; keepalives at 50-100 ms.

## 7. Luban changes

- New machine **transport/channel** for the ESP32 bridge (a `EspJogChannel` style TCP/WS client in `src/server/services/machine/channels/`), or a dedicated side-channel used only for jog while the main connection stays HTTP for everything else.
- Jog UI: real `keydown`/`keyup` (not Mousetrap auto-repeat) → `JOG_START`/keepalive/`JOG_STOP`; fallback to safe discrete jog when the ESP32 bridge isn't present.
- Connection/discovery for the ESP32 (static IP or mDNS).

## 8. Latency budget (estimate)

Luban server → Wi-Fi LAN (~1-5 ms) → ESP32 parse (<1 ms) → UART @115200 (a short G-code line ~1-2 ms) → controller queue. Round-trip on a quiet LAN ≈ low-single-digit ms, vs tens-to->100 ms per HTTP POST through the screen. The **stop** is enforced ESP32-local, so its latency is just UART (~1-2 ms) regardless of Wi-Fi.

## 9. Phasing

- **P0 (now, independent):** Luban anti-flood safety fix (ignore key auto-repeat + one-in-flight) — removes today's dangerous overrun on Wi-Fi.
- **P1:** ESP32 firmware — Wi-Fi STA + TCP/WS server + UART bridge + **local deadman** + Level-A G-code streaming. Bench-test against the controller with the screen detached or on USART1.
- **P2:** Luban ESP32 jog channel + hold/release UI (Level A). Now you have low-latency, safe, stepwise jog.
- **P3 (optional, true continuous):** controller firmware XYZ infinity-move/stop + custom M-codes (Level B); ESP32 switches from streaming to start/stop.

## 10. Risks / open items

- **Electrical:** confirm USART1 solder point and 3.3 V; sharing with USB-C means not using both at once.
- **Controller firmware fork** (Level B) — building/flashing the GD32 (J-Link), maintaining against upstream.
- **Two command sources** if the screen Wi-Fi stays connected while the ESP32 also feeds USART1 → interleaving into one Marlin queue; simplest to treat the ESP32 as the active connection during jog.
- **ESP32 deadman correctness is safety-critical** — must fail safe on every loss path (keepalive timeout, TCP close, Wi-Fi drop, ESP32 reset).
- mDNS/discovery and reconnection robustness.

## 11. Recommendation

This is the right way to get real-time jog on a Snapmaker 2.0: an **ESP32 on USART1 speaking G-code, with a local deadman**, exposed to Luban over **raw TCP/WebSocket**. Start with **Level A** (no controller firmware change — big win on its own: low latency + safe local stop), then add **Level B** firmware for truly continuous motion if worth it. Do **P0** now regardless.
