# Audit 04: Command/ACK Robustness (SACP + HTTP command paths)

Scope: `SacpClient.ts`, `SacpChannel.ts`, `SstpHttpChannel.ts`, `ConnectionManager.ts`, and the SACP packet layer.

**Packet/framing layer identified (exact path):**
`node_modules/@snapmaker/snapmaker-sacp-sdk/` (package `@snapmaker/snapmaker-sacp-sdk` v0.1.1, compiled JS only, no TS sources vendored). Relevant files:
- `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Dispatcher.js` (request dispatch, retry, ack)
- `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Communication.js` (sequence numbers, request/response correlation, timeouts, TCP reassembly/framing)
- `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Packet.js`, `Header.js`, `Response.js` (wire format; sequence is uint16, `Header.js:48,61`)
- `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/connection/TCPConnection.js` (raw socket write, no error/backpressure handling)

How correlation works: `Dispatcher.send()` builds a header with `sequence = communication.getSequence()` (`Dispatcher.js:133`) and registers a resolver under requestId = `"<commandSet*256+commandId>-<sequence>"` (`Communication.js:93`). An incoming packet with `attribute === ACK` is matched by the same key (`Communication.js:201-211`). Responses can therefore arrive out of order safely *as long as* the handler is still in the map.

---

## Request method table

Legend:
- **Timeout?** — "none" = `isRTO` defaults to `false`, so `Communication.send()` never starts a timer (`Communication.js:95-108`); the promise can pend **forever**. "RTO 2s×3" = `isRTO=true`: 2 s timer, up to 2 resends, then *resolves* with a fabricated response `result=2` (`Communication.js:96-107`).
- **Retry?** — only RTO requests retry (same sequence number, `Dispatcher.js:145-149`).
- **Error surfaced?** — "hang" = lost ack/disconnect leaves the promise pending forever, caller never learns; "fake-2" = timeout is reported as a normal response with `result=2`, indistinguishable from a firmware error code; "TypeErr" = a transport rejection is swallowed by `Dispatcher.js:145-150` (catch returns `undefined`), so the `.then(({response}) => …)` destructure throws `TypeError` instead of a meaningful error.

| Method (SacpClient.ts line) | Timeout? | Retry? | Error surfaced to caller? |
|---|---|---|---|
| `executeGcode` (179) | none | no | hang / TypeErr |
| `logFeedbackLevel` (185) | none | no | hang / TypeErr |
| `subscribeLogFeedback` (191) | none | no | hang / TypeErr |
| `unSubscribeLogFeedback` (197) | none | no | hang / TypeErr |
| `getPrintingFileInfo` (203) | none | no | hang / TypeErr |
| `subscribeGetPrintCurrentLineNumber` (222) | none | no | hang / TypeErr |
| `unSubscribeGetPrintCurrentLineNumber` (228) | none | no | hang / TypeErr |
| `subscribeGetPrintingTime` (234) | none | no | hang / TypeErr |
| `subscribeGetPrintingProgress` (240) | none | no | hang / TypeErr |
| `subscribeGetPrintingEstimatedTime` (246) | none | no | hang / TypeErr |
| `getEmergencyStopInfo` (320) | none | no | hang / TypeErr |
| `takePhoto` (327) | none | no | hang / TypeErr |
| `getCameraCalibration` (339) | none | no | hang / TypeErr |
| `getPhoto` (349) | none | no | hang / TypeErr |
| `getCalibrationPhoto` (365) | none | no | hang / TypeErr |
| `setMatrix` (381) | none | no | hang / TypeErr |
| `startScreenPrint` (386) | none | no | hang / TypeErr |
| `getLaserMaterialThickness` (394) | none | no | hang / TypeErr |
| `setWorkOrigin` (412) | **none** | no | hang / TypeErr |
| `moveAbsolutely` (425) | none | no | hang / TypeErr |
| `getLaserToolHeadInfo` (443) | none | no | hang / TypeErr |
| `getLaserLockStatus` (455) | none | no | hang / TypeErr |
| `getCrosshairOffset` (472) | none | no | hang / TypeErr |
| `setCrosshairOffset` (488) | none | no | hang / TypeErr |
| `getFireSensorSensitivity` (503) | none | no | hang / TypeErr |
| `setFireSensorSensitivity` (518) | none | no | hang / TypeErr |
| `subscribeHeartbeat` (534) | none | no | hang / TypeErr |
| `unsubscribeHeartbeat` (540) | none | no | hang / TypeErr |
| `configureNetwork` (546) | none | no | hang / TypeErr |
| `exportLogToExternalStorage` (560) | none (also waits on 0x01/0x17 handler with no timeout) | no | hang |
| `getModuleInfo` (592) | none | no | hang / TypeErr |
| `getMachineInfo` (599) | none | no | hang / TypeErr |
| `getMachineSize` (607) | none | no | hang / TypeErr |
| `getNetworkConfiguration` (619) | none | no | hang / TypeErr |
| `getNetworkStationState` (637) | none | no | hang / TypeErr |
| `getCurrentCoordinateInfo` (645) | none | no | hang / TypeErr |
| `updateCoordinate` (652) | none | no | hang / TypeErr |
| `subscribeCurrentCoordinateInfo` (658) | none | no | hang / TypeErr |
| `unSubscribeCurrentCoordinateInfo` (664) | none | no | hang / TypeErr |
| `movementInstruction` (670) | none | no | hang / TypeErr |
| **`requestHome` (677)** | **none** | no | **hang / TypeErr** |
| `requestAbsoluteCooridateMove` (684) | RTO 2s×3 | yes (same seq) | fake-2 on timeout |
| `getErrorReports` (697) | RTO 2s×3 | yes | fake-2 |
| `startPrint` (704) | RTO 2s×3 | yes | fake-2 |
| `stopPrint` (711) | RTO 2s×3 | yes | fake-2 |
| `pausePrint` (717) | RTO 2s×3 | yes | fake-2 |
| `resumePrint` (723) | RTO 2s×3 | yes | fake-2 |
| `resumePrintForScreen` (729) | none | no | hang / TypeErr |
| `getGocdeFile` (735) | none | no | hang / TypeErr |
| `laserCalibration` (742) | none | no | hang / TypeErr |
| `laserCalibrationSave` (749) | none | no | hang / TypeErr |
| `SetLaserPower` (755) | none | no | hang / TypeErr |
| `SetBrightness` (762) | none | no | hang / TypeErr |
| `SetFocalLength` (771) | none | no | hang / TypeErr |
| `TemperatureProtect` (780) | none | no | hang / TypeErr |
| `SetLaserLock` (791) | none | no | hang / TypeErr |
| `GetFDMInfo` (800) | none | no | hang / TypeErr |
| `subscribeNozzleInfo` (808) / `unSubscribeNozzleInfo` (814) | none | no | hang / TypeErr |
| `GetHotBed` (820) | none | no | hang / TypeErr |
| `subscribeHotBedTemperature` (828) / `unSubscribeHotBedTemperature` (834) | none | no | hang / TypeErr |
| `subscribeEnclosureInfo` (840) / `subscribeEnclosureLightInfo` (846) / `subscribePurifierInfo` (852) | none | no | hang / TypeErr |
| `subscribeWorkSpeed` (858) / `unSubscribeWorkSpeed` (865) | none | no | hang / TypeErr |
| `SetExtruderTemperature` (871) | none | no | hang / TypeErr |
| `SetFilamentstatus` (881) | none | no | hang / TypeErr |
| `SwitchExtruder` (891) | none | no | hang / TypeErr |
| `SetExtruderSpeed` (900) | none | no | hang / TypeErr |
| `SetExtruderOffset` (910) | RTO 2s×3 | yes | fake-2 |
| `GetExtruderOffset` (917) | none | no | hang / TypeErr |
| `ExtruderMovement` (924) | none | no | hang / TypeErr |
| `uploadFile` (933) | none (resolution depends on 0xb0/0x02 handler) | no | hang; send-reject surfaced via `reject` (996-998) |
| `uploadFileCompressed` (1016) | none (resolution depends on 0xb0/0x02 handler) | no | hang; start-failure surfaced (1178-1198) |
| `setHotBedTemperature` (1232) | none | no | hang / TypeErr |
| `subscribeCncSpeedState` (1243) / `subscribeLaserPowerState` (1249) | none | no | hang / TypeErr |
| `setCncPower` (1255) | none | no | hang / TypeErr |
| `setToolHeadSpeed` (1264) | none | no | hang / TypeErr |
| `switchCNC` (1273) | none | no | hang / TypeErr |
| `setWorkSpeed` (1283) / `getWorkSpeed` (1293) | none | no | hang / TypeErr |
| `wifiConnection` (1301, explicit `isRTO=false`) | none | no | hang / TypeErr |
| `wifiConnectionHeartBeat` (1314) | none | no | hang / TypeErr |
| `wifiConnectionClose` (1320) | none | no | hang / TypeErr |
| `getEnclousreInfo` (1327) | none | no | hang / TypeErr |
| `setEnclosureLight` (1341) | none | no | hang / TypeErr |
| `setEnclosureDoorEnabled` (1350) | none | no | hang / TypeErr |
| `setEnclosureFan` (1361) | none | no | hang / TypeErr |
| `getAirPurifierInfo` (1370) | none | no | hang / TypeErr |
| `setPurifierSpeed` (1384) / `setPurifierSwitch` (1393) | none | no | hang / TypeErr |
| `upgradeFirmwareFromFile` (1404) | none (resolution depends on 0xad handlers) | no | hang; send-reject surfaced (1443-1444) |
| `setMotorPowerHoldMode` (1449) | none | no | hang / TypeErr |

Summary: **only 7 of ~90 request methods have any timeout/retry** (`requestAbsoluteCooridateMove`, `getErrorReports`, `startPrint`, `stopPrint`, `pausePrint`, `resumePrint`, `SetExtruderOffset`). Everything else — including **homing**, **set work origin**, **laser power**, and **all G-code execution** — waits forever on a lost ack.

### Answers to the specific questions

**Late or out-of-order ack:** Correlation is `businessId-sequence`, so genuinely out-of-order ACKs resolve the right promise (`Communication.js:201-211`). But for RTO requests, after the third 2 s timer the handler is deleted and a *fabricated* success-shaped response with `result=2` is resolved (`Communication.js:98-103`). If the real ACK then arrives, no handler exists, so the ACK is re-emitted as a `'request'` event (`Communication.js:213-216`); `Dispatcher.packetHandler` will deliver it to any *subscription* listener registered for that businessId (`Dispatcher.js:100-103`) — i.e., a stale command response can be misinterpreted as a push notification — otherwise it is silently dropped (`Dispatcher.js:104-108`). Note `handler.hasResponse` is set `false` at creation (`Communication.js:91`) and **never set to true anywhere** in the SDK; the retry timer's `!handler_1.hasResponse` guard is therefore dead logic, and only promise-already-settled semantics prevent double resolution.

**Sequence-number reuse:** `getSequence()` is a shared uint16 counter `(seq++) % 0xffff` (`Communication.js:69-73`). It is incremented for every send (including 1 Hz subscriptions' setup and every poll/command), so it wraps after 65,535 sends. There is **no check that the new requestId is free**: `requestHandlerMap.set(requestId, handler)` (`Communication.js:93`) silently overwrites any pending handler with the same businessId+sequence, orphaning the old promise forever. Because non-RTO requests never time out, a hung request *will* still be in the map when the sequence wraps. `sendSequenceSame()` (`Dispatcher.js:154-174`) reuses the current sequence by design (unused by Luban code; grep found no callers).

**Backpressure/serialization during a running job:** SACP: **none whatsoever**. `Communication.send` writes straight to the socket (`Communication.js:94`, `TCPConnection.js:14-16`); `SacpChannelBase.executeGcode` even fires all lines of a multi-line program **concurrently** via `Promise.all` (`SacpChannel.ts:234-239`), so ordering at the machine is only as good as TCP + firmware queueing, and user commands interleave freely with the ~8 concurrent 1 Hz subscriptions during a job. HTTP: only `executeGcode` is serialized through `gcodeQueue`/`isGcodeExecuting` (`SstpHttpChannel.ts:124-126, 406-430`); every other endpoint (`startGcode`, `pauseGcode`, overrides, enclosure polls at 1 Hz) is sent immediately and can interleave with a draining G-code queue.

---

## F1: SDK `Dispatcher.send` swallows all non-retry errors and resolves `undefined`
- **Location:** `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Dispatcher.js:145-150` (consumers: `src/server/services/machine/sacp/SacpClient.ts:180,186,204,…` — every `.then(({ response }) => …)`)
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** The catch handler only handles `err.message === 'Retry send'`; any other rejection (e.g. `'invalid SACP packet'` from `Communication.js:117`, or a future write error) falls through and the catch **returns `undefined`**, converting the rejection into a *fulfillment with `undefined`*. Every SacpClient method then destructures `({ response, packet })` from `undefined`, throwing `TypeError: Cannot destructure property 'response' of undefined`. The original error is lost, and callers get a confusing TypeError — or, where the result is only logged, nothing at all.
- **Evidence:** `Dispatcher.js:145-150`: `.catch(function (err) { if (err.message === 'Retry send') { …return _this.send(…); } })` — no `throw err`/`return Promise.reject` branch. Consumer example `SacpClient.ts:179-183`: `return this.send(…).then(({ response, packet }) => …)`.
- **Proposed fix:** In the catch, rethrow unknown errors (`throw err`). In Luban, guard `res?.response` before destructuring or wrap `send` with a typed result.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `Dispatcher.js:145-150` quoted verbatim: `.catch(function (err) { if (err.message === 'Retry send') { ... return _this.send(...); } })` — no `else`/`throw`, so any non-"Retry send" rejection makes the catch return `undefined` (a fulfillment). Source of the swallowed reject: `Communication.send` rejects `new Error('invalid SACP packet')` for buffers < 15 bytes (`Communication.js:116-117`) and `Dispatcher.send` itself rejects `'communication not initialize'` when `this.communication` is null (`Dispatcher.js:152`). Consumers destructure `({ response, packet })` from the result, e.g. `SacpClient.executeGcode` (`:180`), `setWorkOrigin` (`:412-423` returns raw `send`), confirming the TypeError-on-undefined path.
- **Notes:** Confirmed. Note `'communication not initialize'` is rejected from `Dispatcher.send` *before* the `.then/.catch` chain is attached (`:152` is the function-level fallback return), so that particular reject is NOT swallowed by the `:145` catch — it propagates as a real rejection. The swallowed cases are the in-chain rejects: `'invalid SACP packet'` and any future `connection.write` throw. Substance of the finding stands. P1 appropriate.

## F2: No timeout for ~90% of SACP requests; disconnect orphans all in-flight requests
- **Location:** `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Communication.js:77-118` (timer only when `isRTO`), `Communication.js:47-54` (`dispose()` does `requestHandlerMap.clear()` without rejecting), `src/server/services/machine/channels/SacpTcpChannel.ts:39-48` (socket `close` only emits UI event), `SacpTcpChannel.ts:216,232` (`sacpClient.dispose()`)
- **Severity:** P0
- **Symptom mapping:** slow-homing, state-desync
- **Confidence:** high
- **What happens:** `Communication.send()` only arms a timeout when `isRTO === true`. All other requests (see table — includes `requestHome`, `setWorkOrigin`, `updateCoordinate`, `SetLaserPower`, `executeGcode`) register a resolver and wait indefinitely. If the ack is lost (Wi-Fi drop, firmware busy during homing, framing loss per F7), the promise pends forever: `await`-chains in SacpChannel (`goHome` at `SacpChannel.ts:1261-1270`, `setAbsoluteWorkOrigin` at 1510-1550) never complete, and the UI flow they drive (e.g. dismissing the homing modal) never finishes. Worse, on disconnect `dispose()` *clears* the handler map without calling any `fail` reject (`Communication.js:52`), and the TCP `close` handler (`SacpTcpChannel.ts:39-48`) doesn't reject them either — so every in-flight command at disconnect leaks a forever-pending promise and the caller is never told the command failed.
- **Evidence:** `Communication.js:84-109`: timer block is inside `if (isRTO)`; `handler_1.fail`(`reject`) is referenced nowhere except the RTO retry path. `Communication.js:47-54`: `dispose()` → `this.requestHandlerMap.clear()`. `SacpClient.ts:677-682`: `requestHome` uses `this.send(0x01, 0x35, …)` with no `isRTO` arg.
- **Proposed fix:** Add a default per-request timeout (configurable, e.g. 10-30 s) that rejects with a distinct `TimeoutError`; on `dispose()`/socket close, iterate `requestHandlerMap` and `fail(new Error('disconnected'))` each pending handler before clearing.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `Communication.send` (`Communication.js:77-119`): the `setTimeout` timer block is entirely inside `if (isRTO)` (`:95-108`); for `isRTO===false` it just registers the handler (`:86-93`), writes, and returns the Promise — no timer, pends forever on lost ack. `dispose()` (`:47-54`): `this.requestHandlerMap.clear()` with NO iteration/`fail()` of pending handlers — confirmed verbatim. `SacpTcpChannel.ts:39-48` `'close'` handler only emits `connection:close` to the UI, does not reject in-flight requests; `connectionClose` calls `sacpClient.dispose()` (`:216,232`) which → `Dispatcher.dispose` (`Dispatcher.js:83-89`) → `Communication.dispose` (clear without reject). Spot-checked the request table: `requestHome` (`SacpClient.ts:677-682`) `send(0x01,0x35,...)` no isRTO; `setWorkOrigin` (`:412-423`) no isRTO; `executeGcode` (`:179-183`) no isRTO; `wifiConnection` explicit `false` (`:1308`). RTO callers confirmed: `requestAbsoluteCooridateMove` (`:687` `true`), `getErrorReports`/`startPrint`/`stopPrint`/`pausePrint` (`:698,706,712,718` `true`).
- **Notes:** Confirmed exactly, including "only RTO requests arm a timer" and "dispose clears without rejecting." The "~90%" is consistent with the table (7 RTO of ~90 methods). P0 strongly justified (homing/origin/laser/all G-code can hang forever). This is the SDK root-cause that several src/ findings (F3, F10, F11, F12, F16) depend on.

## F3: `goHome` never reports completion on the SACP path — homing modal hangs (SM2)
- **Location:** `src/server/services/machine/ConnectionManager.ts:1292-1296` (callback never invoked, `goHome` not awaited), `src/server/services/machine/channels/SacpChannel.ts:830-846` (the only `isHoming:false` emitter, registered in `startHeartbeatLegacy`), `src/server/services/machine/instances/SM2Instance.ts:7-12` (SM2 uses modern `startHeartbeat`, never `startHeartbeatLegacy`), `src/app/flux/workspace/index.ts:647-659, 986-992`
- **Severity:** P0
- **Symptom mapping:** slow-homing
- **Confidence:** high
- **What happens:** On `SocketEvent.GoHome`, `ConnectionManager.goHome` for SACP protocols calls `this.channel.goHome(headType)` (un-awaited) and emits `move:status {isHoming: true}` — and never calls the socket.io ack `callback` (only the non-SACP branch calls it, line 1301). The client opens a blocking `homingModal` and closes it only on the ack callback or on `move:status {isHoming:false}`. The *only* server-side emitter of `isHoming: false` is the `0x01/0x36` home-completion handler registered inside `startHeartbeatLegacy` (`SacpChannel.ts:830-846`) — which is only ever invoked by Artisan/J1/Ray instances (`instances/ArtisanInstance.ts:89`, `J1Instance.ts:90`, `RayInstance.ts:111`). `SM2Instance.onPrepare` calls the modern `startHeartbeat()` which never registers that handler. So on a Snapmaker 2.0 over SACP, homing completion is structurally unreported: the modal stays up until the user gives up or something else resets state — perceived as homing taking forever. Combined with F2 (requestHome has no timeout), even the internal `await` may never resolve.
- **Evidence:** Grep of server tree shows exactly three `isHoming` emit sites: `ConnectionManager.ts:1296,1305` (`true`) and `SacpChannel.ts:845` (`false`). `machine-handlers.ts:17` maps `SocketEvent.GoHome` directly to `connectionManager.goHome`; `SocketManager/index.ts:90-96` passes the client ack as the last param, which the SACP branch ignores.
- **Proposed fix:** In the SACP branch, `await this.channel.goHome()` and then invoke `callback`/emit `move:status {isHoming:false}` based on the `requestHome` ack result; register the `0x01/0x36` completion handler in the modern heartbeat path too (or in `SacpChannelBase` setup).
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `ConnectionManager.goHome` (`:1292-1311`): SACP branch (`:1294-1296`) does `this.channel.goHome(headType)` (un-awaited) + `socket.emit('move:status', {isHoming:true})` and never calls `callback` (only the non-SACP else-branch calls `callback()` at `:1301`). `machine-handlers.ts:17` maps `SocketEvent.GoHome → connectionManager.goHome`; `SocketManager` passes the client ack as the last param (`:90-96`) which the SACP branch drops. `isHoming:false` emit sites: `grep -rn isHoming src/server` → exactly `ConnectionManager.ts:1296,1305` (`true`) and `SacpChannel.ts:845` (`false`). The `:845` emitter is inside the `setHandler(0x01,0x36, ...)` registered ONLY in `startHeartbeatLegacy` (`SacpChannel.ts:830-846`). `SM2Instance.onPrepare` (`SM2Instance.ts:7-12`) calls `this.channel.startHeartbeat()` (modern) — never `startHeartbeatLegacy`. Artisan/J1/Ray call `startHeartbeatLegacy` (`ArtisanInstance.ts:89`, `J1Instance.ts:90`, `RayInstance.ts:111`).
- **Notes:** Confirmed structurally. The 0x36 handler gap for SM2 over modern heartbeat is real; combined with F2 (requestHome no timeout) and the un-awaited call, the homing modal has no completion path on SM2/SACP. Caveat (audit Open Question #2): exact firmware ack timing for 0x01/0x35 vs 0x01/0x36 is unverified, but the *client-side structural gap* (no emitter is even registered on the SM2 path) holds regardless of firmware. Note: SM2-over-SACP also depends on reaching the modern heartbeat at all — over TCP it never reaches Ready (file 03 F8), so this bites SM2 over UDP. P0 reasonable given safety relevance; flag the firmware-timing dependency.

## F4: RTO timeout fabricates a normal-looking response (`result=2`); dead `hasResponse` guard
- **Location:** `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Communication.js:96-107`; consumers `src/server/services/machine/channels/SacpChannel.ts:1309-1330` (`stopGcode`/`pauseGcode`/`resumeGcode`)
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** For RTO requests, after the third transmission times out, the SDK **resolves** the promise with a hand-built packet whose payload is `Buffer.alloc(1, 2)`, which `Response.fromBuffer` decodes as `result === 2` (`Response.js:14-16`). Callers like `stopGcode()` (`SacpChannel.ts:1309-1314`) just compare `response.result === 0`, so a *network timeout* is indistinguishable from *firmware rejected the command with error code 2*. A stop/pause that timed out may actually have been executed by the machine after the timeout — Luban then believes the stop failed while the machine stopped (or vice versa). Additionally `handler.hasResponse` is never set `true` anywhere in the SDK (grep: only `Communication.js:91,98,104`), so the "did we get a response" guard in the timer is permanently false and only already-settled-promise semantics prevent misbehavior.
- **Evidence:** `Communication.js:98-103`: `packet.payload = Buffer.alloc(1, 2); resolve(packet);`. `Dispatcher.js:141-144` then decodes it as a genuine `Response`.
- **Proposed fix:** Reject with a `TimeoutError` instead of resolving a fake result code; set `hasResponse = true` when the ACK matches; surface timeout distinctly in SacpChannel so callers can re-query machine status instead of assuming failure.
- **Upstream-relevant:** yes

## F5: uint16 sequence wraparound can silently overwrite a pending request handler
- **Location:** `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Communication.js:69-73` (`getSequence`), `Communication.js:83-93` (unconditional `requestHandlerMap.set`), `Header.js:48` (uint16 on the wire)
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** The sequence counter is shared across all commands and wraps modulo 0xffff. When a wrapped sequence collides with a still-pending request of the same businessId (guaranteed possible because non-RTO requests never time out, F2), `requestHandlerMap.set(requestId, handler_1)` replaces the old entry: the old promise can never settle (its resolver is unreachable), and the eventual ACK — whichever transmission it answers — resolves the *new* request, potentially with the *old* command's response payload. Long sessions with 1 Hz subscriptions plus job polling pass 65k sends in under a day.
- **Evidence:** `Communication.js:83-93`: `var handler_1 = this.requestHandlerMap.get(requestId); … _this.requestHandlerMap.set(requestId, handler_1);` — the pre-existing handler is consulted only to bump `sendTime`, never to reject or defer.
- **Proposed fix:** On collision, reject the previous handler first (or skip sequences that are still pending). Pair with F2's default timeout so collisions can't accumulate.
- **Upstream-relevant:** yes

## F6: Stale/late ACKs are re-emitted as notifications to subscription listeners
- **Location:** `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Communication.js:207-216`, `Dispatcher.js:96-109`
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** medium
- **What happens:** When an ACK arrives and no handler matches (deleted by RTO fake-resolution F4, by `dispose()`, or overwritten per F5), `reolvePacketBuffer` falls into the `else` branch and `emit('request', packet)` (`Communication.js:213-216`). `Dispatcher.packetHandler` first checks `listenerCount(businessIdStr) > 0` and, if any *subscription* exists on that businessId, decodes the stale command response as a notification payload and feeds it to subscription callbacks (`Dispatcher.js:100-103`). Subscription callbacks in SacpChannel parse these buffers positionally (`new GetHotBed().fromBuffer(data.response.data)` etc., `SacpChannel.ts:954-1018`), so a mis-routed packet produces garbage state pushed to the UI.
- **Evidence:** Call chain above; subscription and request command-IDs share the same `businessId` keyspace (`Dispatcher.evalBusinessId`, `Dispatcher.js:118-120`).
- **Proposed fix:** In `reolvePacketBuffer`, drop unmatched ACK packets (optionally log), and only emit `'request'` for `Attribute.REQUEST` packets.
- **Upstream-relevant:** yes

## F7: Framing loss when a TCP segment boundary splits the 0xAA 0x55 magic
- **Location:** `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Communication.js:120-161` (`receive()` scan loop)
- **Severity:** P1
- **Symptom mapping:** slow-homing, state-desync
- **Confidence:** high
- **What happens:** When not mid-packet, `receive()` scans `for (i = 0; i < buffer.byteLength - 1; i++)` looking for `buffer[i]===0xaa && buffer[i+1]===0x55`. If a chunk **ends with a lone trailing 0xAA** (the next packet's first magic byte — a legal TCP segmentation point), the loop cannot match it (needs `i+1`), `isIncompleteBuffer` remains `false` (it is cleared at line 124 whenever `byteLength >= 7`), and the function returns with the trailing byte discarded. The next chunk then starts with `0x55 …` which never matches the magic, so the **entire following packet is dropped**. If that packet was the ACK to a non-RTO request, the request hangs forever (F2); if it was a heartbeat notification, the 10 s heartbeat watchdog (`SacpChannel.ts:174-180`) may force-close the connection. The partial-header branch (`Communication.js:147-151`) only saves the tail when the *full two-byte* magic was seen.
- **Evidence:** `Communication.js:125`: `for (var i = 0; i < buffer.byteLength - 1; i++)`; no post-loop handling of a trailing `0xaa`; `Communication.js:155-160` only triggers when `isIncompleteBuffer` was set, which the lone-0xAA case never sets.
- **Proposed fix:** After the scan, if the last unconsumed byte is `0xaa`, retain it in `receiveBuffer` (set `receiving=true, remainLength=-1`). More generally, keep all unconsumed trailing bytes instead of discarding them.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `Communication.receive` (`Communication.js:120-161`), not-receiving branch. When `buffer.byteLength >= 7`, line 124 sets `isIncompleteBuffer = false`; the scan loop `for (i = 0; i < buffer.byteLength - 1; i++)` (`:125`) inspects pairs `(i, i+1)`, so the final byte at index `byteLength-1` is never examined as a potential lead `0xaa`. If the chunk ends in a lone `0xaa` and no earlier complete magic triggered the incomplete-buffer/remainLength path, the loop exits with `isIncompleteBuffer` still false → the `if (isIncompleteBuffer)` tail (`:155-160`) does not run → the trailing `0xaa` is dropped (function returns, `receiveBuffer` not appended). Next chunk starts at `0x55...`, never matches `0xaa 0x55`. The mid-packet save paths (`:140-144` remainLength, `:147-151` incomplete) only engage when a full two-byte magic + CRC8 were seen.
- **Notes:** Confirmed as a real boundary bug. Practical exploitability depends on TCP actually splitting precisely between the two magic bytes — uncommon but legal and non-zero over a busy/lossy link; the consequence chain (drop ACK → F2 hang; drop heartbeat → F3-file03 watchdog force-close) is sound. Note: not exercised on UDP (datagram = whole packet), only the TCP stream channel — audit Open Question #3 already flags UDP framing. P1 is defensible but the trigger is narrow; "high" confidence applies to the code path, not to field frequency.

## F8: Checksum/CRC failures silently drop packets with no NAK or retry signal
- **Location:** `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Communication.js:197-223` (`reolvePacketBuffer` + `validateChecksum`), `Communication.js:128-129` (CRC8 header check)
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** If the payload checksum fails, `reolvePacketBuffer` skips processing and clears `receiveBuffer` (`Communication.js:198,222`) — the packet vanishes with no log, no NAK, no retransmit request. Combined with F2, a corrupted ACK for any non-RTO request permanently hangs that command. Header CRC8 mismatches similarly cause the scanner to treat real header bytes as garbage and continue scanning inside the packet body, which can desynchronize framing until the next clean magic.
- **Evidence:** `Communication.js:197-223`: `if (this.validateChecksum(…)) { … } this.receiveBuffer = Buffer.alloc(0);` — no else branch.
- **Proposed fix:** Log checksum failures with counters; with F2's timeout in place, the request layer will at least recover by timing out instead of hanging.
- **Upstream-relevant:** yes

## F9: HTTP `executeGcode` always reports success — failures invisible to all callers
- **Location:** `src/server/services/machine/channels/SstpHttpChannel.ts:406-430` (`consumeGCodeQueue`), `SstpHttpChannel.ts:387-404` (`_executeGcode`), `SstpHttpChannel.ts:435-458` (`executeGcode`)
- **Severity:** P1
- **Symptom mapping:** origin-crash, state-desync
- **Confidence:** high
- **What happens:** `_executeGcode` *resolves* `{ code }` on error (line 397-398) — it never rejects and sets no failure flag. `consumeGCodeQueue` ignores per-line results and always invokes the queue item's callback with `result: 0` (lines 423-426). `executeGcode`'s `result === 0` branch is therefore always taken; the `result: -1` branch (lines 447-450) is **dead code**. Every consumer that gates on success — `turnOnTestLaser` (487-493), `setSpindleSpeed` (530-531), `spindleOn/Off` (552-560), and crucially `ConnectionManager.startGcode`'s pre-job Z-height/origin moves over HTTP (`ConnectionManager.ts:700-736`) — believes the command succeeded even when the request timed out or the machine returned an error. For a laser job this means the `G53 G0 Z<focal+thickness>` move can fail silently and the job starts at the wrong Z — a head-crash/wrong-focus scenario.
- **Evidence:** `SstpHttpChannel.ts:423-426`: `splice.callback && splice.callback({ result: 0, text: results.join('\n') });` unconditionally. `ConnectionManager.ts:741-754`: `Promise.all(promises).then(() => { this.channel.uploadGcodeFile(…); … this.channel.startGcode(options); })` — starts the job regardless (and has no `.catch` either).
- **Proposed fix:** Make `_executeGcode` resolve a structured `{ ok, code, text }`; propagate the worst per-line result through `consumeGCodeQueue` into the callback; in `startGcode`, abort and emit an error event if any preparatory move failed.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `_executeGcode` (`SstpHttpChannel.ts:387-404`): on `err` it `resolve({ code })` (`:397-398`) — resolves, never rejects, no failure flag. `consumeGCodeQueue` (`:406-430`): collects only `text` from each line (`:417-420`), ignores any error/code, and unconditionally calls `splice.callback({ result: 0, text: ... })` (`:423-426`). `executeGcode` (`:435-458`): callback's `result===0` branch always taken → resolves `{result:0}`; the `result:-1` branch (`:447-450`) is dead. Consumers gating on success confirmed: `turnOnTestLaser` (`:487-493`), `setSpindleSpeed` (`:530-531`), `spindleOn/Off` (`:552-560`). `ConnectionManager.startGcode` HTTP path pushes `executeGcode(...)` promises (`:702-736`) then `Promise.all(promises).then(() => { uploadGcodeFile...; startGcode... })` (`:741-754`) with no `.catch` and no result inspection.
- **Notes:** Confirmed exactly, including the dead `result:-1` branch. The origin-crash scenario (silent failure of `G53;\nG0 Z<focal+thickness>;\nG54;` preparatory move at `:704`/`:710`) is real for the HTTP/SM2 laser path. P1 appropriate (arguably borders P0 given origin-crash mapping, but leaving severity to author). Mechanism overlaps the "result not checked / job starts anyway" theme of F10/F12 on the HTTP side specifically.

## F10: `setAbsoluteWorkOrigin` catch swallows failures; job start proceeds with wrong origin
- **Location:** `src/server/services/machine/channels/SacpChannel.ts:1510-1550` (catch at 1547-1549), `SacpChannel.ts:1288-1307` (`setWorkOrigin` ignores result), callers `ConnectionManager.ts:664-689` (`startGcode` SACP laser path)
- **Severity:** P0
- **Symptom mapping:** origin-crash
- **Confidence:** high
- **What happens:** Before a SACP laser job, `startGcode` awaits `laserSetWorkHeight` → `setAbsoluteWorkOrigin`, which wraps the whole sequence (`updateCoordinate` → `getCurrentCoordinateInfo` → `updateCoordinate(WORKSPACE)` → `setWorkOrigin`) in `try { … } catch (e) { log.error(…) }` — the catch (with a copy-pasted misleading message "getLaserMaterialThickness error") only logs. `startGcode` then continues to `coordinateMove({Z:0})` and starts the job. If any of the four round-trips failed or returned `result!==0` (none of the `response.result`s are checked — `setWorkOrigin` at `SacpClient.ts:412-423` returns the raw response and `SacpChannel.setWorkOrigin:1303-1305` just logs `res.data`), the machine runs the job with the **previous** work origin / wrong Z work height. The same pattern applies to `coordinateMove` (`SacpChannel.ts:1282-1285`) which logs and emits a console string but returns nothing — `ConnectionManager.startGcode:689` awaits it but cannot see failure.
- **Evidence:** `SacpChannel.ts:1547-1549`: `catch (e) { log.error(\`getLaserMaterialThickness error: ${e}\`); }`. `ConnectionManager.ts:673-689`: sequential `await this.channel.laserSetWorkHeight(…)`, `await this.channel.setAbsoluteWorkOrigin(…)`, `await this.channel.coordinateMove(…)` with no result checks and no try/catch of its own.
- **Proposed fix:** Make `setAbsoluteWorkOrigin`/`laserSetWorkHeight`/`coordinateMove` return success booleans derived from each `response.result`; rethrow or return false from the catch; in `startGcode`, abort job start and emit `SocketEvent.StartGCode {err}` when origin setup fails.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `SacpChannel.setAbsoluteWorkOrigin` (`:1510-1550`): wraps `updateCoordinate(MACHINE)` → `getCurrentCoordinateInfo` → `updateCoordinate(WORKSPACE)` → `setWorkOrigin(newCoord)` in `try { ... } catch (e) { log.error(\`getLaserMaterialThickness error: ${e}\`); }` (`:1547-1549`) — confirmed verbatim, including the copy-pasted misleading message; no rethrow, no result check; method returns `void`/undefined. `SacpChannel.setWorkOrigin` (`:1288-1307`): `await this.sacpClient.setWorkOrigin(...).then(res => log.info(\`Set Work Origin: ${res.data}\`))` — `response.result` never inspected. `coordinateMove` (`:1272-1286`): logs `res.response.result` and emits a `serialport:read` string, returns undefined. `SacpClient.setWorkOrigin` (`:412-423`) returns raw `send` result. `ConnectionManager.startGcode` SACP laser path (`:664-689`): sequential `await laserSetWorkHeight(...)`, `await setAbsoluteWorkOrigin(...)`, `await coordinateMove(...)` — none returns a checkable value, no try/catch, and job proceeds to upload+start via the shared `Promise.all(promises).then(...)` (`:741-754`).
- **Notes:** Confirmed exactly. Because `setAbsoluteWorkOrigin` swallows internally AND its callers can't read a result, a failed/timed-out origin sequence (e.g. F2 hang resolved by reconnect, or a `result!==0`) silently proceeds to cut at the previous origin/Z — a genuine origin-crash. P0 justified. `laserSetWorkHeight` (`:1553-1573`) calls `setAbsoluteWorkOrigin` and likewise returns void, reinforcing the chain.

## F11: Fire-and-forget command methods in SacpChannel leave Luban state wrong on failure
- **Location:** `src/server/services/machine/channels/SacpChannel.ts:695-702` (`setFilterWorkSpeed`), `1367-1377` (`switchExtruder` — result ignored), `1382-1394` (`updateNozzleTemperature` — failure ignored), `1396-1419`/`1421-1444` (`loadFilament`/`unloadFilament` — line 1432 `ExtruderMovement` not awaited), `1446-1460` (`updateBedTemperature` — `.then` with no catch, result ignored), `1492-1508` (`updateWorkSpeed` — results only logged), `1288-1307` (`setWorkOrigin`), `SacpTcpChannel.ts:101` (`wifiConnectionHeartBeat()` floating)
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** These public command methods either don't await the SACP ack, or await it and discard `response.result`. Callers in `ConnectionManager` (`switchExtruder:944`, `updateNozzleTemperature:962`, `updateBedTemperature:977-978`, `updateWorkSpeedFactor:1022`, `setWorkOrigin:1332`, `loadFilament:995`, `unloadFilament:1008`) likewise don't await or check, and never emit a failure event to the client. Example: `switchExtruder` — if the firmware rejects the nozzle switch (`response.result !== 0`), Luban's `currentWorkNozzle` bookkeeping and the UI's active-extruder display continue as if it succeeded until the next nozzle-info subscription packet contradicts it; a queued `loadFilament` for the wrong nozzle can then act on the wrong extruder. `updateBedTemperature`'s un-caught `.then()` chain also converts any F1-style TypeError into an unhandled rejection.
- **Evidence:** `SacpChannel.ts:1375`: `await this.sacpClient.SwitchExtruder(module.key, newExtruderIndex);` — return value discarded, method returns `void`. `SacpChannel.ts:1457-1459`: `this.sacpClient.setHotBedTemperature(…).then(() => { log.info(…) });` — success logged unconditionally, no `.catch`.
- **Proposed fix:** Have each command method `await` the ack, return `boolean` from `response.result === 0`, and have ConnectionManager emit the corresponding SocketEvent error so the UI can revert optimistic state.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `SacpChannel.switchExtruder` (`:1367-1377`): `await this.sacpClient.SwitchExtruder(module.key, newExtruderIndex)` — return discarded, method returns void. `updateNozzleTemperature` (`:1382-1394`): checks `response.result===0` only to log, no failure signal. `loadFilament` (`:1396-1419`)/`unloadFilament` (`:1421-1444`): `unloadFilament` line 1432 `this.sacpClient.ExtruderMovement(...)` not awaited. `updateBedTemperature` (`:1446-1460`): `this.sacpClient.setHotBedTemperature(...).then(() => log.info(...))` — no `.catch`, result ignored (`:1457-1459`). `updateWorkSpeed` (`:1492-1508`): results only logged. `setWorkOrigin` (`:1288-1307`) as in F10. `SacpTcpChannel.ts:101` `this.sacpClient.wifiConnectionHeartBeat()` floating (un-awaited). Callers in ConnectionManager (`switchExtruder:944`, `updateNozzleTemperature:962`, `updateBedTemperature:977-978`, `updateWorkSpeedFactor:1022`, `loadFilament:995`, `unloadFilament:1008`, `setWorkOrigin:1332`) do not await and emit no failure event.
- **Notes:** Confirmed. The `updateBedTemperature` un-caught `.then()` does convert an F1-style undefined-destructure TypeError into an unhandled rejection (it has no `.catch`). Optimistic-state-drift (e.g. `currentWorkNozzle` after a rejected `SwitchExtruder`) is real. P1 appropriate. Overlaps F10/F12 on the unchecked-result theme; the distinct angle here is the fire-and-forget *command* methods (vs F10's origin-setup sequence).

## F12: ConnectionManager fires async channel methods without await/catch — silent flow death and hung client acks
- **Location:** `src/server/services/machine/ConnectionManager.ts:651` (`startGcodeAction`), `741-754` (`Promise.all(...).then()` with no `.catch`), `1295` (`goHome`), `1322` (`coordinateMove`), `1332` (`setWorkOrigin`), `944`, `962`, `977-978`, `1242` (`startHeartbeat`); rejection sink: `src/server/app.js:294-300`; dispatch glue: `src/server/lib/SocketManager/index.ts:90-96`
- **Severity:** P1
- **Symptom mapping:** state-desync, slow-homing
- **Confidence:** high
- **What happens:** Socket events map straight onto async ConnectionManager methods (`machine-handlers.ts:9-87`); `SocketManager` invokes them and discards the returned promise (`SocketManager/index.ts:92-95`). Inside, many channel calls are not awaited and have no `.catch`. When one rejects (e.g. F1's TypeError from a swallowed transport error, or `this.channel` being `null` after close), the rejection reaches the process-level `unhandledRejection` logger (`app.js:298-300`) — the process survives, but the flow dies *silently*: no socket event is emitted, and the client's ack callback (third argument, e.g. `coordinateMove`'s `callback`, `setWorkOrigin`'s `callback`) is never invoked on SACP paths even on success (`ConnectionManager.ts:1321-1326, 1331-1341` call `callback` only in the non-SACP else-branch). The client UI waits forever (see F3 for the homing-specific case).
- **Evidence:** `ConnectionManager.ts:1313-1327`: SACP branch `this.channel.coordinateMove({…})` — no `await`, no `callback()`. `app.js:298-300`: `process.on('unhandledRejection', … log.error …)`.
- **Proposed fix:** `await` channel calls inside try/catch; always invoke the socket ack callback with an `{ err }` payload in both branches.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `machine-handlers.ts:9-87` maps socket events directly to async ConnectionManager methods; `SocketManager.onConnection` wraps them as `socketEventFn = (...params) => callback(socket, ...params)` and registers via `socket.on(event, socketEventFn)` (`:90-96`) — the returned promise is discarded. `ConnectionManager.coordinateMove` (`:1313-1327`): SACP branch `this.channel.coordinateMove({...})` un-awaited, no `callback()`; else-branch calls `callback()` (`:1325`). `setWorkOrigin` (`:1329-1342`): SACP branch un-awaited, no callback; else-branch calls `callback()` (`:1340`). `goHome` (`:1295`) as F3. `startGcode` `Promise.all(...).then()` no `.catch` (`:741-754`). `app.js:294-300` confirmed: process-level `uncaughtException`/`unhandledRejection` only `log.error`.
- **Notes:** Confirmed. The client ack (3rd param to `coordinateMove`/`setWorkOrigin`) is genuinely never invoked on SACP even on success, so any UI flow awaiting that ack hangs; combined with F2 the rejection-on-null-channel path is also real. P1 appropriate. Strongly overlaps F3 (homing is the specific case) and the fire-and-forget theme of F11 — note as a family: the systemic issue is "ConnectionManager SACP branches don't await, don't catch, and don't always ack."

## F13: `configureMachineNetwork` only replies on success (and with an inverted message)
- **Location:** `src/server/services/machine/ConnectionManager.ts:1448-1473` (lines 1461-1466)
- **Severity:** P2
- **Symptom mapping:** none
- **Confidence:** high
- **What happens:** `if (success) { socket.emit(eventName, { err: !success, msg: 'Failed to configure network' }) }` — on success the client receives `err: false` with a failure message; on **failure nothing is emitted at all**, so the client's wait for `eventName` hangs.
- **Evidence:** Lines cited; compare with the `else` unsupported branch which does emit.
- **Proposed fix:** Emit unconditionally: `socket.emit(eventName, { err: !success, msg: success ? '' : 'Failed to configure network' })`.
- **Upstream-relevant:** yes

## F14: HTTP requests without timeouts; 1 Hz pollers can pile up requests
- **Location:** `src/server/services/machine/channels/SstpHttpChannel.ts:856-874` (`getEnclosureStatus`, no `.timeout()`, polled every 1000 ms from line 265), `754-762` (`getActiveExtruder`), `764-934` (all override/filament/enclosure POSTs — none set timeouts), `711-719` (`getLaserMaterialThickness`), `721-752` (`getGcodeFile`)
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** superagent has no default timeout; these requests can hang indefinitely on a wedged machine HTTP server. `getEnclosureStatus` is fired by `setInterval` every second (`SstpHttpChannel.ts:264-265`) without awaiting the previous one, so a slow machine accumulates concurrent sockets and stale responses can arrive out of order — older enclosure state overwriting newer (`isEqual` dedup at 862 compares against whatever arrived last, not newest-issued). `_executeGcode`'s 300 s timeout (line 391) also means a single dead G-code request stalls the serialized queue (and any UI flow awaiting `executeGcode`) for 5 minutes.
- **Evidence:** Lines cited; contrast `getModuleInfo` (588) which does set `.timeout(1000)`.
- **Proposed fix:** Add `.timeout({ response: 2000-5000 })` to all polling/command requests; skip a poll tick when the previous one is still in flight; lower `_executeGcode` timeout to seconds.
- **Upstream-relevant:** yes

## F15: `getGcodeFile` error path dereferences `res.text` when `res` may be undefined
- **Location:** `src/server/services/machine/channels/SstpHttpChannel.ts:727-732`
- **Severity:** P2
- **Symptom mapping:** none
- **Confidence:** high
- **What happens:** On a connection-level error (ECONNREFUSED, timeout) superagent invokes the callback with `err` set and `res === undefined`; the code emits `{ msg: err?.message, text: res.text }` — `res.text` throws `TypeError` inside the callback, which surfaces as an uncaught exception in the superagent callback context (caught only by the global `uncaughtException` logger, `app.js:294-296`), and the client never receives the event.
- **Evidence:** `SstpHttpChannel.ts:728-732`: `if (err) { this.socket.emit(eventName, { msg: err?.message, text: res.text }); }` — note `err?.` is guarded but `res` is not.
- **Proposed fix:** Use `text: res?.text ?? ''`.
- **Upstream-relevant:** yes

## F16: SACP `executeGcode` sends all lines concurrently; no command serialization at all on SACP
- **Location:** `src/server/services/machine/channels/SacpChannel.ts:231-254`; packet layer `Communication.js:94` (direct socket write)
- **Severity:** P1
- **Symptom mapping:** state-desync, origin-crash
- **Confidence:** medium
- **What happens:** Multi-line G-code (`gcode.split('\n')`) is dispatched as parallel `sacpClient.executeGcode` requests via `Promise.all` — each is an independent SACP request written immediately to the socket. Ordered execution of e.g. `G53\nG0 Z10\nG54` depends entirely on the firmware processing 0x01/0x02 requests strictly in arrival order, with no application-level guarantee; and a failure of line 2 doesn't stop line 3 (results are only inspected after all complete, lines 242-248). Unlike the HTTP channel (which has `gcodeQueue`), the SACP path has no queue, so jog commands, laser-power changes and origin commands issued in quick succession from the UI can interleave. Additionally, if any line's promise rejects (F1 TypeError), `Promise.all` rejects and the caller (`ConnectionManager.executeGcode:424`) has no try/catch → unhandled rejection, client ack never fires.
- **Evidence:** `SacpChannel.ts:234-239`: `gcodeLines.forEach(…promises.push(this.sacpClient.executeGcode(_gcode))); const results = await Promise.all(promises);`
- **Proposed fix:** Send lines sequentially (`for … await`), stop at first non-zero result; consider a per-channel command queue mirroring SstpHttpChannel's.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `SacpChannelBase.executeGcode` (`SacpChannel.ts:231-254`): `gcode.split('\n')`, then `gcodeLines.forEach(_gcode => promises.push(this.sacpClient.executeGcode(_gcode)))` and `const results = await Promise.all(promises)` (`:235-239`) — all lines dispatched concurrently, results inspected only after all settle (`:242-248`), so a failure of an earlier line does not stop later lines (they're already in flight). `SacpClient.executeGcode` → `send(0x01,0x02,...)` no isRTO (`:179-183`). `Communication.send` writes straight to socket (`:94`) → `TCPConnection.write` = `this.socket.write(buffer)` with no return/backpressure/error handling (`TCPConnection.js:14-16`). No queue/serialization on the SACP channel (contrast `SstpHttpChannel.gcodeQueue`/`isGcodeExecuting` `:124-126,406-430`). `ConnectionManager.executeGcode` (`:420-430`) `await this.channel.executeGcode(gcode)` has no try/catch.
- **Notes:** Confirmed. The "medium" confidence is apt: ordered execution depends on firmware processing 0x01/0x02 in arrival order, which static analysis cannot rule in or out — the *application* provides no ordering guarantee, which is the verifiable part. The `Promise.all` rejection → unhandled rejection → client ack never fires path is real (ties to F1/F12). Note the UDP channel overrides `executeGcode` to send a single request (`SacpUdpChannel.ts:122-136`), so this concurrency issue is specific to the TCP/serial base `executeGcode`. P1 defensible for the no-serialization + unhandled-rejection aspects.

## F17: Subscription setup results unchecked / `.then` without `.catch` throughout heartbeat bring-up
- **Location:** `src/server/services/machine/channels/SacpChannel.ts:160-162, 815-827, 884-886, 963-965, 1019-1021, 1050-1052, 1063-1065, 1075-1077, 1116, 1117-1120, 1145-1147, 1161-1163, 1175-1177`
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** Every `subscribe*` call during heartbeat bring-up uses `.then(res => log.info(...))` with no `.catch` and no failure handling. If a subscription request hangs (F2) or resolves `undefined` (F1 → `res.response.result` throws inside the `.then`, becoming an unhandled rejection), Luban simply never receives that data stream — no temperatures, no coordinates, no job progress — while believing the connection is healthy. There is no retry or verification that subscriptions are active.
- **Evidence:** e.g. `SacpChannel.ts:160-162`: `this.sacpClient.subscribePurifierInfo({interval:1000}, cb).then(res => { log.info(\`…${res.response.result}\`); });`
- **Proposed fix:** Await each subscribe, check `res.code/response.result`, retry or surface a connection-degraded event on failure; add `.catch` everywhere.
- **Upstream-relevant:** yes

---

## Coverage

Files read in full:
- `src/server/services/machine/sacp/SacpClient.ts` (1456 lines)
- `src/server/services/machine/channels/SacpChannel.ts` (1597 lines)
- `src/server/services/machine/channels/SstpHttpChannel.ts` (968 lines)
- `src/server/services/machine/ConnectionManager.ts` (1538 lines)
- `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Dispatcher.js`
- `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Communication.js`
- `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/connection/TCPConnection.js`

Files read in part (targeted):
- `src/server/services/machine/channels/SacpTcpChannel.ts` (lines 1-260; connection open/close, client lifecycle)
- `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/{Packet.js,Header.js,Response.js}` (framing/decoding spots)
- `src/server/services/socket/machine-handlers.ts`, `src/server/lib/SocketManager/index.ts` (event dispatch / ack plumbing)
- `src/server/services/machine/instances/SM2Instance.ts`; grepped `ArtisanInstance.ts`/`J1Instance.ts`/`RayInstance.ts` for `startHeartbeatLegacy`
- `src/server/app.js` (global `uncaughtException`/`unhandledRejection` handlers, lines 294-300)
- `src/app/flux/workspace/index.ts` (homingModal lifecycle, lines 630-995), `src/app/flux/workspace/MachineAgent.ts:254-256`
- grepped `SacpSerialChannel.ts`/`SacpUdpChannel.ts` for dispose/Ready/error handling

Open questions:
1. **SM2-over-SACP Ready path:** `SacpTcpChannel.connectionOpen` emits `ChannelEvent.Ready` only for Artisan and J1 (`SacpTcpChannel.ts:104-117`); it is unclear where (or whether) an A150/A250/A350 on SACP-over-TCP firmware gets a `Ready` → `SM2Instance` → `startHeartbeat()` at all, vs. relying on the UDP channel (`SacpUdpChannel.ts:86` emits Ready unconditionally). This belongs to the connection-lifecycle audit but directly affects which heartbeat path (and thus the F3 home-done handler gap) is active.
2. **Firmware ack semantics for 0x01/0x35 (home):** does the SM2 firmware ack immediately and send 0x01/0x36 on completion, or ack only after homing completes? Static code supports either; F2/F3 severity assumes the documented 0x36-completion design. Needs firmware cross-verification (Task 6).
3. **UDP wrapper framing:** `SacpUdpChannel` constructs `SacpClient('udp', …)`; whether `Communication.receive()`'s TCP-stream reassembly assumptions (F7) are also exercised on UDP datagram boundaries was not verified.
4. Whether the `@snapmaker/snapmaker-sacp-sdk` source repo (not vendored here) has fixed any of F1/F2/F4-F8 in versions later than 0.1.1.
