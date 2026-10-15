"""Hardware-independent joystick state, usable on CircuitPython and CPython."""
import math

SLOW_FEED = 60
MAX_FEED = 600


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
        self.feed = SLOW_FEED
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
                self.feed = SLOW_FEED
                self.neutral_required = True
        if stop or not link:
            self.feed = SLOW_FEED
            self.neutral_required = True
        if x == 0 and y == 0 and twist == 0 and not held and not stop:
            self.neutral_required = False
        ready = not self.neutral_required
        if ready and self.mode == "feed" and link:
            self.feed = max(SLOW_FEED, min(MAX_FEED, self.feed + twist * 300 * min(dt, 0.1)))
        moving = ready and held and link and armed and not stop
        return {"x": x if moving else 0.0, "y": y if moving else 0.0,
                "z": twist if moving and self.mode == "z" else 0.0,
                "feed": int(self.feed), "mode": self.mode, "ready": ready,
                "deadman": moving, "stop": bool(stop)}
