"""Feather ESP32-S3 Reverse TFT: USB joystick intent and measured DRO."""
import time
import os
import json
import board
import analogio
import digitalio
import displayio
import terminalio
import usb_cdc
from adafruit_display_text import label
from controller import Controller, DroDisplay, LinkWatchdog, alert_lines, normalize, deadzone

# Sent in every frame; Luban logs it on connect so a stale code.py/controller.py pair is visible.
FIRMWARE = "pendant-2026-10-06a"

if usb_cdc.data is None:
    print("Pendant maintenance console. Release D0 and reset to run USB data.")
    print("If PENDANT_CONSOLE=1 is set in settings.toml, remove it first.")
    raise SystemExit

def input_pin(pin, pull):
    button = digitalio.DigitalInOut(pin)
    button.switch_to_input(pull=pull)
    return button


axes = [analogio.AnalogIn(board.D6), analogio.AnalogIn(board.D5), analogio.AnalogIn(board.D9)]
centers = [int(os.getenv("JOYSTICK_" + a + "_CENTER", "32768")) for a in ("X", "Y", "TWIST")]
minimums = [int(os.getenv("JOYSTICK_" + a + "_MIN", "0")) for a in ("X", "Y", "TWIST")]
maximums = [int(os.getenv("JOYSTICK_" + a + "_MAX", "65535")) for a in ("X", "Y", "TWIST")]
inverted = [os.getenv("JOYSTICK_" + a + "_INVERT", "1" if a == "X" else "0") == "1"
            for a in ("X", "Y", "TWIST")]
zone = float(os.getenv("JOYSTICK_DEADZONE", "0.12"))
if not 0.02 <= zone <= 0.4:
    raise ValueError("JOYSTICK_DEADZONE must be 0.02..0.4")
mode_button = input_pin(board.D10, digitalio.Pull.DOWN)
deadman = input_pin(board.D1, digitalio.Pull.DOWN)
stop_button = input_pin(board.D2, digitalio.Pull.DOWN)
frame_button = input_pin(board.D0, digitalio.Pull.UP)
display = board.DISPLAY
display.brightness = 0.8
group = displayio.Group()
background = displayio.Bitmap(display.width, display.height, 1)
background_palette = displayio.Palette(1)
background_palette[0] = 0x000000
group.append(displayio.TileGrid(background, pixel_shader=background_palette))
header = label.Label(terminalio.FONT, text="MACHINE F300 LIVE", color=0x55DDFF, x=2, y=8)
group.append(header)
dro_labels = []
for axis, y in zip("XYZ", (29, 56, 83)):
    # Full-width values use the screen instead of reserving a feed column.
    area = label.Label(terminalio.FONT, text=axis + " ---.---", scale=3, color=0xFFFFFF, x=2, y=y)
    dro_labels.append(area)
    group.append(area)
status = label.Label(terminalio.FONT, text="READY D1 / STOP D2", scale=2, color=0xFFFFFF, x=2, y=116)
group.append(status)
alert_title = label.Label(terminalio.FONT, text="", scale=3, color=0xFFFFFF, x=2, y=52)
alert_detail = label.Label(terminalio.FONT, text="", scale=2, color=0xFFBB44, x=2, y=91)
group.append(alert_title)
group.append(alert_detail)
display.root_group = group
serial = usb_cdc.data
if serial is None:
    raise RuntimeError("Copy boot.py then press RESET to enable USB data")
serial.timeout = 0
serial.write_timeout = 0
controller = Controller()
link_watchdog = LinkWatchdog()
dro_display = DroDisplay()
rx = b""
dro = None
last_dro = -100
last_send = 0
last_display = 0
last_time = time.monotonic()
seq = 0
frame = "machine"
frame_was_pressed = False
was_linked = False
event = None  # One rare event per frame; Luban logs it only with LUBAN_PENDANT_TRACE=1.
print("Luban USB joystick v1. Hold D1 to jog, D2 to stop; D0 switches DRO frame.")

while True:
    now = time.monotonic()
    dt = now - last_time
    last_time = now
    if serial.in_waiting:
        rx += serial.read(min(serial.in_waiting, 4096)) or b""
        if len(rx) > 4096:
            rx = b""
            event = "rx overflow"
        while b"\n" in rx:
            line, rx = rx.split(b"\n", 1)
            try:
                message = json.loads(line.decode("utf-8"))
                if message.get("v") == 1 and message.get("type") == "dro":
                    dro = message
                    last_dro = now
                    link_watchdog.acknowledge(message.get("input_seq"), message.get("input_age_ms"), now)
                    dro_display.receive(message, now)
            except (ValueError, UnicodeError):
                event = "bad host line %d bytes" % len(line)
    fresh = link_watchdog.healthy(now, serial.connected, last_dro)
    linked = fresh and dro is not None and dro.get("armed") is True
    if linked != was_linked:
        controller.neutral_required = True
        event = "linked" if linked else "unlinked"
    was_linked = linked
    raw = [axis.value for axis in axes]
    values = [deadzone(normalize(value, centers[i], minimums[i], maximums[i], inverted[i]), zone)
              for i, value in enumerate(raw)]
    packet = controller.update(values[0], values[1], values[2], mode_button.value,
                               deadman.value, stop_button.value, now, dt, fresh, armed=linked)
    if serial.connected and now - last_send >= 0.05:
        packet.update({"v": 1, "seq": seq, "raw": raw, "dro_frame": frame,
                       "feedback_ok": bool(fresh), "round_trip_ms": link_watchdog.round_trip_ms,
                       "display": [display.width, display.height], "fw": FIRMWARE})
        if event:
            packet["log"] = event[:120]
        # Nonblocking: partial frames force a newline and neutral re-arm, never a backlog.
        payload = (json.dumps(packet) + "\n").encode("utf-8")
        try:
            written = serial.write(payload)
            if written == len(payload):
                link_watchdog.sent(seq, now)
                event = None
            if written != len(payload):
                serial.write(b"\n")
                controller.neutral_required = True
                event = "short write %s/%d" % (written, len(payload))
        except OSError as err:
            controller.neutral_required = True
            event = "write error %s" % err
        seq += 1
        last_send = now
    pressed = not frame_button.value
    if pressed and not frame_was_pressed:
        frame = "work" if frame == "machine" else "machine"
    frame_was_pressed = pressed
    if now - last_display >= 0.15:
        z_mode = controller.mode == "z"
        background_palette[0] = 0x660011 if z_mode else 0x000000
        header.color = 0xFFFFFF if z_mode else 0x55DDFF
        header.text = "%s F%d %s" % ("! Z MODE" if z_mode else ("MACHINE" if frame == "machine" else "WORK"),
                                      int(controller.feed), "LIVE" if fresh else "LOST")
        dro_state = dro_display.state(frame, now, fresh)
        valid = dro_state == "live"
        position = dro_display.positions.get(frame)
        stick_active = packet["deadman"] and (packet["x"] or packet["y"] or packet["z"])
        title, detail = alert_lines(dro if fresh else None, fresh, linked, dro_state, deadman.value, stick_active)
        if title:
            # Error states replace the DRO instead of competing with it for a tiny footer.
            for area in dro_labels:
                area.text = ""
            alert_title.text = title
            alert_detail.text = detail
            alert_title.color = 0xFFFFFF if title.startswith("!") or title in ("BLOCKED", "INSIDE") else 0xFFBB44
            alert_detail.color = 0xFFFFFF if title == "RELEASE D1" else 0xFFBB44
            status.text = ""
        else:
            alert_title.text = ""
            alert_detail.text = ""
            for axis, area in zip("xyz", dro_labels):
                value = position.get(axis) if position else None
                area.text = axis.upper() + (" %.3f" % value if value is not None else " ---.---")
                area.color = 0xFFFFFF if valid else 0xFFBB44
            status.text = "JOGGING" if packet["deadman"] else "READY D1 / STOP D2"
        last_display = now
    time.sleep(0.01)
