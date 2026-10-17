import { strict as assert } from 'assert';

import { CAPTURE_SETTLE_MS } from '../procedureLimits';
import { expandProgramGroups } from '../programGroups';
import {
    CAPTURE_EVENT_BUDGET,
    HOME_EVENT_BUDGET,
    PROGRAM_OP_KINDS,
    captureOpArgs,
    groupableOpKind,
    homeOrderError,
    isProgramOpKind,
    opStationY,
} from '../programOps';

export const tests: Array<[string, () => void]> = [
    ['the op kind list names capture and home beside the probing kinds', () => {
        assert.ok(isProgramOpKind('capture'));
        assert.ok(isProgramOpKind('home'));
        assert.ok(isProgramOpKind('rotate_b'));
        assert.equal(isProgramOpKind('photo'), false);
        assert.equal(isProgramOpKind(undefined), false);
        assert.ok(isProgramOpKind('wall_follow'));
        assert.ok(isProgramOpKind('corner'));
        assert.ok(isProgramOpKind('trace'));
        assert.equal(PROGRAM_OP_KINDS.length, 10);
    }],

    ['home is the one kind a group may not repeat', () => {
        assert.ok(groupableOpKind('capture'));
        assert.ok(groupableOpKind('sequence'));
        assert.equal(groupableOpKind('home'), false);
        assert.equal(groupableOpKind('group'), false);
    }],

    ['capture takes settle_ms (clamped to CAPTURE_SETTLE_MS), a label and an optional viewing x/y, nothing else', () => {
        assert.deepEqual(captureOpArgs({}, 'ops[1]'), { settle_ms: CAPTURE_SETTLE_MS.default, label: null, view: null });
        assert.deepEqual(captureOpArgs({ settle_ms: 99999, label: ' B180 view ' }, 'ops[1]'), { settle_ms: CAPTURE_SETTLE_MS.max, label: 'B180 view', view: null });
        assert.equal(captureOpArgs({ settle_ms: 1200 }, 'ops[1]').settle_ms, 1200);
        assert.deepEqual(captureOpArgs({ x: 140, y: '200' }, 'ops[1]').view, { x: 140, y: 200 });
        assert.throws(() => captureOpArgs({ x: 140 }, 'ops[1]'), /BOTH x and y/);
        assert.throws(() => captureOpArgs({ x: 140, y: 'abc' }, 'ops[1]'), /BOTH x and y/);
        assert.throws(() => captureOpArgs({ z: 300 }, 'ops[1]'), /unknown argument\(s\) z/);
    }],

    ['a home op anywhere but last is refused, naming its index and what follows', () => {
        assert.equal(homeOrderError(['sequence', 'rotate_b', 'capture']), null);
        assert.equal(homeOrderError(['sequence', 'capture', 'home']), null);
        const err = homeOrderError(['home', 'sequence', 'capture']);
        assert.ok(err && err.includes('ops[0] (home)') && err.includes('2 op(s) follow it'));
        assert.ok(homeOrderError(['sequence', 'home', 'home']));
    }],

    ['the look-rotate-look program is one approval: capture from (x, y), rotate, capture, home', () => {
        // The exact shape the operator asked for on 2026-09-21; every kind exists and the order is legal.
        // The transit is the first capture's viewing position: a hop-only sequence is refused as pure motion.
        const kinds = ['capture', 'rotate_b', 'capture', 'home'];
        assert.ok(kinds.every(isProgramOpKind));
        assert.deepEqual(captureOpArgs({ x: 140, y: 200, label: 'B0' }, 'ops[0]').view, { x: 140, y: 200 });
        assert.equal(homeOrderError(kinds), null);
        assert.ok(CAPTURE_EVENT_BUDGET < HOME_EVENT_BUDGET);
    }],

    ['a capture inside a group is repeated per angle with the _b suffix, like any inner op', () => {
        const { ops } = expandProgramGroups([
            { id: 'look', kind: 'group', for_b: [0, 180], ops: [{ id: 'shot', kind: 'capture', label: `B ${['$', '{b}'].join('')}` }] },
        ]);
        assert.deepEqual(ops.map((o) => (o as { id: string }).id), ['look_rot_b0', 'shot_b0', 'look_rot_b180', 'shot_b180']);
        assert.equal((ops[3] as { label: string }).label, 'B 180');
        // A home inside a group would be expanded twice, so it can never be last: the order rule catches it.
        const homed = expandProgramGroups([{ id: 'g', kind: 'group', for_b: [0, 90], ops: [{ id: 'h', kind: 'home' }] }]);
        assert.ok(homeOrderError(homed.ops.map((o) => String((o as { kind: string }).kind))));
    }],

    // Issue #155: the Y the runner evaluates a skewed axis at, per op kind.
    ['opStationY reads each kind\'s own Y arguments and names where it came from', () => {
        assert.deepEqual(opStationY('surface_path', { start_y: 100, end_y: 200 }), { y: 150, note: 'mid of start_y..end_y' });
        assert.deepEqual(opStationY('surface_grid', { y_min: 135, y_max: 260 }), { y: 197.5, note: 'mid of y_min..y_max' });
        assert.deepEqual(opStationY('stock_outline', { center_y: 180 }), { y: 180, note: 'center_y' });
        assert.deepEqual(opStationY('wall_follow', { start_y: 90 }), { y: 90, note: 'start_y' });
        assert.deepEqual(opStationY('trace', { start_y: 91 }), { y: 91, note: 'start_y' });
        assert.deepEqual(opStationY('corner', { wall_a: { y: 100 }, wall_b: { y: 110 } }), { y: 105, note: 'mid of wall_a.y and wall_b.y' });
        assert.deepEqual(opStationY('capture', { x: 10, y: 20 }), { y: 20, note: 'viewing position y' });
    }],

    ['opStationY for a sequence is the hops\' Y - one value, or the mean with the spread named', () => {
        const steps = [{ kind: 'hop', x: 150, y: 200 }, { kind: 'descend', z: 250 }, { kind: 'probe', name: 'west', direction: '+x' }];
        assert.deepEqual(opStationY('sequence', { steps }), { y: 200, note: 'the hops\' Y' });
        const two = [{ kind: 'hop', x: 150, y: 200 }, { kind: 'hop', x: 190, y: 210 }];
        assert.deepEqual(opStationY('sequence', { steps: two }), { y: 205, note: 'mean of 2 hop Y values (200..210)' });
        assert.equal(opStationY('sequence', { steps: [{ kind: 'descend', z: 250 }] }), null);
    }],

    ['opStationY is null when the kind has no Y of its own or the arguments do not carry one yet', () => {
        assert.equal(opStationY('rotate_b', { b: 90 }), null);
        assert.equal(opStationY('home', {}), null);
        assert.equal(opStationY('capture', {}), null);
        assert.equal(opStationY('surface_path', { start_y: 100 }), null);
        // An unresolved reference is an object, not a Y.
        assert.equal(opStationY('stock_outline', { center_y: { from: 's0.end.y', between: [0, 300] } }), null);
        assert.equal(opStationY('surface_path', { start_y: 'abc', end_y: 200 }), null);
    }],
];
