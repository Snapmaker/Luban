# Audit 03 — Connection Lifecycle (Wi-Fi, Snapmaker 2.0, SACP-capable firmware)

Static audit of connection open/close, channel selection, heartbeat, reconnect, and
client-socket lifecycle in `src/server/services/machine/` and `src/server/services/socket/`.
All paths relative to repo root. Line numbers from the current working tree.

Key architectural facts established first (referenced by findings):

- All channels are **module-level singletons**: `sacpTcpChannel` (`src/server/services/machine/channels/SacpTcpChannel.ts:481`),
  `sacpUdpChannel` (`SacpUdpChannel.ts:145`), `sstpHttpChannel` (`SstpHttpChannel.ts:962`),
  plus serial channels. `ConnectionManager` is also a singleton (`ConnectionManager.ts:1518`).
- `ConnectionManager.connectionOpen` selects the channel by protocol (`ConnectionManager.ts:302-330`).
  The protocol passed by the client is the raw discovery string `'SACP'` or `''`
  (`src/server/services/machine/network-discover/BroadcastMachineFinder.ts:53-54`,
  `src/app/flux/workspace/actions-discover.ts:50-53`, `src/app/flux/workspace/MachineAgent.ts:99-107`),
  which never matches the enum check `includes([SacpOverTCP, SacpOverUDP, HTTP], protocol)`
  (`ConnectionManager.ts:304`) — so **protocol detection runs on every single Wi-Fi connect**.
- `ChannelEvent.Disconnected` is declared (`channels/ChannelEvent.ts`) but **never emitted anywhere**
  (verified by grep over `src/`): there is no channel→manager death notification at all.
- `connectionManager.startHeartbeat` (`ConnectionManager.ts:1240-1243`) is **never registered as a
  socket event** (`src/server/services/socket/machine-handlers.ts:7-87` has no entry); heartbeats are
  started only by machine instances created on `ChannelEvent.Ready`.

---

## F1: connectionOpen abandons the previous channel without closing it — old channel keeps polling

- **Location:** `src/server/services/machine/ConnectionManager.ts:290-295` (related: `SstpHttpChannel.ts:264-269`, `SstpHttpChannel.ts:284-312`, `SacpTcpChannel.ts:190-240`)
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** At the top of `connectionOpen`, if a channel already exists (previous session never closed — e.g. renderer reload, or user re-connecting after a half-dead link), the manager only unbinds its 4 `ChannelEvent` listeners and nulls the reference; it never calls `connectionClose()` on it. For the HTTP channel, the per-second `getEnclosureStatus`/`getModuleInfo` intervals installed at `SstpHttpChannel.ts:264-269` are only cleared in `connectionClose` (`:286`) or in the heartbeat-offline callback (`:324`) — so after a switch (HTTP → SACP, or machine A → machine B) they keep firing forever against the old host and keep emitting `machine:module-info`/`Marlin:settings` into the client socket. For SACP-TCP, the TCP socket and machine-side session stay open with all SACP subscriptions live.
- **Evidence:**
  ```ts
  // ConnectionManager.ts:291-295
  // Cancel subscriptions
  if (this.channel) {
      this.unbindChannelEvents();
      this.channel = null;          // <-- old channel never closed
  }
  ```
  ```ts
  // SstpHttpChannel.ts:264-269 — installed on every connectionOpen, cleared only on connectionClose
  clearInterval(this.intervalRefMap.get('getEnclosureStatus'));
  this.intervalRefMap.set('getEnclosureStatus', setInterval(this.getEnclosureStatus, 1000));
  ...
  this.intervalRefMap.set('getModuleInfo', setInterval(this.getModuleInfo, 1000));
  ```
- **Proposed fix:** In `connectionOpen`, `await this.channel.connectionClose({ force: true })` before dropping the reference (and clear `this.machineInstance` via `onClosed()` as `connectionClose` does).
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `ConnectionManager.connectionOpen` (`ConnectionManager.ts:290-355`): lines 291-295 only `unbindChannelEvents()` + `this.channel = null` — no `connectionClose()` call, and `this.machineInstance` is NOT touched here (only nulled later in `connectionClose`, `:405-411`). `SstpHttpChannel.connectionOpen` (`:264-269`) re-installs the two 1 s `setInterval`s into `intervalRefMap`; the only clears are in `connectionClose` (`clearAllInterval()` at `:286`) and the offline callback (`:325`). Traced `bindChannelEvents`/`unbindChannelEvents` (`:265-285`) — they only attach/detach manager listeners, they do not stop the channel.
- **Notes:** Confirmed as written. Additional nuance worth noting: because all channels are singletons, an HTTP→HTTP re-open does call `clearInterval(...)` before re-`setInterval` (`:264-269`), so the leak is specifically the *cross-channel* switch (HTTP→SACP, or HTTP machine A→machine B where the abandoned channel is HTTP) and the renderer-reload re-open path. Also note the abandoned `machineInstance` survives entirely (its `onClosed()` never runs), reinforcing the leak. Severity P1 appropriate. Mechanism overlaps F5/F9 (abandoned-channel / stale-socket family) but F1 is distinct (it is the *switch* path, not the death-notification path).

## F2: Failed protocol detection replies on a stale/null socket — requesting client hangs forever

- **Location:** `src/server/services/machine/ConnectionManager.ts:334-342` (related: `src/app/flux/workspace/MachineAgent.ts:109`)
- **Severity:** P1
- **Symptom mapping:** none (UX hang on connect; masks the real network problem)
- **Confidence:** high
- **What happens:** `this.socket = socket` is assigned at line 342, *after* the `NetworkProtocol.Unknown` early-return at lines 334-340. On the first-ever connect attempt of a server process, `this.socket` is `null`, so the 404 "Unable to detect protocol" reply is silently dropped; on later attempts it goes to whatever socket was stored by a *previous* successful open (possibly a disconnected one). The client's `once(SocketEvent.ConnectionOpen, ...)` (`MachineAgent.ts:109`) never fires, leaving the UI stuck in "Connecting".
- **Evidence:**
  ```ts
  // ConnectionManager.ts:334-342
  if (this.protocol === NetworkProtocol.Unknown) {
      this.socket && this.socket.emit(SocketEvent.ConnectionOpen, {   // stale or null socket
          code: 404, ...
      });
      return;
  }
  this.socket = socket;   // assigned only after the failure path
  ```
- **Proposed fix:** Emit the 404 on the `socket` parameter (or assign `this.socket = socket` at the top of `connectionOpen`).
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `ConnectionManager.ts:334-342`: the `NetworkProtocol.Unknown` early-return uses `this.socket && this.socket.emit(...)` and returns BEFORE `this.socket = socket` at line 342. Confirmed `this.socket` is initialized to `null` (`:112`) and the only assignment is `:342` (grep of file shows no earlier write). Client side: `MachineAgent.ts:97-126` does `.once(SocketEvent.ConnectionOpen, ...)` and resolves only on receipt; if the 404 is emitted on a stale/null socket it never resolves.
- **Notes:** Confirmed. The "Unknown protocol" path is reachable in practice because detection runs on every Wi-Fi connect (header note / F7), so a transient probe failure that returns `Unknown` triggers exactly this. On first-ever connect `this.socket` is null → emit is a no-op → client hangs. On later connects it emits to the previous session's socket (could be a different/closed renderer). Severity P1 appropriate.

## F3: SacpTcpChannel.connectionOpen never settles on connect failure, and stacks `connect` listeners on the singleton net.Socket

- **Location:** `src/server/services/machine/channels/SacpTcpChannel.ts:62-69` and `:49-51` (related: `:34`, `:72`, `ConnectionManager.ts:353`)
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high (hang); medium (listener stacking side effects)
- **What happens:** The promise returned by `connectionOpen` is resolved/rejected only inside the `client.connect(..., cb)` success callback. If the TCP connect fails (ECONNREFUSED, unreachable, timeout), the constructor-level `'error'` handler (`:49-51`) only logs; the promise never settles, `await this.channel.connectionOpen(options)` (`ConnectionManager.ts:353`) hangs, and no failure event reaches the client. Additionally, `this.client` is a single `net.Socket` created once in the constructor (`:34`); each `connect(options, cb)` call registers `cb` as a `once('connect')` listener, which is **not removed when the attempt fails**. After N failed attempts, a finally-successful attempt fires all N+1 stacked callbacks: N+1 `new SacpClient(...)` instances (`:72`), N+1 `wifiConnection` handshakes and `wifiConnectionHeartBeat` sends — duplicated handling on one wire.
- **Evidence:**
  ```ts
  // SacpTcpChannel.ts:49-51 — only logs, never rejects the pending open promise
  this.client.on('error', (err) => {
      log.error(`TCP connection error: ${err}`);
  });
  // SacpTcpChannel.ts:65-69 — resolve only reachable from the success callback
  return new Promise((resolve, reject) => {
      this.client.connect({ host: options.address, port: 8888 }, () => { ... });
  });
  ```
- **Proposed fix:** Register a per-attempt `once('error', reject)` (and a connect timeout) and remove the stale `connect` listener on failure; or create a fresh `net.Socket` per `connectionOpen`.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `SacpTcpChannel.ts`: `this.client = new net.Socket()` once in constructor (`:34`); constructor `'error'` handler only `log.error` (`:49-51`), never rejects. `connectionOpen` (`:62-188`) returns a Promise whose `resolve`/`reject` are reachable only from inside the `client.connect(..., cb)` success callback (`:66-186`) — the only `reject` is in the inner `catch` (`:181-184`) which is itself inside the success callback, so a failed TCP connect (the `cb` never fires) leaves the promise pending. `ConnectionManager.ts:353` does `await this.channel.connectionOpen(options)` with no timeout. The `connect(options, cb)` form registers `cb` as a one-time `'connect'` listener per Node semantics; on failure it is not removed.
- **Notes:** Confirmed (hang: high; listener-stacking: the mechanism is real but its observable effect depends on a later *successful* connect on the same singleton socket after prior failures — plausible but second-order, matching the auditor's own "medium" confidence). One caveat on the stacking claim: a failed `net.Socket.connect()` typically emits `'error'` and the socket may need explicit re-use handling; whether N callbacks truly all fire on a later success is Node-version-dependent (the audit's Open Question #2 already flags this). Severity P1 appropriate for the hang alone.

## F4: Heartbeat watchdog is armed only after the first beat and never disarmed on disconnect — stale timer can kill the next session

- **Location:** `src/server/services/machine/channels/SacpChannel.ts:168-180,205` (related: `SacpChannel.ts:210-226`, `instances/SM2Instance.ts:7-12`, `instances/Instance.ts:38-47`, `ConnectionManager.ts:376-381`)
- **Severity:** P1
- **Symptom mapping:** state-desync | slow-homing (commands silently die mid-operation)
- **Confidence:** high (mechanism); medium (frequency in the field)
- **What happens:** In `startHeartbeat` (used by SM2 over SACP), the 10 s watchdog `setTimeout` is created *inside* the subscription callback. Two consequences. (a) If the subscribe succeeds but no heartbeat report ever arrives (lost subscription on a flaky link, machine wedged), no timer exists — the dead connection looks alive to the UI indefinitely. (b) Nothing ever calls `stopHeartbeat()` for SM2: `SM2Instance` overrides neither `onClosing` nor `onClosed` (both empty in `Instance.ts:38-47`), and `connectionClose` (`ConnectionManager.ts:376-381`) doesn't stop heartbeats either. So after a graceful disconnect, the last-armed watchdog on the **singleton** channel survives and fires ~10 s later, calling `this.connectionClose({ force: true })` — which destroys `this.client`/`this.sacpClient` of whatever session is active *now*. Reconnecting to the machine within that window gets force-killed shortly after, mid-homing or mid-jog.
- **Evidence:**
  ```ts
  // SacpChannel.ts:168-180 — timer only ever created inside the callback
  const subscribeHeartbeatCallback: ResponseCallback = (data) => {
      if (this.heartbeatTimer) { clearTimeout(this.heartbeatTimer); this.heartbeatTimer = null; }
      this.heartbeatTimer = setTimeout(async () => {
          log.info('Lost heartbeat, close connection.');
          await this.connectionClose({ force: true });
          this.socket && this.socket.emit('connection:close');
      }, 10000);
      ...
  };
  const res = await this.sacpClient.subscribeHeartbeat({ interval: 2000 }, subscribeHeartbeatCallback);
  ```
  Call chain for (b): user disconnect → `ConnectionManager.connectionClose` → `SacpTcpChannel.connectionClose` (no `clearTimeout(this.heartbeatTimer)` anywhere in `SacpTcpChannel.ts:190-240`) → timer fires 10 s later into the next session.
- **Proposed fix:** Arm the watchdog immediately after `subscribeHeartbeat` resolves; clear `heartbeatTimer` in every `connectionClose` path (and call `stopHeartbeat()` from `MachineInstance.onClosing`).
- **Upstream-relevant:** yes

### Verification
- **Verdict:** partially-confirmed
- **Checked:** `SacpChannel.ts:165-208` (modern `startHeartbeat`): the watchdog `setTimeout` is created inside `subscribeHeartbeatCallback` (`:174-180`), so (a) holds — no timer until the first beat arrives. `stopHeartbeat()` (`:210-226`) clears `this.heartbeatTimer`. `SM2Instance.ts:6-13`: `onPrepare` calls `this.channel.startHeartbeat()`; it does NOT override `onClosing`/`onClosed` (base `Instance.ts:39-48` are empty). `SacpTcpChannel.connectionClose` (`:190-240`) contains no `clearTimeout(this.heartbeatTimer)` and no `stopHeartbeat()` call. `ConnectionManager.connectionClose` (`:360-413`) calls `machineInstance.onClosing()` (`:377`) which for SM2 is the empty base method — so `stopHeartbeat` is never reached for SM2.
- **Notes:** Claim (b) is confirmed for SM2 over **UDP** (where SM2 does reach Ready → `startHeartbeat`). Important correction interacting with F8: SM2 over **TCP never reaches `ChannelEvent.Ready`** (F8), so `startHeartbeat` is never called there and no modern watchdog is ever armed on the TCP channel — the stale-watchdog-kills-next-session scenario for SM2 is therefore realized on the **UDP singleton channel**, not the TCP one. Contrast: Artisan/J1/Ray DO override `onClosing` and call `stopHeartbeat(this.id)` (`ArtisanInstance.ts:113`, `J1Instance.ts:114`, `RayInstance.ts:148`) — but they use `startHeartbeatLegacy` whose watchdog is `heartbeatTimerLegacy[id]` (`:861`), and `stopHeartbeat(id)` clears that. So the "never disarmed" gap is specific to the SM2 modern-heartbeat path. Mechanism (b) is real; recommend keeping P1 but scoping the description to the SM2/UDP modern-heartbeat path. (a) confirmed for all modern-heartbeat users.

## F5: Channel-initiated death never reaches ConnectionManager — manager keeps a dead channel as "current"

- **Location:** `src/server/services/machine/channels/SacpChannel.ts:174-180`; `channels/ChannelEvent.ts` (`Disconnected` never emitted); `ConnectionManager.ts:360-413`
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** When the heartbeat watchdog (`SacpChannel.ts:174-180`), the TCP `'close'` handler (`SacpTcpChannel.ts:39-47`), or the HTTP offline callback (`SstpHttpChannel.ts:322-327`) detect death, they emit `'connection:close'` straight to the client socket. `ConnectionManager` is never told: `this.channel`, `this.protocol` and `this.machineInstance` stay set, `machineInstance.onClosed()` never runs. Every subsequent command handler (`executeGcode` `ConnectionManager.ts:420-430`, `goHome` `:1292-1311`, `setWorkOrigin` `:1329-1342`, ...) dereferences `this.channel` and happily sends into a destroyed socket / disposed `SacpClient` — `Dispatcher.send` then rejects with "communication not initialize" or hangs, with no error surfaced. If the client misses the bare `'connection:close'` (it carries **no payload** at `SacpChannel.ts:179`, unlike every other emit of that event), the UI shows a live connection that eats commands.
- **Evidence:** `ChannelEvent.Disconnected` exists in `ChannelEvent.ts` but `grep -rn "ChannelEvent.Disconnected" src/` returns only the declaration. The watchdog path emits directly: `this.socket.emit('connection:close')` (`SacpChannel.ts:179`) — manager state untouched (no code path mutates `connectionManager.channel` other than `connectionOpen`/`connectionClose`, `ConnectionManager.ts:290-413`).
- **Proposed fix:** Emit `ChannelEvent.Disconnected` from all channel death paths; have `ConnectionManager` subscribe to it in `bindChannelEvents` and run the same teardown as `connectionClose` (null channel, `machineInstance.onClosed()`, emit a well-formed `connection:close`).
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `grep -rn ChannelEvent.Disconnected src/` → only the declaration in `ChannelEvent.ts:19`; never emitted. Death paths confirmed: modern watchdog `SacpChannel.ts:179` emits bare `this.socket.emit('connection:close')` (no payload), vs every other emit of that event carries a `{code,data,msg,text}` result object (`SacpTcpChannel.ts:41-47,86-92`, `SstpHttpChannel.ts:325`, `ConnectionManager.ts:384-401`). `bindChannelEvents` (`ConnectionManager.ts:265-274`) subscribes only to Connecting/Connected/Ready/ErrorReport — not Disconnected. Confirmed `this.channel`/`this.protocol`/`this.machineInstance` are mutated only inside `connectionOpen`/`connectionClose` (no other writers in the file). Command handlers (e.g. `executeGcode` `:424`, `goHome` `:1295`) dereference `this.channel` unconditionally.
- **Notes:** Confirmed. The legacy watchdog path (`SacpChannel.ts:864`) also emits bare `connection:close`. The TCP `'close'` handler (`SacpTcpChannel.ts:39-47`) and HTTP offline callback (`SstpHttpChannel.ts:322-327`) do emit a payload but still never notify the manager. So in all death paths the manager keeps stale state. Severity P1 appropriate.

## F6: Any new client socket connection silently kills the active HTTP heartbeat worker

- **Location:** `src/server/services/machine/ConnectionManager.ts:133-136` → `src/server/services/machine/channels/SstpHttpChannel.ts:148-150,382-385` (related: `src/server/services/index.ts:52`, `lib/SocketManager/index.ts:78-108`)
- **Severity:** P0
- **Symptom mapping:** state-desync | origin-crash (moves planned on frozen position data)
- **Confidence:** high
- **What happens:** `connectionManager.onConnection` runs for **every** socket.io client connection (`services/index.ts:52`) and unconditionally calls `sstpHttpChannel.onConnection()`, which is `this.stopHeartBeat()` — terminating the heartbeat worker. So while connected to an SM2 over HTTP: (a) opening a second Luban window/tab, or (b) a transparent socket.io reconnect of the same renderer (network blip; `pingTimeout` is 180 s, `SocketManager/index.ts:36`), kills status polling. Nothing restarts it and **no `connection:close` is emitted** — the UI keeps the last `Marlin:state` forever: position, origin offset, workflow status all frozen while the machine stays connected and still accepts commands. Setting a work origin or starting a job based on that frozen position is exactly a "moves to wrong origin" scenario. The machine also stops seeing status polls, while Luban believes the connection is healthy — dead and alive at the same time.
- **Evidence:**
  ```ts
  // ConnectionManager.ts:133-136 — runs on EVERY client socket connection
  public onConnection = (socket: SocketServer) => {
      sstpHttpChannel.onConnection();
      this.scheduledTasksHandle = new ScheduledTasks(socket);
  };
  // SstpHttpChannel.ts:148-150
  public onConnection = () => {
      this.stopHeartBeat();
  };
  ```
- **Proposed fix:** Remove the `stopHeartBeat()` call from `onConnection` (or only stop it when the connecting socket is about to take over the channel, i.e. inside `connectionOpen`). At minimum, emit `connection:close` so the UI knows polling stopped.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** Full wiring traced. `services/index.ts:52`: `socketServer.on('connection', connectionManager.onConnection)`. `SocketManager.onConnection` (`SocketManager/index.ts:78-108`) runs for EVERY socket.io client connect and calls `this.emit('connection', socket)` at `:88` — so `connectionManager.onConnection` fires PER SOCKET, not once. `ConnectionManager.onConnection` (`:133-136`) unconditionally calls `sstpHttpChannel.onConnection()` → `this.stopHeartBeat()` (`SstpHttpChannel.ts:148-150`), which does `heartBeatWorker.terminate(); heartBeatWorker = null` (`:382-385`). No code restarts it on a stray connect, and no `connection:close` is emitted on this path. `pingTimeout: 180000` confirmed (`SocketManager/index.ts:36`).
- **Notes:** Confirmed exactly as written, including the per-socket firing (the load-bearing claim). The HTTP heartbeat worker is the SOLE status poller for the HTTP channel (the 1 s `getEnclosureStatus`/`getModuleInfo` intervals are separate and survive, but they emit `Marlin:settings`/`machine:module-info`, NOT `Marlin:state` — so position/origin/workflow status freeze as claimed). `startHeartbeat` is not a registered socket event (`machine-handlers.ts` has no entry; grep confirms), so nothing re-arms it. P0 severity strongly justified given the origin-crash path. This is the most impactful confirmed finding in this file.

## F7: Protocol detection runs on every connect, mutates the live UDP singleton, and can flap between channels

- **Location:** `src/server/services/machine/ProtocolDetector.ts:84-120`; `src/server/services/machine/channels/SacpUdpChannel.ts:46-62`; `ConnectionManager.ts:302-309`
- **Severity:** P1
- **Symptom mapping:** state-desync | slow-homing (different channel = different motion semantics per session)
- **Confidence:** high (always-runs + singleton mutation); medium (flap frequency)
- **What happens:** Because the client-side protocol string never matches the enum (see header notes), `inspectNetworkProtocol` runs on every Wi-Fi connect. (1) `tryConnectSacpUdp` calls `sacpUdpChannel.test()`, which **replaces `this.sacpClient` on the singleton UDP channel** (`SacpUdpChannel.ts:48`) without disposing the old one. If a machine is currently connected over SACP-UDP, all its SDK subscription listeners live on the old `SacpClient`; incoming datagrams are routed to the *new* client (`this.sacpClient.read(buffer)`, `:27-29`), so every subscription (heartbeat included) goes deaf instantly — 10 s later the stale watchdog force-closes the session. Even a *failed* test leaves `sacpClient` pointed at an arbitrary host. (2) Selection priority is TCP > UDP > HTTP with independent 1-2 s probe timeouts (`ProtocolDetector.ts:104-120`); a transiently lost UDP probe response (its budget is a single 2 s race, `SacpUdpChannel.ts:59-61`) silently downgrades the session to HTTP, so consecutive sessions can run on different channels with different command paths (compare `ConnectionManager.ts:665-689` SACP vs `:690-737` HTTP laser-start logic).
- **Evidence:**
  ```ts
  // SacpUdpChannel.ts:46-52 — detection probe overwrites live client state
  public async test(host: string, port: number): Promise<boolean> {
      const sacpResponse = (async () => {
          this.sacpClient = new SacpClient('udp', { socket: this.socketClient, host, port });
          ...
  ```
- **Proposed fix:** Use a throwaway `SacpClient`/socket inside `test()`; skip detection when the channel for `host` is already connected; map the discovery string `'SACP'` to a concrete protocol on the server so detection only runs when genuinely unknown.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** "Always runs": confirmed via `BroadcastMachineFinder.ts:53-54` (`device.protocol = 'SACP'`), propagated client-side through `actions-discover.ts:50-53` → `MachineAgent.createAgent` (`MachineAgent.ts:55` default `''`) → emitted as `protocol` (`MachineAgent.ts:106`). `ConnectionManager.ts:304` checks `includes([SacpOverTCP='SACP-TCP', SacpOverUDP='SACP-UDP', HTTP='HTTP'], protocol)` (enum values from `ProtocolDetector.ts:13-18`) — `'SACP'`/`''` never match, so `inspectNetworkProtocol` runs every Wi-Fi connect. (1) `SacpUdpChannel.test()` (`:46-62`) does `this.sacpClient = new SacpClient('udp', {socket: this.socketClient, host, port})` — overwrites the live singleton `sacpClient`; the shared `socketClient.on('message')` (`:25-29`) routes datagrams to whatever `this.sacpClient` currently is. (2) `detectNetworkProtocol` (`:104-120`) uses `Promise.allSettled` with priority TCP>UDP>HTTP; TCP/HTTP probes are 1 s `net` connects (`:35,32`), UDP test is a 2 s race (`:59-61`).
- **Notes:** Confirmed. Correction to a sub-detail: the audit text says "independent 1-2 s probe timeouts" — the three probes actually run concurrently via `allSettled` (not sequentially), so total detection latency is ~max(2s), and a downgrade to HTTP happens when both SACP probes fail/lose their race within that window. The core harm (live UDP singleton `sacpClient` overwrite mid-session deafening all subscriptions) is real and correctly described. Severity P1 appropriate; flap-frequency "medium" confidence is fair. Mechanism (1) is the same singleton-overwrite family as F1/F5.

## F8: SM2 over SACP gets no (or crippled) machine instance — "Connected" with no state subscriptions

- **Location:** `src/server/services/machine/channels/SacpTcpChannel.ts:104-117` (related: `ConnectionManager.ts:205-251`, `SacpUdpChannel.ts:78-88`, `SacpChannel.ts:165-208`, `instances/SM2Instance.ts:7-12`)
- **Severity:** P1
- **Symptom mapping:** state-desync | origin-crash
- **Confidence:** high (TCP path, from code); medium (which port a given SM2 firmware actually exposes)
- **What happens:** `SacpTcpChannel.connectionOpen` emits `ChannelEvent.Ready` **only** for Artisan and J1. If an SM2 (A150/A250/A350, `SACP_TYPE_SERIES_MAP` 0-2) connects over SACP-TCP (port 8888 reachable — the detector's first preference), `Ready` never fires, so `onChannelReady` (`ConnectionManager.ts:205-251`) never creates an `SM2Instance`, `startHeartbeat()` is never called (it has no other trigger — `connection:startHeartbeat` is not a registered socket event), and the client never receives machine status, coordinates or `connection:connected`. The connection reports `Connected` (`:97`) and then goes dark. Over SACP-UDP the `Ready` event does fire (`SacpUdpChannel.ts:86-88`) and `SM2Instance.onPrepare` runs `startHeartbeat()` — but the new-style `startHeartbeat` (`SacpChannel.ts:165-208`) subscribes only to **machine status + air purifier**; unlike `startHeartbeatLegacy` it never subscribes coordinates, hot-bed, nozzle, CNC speed, or laser power, so position/origin shown in the UI never update over this channel either.
- **Evidence:**
  ```ts
  // SacpTcpChannel.ts:108-117 — SM2 identifiers missing
  if (machineIdentifier === SnapmakerArtisanMachine.identifier) { this.emit(ChannelEvent.Ready, {...}); }
  if (machineIdentifier === SnapmakerJ1Machine.identifier)     { this.emit(ChannelEvent.Ready, {...}); }
  ```
  ```ts
  // SacpChannel.ts:205-206 — entire subscription set of new-style heartbeat
  const res = await this.sacpClient.subscribeHeartbeat({ interval: 2000 }, subscribeHeartbeatCallback);
  this.subscribePurifierInfo();
  ```
- **Proposed fix:** Emit `Ready` with the decoded `machineIdentifier` unconditionally in `SacpTcpChannel` (manager already switches on identifier); give `SM2Instance.onPrepare` the same subscription set as the legacy path (coordinates at minimum).
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `SacpTcpChannel.connectionOpen` (`:108-117`): emits `ChannelEvent.Ready` only inside `if (machineIdentifier === SnapmakerArtisanMachine.identifier)` and `if (... === SnapmakerJ1Machine.identifier)` — no SM2/A150/A250/A350 branch, no Ray branch, no default. `onChannelReady` (`ConnectionManager.ts:205-251`) is the only `SM2Instance` constructor site and it runs only on `ChannelEvent.Ready`. So SM2 over TCP: `Connected` is emitted (`:97`) but `Ready` is not → no `SM2Instance` → no `startHeartbeat`. Confirmed `connection:startHeartbeat`/`startHeartbeat` is not a registered socket event (`machine-handlers.ts`, grep). UDP path: `SacpUdpChannel.connectionOpen` (`:86-88`) emits `Ready` unconditionally. Modern `startHeartbeat` (`SacpChannel.ts:165-208`) subscribes only heartbeat (`:205`) + purifier (`:206`) — no coordinate/hotbed/nozzle/CNC/laser subscriptions, unlike `startHeartbeatLegacy` (`:954-1077`).
- **Notes:** Confirmed from code. The "which port SM2 firmware exposes" caveat (audit Open Question #1) is the only thing that gates whether the TCP branch is hit in the field — correctly flagged as medium confidence. Note this finding directly governs F4(b): the never-disarmed modern watchdog only matters for SM2 if SM2 reaches `startHeartbeat`, which over TCP it does not. P1 appropriate.

## F9: Renderer reload / second tab: server keeps the machine link bound to a dead socket; new client gets no snapshot

- **Location:** `src/server/services/machine/ConnectionManager.ts:139-144` (related: `ConnectionManager.ts:350`, `SstpHttpChannel.ts:152-154`, `SacpTcpChannel.ts:58-60`, `lib/SocketManager/index.ts:100-107`)
- **Severity:** P1
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** On client socket disconnect, `onDisconnection` only calls `sstpHttpChannel.onDisconnection()` (empty, `SstpHttpChannel.ts:152-154`) and `textSerialChannel.onDisconnection(socket)`; SACP channels aren't touched. The machine connection therefore survives a renderer reload (this may be intentional), but: every channel keeps emitting into the **old, dead socket** (`this.socket` is only rebound inside `connectionOpen`, `ConnectionManager.ts:350`); there is no state snapshot pushed to the new client on reconnect — the new renderer shows "disconnected" while the server-side channel, SACP subscriptions, heartbeat watchdog and HTTP intervals are all still live. Recovery requires a full `connectionOpen`, which collides with F1 (abandoned channel), F3 (TCP `connect()` reuse on a still-connected singleton `net.Socket` — undefined behavior per Node docs, error only logged) and F4 (stale watchdog). There is no "adopt existing channel + replay state" path.
- **Evidence:**
  ```ts
  // ConnectionManager.ts:139-144 — SACP channels not handled on client disconnect
  public onDisconnection = (socket: SocketServer) => {
      sstpHttpChannel.onDisconnection();          // empty body
      textSerialChannel.onDisconnection(socket);
      this.scheduledTasksHandle.cancelTasks();
  };
  ```
- **Proposed fix:** On client disconnect, either force-close the machine channel after a grace period, or keep it and implement a re-attach path: rebind `channel.setSocket(newSocket)` and emit a full state snapshot (`connection:connected` + Marlin:state) when a client re-opens against an already-connected channel.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `ConnectionManager.onDisconnection` (`:139-144`): calls only `sstpHttpChannel.onDisconnection()` (empty body, `SstpHttpChannel.ts:152-154`), `textSerialChannel.onDisconnection(socket)`, and `scheduledTasksHandle.cancelTasks()`. No SACP channel touched, `this.channel`/`this.socket` not reset. The only `this.channel.setSocket(socket)` rebind is in `connectionOpen` (`:350`). `SacpTcpChannel.onDisconnection` (`:58-60`) is empty. `SocketManager` disconnect path (`:100-107`) emits `'disconnection'` and splices the socket — no channel adoption logic exists. No `connection:connected` snapshot is pushed on a fresh client socket; the HTTP path only re-emits `connection:connected` after a full re-`connectionOpen` + first heartbeat (`SstpHttpChannel.ts:360-367`).
- **Notes:** Confirmed. The collision with F1/F3/F4 on the recovery re-`connectionOpen` is accurate (re-open reuses the singleton TCP `net.Socket` per F3, abandons the prior channel per F1, and the stale modern watchdog per F4 may still be live). Severity P1 appropriate. Stale-socket emission is the same family as F1/F5/F6 but F9 is the distinct client-disconnect/re-attach gap.

## F10: connectionClose reports success unconditionally and drops the channel even when close failed

- **Location:** `src/server/services/machine/ConnectionManager.ts:381-405` (related: `SacpTcpChannel.ts:209-229`)
- **Severity:** P2
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** Both branches of the `success` check emit `code: 200` to the client (`:384-401`), and the manager then nulls `this.channel` regardless (`:404-405`). In `SacpTcpChannel.connectionClose`, if the machine rejects `wifiConnectionClose` (`response.result !== 0`, `:226-229`) the method returns `false` **without destroying the TCP socket or disposing the SacpClient** — leaving a fully live, subscribed connection that the manager has just orphaned (heartbeat watchdog included, see F4). The next `connectionOpen` then re-enters `client.connect()` on a connected socket (F3).
- **Evidence:**
  ```ts
  // SacpTcpChannel.ts:226-229
  } else {
      // close failed
      return false;        // socket NOT destroyed, sacpClient NOT disposed
  }
  // ConnectionManager.ts:391-405 — both branches emit code 200; then:
  this.unbindChannelEvents();
  this.channel = null;
  ```
- **Proposed fix:** On failed graceful close, fall through to the force-close path (destroy socket, dispose client) before nulling the channel; report a non-200 code so the client can distinguish.
- **Upstream-relevant:** yes

## F11: Discovery subscription is last-writer-wins and never cleaned up per client

- **Location:** `src/server/services/machine/MachineDiscoverer.ts:76-116` (related: `src/server/services/socket/discover-handlers.ts:46-75`)
- **Severity:** P2
- **Symptom mapping:** none (discovery UX; no effect on a connected machine's channel)
- **Confidence:** high
- **What happens:** `MachineDiscoverer` is a singleton with one `networkTimer`; each client's `subscribeDiscoverMachine` replaces the timer and captures *its* socket in the callback (`discover-handlers.ts:50-56`). A second tab steals discovery from the first; a disconnecting client never unsubscribes (no disconnect hook), so the 5 s timer keeps UDP-broadcasting and emitting `machine:discover` to a dead socket indefinitely. Discovery itself is benign to live connections (separate dgram socket, `BroadcastMachineFinder.ts:13`, send-only on port 20054 `:82`) — the `ProtocolDetector` UDP probe (F7) is the discovery-adjacent path that *does* hurt a connected machine.
- **Evidence:** `subscribeDiscoverMachines` clears and re-creates the single `this.networkTimer` (`MachineDiscoverer.ts:79-95`); nothing in `SocketManager`'s disconnect path (`lib/SocketManager/index.ts:100-107`) reaches `unsubscribeDiscoverMachines`.
- **Proposed fix:** Track subscriptions per socket id and unsubscribe on `disconnection`; or emit to all connected sockets instead of a captured one.
- **Upstream-relevant:** yes

## F12: ScheduledTasks handle overwritten per connection; cross-client cancellation and job leak

- **Location:** `src/server/services/machine/ConnectionManager.ts:133-143` (related: `src/server/lib/ScheduledTasks/index.ts`)
- **Severity:** P2
- **Symptom mapping:** none
- **Confidence:** high
- **What happens:** Every client connection replaces `this.scheduledTasksHandle` with a new `ScheduledTasks(socket)` without cancelling the previous one (its node-schedule job leaks, emitting `daily:heartbeat` to a stale socket). Any client's disconnect cancels only the **latest** handle — with two tabs, tab A's disconnect cancels tab B's scheduled tasks. Impact is low today (the only job is a 12-hourly log line), but the pattern is the same socket-vs-singleton confusion as F6.
- **Evidence:** `onConnection` (`ConnectionManager.ts:135`) assigns without cleanup; `onDisconnection` (`:142`) cancels whatever is current, not the disconnecting client's.
- **Proposed fix:** Keep a `Map<socketId, ScheduledTasks>` and cancel per disconnecting socket.
- **Upstream-relevant:** yes

---

## Listener registration table

`.on(`/`.once(` sites in the channel classes, `SacpChannel` base, their `SacpClient` usage, and
`ConnectionManager`'s channel bindings. "SDK-sub" = `SacpClient.subscribe*` which registers the
callback as an EventEmitter listener on the `SacpClient` (Dispatcher) instance
(`node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Dispatcher.js`, `subscribe()` does
`this.on(businessIdStr, callback)`). `setHandler` is a Map overwrite, not a listener (no leak),
listed where lifecycle-relevant.

| file:line | event | registered when | removed when |
|---|---|---|---|
| `SacpTcpChannel.ts:36` | `client.on('data')` | constructor (singleton, once per process) | NEVER (acceptable: singleton socket) |
| `SacpTcpChannel.ts:39` | `client.on('close')` | constructor | NEVER (acceptable) |
| `SacpTcpChannel.ts:49` | `client.on('error')` | constructor | NEVER (acceptable; but only logs — see F3) |
| `SacpTcpChannel.ts:66` | `client.connect(cb)` → `once('connect')` | **every `connectionOpen`** | after `'connect'` fires; **NEVER on failed attempt → stacks across retries (F3)** |
| `SacpTcpChannel.ts:411` | `rl.on('line')` | every `uploadGcodeFile` | `rl.close()` at `;Header End` / stream end (transient object) |
| `SacpTcpChannel.ts:458,461,472` | `readStream` `data`/`end`/`error` | every `startGcode` | stream end (transient) |
| `SacpUdpChannel.ts:25` | `socketClient.on('message')` | constructor (singleton) | NEVER (acceptable) |
| `SacpUdpChannel.ts:31` | `socketClient.on('close')` | constructor | NEVER (acceptable) |
| `SacpUdpChannel.ts:41` | `socketClient.on('error')` | constructor | NEVER (acceptable) |
| `SstpHttpChannel.ts:735,738,744` | `res` `data`/`end`/`error` | every `getGcodeFile` | response end (transient) |
| `SacpChannel.ts:205` | SDK-sub heartbeat (new style; fresh closure per call) | every `startHeartbeat` (SM2 SACP) | only via `stopHeartbeat`→`unsubscribeHeartbeat` (`:224`) — **never called for SM2 (F4)**; otherwise discarded with old `SacpClient` |
| `SacpChannel.ts:160,206` | SDK-sub purifier info (new style) | every `startHeartbeat` | **NEVER** (no unsubscribe call anywhere) |
| `SacpChannel.ts:825` | SDK-sub log feedback | every `startHeartbeatLegacy` | **NEVER** (unsubscribe commented out, `SacpTcpChannel.ts:191-205`) |
| `SacpChannel.ts:884` | SDK-sub heartbeat (legacy) | every `startHeartbeatLegacy` | `stopHeartbeat` (`:224`) — called only by Ray (`RayInstance.ts`); Artisan/J1 rely on client disposal |
| `SacpChannel.ts:963` | SDK-sub hot-bed temperature | every `startHeartbeatLegacy` | **NEVER** |
| `SacpChannel.ts:1019` | SDK-sub nozzle info | every `startHeartbeatLegacy` | **NEVER** |
| `SacpChannel.ts:1050` | SDK-sub coordinate info | every `startHeartbeatLegacy` | **NEVER** (unsubscribe commented out) |
| `SacpChannel.ts:1063` | SDK-sub CNC speed state | every `startHeartbeatLegacy` | **NEVER** |
| `SacpChannel.ts:1075` | SDK-sub laser power state | every `startHeartbeatLegacy` | **NEVER** |
| `SacpChannel.ts:1116` | SDK-sub current G-code line (legacy) | every `startHeartbeatLegacy` | `unsubscribeGetPrintCurrentLineNumber` (`:788-799`) only if explicitly invoked; otherwise **NEVER** |
| `SacpChannel.ts:1117` | SDK-sub printing time (legacy) | every `startHeartbeatLegacy` | **NEVER** |
| `SacpChannel.ts:1145` | SDK-sub enclosure info | every `startHeartbeatLegacy` | **NEVER** |
| `SacpChannel.ts:1161` | SDK-sub enclosure light info | every `startHeartbeatLegacy` | **NEVER** |
| `SacpChannel.ts:1175` | SDK-sub purifier info (legacy) | every `startHeartbeatLegacy` | **NEVER** |
| `SacpChannel.ts:769,783` | SDK-sub line number / printing time (new style) | `subscribeGetPrintCurrentLineNumber()` | line number: `:790`; printing time: **NEVER** |
| `SacpChannel.ts:830` | `setHandler(0x01,0x36)` is-homed report | every `startHeartbeatLegacy` | Map overwrite only; cleared on `dispose()` |
| `SacpChannel.ts:1241` | `setHandler(0x04,0x00)` error report | `registerErrorReportHandler` (instances `onPrepare`) | `unsetHandler` `:1254` (instances `onClosed` — not reached on channel-initiated death, F5) |
| `SacpClient.ts:1303` | `setHandler(0x01,0x06)` machine-initiated close | every `wifiConnection` (per connect) | Map overwrite / `dispose()` |
| `SacpSerialChannel.ts:45,50,55,61` | serialport `data`/`error`/`close`/`open` | per `connectionOpen` (new `SerialPort` instance) | with the SerialPort object (transient per connection) |
| `TextSerialChannel.ts:50` | `controller.on('Ready')` | per serial open | with controller instance |
| `ConnectionManager.ts:270-273` | `channel.on(ChannelEvent.{Connecting,Connected,Ready,ErrorReport})` | every `connectionOpen` (`bindChannelEvents`) | `unbindChannelEvents` (`:281-284`) at close and re-open — **symmetric, no leak** (handlers are stable bound methods) |

Mitigating note: the "NEVER" SDK-sub rows do not accumulate across normal reconnects because a
fresh `SacpClient` is constructed per connection (`SacpTcpChannel.ts:72`, `SacpUdpChannel.ts:69`)
and the old one is disposed on graceful close (`SacpTcpChannel.ts:216,232`). They leak (and keep
machine-side report subscriptions alive) exactly in the abandoned-channel paths of F1/F5/F7/F10,
where the old `SacpClient` is replaced without `dispose()`.

### Direct answers to the audit questions

- **One instance per protocol?** Yes — module-level singletons (`SacpTcpChannel.ts:481`, `SacpUdpChannel.ts:145`, `SstpHttpChannel.ts:962`). State retained across connect cycles: `SacpTcpChannel` keeps the same `net.Socket` (`:34`) and the last `sacpClient`; base `SacpChannelBase` keeps `heartbeatTimer` (F4), `machineStatus`, `moduleInfos`, `headType`, `totalLine/estimatedTime`, `currentWorkNozzle` (`SacpChannel.ts:88-139`) — none reset on open; `SstpHttpChannel` keeps `host`, `token`, `state`, `intervalRefMap`, plus the module-level `waitConfirm` (`SstpHttpChannel.ts:23`); `SacpUdpChannel` keeps a permanently bound port-8889 dgram socket and last `sacpClient`.
- **Heartbeat:** SACP new-style — subscribe @2 s, 10 s watchdog armed per beat (`SacpChannel.ts:174-180`); on miss: force close + bare `connection:close`. SACP legacy — @1 s, 10 s watchdog (`:861-865`). HTTP — worker polls `/api/v1/status` @2 s (`workers/heartBeat.ts:76`), timeout errors get 8 s grace (`:11,43-45`), other errors 3 strikes (`:48-51`); offline → intervals cleared + `connection:close` (`SstpHttpChannel.ts:322-327`). **Dead-but-looks-alive cases:** watchdog never armed if first beat never arrives (F4a); HTTP worker killed by any new client socket with no notification (F6); manager never learns of any channel death (F5).
- **Can both channels be active simultaneously?** Yes. Nothing stops the old channel on a switch (F1): `sstpHttpChannel`'s 1 s intervals and heartbeat worker keep running after the manager moves to `sacpTcpChannel`; conversely a live SACP-TCP session survives a switch to HTTP. The only "stoppers" are incidental: `onConnection`'s heartbeat kill (F6) and the HTTP offline detector.
- **Renderer reload / second tab:** server keeps the machine connection (F9); the new client gets **no snapshot** — only the HTTP path re-sends a `connection:connected` snapshot, and only after a full re-`connectionOpen` + first heartbeat (`SstpHttpChannel.ts:360-367`); SACP paths resend nothing until subscriptions tick again after re-open. Second tab actively damages the first (F6, F11, F12).

---

## Coverage

Files read in full:
- `src/server/services/machine/ConnectionManager.ts`
- `src/server/services/machine/ProtocolDetector.ts`
- `src/server/services/machine/MachineDiscoverer.ts`
- `src/server/services/machine/channels/Channel.ts`, `ChannelEvent.ts`
- `src/server/services/machine/channels/SacpChannel.ts`
- `src/server/services/machine/channels/SacpTcpChannel.ts`
- `src/server/services/machine/channels/SacpUdpChannel.ts`
- `src/server/services/machine/channels/SstpHttpChannel.ts`
- `src/server/services/machine/network-discover/NetworkedMachineFinder.ts`, `BroadcastMachineFinder.ts`
- `src/server/services/machine/instances/Instance.ts`, `SM2Instance.ts`
- `src/server/services/socket/machine-handlers.ts`, `discover-handlers.ts`, `index.ts` (empty file)
- `src/server/services/index.ts`, `src/server/lib/SocketManager/index.ts`, `src/server/lib/ScheduledTasks/index.ts`
- `src/server/services/task-manager/workers/heartBeat.ts`

Read in part (targeted):
- `src/server/services/machine/sacp/SacpClient.ts` (constructor, handlers, wifiConnection*, subscribe APIs)
- `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/communication/Dispatcher.js` (subscribe/setHandler/dispose/send semantics)
- `src/app/flux/workspace/MachineAgent.ts`, `actions-discover.ts` (client connect flow, protocol propagation)
- `src/server/services/machine/instances/{ArtisanInstance,J1Instance,RayInstance}.ts` (grep-level: heartbeat-legacy call sites)

Not audited (out of scope or owned by sibling audits):
- `SacpSerialChannel.ts` / `TextSerialChannel.ts` internals (serial connection, not Wi-Fi)
- `adaptor/Octo.ts` (`octo.onStart/onStop` hooks in connectionOpen/Close — untraced)
- SDK `Communication.js` retry/timeout semantics (command/ack robustness audit)
- Client-side reducers consuming `Marlin:state` / `connection:close` (state-sync audit)

Open questions:
1. Does recent SM2 firmware actually listen on TCP 8888 (making F8's TCP branch live), or only UDP 8889? Static code cannot tell; needs packet capture or firmware source. Detection preference order makes this decisive for which bugs the user actually hits.
2. Node `net.Socket.connect()` on an already-connected socket (F9/F3 collision path): exact behavior is version-dependent ("undefined behavior" per Node docs); worth a 5-line repro to confirm whether it errors or double-connects.
3. Whether socket.io transparent reconnects occur in the Electron renderer in practice (F6 trigger b); the 180 s `pingTimeout` suggests the authors fought this before.
4. `wifiConnectionHeartBeat()` (`SacpClient.ts:1314-1318`) sends a single `0xb0 0x0b` packet once per connect — is the machine-side Wi-Fi session keepalive actually periodic somewhere else, or does the screen session time out silently?
