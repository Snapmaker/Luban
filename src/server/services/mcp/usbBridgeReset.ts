import { execFile } from 'child_process';

import logger from '../../lib/logger';

const log = logger('service:mcp:usb-reset');

// Recovering a USB sensor bridge whose HID interface was left claimed.
//
// Live 2026-09-19 (operator's diagnosis, confirmed on the box): a previous
// monitor process died holding the libusb claim - killed by the 30 s ready
// timeout, most likely mid-open - and never reattached the kernel driver. The
// signature is visible in `lsusb -t`: the HID interface shows
// `Driver=[none]` instead of `Driver=usbhid`. In that state the board still
// enumerates and `import board` still resolves its id in about a second, but
// the first `digitalio.DigitalInOut(...)` blocks for ever, so the monitor
// never reaches `ready` and the feed retries silently until someone replugs
// the board.
//
// Nobody needs to replug it. USBDEVFS_RESET on the device node re-enumerates
// the device and rebinds the kernel driver, and the node carries a plugdev
// ACL, so this needs no root:
//
//     before   If 2  Class=Human Interface Device, Driver=[none]
//     after    If 2  Class=Human Interface Device, Driver=usbhid
//     pin configuration: 40 s+ hang -> 1.17 s
//
// Node has no ioctl, and this transport already requires a Python
// interpreter, so the reset runs there. The scan is deliberately narrow: only
// known U2IF bridge vendors, and only a device that actually carries the
// leaked-claim signature. Resetting USB devices at large is not this
// module's business.

/** Adafruit and Raspberry Pi: the boards U2IF firmware runs on. */
export const U2IF_VENDORS = ['239a', '2e8a'];

const RESET_SOURCE = `
import fcntl
import json
import os
import sys

# USBDEVFS_RESET = _IO('U', 20)
USBDEVFS_RESET = 0x5514
SYS = '/sys/bus/usb/devices'


def read(path):
    try:
        with open(path) as handle:
            return handle.read().strip()
    except Exception:
        return None


def main():
    vendors = set(json.loads(sys.argv[1]))
    reset = []
    skipped = []
    for name in sorted(os.listdir(SYS)):
        base = os.path.join(SYS, name)
        vendor = read(os.path.join(base, 'idVendor'))
        if vendor is None or vendor.lower() not in vendors:
            continue
        product = read(os.path.join(base, 'idProduct'))
        # The signature: a HID interface with no kernel driver bound, i.e. a
        # libusb claim that was never released.
        stranded = []
        for entry in sorted(os.listdir(base)):
            interface = os.path.join(base, entry)
            if not entry.startswith(name + ':'):
                continue
            if read(os.path.join(interface, 'bInterfaceClass')) != '03':
                continue
            if not os.path.exists(os.path.join(interface, 'driver')):
                stranded.append(entry)
        label = '%s:%s (%s)' % (vendor, product, read(os.path.join(base, 'product')) or name)
        if not stranded:
            skipped.append({'device': label, 'why': 'HID interface still bound to its kernel driver'})
            continue
        busnum = read(os.path.join(base, 'busnum'))
        devnum = read(os.path.join(base, 'devnum'))
        if busnum is None or devnum is None:
            skipped.append({'device': label, 'why': 'no busnum/devnum'})
            continue
        node = '/dev/bus/usb/%03d/%03d' % (int(busnum), int(devnum))
        try:
            fd = os.open(node, os.O_WRONLY)
        except Exception as err:
            skipped.append({'device': label, 'why': 'cannot open %s: %s' % (node, err)})
            continue
        try:
            fcntl.ioctl(fd, USBDEVFS_RESET, 0)
            reset.append({'device': label, 'node': node, 'interfaces': stranded})
        except Exception as err:
            skipped.append({'device': label, 'why': 'reset failed on %s: %s' % (node, err)})
        finally:
            os.close(fd)
    print(json.dumps({'reset': reset, 'skipped': skipped}))
    return 0


sys.exit(main())
`;

export interface BridgeResetResult {
    reset: Array<{ device: string; node: string; interfaces: string[] }>;
    skipped: Array<{ device: string; why: string }>;
    error: string | null;
}

export const EMPTY_RESET: BridgeResetResult = { reset: [], skipped: [], error: null };

/**
 * Reset any U2IF bridge whose HID interface has been left unclaimed.
 *
 * Linux only - USBDEVFS_RESET is a Linux ioctl, and the leaked-claim signature
 * is read out of sysfs. Everywhere else this is a no-op rather than an error:
 * the caller's retry is still the thing that recovers.
 */
export async function resetStrandedBridges(python: string, timeoutMs: number = 10000): Promise<BridgeResetResult> {
    if (process.platform !== 'linux') {
        return { ...EMPTY_RESET, error: 'USB reset is Linux-only; retrying without it' };
    }
    return new Promise((resolve) => {
        execFile(
            python,
            ['-c', RESET_SOURCE, JSON.stringify(U2IF_VENDORS)],
            { timeout: timeoutMs },
            (err, stdout) => {
                if (err && !stdout) {
                    resolve({ ...EMPTY_RESET, error: err.message });
                    return;
                }
                try {
                    const parsed = JSON.parse(String(stdout).trim());
                    const result: BridgeResetResult = {
                        reset: parsed.reset || [],
                        skipped: parsed.skipped || [],
                        error: null,
                    };
                    for (const device of result.reset) {
                        log.info(`USB reset ${device.device} on ${device.node} `
                            + `(HID interface ${device.interfaces.join(', ')} had no kernel driver - a leaked claim)`);
                    }
                    resolve(result);
                } catch (parseErr) {
                    resolve({ ...EMPTY_RESET, error: `could not read the reset helper's output: ${(parseErr as Error).message}` });
                }
            }
        );
    });
}

/** What the reset did, for the error the operator or the agent finally sees. */
export function describeBridgeReset(result: BridgeResetResult): string {
    if (result.error) {
        return ` A USB reset was attempted first but could not run (${result.error}).`;
    }
    if (result.reset.length) {
        return ' A previous instance had left the HID interface claimed, so the bridge was reset on the USB bus '
            + `(${result.reset.map((d) => d.device).join(', ')}) - this retry should find it working.`;
    }
    if (result.skipped.length) {
        return ` No bridge needed a USB reset (${result.skipped.map((d) => `${d.device}: ${d.why}`).join('; ')}).`;
    }
    return ' No U2IF bridge was found on the USB bus to reset.';
}
