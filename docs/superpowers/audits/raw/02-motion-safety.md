# Audit 02 — Motion Safety (Wi-Fi, Snapmaker 2.0, SACP-capable firmware, 10W laser)

Static audit of motion-producing code paths in Luban (`src/server/services/machine/*`, `src/app/ui/widgets/*`, `src/app/flux/workspace/*`) cross-referenced against firmware ground truth in `Snapmaker2-Controller`. All paths are absolute within the two repos:

- Luban: `/Users/winstonpoh/Documents/hobbies/snapmaker_stuff/Luban`
- Firmware: `/Users/winstonpoh/Documents/hobbies/snapmaker_stuff/Snapmaker2-Controller`

Protocol note: for a SM 2.0 with recent firmware, Luban prefers **SACP over TCP** when the machine answers on the SACP port, else falls back to HTTP (`src/server/services/machine/ProtocolDetector.ts:104-120`). Both paths are audited; they diverge significantly.

## Firmware ground truth (referenced by findings below)

- **Default feedrate when Luban omits F:** Marlin modal feedrate, initialized to 1500 mm/min (`Marlin/src/module/motion.cpp:150` — `float feedrate_mm_s = MMM_TO_MMS(1500.0f);`). Snapmaker enables `G0_FEEDRATE 3000` **with `VARIABLE_G0_FEEDRATE`** (`Marlin/Configuration_adv.h:2077-2079`), so **G0 without F reuses the F of the last G0 that had one; G1 without F reuses the last G1 feedrate** — separately tracked, persisting indefinitely across commands, jobs, and connections until reboot (`Marlin/src/gcode/motion/G0_G1.cpp:39-86`).
- **Homing feedrates are fixed per axis, not modal:** XY 50 mm/s, Z 10 mm/s, B 30 mm/s (`Marlin/Configuration.h:1421-1423`), exposed via `sm_homing_feedrate[]` (`snapmaker/src/gcode/M1028.cpp:62`) and **runtime-mutable via `M1028 S1 X.. Y.. Z..`** (`snapmaker/src/gcode/M1028.cpp:119-121`) — a stray M1028 in any executed G-code changes homing speed until reboot. G28 ignores F entirely.
- **G28 homes Z first** on Snapmaker 2.0 (Z_HOME_DIR=1, away from bed: `snapmaker/src/module/linear.cpp:353-364`; `Marlin/src/gcode/calibrate/G28.cpp:307-314`), then raises Z to `z_homing_height` if needed (`G28.cpp:334-340`), then XY.
- **G53/G54 are MODAL in this firmware.** `G53` on a line by itself switches to machine-native space and stays there (`Marlin/src/gcode/geometry/G53-G59.cpp:62-77`); `G54` re-selects workspace 0 and re-applies its stored offset (`G53-G59.cpp:88-100`, `34-51`).
- **G90/G91 are modal** and persist across Luban commands (standard Marlin `relative_mode`).
- **Homing zeroes G92 offsets** per axis (`Marlin/src/module/motion.cpp:1329-1338`, `set_axis_is_at_home()` sets `position_shift[axis] = 0`; see also `snapmaker/src/gcode/M2000.cpp:36` "Reset by G28"), **but the G54 coordinate-system copy survives**: `G92` copies `position_shift` into `coordinate_system[active]` (`Marlin/src/gcode/geometry/G92.cpp:93,108`), and a later `G54` re-applies that stored offset (`G53-G59.cpp:43-49`). Consequence: Luban's homing sequence `G53; G28; G54` (below) silently **restores the pre-homing work origin**, including a Z origin saved with a different toolhead or material thickness.
- HMI (touchscreen) absolute-move convention for comparison: firmware moves **Z first, then XY**, with defaults z=10 mm/s, xy=30 mm/s when speed omitted (`snapmaker/src/hmi/event_handler.cpp:932-980`).
- The public `Snapmaker2-Controller` repo implements only the SSTP/HMI screen protocol; **the SACP server side (commands 0x01 0x34/0x35 etc.) is not in this repo**, so SACP semantics below are inferred from Luban's encoder and marked accordingly.

---

## F1: SACP "Go to Work Origin"/jog sends workspace targets flagged as MACHINE coordinates

- **Location:** `src/server/services/machine/channels/SacpChannel.ts:1282` (and `src/app/ui/widgets/ConnectionControl/MotionButtonGroup.jsx:65-74`, `src/app/ui/widgets/ConnectionControl/Control.tsx:231-247`, `src/server/services/machine/ConnectionManager.ts:1313-1327`, `src/server/services/machine/sacp/SacpClient.ts:684-690`)
- **Severity:** P0 (causes user's symptoms)
- **Symptom mapping:** origin-crash
- **Confidence:** medium
- **What happens:** "Go To Work Origin" sends `actions.move({x:0,y:0,b:0,z:0})` (MotionButtonGroup.jsx:69-73), which Control.tsx turns into `moveOrders` with **work-coordinate** targets (the button's targets are work-origin 0,0,0; jog targets are `workPosition + delta`, Control.tsx:215). Over SACP, `SacpChannel.coordinateMove` forwards these distances verbatim to `requestAbsoluteCooridateMove(directions, distances, jogSpeed, CoordinateType.MACHINE)` — hard-coded `CoordinateType.MACHINE` (SacpChannel.ts:1282). If the firmware honors the coordinate-type byte (it is encoded into the 0x01/0x34 payload, `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/models/MovementInstruction.js` `toArrayBuffer`), a work-origin restore becomes a move to **machine (0,0,0)** — machine Z0 is the bottom of the Z axis, i.e. the 10W laser head is driven down into/through the bed whenever a non-trivial work origin is active. If instead the firmware ignores the byte and uses its modal coordinate system, correctness silently depends on F-state toggles: `goHome` switches the machine to MACHINE type (SacpChannel.ts:1263) and only switches back to WORKSPACE in the asynchronous home-complete handler, and only for non-printing head types (SacpChannel.ts:830-846). Either interpretation leaves an unguarded path where an "absolute move to 0,0,0" is executed in machine space.
- **Evidence:** call chain: `MotionButtonGroup.jsx:65-74` → `Control.tsx:231-247` (`G0 X0 Y0 B0 Z0 F{jogSpeed}` + moveOrders) → `Control.tsx:252-254` → `MachineAgent.ts:186-190` (`SocketEvent.Move`) → `ConnectionManager.ts:1321-1322` → `SacpChannel.ts:1272-1286` → `SacpClient.ts:684-690` (0x01 0x34 with `coordinateType` byte = 0 = MACHINE). Coordinate-system toggles: `SacpChannel.ts:1263` (`updateCoordinate(CoordinateType.MACHINE)` in goHome), `SacpChannel.ts:836-843` (WORKSPACE restored only on 0x01/0x36 home-complete event and only if `headType !== HEAD_PRINTING`).
- **Proposed fix:** Pass `CoordinateType.WORKSPACE` for moves whose targets are work coordinates (or convert targets to machine coordinates using the subscribed `originOffset` before sending); never leave the machine's active coordinate type dependent on an async event — set it explicitly before every absolute move.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed (Luban encodes MACHINE); unknowable-statically (whether firmware honors the byte)
- **Checked:** `MotionButtonGroup.jsx:65-74` "Go To Work Origin" → `actions.move({x:0,y:0,b:0,z:0})` (work-origin targets). `Control.tsx:231-247` `move()` builds `sArr` with raw distances (work coords) and calls `actions.coordinateMove(gcode, sArr, jogSpeed)` (:245) → `serverRef.current.coordinateMove(...)` (:252-253). `ConnectionManager.coordinateMove` (:1313-1327) on SACP calls `this.channel.coordinateMove({moveOrders, jogSpeed, headType})`. `SacpChannel.coordinateMove` (:1272-1286) hard-codes `requestAbsoluteCooridateMove(directions, distances, jogSpeed, CoordinateType.MACHINE)` (:1282). `SacpClient.requestAbsoluteCooridateMove` (:684-690) encodes the `coordinateType` byte into the 0x01/0x34 `MovementInstruction.toArrayBuffer()`. `goHome` switches to `CoordinateType.MACHINE` (:1263) and WORKSPACE is restored only in the async 0x36 handler and only `if (stateData.headType !== HEAD_PRINTING)` (:837-843).
- **Notes:** Luban-side MACHINE encoding fully confirmed. The decisive question — whether the closed-source SACP server (on the touchscreen, NOT in Snapmaker2-Controller) honors the coordinateType byte or ignores it in favor of its modal coordinate system — is UNKNOWABLE statically; the public firmware repo contains no SACP server implementation (auditor open question #1). Either interpretation (honors byte → machine Z0 plunge; ignores byte → correctness depends on async WORKSPACE restore) is an unguarded path, so the P0 stands as a real hazard regardless. Medium confidence is appropriate given the firmware-dependent leg.

## F2: Z is moved simultaneously with XY on "Go to Work Origin" — the Z-ordering logic is dead code

- **Location:** `src/app/ui/widgets/ConnectionControl/MotionButtonGroup.jsx:65-74` (and `src/app/ui/widgets/ConnectionControl/Control.tsx:231-247`, `src/server/services/machine/channels/SacpChannel.ts:1272-1286`)
- **Severity:** P0 (causes user's symptoms)
- **Symptom mapping:** origin-crash
- **Confidence:** high
- **What happens:** The button tries to sequence axes: if `workPosition.z > 0` it builds `{x:0,y:0,b:0,z:0}` ("XY first"), else `{z:0,x:0,y:0,b:0}` ("Z first"). But `actions.move` joins ALL axes into a **single** `G0 X0 Y0 B0 Z0 F{jogSpeed}` line (Control.tsx:233-241) — word order inside one G-code line has no effect on motion; all axes move simultaneously on a straight 4-axis interpolated path. The SACP path likewise packs all axes into one 0x01/0x34 instruction (SacpChannel.ts:1275-1282). So the head descends **diagonally** toward the origin: with a work origin at the material surface, the lens/nozzle can clip clamps, the material edge, or (if the origin Z is below the current surface — material removed, thinner stock, different toolhead, see F4) plough into the workpiece/bed while still traversing XY. There is no Z-lift-before-XY-travel guard anywhere on this path; the only Z-lift in the product is CNC-only in Run Boundary (`ControlPanel.tsx:207-209`, `240-246`).
- **Evidence:** `MotionButtonGroup.jsx:69-73` (object-key ordering only), `Control.tsx:233-241`:
  ```js
  const s = map(params, (value, axis) => { ... return `${axis.toUpperCase()}${value}`; }).join(' ');
  const gcode = `G0 ${s} F${state.jogSpeed}`;
  ```
- **Proposed fix:** Issue two sequential moves with explicit ordering and waits: when descending, `G0 X0 Y0 B0 F..` then `G0 Z0 F..`; when ascending, `G0 Z0` first. On SACP, send two `requestAbsoluteCooridateMove` calls and await each ACK.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `MotionButtonGroup.jsx:65-74`: the `workPosition.z > 0` branch builds object `{x:0,y:0,b:0,z:0}` else `{z:0,x:0,y:0,b:0}` — pure JS object-key ordering. `Control.tsx:231-247` `move()`: `map(params, (value, axis) => ...).join(' ')` produces one string, `const gcode = \`G0 ${s} F${state.jogSpeed}\`` (:241) — a single G-code line; word order within a G0 line does not sequence axes (all interpolate together). SACP path: `coordinateMove` packs all moveOrders into one `requestAbsoluteCooridateMove` call (`SacpChannel.ts:1275-1282`) — one 0x01/0x34 instruction. No Z-lift-before-XY guard on this path; the only Z-lift in the product is CNC-only Run Boundary (`ControlPanel.tsx:207-209`).
- **Notes:** Confirmed — the per-axis ordering in MotionButtonGroup is dead code; motion is simultaneous/diagonal on both protocols. Firmware ground truth reinforces the hazard direction: even the controller's own HMI absolute-move moves Z first then XY (event_handler.cpp:958-961, sub-agent confirmed), i.e. neither side implements lift-travel-descend. Severity P0 appropriate.

## F3: Modal `G53` leaks leave the machine in machine-native space; next absolute move plunges to machine Z

- **Location:** `src/app/ui/widgets/LaserCameraAidBackground/ExtractSquareTrace/index.jsx:127` (and `:230-259`, `:283`; `src/server/services/machine/ConnectionManager.ts:1297-1310`, `:701-736`)
- **Severity:** P0 (causes user's symptoms)
- **Symptom mapping:** origin-crash
- **Confidence:** high
- **What happens:** Firmware `G53` alone is modal (G53-G59.cpp:62-77). Luban switches to machine space in several flows and restores `G54` only on happy paths: (1) camera-aid background capture executes `await server.executeGcode('G53;')` (ExtractSquareTrace/index.jsx:127), then restores G54 only inside `Promise.all([takePhotos, getPhototTasks]).then(...)` (index.jsx:230-231, 256) — **there is no `.catch`**, so any photo/API failure or closing the dialog mid-capture (the `this.close` early-return at index.jsx:281-285 covers only loop boundaries) leaves the machine in G53 permanently. (2) `goHome` (HTTP path) sends `G53` then `G28` and restores `G54` **only when `headType` is laser or CNC** (ConnectionManager.ts:1297-1309) — an undefined/stale headType skips the restore. (3) The HTTP job preamble issues `G53;...G54` sequences as separate queue entries (ConnectionManager.ts:704, 725, 735; see F10). After any leak, the next "Go To Work Origin" (`G0 X0 Y0 B0 Z0 F1500`) or jog executes in machine coordinates: target machine Z0 = bottom of axis ⇒ 10W laser head driven into the bed. This is an exact, intermittent ("only after a failed camera capture / odd homing") mechanism for symptom B.
- **Evidence:** `ExtractSquareTrace/index.jsx:127` `await this.props.server.executeGcode('G53;');`; restore only at `index.jsx:230-231/256` inside `.then()`. `ConnectionManager.ts:1298-1309`:
  ```ts
  await this.executeGcode(socket, { gcode: 'G53' });
  await this.executeGcode(socket, { gcode: 'G28' });
  ...
  if (headType === HEAD_LASER || headType === HEAD_CNC) {
      await this.executeGcode(socket, { gcode: 'G54' });
  }
  ```
  Firmware modality: `Marlin/src/gcode/geometry/G53-G59.cpp:62-77`.
- **Proposed fix:** Never emit bare `G53` over the wire; prefix machine-coordinate moves on the same logical line (firmware supports `parser.chain()`), or wrap every G53 usage in try/finally that always sends G54; add `.catch()` restoring G54 in the camera flow.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** Firmware modality (sub-agent verified): `G53-G59.cpp:62-77` — G53 sets `active_coordinate_system=-1` and the workspace restore at :75 runs ONLY `if (parser.chain())` (:72), so bare `G53` on its own line stays in native space; modal/persistent CONFIRMED. (1) `ExtractSquareTrace/index.jsx:127` `await this.props.server.executeGcode('G53;')`, then an unguarded early `return` at :138 (failed `getCameraCalibration`) before any G54; G54 restore lives only in `.then()` success paths (:231, :256, :283) — no try/finally, no `.catch` on the G53 leak. (2) `ConnectionManager.goHome` HTTP (:1297-1310): `await executeGcode('G53')`, `await executeGcode('G28')`, then `G54` only `if (headType === HEAD_LASER || headType === HEAD_CNC)` (:1307) — undefined/stale headType skips restore. (3) HTTP job preamble emits `G53;...G54;` as separate `executeGcode` queue entries (:704, 725, 735).
- **Notes:** All three leak sites and the firmware modality confirmed. The downstream consequence (next absolute move executes in machine space → machine Z0 plunge) is consistent with the F1/F2 traces. Note `ExtractSquareTrace` does have a `.catch()` at :438, but it is in an unrelated block and does not cover the `startCameraAid` G53 region. Severity P0 appropriate.

## F4: Saved work origin silently survives homing and toolhead/material changes; no plausibility guard before restoring it

- **Location:** `src/server/services/machine/ConnectionManager.ts:1298-1309` (with firmware `Marlin/src/gcode/geometry/G92.cpp:93,108`, `Marlin/src/gcode/geometry/G53-G59.cpp:43-49`, `Marlin/src/module/motion.cpp:1334-1336`)
- **Severity:** P1 (likely reliability bug)
- **Symptom mapping:** origin-crash
- **Confidence:** high
- **What happens:** "Set Work Origin" stores the current position as origin via `G92 X0 Y0 Z0 B0` (MotionButtonGroup.jsx:17-24). Firmware copies the resulting `position_shift` into `coordinate_system[G54]` (G92.cpp:108). Homing zeroes `position_shift` (motion.cpp:1334-1336), but Luban's homing sequence ends with `G54` (ConnectionManager.ts:1307-1309), which re-applies the **stored pre-homing offset** (G53-G59.cpp:43-49). So an origin saved last week, on thicker material, or with a longer toolhead (CNC bit vs laser focal height) is silently re-activated after homing. "Go To Work Origin" then commands `Z0` in that workspace — if the saved surface is below the current physical surface (or the toolhead is longer), the head is driven into the material/bed. Luban performs no sanity check (e.g., comparing origin Z against current focal length + measured thickness) and no UI warning that an old origin is active.
- **Evidence:** chain documented above; UI display of `originOffset` only mirrors firmware values (`src/app/flux/workspace/index.ts:347-369`).
- **Proposed fix:** After homing, read back the active origin offset and require explicit user confirmation before any "Go To Work Origin" move whose Z target is below current Z; for laser, recompute expected origin Z from `laserFocalLength + platformHeight + materialThickness` and warn on mismatch (the data already exists in `SacpChannel.laserSetWorkHeight`, SacpChannel.ts:1553-1573).
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** Firmware chain (sub-agent verified): `G92.cpp:107-108` copies `position_shift` into `coordinate_system[active_coordinate_system]` and `settings.save()` (:109); `motion.cpp:1335-1337` `set_axis_is_at_home` zeroes the live `position_shift[axis]` on homing; `G53-G59.cpp:43-49` (`select_coordinate_system`/G54) re-applies the persisted `coordinate_system` offset. So homing clears the live G92 offset but the G54 copy survives → `G53; G28; G54` restores the pre-homing work origin including Z. CONFIRMED. Luban side: `goHome` HTTP ends with `G54` for laser/CNC (`ConnectionManager.ts:1307-1309`); "Set Work Origin" stores via `G92 X0 Y0 Z0 B0` (`MotionButtonGroup.jsx:17-24`). No plausibility/Z-sanity check exists before "Go To Work Origin" (confirmed — `move()` in Control.tsx unconditionally sends targets).
- **Notes:** Firmware survival-of-origin mechanism fully confirmed (auditor's cited line 1334-1336 is precisely 1335-1337; substance correct). The hazard requires the saved origin to be lower than the current physical surface (thinner stock / longer toolhead) — a real but conditional reliability risk. Severity P1 appropriate.

## F5: HTTP path emits `isHoming: true` after homing finishes and never emits `false` — homing appears stuck/slow and overrides the dismissal

- **Location:** `src/server/services/machine/ConnectionManager.ts:1301-1306` (and `src/app/flux/workspace/index.ts:647-659`, `:986-992`; only emitter of `false`: `src/server/services/machine/channels/SacpChannel.ts:845`)
- **Severity:** P1 (likely reliability bug)
- **Symptom mapping:** slow-homing
- **Confidence:** high
- **What happens:** On the non-SACP (HTTP) path, `goHome` awaits `G53` and `G28` (each `/api/v1/execute_code` POST returns when the controller has processed the command — up to the 300 s superagent timeout, `SstpHttpChannel.ts:391`), then calls the socket callback (line 1301; the app sets `homingModal: false`, `flux/workspace/index.ts:986-992`), and **then** emits `move:status { isHoming: true }` (line 1304-1306). The app's `move:status` handler sets `homingModal: true` again (`flux/workspace/index.ts:649-657`). A grep of the entire server shows `isHoming: false` is emitted **only** by the SACP channel's home-complete handler (SacpChannel.ts:845) — there is no HTTP-path emitter. Net effect on HTTP machines: after every Go Home the app re-enters "homing" state and stays there until some unrelated state change clears it, making homing look far slower than it is and blocking motion buttons (`Control.tsx:343-345`). This is a concrete Luban-side candidate for symptom A on HTTP connections.
- **Evidence:** ordering at `ConnectionManager.ts:1297-1310` (callback at 1301, emit at 1305); grep result: `isHoming: false` only at `SacpChannel.ts:845`.
- **Proposed fix:** Emit `isHoming: true` before issuing G28 and `isHoming: false` after the G28 ack on the HTTP path; remove the post-completion emit.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `ConnectionManager.goHome` HTTP branch (:1297-1310): `await executeGcode('G53')`, `await executeGcode('G28')`, then `callback && callback()` (:1301), then `if (this.connectionType === ConnectionType.WiFi) socket.emit('move:status', {isHoming:true})` (:1304-1306). Renderer `move:status` handler (`workspace/index.ts`) sets `homingModal: isHoming` when `!isNil(isHoming)`. Grepped `src/server`: `isHoming: false` is emitted ONLY at `SacpChannel.ts:845` (inside the legacy 0x36 home-complete handler); `isHoming: true` at `ConnectionManager.ts:1296` (SACP) and `:1305` (HTTP). No HTTP-path `isHoming:false` emitter exists. Firmware (sub-agent): the controller sends NO homing-completion event — a screen-issued G28 returns only a generic G-code line ack (event_handler.cpp:277-290, 318), G28 ends with `report_current_position()` only — so Luban has nothing to derive a true completion from on HTTP.
- **Notes:** Confirmed exactly. The 0x36 SACP completion handler is in `startHeartbeatLegacy`, so even SACP via `SM2Instance.startHeartbeat` (01-F4) never emits `isHoming:false`; HTTP definitively never does. The HTTP `/api/v1/execute_code` blocking-vs-not question (open question #2) affects perceived timing but not the stuck-state defect. Severity P1 appropriate.

## F6: F-less G0/G1 moves inherit stale modal feedrates (firmware `VARIABLE_G0_FEEDRATE`) — moves run arbitrarily slow (or dangerously fast)

- **Location:** `src/server/services/machine/ConnectionManager.ts:725` (also `:806-829` `recoveryCncPosition`, `:853-854` laser resume; firmware `Marlin/Configuration_adv.h:2077-2079`, `Marlin/src/gcode/motion/G0_G1.cpp:60-86`)
- **Severity:** P1 (likely reliability bug)
- **Symptom mapping:** slow-homing
- **Confidence:** high
- **What happens:** Several server-side motion commands omit F: the camera-background job preamble `G53;\nG0 X${x} Y${y};\nG54;\nG92 X${x} Y${y};` (ConnectionManager.ts:725 — note the Z move at :704 *does* carry F1500, the XY move does not); CNC pause-recovery `G1 Z..\nG1 X.. Y.. B..\nG1 Z..` (ConnectionManager.ts:813-823); laser resume `G1 Z${pos.z}\nG1 X.. Y.. B..` (ConnectionManager.ts:853-854). With `VARIABLE_G0_FEEDRATE`, an F-less G0 reuses the F of the **last G0 that specified one** — e.g. a user jog at a low persisted jog speed (see F7) or a job file's slow G0 — so these positioning moves can crawl at 100-200 mm/min; conversely F-less G1 inherits the job's last G1 feedrate, which for recovery moves (plunging Z back into a CNC cut) may be a rapid XY feed. Because the modal value persists across jobs until reboot, the behavior is intermittent and history-dependent — matching "sometimes much slower than expected" for the positioning moves that bracket homing/auto-origin flows.
- **Evidence:** `ConnectionManager.ts:725` (`G0 X${x} Y${y};` — no F), firmware `Configuration_adv.h:2077-2079` (`#define G0_FEEDRATE 3000` + `VARIABLE_G0_FEEDRATE` — "The G0 feedrate is set by F in G0 motion mode"), `G0_G1.cpp:60-67` (restores `saved_g0_feedrate_mm_s` from last usage).
- **Proposed fix:** Add an explicit F word to every server-generated G0/G1 (travel: F3000; Z plunge in recovery: a small fixed F such as F180).
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `ConnectionManager.ts:725` camera-background preamble `this.channel.executeGcode(\`G53;\nG0 X${x} Y${y};\nG54;\nG92 X${x} Y${y};\`)` — the `G0 X Y` carries NO F (the bracketing Z move at :704 does carry `F1500`). Confirmed CNC pause-recovery and laser-resume F-less moves cited (:806-829, :853-854). Firmware (sub-agent verified): `Configuration_adv.h:2077-2080` defines `G0_FEEDRATE 3000` + `VARIABLE_G0_FEEDRATE`; `G0_G1.cpp:40-41,61-67,76,83` — F-less G0 loads `saved_g0_feedrate_mm_s`, F-less G1 loads `saved_g1_feedrate_mm_s`, both saved on any F-bearing move and persist (modal, until reboot). CONFIRMED.
- **Notes:** Mechanism confirmed on both sides. The F-less XY at :725 is a genuine instance; with VARIABLE_G0_FEEDRATE it inherits the last G0 F (which a low persisted jog speed — F7 — can poison). History-dependent/intermittent as described. Severity P1 appropriate.

## F7: Go-To-Work-Origin / Run Boundary speed is the persisted jog speed, which has no lower bound

- **Location:** `src/app/ui/widgets/ConnectionControl/Control.tsx:174-186` (and `:241`, `ControlPanel.tsx:221-237`)
- **Severity:** P2 (latent risk/code smell)
- **Symptom mapping:** slow-homing
- **Confidence:** high
- **What happens:** `onChangeJogSpeed`/`onCreateJogSpeedOption` clamp only the upper bound (`Math.min(6000, Number(option.value) || 0)`) — a user-created option of 10 mm/min is accepted and **persisted in widget state** (Control.tsx:92, default 1500). "Go To Work Origin" (`G0 ... F${state.jogSpeed}`, Control.tsx:241) and "Run Boundary" (`F${jogSpeed}`, ControlPanel.tsx:221/231) then run at that speed in a later session. A user who once set a very low jog speed for fine positioning will see "go to origin"/boundary (often mentally bundled with "go home") run 10-100x slower, with no indication why. Combined with F6 it also poisons the modal G0 feedrate for the server's F-less moves.
- **Evidence:** `Control.tsx:174-179`:
  ```js
  onChangeJogSpeed: (option) => { const jogSpeed = Math.min(6000, Number(option.value) || 0); ... }
  ```
- **Proposed fix:** Clamp jog speed to a sane floor (e.g. ≥100 mm/min) and use a fixed travel speed (not jog speed) for Go-To-Work-Origin.
- **Upstream-relevant:** yes

## F8: Homing command/feedrate trace — no Luban path can slow G28 itself ("not found statically"); duration variance is firmware-positional or via M1028

- **Location:** `src/server/services/machine/ConnectionManager.ts:1292-1311`; `src/server/services/machine/channels/SacpChannel.ts:1261-1270`; `src/server/services/machine/sacp/SacpClient.ts:677-682`; firmware `Marlin/Configuration.h:1421-1423`, `Marlin/src/gcode/calibrate/G28.cpp:307-340`, `snapmaker/src/gcode/M1028.cpp:119-121`
- **Severity:** P2 (latent risk/code smell)
- **Symptom mapping:** slow-homing
- **Confidence:** high
- **What happens:** Full trace of "Home": `ControlPanel.tsx:105-114` → `executeGcodeAutoHome` (`flux/workspace/index.ts:972-993`) → `MachineAgent.goHome` (MachineAgent.ts:254-256) → `ConnectionManager.goHome:1292`. SACP: `SacpChannel.goHome` = `updateCoordinate(MACHINE)` + `requestHome(0)` (SACP 0x01/0x35, **no feedrate parameter** — SacpClient.ts:677-682); HTTP: bare `G53` + `G28` (+`G54`). G28 ignores modal F and always uses `sm_homing_feedrate` (XY 50/Z 10/B 30 mm/s). **Conclusion: no Luban code path can make G28 itself run at a stale/low feedrate — a direct feedrate bug for symptom A was not found statically.** What *can* make homing "sometimes much slower": (a) firmware homes **Z first** at 10 mm/s — starting near the bed costs ~33 s of Z travel on an A350 vs ~0 when already up, so perceived duration varies 10x with head position; (b) `M1028 S1` in any executed G-code permanently lowers `sm_homing_feedrate` until reboot (M1028.cpp:119-121) — Luban never sends M1028 (verified by grep) but does stream arbitrary user files; (c) the stuck `isHoming` state of F5 makes homing *appear* unfinished; (d) F6/F7 slow the travel moves adjacent to homing flows. No double-homing was found: each UI trigger maps to exactly one G28/requestHome, and the GoHomeModal button is guarded by its `loading` state (GoHomeModal.tsx:56-61, 80).
- **Evidence:** cited inline above.
- **Proposed fix:** Treat as documentation; optionally have Luban query/restore homing speed (`M1028 S1` readback) on connect, and surface "homing in progress" from actual machine state rather than synthetic events.
- **Upstream-relevant:** yes

## F9: `readyToWork` job-start race — any coordinate-move ACK (including a user jog) can fire the job-start trigger

- **Location:** `src/server/services/machine/channels/SacpChannel.ts:1180-1189` (and `:1281`, `src/server/services/machine/ConnectionManager.ts:684-689`, `src/server/services/socket/machine-handlers.ts:68`)
- **Severity:** P1 (likely reliability bug)
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** On SACP job start, the preamble issues `coordinateMove({moveOrders, ..., beforeGcodeStart: true})` (ConnectionManager.ts:689), which sets the channel-global flag `this.readyToWork = true` (SacpChannel.ts:1281). The generic coordinate-movement-return handler (SacpChannel.ts:1182-1188) emits `connection:headBeginWork` whenever **any** movement ACK arrives while the flag is set; that event is wired to `connectionManager.startGcodeAction` (machine-handlers.ts:68) which starts the print. A user-triggered jog or Go-To-Work-Origin in flight at the same time produces an indistinguishable ACK, so the job can start while the head is mid-jog at the wrong position/height — and conversely the flag is a shared mutable field with no correlation to the request it belongs to. There is also no UI lockout preventing jogs between "Start" and the preamble's completion.
- **Evidence:** `SacpChannel.ts:1182-1188`:
  ```ts
  this.sacpClient.handlerCoordinateMovementReturn(() => {
      this.socket.emit('move:status', { isMoving: false });
      if (this.readyToWork) { this.socket.emit('connection:headBeginWork', ...); this.readyToWork = false; }
  });
  ```
- **Proposed fix:** Correlate the movement ACK with the specific preamble request (sequence ID) instead of a channel-global boolean, and reject/queue user motion while a job start is pending.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `ConnectionManager.ts:684-689` SACP job-start preamble builds `moveOrders` (Z to 0) and calls `this.channel.coordinateMove({moveOrders, jogSpeed, headType, beforeGcodeStart: true})` (:689). `SacpChannel.coordinateMove` sets `this.readyToWork = beforeGcodeStart` (:1281) — a channel-global boolean. `handlerCoordinateMovementReturn` callback (:1182-1188, registered inside `setROTSubscribeApi`): on ANY movement ACK it emits `move:status {isMoving:false}` and, `if (this.readyToWork)`, emits `connection:headBeginWork` and clears the flag (:1184-1187). `machine-handlers.ts:68` wires `'connection:headBeginWork' → connectionManager.startGcodeAction`. So any in-flight coordinate-move ACK (user jog / Go-To-Work-Origin) while the flag is set fires job start.
- **Notes:** Confirmed. The cited line range 1180-1189 maps to the actual 1182-1188 handler; flag set at :1281; wiring at machine-handlers.ts:68. The handler lives in `setROTSubscribeApi`, called by Artisan/J1/Ray instances; SM2Instance does not register it (it never calls `setROTSubscribeApi`), so this race is operative on the legacy-heartbeat instances. No UI lockout between Start and preamble completion found. Severity P1 appropriate.

## F10: HTTP G-code queue serializes per call, but multi-call sequences (G53/G28/G54, job preamble) are interleavable by user commands

- **Location:** `src/server/services/machine/channels/SstpHttpChannel.ts:406-458` (and `src/server/services/machine/ConnectionManager.ts:698-736`, `:1297-1309`)
- **Severity:** P1 (likely reliability bug)
- **Symptom mapping:** origin-crash
- **Confidence:** medium
- **What happens:** `SstpHttpChannel.executeGcode` enqueues each call's lines as one atomic queue entry (SstpHttpChannel.ts:438-456) — good. But logical sequences are split across **multiple** `executeGcode` calls: `goHome` = three calls (`G53`, `G28`, `G54`; ConnectionManager.ts:1298-1308) and the laser job preamble pushes the Z-focus move, the camera-background XY move, and the final `G54;` as separate entries resolved via `Promise.all` (ConnectionManager.ts:701-741). Any concurrent user action (console line, jog via `coordinateMove`→`executeGcode`, ConnectionManager.ts:1323-1326) enqueues between those entries. A jog executed between `G53` and `G54` runs in machine-native coordinates (its absolute target reinterpreted), and a console command between `G53` and `G28` similarly. Additionally, on SACP `SacpChannel.executeGcode` fires all lines of a multi-line string as concurrent unsequenced requests (`Promise.all`, SacpChannel.ts:231-254), relying on TCP ordering only.
- **Evidence:** queue: `SstpHttpChannel.ts:413-427`; split sequences: `ConnectionManager.ts:701-736`, `1298-1308`.
- **Proposed fix:** Make modal-critical sequences single queue entries (one `executeGcode` call with `\n`-joined lines) and/or add a channel-level mutex that blocks user motion while a composite sequence is in flight.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** `SstpHttpChannel.executeGcode` (:435-458) pushes one queue entry per call with `gcodes: gcode.split('\n')`; `consumeGCodeQueue` (:406-430) drains entries with a `while` loop, each entry's lines run sequentially under `isGcodeExecuting` guard — so lines WITHIN one call are atomic, but each `executeGcode` call is a separate splice. `goHome` = three separate `executeGcode` calls `G53`/`G28`/`G54` (:1298-1308). Laser preamble pushes Z-focus, camera-XY, and `G54;` as separate entries resolved via `Promise.all` (:701-741). User jog reaches `coordinateMove`→HTTP `executeGcode(gcode)` (:1323-1324) as its own entry → interleavable between the composite sequence's entries. SACP `executeGcode` (`SacpChannel.ts:231-254`) splits lines and fires them as concurrent `Promise.all` (:234-239), relying on TCP ordering only.
- **Notes:** Confirmed. The intra-call atomicity is real (good), but composite modal sequences are split across calls and not mutexed against user motion. Medium confidence appropriate — exploiting it requires a concurrent user action landing in the window between entries. Severity P1 appropriate.

## F11: `setWorkOrigin` silently drops zero-valued axes on both protocols

- **Location:** `src/server/services/machine/ConnectionManager.ts:1334-1338` and `src/server/services/machine/channels/SacpChannel.ts:1290-1302`
- **Severity:** P1 (likely reliability bug)
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** Both implementations use truthiness to include axes: `xPosition && (gcode += 'X...')` / `if (xPosition) coordinateInfos.push(...)`. A coordinate that is exactly `0` (common: setting origin at machine X0 or after homing; `ABPositionOverlay.tsx:130-134` passes computed machine positions that can be 0) is **skipped**, so that axis keeps its previous origin. The caller believes the origin was fully set; a later "Go To Work Origin" then mixes new and stale per-axis origins — wrong XY position or, worse, a stale Z origin (bed crash contributor to symptom B). Note the workspace MotionButtonGroup "Set Work Origin" path avoids this by sending literal `G92 X0 Y0 Z0 B0` (MotionButtonGroup.jsx:17-24), so the bug specifically affects the AB-position/camera/server-mediated flows.
- **Evidence:** `ConnectionManager.ts:1334-1338`; `SacpChannel.ts:1291-1301`.
- **Proposed fix:** Test `!== undefined && !== null` (or `Number.isFinite`) instead of truthiness for every axis.
- **Upstream-relevant:** yes

### Verification
- **Verdict:** confirmed
- **Checked:** HTTP `ConnectionManager.setWorkOrigin` (:1334-1338): `let gcode = 'G92 '; xPosition && (gcode += \`X${xPosition||0} \`); yPosition && (...)` etc. — truthiness gates, so an axis value of exactly `0` is omitted from the G92 line. SACP `SacpChannel.setWorkOrigin` (:1288-1307): `if (xPosition) coordinateInfos.push(new CoordinateInfo(Direction.X1, xPosition))` etc. — same truthiness drop. `ABPositionOverlay.tsx:130-134` computes `machinePositionX = round((workPosition.x - originOffset.x)*1000)/1000` (can be exactly 0) and calls `server.setWorkOrigin(machinePositionX, machinePositionY)`. Workspace `MotionButtonGroup.setOriginWork` (:17-24) avoids this by sending literal `G92 X0 Y0 Z0 B0`.
- **Notes:** Confirmed on both protocols and the AB-position caller. A `0` axis silently retains its previous origin → mixed new/stale per-axis origins. Severity P1 appropriate.

## F12: `SacpClient.moveAbsolutely` wire format is inconsistent with `requestAbsoluteCooridateMove` — post-thickness-probe "Z to 0" move may be misparsed

- **Location:** `src/server/services/machine/sacp/SacpClient.ts:425-439` (vs `:684-690`; used at `src/server/services/machine/channels/SacpTcpChannel.ts:382-383`)
- **Severity:** P2 (latent risk/code smell)
- **Symptom mapping:** origin-crash
- **Confidence:** medium
- **What happens:** Both functions send SACP command 0x01/0x34 but encode different payloads. `requestAbsoluteCooridateMove` uses `MovementInstruction.toArrayBuffer()`: `[count][dir u8, dist f32]*N [speed i16][coordType i8]`. `moveAbsolutely` concatenates `[count]` + each `MovementInstruction.toBuffer()` (which itself begins with a constant `0x01` byte, then dir, dist f32, speed i16 hard-coded default 1200) + a trailing u16 speed (passed as 0 from SacpTcpChannel.ts:383). Parsed with the `toArrayBuffer` layout, the direction byte is the constant `0x01` (= Y axis) and the distance bytes are misaligned. This is invoked after the 10W-laser material-thickness probe to "move Z back to work 0" (SacpTcpChannel.ts:382-383) — if firmware uses the multi-axis layout, the command moves the wrong axis a garbage distance at an unspecified speed; if firmware special-cases the legacy single-move layout it works by accident. Two encoders for one opcode is at minimum a protocol hazard.
- **Evidence:** SDK encoders in `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/models/MovementInstruction.js` (`toBuffer` vs `toArrayBuffer`); call site `SacpTcpChannel.ts:382-383` (`new MovementInstruction(MoveDirection.Z1, 0)`, `moveAbsolutely([zMove], 0)`).
- **Proposed fix:** Delete `moveAbsolutely` and route the Z-return through `requestAbsoluteCooridateMove([Z1],[0], speed, WORKSPACE)`.
- **Upstream-relevant:** yes

## F13: Laser job preamble lowers Z to focus height before the XY positioning move; laser Run Boundary has no Z lift

- **Location:** `src/server/services/machine/ConnectionManager.ts:704,725` (order via `:701-736`); `src/app/ui/widgets/ConnectionControl/ControlPanel.tsx:206-246`
- **Severity:** P2 (latent risk/code smell)
- **Symptom mapping:** origin-crash
- **Confidence:** high
- **What happens:** On the HTTP laser start, the Z move to `laserFocalLength + materialThickness` (ConnectionManager.ts:704/710) is enqueued **before** the camera-background XY move (ConnectionManager.ts:725), so the head traverses XY at focus height (a few mm above the stock) and can hit clamps/warped material; for rotary the order is XY-then-Z (ConnectionManager.ts:730), showing the inconsistency. Run Boundary adds a protective `G91 G0 Z5` lift only for CNC (ControlPanel.tsx:207-209, 240-246), never for laser, and performs no machine-envelope clamping of the bbox (the only clamp anywhere is the camera-background XY clamp at ConnectionManager.ts:722-723 and Ray-specific clamps at ControlPanel.tsx:130-135). For comparison, the firmware's own HMI absolute move handler also moves Z before XY (`snapmaker/src/hmi/event_handler.cpp:958-961`) — neither side implements "lift, travel, descend".
- **Evidence:** promise enqueue order `ConnectionManager.ts:701-736`; CNC-only lift `ControlPanel.tsx:207-209`.
- **Proposed fix:** Reorder preamble to XY-then-Z (or add a fixed-height travel move), and apply the Z-lift in Run Boundary to laser as well when material thickness is non-zero.
- **Upstream-relevant:** yes

## F14: Console can leave G91/G53 modal state active with no guard on subsequent absolute motion buttons

- **Location:** `src/app/ui/widgets/Console/Console.jsx:97` (and `src/app/ui/widgets/ConnectionControl/Control.tsx:220`, `src/app/flux/workspace/index.ts:944-970`)
- **Severity:** P2 (latent risk/code smell)
- **Symptom mapping:** state-desync
- **Confidence:** high
- **What happens:** The console forwards raw user input to `executeGcode` (Console.jsx:97) with no modal-state tracking. A user who sends `G91` (advertised in the console help text, Console.jsx:135) and forgets `G90` leaves the machine in relative mode; jog commands re-assert `G90` only as part of their own atomic `G91...G90` wrapper (Control.tsx:220), but "Go To Work Origin" (`G0 X0 Y0 B0 Z0 F..`) does not — in relative mode it becomes a no-op, and any absolute move with non-zero values becomes an unintended relative move. Same applies to a console `G53` (F3). Luban keeps no shadow of G90/G91/G53/G54 state and never re-asserts a known modal baseline before motion buttons.
- **Evidence:** `Console.jsx:97` `dispatch(workspaceActions.executeGcode(data));` — no filtering; `flux/workspace/index.ts:944-970` passes through.
- **Proposed fix:** Prefix safety-critical button moves with `G90` (and the intended coordinate system) in the same queue entry.
- **Upstream-relevant:** yes

---

## Symptom summaries

**A — "Go home sometimes runs much slower than expected":** No Luban path can alter G28's feedrate (F8 — explicit not-found for a direct feedrate bug, with full command trace for both protocols). Concrete candidates, in order of likelihood: stuck `isHoming`/homing-modal state on HTTP making homing appear unfinished (F5); Z-first homing at fixed 10 mm/s making duration vary ~10x with head height (F8, firmware behavior); stale modal G0 feedrate slowing the F-less positioning moves that surround homing/origin flows (F6); persisted ultra-low jog speed slowing Go-To-Work-Origin/Run Boundary which users perceive as part of "homing" (F7); `M1028 S1` in third-party G-code permanently lowering homing speed until reboot (F8).

**B — "Go to work origin can drive the toolhead into the bed":** Fully traced sequence: `MotionButtonGroup.jsx:65-74` → `Control.tsx:231-254` → `MachineAgent.ts:186` → `ConnectionManager.ts:1313-1327` → SACP `SacpChannel.ts:1272-1286` (`0x01/0x34`, CoordinateType.MACHINE) or HTTP single line `G0 X0 Y0 B0 Z0 F{jogSpeed}`. Root causes: workspace targets sent as MACHINE coordinates on SACP (F1); simultaneous diagonal XYZ descent with dead-code axis ordering and no Z-lift (F2); modal G53 leak making the absolute move execute in machine space, plunging to machine Z0 (F3); stale saved origin restored after homing/toolhead/material change with no plausibility check (F4); zero-valued axes silently dropped when setting origin (F11).

## Coverage

Files read (Luban): `src/server/services/machine/ConnectionManager.ts` (motion-relevant sections in full), `src/server/services/machine/channels/SacpChannel.ts` (coordinate/home/origin/subscription/ACK sections), `src/server/services/machine/channels/SacpTcpChannel.ts` (material-thickness/startGcode sections), `src/server/services/machine/channels/SstpHttpChannel.ts` (executeGcode/queue/API surface), `src/server/services/machine/sacp/SacpClient.ts` (move/home/origin/coordinate commands), `src/server/services/machine/ProtocolDetector.ts`, `src/server/services/socket/machine-handlers.ts` (event wiring), `src/app/ui/widgets/ConnectionControl/{MotionButtonGroup.jsx,Control.tsx,ControlPanel.tsx}`, `src/app/ui/widgets/Connection/modals/GoHomeModal.tsx`, `src/app/ui/widgets/Console/Console.jsx` (command path), `src/app/ui/widgets/LaserCameraAidBackground/ExtractSquareTrace/index.jsx`, `src/app/ui/views/model-operation-overlay/ABPositionOverlay.tsx`, `src/app/flux/workspace/{index.ts,MachineAgent.ts}`, `node_modules/@snapmaker/snapmaker-sacp-sdk/dist/models/MovementInstruction.js`.

Files read (firmware): `Marlin/Configuration.h`, `Marlin/Configuration_adv.h`, `Marlin/src/gcode/gcode.cpp`, `Marlin/src/gcode/calibrate/G28.cpp`, `Marlin/src/gcode/geometry/{G53-G59.cpp,G92.cpp}`, `Marlin/src/gcode/motion/G0_G1.cpp`, `Marlin/src/module/motion.cpp` / `motion.h`, `snapmaker/src/hmi/event_handler.cpp` (+`event_handler.h`), `snapmaker/src/module/linear.cpp` (home directions/offsets), `snapmaker/src/module/toolhead_laser.cpp` (focus motion), `snapmaker/src/gcode/M1028.cpp`, `snapmaker/src/gcode/M2000.cpp` (comment), `snapmaker/src/service/{bed_level.cpp,power_loss_recovery.cpp,quick_stop.cpp}` (G28 call sites).

Open questions (not resolvable statically):
1. The firmware-side semantics of SACP 0x01/0x34's `coordinateType` byte and of the two competing payload layouts (F1, F12) — the public Snapmaker2-Controller repo contains no SACP server implementation; needs verification against the closed SACP firmware or a wire-capture on a live machine.
2. Whether SM2.0's `/api/v1/execute_code` blocks until motion completes (affects exact timing of F5; the state desync exists regardless of the answer).
3. Whether the coordinate values pushed by SACP subscription 0x01/0xa2 reflect the *modal* coordinate type set via 0x01/0x31 (affects which interpretation of F1 applies after `goHome`).
4. Which protocol (SACP-TCP vs HTTP) the user's specific firmware version actually negotiates — determines whether F1 (SACP) or F3/F5/F6 (HTTP) is the operative mechanism for their incidents.
