/* eslint-disable camelcase */
// Sensor JSON fields are snake_case (odr_hz, range_g), matching the MCP argument convention.
//
// Accelerometer (vibration) feed settings, resolved env-first from
// (environment, configstore getter) so the rules are testable without the
// server.
//
// What is configured here is HARDWARE: which bridge the I2C bus hangs off,
// which chips are on it at which address (and behind which TCA9548A mux
// channel), and where on the machine each one is stuck. Sampling rate and
// range are per-sensor hardware settings too. Everything an agent can
// measure (the rotary calibration, the sensor's orientation from gravity)
// lives on the MCP surface instead (operator rule 2026-09-06: no UI knobs for
// agent-measurable values).
//
// Opt-in, off by default, and read-only with respect to the machine: the
// feed records and analyses, it never commands, pauses or stops anything.
//
// Pure: no server imports, unit-tested in tests/vibrationConfig.test.ts.

export const VIBRATION_KEYS = {
    enabled: { env: 'LUBAN_MCP_VIBRATION', key: 'mcpVibration' },
    transport: { env: 'LUBAN_MCP_VIBRATION_TRANSPORT', key: 'mcpVibrationTransport' },
    python: { env: 'LUBAN_MCP_VIBRATION_PYTHON', key: 'mcpVibrationPython' },
    blinkaEnv: { env: 'LUBAN_MCP_VIBRATION_BLINKA_ENV', key: 'mcpVibrationBlinkaEnv' },
    serialPort: { env: 'LUBAN_MCP_VIBRATION_SERIAL_PORT', key: 'mcpVibrationSerialPort' },
    sensors: { env: 'LUBAN_MCP_VIBRATION_SENSORS', key: 'mcpVibrationSensors' },
    i2cHz: { env: 'LUBAN_MCP_VIBRATION_I2C_HZ', key: 'mcpVibrationI2cHz' },
    jobCapture: { env: 'LUBAN_MCP_VIBRATION_JOBS', key: 'mcpVibrationJobs' },
    bufferS: { env: 'LUBAN_MCP_VIBRATION_BUFFER_S', key: 'mcpVibrationBufferS' },
};

/** The GPIO probe transport's keys, read to refuse sharing its bridge. */
export const GPIO_PROBE_KEYS = {
    transport: { env: 'LUBAN_MCP_PROBE_TRANSPORT', key: 'mcpProbeTransport' },
    blinkaEnv: { env: 'LUBAN_MCP_GPIO_BLINKA_ENV', key: 'mcpGpioBlinkaEnv' },
    python: { env: 'LUBAN_MCP_GPIO_PYTHON', key: 'mcpGpioPython' },
    toolsetter: { env: 'LUBAN_MCP_GPIO_PIN_TOOLSETTER', key: 'mcpGpioPinToolsetter' },
    overtravel: { env: 'LUBAN_MCP_GPIO_PIN_OVERTRAVEL', key: 'mcpGpioPinOvertravel' },
    probe: { env: 'LUBAN_MCP_GPIO_PIN_PROBE', key: 'mcpGpioPinProbe' },
};

/** The GPIO probe transport's default Blinka environment (gpioFeed.ts DEFAULT_BLINKA_ENV). */
const GPIO_DEFAULT_BLINKA_ENV = 'BLINKA_U2IF=1';

export type VibrationTransport = 'blinka' | 'serial';

/**
 * Where the sensor is stuck. `rotary-chuck` turns WITH the chuck (the only
 * location the absolute-B measurement accepts); `rotary-body` is the fixed
 * housing (motor and gearbox noise).
 */
export const SENSOR_LOCATIONS = [
    'toolhead', 'tailstock', 'rotary-chuck', 'rotary-body', 'x-axis', 'y-axis', 'z-axis', 'bed', 'frame', 'other',
] as const;
export type SensorLocation = typeof SENSOR_LOCATIONS[number];

/**
 * fifo: register-level FIFO streaming of the LSM6DSOX / LSM6DSO32 /
 * ISM330DHCX tagged FIFO (the Adafruit 6-DoF and the LSM6DSOX/ISM330DHCX
 * halves of the 9-DoF boards): evenly spaced samples at the chip's ODR, the
 * only mode that supports spectra above a few hundred Hz.
 * poll: the Adafruit CircuitPython driver's `acceleration` read in a loop,
 * timestamped on arrival - any supported chip, low and uneven rate; enough
 * for gravity (tilt, rotary angle) and slow vibration.
 */
export type SensorMode = 'fifo' | 'poll';

export const FIFO_CHIPS = ['lsm6dsox', 'lsm6dso32', 'ism330dhcx'] as const;
export const POLL_CHIPS = ['lsm6dsox', 'lsm6dso32', 'ism330dhcx', 'lsm6ds3trc', 'lsm6ds33', 'lsm9ds1', 'bno055', 'mpu6050', 'icm20948', 'lis3dh', 'adxl34x'] as const;
export type SensorChip = typeof POLL_CHIPS[number];
/** Chips with a gyroscope the monitor can stream (FIFO words or the driver's `gyro`). */
export const GYRO_CHIPS: SensorChip[] = ['lsm6dsox', 'lsm6dso32', 'ism330dhcx', 'lsm6ds3trc', 'lsm6ds33', 'lsm9ds1', 'bno055', 'mpu6050', 'icm20948'];

/** 7-bit default I2C address of each chip on its Adafruit breakout (address jumper open). */
export const DEFAULT_ADDRESS: { [chip in SensorChip]: number } = {
    lsm6dsox: 0x6a,
    lsm6dso32: 0x6a,
    ism330dhcx: 0x6a,
    lsm6ds3trc: 0x6a,
    lsm6ds33: 0x6a,
    lsm9ds1: 0x6b,
    bno055: 0x28,
    mpu6050: 0x68,
    icm20948: 0x69,
    lis3dh: 0x18,
    adxl34x: 0x53,
};

/** Accelerometer output data rates the LSM6DSO-family FIFO can batch at, Hz (ODR_XL / BDR_XL codes 1..10). */
export const FIFO_ODR_HZ = [12.5, 26, 52, 104, 208, 416, 833, 1666, 3332, 6664];
/** Full-scale ranges per chip, g. */
export const RANGE_G: { [chip: string]: number[] } = {
    lsm6dsox: [2, 4, 8, 16],
    ism330dhcx: [2, 4, 8, 16],
    lsm6dso32: [4, 8, 16, 32],
};
export const DEFAULT_ODR_HZ = 1666;
export const DEFAULT_RANGE_G = 4;
export const POLL_RATE_HZ = { default: 100, min: 5, max: 1000 };
export const MAX_SENSORS = 8;
export const I2C_HZ = { default: 400000, min: 10000, max: 1000000 };
/** Seconds of every sensor's stream kept in memory for look-back captures. */
export const BUFFER_S = { default: 120, min: 10, max: 900 };
/** All look-back rings together (8 sensors x 6664 Hz x 900 s would be ~1 GB). */
export const MAX_RING_BYTES = 256 * 1024 * 1024;
/** Ring bytes per sample: time (f64) + accel (3 x f32) [+ gyro (3 x f32)]. */
const RING_SAMPLE_BYTES = 8 + 12;
const RING_GYRO_BYTES = 12;
/**
 * A FIFO word is 7 bytes; an I2C byte is 9 bit times. This share of the
 * bus is all the FIFO reads may plan to use (addressing, status reads and
 * a USB bridge's per-transaction cost take the rest - the heartbeat's busy
 * fraction and overruns measure what is really left).
 */
const BUS_SHARE = 0.6;

/** FIFO bytes per second the configured sensors need, and what the bus clock allows. */
export function busBudget(sensors: SensorSpec[], i2cHz: number): { neededBytesS: number; availableBytesS: number } {
    const neededBytesS = sensors
        .filter((s) => s.mode === 'fifo')
        .reduce((sum, s) => sum + s.rateHz * (s.gyro ? 2 : 1) * 7, 0);
    return { neededBytesS, availableBytesS: (i2cHz / 9) * BUS_SHARE };
}

export type MachineAxis = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export interface SensorSpec {
    id: string;
    location: SensorLocation;
    chip: SensorChip;
    mode: SensorMode;
    /** 7-bit I2C address. */
    address: number;
    /** TCA9548A/PCA9548A mux in front of the sensor, if any. */
    mux: { address: number; channel: number } | null;
    /** fifo: the ODR (one of FIFO_ODR_HZ). poll: the target poll rate. */
    rateHz: number;
    rangeG: number;
    /** Also stream the gyroscope (dps), FIFO or poll; only on GYRO_CHIPS. */
    gyro: boolean;
    /** serial transport: the board (serial port) this sensor hangs off; null = the only one. */
    port: string | null;
    /** Machine axis each sensor axis points along, when known: [x, y, z]. */
    orientation: [MachineAxis, MachineAxis, MachineAxis] | null;
    note: string | null;
}

export type SettingSource = 'env' | 'config' | 'default';

export interface VibrationLink {
    /** 'blinka', or the serial port. */
    id: string;
    transport: VibrationTransport;
    port: string | null;
    sensors: SensorSpec[];
}

export interface VibrationConfig {
    enabled: boolean;
    transport: VibrationTransport;
    python: string;
    /** Blinka environment as text (blinka transport), null when none was configured. */
    blinkaEnvText: string | null;
    blinkaEnv: { [name: string]: string };
    /** serial transport: one CircuitPython board per port, each with its own I2C bus and sensors. */
    serialPorts: string[];
    /** One monitor per link: the Blinka bridge, or each serial board. */
    links: VibrationLink[];
    /** Physical resources the accelerometers hold exclusively (USB bridge, I2C pins, serial ports). */
    leases: string[];
    i2cHz: number;
    /** Record every file job's vibration automatically. */
    jobCapture: boolean;
    bufferS: number;
    sensors: SensorSpec[];
    /** Everything that stops the feed from starting; empty = it can start. */
    problems: string[];
    sources: { [field: string]: SettingSource };
}

type Env = { [name: string]: string | undefined };
type Getter = (key: string) => unknown;

function present(value: unknown): boolean {
    return value !== undefined && value !== null && String(value).trim() !== '';
}

function pickRaw(env: Env, get: Getter, spec: { env: string; key: string }): { raw: unknown; source: SettingSource } {
    if (present(env[spec.env])) {
        return { raw: env[spec.env], source: 'env' };
    }
    const stored = get(spec.key);
    if (present(stored)) {
        return { raw: stored, source: 'config' };
    }
    return { raw: undefined, source: 'default' };
}

export function parseFlag(raw: unknown): boolean {
    if (typeof raw === 'boolean') {
        return raw;
    }
    const text = String(raw ?? '').trim().toLowerCase();
    return text === '1' || text === 'true' || text === 'on' || text === 'yes';
}

/** NAME=VALUE pairs (space/comma separated); "native" = none. Same grammar as the GPIO transport's. */
export function parseEnvPairs(text: string): { [name: string]: string } | string {
    const trimmed = text.trim();
    if (!trimmed || ['native', 'none', 'off'].includes(trimmed.toLowerCase())) {
        return {};
    }
    const out: { [name: string]: string } = {};
    for (const token of trimmed.split(/[\s,]+/).filter(Boolean)) {
        const match = token.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) {
            return `Blinka environment entry "${token}" is not NAME=VALUE`;
        }
        out[match[1]] = match[2];
    }
    return out;
}

const BRIDGE_SELECTORS = ['BLINKA_U2IF', 'BLINKA_MCP2221', 'BLINKA_FT232H', 'BLINKA_FT2232H', 'BLINKA_GREATFET'];

/** Every USB-bridge selector a Blinka environment switches on. */
export function bridgeSelectors(env: { [name: string]: string }): string[] {
    return BRIDGE_SELECTORS.filter((name) => env[name] !== undefined && env[name] !== '' && env[name] !== '0');
}

/** Which USB bridge a Blinka environment selects ('native' = none: a board's own pins). */
export function bridgeOf(env: { [name: string]: string }): string {
    return bridgeSelectors(env)[0] || 'native';
}

/**
 * Raspberry Pi header pins that ARE the I2C bus (board.D2/D3 = SDA/SCL on
 * I2C1): a native probe pin named either way collides with native I2C.
 */
const NATIVE_I2C_PIN_ALIASES: { [pin: string]: string } = { D2: 'SDA', D3: 'SCL', SDA: 'SDA', SCL: 'SCL', SDA1: 'SDA', SCL1: 'SCL' };

/**
 * The exclusive physical resources a Blinka process holds: the USB bridge
 * it opens, or - on native pins - the pins themselves. The accelerometers
 * and the safety (probe / crash sensor) feed must never hold one in common;
 * a future SPI feed declares its pins the same way (pin:SCK, pin:MOSI ...).
 */
export function blinkaLeases(env: { [name: string]: string }, pins: string[]): string[] {
    const bridge = bridgeOf(env);
    if (bridge !== 'native') {
        return [`usb:${bridge}`];
    }
    return pins.map((pin) => `pin:${NATIVE_I2C_PIN_ALIASES[pin.toUpperCase()] || pin.toUpperCase()}`);
}

/** The probe feed's leases from its transport kind, Blinka environment text and pin specs ("A0:down"). */
export function probeLeases(kind: string, envText: string | null, pinSpecs: string[]): string[] {
    if (kind !== 'gpio') {
        return [];
    }
    const env = parseEnvPairs(envText === null ? GPIO_DEFAULT_BLINKA_ENV : envText);
    if (typeof env === 'string') {
        return [];
    }
    return blinkaLeases(env, pinSpecs.map((spec) => spec.split(':')[0].trim()).filter(Boolean));
}

/** Resources both sides would hold, with a sentence naming them; null when none. */
export function leaseConflict(own: string[], safety: string[], what: string): string | null {
    const shared = own.filter((lease) => safety.includes(lease));
    if (!shared.length) {
        return null;
    }
    return `the accelerometers would share ${shared.join(', ')} with ${what} - refused: the probe and crash sensors are safety equipment, `
        + 'and two processes on one USB bridge or pin contend for it (a claim leaked mid-open wedged the KB2040 on 2026-09-19). '
        + 'Give the accelerometers their own bridge (an MCP2221A or FT232H breakout) or a CircuitPython board on serial';
}

const MACHINE_AXES: MachineAxis[] = ['+x', '-x', '+y', '-y', '+z', '-z'];

/**
 * "x:+y,y:-x,z:+z" (sensor axis : machine axis it points along) -> [x, y, z]
 * machine axes. Must be a proper rotation: each machine axis once, and
 * right-handed (a left-handed map is a typo, never a mounting).
 */
export function parseOrientation(raw: unknown): [MachineAxis, MachineAxis, MachineAxis] | string {
    const text = String(raw).trim().toLowerCase().replace(/\s+/g, '');
    const out: Array<MachineAxis | null> = [null, null, null];
    for (const part of text.split(',').filter(Boolean)) {
        const match = part.match(/^([xyz])[:=]([+-]?)([xyz])$/);
        if (!match) {
            return `orientation entry "${part}" is not like "x:+y"`;
        }
        const index = 'xyz'.indexOf(match[1]);
        const axis = `${match[2] || '+'}${match[3]}` as MachineAxis;
        if (!MACHINE_AXES.includes(axis)) {
            return `orientation entry "${part}" names no machine axis`;
        }
        out[index] = axis;
    }
    if (out.some((axis) => axis === null)) {
        return 'orientation must map all three sensor axes (x, y and z)';
    }
    const axes = out as MachineAxis[];
    const letters = axes.map((axis) => axis[1]);
    if (new Set(letters).size !== 3) {
        return 'orientation maps two sensor axes onto the same machine axis';
    }
    // det of the signed permutation: +1 right-handed.
    const vec = (axis: MachineAxis): number[] => {
        const v = [0, 0, 0];
        v['xyz'.indexOf(axis[1])] = axis[0] === '-' ? -1 : 1;
        return v;
    };
    const [a, b, c] = axes.map(vec);
    const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    if (det !== 1) {
        return 'orientation is left-handed (a mirror image): one sign is wrong';
    }
    return axes as [MachineAxis, MachineAxis, MachineAxis];
}

function parseAddress(raw: unknown): number | null {
    if (typeof raw === 'number' && Number.isInteger(raw)) {
        return raw;
    }
    const text = String(raw ?? '').trim().toLowerCase();
    const value = /^0x[0-9a-f]+$/.test(text) ? parseInt(text, 16) : Number(text);
    return Number.isInteger(value) ? value : null;
}

/** Validate one sensor entry; returns the spec or the problem. */
export function parseSensor(entry: unknown, index: number): SensorSpec | string {
    const where = `sensor ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return `${where} is not an object`;
    }
    const e = entry as { [key: string]: unknown };
    const id = String(e.id ?? '').trim();
    if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(id)) {
        return `${where}: id "${id}" must be 1-32 letters, digits, - or _`;
    }
    const at = `sensor "${id}"`;
    const location = String(e.location ?? '').trim().toLowerCase() as SensorLocation;
    if (!SENSOR_LOCATIONS.includes(location)) {
        return `${at}: location must be one of ${SENSOR_LOCATIONS.join(', ')}`;
    }
    const chip = String(e.chip ?? '').trim().toLowerCase() as SensorChip;
    if (!POLL_CHIPS.includes(chip)) {
        return `${at}: chip must be one of ${POLL_CHIPS.join(', ')}`;
    }
    const fifoCapable = (FIFO_CHIPS as readonly string[]).includes(chip);
    const mode = String(e.mode ?? (fifoCapable ? 'fifo' : 'poll')).trim().toLowerCase() as SensorMode;
    if (mode !== 'fifo' && mode !== 'poll') {
        return `${at}: mode must be fifo or poll`;
    }
    if (mode === 'fifo' && !fifoCapable) {
        return `${at}: ${chip} has no supported FIFO streaming; use mode "poll" (low rate) or a ${FIFO_CHIPS.join('/')} for spectra`;
    }
    const address = e.address === undefined ? DEFAULT_ADDRESS[chip] : parseAddress(e.address);
    if (address === null || address < 0x08 || address > 0x77) {
        return `${at}: address must be a 7-bit I2C address (0x08-0x77)`;
    }
    let mux: SensorSpec['mux'] = null;
    if (e.mux !== undefined && e.mux !== null) {
        const m = e.mux as { [key: string]: unknown };
        const muxAddress = m.address === undefined ? 0x70 : parseAddress(m.address);
        const channel = Number(m.channel);
        if (muxAddress === null || muxAddress < 0x70 || muxAddress > 0x77) {
            return `${at}: mux.address must be 0x70-0x77 (TCA9548A)`;
        }
        if (!Number.isInteger(channel) || channel < 0 || channel > 7) {
            return `${at}: mux.channel must be 0-7`;
        }
        mux = { address: muxAddress, channel };
    }
    let rateHz: number;
    if (mode === 'fifo') {
        rateHz = e.odr_hz === undefined ? DEFAULT_ODR_HZ : Number(e.odr_hz);
        if (!FIFO_ODR_HZ.includes(rateHz)) {
            return `${at}: odr_hz must be one of ${FIFO_ODR_HZ.join(', ')}`;
        }
    } else {
        rateHz = e.poll_hz === undefined ? POLL_RATE_HZ.default : Number(e.poll_hz);
        if (!Number.isFinite(rateHz) || rateHz < POLL_RATE_HZ.min || rateHz > POLL_RATE_HZ.max) {
            return `${at}: poll_hz must be ${POLL_RATE_HZ.min}-${POLL_RATE_HZ.max}`;
        }
    }
    const ranges = RANGE_G[chip] || null;
    let rangeG = Number(e.range_g);
    if (e.range_g === undefined) {
        rangeG = ranges && !ranges.includes(DEFAULT_RANGE_G) ? ranges[0] : DEFAULT_RANGE_G;
    }
    if (mode === 'fifo' && ranges && !ranges.includes(rangeG)) {
        return `${at}: range_g for ${chip} must be one of ${ranges.join(', ')}`;
    }
    if (!(rangeG > 0)) {
        return `${at}: range_g must be positive`;
    }
    let orientation: SensorSpec['orientation'] = null;
    if (e.orientation !== undefined && e.orientation !== null && String(e.orientation).trim() !== '') {
        const parsed = parseOrientation(e.orientation);
        if (typeof parsed === 'string') {
            return `${at}: ${parsed}`;
        }
        orientation = parsed;
    }
    const gyro = parseFlag(e.gyro);
    if (gyro && !GYRO_CHIPS.includes(chip)) {
        return `${at}: ${chip} has no gyroscope (gyro needs one of ${GYRO_CHIPS.join(', ')})`;
    }
    return {
        id,
        location,
        chip,
        mode,
        address,
        mux,
        rateHz,
        rangeG,
        gyro,
        port: present(e.port) ? String(e.port).trim() : null,
        orientation,
        note: present(e.note) ? String(e.note).trim() : null,
    };
}

/** The sensor list from its JSON text (or an already-parsed array). */
export function parseSensors(raw: unknown): { sensors: SensorSpec[]; problems: string[] } {
    const problems: string[] = [];
    let list: unknown = raw;
    if (typeof raw === 'string') {
        try {
            list = JSON.parse(raw);
        } catch (err) {
            return { sensors: [], problems: [`sensor list is not valid JSON: ${(err as Error).message}`] };
        }
    }
    if (!Array.isArray(list)) {
        return { sensors: [], problems: ['sensor list must be a JSON array of sensor objects'] };
    }
    if (list.length > MAX_SENSORS) {
        problems.push(`at most ${MAX_SENSORS} sensors`);
    }
    const sensors: SensorSpec[] = [];
    list.slice(0, MAX_SENSORS).forEach((entry, index) => {
        const parsed = parseSensor(entry, index);
        if (typeof parsed === 'string') {
            problems.push(parsed);
        } else {
            sensors.push(parsed);
        }
    });
    const ids = new Set<string>();
    const buses = new Set<string>();
    for (const sensor of sensors) {
        if (ids.has(sensor.id)) {
            problems.push(`sensor id "${sensor.id}" is used twice`);
        }
        ids.add(sensor.id);
        // Each serial board has its own bus: the same address on two boards is fine.
        const bus = `${sensor.port || ''}|${sensor.mux ? `${sensor.mux.address}/${sensor.mux.channel}` : 'root'}:${sensor.address}`;
        // A root device and a muxed one at the same address cannot coexist: an
        // open channel joins its devices to the root bus, so both would answer.
        // Nor may a sensor sit at a mux's own address.
        const sameBoard = sensors.filter((other) => other !== sensor && (other.port || '') === (sensor.port || ''));
        if (!sensor.mux && sameBoard.some((other) => other.mux && other.address === sensor.address)) {
            problems.push(`sensor "${sensor.id}" at 0x${sensor.address.toString(16)} on the root bus would collide with the sensor behind a mux at the same `
                + 'address whenever its channel is open: put both behind mux channels, or change one address');
        }
        if (sameBoard.some((other) => other.mux && other.mux.address === sensor.address)) {
            problems.push(`sensor "${sensor.id}" sits at 0x${sensor.address.toString(16)}, the address of a TCA9548A mux`);
        }
        if (buses.has(bus)) {
            problems.push(`two sensors share I2C address 0x${sensor.address.toString(16)}${sensor.mux ? ` on mux channel ${sensor.mux.channel}` : ''} `
                + '(set the other board\'s address jumper or put it behind a TCA9548A channel)');
        }
        buses.add(bus);
    }
    return { sensors, problems };
}

function boundedInt(raw: unknown, limit: { default: number; min: number; max: number }): number {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        return limit.default;
    }
    return Math.min(Math.max(Math.round(value), limit.min), limit.max);
}

export function resolveVibrationConfig(env: Env, get: Getter, platform: string = process.platform): VibrationConfig {
    const sources: { [field: string]: SettingSource } = {};
    const raw: { [field: string]: unknown } = {};
    for (const [field, spec] of Object.entries(VIBRATION_KEYS)) {
        const picked = pickRaw(env, get, spec);
        raw[field] = picked.raw;
        sources[field] = picked.source;
    }
    const problems: string[] = [];
    const transportText = present(raw.transport) ? String(raw.transport).trim().toLowerCase() : 'blinka';
    const transport: VibrationTransport = transportText === 'serial' ? 'serial' : 'blinka';
    if (transportText !== 'serial' && transportText !== 'blinka') {
        problems.push(`transport "${transportText}" must be blinka or serial`);
    }
    const gpioPython = pickRaw(env, get, GPIO_PROBE_KEYS.python);
    let python = platform === 'win32' ? 'python' : 'python3';
    if (present(raw.python)) {
        python = String(raw.python).trim();
    } else if (present(gpioPython.raw)) {
        python = String(gpioPython.raw).trim();
    }

    let blinkaEnvText: string | null = present(raw.blinkaEnv) ? String(raw.blinkaEnv).trim() : null;
    let blinkaEnv: { [name: string]: string } = {};
    const serialPorts = present(raw.serialPort)
        ? [...new Set(String(raw.serialPort).split(',').map((port) => port.trim()).filter(Boolean))]
        : [];
    let leases: string[] = [];
    if (transport === 'blinka') {
        if (blinkaEnvText === null) {
            problems.push('no Blinka bridge chosen for the accelerometers: set the Blinka environment (e.g. BLINKA_MCP2221=1, BLINKA_FT232H=1, '
                + 'or "native" on a Raspberry Pi header) - nothing is picked automatically');
        } else {
            const parsed = parseEnvPairs(blinkaEnvText);
            if (typeof parsed === 'string') {
                problems.push(parsed);
            } else {
                blinkaEnv = parsed;
                const selectors = bridgeSelectors(parsed);
                if (selectors.length > 1) {
                    problems.push(`the Blinka environment switches on ${selectors.join(' and ')}: choose exactly one bridge`);
                }
                leases = blinkaLeases(parsed, ['SCL', 'SDA']);
            }
        }
        // The probe feed's bridge is safety equipment: a second process
        // opening the same U2IF/MCP2221 HID device contends for it, and a
        // claim leaked mid-open is exactly what wedged the KB2040 on
        // 2026-09-19 (the probe feed went dark until a USB reset). Refuse,
        // rather than share it.
        const probeTransport = pickRaw(env, get, GPIO_PROBE_KEYS.transport);
        const pinSpecs = ['toolsetter', 'overtravel', 'probe']
            .map((name) => pickRaw(env, get, GPIO_PROBE_KEYS[name as 'probe']).raw)
            .filter(present)
            .map((value) => String(value));
        // Unset transport = auto: gpio when only GPIO pins are configured.
        let probeKind = pinSpecs.length ? 'gpio' : 'mqtt';
        if (present(probeTransport.raw)) {
            probeKind = String(probeTransport.raw).trim().toLowerCase();
        }
        const probeEnvRaw = pickRaw(env, get, GPIO_PROBE_KEYS.blinkaEnv).raw;
        const conflict = leaseConflict(leases, probeLeases(probeKind, present(probeEnvRaw) ? String(probeEnvRaw) : null, pinSpecs), 'the probe feed (stored settings)');
        if (conflict) {
            problems.push(conflict);
        }
    } else {
        if (!serialPorts.length) {
            problems.push('transport "serial" needs the serial port of the CircuitPython board running vibration_monitor.py (e.g. /dev/ttyACM1, COM7; '
                + 'several boards: comma-separated)');
        }
        leases = serialPorts.map((port) => `serial:${port}`);
    }
    if (transport !== 'blinka') {
        blinkaEnvText = null;
    }
    const parsedSensors = present(raw.sensors) ? parseSensors(raw.sensors) : { sensors: [], problems: ['no sensors configured'] };
    problems.push(...parsedSensors.problems);
    if (!parsedSensors.problems.length && !parsedSensors.sensors.length) {
        problems.push('no sensors configured');
    }
    const i2cHz = boundedInt(raw.i2cHz, I2C_HZ);
    const bufferS = boundedInt(raw.bufferS, BUFFER_S);
    // One monitor per link; each serial board has its own bus.
    const links: VibrationLink[] = [];
    if (transport === 'blinka') {
        const stray = parsedSensors.sensors.filter((s) => s.port);
        if (stray.length) {
            problems.push(`sensor(s) ${stray.map((s) => s.id).join(', ')} name a port, which applies to the serial transport only`);
        }
        links.push({ id: 'blinka', transport, port: null, sensors: parsedSensors.sensors });
    } else if (serialPorts.length) {
        for (const sensor of parsedSensors.sensors) {
            if (!sensor.port && serialPorts.length > 1) {
                problems.push(`sensor "${sensor.id}": name its board's port (one of ${serialPorts.join(', ')})`);
            } else if (sensor.port && !serialPorts.includes(sensor.port)) {
                problems.push(`sensor "${sensor.id}": port ${sensor.port} is not one of the configured serial ports (${serialPorts.join(', ')})`);
            }
        }
        for (const port of serialPorts) {
            const sensors = parsedSensors.sensors.filter((s) => s.port === port || (!s.port && serialPorts.length === 1));
            if (!sensors.length) {
                problems.push(`serial port ${port} has no sensors assigned`);
            }
            links.push({ id: port, transport, port, sensors });
        }
    }
    for (const link of links) {
        const budget = busBudget(link.sensors, i2cHz);
        if (budget.neededBytesS > budget.availableBytesS) {
            problems.push(`${link.port ? `the board on ${link.port}: ` : ''}the FIFO sensors need ${Math.round(budget.neededBytesS / 1000)} kB/s but a `
                + `${i2cHz / 1000} kHz bus carries about ${Math.round(budget.availableBytesS / 1000)} kB/s of FIFO data - every batch would overrun. `
                + 'Lower odr_hz, drop the gyro, or spread the sensors over another board');
        }
    }
    const ringBytes = parsedSensors.sensors
        .reduce((sum, s) => sum + Math.ceil(s.rateHz * 1.02 * bufferS) * (RING_SAMPLE_BYTES + (s.gyro ? RING_GYRO_BYTES : 0)), 0);
    if (ringBytes > MAX_RING_BYTES) {
        problems.push(`the look-back rings would take ${Math.round(ringBytes / 1048576)} MB (limit ${MAX_RING_BYTES / 1048576} MB): `
            + 'lower mcpVibrationBufferS or the sensors\' rates');
    }
    return {
        enabled: parseFlag(raw.enabled),
        transport,
        python,
        blinkaEnvText,
        blinkaEnv,
        serialPorts,
        links,
        leases,
        i2cHz,
        jobCapture: parseFlag(raw.jobCapture),
        bufferS,
        sensors: parsedSensors.sensors,
        problems,
        sources,
    };
}

/** Rotate a sensor-frame vector into machine axes by a sensor's orientation. */
export function toMachineFrame(orientation: SensorSpec['orientation'], v: [number, number, number]): { x: number; y: number; z: number } | null {
    if (!orientation) {
        return null;
    }
    const out = { x: 0, y: 0, z: 0 };
    orientation.forEach((axis, i) => {
        const key = axis[1] as 'x' | 'y' | 'z';
        out[key] += axis[0] === '-' ? -v[i] : v[i];
    });
    return out;
}

/** The monitor's configuration message (the JSON the Python monitor reads). */
export function monitorConfig(cfg: VibrationConfig, heartbeatMs: number, sensors: SensorSpec[] = cfg.sensors): object {
    return {
        t: 'config',
        i2c_hz: cfg.i2cHz,
        heartbeat_ms: heartbeatMs,
        sensors: sensors.map((sensor) => ({
            id: sensor.id,
            chip: sensor.chip,
            mode: sensor.mode,
            address: sensor.address,
            mux: sensor.mux,
            rate_hz: sensor.rateHz,
            range_g: sensor.rangeG,
            gyro: sensor.gyro,
        })),
    };
}
