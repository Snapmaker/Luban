# Audit 01 — State Synchronization (Wi-Fi, Snapmaker 2.0, SACP-capable firmware, 10W laser)

Static code audit of Luban's machine-state pipeline:
`machine -> channel (SstpHttpChannel / SacpTcpChannel+SacpChannel) -> socket.io event -> redux (src/app/flux/workspace) -> UI widgets`.

## State-field inventory (event-driven vs polled vs write-once)

| Field (redux `workspace.*`) | HTTP (SstpHttpChannel) | SACP Wi-Fi (SacpTcpChannel) | Written on |
|---|---|---|---|
| `workflowStatus` | polled 2s (`heartBeat.ts:76`, emitted `SstpHttpChannel.ts:372`) | SACP heartbeat subscription 1s (`SacpChannel.ts:884`, emit 870-877) | every beat |
| `workPosition`, `originOffset`, `isHomed` | polled 2s (`SstpHttpChannel.ts:344-358`) | subscription 0x01/0xa2 (`SacpChannel.ts:1022-1052`) buffered into closure, flushed on heartbeat | every beat |
| `laserPower` | polled 2s (spread of `/api/v1/status` body, `SstpHttpChannel.ts:341`) | subscription 0x12/0xa1 (`SacpChannel.ts:1066-1077`) buffered, flushed on heartbeat | every beat |
| `headStatus` (laser on/off toggle) | only if `/api/v1/status` returns it (unverifiable, closed-source screen) | **never produced** (no field in `stateData`); renderer coerces `undefined -> false` (`workspace/index.ts:485`) | every beat (forced) |
| `moduleList` (attach state) | `module_list` fetched **once** at connect (`SstpHttpChannel.ts:261`); `module_info` polled 1s (`:269`) merges *info* only | never emitted (`machine:module-list` only exists in HTTP channel) | write-once |
| `moduleStatusList` (rotary/enclosure/e-stop/purifier presence) | from status payload if present | computed **once** in `startHeartbeatLegacy` (`SacpChannel.ts:895-941`), frozen in closure, re-emitted forever | write-once |
| enclosure settings (`Marlin:settings`) | polled 1s with change-dedup (`SstpHttpChannel.ts:264-265`, 856-874) | subscription 0x15/0xa0 (`SacpChannel.ts:1121-1147`) | every change |
| `laserIsLocked` | never | one-shot at connect (`SacpTcpChannel.ts:156-161`) | write-once |
| `laserFocalLength` | via 1s `module_info` merge (`workspace/index.ts:563-570`) | one-shot at connect (`SacpTcpChannel.ts:126-154`) | write-once (SACP) |
| `headType`/`toolHead`/`series` | snapshot of `/api/v1/connect` (`SstpHttpChannel.ts:201-249`), spread **over** live data each beat (`:341-342`) | inferred once from `getModuleInfo()` (`SacpChannel.ts:369-379`, 910-922) | write-once |
| temperatures / nozzle info | polled 2s (flat fields) | subscriptions 0x14/0xa0, 0x10/0xa0 buffered, flushed on heartbeat | every beat |

Workflow status semantics also differ: HTTP lowercases the screen's status string (`SstpHttpChannel.ts:345`); SACP maps a status byte through `WORKFLOW_STATUS_MAP` (`SacpChannel.ts:184`, `src/app/constants/index.ts:41-53`).

---

## F1: SACP "legacy heartbeat" freezes module/toolhead state in a closure; all subscription data flushed only via heartbeat

- **Location:** `src/server/services/machine/channels/SacpChannel.ts:802-1178` (closure `stateData` at :806, `moduleStatusList` at :808-813, emit at :870-877; module scan once at :889-941)
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** `startHeartbeatLegacy()` builds `stateData` and `moduleStatusList` as **function-local closure variables**. `getModuleInfo()` is called exactly once (`:889`); the presence of rotary module, enclosure, e-stop button, air purifier, and the toolhead identity (`stateData.headType`, `stateData.toolHead`, :910-951) are computed once and then re-emitted verbatim with every heartbeat (`:870-877`). Any machine-side module change (hot-plug purifier/e-stop, toolhead swap) is never re-queried for the lifetime of the connection. Additionally, every other subscription callback (hot bed :954, nozzle :966, coordinates :1022, CNC speed :1053, laser power :1066, enclosure :1121, purifier :1165) only mutates the closure `stateData`; nothing is emitted to the client until the next heartbeat callback runs, so all module data is gated on the heartbeat subscription staying alive.
- **Evidence:** `let stateData: MarlinStateData = {};` (:806) → mutated by 8 callbacks → emitted only in `subscribeHeartCallback` (:848-878) as `{...stateData, moduleStatusList, status, moduleList: moduleStatusList}`. No re-invocation of `getModuleInfo()` anywhere after :889. Note also :893 resets `this.moduleInfos = {}` and repopulates with raw `MODULEID_MAP` (:924-940), bypassing `getModuleIdentifier()`'s dual-extruder disambiguation used at :353.
- **Proposed fix:** Re-query `getModuleInfo()` periodically (or subscribe to SACP module-change report if available) and emit a dedicated `machine:module-list` event; decouple emission of subscription data from the heartbeat callback (emit per-subscription, throttled).
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** Re-read `SacpChannel.startHeartbeatLegacy` (`SacpChannel.ts:802-1178`): `let stateData` (:806), `moduleStatusList` closure (:808-813), single `getModuleInfo()` call (:889), all 8 subscription callbacks (hotbed :954, nozzle :966, coordinate :1022, cnc :1053, laser :1066, gcodeLine :1080, enclosure :1121, purifier :1165) only mutate the closure `stateData`; sole emit of `Marlin:state` in `subscribeHeartCallback` (:870-877) as `{...stateData, moduleStatusList, status, moduleList: moduleStatusList}`. Confirmed line :893 `this.moduleInfos = {}` then repopulates with raw `MODULEID_MAP` (:924-940), bypassing `getModuleIdentifier()` dual-extruder disambiguation used at :353 in `getModuleInfo()`.
- **Notes:** All cited lines accurate. No re-invocation of `getModuleInfo()` after :889 found anywhere in the channel. The auditor's `headType`/`toolHead` line range "910-951" is correct (head inference :910-922, toolHead :943-951). No mitigating re-query path exists. Note this finding is only operative for instances that call `startHeartbeatLegacy` (Artisan/J1/Ray via `_onMachineReadySACP`); SM2Instance uses the sparse `startHeartbeat` and is covered by F4. Severity P1 appropriate.

## F2: Laser on/off (`headStatus`) is never reported over SACP and is coerced to `false` every beat — the UI laser toggle cannot reflect machine-side changes

- **Location:** `src/app/flux/workspace/index.ts:485` (`compareAndSet(data, currentState, 'headStatus', !!headStatus)`); `src/server/services/machine/channels/SacpChannel.ts:1066-1077`; `src/app/ui/widgets/ConnectionToolControl/LaserToolControl.tsx:40,98`
- **Severity:** P0
- **Symptom mapping:** state-desync
- **Confidence:** high (SACP path); medium (whether HTTP `/api/v1/status` supplies `headStatus` — closed source)
- **What happens:** Full trace of "is the laser on": the motion controller reports only a numeric `laser_power` to the screen (`Snapmaker2-Controller/snapmaker/src/service/system.cpp:1771-1773`, `sta.laser_power`; there is no boolean on/off in `SystemStatus_t`). On the Luban side, the renderer derives the laser toggle from redux `headStatus` (`LaserToolControl.tsx:40` `useState<boolean>(headStatus)`, re-synced at :98 `setLaserPowerOpen(headStatus)`). Redux `headStatus` is written only in the `Marlin:state` handler at `workspace/index.ts:485` — and because the value is coerced with `!!headStatus` it is **never nil**, so `compareAndSet` writes `false` whenever the channel doesn't supply the field. The SACP channel never supplies it: `stateData` (SacpChannel.ts) has `laserPower`/`laserTargetPower` (:1069-1073) but no `headStatus` key. Result: toggling the laser from the touchscreen (or via job execution) is at best reflected in the power read-out and never in the on/off toggle; over SACP it is actively forced off each heartbeat.
- **Evidence:** Emit path SACP: `subscribeLaserPowerState` (SacpClient.ts:1249-1253, command 0x12/0xa1) → callback `SacpChannel.ts:1066-1074` → closure `stateData.laserPower` → heartbeat emit :870-877 → `'Marlin:state'` → `workspace/index.ts:440-447` (laserPower) and :485 (`headStatus` forced `!!undefined === false`) → `LaserToolControl.tsx:98`.
- **Proposed fix:** In the renderer, only update `headStatus` when the field is present (`!isNil(headStatus)` guard like the neighbouring fields); on SACP, derive `headStatus` from `laserTargetPower > 0` (already parsed at SacpChannel.ts:1068) and include it in `stateData`.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** Renderer `Marlin:state` handler in `workspace/index.ts`: confirmed the cited line reads `compareAndSet(data, currentState, 'headStatus', !!headStatus);` and is UNCONDITIONAL (no `!isNil` guard), unlike the neighbouring `laserPower`/`temperature`/`moduleStatusList`/`airPurifier` blocks which are all `!isNil`-guarded. SACP `subscribeLaserPowerCallback` (`SacpChannel.ts:1066-1074`) writes only `laserPower` (currentPower) and `laserTargetPower` into `stateData`; no `headStatus` key. Grepped the whole `src/server` tree — no SACP code path emits a `headStatus` field. Firmware ground truth (sub-agent verified): `Snapmaker2-Controller` reports only numeric laser power to the screen (`system.cpp:1843` `tmp_u32 = (uint32_t)(laser->power()*1000)`; struct field `system.h:207 laser_power_cnc_rpm`); internal `is_laser_on` (`system.cpp:175,724`) is never serialized to the screen. `laser->state()` getter (`toolhead_laser.h:236`) is unused in any report path.
- **Notes:** Confirmed on every leg. Minor citation nit: the auditor names `sta.laser_power` / lines 1771-1773 in system.cpp — that exact name exists only in a dead `#if 0` block; the live numeric field is `laser_power_cnc_rpm` (system.h:207, written at system.cpp:1843). Substance (numeric only, no boolean) is correct. The HTTP-side medium-confidence caveat (whether `/api/v1/status` supplies `headStatus`) remains unknowable-statically (closed-source screen) but does not affect the SACP P0 verdict. Severity P0 appropriate.

## F3: SM2 (A150/A250/A350) over SACP-TCP never gets `ChannelEvent.Ready` — no machine instance, no heartbeat, no state subscription at all

- **Location:** `src/server/services/machine/channels/SacpTcpChannel.ts:104-117`; `src/server/services/machine/ConnectionManager.ts:205-251`; `src/server/services/machine/instances/SM2Instance.ts:7-12`; `src/server/services/machine/ProtocolDetector.ts:104-119`
- **Severity:** P0
- **Symptom mapping:** state-desync
- **Confidence:** high that the code path is dead; medium that a real SM2 screen exposes TCP:8888 (needs live verification)
- **What happens:** `ProtocolDetector.detectNetworkProtocol()` prefers SACP-over-TCP whenever port 8888 accepts a connection (:111-112), falling back to HTTP only if 8888/8889 fail. If a "SACP-capable" SM2 touchscreen opens port 8888, Luban selects `sacpTcpChannel` (ConnectionManager.ts:311-312). But `SacpTcpChannel.connectionOpen()` emits `ChannelEvent.Ready` **only** for Artisan (:108-112) and J1 (:113-117) — even though `SACP_TYPE_SERIES_MAP` (src/app/constants/machines.ts:425-432) maps types 0/1/2 to A150/A250/A350, i.e., the code anticipates SM2 over SACP. Without `Ready`, `ConnectionManager.onChannelReady` never runs, `SM2Instance` is never created, `SM2Instance.onPrepare()` (`startHeartbeat()`) is never called, and no SACP subscription is ever made. The renderer also never receives `connection:connected` (which is only emitted by the legacy-heartbeat path or by the HTTP poller's first beat, SstpHttpChannel.ts:360-367). The client either hangs at "Connecting" or, if shown connected, displays a永frozen state. There is also a dead-code fallback: `connectionManager.startHeartbeat` (ConnectionManager.ts:1240-1243) is registered nowhere (`machine-handlers.ts` has no entry for it, and grep finds no caller).
- **Evidence:** `SacpTcpChannel.ts:106` computes `machineIdentifier = SACP_TYPE_SERIES_MAP[machineInfos.type]` then tests only `SnapmakerArtisanMachine.identifier` and `SnapmakerJ1Machine.identifier`. Compare `SacpSerialChannel.ts:85-92` and `SacpUdpChannel.ts:83-88` which emit `Ready` unconditionally for whatever machine is detected.
- **Proposed fix:** Emit `ChannelEvent.Ready { machineIdentifier }` unconditionally in `SacpTcpChannel.connectionOpen()` (mirroring the serial/UDP channels) and let `ConnectionManager.onChannelReady` decide which instance to build; pair with F4 so SM2's `onPrepare` actually subscribes to state.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed (code path); unknowable-statically (whether a real SM2 screen opens TCP:8888 in the field)
- **Checked:** `SacpTcpChannel.connectionOpen` (re-read :104-117): `machineIdentifier = SACP_TYPE_SERIES_MAP[machineInfos.type]` (:106), then emits `ChannelEvent.Ready` ONLY inside `if (machineIdentifier === SnapmakerArtisanMachine.identifier)` (:108-112) and `if (=== SnapmakerJ1Machine.identifier)` (:113-117). No `else`/unconditional emit. Compared `SacpSerialChannel`/`SacpUdpChannel` which emit Ready unconditionally (auditor's claim). `ProtocolDetector.detectNetworkProtocol` (:104-120) runs all three probes via `Promise.allSettled` and returns `SacpOverTCP` first when the TCP probe fulfils (:111-112), HTTP only as fallback (:115) — confirms TCP preference. `SM2Instance` (full file, 15 lines) `onPrepare` calls only `this.channel.startHeartbeat()`. Dead-code fallback confirmed: `connectionManager.startHeartbeat` (`ConnectionManager.ts:1240-1242`) has NO registration in `machine-handlers.ts` and no client `SocketEvent.StartHeartbeat` usage (grepped `src/app`).
- **Notes:** Mechanism fully confirmed. The one unverifiable leg is whether recent SM2 touchscreen firmware actually listens on TCP:8888 (closed-source screen) — if it does not, the HTTP fallback is taken and F3 does not fire in the field. The auditor already flags this as the medium-confidence portion and lists it as open question #1. Severity P0 appropriate conditional on the screen exposing 8888.

## F4: `SM2Instance.onPrepare`/new-style `startHeartbeat()` subscribes only to machine status + air purifier — coordinates, temperatures, laser power, module status would stay permanently stale

- **Location:** `src/server/services/machine/channels/SacpChannel.ts:165-208`; `src/server/services/machine/instances/SM2Instance.ts:7-12`
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** The non-legacy `startHeartbeat()` used by `SM2Instance` subscribes only to the heartbeat report (workflow status, :205) and purifier info (:206). It never subscribes to coordinates (0x01/0xa2), hot-bed (0x14/0xa0), nozzle (0x10/0xa0), CNC speed (0x11/0xa0), laser power (0x12/0xa1), or enclosure (0x15/0xa0) — all of which the legacy path wires up for Artisan/J1 (`startHeartbeatLegacy`, :953-1177). It also never emits `connection:connected`, so the renderer's connect handshake (workspace/index.ts:119-243) can't complete on this path. Today this is reachable for SM2 over SACP-serial (SacpSerialChannel emits Ready unconditionally); over Wi-Fi it is the second half of the F3 dead-end.
- **Evidence:** `startHeartbeat()` body contains exactly two subscriptions (`SacpChannel.ts:205-206`); `SM2Instance.onPrepare` calls only `this.channel.startHeartbeat()` (SM2Instance.ts:11) and registers no error-report handler (`registerErrorReportHandler` is only called from Artisan/J1/Ray instances, e.g. ArtisanInstance.ts:91).
- **Proposed fix:** Make `SM2Instance.onPrepare` perform the same module scan + subscription set as `ArtisanInstance._onMachineReadySACP()` (module info, coordinate info, `connection:connected` emit, full subscription set, error-report handler).
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `SacpChannel.startHeartbeat` (re-read :165-208): body subscribes to exactly two things — `subscribeHeartbeat({interval:2000}, ...)` (:205) and `this.subscribePurifierInfo()` (:206). The heartbeat callback emits only `Marlin:state {state:{status}}` (:198-202) — no pos/originOffset/temps/laser/enclosure. No coordinate (0x01/0xa2), hotbed, nozzle, cnc, laser-power, or enclosure subscription, and no `connection:connected` emit, no 0x36 home handler, no `setROTSubscribeApi`/`registerErrorReportHandler`. `SM2Instance.onPrepare` (full file) calls only `await this.channel.startHeartbeat()`. Confirmed `registerErrorReportHandler` is called only from ArtisanInstance:91, J1Instance:92, RayInstance:118 — never SM2Instance (grepped instances dir).
- **Notes:** All claims confirmed. Note the heartbeat interval is 2000 ms here (:205) vs the legacy path's 1000 ms — a minor correction to the inventory table row which says SACP heartbeat is "1s"; that 1s figure is the legacy path (:884), the new SM2 path is 2s. Does not change the finding. Reachable today over SACP-serial (SacpSerialChannel emits Ready unconditionally) and would be the second half of the F3 Wi-Fi dead-end. Severity P1 appropriate.

## F5: `connectionClose()` never unsubscribes (code commented out); singleton channels keep stale state across sessions

- **Location:** `src/server/services/machine/channels/SacpTcpChannel.ts:190-240` (commented unsubscribes :191-205, singleton :481); `src/server/services/machine/channels/SacpChannel.ts:122,135-139`
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** All unsubscribe calls in `SacpTcpChannel.connectionClose()` are commented out; teardown relies solely on `sacpClient.dispose()`. Because a fresh `SacpClient` is created per connect (:72) the SDK listeners do not survive, but the **channel singleton's own fields do**: `moduleInfos`, `headType`, `machineStatus`, `totalLine`, `estimatedTime`, `filename`, `currentWorkNozzle` (SacpChannel.ts:122-139) persist across disconnect/reconnect and across channel switches (HTTP↔SACP both stay instantiated as module-level singletons, `SacpTcpChannel.ts:481`, `SstpHttpChannel.ts:962`). Until the new connection's first reports arrive, commands consult stale module tables — e.g. `getLaserToolHeadModule()` (:259-270) can address a module key from the previous session, and `machineStatus` starts as the previous session's last workflow state.
- **Evidence:** `this.moduleInfos = {}` is only reset inside `getModuleInfo()`/`startHeartbeatLegacy` (:350, :893), both of which run *after* a successful new connect; nothing clears them on close.
- **Proposed fix:** Add an explicit `reset()` on `SacpChannelBase` (clear `moduleInfos`, `machineStatus`, print-job fields, callbacks) and call it from `connectionClose()` and `connectionOpen()`.
- **Upstream-relevant:** yes

## F6: `stopHeartbeat(id)` clears the wrong heartbeat-timer key; a zombie 10s timer emits a spurious `connection:close` after reconnect

- **Location:** `src/server/services/machine/channels/SacpChannel.ts:210-226, 802, 856-865`; `src/server/services/machine/instances/ArtisanInstance.ts:26,89,113`
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** `startHeartbeatLegacy` registers its watchdog under `heartbeatTimerLegacy[id]` with the default `id = 'uuid'` because `ArtisanInstance` calls it without an id (ArtisanInstance.ts:89). On disconnect, `onClosing()` calls `stopHeartbeat(this.id)` where `this.id = uuidv4()` (:26, :113) — so `heartbeatTimerLegacy['uuid']` is **not** cleared (:218-221 looks up the wrong key). Ten seconds after the last heartbeat the orphan timer fires (:861-865) and emits `connection:close` on `this.socket`. If the user has reconnected within those 10 s (channel singleton, same `socket`), the renderer's `'connection:close'` handler (workspace/index.ts:244-246) resets machine state for the *live* connection — UI suddenly shows disconnected/idle while the machine is connected. Additionally `stopHeartbeat` calls `sacpClient.unsubscribeHeartbeat(null)` (:224); in the Dispatcher, `removeListener(businessId, null)` throws if more than one listener is registered (`snapmaker-sacp-sdk/dist/communication/Dispatcher.js:233-236`).
- **Evidence:** key mismatch between `startHeartbeatLegacy(sacpClient, undefined)` (default `id='uuid'`, SacpChannel.ts:802) and `stopHeartbeat(this.id /* uuidv4 */)` (ArtisanInstance.ts:113). Timer body: `this.heartbeatTimerLegacy[id] && this.socket && this.socket.emit('connection:close')` (:864).
- **Proposed fix:** Use one timer keyed consistently (or pass `this.id` into `startHeartbeatLegacy`), and clear *all* legacy timers in `stopHeartbeat()`; pass the stored `subscribeHeartCallback` to `unsubscribeHeartbeat`.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** partially-confirmed (primary key-mismatch confirmed; secondary "removeListener throws" claim refuted)
- **Checked:** `heartbeatTimerLegacy` is an array field (`SacpChannel.ts:88`). `startHeartbeatLegacy` default param `id = 'uuid'` (:802), arms `this.heartbeatTimerLegacy['uuid'] = setTimeout(...)` (:861), fires `connection:close` (:864). `ArtisanInstance` declares `id = uuidv4()` (:26) and `onClosing` calls `stopHeartbeat(this.id)` (:113); `_onMachineReadySACP` calls `startHeartbeatLegacy(sacpClient, undefined)` (:89) — so the timer is keyed `'uuid'` but `stopHeartbeat` looks up `heartbeatTimerLegacy[<uuidv4>]` (:218) → wrong key, orphan timer survives. CONFIRMED. Checked SDK `Dispatcher.unsubscribe` (`Dispatcher.js:227-243`): it calls `removeListener(businessId, callback)` only when `listenerCount(businessId) > 1`, else `removeAllListeners`.
- **Notes:** Primary defect (key mismatch → zombie 10 s timer → spurious `connection:close` after reconnect) is solid. CORRECTION to the secondary claim: the finding says `removeListener(businessId, null)` "throws if more than one listener is registered (Dispatcher.js:233-236)" — this is inaccurate. Node's `EventEmitter.removeListener` with a null/non-matching listener is a silent no-op, it does not throw; and `stopHeartbeat` does not even reach that path because it calls `sacpClient.unsubscribeHeartbeat(null)` whose own dispatcher branch only triggers `removeListener` when there are >1 listeners (then no-ops on null) and `removeAllListeners` otherwise. So the "throws" consequence should be struck; the real residual bug is that the heartbeat listener may not be removed (leak), not a thrown exception. Recommend keeping P1 for the zombie-timer mechanism but removing the throw claim from the writeup.

## F7: HTTP polling loop fails silently — non-timeout errors produce no UI signal until 3 consecutive failures, and module/enclosure poll errors are swallowed forever

- **Location:** `src/server/services/task-manager/workers/heartBeat.ts:38-52` (poll cadence :76 = 2000 ms, request timeout :37 = 3000 ms, screen grace :11 = 8 s); `src/server/services/machine/channels/SstpHttpChannel.ts:571-579, 589-597, 860-873`
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** When a status poll fails, the worker emits **nothing** (`heartBeat.ts:39-52`): timeouts arm an 8-second grace timer; other errors increment `errorCount` and only the third consecutive error triggers `offline`. Between the first failed poll and the offline decision, the renderer keeps displaying the last successful snapshot with no staleness indicator — `Marlin:state` is simply not emitted (the only consumer signal is `connection:close` at SstpHttpChannel.ts:323-326). The 1-second `module_info` and `enclosure` polls are worse: on error they emit nothing, ever (`if (!err)` with no else at :574 and :592; `getEnclosureStatus` even *caches* the error result: `_getResult(err, res)?.data` is `undefined`, fails `isEqual` against the previous object, overwrites `this.moduleSettings` with `undefined` and emits a `Marlin:settings` whose fields are all `undefined` (:861-872), wiping enclosure values in redux until the next good poll).
- **Evidence:** see lines above; renderer `Marlin:settings` handler unconditionally writes `enclosureDoorDetection/enclosureOnline/enclosureFan/enclosureLight` (workspace/index.ts:280-285) — `undefined` values overwrite good ones because the reducer is a plain `Object.assign` (workspace/index.ts:1104-1105).
- **Proposed fix:** Emit an explicit `machine:state-stale` (or set a `lastUpdated` timestamp in `Marlin:state`) on first poll failure; guard `getEnclosureStatus` against `err`/empty data before emitting/caching.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `heartBeat.ts` (full re-read): poll on success emits `{status:'online', ...}` (:59-67); on error, if `Timeout` arms an 8 s `screenTimeout` grace (:42-45), else `errorCount++` and only `>=3` triggers `stopBeat`→`offline` (:48-51); nothing emitted on individual non-third failure. `screenTimeout = 8*1000` (:11), request `.timeout(3000)` (:37), `setInterval(beat, 2000)` (:76). Confirmed `getModuleInfo`/`getModuleList` use `if (!err)` with no else (`SstpHttpChannel.ts:574, 592`). Confirmed `getEnclosureStatus` (:856-873): on error `_getResult(err,res)?.data` is `undefined`, `isEqual(this.moduleSettings /* prev object */, undefined)` is false → caches `undefined` at :863 and emits `Marlin:settings` with all four fields `undefined` (:866-869).
- **Notes:** All cited mechanisms confirmed. The renderer-side overwrite claim (plain Object.assign reducer accepting `undefined`) is the load-bearing consequence and is consistent with the `Marlin:settings` handler being unconditional. Severity P1 appropriate.

## F8: Module attach state over HTTP is fetched exactly once per connection (`module_list`), so hot-plug/attach changes never reach the UI

- **Location:** `src/server/services/machine/channels/SstpHttpChannel.ts:261` (one-shot `getModuleList()`), 565-580; renderer merge `src/app/flux/workspace/index.ts:521-561`
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** `connectionOpen()` calls `getModuleList()` once; only `module_info` is polled every second (:269). The renderer's `machine:module-info` handler merges the polled info into the *existing* `moduleList` by key (workspace/index.ts:549-558) — a module attached after connect appears with info fields but without `moduleId`/`status` from `module_list` (so it can't be identified, e.g. `MODULEID_TOOLHEAD_MAP[m.moduleId]` lookups fail), and a detached module's stale identity lingers in merged entries. Under SACP the situation is worse (see F1): `machine:module-list` is never emitted at all, so `workspace.moduleList` keeps whatever the last HTTP session left there (it is not cleared in `resetMachineState`, actions-connect.ts:102-128).
- **Evidence:** single call site of `getModuleList` (grep: only `SstpHttpChannel.ts:261`); `moduleList` absent from the reset list at `actions-connect.ts:104-126` and from `close()` (workspace/index.ts:1006-1061).
- **Proposed fix:** Poll `module_list` on the same 1 s interval (or refresh it whenever `module_info` returns a key not present in the cached list), and clear `moduleList` in `resetMachineState`.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `connectionOpen` calls `this.getModuleList()` once at :261 (a bare call, NOT wrapped in `setInterval`), while `getEnclosureStatus` and `getModuleInfo` are installed on 1000 ms `setInterval` (:264-269). `getModuleList` (:565-579) is the only emitter of `machine:module-list`. Renderer `machine:module-list` handler (`workspace/index.ts:521-526`) just sets `moduleList`. `machine:module-info` handler (:543-577) reads the OLD `moduleList = getState().workspace.moduleList` (:546), builds `newModuleList` by key-merge `moduleList.find(v=>v.key===m.key)` (:548-558) — entries without a matching prior `module_list` row carry only info fields, no `moduleId`/`status`. `moduleList` absent from `resetMachineState` (actions-connect.ts:102-128, grep confirmed no match).
- **Notes:** All confirmed. Cross-references F1 correctly: SACP never emits `machine:module-list` (grep: only emitter is SstpHttpChannel:575), so `moduleList` is never cleared on disconnect and leaks across sessions. Severity P1 appropriate.

## F9: Server-side change-dedup caches survive reconnect and renderer restarts — first post-reconnect state can be suppressed

- **Location:** `src/server/services/machine/channels/SstpHttpChannel.ts:136, 856-874` (`moduleSettings` dedup); module-level `waitConfirm` at :23
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** medium
- **What happens:** `this.moduleSettings` (last emitted enclosure status) lives on the channel singleton and is never reset in `connectionOpen()`/`connectionClose()`. After a disconnect+reconnect — or after the renderer restarts while the server process keeps running (Electron server is long-lived) — the first enclosure poll that equals the cached value emits nothing (`isEqual` guard :862), so a renderer with default state never receives the actual enclosure settings until the machine-side value *changes*. The same pattern risk applies to any future server-side dedup; the renderer-side `compareAndSet` is safe because it compares against the live redux store.
- **Evidence:** `private moduleSettings = null;` (:136) only ever written inside `getEnclosureStatus` (:863); no reset in `connectionOpen` (:161-282) or `connectionClose` (:284-312).
- **Proposed fix:** Null out `moduleSettings` in `connectionOpen()` (and on socket.io reconnection), or drop server-side dedup entirely and rely on the renderer's compare.
- **Upstream-relevant:** yes

## F10: Divergent state models between SstpHttpChannel and SacpChannel (same fields, different semantics/cadence; suspected inverted `isHomed` on HTTP)

- **Location:** `src/server/services/machine/channels/SstpHttpChannel.ts:344-358` vs `src/server/services/machine/channels/SacpChannel.ts:1041, 184, 867, 1066-1073`
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** medium
- **What happens:** (a) `isHomed`: SACP explicitly inverts the report — `const isHomed = !(coordinateInfos?.homed); // 0: homed, 1: need to home` (SacpChannel.ts:1041) and the 0x36 handler does the same (:832-834). HTTP passes the raw field through: `isHomed: dataAny?.homed` (SstpHttpChannel.ts:344). If the screen relays the controller's convention (0 = homed), the HTTP value is inverted; this cannot be confirmed statically against the closed-source screen. (b) `workflowStatus`: HTTP = lowercased free string from the screen (:345); SACP = byte mapped via `WORKFLOW_STATUS_MAP` (constants/index.ts:41-53). Any screen status outside the enum silently produces a value the renderer doesn't recognize. (c) `laserPower`: SACP reports *current* tube power each second (SacpChannel.ts:1068), HTTP reports whatever the status API defines (likely the setpoint percentage); the UI treats both as the same slider value (workspace/index.ts:440-447). (d) update cadence: HTTP 2 s poll vs SACP 1 s subscriptions flushed by 1 s heartbeat — transient states (Pausing/Stopping) may be skipped entirely on HTTP.
- **Evidence:** as cited; ground truth for the controller's homed flag: `coordinateInfos.homed` semantics in SACP (`SacpChannel.ts:1041` comment) match the controller's convention.
- **Proposed fix:** Normalize all channel outputs through one typed `MachineState` mapper on the server (single source for inversion/enum-mapping), and verify the HTTP `homed` polarity in the live-observation task.
- **Upstream-relevant:** yes

## F11: SACP requests without RTO have no timeout — a single lost/corrupted ACK permanently hangs subscriptions and the heartbeat watchdog is never armed

- **Location:** `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Communication.js:77-119` (no timer when `isRTO === false`), :197-227 (checksum-failed packets silently dropped); `src/server/services/machine/channels/SacpChannel.ts:165-208`
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high (mechanism), medium (frequency over TCP)
- **What happens:** `Communication.send()` only sets a retry/timeout timer when `isRTO` is true; all subscription requests (`Dispatcher.subscribe` → `send(0x01,0x00,...)`, Dispatcher.js:218) and most commands are non-RTO, so their promises **never settle** if the ACK is lost or fails checksum validation (validateChecksum drop at Communication.js:198/222 leaves the request handler in `requestHandlerMap` forever). Consequence chain for state sync: `await this.sacpClient.subscribeHeartbeat(...)` (SacpChannel.ts:205) hangs → `startHeartbeat()` never completes → no heartbeat callback → `this.heartbeatTimer` (the 10 s lost-connection watchdog, :169-180) is **never armed** → Luban shows "connected" with a state frozen at connect-time and no automatic close. The same applies to `executeGcode` (`SacpChannel.ts:231-254` `Promise.all` can hang). Also note `Dispatcher.send`'s catch returns `undefined` for non-retry errors (Dispatcher.js:145-150), so callers doing `res.response` crash with TypeError instead of handling failure.
- **Evidence:** as cited. Compare the RTO branch (Communication.js:95-108), which resolves a synthetic packet or retries after 2 s.
- **Proposed fix:** Add a default timeout (e.g. 5 s reject) to non-RTO sends in the SDK wrapper (`SacpClient`), and arm the heartbeat-loss watchdog immediately when `startHeartbeat()` is invoked rather than in the first callback.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed (mechanism); unknowable-statically (loss frequency over TCP)
- **Checked:** `Communication.send` (re-read :77-119): `isRTO` defaults `false` (:80); the retry/timeout `setTimeout(...2000)` is set ONLY inside `if (isRTO)` (:95-108); the `else`/non-RTO path stores the handler in `requestHandlerMap` and writes the buffer with no timer (:84-93) → promise never settles if no ACK. `reolvePacketBuffer` (:197-224) processes a packet only when `validateChecksum` passes (:198), and unconditionally clears `receiveBuffer` (:223) — a checksum-failed packet is dropped silently and its handler stays in `requestHandlerMap`. `Dispatcher.subscribe` (:202-225) → `this.send(0x01,0x00,...)` (:218) → `communication.send(..., toBuffer())` (Dispatcher.js:168) with only 2 args → `needReply=true, isRTO=false`. `SacpClient.executeGcode` (:179-183) → `send(0x01,0x02,...)` likewise non-RTO. `SacpChannel.startHeartbeat` (:165-208) arms `this.heartbeatTimer` only inside `subscribeHeartbeatCallback` (:169-180), so a hung `subscribeHeartbeat` (:205) means the watchdog is never armed.
- **Notes:** Mechanism confirmed on every leg. One refinement: coordinate moves are NOT non-RTO — `requestAbsoluteCooridateMove` passes `isRTO=true` (`SacpClient.ts:687`), so jogs/origin moves get the 2 s retry/synthetic-resolve. The finding's wording "most commands are non-RTO" plus its specific `executeGcode`/subscription examples remains accurate (both verified non-RTO). The frequency of lost/corrupted ACKs over a local TCP link is not statically determinable (auditor already rates frequency medium). Severity P1 appropriate.

## F12: Any new client socket connection terminates the HTTP heartbeat of the active machine connection, and channel events keep flowing to a dead socket after socket.io reconnect

- **Location:** `src/server/services/index.ts:52` (`socketServer.on('connection', connectionManager.onConnection)`); `src/server/services/machine/ConnectionManager.ts:133-136`; `src/server/services/machine/channels/SstpHttpChannel.ts:148-150`; `src/server/services/machine/Channel` socket binding only at `ConnectionManager.ts:350`
- **Severity:** P0
- **Symptom mapping:** state-desync
- **Confidence:** high (mechanism; frequency depends on multi-window/reconnect usage)
- **What happens:** Two coupled defects. (1) Every **new** socket.io client connection triggers `connectionManager.onConnection` → `sstpHttpChannel.onConnection()` → `this.stopHeartBeat()` (SstpHttpChannel.ts:148-150), which terminates the polling worker of an already-established machine connection. Opening a second Luban window (or the renderer's socket.io reconnecting after a suspend/blip) silently kills all `Marlin:state` updates: the machine connection remains open, no `connection:close` is emitted, and the UI freezes on the last snapshot indefinitely. (2) `channel.setSocket(socket)` is bound once per `connectionOpen` (ConnectionManager.ts:350); if the renderer's socket reconnects (new `Socket` instance — `SocketManager/index.ts:78-106` pushes/splices per connection), the channel keeps emitting `Marlin:state`/`connection:close` to the dead socket object. Neither `onConnection` nor `onDisconnection` rebinds `channel.socket`.
- **Evidence:** `public onConnection = () => { this.stopHeartBeat(); };` (SstpHttpChannel.ts:148-150) — no guard for "heartbeat belongs to an active connection"; `this.channel.setSocket(socket)` appears only in `connectionOpen` (ConnectionManager.ts:350); no `setSocket` call in `onConnection` (ConnectionManager.ts:133-136).
- **Proposed fix:** Remove the unconditional `stopHeartBeat()` from `onConnection` (only stop when the same client re-opens a connection), and rebind `channel.setSocket(socket)` (or emit through the socket pool/broadcast) in `connectionManager.onConnection` when a machine connection is active.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed (mechanism); unknowable-statically (real-world reconnect/multi-window frequency)
- **Checked:** `services/index.ts:52` `socketServer.on('connection', connectionManager.onConnection)` — fires on every new socket.io client connection. `ConnectionManager.onConnection` (:133-136) calls `sstpHttpChannel.onConnection()` with no guard. `SstpHttpChannel.onConnection` (:148-150) calls `this.stopHeartBeat()`; `stopHeartBeat` (:382-384) does `this.heartBeatWorker.terminate(); this.heartBeatWorker = null;` — kills the active machine's poll worker. `channel.setSocket(socket)` appears only in `connectionOpen` (`ConnectionManager.ts:350`); no `setSocket` in `onConnection` (:133-136). `SocketManager.onConnection` pushes each new socket (lib/SocketManager/index.ts:84) and splices on disconnect (:105) — a reconnect is a new `Socket` instance, so the channel's bound `this.socket` becomes stale.
- **Notes:** Both coupled defects confirmed exactly as described. Note `onDisconnection` is wired (`services/index.ts:53`) but does not rebind/clear `channel.socket` either. Frequency depends on multi-window use or socket.io reconnects (auditor flags this; open question #5). Severity P0 appropriate for the mechanism.

## F13: `laserIsLocked` and SACP `laserFocalLength` are one-shot at connect; the focal-length emit also stomps live position/temperature with zeros

- **Location:** `src/server/services/machine/channels/SacpTcpChannel.ts:126-161`; renderer `src/app/flux/workspace/index.ts:585-591`; reset omissions `src/app/flux/workspace/actions-connect.ts:102-128`
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** For the 10W laser (hard-coded `moduleId === 14`, SacpTcpChannel.ts:125), lock status (`getLaserLockStatus` → `machine:laser-status` :156-161) and focal length (:126-154) are queried once at connect. If the machine locks/unlocks the laser later (e.g. after an error or e-stop) the UI's `laserIsLocked` never updates, and it is also not cleared on disconnect (`resetMachineState` resets neither `laserIsLocked` nor `moduleList`, actions-connect.ts:104-126), so it leaks into the next session — including a session with a different machine/toolhead. The focal-length emit additionally sends a fabricated `Marlin:state` containing `pos: {x:0,y:0,z:0}`, `originOffset: {0,0,0}` and zero temperatures (:130-153); arriving after real heartbeat data it briefly overwrites live position/offset in redux (the renderer's compare-and-set sees changed values and accepts the zeros).
- **Evidence:** as cited; only emitter of `machine:laser-status` is SacpTcpChannel.ts:158 (grep), only consumer workspace/index.ts:585-591.
- **Proposed fix:** Re-query lock status on error reports/workflow transitions (or subscribe if firmware offers it); reset `laserIsLocked` in `resetMachineState`; emit only `laserFocalLength` instead of a full fabricated state object.
- **Upstream-relevant:** yes

## F14: Renderer `machine:module-info` handler reads the stale pre-merge module list for focal length and spindle speed

- **Location:** `src/app/flux/workspace/index.ts:563-577`
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** After computing `newModuleList` (:549-558) and dispatching it, the handler then iterates `moduleList` — the **old** list captured from `getState()` at :547 — for `laserFocalLength` (:564-570) and CNC `spindleSpeed` (:573-577). Values therefore lag one poll cycle behind, and on the first `module-info` after connect (old list = `module_list` entries without info fields) `laserFocalLength`/`spindleSpeed` are absent, so dependent UI (laser height logic) starts from stale or undefined values.
- **Evidence:** `const moduleList: Array<any> = getState().workspace.moduleList;` (:547) … `moduleList.forEach(m => { if (m.laserFocalLength) … })` (:564) instead of `newModuleList`.
- **Proposed fix:** Iterate `newModuleList` for both blocks.
- **Upstream-relevant:** yes

## F15: heartBeat worker module-level state can be reused across pool tasks — `errorCount`/`intervalHandle` leak into a later connection

- **Location:** `src/server/services/task-manager/workers/heartBeat.ts:10-13, 27-30, 48-51, 71-76`; pool reuse `src/server/services/task-manager/workerManager.ts:49-73`
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** low
- **What happens:** `errorCount`, `timeoutHandle`, `intervalHandle`, `logCounter` are module-level in the worker. The pool (`workerpool`, process workers shared with toolpath/G-code tasks) may reuse a worker process for a subsequent `heartBeat` invocation: a previous session that ended via `stopBeat` leaves `errorCount >= 3`, so the next session goes "offline" on its *first* transient error instead of after 3 (:48-51). If the previous task ended via `terminate()` (`handle.cancel()`, workerManager.ts:70) while `intervalHandle` was set and the process is *not* killed by cancel, a new `heartBeat` call hits `if (intervalHandle) { return; }` (:71-73) and never starts polling the **new** host/token — total silent state freeze. Whether `cancel()` kills the process is workerpool-version-dependent; flagged for live verification.
- **Evidence:** as cited; no reset of `errorCount` at function entry (only on success, :58).
- **Proposed fix:** Reset all module-level state at the top of `heartBeat()` (and restart the interval with the new params instead of returning).
- **Upstream-relevant:** yes

---

## Coverage

Files read (Luban repo):
- `src/server/services/machine/channels/SacpChannel.ts` (full)
- `src/server/services/machine/channels/SacpTcpChannel.ts` (full)
- `src/server/services/machine/channels/SstpHttpChannel.ts` (full)
- `src/server/services/machine/channels/Channel.ts` (base class, partial)
- `src/server/services/machine/channels/SacpSerialChannel.ts`, `SacpUdpChannel.ts` (Ready-emission sites)
- `src/server/services/machine/sacp/SacpClient.ts` (full)
- `src/server/services/machine/ConnectionManager.ts` (lines 1-600, 1150-1350; channel selection, event binding, laser/purifier services)
- `src/server/services/machine/ProtocolDetector.ts` (full)
- `src/server/services/machine/instances/{Instance,SM2Instance,ArtisanInstance}.ts` (full); `J1Instance`, `RayInstance` (heartbeat call sites only)
- `src/server/services/socket/machine-handlers.ts` (full), `src/server/services/index.ts` (socket wiring), `src/server/lib/SocketManager/index.ts` (connection handling)
- `src/server/services/task-manager/workers/heartBeat.ts`, `workerManager.ts` (full)
- `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/{Dispatcher,Communication}.js` (full)
- `src/app/flux/workspace/{index.ts,state.ts,actions-connect.ts,MachineAgent.ts}` (full), `src/app/flux/machine/index.js` (full)
- `src/app/ui/widgets/ConnectionToolControl/LaserToolControl.tsx` (state usage)
- `src/app/constants/machines.ts`, `src/app/constants/index.ts`, `src/server/constants/index.js` (maps), `node_modules/@snapmaker/luban-platform/src/machine-state/common/WorkflowStatus.ts`
- Ground truth: `Snapmaker2-Controller/snapmaker/src/service/system.cpp:1740-1790` (UART status report: numeric `laser_power`, no laser on/off boolean)

Verified empirically: Node 22 allows `net.Socket.connect()` after `destroy()` (so SacpTcpChannel's single reused socket (:34) is *not* itself a reconnect bug).

Could NOT be determined statically (targets for the live-observation task):
1. Whether a recent SM2 touchscreen firmware actually listens on TCP 8888 (decides whether F3 is hit in the field, vs. HTTP fallback).
2. The exact field set of `/api/v1/status` and `/api/v1/connect` (closed-source screen): presence/semantics of `headStatus`, `homed` polarity (F2, F10), `moduleStatusList`, `laserPower` (current vs setpoint).
3. Whether the screen requires periodic `wifiConnectionHeartBeat` (0xb0/0x0b is sent exactly once, SacpTcpChannel.ts:101) and closes idle SACP-TCP sessions.
4. workerpool `cancel()` behavior for in-flight process workers (decides F15 severity).
5. Real-world frequency of renderer socket.io reconnects in Electron (decides how often F12 fires without user multi-window use).
