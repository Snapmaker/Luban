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
from controller import Controller, DroDisplay, LinkWatchdog, normalize, deadzone

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
header = label.Label(terminalio.FONT, text="TWIST FEED   MACHINE", color=0x55DDFF, x=4, y=9)
group.append(header)
dro_labels = []
for axis, y in zip("XYZ", (33, 60, 87)):
    area = label.Label(terminalio.FONT, text=axis + "  ---.---", scale=2, color=0xFFFFFF, x=4, y=y)
    dro_labels.append(area)
    group.append(area)
feed_title = label.Label(terminalio.FONT, text="FEED", color=0x55DDFF, x=171, y=33)
feed_value = label.Label(terminalio.FONT, text="300", scale=3, color=0xFFFFFF, x=171, y=63)
feed_units = label.Label(terminalio.FONT, text="mm/min", color=0xAAAAAA, x=171, y=87)
group.append(feed_title)
group.append(feed_value)
group.append(feed_units)
status = label.Label(terminalio.FONT, text="USB: waiting for Luban", color=0xFFBB44, x=4, y=113)
help_text = label.Label(terminalio.FONT, text="D1 hold jog | D2 stop", color=0xAAAAAA, x=4, y=128)
group.append(status)
group.append(help_text)
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
print("Luban USB joystick v1. Hold D1 to jog, D2 to stop; D0 switches DRO frame.")

while True:
    now = time.monotonic()
    dt = now - last_time
    last_time = now
    if serial.in_waiting:
        rx += serial.read(min(serial.in_waiting, 4096)) or b""
        if len(rx) > 4096:
            rx = b""
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
                pass
    fresh = link_watchdog.healthy(now, serial.connected, last_dro)
    linked = fresh and dro is not None and dro.get("armed") is True
    if linked != was_linked:
        controller.feed = 300
        controller.neutral_required = True
    was_linked = linked
    raw = [axis.value for axis in axes]
    values = [deadzone(normalize(value, centers[i], minimums[i], maximums[i], inverted[i]), zone)
              for i, value in enumerate(raw)]
    packet = controller.update(values[0], values[1], values[2], mode_button.value,
                               deadman.value, stop_button.value, now, dt, fresh, armed=linked)
    if serial.connected and now - last_send >= 0.05:
        packet.update({"v": 1, "seq": seq, "raw": raw, "dro_frame": frame,
                       "feedback_ok": bool(fresh), "round_trip_ms": link_watchdog.round_trip_ms,
                       "display": [display.width, display.height]})
        # Nonblocking: partial frames force a newline and neutral re-arm, never a backlog.
        payload = (json.dumps(packet) + "\n").encode("utf-8")
        try:
            written = serial.write(payload)
            if written == len(payload):
                link_watchdog.sent(seq, now)
            if written != len(payload):
                serial.write(b"\n")
                controller.neutral_required = True
        except OSError:
            controller.neutral_required = True
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
        header.text = "%s %s" % ("DANGER: TWIST Z" if z_mode else "TWIST:FEED", "MACHINE" if frame == "machine" else "WORK")
        feed_value.text = str(int(controller.feed))
        dro_state = dro_display.state(frame, now, fresh)
        valid = dro_state == "live"
        position = dro_display.positions.get(frame)
        for axis, area in zip("xyz", dro_labels):
            value = position.get(axis) if position else None
            area.text = axis.upper() + (" %8.3f" % value if value is not None else "  ---.---")
            area.color = 0xFFFFFF if valid else 0xFFBB44
        if not fresh:
            status.text = "USB stale: held DRO" if position else "USB: waiting for Luban"
        elif dro_state == "updating":
            status.text = "JOGGING: updating DRO" if linked else "DRO updating: held values"
        elif dro_state != "live":
            status.text = "DRO stale: held values" if position else "DRO unavailable"
        elif not linked:
            if controller.neutral_required:
                status.text = "DISARMED: centre axes"
            else:
                status.text = "DISARMED: Z needs arm" if controller.mode == "z" else "DISARMED: twist sets feed"
        elif controller.neutral_required:
            status.text = "Centre axes; release D1"
        else:
            status.text = "JOGGING" if packet["deadman"] else "READY: hold D1 to jog"
        reason = dro.get("message") if fresh and dro else None
        if not linked and reason:
            # Scroll the host's refusal/stop reason across the 38-character bottom row.
            text = str(reason)
            offset = int(now * 4) % (len(text) + 4) if len(text) > 38 else 0
            help_text.text = (text + "    " + text)[offset:offset + 38]
        else:
            help_text.text = "D1 hold jog | D2 stop"
        last_display = now
    time.sleep(0.01)
