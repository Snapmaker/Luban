import { strict as assert } from 'assert';

import {
    SAFE_Z_RAISE_POLICY,
    SAFE_Z_TRAVERSE_POLICY,
    SafeZPolicyInput,
    decideSafeZRaise,
    decideSafeZTraverse,
    setLandmarkReviewProvider,
    verifiedForPolicy,
} from '../safeZPolicy';

function input(over: Partial<SafeZPolicyInput> = {}): SafeZPolicyInput {
    return {
        enabled: true,
        reliability: 'heartbeat',
        homed: true,
        currentZ: 327.9989959716797, // the live post-home reading (2026-09-14)
        traverseZ: 328,
        landmarksConfirmed: true,
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
        assert.ok(d.reason.includes('without approval is off (Settings > MCP > Motion rules)'));
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

    // ---- The Ray (#260 follow-up): no Z axis, so no "safe height" to justify skipping the click ----
    ['a machine with no Z axis never auto-executes a traverse: it stages, and the reason says why', () => {
        const d = decideSafeZTraverse(input({ currentZ: 0, hasZ: false }));
        assert.equal(d.allowed, false);
        assert.match(d.reason, /no Z axis/);
        assert.match(d.reason, /staged for the operator's click/);
        assert.ok(!d.reason.includes('move_z'), 'never suggests raising an axis that does not exist');
        // Even a Z that would qualify on an A350 does not qualify without a Z axis.
        assert.equal(decideSafeZTraverse(input({ currentZ: 328, hasZ: false })).allowed, false);
        assert.equal(decideSafeZRaise({ ...input({ currentZ: 0, hasZ: false }), machineTargets: [10] }).allowed, false);
        // hasZ omitted or true: the A350 decision is unchanged.
        assert.equal(decideSafeZTraverse(input({ hasZ: true })).allowed, true);
        assert.equal(decideSafeZTraverse(input()).allowed, true);
    }],

    // ---- WP5 landmark review: auto-execute needs the operator's confirmation, never refuses for it ----
    ['unconfirmed landmarks: the top-Z traverse and raise are STAGED, with the review question in the reason', () => {
        setLandmarkReviewProvider(() => ({ confirmed: false, status: 'legacy-basis', question: 'Is this what is on the bed right now?' }));
        try {
            const { landmarksConfirmed, ...rest } = input();
            assert.equal(landmarksConfirmed, true);
            const d = decideSafeZTraverse(rest);
            assert.equal(d.allowed, false);
            assert.match(d.reason, /not confirmed this machine's landmarks \(landmark_review legacy-basis\)/);
            assert.match(d.reason, /staged for the operator's click/);
            assert.match(d.reason, /Is this what is on the bed right now\?/);
            assert.match(d.reason, /confirm_landmarks/);
            assert.equal(decideSafeZRaise({ ...rest, currentZ: 205.5, machineTargets: [328] }).allowed, false);
            // An explicit input wins over the provider.
            assert.equal(decideSafeZTraverse(input({ landmarksConfirmed: false })).allowed, false);
            // An earlier reason keeps its own text: the review is checked last.
            assert.match(decideSafeZTraverse({ ...rest, enabled: false }).reason, /without approval is off/);
        } finally {
            setLandmarkReviewProvider(null);
        }
    }],
    ['confirmed landmarks on the A350 at top Z: runs on the call exactly as before; no provider at all reads as unconfirmed', () => {
        setLandmarkReviewProvider(() => ({ confirmed: true, status: 'confirmed', question: null }));
        try {
            const { landmarksConfirmed, ...rest } = input();
            assert.equal(landmarksConfirmed, true);
            const d = decideSafeZTraverse(rest);
            assert.ok(d.allowed);
            assert.equal(d.allowed && d.policy, SAFE_Z_TRAVERSE_POLICY);
            assert.equal(decideSafeZRaise({ ...rest, currentZ: 205.5, machineTargets: [328] }).allowed, true);
        } finally {
            setLandmarkReviewProvider(null);
        }
        const { landmarksConfirmed, ...rest } = input();
        assert.equal(landmarksConfirmed, true);
        const fallback = decideSafeZTraverse(rest);
        assert.equal(fallback.allowed, false);
        assert.match(fallback.reason, /landmark_review unknown/);
        setLandmarkReviewProvider(() => { throw new Error('store unreadable'); });
        try {
            assert.match(decideSafeZTraverse(rest).reason, /could not be read \(store unreadable\)/);
        } finally {
            setLandmarkReviewProvider(null);
        }
    }],
    ['WP8: a staged reason names the Motion rules toggle (gatedBy), never the old config key', () => {
        const gatedBy = 'enable \'Move at safe top Z without approval\' for Snapmaker 2.0 A250 in Settings > MCP > Motion rules to move at safe top Z without approval';
        const d = decideSafeZTraverse(input({ enabled: false, gatedBy }));
        assert.ok(!d.allowed);
        assert.ok(d.reason.startsWith(gatedBy), d.reason);
        assert.ok(!d.reason.includes('mcpTraverseWithoutApprovalAtSafeZ'));
        const raise = decideSafeZRaise({ ...input({ enabled: false, gatedBy }), machineTargets: [328] });
        assert.ok(!raise.allowed && raise.reason.includes('Motion rules'));
        assert.ok(!decideSafeZTraverse(input({ enabled: false })).reason.includes('mcpTraverseWithoutApprovalAtSafeZ'));
    }],
    ['WP8: the unconfirmed-review reason no longer claims the job click confirms the review', () => {
        const d = decideSafeZTraverse(input({ landmarksConfirmed: false }));
        assert.ok(!d.allowed);
        assert.ok(d.reason.includes('it does not confirm the review'), d.reason);
        assert.ok(!d.reason.includes('also answers the review'));
    }],
];
