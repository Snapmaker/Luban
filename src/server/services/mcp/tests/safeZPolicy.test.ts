import { strict as assert } from 'assert';

import { SAFE_Z_RAISE_POLICY, SAFE_Z_TRAVERSE_POLICY, SafeZPolicyInput, decideSafeZRaise, decideSafeZTraverse, verifiedForPolicy } from '../safeZPolicy';

function input(over: Partial<SafeZPolicyInput> = {}): SafeZPolicyInput {
    return {
        enabled: true,
        reliability: 'heartbeat',
        homed: true,
        currentZ: 327.9989959716797, // the live post-home reading (2026-09-14)
        traverseZ: 328,
        ...over,
    };
}

export const tests: Array<[string, () => void]> = [
    ['the 2026-10-17 case: homed at the traverse height, verified position, setting on -> runs on the call', () => {
        const d = decideSafeZTraverse(input());
        assert.ok(d.allowed);
        assert.equal(d.allowed && d.policy, SAFE_Z_TRAVERSE_POLICY);
        assert.ok(d.reason.includes('>= traverse height 328'));
    }],

    ['the setting off stages exactly as before', () => {
        const d = decideSafeZTraverse(input({ enabled: false }));
        assert.equal(d.allowed, false);
        assert.ok(d.reason.includes('mcpTraverseWithoutApprovalAtSafeZ is off'));
    }],

    ['above the motion floor but below the traverse height (Z325) stays a staged job', () => {
        const d = decideSafeZTraverse(input({ currentZ: 325 }));
        assert.equal(d.allowed, false);
        assert.ok(d.reason.includes('below the traverse height 328'));
    }],

    ['only verified / heartbeat positions qualify: cached-offset, awaiting-resync and stale stage', () => {
        assert.equal(verifiedForPolicy('verified'), true);
        assert.equal(verifiedForPolicy('heartbeat'), true);
        for (const reliability of ['cached-offset', 'awaiting-resync', 'stale'] as const) {
            assert.equal(verifiedForPolicy(reliability), false);
            const d = decideSafeZTraverse(input({ reliability }));
            assert.equal(d.allowed, false, reliability);
            assert.ok(d.reason.includes(reliability));
        }
    }],

    ['unhomed or unknown Z never runs without the page', () => {
        assert.equal(decideSafeZTraverse(input({ homed: false })).allowed, false);
        assert.equal(decideSafeZTraverse(input({ homed: null })).allowed, false);
        assert.equal(decideSafeZTraverse(input({ currentZ: null })).allowed, false);
    }],

    ['a raised traverse height (operator set 340) is honoured: 328 is then below it', () => {
        assert.equal(decideSafeZTraverse(input({ traverseZ: 340 })).allowed, false);
        assert.ok(decideSafeZTraverse(input({ traverseZ: 340, currentZ: 340 })).allowed);
    }],

    ['move_z UP-only to the traverse height runs on the call; the series may climb in steps', () => {
        const d = decideSafeZRaise({ ...input({ currentZ: 205.5 }), machineTargets: [250, 328] });
        assert.ok(d.allowed);
        assert.equal(d.allowed && d.policy, SAFE_Z_RAISE_POLICY);
        assert.ok(d.reason.includes('205.500 -> 328.000'));
    }],

    ['a move_z that dips anywhere, overshoots the top, or does not rise stays staged', () => {
        const down = decideSafeZRaise({ ...input({ currentZ: 328 }), machineTargets: [300] });
        assert.equal(down.allowed, false);
        assert.ok(down.reason.includes('descends'));
        const dip = decideSafeZRaise({ ...input({ currentZ: 205.5 }), machineTargets: [300, 290, 328] });
        assert.equal(dip.allowed, false);
        assert.ok(dip.reason.includes('step 2 descends'));
        const over = decideSafeZRaise({ ...input({ currentZ: 205.5 }), machineTargets: [330] });
        assert.equal(over.allowed, false);
        assert.ok(over.reason.includes('above the traverse height'));
        const flat = decideSafeZRaise({ ...input({ currentZ: 327.9989959716797 }), machineTargets: [328] });
        assert.equal(flat.allowed, false);
        assert.ok(flat.reason.includes('no net rise'));
        assert.equal(decideSafeZRaise({ ...input({ currentZ: 205.5, enabled: false }), machineTargets: [328] }).allowed, false);
        assert.equal(decideSafeZRaise({ ...input({ currentZ: 205.5, reliability: 'cached-offset' }), machineTargets: [328] }).allowed, false);
    }],
];
