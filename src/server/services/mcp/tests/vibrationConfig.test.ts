import assert from 'assert';

import { bridgeOf, leaseConflict, parseOrientation, parseSensors, probeLeases, resolveVibrationConfig, toMachineFrame } from '../vibrationConfig';

type TestCase = [string, () => void | Promise<void>];

const SENSORS = JSON.stringify([
    { id: 'head', location: 'toolhead', chip: 'lsm6dsox', orientation: 'x:+x,y:+y,z:+z' },
    { id: 'tail', location: 'tailstock', chip: 'ism330dhcx', address: '0x6b', odr_hz: 833 },
    { id: 'chuck', location: 'rotary-chuck', chip: 'bno055', mux: { address: 0x70, channel: 3 } },
]);

function store(values: { [key: string]: unknown }) {
    return (key: string) => values[key];
}

export const tests: TestCase[] = [
    ['sensors parse with chip defaults: fifo for LSM6DSO-family, poll for the rest, default address and rate', () => {
        const { sensors, problems } = parseSensors(SENSORS);
        assert.deepStrictEqual(problems, []);
        assert.strictEqual(sensors[0].mode, 'fifo');
        assert.strictEqual(sensors[0].address, 0x6a);
        assert.strictEqual(sensors[0].rateHz, 1666);
        assert.strictEqual(sensors[0].rangeG, 4);
        assert.strictEqual(sensors[1].address, 0x6b);
        assert.strictEqual(sensors[1].rateHz, 833);
        assert.strictEqual(sensors[2].mode, 'poll');
        assert.strictEqual(sensors[2].address, 0x28);
        assert.deepStrictEqual(sensors[2].mux, { address: 0x70, channel: 3 });
    }],

    ['bad entries are named: unknown chip, fifo on a poll-only chip, odd ODR, address clash', () => {
        const { problems } = parseSensors([
            { id: 'a', location: 'toolhead', chip: 'mma8451' },
            { id: 'b', location: 'toolhead', chip: 'bno055', mode: 'fifo' },
            { id: 'c', location: 'toolhead', chip: 'lsm6dsox', odr_hz: 1000 },
            { id: 'd', location: 'y-axis', chip: 'lsm6dsox' },
            { id: 'e', location: 'x-axis', chip: 'lsm6dso32' },
            { id: 'f', location: 'spindle', chip: 'lsm6dsox', address: 0x6b },
        ]);
        assert.ok(problems.some((p) => /chip must be one of/.test(p)));
        assert.ok(problems.some((p) => /bno055 has no supported FIFO/.test(p)));
        assert.ok(problems.some((p) => /odr_hz must be one of/.test(p)));
        assert.ok(problems.some((p) => /share I2C address 0x6a/.test(p)));
        assert.ok(problems.some((p) => /location must be one of/.test(p)));
    }],

    ['orientation must be a right-handed signed permutation', () => {
        assert.deepStrictEqual(parseOrientation('x:+y, y:-x, z:+z'), ['+y', '-x', '+z']);
        assert.match(String(parseOrientation('x:+y,y:+x,z:+z')), /left-handed/);
        assert.match(String(parseOrientation('x:+y,y:+y,z:+z')), /same machine axis/);
        assert.match(String(parseOrientation('x:+y,y:-x')), /all three/);
        assert.deepStrictEqual(toMachineFrame(['+y', '-x', '+z'], [1, 2, 3]), { x: -2, y: 1, z: 3 });
    }],

    ['off by default; blinka needs a bridge chosen; serial needs a port', () => {
        const none = resolveVibrationConfig({}, store({}));
        assert.strictEqual(none.enabled, false);
        assert.ok(none.problems.some((p) => /no sensors configured/.test(p)));
        const blinka = resolveVibrationConfig({}, store({ mcpVibration: true, mcpVibrationSensors: SENSORS }));
        assert.ok(blinka.problems.some((p) => /no Blinka bridge chosen/.test(p)));
        const serial = resolveVibrationConfig({ LUBAN_MCP_VIBRATION_TRANSPORT: 'serial' }, store({ mcpVibration: true, mcpVibrationSensors: SENSORS }));
        assert.ok(serial.problems.some((p) => /needs the serial port/.test(p)));
        const ok = resolveVibrationConfig({}, store({ mcpVibration: true, mcpVibrationSensors: SENSORS, mcpVibrationTransport: 'serial', mcpVibrationSerialPort: '/dev/ttyACM1' }));
        assert.deepStrictEqual(ok.problems, []);
        assert.strictEqual(ok.sources.serialPort, 'config');
    }],

    ['refuses to share the probe feed\'s USB bridge, allows a different one', () => {
        const probeOnU2if = { mcpProbeTransport: 'gpio', mcpGpioPinProbe: 'A0:down', mcpVibration: true, mcpVibrationSensors: SENSORS };
        const shared = resolveVibrationConfig({}, store({ ...probeOnU2if, mcpVibrationBlinkaEnv: 'BLINKA_U2IF=1' }));
        assert.ok(shared.problems.some((p) => /share usb:BLINKA_U2IF with the probe feed/.test(p)), JSON.stringify(shared.problems));
        // Probe pins only, transport unset: auto-gpio, default U2IF env - still the same bridge.
        const implicit = resolveVibrationConfig({}, store({ mcpGpioPinProbe: 'A0:down', mcpVibration: true, mcpVibrationSensors: SENSORS, mcpVibrationBlinkaEnv: 'BLINKA_U2IF=1' }));
        assert.ok(implicit.problems.some((p) => /share usb:BLINKA_U2IF with the probe feed/.test(p)));
        const own = resolveVibrationConfig({}, store({ ...probeOnU2if, mcpVibrationBlinkaEnv: 'BLINKA_MCP2221=1' }));
        assert.deepStrictEqual(own.problems, []);
        assert.deepStrictEqual(own.blinkaEnv, { BLINKA_MCP2221: '1' });
        assert.strictEqual(bridgeOf({ BLINKA_FT232H: '1' }), 'BLINKA_FT232H');
        assert.strictEqual(bridgeOf({}), 'native');
    }],

    ['several CircuitPython boards: one link per port, sensors assigned by port, each board its own bus', () => {
        const sensors = JSON.stringify([
            { id: 'head', location: 'toolhead', chip: 'lsm6dsox', port: '/dev/ttyACM1' },
            { id: 'tail', location: 'tailstock', chip: 'lsm6dsox', port: '/dev/ttyACM2' },
            { id: 'chuck', location: 'rotary-chuck', chip: 'lsm6dsox', address: '0x6b', port: '/dev/ttyACM2' },
        ]);
        const cfg = resolveVibrationConfig({}, store({
            mcpVibration: true, mcpVibrationTransport: 'serial', mcpVibrationSerialPort: '/dev/ttyACM1, /dev/ttyACM2', mcpVibrationSensors: sensors,
        }));
        assert.deepStrictEqual(cfg.problems, []);
        assert.deepStrictEqual(cfg.links.map((l) => [l.id, l.sensors.map((s) => s.id)]), [['/dev/ttyACM1', ['head']], ['/dev/ttyACM2', ['tail', 'chuck']]]);
        assert.deepStrictEqual(cfg.leases, ['serial:/dev/ttyACM1', 'serial:/dev/ttyACM2']);
        const unassigned = resolveVibrationConfig({}, store({
            mcpVibration: true, mcpVibrationTransport: 'serial', mcpVibrationSerialPort: 'COM7,COM8', mcpVibrationSensors: JSON.stringify([{ id: 'a', location: 'bed', chip: 'lsm6dsox' }]),
        }));
        assert.ok(unassigned.problems.some((p) => /name its board's port/.test(p)));
        assert.ok(unassigned.problems.some((p) => /COM7 has no sensors|COM8 has no sensors/.test(p)));
    }],

    ['a root sensor cannot share an address with a muxed one, nor sit at the mux address', () => {
        const { problems } = parseSensors([
            { id: 'root', location: 'toolhead', chip: 'lsm6dsox', address: '0x6a' },
            { id: 'muxed', location: 'tailstock', chip: 'lsm6dsox', address: '0x6a', mux: { address: '0x70', channel: 2 } },
            { id: 'clash', location: 'bed', chip: 'bno055', address: '0x70' },
            { id: 'behind', location: 'frame', chip: 'lsm6dsox', address: '0x6b', mux: { address: '0x70', channel: 3 } },
        ]);
        assert.ok(problems.some((p) => /would collide with the sensor behind a mux/.test(p)), JSON.stringify(problems));
        assert.ok(problems.some((p) => /the address of a TCA9548A mux/.test(p)));
    }],

    ['gyro only on chips that have one; one bridge selector; native pins are leases too', () => {
        assert.match(String(parseSensors([{ id: 'a', location: 'bed', chip: 'lis3dh', gyro: true }]).problems), /has no gyroscope/);
        assert.deepStrictEqual(parseSensors([{ id: 'a', location: 'rotary-chuck', chip: 'bno055', gyro: true }]).problems, []);
        const two = resolveVibrationConfig({}, store({ mcpVibration: true, mcpVibrationSensors: SENSORS, mcpVibrationBlinkaEnv: 'BLINKA_MCP2221=1 BLINKA_FT232H=1' }));
        assert.ok(two.problems.some((p) => /choose exactly one bridge/.test(p)));
        // A probe on Raspberry Pi header pin D2 (= SDA) and accelerometers on native I2C.
        const native = resolveVibrationConfig({}, store({
            mcpProbeTransport: 'gpio', mcpGpioBlinkaEnv: 'native', mcpGpioPinProbe: 'D2:up', mcpVibration: true, mcpVibrationSensors: SENSORS, mcpVibrationBlinkaEnv: 'native',
        }));
        assert.ok(native.problems.some((p) => /share pin:SDA/.test(p)), JSON.stringify(native.problems));
        const nativeOk = resolveVibrationConfig({}, store({
            mcpProbeTransport: 'gpio', mcpGpioBlinkaEnv: 'native', mcpGpioPinProbe: 'D17:up', mcpVibration: true, mcpVibrationSensors: SENSORS, mcpVibrationBlinkaEnv: 'native',
        }));
        assert.deepStrictEqual(nativeOk.problems, []);
        assert.deepStrictEqual(probeLeases('gpio', null, ['A0:down']), ['usb:BLINKA_U2IF']);
        assert.strictEqual(leaseConflict(['usb:BLINKA_MCP2221'], ['usb:BLINKA_U2IF'], 'x'), null);
    }],

    ['a configuration the I2C bus cannot carry, or rings too big for memory, is refused', () => {
        const fast = JSON.stringify([
            { id: 'a', location: 'toolhead', chip: 'lsm6dsox', odr_hz: 6664, gyro: true },
            { id: 'b', location: 'tailstock', chip: 'lsm6dsox', address: '0x6b', odr_hz: 6664 },
        ]);
        const busy = resolveVibrationConfig({}, store({ mcpVibration: true, mcpVibrationSensors: fast, mcpVibrationTransport: 'serial', mcpVibrationSerialPort: 'COM7' }));
        assert.ok(busy.problems.some((p) => /every batch would overrun/.test(p)), JSON.stringify(busy.problems));
        const ok = JSON.stringify([{ id: 'a', location: 'toolhead', chip: 'lsm6dsox', odr_hz: 1666 }]);
        const fine = resolveVibrationConfig({}, store({ mcpVibration: true, mcpVibrationSensors: ok, mcpVibrationTransport: 'serial', mcpVibrationSerialPort: 'COM7' }));
        assert.deepStrictEqual(fine.problems, []);
        const many = JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
            id: `s${i}`, location: 'frame', chip: 'lsm6dsox', odr_hz: 1666, gyro: true, mux: { address: '0x70', channel: i },
        })));
        const big = resolveVibrationConfig({}, store({
            mcpVibration: true, mcpVibrationSensors: many, mcpVibrationTransport: 'serial', mcpVibrationSerialPort: 'COM7', mcpVibrationBufferS: 900, mcpVibrationI2cHz: 1000000,
        }));
        assert.ok(big.problems.some((p) => /look-back rings would take/.test(p)), JSON.stringify(big.problems));
    }],

    ['python falls back to the GPIO transport\'s interpreter; env beats config', () => {
        const cfg = resolveVibrationConfig({ LUBAN_MCP_VIBRATION: '1' }, store({ mcpVibration: false, mcpGpioPython: '/home/pi/dev/Luban/.venv/bin/python' }), 'linux');
        assert.strictEqual(cfg.enabled, true);
        assert.strictEqual(cfg.sources.enabled, 'env');
        assert.strictEqual(cfg.python, '/home/pi/dev/Luban/.venv/bin/python');
        assert.strictEqual(resolveVibrationConfig({}, store({}), 'linux').python, 'python3');
    }],
];
