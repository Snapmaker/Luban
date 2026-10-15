"""Run with python examples/usb-pendant/test_controller.py; no hardware motion."""
import sys
import pathlib
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent / "firmware"))
from controller import Controller, DroDisplay, LinkWatchdog, normalize, deadzone


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

    def test_disarmed_feed_adjustment_never_emits_motion(self):
        c = Controller()
        c.update(0, 0, 0, False, False, False, 0, 0.05, True, armed=False)
        p = c.update(1, 1, 1, False, True, False, 1, 0.1, True, armed=False)
        self.assertGreater(p["feed"], 60)
        self.assertFalse(p["deadman"])
        self.assertEqual((p["x"], p["y"], p["z"]), (0, 0, 0))
        p = c.update(0, 0, 1, False, False, False, 2, 0.1, False, armed=False)
        self.assertEqual(p["feed"], 60)
        p = c.update(0, 0, 1, False, False, True, 3, 0.1, True, armed=False)
        self.assertEqual(p["feed"], 60)

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

    def test_button_debounce_mode_switch_resets_feed_and_blocks_held_twist(self):
        c = Controller()
        c.update(0, 0, 0, False, False, False, 0, 0.05, True)
        c.update(0, 0, 1, False, False, False, 1, 0.1, True)
        self.assertGreater(c.feed, 60)
        c.update(0, 0, 1, True, True, False, 2, 0.05, True)
        self.assertEqual(c.mode, "feed")
        p = c.update(0, 0, 1, True, True, False, 2.04, 0.04, True)
        self.assertEqual(c.mode, "z")
        self.assertEqual(c.feed, 60)
        self.assertEqual(p["z"], 0)
        c.update(0, 0, 0, False, False, False, 3, 0.05, True)
        c.update(0, 0, 0, False, False, False, 3.04, 0.04, True)
        self.assertEqual(c.update(0, 0, -1, False, True, False, 4, 0.05, True)["z"], -1)
        c.update(0, 0, 0, True, False, False, 5, 0.05, True)
        c.update(0, 0, 0, True, False, False, 5.04, 0.04, True)
        self.assertEqual(c.mode, "feed")
        self.assertEqual(c.feed, 60)

    def test_feed_caps_and_stop_never_moves(self):
        c = Controller()
        c.update(0, 0, 0, False, False, False, 0, 0.01, True)
        for i in range(50):
            c.update(0, 0, 1, False, True, False, i + 1, 0.1, True)
        self.assertEqual(c.feed, 600)
        p = c.update(1, 1, 1, False, True, True, 60, 0.1, True)
        self.assertEqual(p["feed"], 60)
        self.assertFalse(p["deadman"])
        self.assertEqual((p["x"], p["y"], p["z"]), (0, 0, 0))


if __name__ == "__main__":
    unittest.main()
