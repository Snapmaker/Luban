import { strict as assert } from 'assert';

import { ROTATE_FEED, ROTATION_PLAUSIBILITY_FRACTION, judgeRotation, rotationDurationMs } from '../rotaryMotion';

export const tests: Array<[string, () => void]> = [
    ['a 180 degree turn at F600 needs 18 s', () => {
        assert.equal(rotationDurationMs(180, 600), 18000);
        assert.equal(rotationDurationMs(-90, 600), 9000);
        assert.equal(rotationDurationMs(90, 0), 0);
        assert.equal(ROTATE_FEED, 600);
    }],

    ['the 2026-09-21 hardware case: "ok" + B:180 after 219 ms is NOT a finished rotation', () => {
        const j = judgeRotation(0, 180, 219);
        assert.equal(j.plausible, false);
        assert.equal(j.expectedMs, 18000);
        assert.equal(j.remainingMs, Math.ceil(18000 * ROTATION_PLAUSIBILITY_FRACTION - 219));
        assert.ok(j.note.includes('buffered target'));
    }],

    ['once 80 % of the physical time has passed the echo may be believed', () => {
        assert.equal(judgeRotation(0, 180, 14400).plausible, true);
        assert.equal(judgeRotation(0, 180, 14399).plausible, false);
        assert.equal(judgeRotation(90, 180, 7200).plausible, true);
    }],

    ['an unknown start angle is judged as the worst case, 180 degrees', () => {
        const j = judgeRotation(null, 45, 5000);
        assert.equal(j.plausible, false);
        assert.equal(j.expectedMs, 18000);
        assert.ok(j.note.includes('start angle unknown'));
    }],

    ['tiny corrections skip the timing test', () => {
        assert.equal(judgeRotation(180, 180.5, 10).plausible, true);
        assert.equal(judgeRotation(0, 0, 0).plausible, true);
    }],
];
