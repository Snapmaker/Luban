import { strict as assert } from 'assert';

import {
    DEGRADED_AFTER_MS,
    EMPTY_PROGRESS,
    FeedHealthInput,
    describeFeedHealth,
    describeReadyTimeout,
} from '../probeFeedHealth';

const PYTHON = '/home/pi/dev/Luban/.venv/bin/python';
const ENV = 'BLINKA_U2IF=1';

function health(over: Partial<FeedHealthInput> = {}): FeedHealthInput {
    return {
        configured: true,
        connected: false,
        connecting: false,
        disabledSensors: [],
        downForMs: 30_000,
        reconnectAttempts: 3,
        lastError: 'the bridge stopped answering.',
        ...over,
    };
}

export const tests: Array<[string, () => void]> = [
    // The 2026-09-19 fault: the bridge enumerated, Blinka loaded, and the
    // first pin never came back. "No ready line" was true of that AND of a
    // missing interpreter, and only one of them is fixed by replugging.
    ['a leaked libusb claim is named as one, and is fixed without a replug', () => {
        const text = describeReadyTimeout(
            { stage: 'imported', board: 'KB2040_U2IF', pinsDone: [], stuckOn: 'toolsetter' },
            30_000, PYTHON, ENV
        );
        assert.ok(/KB2040_U2IF/.test(text), 'names the board that answered');
        assert.ok(/LEAKED CLAIM/.test(text), 'names the actual mechanism');
        assert.ok(/Driver=\[none\] instead of Driver=usbhid/.test(text), 'gives the signature to look for');
        assert.ok(/resets the bridge on the USB bus and retries by itself/.test(text),
            'the recovery is automatic - a replug is the LAST resort, not the first');
        assert.ok(!/pip install/.test(text), 'does not send you off to reinstall Blinka');
    }],

    ['nothing at all arrived: that is the interpreter or the install, not the board', () => {
        const text = describeReadyTimeout(EMPTY_PROGRESS, 30_000, PYTHON, ENV);
        assert.ok(/produced nothing/.test(text));
        assert.ok(new RegExp(PYTHON.replace(/[/\\]/g, '.')).test(text), 'quotes the interpreter it used');
        assert.ok(/adafruit-blinka/.test(text));
        assert.ok(/BLINKA_U2IF=1/.test(text), 'quotes the Blinka env, which is the other half of the guess');
        assert.ok(!/replug/i.test(text), 'replugging fixes nothing when Blinka never loaded');
    }],

    ['stopping part way through the pins names the pin it stopped on', () => {
        const text = describeReadyTimeout(
            { stage: 'pin', board: 'KB2040_U2IF', pinsDone: ['toolsetter', 'overtravel'], stuckOn: 'probe' },
            30_000, PYTHON, ENV
        );
        assert.ok(/toolsetter, overtravel/.test(text), 'says what did work');
        assert.ok(/probe/.test(text), 'and what did not');
        assert.ok(/mis-named/.test(text), 'offers the other likely cause - a bad pin name');
    }],

    // The half nobody saw: the feed was down for eighteen minutes and said so
    // only to a log file and to a boolean in a forty-field object.
    ['a down feed says so in a sentence, with how long and what it blocks', () => {
        const h = describeFeedHealth(health({ downForMs: 18 * 60 * 1000, reconnectAttempts: 14 }));
        assert.equal(h.ok, false);
        assert.equal(h.degraded, true);
        assert.ok(/PROBE FEED DOWN for 18 min/.test(h.note), h.note);
        assert.ok(/14 attempts/.test(h.note));
        assert.ok(/will refuse until it is back/.test(h.note), 'says what it costs');
        assert.ok(/overtravel tripwire cannot be armed/.test(h.note), 'says why that matters');
        assert.ok(/nothing needs restarting/.test(h.note), 'and that the fix is physical, not a restart');
    }],

    ['a brief outage is not yet degraded - it may simply be coming back', () => {
        assert.equal(describeFeedHealth(health({ downForMs: DEGRADED_AFTER_MS - 1 })).degraded, false);
        assert.equal(describeFeedHealth(health({ downForMs: DEGRADED_AFTER_MS })).degraded, true);
    }],

    ['a healthy feed says so briefly, and names sensors the operator turned off', () => {
        const up = describeFeedHealth(health({ connected: true }));
        assert.equal(up.ok, true);
        assert.equal(up.degraded, false);
        assert.equal(up.note, 'Probe feed connected.');

        const partly = describeFeedHealth(health({ connected: true, disabledSensors: ['overtravel'] }));
        assert.ok(/Disabled by the operator: overtravel/.test(partly.note));
    }],

    ['connecting is not a fault, and neither is having no feed configured', () => {
        assert.equal(describeFeedHealth(health({ connecting: true })).ok, true);
        const none = describeFeedHealth(health({ configured: false }));
        assert.equal(none.ok, true);
        assert.ok(/No probe feed is configured/.test(none.note));
        assert.ok(/will refuse/.test(none.note), 'still says what it costs');
    }],

    ['seconds, minutes and hours all read as English', () => {
        assert.ok(/for 45 s/.test(describeFeedHealth(health({ downForMs: 45_000 })).note));
        assert.ok(/for 18 min/.test(describeFeedHealth(health({ downForMs: 18 * 60_000 })).note));
        assert.ok(/for 2 h 5 min/.test(describeFeedHealth(health({ downForMs: 125 * 60_000 })).note));
    }],
];
