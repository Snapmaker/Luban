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
**Fill both X/Y** fill known X/Y travel with 1 mm extra at each end. The page
previews the usable intersection with known travel; arming clips the requested
bounds to that intersection (A350 Z ends at 328, not the profile's 325).
There is no arbitrary 100 mm envelope span limit. This is direct, supervised manual control:
the operator approves the entire requested corridor, including its Z range, and
holds D1 for each movement. It does not reuse or broaden an AI job approval.
Stored obstacle footprints, including a 5 mm XY margin, remain excluded below
their displayed required machine Z (all heights if tool clearance is unknown).
A broad envelope may include these exclusions: arming checks the current point,
and every complete jog segment is checked before transmission. This includes
diagonals, vertical descents and movement wholly inside a footprint; there is
no probing exemption. A blocked jog disarms and names the obstacle, required Z
and attempted Z, without sending that segment. The usual agent motion-floor
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
`warnings` and an operator message. The board has no authority without the
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
