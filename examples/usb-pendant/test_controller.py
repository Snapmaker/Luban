"""Run with python examples/usb-pendant/test_controller.py; no hardware motion."""
import sys
import pathlib
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent / "firmware"))
from controller import (BLOCKED_COLOR, HELP_COLOR, HELP_TEXT, LIMITED_COLOR, Controller, DroDisplay,
                        LinkWatchdog, blocked_text, bottom_row, normalize, deadzone)


class ControllerTests(unittest.TestCase):
    def test_feedback_round_trip_watchdog_rejects_old_duplicate_and_delayed_acknowledgements(self):
        link = LinkWatchdog()
        self.assertFalse(link.healthy(1, True, 1))
        link.sent(1, 1.0)
        link.acknowledge(1, 10, 1.05)
        self.assertTrue(link.healthy(1.05, True, 1.05))
        self.assertLessEqual(link.round_trip_ms, 51)
        link.acknowledge(1, 0, 1.8)
        self.assertFalse(link.healthy(1.95, True, 1.95))
        link.sent(2, 2.0)
        link.acknowledge(2, 950, 2.05)
        self.assertFalse(link.healthy(2.05, True, 2.05))
        link.acknowledge(2, 0, 3.1)
        self.assertFalse(link.healthy(3.1, True, 3.1))
        link.sent(3, 4.0)
        link.acknowledge(3, 0, 4.05)
        self.assertTrue(link.healthy(4.05, True, 4.05))
        self.assertFalse(link.healthy(4.05, False, 4.05))
        self.assertFalse(link.healthy(4.05, True, 3.0))


    def test_dro_retains_trusted_values_during_moves_and_marks_actual_staleness(self):
        display = DroDisplay()
        packet = {"machine": {"x": -19, "y": 342, "z": 328},
                  "work": {"x": -188.5, "y": 212.2, "z": 116},
                  "reliability": "verified", "age_ms": 0, "warnings": []}
        display.receive(packet, 1)
        self.assertEqual(display.state("machine", 1, True), "live")
        display.receive(dict(packet, moving=True, machine={"x": 999, "y": 999, "z": 999}), 1.1)
        self.assertEqual(display.positions["machine"]["x"], -19)
        self.assertEqual(display.state("machine", 1.1, True), "updating")
        display.receive(dict(packet, warnings=["G53 transition"], reliability="awaiting-resync"), 1.2)
        self.assertEqual(display.positions["work"]["x"], -188.5)
        self.assertEqual(display.state("work", 1.2, True), "updating")
        display.receive(dict(packet, machine={"x": -14, "y": 342, "z": 328}), 1.5)
        self.assertEqual(display.positions["machine"]["x"], -14)
        self.assertEqual(display.state("machine", 1.5, True), "live")
        self.assertEqual(display.state("machine", 1.6, False), "stale")
        self.assertEqual(display.positions["machine"]["x"], -14)
        self.assertEqual(display.state("machine", 12, True), "stale")

    def test_bottom_row_names_blocking_obstacle_and_height_while_linked(self):
        blocked = {"name": "rotary-axis", "requiredZ": 328, "requestedZ": 327.911, "held": True,
                   "text": "BLOCKED rotary-axis: Z>=328 (asked 327.9)"}
        dro = {"armed": True, "blocked": blocked, "message": blocked["text"]}
        self.assertEqual(blocked_text(blocked), "BLOCKED rotary-axis: Z>=328 (asked 327.91)")
        # Never understated: required rounds up, asked rounds down.
        self.assertEqual(blocked_text(dict(blocked, requestedZ=327.96)), "BLOCKED rotary-axis: Z>=328 (asked 327.96)")
        self.assertEqual(blocked_text(dict(blocked, requestedZ=327.999)), "BLOCKED rotary-axis: Z>=328 (asked 327.99)")
        self.assertEqual(blocked_text(dict(blocked, requiredZ=327.951)), "BLOCKED rotary-axis: Z>=327.96 (asked 327.91)")
        text, color = bottom_row(dro, True, True, True, 0)
        self.assertEqual(text, "BLOCKED rotary-axis: Z>=328 (asked 327.91)"[:38])
        self.assertEqual(color, BLOCKED_COLOR)
        self.assertNotEqual(color, HELP_COLOR)
        scrolled, _ = bottom_row(dro, True, True, True, 1)
        self.assertEqual(len(scrolled), 38)
        self.assertNotEqual(scrolled, text)
        # Neutral stick, stale feedback or a cleared field return to the help text at once.
        self.assertEqual(bottom_row(dro, True, True, False, 0), (HELP_TEXT, HELP_COLOR))
        self.assertEqual(bottom_row(dro, False, True, True, 0), (HELP_TEXT, HELP_COLOR))
        self.assertEqual(bottom_row(dict(dro, blocked=None), True, True, True, 0), (HELP_TEXT, HELP_COLOR))
        limited = dict(blocked, held=False, requiredZ=327.25, requestedZ=300)
        self.assertEqual(blocked_text(limited), "LIMITED rotary-axis: Z>=327.25 (asked 300)")
        self.assertEqual(bottom_row({"blocked": limited}, True, True, True, 0)[1], LIMITED_COLOR)
        self.assertEqual(blocked_text({"name": "clamp", "requiredZ": None, "requestedZ": 10, "held": True}),
                         "BLOCKED clamp: no entry, tool unknown")
        inside = {"name": "rotary-axis", "requiredZ": 328, "requestedZ": 300, "held": True, "inside": True}
        self.assertEqual(blocked_text(inside), "INSIDE rotary-axis below Z328: Z-up only")
        self.assertEqual(blocked_text(dict(inside, requiredZ=327.951)), "INSIDE rotary-axis below Z327.96: Z-up only")
        # INSIDE shows even with the stick neutral, and scrolls past 38 characters.
        text, color = bottom_row({"blocked": inside}, True, True, False, 0)
        self.assertEqual((text, color), ("INSIDE rotary-axis below Z328: Z-up only"[:38], BLOCKED_COLOR))
        self.assertEqual(blocked_text(dict(inside, requiredZ=None)), "INSIDE rotary-axis (tool unknown): Z-up only")
        # Disarmed: Luban's reason still scrolls, and a short one is not repeated.
        self.assertEqual(bottom_row({"message": "Disarmed by operator."}, True, False, False, 3),
                         ("Disarmed by operator.", HELP_COLOR))

    def test_disarmed_feed_adjustment_never_emits_motion(self):
        c = Controller()
        c.update(0, 0, 0, False, False, False, 0, 0.05, True, armed=False)
        p = c.update(1, 1, 1, False, True, False, 1, 0.1, True, armed=False)
        self.assertGreater(p["feed"], 300)
        self.assertFalse(p["deadman"])
        self.assertEqual((p["x"], p["y"], p["z"]), (0, 0, 0))
        adjusted = p["feed"]
        p = c.update(0, 0, 1, False, False, False, 2, 0.1, False, armed=False)
        self.assertEqual(p["feed"], adjusted, "USB loss keeps the feed")
        p = c.update(0, 0, 1, False, False, True, 3, 0.1, True, armed=False)
        self.assertEqual(p["feed"], adjusted, "STOP keeps the feed")

    def test_calibration_deadzone_and_inversion(self):
        self.assertEqual(deadzone(0.05), 0)
        self.assertEqual(normalize(0), -1)
        self.assertEqual(normalize(65535), 1)
        self.assertEqual(normalize(0, inverted=True), 1)
        self.assertEqual(normalize(20000, center=20000), 0)
        with self.assertRaises(ValueError):
            normalize(30000, center=0, minimum=0, maximum=0)

    def test_boot_and_disconnect_need_neutral_with_deadman_released(self):
        c = Controller()
        args = (1, 0, 0, False, True, False, 1, 0.05, True)
        self.assertFalse(c.update(*args)["deadman"])
        c.update(0, 0, 0, False, False, False, 2, 0.05, True)
        self.assertTrue(c.update(*args)["deadman"])
        self.assertFalse(c.update(1, 0, 0, False, True, False, 3, 0.05, False)["deadman"])
        self.assertFalse(c.update(*args)["deadman"])

    def test_button_debounce_mode_switch_keeps_low_feed_and_blocks_held_twist(self):
        c = Controller()
        c.update(0, 0, 0, False, False, False, 0, 0.05, True)
        c.update(0, 0, 1, False, False, False, 1, 0.1, True)
        self.assertGreater(c.feed, 300)
        c.update(0, 0, 1, True, True, False, 2, 0.05, True)
        self.assertEqual(c.mode, "feed")
        kept = c.feed
        p = c.update(0, 0, 1, True, True, False, 2.04, 0.04, True)
        self.assertEqual(c.mode, "z")
        self.assertEqual(c.feed, kept, "a feed under 1000 is kept on entering Z mode")
        self.assertEqual(p["z"], 0)
        c.update(0, 0, 0, False, False, False, 3, 0.05, True)
        c.update(0, 0, 0, False, False, False, 3.04, 0.04, True)
        self.assertEqual(c.update(0, 0, -1, False, True, False, 4, 0.05, True)["z"], -1)
        c.update(0, 0, 0, True, False, False, 5, 0.05, True)
        c.update(0, 0, 0, True, False, False, 5.04, 0.04, True)
        self.assertEqual(c.mode, "feed")
        self.assertEqual(c.feed, kept)

    def test_boot_feed_minimum_and_z_mode_cap(self):
        c = Controller()
        self.assertEqual(c.update(0, 0, 0, False, False, False, 0, 0.05, True)["feed"], 300)
        for i in range(100):
            c.update(0, 0, -1, False, False, False, i + 1, 0.1, True)
        self.assertEqual(c.feed, 60)
        for i in range(200):
            c.update(0, 0, 1, False, False, False, 200 + i, 0.1, True)
        self.assertEqual(c.feed, 3000)
        c.update(0, 0, 0, True, False, False, 500, 0.05, True)
        p = c.update(0, 0, 0, True, False, False, 500.04, 0.04, True)
        self.assertEqual((p["mode"], p["feed"]), ("z", 1000))
        c.update(0, 0, 0, False, False, False, 501, 0.05, True)
        for i in range(20):
            p = c.update(0, 0, 1, False, False, False, 502 + i, 0.1, True)
        self.assertEqual(p["feed"], 1000, "twist in Z mode never raises feed")
        c.update(0, 0, 0, True, False, False, 600, 0.05, True)
        p = c.update(0, 0, 0, True, False, False, 600.04, 0.04, True)
        self.assertEqual((p["mode"], p["feed"]), ("feed", 1000))

    def test_feed_caps_and_stop_never_moves(self):
        c = Controller()
        c.update(0, 0, 0, False, False, False, 0, 0.01, True)
        for i in range(100):
            c.update(0, 0, 1, False, True, False, i + 1, 0.1, True)
        self.assertEqual(c.feed, 3000)
        p = c.update(1, 1, 1, False, True, True, 60, 0.1, True)
        self.assertEqual(p["feed"], 3000)
        self.assertFalse(p["deadman"])
        self.assertEqual((p["x"], p["y"], p["z"]), (0, 0, 0))


if __name__ == "__main__":
    unittest.main()
