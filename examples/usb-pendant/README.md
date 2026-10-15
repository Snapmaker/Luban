# Feather USB joystick and DRO

Adafruit Feather ESP32-S3 **Reverse TFT**, board ID
`adafruit_feather_esp32s3_reverse_tft`. User-selected firmware: CircuitPython
**11.0.0-alpha.1 UF2**, with **20261003 11.x-mpy** Adafruit library bundle.
The controller uses USB, so the existing Wi-Fi settings are preserved but unused.

## Backup and recreation

The original USB device was backed up **before any update** to
`backups/2026-10-04-before-update/CIRCUITPY/`, beside this README in the local
controller project. `manifest.json` records all 161 copied files and their
SHA-256 hashes; every source/copy pair was verified. `settings.toml` contains
private configuration and stays local. Old firmware was CircuitPython 9.2.1;
`original-circuitpython-9.2.1.uf2` and `INFO_UF2.TXT` preserve its application
firmware and original TinyUF2 0.20.1 identity. The backup excludes Windows
`System Volume Information`. Do not publish the backup or private settings.

The local `firmware/` directory holds downloaded firmware, bootloader packages
and library bundles. The new `device/` directory is a complete installation
image including only the required latest display libraries and private
settings; `device-manifest.json` records its hashes. Code also lives in the
Luban repository under `examples/usb-pendant/firmware/`. Use that repository's
`deploy.py` to stage a fresh installation, or the local `deploy.py --device
device --drive D:/` to recopy a previously staged image.

Official downloads:

- [CircuitPython 11 board UF2](https://circuitpython.org/board/adafruit_feather_esp32s3_reverse_tft/)
- [Adafruit library bundle](https://github.com/adafruit/Adafruit_CircuitPython_Bundle/releases/tag/20261003)
- [TinyUF2 update instructions](https://learn.adafruit.com/esp32-s3-reverse-tft-feather/update-tinyuf2-bootloader-for-circuitpython-10-4mb-boards-only)

Installation uses **UF2 copying only**. Double-press RESET to mount FTHRS3BOOT,
then copy the selected CircuitPython 11 UF2. Verify `CIRCUITPY/boot_out.txt`
reports CircuitPython 11 and the exact board ID before copying device files.
This 4 MB board needs TinyUF2 0.33.0 or later and the larger application
partition layout. A bootloader self-update can retain the old partition table;
if a newer UF2 returns to FTHRS3BOOT, check the layout rather than claiming
installation succeeded. The bootloader update can erase CIRCUITPY, so keep
the verified backup. No esptool write is part of this workflow.

From the Luban repository, PowerShell:

```powershell
python examples/usb-pendant/deploy.py --uf2 C:/dev/python/circuitpython/3dof-luban-controller/firmware/circuitpython-11.0.0-alpha.1.uf2 --drive D:/
# After CIRCUITPY reappears and boot_out.txt confirms CircuitPython 11:
python examples/usb-pendant/deploy.py --project C:/dev/python/circuitpython/3dof-luban-controller --bundle C:/dev/python/circuitpython/3dof-luban-controller/firmware/adafruit-circuitpython-bundle-11.x-mpy-20261003.zip --settings C:/dev/python/circuitpython/3dof-luban-controller/backups/2026-10-04-before-update/CIRCUITPY/settings.toml --drive D:/
```

Press RESET once after copying `boot.py`. USB exposes **one data serial port**
and CIRCUITPY. This ESP32-S3 cannot fit the disk and two CDC interfaces within
its five IN endpoints (including EP0); HID and MIDI are also disabled.
For a maintenance console, hold built-in **D0 while pressing RESET**, then
release D0. The controller does not run in maintenance mode. Release D0 and
reset again to return to the data port. Alternatively temporarily set
`PENDANT_CONSOLE = "1"` in `settings.toml`; remove it before resetting to run.
The console is for diagnostics, never the jogging stream.
To restore the old application, copy its saved UF2 to FTHRS3BOOT and restore
the old CIRCUITPY tree. The new TinyUF2 layout supports CircuitPython 9.1+
but the original 9.x compiled libraries must be restored with the old code.

## Wiring and controls

| Input | Pin | Behaviour |
|---|---|---|
| Joystick X | D6 | X jog; inverted as in the original program |
| Joystick Y | D5 | Y jog |
| Twist | D9 | Feed adjustment or Z jog |
| Joystick button | D10, pull-down | Switch twist mode; entering Z mode caps feed at 1000 mm/min |
| Feather D1 | Built-in, pull-down | Hold to jog; release to stop requesting moves |
| Feather D2 | Built-in, pull-down | Tap to stop and disarm |
| Feather D0 | Built-in, pull-up | Tap to switch DRO machine/work frame |

Feed starts at 300 mm/min when the Feather boots; in feed mode twist
increases/decreases it within 60–3000. Entering Z mode caps it at 1000 mm/min
(a lower feed is kept); returning to feed mode keeps the capped value. Nothing
else changes the feed. Startup, a mode change, USB loss, a new arm
or STOP requires all axes centered and D1 released. Button edges are debounced.
X/Y remain available in both twist modes. No Wi-Fi, homing, origin writes,
spindle commands or raw G-code come from this controller.

Optional calibration keys in `settings.toml` are
`JOYSTICK_{X,Y,TWIST}_{CENTER,MIN,MAX,INVERT}` and `JOYSTICK_DEADZONE`.
Defaults are centre 32768, min 0, max 65535, 12% deadzone, X inverted.
Set these from actual released-centre and full-travel ADC readings; do not
automatically treat an off-centre boot position as neutral. `settings.example.toml`
contains public examples. Invalid calibration stops the firmware with a console
error in maintenance mode. Calibration and direction need a physical check before operator use.

## Luban operation

Install/build the PR version of this Luban fork, enable its MCP server, and
connect the machine in Luban. Open <http://127.0.0.1:40889/pendant>. Connect
the Feather data port. Review the machine-coordinate XYZ envelope and confirm
the usable space is clear for the fitted tool after reviewing the displayed
obstacle exclusions. Then click **Arm**. This operator page is the session's decision point; no MCP tool can arm a pendant.

The session lasts at most 10 minutes. X/Y default to ±5 mm around the current
position; Z defaults to 280–329 mm. **Fill machine X**, **Fill machine Y** and
**Fill both X/Y** fill known X/Y travel with 1 mm extra at each end. Jogging may
reach up to 1 mm past known travel on every axis (A350 Z travel ends at 328, not
the profile's 325): the machine accepts attempted overtravel and the DRO corrects
on the next position sync. Arming clips requested bounds to travel ±1 mm. A head
already outside the envelope is never pulled back by the clamp; it moves only
when the stick asks for a move.
There is no arbitrary 100 mm envelope span limit. This is direct, supervised manual control:
the operator approves the entire requested corridor, including its Z range, and
holds D1 for each movement. It does not reuse or broaden an AI job approval.
Stored obstacle footprints, including a 5 mm XY margin, remain excluded below
their displayed required machine Z (all heights if tool clearance is unknown).
A broad envelope may include these exclusions: every complete jog segment is
checked before transmission, on the exact 3-decimal target that is sent. This
includes diagonals, vertical descents and movement wholly inside a footprint;
there is no probing exemption. The single exception is a **straight Z-up exit**:
X and Y unchanged (within 0.05 mm) and Z strictly rising, still limited by the
envelope and travel Z maximum. A segment that would enter an exclusion below its
required Z is **held, not sent, and the pendant stays armed** (an envelope edge
clips the same way). In its place Luban sends only motion that stays clear: first
the approach up to 0.5 mm outside the exclusion (0.1 mm above its required Z),
then the same stick intent with the offending axis component removed, for example
X still moves while a Z-down twist over the rotary axis is refused. The dominant
stick axis is never the one removed, so a Z-down twist with slight X/Y drift holds
rather than sending only the drift. Every segment
actually sent passes the complete obstacle check. Nothing is re-sent while the
stick is unchanged; moving away, staying above the required Z, or centring the
stick continues normally. The page and TFT name the obstacle, its required Z and
the requested Z while held; the first hold per obstacle per arm is logged.
Displayed heights never understate the rule: required Z rounds up and requested
Z rounds down to 0.01 mm.

Arming is allowed with the toolhead already inside an exclusion below its
required Z, so the pendant can climb out. Until it leaves, the page and TFT show
`INSIDE rotary-axis below Z328: Z-up only` and only a straight Z-up exit is sent:
switch twist to Z mode and twist up. Every other stick motion holds, including Z-up
with any X/Y component; in feed mode twist only changes feed, so nothing moves.
Normal motion resumes once Z reaches the required height. Exclusions are
recomputed for every segment, so a landmark or fitted-tool change while armed
applies to the next one.
There is no landmark override on the pendant. The usual agent motion-floor
rules and staged-job workflow remain in force for AI operations. Pendant control requires homed, idle, coherent fresh position,
toolhead off and no safety alarm or active job. A reconnect invalidates the arm.

Only one move is in flight. The operator approves a 0.5–1 second maximum segment
duration (default 0.5 seconds), with distance calculated from feed and stick
deflection. Changed intent uses roughly 100 ms segments; steady input ramps to
the approved maximum. Measured controller/transport overhead reduces travel
time to target a complete command cycle under one second. Each segment
uses the existing machine-frame settled-motion engine and contact/crash
tripwire. USB samples replace intent rather than queueing moves. USB silence over 300 ms pauses new segments; input, browser or round-trip
feedback silence approaching one second disarms. STOP, expiry, invalid input
and motion errors also disarm. The browser must remain visible. An already accepted
segment can finish after release/STOP; use the machine's physical emergency
stop for immediate stopping. A stopped/error session holds its position and
does not invent a retreat or any extra motion.

### Continuous jogging (opt-in, not yet run on hardware)

**Why the default moves, stops, moves, stops.** Each settled segment is sent as
`G90`, `G53;`, `G1 …`, `G54;`, and the HTTP channel sends each line as its own
request and waits for its reply. On the Snapmaker controller `G54` runs
`select_coordinate_system()`, which calls `planner.synchronize()` when the
workspace changes, so the last reply arrives only once the G1 has finished
(live 2026-10-05: 0.50 s of motion, 777 ms until the reply). The next segment
then needs three more round trips before it moves, about 280 ms at rest each time.
A bare `G53` does not synchronize, and a plain G1 is acknowledged once queued.

Start Luban with `LUBAN_PENDANT_PIPELINE=1` to try continuous X/Y jogging. It is
read when you arm and is off by default. An X/Y jog then sends `M220 S100`,
`G90` and `G53` once, queues short G1 segments, and ends with one verified
settle: the ordinary settled move to the last queued point, whose G54 restores
the work frame and whose echo verifies the arrival. Z intent always uses the
settled path, and so does any connection other than the A350's HTTP channel.

**Smoothness trade-off, by default.** Nothing the A350 reports confirms
execution during a run. Its heartbeat x/y/z is the planner's queued target, 16
blocks ahead, and arrives every 2 s. So by default each run commands at most the
approved segment duration (0.5–1 s), then settles and verifies. The backlog can
then never exceed one approved duration of travel, however slowly the controller
actually runs. With that default, a run moves no further between stops than one
settled segment does, so it is not yet smoother than the settled path.

After you have verified stop behaviour on hardware, you can raise
`LUBAN_PENDANT_PIPELINE_RUN_MS`, up to 2000 ms, to get continuous runs. Raising
it raises the worst-case backlog to the same figure. M114's `Count` fields may
give a real executed-position signal that would lift this limit safely; that
signal is unverified, and nothing relies on it yet.

**Arming checks the controller.** Luban reads `M503 S` and keeps pipelining off
(`pipeline.disabled` in `/pendant/status`) unless all of these are reported and
fit the model:

- `M203` X/Y max feed is at least 50 mm/s.
- `M201` X/Y max acceleration is at least 500 mm/s².
- `M204` P/T acceleration is at least 500 mm/s².

The Snapmaker build's `M220` reports nothing, so the feed override cannot be
read. Each run therefore sends `M220 S100`. **That setting persists after
jogging.** Any reduced touchscreen speed percentage is overridden for later file
jobs too, so set it again before a job that relies on it. The page shows this
warning whenever pipelining is active.

**The run's guards:**

- **Exclusive lease** (`machine/gcodeLease.ts`). It is held from before the G53
  until the closing G54, and it does not lapse while the run may have G53
  selected. The channel request timeout is 300 s, and `finally` releases the
  lease.
  - **What it refuses:**
    - every channel's `executeGcode`;
    - the SSTP job and override endpoints: start, resume, work-speed, laser-power
      and Z-offset overrides, filament load and unload, and the laser
      material-thickness probe;
    - ConnectionManager `startGcode`, `startGcodeAction`, `resumeGcode`, `goHome`,
      `coordinateMove` and `setWorkOrigin`;
    - the MCP file-job start, which goes through `startGcodeJob`.
  - **What it does not cover:** file upload and `prepare_print` (no motion), job
    pause and stop (allowed on purpose), status polls, and enclosure and
    air-purifier controls.
  - **If the restore fails:** the lease becomes a recovery hold. It accepts only
    `G90`/`G53`/`G54`/`G28`, `M5`, `M114`, `M400`, `M503`, homing and job
    stop/pause until the frame latch clears.
- **Frame-uncertainty latch.** It is set before the G53 is sent and persisted
  across Luban restarts. On startup it returns together with the recovery hold.
  - **Every exit path restores G54:** the normal settle; a no-motion `G90`/`G54`
    after a lost reply or a failed settle; an awaited `shutdown()`.
  - **A run that queued nothing** (stick released, obstacle hold or a Z switch
    straight after the G53) restores and then proves the position with `M114`.
    It stays armed.
  - **Clearing:** the latch clears only after an acknowledged restore AND a
    verified position. Until then pendant arming and all MCP motion are refused.
    It appears in `get_position` warnings and in diagnostics.
  - **If the restore fails,** the crash guard also stays armed until the latch
    clears.
- **Segments and queue model.** Each segment is at most (approved duration −
  150 ms) / 2. Marlin never replans a block it is already executing, so the next
  segment has to arrive before the one ahead starts. Luban sends a segment only
  while the modelled unfinished motion stays within the approved duration, with
  at most three segments unfinished.
- **Obstacles.** Every target goes through the obstacle hold and approach logic
  from the previous queued endpoint, rounded to the three decimals that are sent,
  and then the full envelope and segment checks. A held or released stick ends
  the run with a settle.
- **Heartbeats in a run.** While the run is declared (from its G53 reply to its
  G54 reply), the tracker judges heartbeats as machine coordinates and sets
  ambiguous ones aside. A lag check compares them with the queue model. It is
  **unproven and expected to be inert on the A350**, because its beats show the
  queued target, and nothing relies on it.
- **Falling back.** An acknowledgement slower than 400 ms, or a drain that ends
  more than 300 ms after the modelled end, returns the session to settled jogs
  until it is re-armed.
- **Stale heartbeat.** A heartbeat older than 2.5 s ends the run.
- **If the controller reports anything but idle during queued motion, the run
  ends and the pendant disarms.** The page and TFT say so, and you must re-arm. If
  it happens on every jog, this controller reports busy during queued moves:
  restart Luban without `LUBAN_PENDANT_PIPELINE`.

**Stop latency (pipelined X/Y, 3000 mm/min = 50 mm/s).** STOP, a released
deadman and a centred stick are seen on the next 20 Hz USB frame. No segment is
sent after that. What is already queued is at most one run's commanded travel,
and with the default budget that is the approved duration: 0.5 s / 25 mm by
default, 1.0 s / 50 mm at most. This holds whatever the controller's real speed,
including a stall or a touchscreen speed override. A slower controller takes
longer to cover that distance, but cannot be asked to go further. Worst case at
full speed, from the event to standstill:

| Event | Default 0.5 s | Approved 1.0 s |
|---|---|---|
| STOP, deadman release or neutral | about 0.61 s, 28 mm or less | about 1.11 s, 53 mm or less |
| USB silent (no new segment after 300 ms) | about 0.86 s | about 1.36 s |
| Browser keepalive lost (disarms at 900 ms) | about 1.46 s | about 1.96 s |

If you raise `LUBAN_PENDANT_PIPELINE_RUN_MS`, a stalled controller could hold
that much commanded travel, at most 2 s (100 mm). The settled path's bound is one
in-flight segment of up to the approved duration. Z jogs stay settled: at the
Z-mode limit of 1000 mm/min that is at most 8.3 mm (0.5 s) or 16.7 mm (1 s).

**Still needs hardware verification:**

- `G53` does not synchronize, and plain G1 replies arrive once the move is queued.
- The controller reports idle during queued direct moves.
- `M503 S` and `M114` text come back through the HTTP API.
- `M220 S100` is accepted.

Marlin has `M410` (quickstop), but Luban does not use it: the Snapmaker build
lacks the emergency parser, and its behaviour over this channel is unverified.
Commission continuous jogging with small envelopes and the physical emergency
stop in reach. Compare `pipeline.lastRun` and `lastJog` in `/pendant/status`
with what the machine did.

MCP mutations are excluded while the pendant owns control, and a pending MCP
operation prevents arming. Read-only `get_*`, `list_*`, `validate_*` and
`stop_gcode_job` remain available; stop also disarms. Manual control is
loopback-only even when MCP LAN access is enabled. Operator POSTs require a
page token, matching origin, and a loopback Host. The page cannot be framed.
The operator should not jog simultaneously using the touchscreen or other UI.

Arm and jog refusals appear next to the Arm/Stop controls, receive focus and
scroll into view, persist through polling, and are logged under
`service:mcp:pendant`. Stop explicitly reports disarmed; raw joystick samples and
DRO updates continue as diagnostics. A firmware sequence reset disarms and
recovers incoming telemetry without waiting for the old counter; centre and
explicitly arm again. The TFT scrolls Luban's refusal or stop reason.

### Bed plan and obstacle warning

The page draws a plan view of the bed in machine X/Y, Y up as on the A350
(-19..339 by 0..342, widened to any stored obstacle): the known travel (dashed
blue), the envelope being reviewed or the armed one (green), each obstacle
exclusion with its 5 mm margin labelled with its name and `needs Z ≥ N`, and the
toolhead. The toolhead is a white dot only while the DRO is verified; otherwise a
hollow amber ring marks the held, stale position. The map follows every status
poll and every edit to the bounds fields. A table below it lists each exclusion,
its required toolhead Z, the stored landmark height and basis (physical top,
minimum toolhead Z, or the legacy toolhead default) and its notes.

An obstacle turns red when the envelope's XY reaches its footprint and the
envelope's Z minimum is below its required Z. A red warning then appears beside
the Arm button, for example *Your envelope Z 280–328 overlaps rotary-axis: inside
X135–205, Y-5–355 (incl. 5 mm margin) the toolhead cannot go below Z328; Z-down
or entry there below Z328 will be held, not sent.* The warning does not block
arming: the operator may arm a broad envelope knowingly, and jogs into the
exclusion are then held as described above. While armed, a hold is shown beside
the map and in the state line, e.g. `BLOCKED rotary-axis: Z>=328 (asked 327.91)`,
or `LIMITED …` when only the clear part of the stick motion was sent.

The TFT's bottom row shows the same reason while linked and the stick is
deflected, red for BLOCKED and amber for LIMITED, scrolling when longer than its
38 characters. It returns to the grey help text as soon as the stick is centred
or Luban accepts a full segment. `INSIDE … Z-up only` stays on the row (red)
while linked, even with the stick centred, until the toolhead leaves the
exclusion. While disarmed the row still scrolls Luban's
refusal or stop reason.

Twist in feed mode adjusts the displayed feed while connected and disarmed,
without producing motion intent. Arming, disarming, a mode change, USB loss and
STOP keep the feed (Z mode caps it at 1000 mm/min); centre all axes and release
D1 before jogging. The first segment after any change is still short.

The TFT shows reported machine or work XYZ on the left, with **FEED** and its
larger numeric value beneath on the right, plus twist mode at the top. It blanks stale,
disconnected or unreliable DRO data instead of displaying a locally integrated
position as a measurement. USB DRO updates do not make the machine's 2-second
heartbeat faster. Verify direction, calibration, stop/reconnect and a tiny
reviewed movement with the operator before treating the system as commissioned.

## Operator settings and twist-mode indication

The pendant page includes an operator editor for the fitted tool's clearance
protrusion and saved obstructions. Operators can add, edit, rename, disable or
remove an obstruction, including its machine XY bounds and either physical top
height or minimum toolhead Z. Switching height basis does not convert the
number: enter the actual physical top when selecting that basis. A physical
height adds the confirmed tool protrusion and 5 mm clearance margin; legacy
toolhead heights already include the tool. The editor previews the result.

Changes persist in Luban's shared records and are logged with before/after values.
They require the same local page token and origin checks as arming. Saving
disarms, refuses while a segment or machine job is running, excludes concurrent
MCP mutations, and requires a fresh arm. The editor shows the effective fallback
when the fitted tool is unconfirmed or stale; confirming a tool here records an
operator assertion, not a tool-setter measurement or probe calibration.

Twist **Z** mode changes both the page and Feather backgrounds to red, with a
text danger indication, whether armed or disarmed. Feed-adjust mode restores
the normal dark background. This indication does not grant motion authority;
operator arming, neutral input and held D1 are still required.

## Wire protocol and checks

USB data uses newline-delimited JSON at nominal 115200 baud. Input has
`v:1`, increasing `seq`, normalized `x,y,z`, `mode:feed|z`, `feed:60..3000`
(at most 1000 in Z mode),
and booleans `ready`, `deadman`, `stop`. Additional diagnostics `raw` contain
the X/Y/twist ADC samples, and `display` contains the initialized TFT dimensions.
Feed mode must send Z=0. Optional `fw` names the firmware build (Luban logs
it on connect, so a board still running an older `code.py` is visible) and
optional `log` carries one rare firmware event such as a link change or short
write. A rejected frame is disarmed with the failing field named, for example
`Invalid USB pendant frame: feed 1200 above the Z-mode limit 1000 mm/min`. Luban replies
with `type:dro`, `armed`, `neutral`, `machine`, `work`, `reliability`, `age_ms`,
`warnings`, an operator `message`, and `blocked`: `null`, or
`{name, requiredZ, requestedZ, held, inside, text}` while an obstacle is holding
(`held:true`) or limiting (`held:false`) the stick, or `inside:true` while the
toolhead is inside an exclusion below its required Z (Z-up only). `requiredZ` is `null` when
tool clearance is unknown and the footprint is excluded at every height. Luban
logs the firmware id once per connection, `unidentified (pre-fw build)` for a
board that sends none. The board has no authority without the
operator's armed session and fresh DRO reply.

```powershell
python examples/usb-pendant/test_controller.py
npm run test:mcp
npm run typecheck:mcp
```

To trace the USB link, start Luban with `LUBAN_PENDANT_TRACE=1` (for example
`LUBAN_PENDANT_TRACE=1 snapmaker-luban` from a terminal). Every received frame,
every DRO reply and every firmware `log` event is written under
`service:mcp:pendant` as `[trace] rx …`, `[trace] tx …` and `[trace] feather …`,
to that console and to `~/.config/snapmaker-luban/Logs/server.log`. That is
about 30 lines per second, so it is off by default. The normal firmware runs
without a REPL because the ESP32-S3 has no endpoints left for it, so this trace
is the serial log.

These tests use simulated input and do not move hardware. Hardware firmware
version, serial enumeration and real display startup must also be verified.

The page shows MACHINE and WORK coordinates together. Both come from the existing
machine position tracker; raw G53-window heartbeat fields are never labelled as
work coordinates. The pendant reuses the tracker's recheck logic for its own
verified arrivals, retains heartbeat warnings in diagnostics, and uses the same
10-second heartbeat stale threshold. Normal 1–2 second reporting latency does
not by itself disarm jogging. Estimated positions remain explicitly unverified.

**Restore work frame (no motion)** disarms jogging and sends the shared G90/G54
recovery command. Use it when the controller was left in a machine or relative
mode and Luban's ordinary jogs are refused. It does not automatically re-arm or
claim that a fresh heartbeat has already verified recovery.

**Home all axes (including rotary B)** is an explicit operator action on the
local page. It disarms jogging, excludes concurrent MCP operations, and uses the
existing homing routine with its stale-position override. Attached rotary stock
will rotate. Alarm, toolhead and idle checks remain; completion requires fresh
feedback. Jog Stop does not cancel an already accepted homing command.

The general automatic post-tool failure recovery hook is tracked separately in
[issue #221](https://github.com/tyeth/Luban/issues/221); it is not implemented here.

USB input runs at 20 Hz and host feedback at least 10 Hz while connected. The
host echoes received input sequence numbers; the Feather measures round-trip
age on its own clock, rejects replayed acknowledgements, and drops jog intent
before feedback reaches one second old. Packets carry compact display data;
full coordinate warning details remain on the web diagnostics page. The page
shows round-trip time and commanded versus total segment duration. A long
controller/network stall cannot be cancelled merely by changing the stick; no
additional segment is queued, and the physical emergency stop remains available.

The TFT and page retain their last trusted DRO values during an in-flight jog or
coordinate-frame transition. These held values are labelled as updating (or
stale on feedback loss) and never authorize motion. New verified arrivals
replace them. A heartbeat received after an echo but still showing the tracker's
previous position is treated as delayed using the existing tracker recheck.
