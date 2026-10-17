import { strict as assert } from 'assert';
import { normaliseEnclosureStatus, parseEnclosureLevel } from '../enclosure';

export const tests: Array<[string, () => void]> = [
    ['percent or on/off maps to one level, anything else is refused', () => {
        assert.equal(parseEnclosureLevel({ percent: 100 }, 'light'), 100);
        assert.equal(parseEnclosureLevel({ percent: 0 }, 'light'), 0);
        assert.equal(parseEnclosureLevel({ percent: 40 }, 'fan'), 40);
        assert.equal(parseEnclosureLevel({ state: 'on' }, 'light'), 100);
        assert.equal(parseEnclosureLevel({ state: 'OFF' }, 'light'), 0);
        assert.throws(() => parseEnclosureLevel({}, 'light'), /exactly one/);
        assert.throws(() => parseEnclosureLevel({ percent: 50, state: 'on' }, 'light'), /exactly one/);
        assert.throws(() => parseEnclosureLevel({ percent: 101 }, 'light'), /0 to 100/);
        assert.throws(() => parseEnclosureLevel({ percent: 12.5 }, 'light'), /0 to 100/);
        assert.throws(() => parseEnclosureLevel({ percent: 'high' }, 'light'), /0 to 100/);
        assert.throws(() => parseEnclosureLevel({ state: 'dim' }, 'light'), /"on" or "off"/);
    }],
    ['the SSTP module report maps isReady to present and led/fan to percent', () => {
        const online = normaliseEnclosureStatus({ source: 'sstp-http', code: 200, data: { isReady: true, isDoorEnabled: true, led: 100, fan: 0 } });
        assert.deepEqual(online, {
            present: true, light_percent: 100, fan_percent: 0, door_detection: true, door_open: null, source: 'sstp-http', reason: '',
        });
        const absent = normaliseEnclosureStatus({ source: 'sstp-http', code: 200, data: { isReady: false, led: 0, fan: 0 } });
        assert.equal(absent.present, false);
        assert.match(absent.reason, /not ready/);
        const refused = normaliseEnclosureStatus({ source: 'sstp-http', code: 403, msg: 'Forbidden', data: null });
        assert.equal(refused.present, false);
        assert.equal(refused.light_percent, null);
        assert.match(refused.reason, /code 403: Forbidden/);
        const empty = normaliseEnclosureStatus({ source: 'sstp-http', code: 200, data: null });
        assert.equal(empty.present, false);
        assert.match(empty.reason, /no module report/);
    }],
    ['the SACP EnclosureInfo maps moduleStatus 2 to present and testStatus per head', () => {
        const info = normaliseEnclosureStatus({
            source: 'sacp',
            info: {
                moduleStatus: 2,
                ledValue: 100,
                fanlevel: 100,
                testStatus: [{ workType: 0, State: true }, { workType: 2, State: false }],
            },
        });
        assert.equal(info.present, true);
        assert.equal(info.light_percent, 100);
        assert.equal(info.fan_percent, 100);
        assert.equal(info.door_detection, null);
        assert.deepEqual(info.door_detection_by_head, { print: true, laser: null, cnc: false });
        const missing = normaliseEnclosureStatus({ source: 'sacp', info: null });
        assert.equal(missing.present, false);
        assert.match(missing.reason, /no enclosure module/);
        const faulty = normaliseEnclosureStatus({ source: 'sacp', info: { moduleStatus: 1, ledValue: 0, fanlevel: 0 } });
        assert.equal(faulty.present, false);
        assert.match(faulty.reason, /status 1/);
    }],
    ['the serial Marlin settings map enclosureOnline to present and keep the door state', () => {
        const online = normaliseEnclosureStatus({
            source: 'text-serial',
            settings: {
                enclosureOnline: true,
                enclosureLight: 0,
                enclosureFan: 100,
                enclosureDoor: true,
                enclosureDoorDetection: false,
            },
        });
        assert.deepEqual(online, {
            present: true, light_percent: 0, fan_percent: 100, door_detection: false, door_open: true, source: 'text-serial', reason: '',
        });
        const offline = normaliseEnclosureStatus({ source: 'text-serial', settings: { enclosureOnline: false } });
        assert.equal(offline.present, false);
        assert.equal(offline.light_percent, null);
        assert.match(offline.reason, /Enclosure online: Off/);
        assert.equal(normaliseEnclosureStatus({ source: 'text-serial', settings: null }).present, false);
    }],
    ['levels outside 0-100 or non-numeric are clamped or dropped on read', () => {
        const odd = normaliseEnclosureStatus({ source: 'sstp-http', code: 200, data: { isReady: true, led: 255, fan: 'x' as unknown as number } });
        assert.equal(odd.light_percent, 100);
        assert.equal(odd.fan_percent, null);
    }],
];
