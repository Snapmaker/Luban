"""USB data plus disk normally; hold D0 at reset for a maintenance console."""
import board
import digitalio
import os
import usb_cdc
import usb_hid
import usb_midi

# ESP32-S3 has five IN endpoints including EP0: MSC plus two CDCs needs six.
usb_hid.disable()
usb_midi.disable()
button = digitalio.DigitalInOut(board.D0)
button.switch_to_input(pull=digitalio.Pull.UP)
maintenance = not button.value or os.getenv("PENDANT_CONSOLE", "0") == "1"
button.deinit()
usb_cdc.enable(console=maintenance, data=not maintenance)
