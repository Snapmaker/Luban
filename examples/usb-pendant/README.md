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

### Continuous jogging (opt-in, not yet run on hardware in this form)

**Why the default moves, stops, moves, stops.** Each settled segment is sent as
`G90`, `G53;`, `G1 …`, `G54;`, and the HTTP channel sends each line as its own
request and waits for its reply. On the Snapmaker controller `G54` runs
`select_coordinate_system()`, which calls `planner.synchronize()` when the
workspace changes, so the last reply arrives only once the G1 has finished
(live 2026-10-05: 0.50 s of motion, 777 ms until the reply). The next segment
then needs three more round trips before it moves, about 280 ms at rest each time.
A bare `G53` does not synchronize, and a plain G1 is acknowledged once queued
(measured: replies in 38–69 ms for moves that take about 175 ms).

**Why there are no "runs" any more.** The first continuous mode queued about a
second of segments up front, closed each run with a `G54` that drained the
planner (about 550 ms), then waited up to 2 s for a verified heartbeat before
the next run. On the A350 that produced a second of motion, a 0.5–2 s stop,
repeat, and about half a second of queued motion after D1 was released. The run
was the cause, so the design is now **one hold**: one `G53` when D1 is pressed,
clock-paced increments while it is held, one `G54` when it is released or
anything stops the hold.

Start Luban with `LUBAN_PENDANT_PIPELINE=1` to enable it. It is read when you
arm and is off by default. Z intent always uses the settled path, and so does
any connection other than the A350's HTTP channel.

**The hold (`pendantRuntime.ts` `continuousHold`, constants in `pendantHold.ts`):**

- **One G53 at the press, one G54 at the stop.** The whole hold runs inside one
  gcode-lease acquisition. The press sends `M220 S100`, `G90`, `G53;` once (the
  frame latch is raised *before* the send, so a lost reply still counts). The
  stop sends nothing further, then closes through the shared restore path:
  `sendWorkFrameRestore` (`G90`/`G54;`, which synchronizes the planner, so its
  reply arrives once the queued motion has finished), `noteFrameRestored` on
  acceptance, then `verifyRestoredPosition`'s `M114`, which proves the
  commanded end position in the work frame and clears the latch at once. If the
  `M114` cannot prove it, the next verified work-frame heartbeat clears it (up to
  about 3 s). If the restore fails, the lease hands over to the recovery hold,
  which is the latch itself. There is no second restore path.
- **Clock pacing.** Every 100 ms (`HOLD_TICK_MS`) the hold sends one `G1` worth
  100 ms of travel at the current feed (`HOLD_MOVE_MS`: 0.5 mm at 300 mm/min,
  5 mm at 3000), following the Feather's latest 20 Hz report. A clock model
  (`HoldQueueModel`) tracks outstanding motion as sent minus executed by the
  clock, charging each increment its commanded time from its send time, and
  never lets more than 200 ms (`HOLD_QUEUE_AHEAD_MS`) be outstanding. Every `G1`
  reply is awaited before the next is sent, so at most one is unanswered. These
  are constants, not settings. Increments are `G1 X Y F` with **no Z word** (the
  controller keeps its current Z): the hold's Z is the heartbeat-derived record
  Z, which may rest on a reused offset, and with no Z word a wrong record Z makes
  the close's `M114` proof fail (the latch then waits for a verified beat)
  instead of being driven to at stick feed. The settled path still sends the
  record-Z word it always has (hardware-proven, unchanged here); it should get
  the same treatment once the trial confirms.
- **The position of record is blind for the hold.** Heartbeats sampled inside
  the `G53` window are set aside by design, so the record holds at the press
  position. Every increment is therefore checked from the pendant's own
  dead-reckoned commanded position (the press position plus every increment
  sent) against the reviewed envelope (which stands up to travel ±1 mm, never
  clipped back) and the obstacle map. The obstacle test covers the increment
  **plus the maximum queued run-out** (200 ms at the increment's feed: 10 mm at
  3000 mm/min, 1 mm at 300), so motion already queued when the stop is decided
  can never enter an exclusion. An obstacle stops the hold and the pendant
  stays armed, as the settled path holds; straight Z-up exits stay on the
  settled path. The same lookahead runs **before** a hold opens: a stick
  pointed at a box within one increment plus run-out (15 mm at 3000 mm/min)
  never sends the `G53`; the settled path jogs toward the pad and holds there
  as the obstacle hold does, and continuous jogging stays off until the stick
  returns to neutral (`pipeline.holdOffUntilNeutral`), so a stick held against
  a box does not open and close a hold several times a second.
- **Stops at once** (nothing further is sent, then the `G54`): D1 released, the
  stick centred, a gap of more than 150 ms since the last Feather report
  (`HOLD_FEATHER_GAP_MS`; the same press resumes with a new hold once reports
  return within the 900 ms watchdog), the page keepalive lost, a `G1` reply
  error, timeout or rejection, a `G1` acknowledged later than 200 ms (the
  controller is holding requests; each late reply stops its hold, and three in
  a row within one arm turn continuous jogging off until re-arm,
  `HOLD_LATE_EVENTS_TO_DISABLE`), any lease refusal, a crash or overtravel
  alarm, a connection generation change, the frame latch changing under the
  hold, the controller reporting anything but idle, a heartbeat older than
  4.5 s (two 2 s poll periods plus jitter, so one late poll never flips a hold
  into a settled burst and back), a switch to Z, and (in `enforced` mode) the
  Count check. After the stop the queued motion runs out. The clock model
  charges commanded time only; the controller lags it by its acceleration
  ramps (at 3000 mm/min and 1000 mm/s² about 75 ms over a hold's first blocks)
  and by one-way transport (about half a round trip, 20–35 ms), so the
  worst-case run-out after a release is about 310 ms: 15.5 mm at 3000 mm/min,
  1.5 mm at 300. If a `G1` reply lands just under the 200 ms late limit the
  controller may be holding one more block, about 24 mm at 3000 mm/min. Trial
  data governs these numbers (the Count trace measures the real lag); safety
  does not rest on them, because queued motion never passes a validated
  endpoint and the obstacle lookahead adds the run-out on top.
- **M114 Count check.** During a hold `M114` is polled every 250 ms
  (`HOLD_COUNT_POLL_MS`) through the same lease (it moves nothing). The reply's
  `Count X: Y: Z:` fields are stepper counts; they are turned into millimetres
  with the `M92` steps/mm from the `M503 S` read at arm time, or the A350
  default of 400 steps/mm when `M503 S` does not report `M92` (the status says
  which). **Counts are not machine coordinates.** On the trial A350
  (2026-10-05, four at-rest samples) Count/400 read machine X + 19, Y + 4,
  Z + 0: machine X263.42 Y0 Z299.67 printed `Count X:112966 Y:1600 Z:119867`.
  Count X zero is the X home switch at machine X −19, so the counts are
  measured from the homing position. Luban therefore **learns the per-axis
  offset on every arm** (`pipeline.countCheck.countOffsetMm`, with
  `countOffsetLearnedAt`): one `M114` while idle, right after the `M503 S`
  read, with the reliable position of record the arm just admitted; offset =
  Count / steps-per-mm − record machine position. Nothing is assumed, and a
  home between arms (which could reset the counts) is covered by the re-learn.
  If the arm-time reply has no `Count`, or the `M114` fails, the offset is
  unknown (`countOffsetProblem` says why): observe mode arms and traces the
  raw Count only, deriving and judging nothing; enforced mode refuses to arm
  with that reason rather than gate on an unreadable Count. Each sample records
  the reply time, the raw Count (steps) and `rawMm` (Count / steps, the Count
  frame, kept so the trial can see the offset stay constant during motion),
  the derived machine position (raw minus the learned offset), the reply's own
  X/Y/Z fields, the clock model's expected executed position at the send time
  and the XY distance between the two (`lagMm`; it is symmetric, a controller
  running ahead of the model counts like one behind it).
  - `countCheck: observe` (the **default**): every sample is traced and shown,
    and the check never stops a hold. The open-loop clock pacing with the 200 ms
    cap is the whole behaviour. Observe mode is inert for *gating* only: the
    poll is still a request on the serialized HTTP channel, which cancels the
    commands queued behind one that fails, so an `M114` transport failure can
    still end a hold through the `G1` it cancels (that `G1` is then rejected,
    and the hold closes through the restore path without an `M114` proof, like
    any other rejected `G1`).
  - `countCheck: enforced`: the hold stops when the Count position is more than
    one increment (plus 0.05 mm) from the expected executed position in either
    direction (a stall, a touchscreen speed override, a controller slower than
    its `M503` limits), when the `M114` reply takes longer than one tick
    (100 ms), or when the reply carries no `Count` fields. An off position or a
    missing Count turns continuous jogging off until re-arm; a late reply counts
    as a late event like a late `G1` (three in a row turn it off). Flip it with `LUBAN_PENDANT_COUNT_CHECK=enforced` (read on arm)
    once hardware has shown that Count keeps up and that `M114` answers promptly
    during motion. Until then it stays in observe mode on purpose: an unproven
    gate would only stop good holds.
- **Trace.** `/pendant/status` shows `pipeline.countCheck` (mode, steps/mm and
  their source, the pacing constants, the last sample and `lastLagMm`),
  `pipeline.lastHold` (stop reason, increments, distance, commanded time,
  maximum outstanding, Count samples, maximum lag, late replies, whether the
  close restored and proved the position), `pipeline.lateEvents` (the current
  late-reply streak) and `pipeline.holdOffUntilNeutral`. `/pendant/hold-trace` returns the
  per-tick records of the current or last hold: each send (target, feed, reply
  time, outstanding after it, Feather report age), each wait, each Count sample
  and the stop. With `LUBAN_PENDANT_TRACE=1` the same records go to the log as
  `[hold] …` lines. The first hardware trial reads these to answer "does Count
  keep up".

**Arming checks the controller.** Luban reads `M503 S` and keeps continuous
jogging off (`pipeline.disabled` in `/pendant/status`) unless all of these are
reported and fit the model:

- `M203` X/Y max feed is at least 50 mm/s (measured on the A350: 100 mm/s).
- `M201` X/Y max acceleration is at least 500 mm/s² (measured: 1000).
- `M204` P/T acceleration is at least 500 mm/s².

The model charges each increment its commanded time only; the limits keep the
per-increment error bounded (at 1000 mm/s² a 100 ms increment at 3000 mm/min
spends up to 50 ms accelerating) and the Count check measures whatever remains.

The Snapmaker build's `M220` reports nothing, so the feed override cannot be
read. Each hold therefore sends `M220 S100`. **That setting persists after
jogging.** Any reduced touchscreen speed percentage is overridden for later file
jobs too, so set it again before a job that relies on it. The page shows this
warning whenever continuous jogging is active, `/pendant/status` reports the
last accepted override as `pipeline.feedOverride` (armed or not), and an MCP
tool's `failure_recovery` evidence carries it as `feed_override`.

**The hold's guards:**

- **Exclusive lease** (`machine/gcodeLease.ts`). It is held from before the G53
  until the closing G54, and it does not lapse while the hold may have G53
  selected. While it is held every HTTP request times out after 10 s instead of
  the channel's 300 s, so a hung request fails the hold (which raises the latch
  and admits Restore work frame) instead of blocking recovery; `finally`
  releases the lease. The hold's own `M114` polls pass because they run as the
  holder.
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
  - **If the restore fails:** the lease hands over to the recovery hold. The hold
    IS the frame-uncertainty latch (below), read directly, so it cannot outlive
    it: `holdForRecovery` re-raises the latch if a verified beat had cleared it
    just before the failed restore. It accepts
    only `G90`/`G54`, `M5`, `M114`, `M400`, `M503`, job stop/pause, and Luban's
    own UI Home button as the whole `G53`/`G28`/`G54` sequence (it sends its
    three requests inside `runAsHomeSequence`, and its accepted `G54` marks the
    frame restored; a bare `G53` or `G28` is refused). The ways out are
    **Restore work frame** (this page or MCP `restore_work_frame`) and that UI
    Home button. This page's **Home** and the MCP `home` tool are refused while
    the frame is uncertain: both check the position first, and a re-home is not
    the remedy for a frame problem.
- **Frame-uncertainty latch.** It is set before the G53 is sent and persisted
  across Luban restarts (`mcp-frame-latch.json`, written whole; a file that
  exists but cannot be read raises the latch). On startup it returns, and with
  it the recovery hold. It is the same latch the MCP failed-call cleanup raises
  for a tool, runner or file job that may have left `G53`, so the two recoveries
  are one design: one record, one refusal, one clearing path. The failed-call
  hook never sends into a held lease, so it never sends into a hold.
  - **Every exit path restores G54:** the close after any stop; the close after
    a lost `G53` reply or a rejected `G1` (then without an `M114` proof, since
    the commanded position is uncertain: the next verified beat clears it); an
    awaited `shutdown()`.
  - **Clearing:** the latch clears only after an acknowledged restore AND a
    verified work-frame position. Until then pendant arming and all MCP motion
    are refused, and no new hold can start (the lease refuses while the latch
    stands). It appears in `get_position` warnings and in diagnostics. The crash
    guard held after a failed restore is released when the latch clears, whoever
    restored (this page, MCP `restore_work_frame`, the failed-call cleanup or a
    home) and whether or not the USB pendant is still open.
- **Heartbeats in a hold.** While the hold is declared (from its G53 reply to its
  G54), the tracker judges heartbeats as machine coordinates and sets ambiguous
  ones aside. Nothing in the hold reads them for position; the A350's heartbeat
  carries the planner's queued target, not the stepper position.
- **If the controller reports anything but idle during queued motion, the hold
  ends and the pendant disarms.** The page and TFT say so, and you must re-arm. If
  it happens on every jog, this controller reports busy during queued moves:
  restart Luban without `LUBAN_PENDANT_PIPELINE`.

**Stop latency (continuous X/Y).** STOP, a released deadman and a centred stick
are seen on the next 20 Hz USB frame and acted on within one 100 ms tick. What
is already queued is at most 200 ms of commanded motion by the clock model;
with the acceleration ramps and the one-way transport delay above, about 310 ms
of real motion in the worst case. Worst case from the event to standstill,
until trial data replaces these estimates:

| Event | At 300 mm/min | At 3000 mm/min |
|---|---|---|
| STOP, deadman release or neutral | about 0.4 s, 2 mm or less | about 0.4 s, 18 mm or less |
| USB silent (Feather gap, 150 ms, plus one tick) | about 0.6 s, 3 mm or less | about 0.6 s, 28 mm or less |
| Browser keepalive lost (disarms at 900 ms, plus one tick) | about 1.3 s, 7 mm or less | about 1.3 s, 66 mm or less |

This holds only while the controller executes at the commanded feed. A stalled
controller or a touchscreen speed override lets the controller's own planner
queue hold more than the model knows; in observe mode nothing stops that except
the controller holding `G1` requests once its planner is full (a reply slower
than 200 ms stops the hold), and the Count trace shows it. The `enforced` Count
check is what closes that gap once it is proven. The settled path's bound is one
in-flight segment of up to the approved duration. Z jogs stay settled: at the
Z-mode limit of 1000 mm/min that is at most 8.3 mm (0.5 s) or 16.7 mm (1 s).

**Smoothness caveat.** With 200 ms queued ahead the planner has at most one
block beyond the executing one. Marlin cannot replan a block it has started,
so at high feed each block may still be planned to end at a stop (at 3000 mm/min
the controller needs 50 ms to decelerate). If the first trial shows a ripple at
high feed but none at 300 mm/min, that is this, and `HOLD_QUEUE_AHEAD_MS` (with
its run-out) is the constant to revisit, not the tick.

**Already answered by the earlier trial (the #230 build, 2026-10-05):** G53
does not wait for motion (`M220 S100` / `G90` / `G53` took 160–345 ms for the
three requests and the G1s started straight after); G1 replies arrive once
queued (38–69 ms for ~175 ms moves); `M503 S` over HTTP parses (M203 X/Y
100 mm/s, M201 X/Y 1000); `M220 S100` is accepted; idle is reported during
queued motion (probably: several queued runs, no non-idle disarm); Count has
the constant at-rest offset above.

**Still needs hardware verification (the first trial answers these):**

- Is **Count live during motion** (every earlier sample was at rest): `lagMm`
  stays within one increment while the controller runs at the commanded feed,
  and `rawMm − derived` stays at the offset learned at arm (X +19, Y +4, Z +0
  on the trial machine) throughout a hold.
- Does `M114` answer promptly during motion (reply time under one tick), or does
  it synchronize the planner (then every poll would stall the queue).
- Actual run-out after release at F300, F1000 and F3000 against the ~310 ms
  (15.5 mm at F3000) estimated above.
- Feather gap detection: a 150 ms gap stops the hold without disarming, and the
  same press resumes with a new hold once reports return (within the 900 ms
  watchdog).
- Smoothness at F3000 with two blocks queued (see the caveat above).
- The close: `G54` acknowledged after the queued motion drains, and the `M114`
  proof clears the latch so the next press starts at once.

Marlin has `M410` (quickstop), but Luban does not use it: the Snapmaker build
lacks the emergency parser, and its behaviour over this channel is unverified.
Commission continuous jogging with small envelopes and the physical emergency
stop in reach. Compare `pipeline.lastHold`, `/pendant/hold-trace` and `lastJog`
in `/pendant/status` with what the machine did.

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
