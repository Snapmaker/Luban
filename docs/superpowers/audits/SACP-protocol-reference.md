# SACP (Snapmaker A-Series Communication Protocol) — Reference Notes

**Purpose:** Notes for the deferred SACP findings (R1/R2/R3 and the SACP legs of the motion/origin findings). Your A350 on V1.21.0 uses **HTTP over Wi-Fi**, so SACP is currently exercised only over **USB-serial** (`SacpOverSerialPort`) and would matter if Luban's Wi-Fi SACP path were ever reached (Artisan/J1/Ray, or a future SM2 firmware that opens TCP 8888 / answers UDP 8889).

**Sources:** the protocol is **not** in `Snapmaker2-Controller` (the SACP server lives on the closed-source touchscreen). Everything here is reconstructed from Luban's client: the vendored SDK `@snapmaker/snapmaker-sacp-sdk@0.1.1` (`node_modules/.../dist/`) and `src/server/services/machine/sacp/SacpClient.ts`.

---

## Wire format

```
+--------+--------+--------+---------+-----+----------+----------+-----------+--------+---------+----------+
| SOF hi | SOF lo | len(LE u16) | ver  | rcv | CRC8(0..5)| sndr     | attr      | seq(LE u16) | cmdSet | cmdId | payload… | chksum(LE u16) |
|  0xAA  |  0x55  |  2 bytes    | 0x01 | u8  |  u8       | u8       | u8        |  2 bytes    |  u8    |  u8   |  N bytes | 2 bytes        |
+--------+--------+-------------+------+-----+-----------+----------+-----------+-------------+--------+-------+----------+----------------+
  offset:  0        1     2-3      4     5      6           7          8           9-10          11      12      13…        last 2
```

- **SOF** = `0xAA55` (`Header.js writeSOF`). Header is **13 bytes** (`Header.byteLength`), CRC8 covers header bytes 0–5 (`calcCRC8`), payload checksum is `calcChecksum(buffer, 7, len-7)` written LE u16 (`Packet.toBuffer`).
- **length** field = `payload.byteLength + 8` (`Dispatcher.send`). Minimum on-wire packet = 15 bytes (13 header + 0 payload + 2 checksum); `Communication.send` rejects buffers `< 15` as `'invalid SACP packet'`.
- **receiverId / senderId** = `PeerId` enum: `LUBAN=0, CONTROLLER=1, SCREEN=2`. Luban→machine commands target `CONTROLLER` (default).
- **attribute** = `REQUEST=0` / `ACK=1`.
- **sequence** = shared uint16 counter, `seq = (seq+1) % 0xffff` per send (`Communication.getSequence`). Correlation key = `"<commandSet*256+commandId>-<sequence>"` (a.k.a. `businessId-sequence`).
- **Transports:** TCP (port 8888, stream — needs reassembly, see 04-F7), UDP (port 8889, datagram = whole packet), or serial. Discovery is UDP broadcast on 20054.

## Request / response / subscription model

- **Request → ACK:** `Dispatcher.send(commandSet, commandId, peerId, payload, isRTO?, sequence?)`. Resolves `{response, packet}` where `response = Response.fromBuffer(packet.payload)`; `response.result` (u8) `=== 0` means success.
- **Timeouts/retry:** only when `isRTO === true` (2 s timer, up to 2 resends, then resolves a **fabricated** `result=2` packet). **Default `isRTO=false` → no timeout, promise can pend forever** (audit 04-F2; only 7 of ~90 methods are RTO).
- **Subscriptions:** `Dispatcher.subscribe(commandSet, commandId, interval, callback)` registers an EventEmitter listener on the `businessId`; the machine then pushes periodic reports (attribute carries the subscription). Unmatched/late ACKs can be mis-delivered to subscription listeners (04-F6).

## Command-set map (extracted from `SacpClient.ts`)

Grouped by `commandSet`. Format `cmdId → method` (Luban-side name).

**`0x01` — System / Motion / Coordinates**
- `0x02` executeGcode · `0x05` (machine-close ack/0x06 machine-initiated close handler) · `0x06` wifiConnectionClose
- `0x10` logFeedbackLevel · `0x15` getNetworkConfiguration · `0x16` getNetworkStationState
- `0x20` getModuleInfo · `0x21` getMachineInfo · `0x22` getMachineSize
- `0x25` configureNetwork · `0x26` (network station) · `0x30` getCurrentCoordinateInfo · `0x31` updateCoordinate (set coordinate-system type: MACHINE/WORKSPACE)
- `0x32` setWorkOrigin · `0x34` **requestAbsoluteCooridateMove / moveAbsolutely / movementInstruction** (RTO) · `0x35` **requestHome** (no timeout — 04-F2) · `0x36` **home-complete report handler** (registered only in legacy heartbeat — 04-F3) · `0x3b` getEmergencyStopInfo · `0x48` setMotorPowerHoldMode
- subscriptions: coordinate info `0x01/0xa2`, heartbeat/status.

**`0x04` — Error reporting**
- `0x02` getErrorReports (RTO) · error-report push handler `0x04/0x00` (`registerErrorReportHandler`).

**`0x10` — FDM / extruder**
- `0x01` GetFDMInfo · `0x02`/`0x04` nozzle info sub/unsub · `0x05` SwitchExtruder(?) · `0x06` · `0x08` GetExtruderOffset · `0x09` ExtruderMovement · offset `0xa0/0x15` (SetExtruderOffset, RTO).

**`0x11` — CNC**
- `0x02` setCncPower · `0x03` setToolHeadSpeed · `0x05` switchCNC.

**`0x12` — Laser**
- `0x01` SetLaserPower · `0x02` SetBrightness · `0x03` SetFocalLength · `0x04` TemperatureProtect · `0x05`/`0x07` SetLaserLock / getLaserLockStatus · `0x0a`/`0x07` laserCalibration(Save) · `0x0d`/`0x0e` get/setFireSensorSensitivity · `0x10`/`0x11` get/setCrosshairOffset · `0x1a`? · laser-power-state subscription `0x12/0xa1`.

**`0x14` — Hot bed**
- `0x01` GetHotBed · `0x02` setHotBedTemperature · hotbed-temp subscription.

**`0x15` — Enclosure**
- `0x01` getEnclousreInfo · `0x02` setEnclosureLight · `0x03` setEnclosureDoorEnabled · `0x04` setEnclosureFan · enclosure-info / light-info subscriptions.

**`0x17` — Air purifier**
- `0x01` getAirPurifierInfo · `0x02` setPurifierSpeed · `0x03` setPurifierSwitch · purifier-info subscription.

**`0xa8` — File**
- `0x02` getGocdeFile · `0x03` laserCalibrationSave.

**`0xac` — Print/job control**
- `0x00` (batch buffer) · `0x03` startPrint (RTO) · `0x04` pausePrint (RTO) · `0x05` resumePrint (RTO) · `0x06` stopPrint (RTO) · `0x0e`/`0x0f` set work origin / coordinate (CoordinateInfo) · `0x1a` line-number / printing-time / progress subscriptions.

**`0xad` — Firmware upgrade**
- `0x00` upgradeFirmwareFromFile.

**`0xb0` — Wi-Fi connection / camera / file upload**
- `0x01` wifiConnection (handshake; explicit `isRTO=false`) · `0x02` subscribeHeartbeat · `0x0b` wifiConnectionHeartBeat (sent once per connect — 03 open-Q#4) · `0x00` uploadFile · `0x10` uploadFileCompressed · `0x0a` resumePrintForScreen
- camera (10W laser module): `0x03` getCameraCalibration · `0x04` takePhoto · `0x05` getPhoto · `0x06` getCalibrationPhoto · `0x07` setMatrix · `0x08` startScreenPrint · `0x09` getLaserMaterialThickness.

> Note `0x34` is reused by three encoders (`requestAbsoluteCooridateMove`, `moveAbsolutely`, `movementInstruction`) with **different payload layouts** — see audit 02-F12. The coordinate-type byte (MACHINE=0/WORKSPACE) is appended by `MovementInstruction.toArrayBuffer`; whether the closed server honors it is unverified (02-F1).

## Why the live UDP probe got no reply (and why HTTP wins anyway)

`SacpUdpChannel.test()` (and our faithful replica) sends a bare `getMachineInfo` (`0x01/0x21`) with **no prior `wifiConnection` (`0xb0/0x01`) handshake**. The A350/V1.21.0 screen did not answer on UDP 8889 (and refused TCP 8888). Even if SACP-UDP required a handshake first, **Luban's own detector also probes without one**, so it would still fall through to HTTP. Operationally: **this machine = HTTP over Wi-Fi.**

## Deferred SACP fixes (when/if SACP path is used — e.g. USB-serial)

- **R1 (04-F2):** add a default per-request timeout in the `SacpClient` wrapper; reject in-flight handlers on `dispose()`/socket close. Cheap, high value for any SACP transport.
- **R2 (01-F3 / 03-F8):** emit `ChannelEvent.Ready` unconditionally (decoded `machineIdentifier`) in `SacpTcpChannel`. Only matters if a machine opens TCP 8888.
- **R3 (01-F4 / 04-F3):** give `SM2Instance` the full subscription set + `0x01/0x36` home-complete handler + `connection:connected` + error-report handler. Matters for SM2 over SACP-serial/UDP.
- SACP legs of motion/origin: 02-F1 (MACHINE coord), 04-F10 (origin-setup swallow), 02-F12 (`0x34` encoder mismatch).
