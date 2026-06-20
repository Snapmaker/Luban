# Luban Wi-Fi Connection Reliability Audit — Snapmaker 2.0

**Date:** 2026-06-13
**Target:** Snapmaker Luban v4.15.2 (fork), Wi-Fi connection to a Snapmaker 2.0 (A150/A250/A350) with recent SACP-capable firmware, 10W laser module, enclosure.
**Method:** Static audit of the server-side machine-control stack across four dimensions (state sync, motion safety, connection lifecycle, command/ack robustness), cross-referenced against `Snapmaker2-Controller` firmware and the vendored `@snapmaker/snapmaker-sacp-sdk` v0.1.1, then adversarially re-verified. 58 findings total; all 18 P0/P1 findings independently verified (none fully refuted).
**Raw findings + verification:** `docs/superpowers/audits/raw/0{1,2,3,4}-*.md`

---

## Executive summary

Your three symptoms are all real and explained by concrete code defects. Which defects bite you depended on one fact not determinable from source — which transport your machine negotiates — and a **live read-only check (§6) has now RESOLVED it: your A350 (firmware V1.21.0) connects over Wi-Fi via the legacy HTTP path (`AndServer` on port 8080), NOT SACP.** TCP 8888 is refused and UDP 8889 does not answer the SACP probe. This means the **HTTP-path findings are operative for you, and the SACP-only fixes (R1/R2/R3) do not affect your Wi-Fi usage** (they remain latent for USB-serial, which uses SACP). See §6 for the operative-vs-non-operative split and the revised Phase 2 order. The root-cause groups below are written transport-agnostic; the §6 split tells you which leg applies.

The findings cluster into **five root causes**, most of which are single-point fixes with outsized impact:

1. **The SACP SDK never times out ~90% of its requests, and never rejects in-flight requests on disconnect** (04-F2). Homing, set-work-origin, laser-power, and all G-code execution wait *forever* on a lost ACK. This one SDK defect underlies the "homing hangs/looks slow," "state frozen," and "command silently died" symptoms across every SACP path. **Highest leverage fix in the whole audit.**

2. **Snapmaker 2.0 is a second-class citizen on the SACP path.** Over TCP the channel never fires `ChannelEvent.Ready` for an SM2 (only Artisan/J1 are handled), so no machine instance, no heartbeat, no subscriptions are ever created (01-F3, 03-F8). Even on the path that *does* work (UDP), `SM2Instance` subscribes to only machine-status + air-purifier — not coordinates, temperatures, laser power, or the homing-complete event (01-F4, 04-F3). Result: position/origin/laser state that never updates, and a homing modal that never closes.

3. **"Go to work origin" has no Z-safety and can execute in machine coordinates.** The Z-before-XY ordering in the UI is dead code — all axes move simultaneously on a diagonal (02-F2); the SACP path hard-codes `CoordinateType.MACHINE` so a work-origin move can resolve to machine Z0 = bottom of travel (02-F1); and a leaked modal `G53` (from an aborted camera-aid capture or a headType-less homing restore) leaves the next absolute move in machine space (02-F3). Any one of these can drive the head into the bed.

4. **State is fetched once and frozen.** Laser on/off is never reported over SACP and is actively coerced to `false` every heartbeat (01-F2); module attach state is read once at connect and never refreshed (01-F1, 01-F8); a second Luban window or a socket.io reconnect silently kills the HTTP status poller with no notification, freezing the UI while the machine stays live (01-F12 / 03-F6).

5. **Homing completion is structurally unreported on SM2/SACP**, so the homing modal hangs and homing *appears* to take forever even when the machine homed normally and fast (02-F5, 04-F3). Firmware confirms G28 ignores feedrate and homes Z-first at a fixed 10 mm/s, so genuine duration varies ~10× with head height — but no Luban path can actually slow G28 itself (02-F8).

**Reassuring negative result:** we found *no* code path by which Luban makes the G28 homing move itself run slow (02-F8, explicitly ruled out with firmware proof). The "slow homing" symptom is a reporting/perception bug (stuck modal) plus firmware Z-first physics plus slow *adjacent* travel moves — not a homing-speed bug.

---

## Symptom → root-cause map

| Symptom | Primary root causes | Confidence | Operative on |
|---|---|---|---|
| **Slow / stuck homing** | 04-F3 + 02-F5 (homing completion never reported → modal hangs); 04-F2 (requestHome never times out); 02-F8 firmware Z-first @10mm/s (perception); 02-F6/F7 slow F-less travel moves bracketing homing | high (reporting bug); high (firmware physics) | SACP: 04-F3/F2. HTTP: 02-F5. Both: F6/F7/F8 |
| **State out of sync** (laser on/off, module state, position) | 01-F2 (laser on/off never reported, coerced false); 01-F3+01-F4+03-F8 (SM2 SACP subscribes to almost nothing); 01-F12/03-F6 (2nd window/reconnect kills HTTP poller); 01-F1/F8 (module state write-once); 04-F2 (hung subscription freezes everything) | high | 01-F2 all paths; 01-F3/F4 SACP; 01-F12 HTTP |
| **Drives into bed on "go to work origin"** | 02-F2 (no Z-lift, simultaneous diagonal descent); 02-F1 (SACP sends work target as MACHINE coord); 02-F3 (leaked G53 → machine-space move); 02-F4 (stale saved origin restored after homing/material change); 02-F11 (zero-valued origin axes dropped); 04-F10/04-F9 (origin-setup failure swallowed, job starts anyway) | high (02-F2/F3); medium (02-F1, firmware-dependent) | 02-F2/F3/F4 all paths; 02-F1 SACP; 04-F9 HTTP |

---

## Ranked findings

Ranking criteria: (1) maps to a reported symptom, (2) severity, (3) verification confidence, (4) fix leverage (how many symptoms one fix addresses). IDs reference the raw files: `01`=state-sync, `02`=motion-safety, `03`=connection-lifecycle, `04`=command-robustness.

### Tier 1 — Fix first (high leverage, high confidence)

**R1. SACP requests have no timeout; disconnect orphans in-flight requests forever.** (04-F2, P0)
Only 7 of ~90 SACP request methods arm a timer; the rest (incl. `requestHome`, `setWorkOrigin`, `SetLaserPower`, `executeGcode`, all subscriptions) pend forever on a lost ACK, and `Communication.dispose()` clears the handler map without rejecting. *Fix:* add a default per-request timeout in the `SacpClient` wrapper that rejects with a distinct `TimeoutError`; on dispose/socket-close, reject all pending handlers. **Single highest-leverage fix** — unblocks R2, R5, and most state-freeze paths. Effort: **M**.

**R2. SM2 over SACP-TCP never reaches `ChannelEvent.Ready` → no instance, no heartbeat, no subscriptions.** (01-F3 / 03-F8, P0)
`SacpTcpChannel.connectionOpen` emits `Ready` only for Artisan/J1. *Fix:* emit `Ready` with the decoded `machineIdentifier` unconditionally (mirroring `SacpSerialChannel`/`SacpUdpChannel`); let `ConnectionManager.onChannelReady` build the right instance. Effort: **S**. *(Only operative if your machine actually opens TCP 8888 — see §6.)*

**R3. `SM2Instance` heartbeat subscribes to almost nothing.** (01-F4 / 04-F3, P0/P1)
Modern `startHeartbeat()` subscribes only to machine-status + purifier — no coordinates, temps, laser power, or the `0x01/0x36` homing-complete handler. *Fix:* give `SM2Instance.onPrepare` the full subscription set + `connection:connected` emit + error-report handler + the homing-complete handler that emits `isHoming:false` (this also fixes the hung homing modal on SACP, R5). Effort: **M**.

**R4. Any new client socket kills the active HTTP status poller; no notification.** (01-F12 / 03-F6, P0)
`connectionManager.onConnection` fires per socket.io connection and unconditionally calls `sstpHttpChannel.stopHeartBeat()`. A 2nd window or a transparent reconnect freezes the UI on the last snapshot while the machine stays live — and an origin/job set from that frozen position is a crash path. *Fix:* remove the unconditional `stopHeartBeat()` from `onConnection` (only stop when a client actually takes over the channel in `connectionOpen`); rebind `channel.setSocket` on reconnect; at minimum emit a state-stale signal. Effort: **S**.

### Tier 2 — Motion safety (do before any live motion testing)

**R5. Homing completion never reported on SM2/SACP → modal hangs, homing "looks" slow; HTTP emits `isHoming:true` *after* completion and never `false`.** (04-F3 + 02-F5, P0/P1)
*Fix (SACP):* register the `0x01/0x36` handler on the SM2 path (folded into R3) and `await channel.goHome()` then invoke the socket ack. *Fix (HTTP):* emit `isHoming:true` *before* G28 and `isHoming:false` after the G28 ack; remove the post-completion `true` emit. Effort: **S–M**.

**R6. "Go to work origin" descends diagonally with no Z-lift; SACP sends the work target as a MACHINE coordinate.** (02-F2 + 02-F1, P0)
Per-axis ordering in `MotionButtonGroup.jsx` is dead code (all axes packed into one move); SACP `coordinateMove` hard-codes `CoordinateType.MACHINE`. *Fix:* issue two sequenced moves (lift/raise Z first when descending, await each ACK); pass `CoordinateType.WORKSPACE` for work-coordinate targets (or convert via `originOffset` before sending). Effort: **M**. *Validation requires the manual live script (motion) — not agent-driven.*

**R7. Leaked modal `G53` leaves the next absolute move in machine space.** (02-F3, P0)
Camera-aid capture sends bare `G53;` and restores `G54` only on success (no `.catch`); HTTP `goHome` restores `G54` only for laser/CNC headTypes. *Fix:* never emit bare `G53` over the wire (chain it on the same line) or wrap every `G53` in try/finally that always restores `G54`; add `.catch` to the camera flow. Effort: **S–M**.

**R8. Origin-setup failures are swallowed; the job starts anyway with the wrong origin/Z.** (04-F10 SACP + 04-F9 HTTP, P0)
`setAbsoluteWorkOrigin` swallows everything in a catch that only logs (with a copy-pasted wrong message); HTTP `executeGcode` *always* reports `result:0` so preparatory Z-moves can fail silently. *Fix:* propagate `response.result`/per-line results; abort job start and emit an error if origin/Z setup fails. Effort: **M**.

**R9. Laser on/off is never reported over SACP and is coerced to `false` every heartbeat.** (01-F2, P0)
Renderer does `compareAndSet(..., 'headStatus', !!headStatus)` unconditionally; SACP never supplies `headStatus`. *Fix:* guard the renderer write with `!isNil(headStatus)`; on SACP derive `headStatus` from `laserTargetPower > 0` and include it in `stateData`. Effort: **S**.

### Tier 3 — Reliability hardening (lower symptom-coupling, still real)

- **R10.** Stale saved work origin silently restored after homing / material / toolhead change, with no plausibility guard (02-F4, P1) — firmware-confirmed the G54 offset survives homing. *Fix:* read back active origin after homing; warn/confirm before any "go to work origin" whose Z target is below current Z; for laser, recompute expected origin Z from focal length + thickness. Effort: **M**.
- **R11.** `connectionOpen` abandons the previous channel without closing it; channel-initiated death never reaches the manager; stale watchdog can force-close the *next* session (03-F1 + 03-F5 + 03-F4, P1). *Fix:* `await channel.connectionClose()` before dropping; emit + handle `ChannelEvent.Disconnected`; clear the heartbeat watchdog in every close path. Effort: **M**.
- **R12.** Protocol detection runs every connect and overwrites the live UDP singleton's `sacpClient`, deafening all subscriptions mid-session (03-F7, P1). *Fix:* use a throwaway client in `test()`; skip detection when already connected to that host; map the discovery `'SACP'` string to a concrete protocol. Effort: **S–M**.
- **R13.** `setWorkOrigin` drops zero-valued axes via truthiness on both protocols (02-F11, P1). *Fix:* test `Number.isFinite(v)` instead of `v &&`. Effort: **S**.
- **R14.** `readyToWork` job-start trigger fires on *any* coordinate-move ACK, incl. a user jog (02-F9, P1). *Fix:* correlate the ACK to the specific preamble request (sequence id); lock out user motion between Start and preamble completion. Effort: **M**.
- **R15.** Multi-call modal sequences (`G53`/`G28`/`G54`, job preamble) are interleavable by user commands; SACP `executeGcode` fires all lines concurrently with no serialization (02-F10 + 04-F16, P1). *Fix:* make modal-critical sequences one atomic queue entry; send SACP G-code lines sequentially; add a channel command mutex. Effort: **M**.
- **R16.** SACP SDK framing/correlation hazards: TCP segment splitting the `0xAA 0x55` magic drops the next packet (04-F7); uint16 sequence wraparound overwrites a pending handler (04-F5); RTO timeout fabricates a `result=2` indistinguishable from a real error (04-F4); checksum failures dropped silently (04-F8). *Fix:* retain trailing `0xAA`; reject-on-collision; reject-with-TimeoutError instead of fake result; log checksum failures. These are SDK-level; R1's timeout makes most recoverable. Effort: **M–L** (SDK patch or wrapper).
- **R17.** ConnectionManager fires async channel methods without await/catch and never invokes the client ack on SACP branches (04-F12 + 04-F11, P1). *Fix:* await inside try/catch; always invoke the ack with `{err}`. Effort: **M**.
- **R18.** Connect-failure / detection-failure paths hang the client (no settle / reply on stale socket) (03-F2 + 03-F3, P1). *Fix:* settle the open promise on TCP error with a timeout; emit the 404 on the request socket. Effort: **S**.
- **R19.** Renderer reload / 2nd tab: server keeps the link bound to a dead socket, new client gets no snapshot (03-F9, P1). *Fix:* implement a re-attach path (rebind socket + replay `connection:connected` + `Marlin:state`). Effort: **M**.
- **R20.** HTTP polling fails silently; enclosure poll errors cache `undefined` and wipe good redux values (01-F7, P1). *Fix:* emit a stale signal on first failure; guard `getEnclosureStatus` against empty/error data. Effort: **S**.

---

## P2 / latent risks (one line each)

- 01-F5 singleton channel fields not reset across sessions → stale module tables on reconnect.
- 01-F6 zombie legacy heartbeat timer (wrong key) emits spurious `connection:close` after reconnect (Artisan/J1).
- 01-F9 server-side enclosure dedup cache survives reconnect → first post-reconnect state suppressed.
- 01-F10 divergent HTTP vs SACP state models; suspected inverted `isHomed` polarity on HTTP (verify live).
- 01-F13 `laserIsLocked`/`laserFocalLength` one-shot at connect; focal-length emit stomps live position with zeros.
- 01-F14 renderer reads stale pre-merge module list for focal length / spindle speed.
- 01-F15 heartBeat worker module-level state may leak across pool tasks.
- 02-F7 jog speed has no lower clamp → Go-To-Origin/Run-Boundary can crawl (also poisons modal G0 feedrate).
- 02-F12 `moveAbsolutely` wire format inconsistent with `requestAbsoluteCooridateMove` (post-probe Z move).
- 02-F13 laser job preamble lowers Z to focus before XY move; laser Run Boundary has no Z lift.
- 02-F14 console can leave G91/G53 active with no re-assert before motion buttons.
- 03-F10 `connectionClose` reports success unconditionally; failed close orphans a live connection.
- 03-F11 discovery subscription last-writer-wins, never cleaned up per client.
- 03-F12 ScheduledTasks handle overwritten per connection; cross-client cancellation.
- 04-F6 stale/late ACKs re-emitted as notifications → garbage state pushed to UI.
- 04-F13 `configureMachineNetwork` only replies on success (and with inverted message).
- 04-F14 HTTP requests without timeouts; 1 Hz pollers can pile up.
- 04-F15 `getGcodeFile` error path dereferences `res.text` when `res` undefined.
- 04-F17 subscription-setup results unchecked; `.then` without `.catch` throughout heartbeat bring-up.

---

## Improvement roadmap (proposed Phase 2)

Suggested fix order, balancing leverage against the need to avoid agent-driven motion. **Tier 1 (R1–R4)** are pure protocol/state-plumbing fixes — unit-testable, no motion, safe to do and validate this session. **Tier 2 (R5–R9)** are the safety-critical motion fixes — code + unit tests this session, physical validation by you afterward via the manual scripts. **Tier 3** is hardening to schedule as time allows.

A realistic ~4–5h Phase 2 slice, pending your pick at the checkpoint:
1. **R1** (SACP timeout + reject-on-dispose) — foundation, unblocks everything SACP.
2. **R4** (don't kill HTTP poller on new socket) — small, removes a common freeze.
3. **R9** (laser on/off reporting) — small, directly fixes a stated symptom.
4. **R2 + R3** (SM2 SACP Ready + full subscriptions + homing-complete) — *if* §6 shows your machine uses SACP; this is the big state-sync + homing-modal fix.
5. **R5** (homing completion reporting) — folds into R3 on SACP; small HTTP fix.
6. **R6 + R7 + R13** (origin-move Z-safety, G53 leak, zero-axis drop) — the bed-crash cluster; code + tests now, you validate motion physically.

Tier 3 (R10–R20) sequenced afterward.

---

## Methodology & coverage

**Audited (full or targeted):** `ConnectionManager.ts`, all channel classes (`SacpChannel`, `SacpTcpChannel`, `SacpUdpChannel`, `SstpHttpChannel`, `SacpSerialChannel`, `TextSerialChannel`, `Channel` base), `SacpClient.ts`, `ProtocolDetector.ts`, `MachineDiscoverer.ts`, machine `instances/*`, `socket/machine-handlers.ts` + wiring, `task-manager/workers/heartBeat.ts`, the vendored `@snapmaker/snapmaker-sacp-sdk` SDK (`Communication.js`, `Dispatcher.js`, `Packet/Header/Response.js`, `TCPConnection.js`), and the relevant renderer redux (`flux/workspace`, `flux/machine`) + control widgets. Firmware ground truth from `Snapmaker2-Controller` (G28/feedrate/coordinate-system modality, homing direction, HMI move order, laser state reporting).

**Verification:** every P0/P1 finding was adversarially re-checked against code and firmware by a second pass. None fully refuted. Four were materially corrected (documented in the raw files' `### Verification` blocks): 01-F2 firmware citation, 01-F6 `removeListener` doesn't throw (leak not exception), 01-F11 coordinate-moves *are* RTO, 03-F4 stale-watchdog scope is SM2/UDP-specific.

**Could NOT be determined statically — resolve live (§6 targets):**
1. **Which transport your machine negotiates** (TCP 8888 vs UDP 8889 vs HTTP). *Decides whether R2/R3 or R4/R5-HTTP are the operative fixes.* — **most important.**
2. `/api/v1/status` and `/api/v1/connect` field set on the closed-source screen: presence of `headStatus`, `homed` polarity (01-F2 HTTP leg, 01-F10).
3. Whether the closed SACP server honors the `coordinateType` byte (02-F1) or uses modal coordinate state.
4. Firmware ACK timing for `0x01/0x35` home vs `0x01/0x36` completion (04-F3 assumes the documented design).
5. Real-world frequency of renderer socket.io reconnects in Electron (how often 01-F12/03-F6 fires without multi-window use).

## §6 — Live read-only check: RESOLVED — this machine uses HTTP

**Performed 2026-06-13, read-only (no motion, no laser).** Machine `192.168.88.6`:

- **Model A350, firmware V1.21.0**, HTTP server `AndServer/2.0.0`.
- **TCP 8888 (SACP-TCP): refused.** SACP-over-TCP is not exposed.
- **UDP 8889 (SACP-UDP): no reply** to the detector's exact `getMachineInfo` (`0x01/0x21`) query, sent via the vendored SDK with the socket bound to local 8889 (faithful replication of `SacpUdpChannel.test`). SACP-over-UDP is not answering.
- **HTTP 8080: open**, serving the Snapmaker API; `/api/v1/status` returns `400` without a token (expected).

**Conclusion:** `ProtocolDetector` (priority TCP→UDP→HTTP) selects **HTTP** for this machine. Despite V1.21.0 being SACP-capable over USB-serial, the Wi-Fi path is legacy HTTP/`AndServer`.

### Consequence for fix prioritization — operative vs non-operative

**Operative over the user's Wi-Fi (HTTP path) — these are the bugs that actually bite:**
- R4 (01-F12/03-F6) — new socket kills HTTP poller → UI freeze. **state-desync.**
- R5-HTTP (02-F5) — `isHoming` emitted `true` after completion, never `false` → homing modal sticks → **likely THE "slow homing" cause.**
- R20 (01-F7) — HTTP poll silent failure; enclosure poll caches `undefined` and wipes good redux values. **state-desync.**
- R6 (02-F2) — go-to-work-origin single-line diagonal descent, no Z-lift. **origin-crash.**
- R7 (02-F3) — leaked `G53` (camera-aid no-`.catch`; `goHome` restores `G54` only for laser/CNC headType). **origin-crash.**
- 04-F9 — HTTP `executeGcode` always reports `result:0` → preparatory `G0 Z<focal+thickness>` can fail silently, job starts at wrong Z. **origin-crash.**
- R13 (02-F11) — `setWorkOrigin` drops zero-valued axes (AB-position/camera flows). **origin-crash contributor.**
- R10 (02-F4) — stale saved origin restored after homing/material/toolhead change (firmware behavior, protocol-independent). **origin-crash.**
- R9 (01-F2) — laser on/off: renderer coerces `!!headStatus` unconditionally; whether HTTP `/api/v1/status` supplies `headStatus` still unverified (needs a tokened capture), but the renderer guard fix is correct regardless. **state-desync.**
- 01-F8, 02-F6, 02-F7 — module hot-plug one-shot; F-less travel-move feedrates; unclamped jog speed. (lower priority)

**NOT operative over Wi-Fi (SACP-only) — deprioritized for this machine** (still latent if the user ever connects via USB-serial, which uses SACP):
- R1 (04-F2 SACP no-timeout), R2 (01-F3 SACP-TCP Ready), R3 (01-F4 SM2 SACP subscriptions), 02-F1 (SACP MACHINE coord), 04-F3 (SACP homing-complete), 04-F10 (SACP origin-setup swallow).

**Revised Phase 2 (HTTP-focused) recommended order:** R4 → R5-HTTP → R20 → R6 → R7 → 04-F9 → R13 → R10 → R9. All are unit-testable as logic; the motion-sequencing ones (R6/R7/R10) get a manual live-validation script for the user.

### Live capture (2026-06-13) — COMPLETED, read-only
Auth handshake (confirmed working sequence): `POST /api/v1/connect` (no token) → `{token, readonly:false, series:"Snapmaker 2.0 A350", headType:4, hasEnclosure:true}` (**`headType:4` = 10W laser**); tap **Allow** on touchscreen; `POST /api/v1/connect` **with** `token=` → authorized; then `GET /api/v1/status?token=` → `200`. The flow is **fragile** (many spurious `401 "Machine is not connected yet."` before the second connect POST completes it; `disconnect` with token also returns `401`) — corroborates the connection-lifecycle/auth findings.

**Captured `/api/v1/status` body:**
```json
{"status":"IDLE","x":112,"y":130,"z":150,"homed":false,"offsetX":0,"offsetY":0,"offsetZ":0,
 "toolHead":"TOOLHEAD_LASER_2","laserFocalLength":31,"laserPower":0,"laserCamera":true,
 "laser10WErrorState":0,"workSpeed":1500,"printStatus":"Idle",
 "moduleList":{"enclosure":true,"rotaryModule":false,"emergencyStopButton":false,"airPurifier":false},
 "isEnclosureDoorOpen":false,"doorSwitchCount":0}
```

**Confirmed:**
- **01-F2 HTTP leg CONFIRMED (R9 operative):** no `headStatus` field — laser on/off is NOT reported over HTTP, only numeric `laserPower`. Renderer's unconditional `compareAndSet(..., 'headStatus', !!headStatus)` forces the toggle `false` every poll. *Fix:* derive on/off from `laserPower > 0` and guard `!isNil`.
- **01-F10 HTTP polarity is NOT a bug:** `homed` is a correct boolean (`false` = not homed); HTTP `isHomed: data.homed` is right. Only SACP int-inverts. Drop the HTTP-inversion concern.
- **Useful for feature specs:** status exposes `laserFocalLength`, `laser10WErrorState`, `laserCamera:true`, `toolHead` (`TOOLHEAD_LASER_2`), `isEnclosureDoorOpen`, `doorSwitchCount`, `workSpeed`, and coarse `moduleList` presence booleans (refreshed every 2 s poll — so enclosure hot-plug DOES update; only the detailed `module_list` *identity* endpoint is one-shot, the 01-F8 nuance).
