import { strict as assert } from 'assert';

import { MoveZPlanError, describeFeedClamps, resolveZTargets } from '../moveZPlan';
import { MAX_Z_TARGETS, MOVE_Z_FEED, clampReported } from '../procedureLimits';

export const tests: Array<[string, () => void]> = [
    ['clampReported says what it clipped and treats absent / zero / junk as the default, not a clip', () => {
        assert.deepEqual(clampReported(undefined, MOVE_Z_FEED), { value: 300, requested: null, clipped: false });
        assert.deepEqual(clampReported(0, MOVE_Z_FEED), { value: 300, requested: null, clipped: false });
        assert.deepEqual(clampReported('abc', MOVE_Z_FEED), { value: 300, requested: null, clipped: false });
        assert.deepEqual(clampReported(400, MOVE_Z_FEED), { value: 400, requested: 400, clipped: false });
        assert.deepEqual(clampReported(900, MOVE_Z_FEED), { value: 600, requested: 900, clipped: true });
        assert.deepEqual(clampReported('10', MOVE_Z_FEED), { value: 50, requested: 10, clipped: true });
    }],

    ['plain numbers still work: one feed for the whole series, nothing clamped', () => {
        const plan = resolveZTargets({ z_targets: [191.456, 181.456], feed_rate: 400 });
        assert.deepEqual(plan.steps.map((s) => [s.z, s.feedRate, s.requestedFeedRate]), [[191.456, 400, null], [181.456, 400, null]]);
        assert.equal(plan.defaultFeed, 400);
        assert.deepEqual(plan.clamps, []);
        const single = resolveZTargets({ z: 328 });
        assert.deepEqual(single.steps, [{ z: 328, feedRate: MOVE_Z_FEED.default, requestedFeedRate: null }]);
    }],

    ['issue #240: "F400 to 10 mm above, then F60 for the last 10 mm" is one series with a feed per step', () => {
        const plan = resolveZTargets({ z_targets: [{ z: 191.456, feed_rate: 400 }, { z: 181.456, feed_rate: 60 }] });
        assert.deepEqual(plan.steps, [
            { z: 191.456, feedRate: 400, requestedFeedRate: 400 },
            { z: 181.456, feedRate: 60, requestedFeedRate: 60 },
        ]);
        assert.deepEqual(plan.clamps, []);
    }],

    ['objects and numbers mix; a step without its own feed inherits the call feed', () => {
        const plan = resolveZTargets({ z_targets: [{ z: 200 }, 190, { z: 185, feed_rate: 60 }], feed_rate: 500 });
        assert.deepEqual(plan.steps.map((s) => s.feedRate), [500, 500, 60]);
        assert.deepEqual(plan.steps.map((s) => s.requestedFeedRate), [null, null, 60]);
    }],

    ['every feed is clamped into MOVE_Z_FEED and every clip is reported with its step', () => {
        const plan = resolveZTargets({ z_targets: [{ z: 200, feed_rate: 1200 }, { z: 190, feed_rate: 20 }, 180], feed_rate: 900 });
        assert.deepEqual(plan.steps.map((s) => s.feedRate), [MOVE_Z_FEED.max, MOVE_Z_FEED.min, MOVE_Z_FEED.max]);
        assert.deepEqual(plan.clamps, [
            { step: 0, requested: 900, applied: 600 },
            { step: 1, requested: 1200, applied: 600 },
            { step: 2, requested: 20, applied: 50 },
        ]);
        const lines = describeFeedClamps(plan.clamps);
        assert.equal(lines.length, 3);
        assert.ok(lines[0].startsWith('feed_rate 900 is outside 50-600'), lines[0]);
        assert.ok(lines[1].startsWith('step 1 feed_rate 1200'), lines[1]);
        assert.ok(lines[2].includes('clamped to F50'), lines[2]);
        assert.deepEqual(describeFeedClamps([]), []);
    }],

    ['malformed entries are refused by name, never coerced', () => {
        assert.throws(() => resolveZTargets({}), MoveZPlanError);
        assert.throws(() => resolveZTargets({ z: 1, z_targets: [2] }), /exactly one/);
        assert.throws(() => resolveZTargets({ z_targets: [] }), /1-20/);
        assert.throws(() => resolveZTargets({ z_targets: new Array(MAX_Z_TARGETS + 1).fill(1) }), /1-20/);
        assert.throws(() => resolveZTargets({ z_targets: ['abc'] }), /z_targets\[0\]/);
        assert.throws(() => resolveZTargets({ z_targets: [{ feed_rate: 60 }] }), /z must be a finite/);
        assert.throws(() => resolveZTargets({ z_targets: [{ z: 10, feed_rate: 0 }] }), /feed_rate must be a positive/);
        assert.throws(() => resolveZTargets({ z_targets: [{ z: 10, feed_rate: -5 }] }), /feed_rate must be a positive/);
        assert.throws(() => resolveZTargets({ z_targets: [{ z: 10, feed: 60 }] }), /unknown key\(s\) feed/);
        assert.throws(() => resolveZTargets({ z_targets: [null] }), /z_targets\[0\]/);
        assert.throws(() => resolveZTargets({ z: 'x' }), /z_targets\[0\]/);
    }],
];
