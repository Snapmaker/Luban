"""Hardware-independent joystick state, usable on CircuitPython and CPython."""
import math
import re

# Feed (mm/min) starts at DEFAULT_FEED on boot and is otherwise only changed by twist in
# feed mode. Entering Z mode caps it at Z_MAX_FEED; nothing else resets it.
DEFAULT_FEED = 300
MIN_FEED = 60
MAX_FEED = 3000
Z_MAX_FEED = 1000
HELP_TEXT = "D1 hold jog | D2 stop"
HELP_COLOR = 0xAAAAAA
BLOCKED_COLOR = 0xFF4433  # Held: Luban sent nothing for this stick position.
LIMITED_COLOR = 0xFFBB44  # Only the part of the stick motion clear of the obstacle was sent.
ROW_CHARS = 38


def _trim(text):
    return text.rstrip("0").rstrip(".") if "." in text else text


def _z_up(value):
    """Required Z, rounded up to 0.01 so the display never understates it."""
    return _trim("%.2f" % (math.ceil(value * 100 - 1e-6) / 100))


def _z_down(value):
    """Requested Z, rounded down to 0.01."""
    return _trim("%.2f" % (math.floor(value * 100 + 1e-6) / 100))


def scroll_row(text, now, width=ROW_CHARS):
    if len(text) <= width:
        return text
    offset = int(now * 4) % (len(text) + 4)
    return (text + "    " + text)[offset:offset + width]


def blocked_text(blocked):
    """'BLOCKED rotary-axis: Z>=328 (asked 327.91)' from Luban's DRO `blocked` field."""
    name = str(blocked.get("name") or "obstacle")
    if blocked.get("inside"):
        required = blocked.get("requiredZ")
        if isinstance(required, (int, float)):
            return "INSIDE %s below Z%s: Z-up only" % (name, _z_up(required))
        return "INSIDE %s (tool unknown): Z-up only" % name
    word = "BLOCKED" if blocked.get("held", True) else "LIMITED"
    required = blocked.get("requiredZ")
    asked = blocked.get("requestedZ")
    if required is None:
        return "%s %s: no entry, tool unknown" % (word, name)
    if not isinstance(required, (int, float)):
        return str(blocked.get("text") or word)
    text = "%s %s: Z>=%s" % (word, name, _z_up(required))
    if isinstance(asked, (int, float)):
        text += " (asked %s)" % _z_down(asked)
    return text


def bottom_row(dro, fresh, linked, stick_active, now):
    """Bottom TFT row (text, colour). An obstacle hold shows while linked and the stick is
    deflected; it clears as soon as the stick is neutral or Luban accepts a full segment.
    INSIDE (the toolhead is already inside an exclusion; Z-up only) shows whenever linked."""
    blocked = dro.get("blocked") if fresh and dro else None
    if linked and isinstance(blocked, dict) and (stick_active or blocked.get("inside")):
        color = BLOCKED_COLOR if blocked.get("held", True) else LIMITED_COLOR
        return scroll_row(blocked_text(blocked), now), color
    reason = dro.get("message") if fresh and dro else None
    if not linked and reason:
        # Scroll the host's refusal/stop reason across the 38-character bottom row.
        return scroll_row(str(reason), now), HELP_COLOR
    return HELP_TEXT, HELP_COLOR


def _short_z(value):
    if not isinstance(value, (int, float)):
        return "?"
    return ("%.2f" % value).rstrip("0").rstrip(".")


def obstacle_lines(reason):
    """Compress a host refusal ("Jog blocked by NAME: requires machine Z at or above N mm")
    into two readable TFT lines."""
    text = str(reason or "")
    marker = "Jog blocked by "
    if marker not in text:
        return "BLOCKED", "REVIEW + RE-ARM"
    detail = text.split(marker, 1)[1]
    name = detail.split(":", 1)[0].strip().upper()[:12]
    z_match = re.search(r"machine Z at or above ([0-9.]+) mm", detail)
    if z_match:
        return "BLOCKED", (name + " Z>=" + _short_z(float(z_match.group(1))))[:19]
    return "BLOCKED", name or "REVIEW + RE-ARM"


def alert_lines(dro, fresh, linked, dro_state, d1_held, stick_active):
    """(title, detail) for the TFT's large alert, or ("", "") to show the DRO.
    Short and actionable; the full diagnostics stay on the web page."""
    if not fresh:
        return "! LINK LOST", "WAIT OR RECONNECT"
    dro = dro if isinstance(dro, dict) else {}
    blocked = dro.get("blocked")
    # The host's structured obstacle hold: while the stick pushes into it, or always when
    # the toolhead is already inside an exclusion (straight Z-up only).
    if linked and isinstance(blocked, dict) and (stick_active or blocked.get("inside")):
        name = str(blocked.get("name") or "OBSTACLE").upper()[:12]
        if blocked.get("inside"):
            title = "INSIDE"
        else:
            title = "BLOCKED" if blocked.get("held", True) else "LIMITED"
        need = blocked.get("requiredZ")
        return title, ((name + " Z>=" + _short_z(need)) if need is not None else name)[:19]
    reason = str(dro.get("message") or "")
    # After every hard stop the first question is whether the safety key is held.
    if not linked and d1_held:
        return "RELEASE D1", "THEN RE-ARM + PRESS"
    limit_axes = dro.get("limit_axes")
    if linked and stick_active and isinstance(limit_axes, list) and limit_axes:
        return ("LIMIT " + ",".join(str(a) for a in limit_axes))[:13], "PULL BACK TO MOVE"
    if "Jog blocked by " in reason:
        return obstacle_lines(reason)
    # "updating" (moving) keeps the held DRO on screen; only a stale or missing DRO blocks.
    if "position" in reason.lower() or dro_state in ("stale", "unavailable"):
        return "WAIT FOR DRO", "MOTION BLOCKED"
    if "travel" in reason.lower() or "bounds" in reason.lower():
        return "! TRAVEL", "REVIEW BOUNDS + RE-ARM"
    if not linked:
        return "DISARMED", "ARM THEN PRESS D1"
    return "", ""


class LinkWatchdog:
    """Use echoed sequence numbers to detect delayed/replayed host feedback."""
    def __init__(self):
        self.sent_frames = []
        self.ack_sequence = -1
        self.ack_sent_at = -100
        self.round_trip_ms = None

    def sent(self, sequence, now):
        self.sent_frames.append((sequence, now))
        self.sent_frames = self.sent_frames[-32:]

    def acknowledge(self, sequence, input_age_ms, now):
        if not isinstance(sequence, int) or sequence <= self.ack_sequence:
            return
        if not isinstance(input_age_ms, (int, float)) or not 0 <= input_age_ms < 900:
            return
        for sent_sequence, sent_at in self.sent_frames:
            if sent_sequence == sequence:
                self.ack_sequence = sequence
                self.ack_sent_at = sent_at
                self.round_trip_ms = int(max(0, now - sent_at) * 1000)
                return

    def healthy(self, now, connected, last_received):
        # Leave 100 ms for the USB/input loops before the one-second ceiling.
        return connected and now - last_received < 0.9 and now - self.ack_sent_at < 0.9


class DroDisplay:
    """Display-only retention; never a position source for motion authority."""
    def __init__(self):
        self.positions = {}
        self.sampled_at = {}
        self.valid = False
        self.moving = False
        self.stale_after = 10.0

    def receive(self, packet, now):
        age = packet.get("position_age_ms", packet.get("age_ms"))
        self.stale_after = packet.get("stale_after_ms", 10000) / 1000
        self.moving = packet.get("moving") is True
        self.valid = (not self.moving and isinstance(age, (int, float))
                      and 0 <= age < self.stale_after * 1000
                      and packet.get("reliability") in ("verified", "heartbeat", "cached-offset")
                      and not packet.get("warnings"))
        if self.valid:
            for frame in ("machine", "work"):
                position = packet.get(frame)
                if isinstance(position, dict) and all(isinstance(position.get(a), (int, float))
                                                     and math.isfinite(position[a]) for a in "xyz"):
                    self.positions[frame] = dict(position)
                    self.sampled_at[frame] = now - age / 1000

    def state(self, frame, now, linked):
        if frame not in self.positions:
            return "unavailable"
        if not linked or now - self.sampled_at[frame] >= self.stale_after:
            return "stale"
        return "live" if self.valid else "updating"


def normalize(raw, center=32768, minimum=0, maximum=65535, inverted=False):
    span = maximum - center if raw >= center else center - minimum
    if span <= 0:
        raise ValueError("Invalid joystick calibration")
    value = max(-1.0, min(1.0, (raw - center) / span))
    return -value if inverted else value


def deadzone(value, zone=0.12):
    if abs(value) <= zone:
        return 0.0
    return (1 if value > 0 else -1) * (abs(value) - zone) / (1 - zone)


class Controller:
    def __init__(self):
        self.mode = "feed"
        self.feed = DEFAULT_FEED
        self.neutral_required = True
        self.button_raw = False
        self.button_stable = False
        self.button_changed = 0

    def update(self, x, y, twist, button, held, stop, now, dt, link, armed=True):
        if button != self.button_raw:
            self.button_raw = button
            self.button_changed = now
        if now - self.button_changed >= 0.03 and self.button_stable != button:
            self.button_stable = button
            if button:
                self.mode = "z" if self.mode == "feed" else "feed"
                self.neutral_required = True
        if stop or not link:
            self.neutral_required = True
        if x == 0 and y == 0 and twist == 0 and not held and not stop:
            self.neutral_required = False
        ready = not self.neutral_required
        if ready and self.mode == "feed" and link:
            self.feed = max(MIN_FEED, min(MAX_FEED, self.feed + twist * 300 * min(dt, 0.1)))
        if self.mode == "z":
            self.feed = min(self.feed, Z_MAX_FEED)
        moving = ready and held and link and armed and not stop
        return {"x": x if moving else 0.0, "y": y if moving else 0.0,
                "z": twist if moving and self.mode == "z" else 0.0,
                "feed": int(self.feed), "mode": self.mode, "ready": ready,
                "deadman": moving, "stop": bool(stop)}
