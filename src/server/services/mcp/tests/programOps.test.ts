import { strict as assert } from 'assert';

import { ObstacleBox, checkMotion } from '../envelopeChecks';
import { CAPTURE_SETTLE_MS, DESCENT_SEGMENT_MM, MAX_STATED_MACHINE_Z_MM } from '../procedureLimits';
import { expandProgramGroups } from '../programGroups';
import {
    CAPTURE_EVENT_BUDGET,
    HOME_EVENT_BUDGET,
    PROGRAM_OP_KINDS,
    captureMotion,
    captureOpArgs,
    groupableOpKind,
    homeOrderError,
    isProgramOpKind,
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

    ['capture takes settle_ms (clamped to CAPTURE_SETTLE_MS), a label, an optional viewing x/y and an optional z, nothing else', () => {
        const noDescent = { descent_segment_mm: DESCENT_SEGMENT_MM.default, descent_segment_requested_mm: null };
        assert.deepEqual(captureOpArgs({}, 'ops[1]'), { settle_ms: CAPTURE_SETTLE_MS.default, label: null, view: null, z: null, ...noDescent });
        assert.deepEqual(captureOpArgs({ settle_ms: 99999, label: ' B180 view ' }, 'ops[1]'), { settle_ms: CAPTURE_SETTLE_MS.max, label: 'B180 view', view: null, z: null, ...noDescent });
        assert.equal(captureOpArgs({ settle_ms: 1200 }, 'ops[1]').settle_ms, 1200);
        assert.deepEqual(captureOpArgs({ x: 140, y: '200' }, 'ops[1]').view, { x: 140, y: 200 });
        assert.throws(() => captureOpArgs({ x: 140 }, 'ops[1]'), /BOTH x and y/);
        assert.throws(() => captureOpArgs({ x: 140, y: 'abc' }, 'ops[1]'), /BOTH x and y/);
        assert.throws(() => captureOpArgs({ settle: 300 }, 'ops[1]'), /unknown argument\(s\) settle/);
    }],

    ['issue #177: capture z is a stated toolhead machine Z - finite, inside the sanity range, never coerced from junk', () => {
        assert.equal(captureOpArgs({ z: 210.5 }, 'ops[1]').z, 210.5);
        assert.equal(captureOpArgs({ z: '210.5' }, 'ops[1]').z, 210.5);
        assert.equal(captureOpArgs({ z: null }, 'ops[1]').z, null);
        assert.deepEqual(captureOpArgs({ x: 140, y: 200, z: 0 }, 'ops[1]'), {
            settle_ms: CAPTURE_SETTLE_MS.default,
            label: null,
            view: { x: 140, y: 200 },
            z: 0,
            descent_segment_mm: DESCENT_SEGMENT_MM.default,
            descent_segment_requested_mm: null,
        });
        for (const bad of ['abc', -1, MAX_STATED_MACHINE_Z_MM + 1, true, '', Number.NaN]) {
            assert.throws(() => captureOpArgs({ z: bad }, 'ops[1]'), /z must be a toolhead MACHINE Z/, String(bad));
        }
    }],

    ['issue #166: a capture descent may state descent_segment_mm (1-5); a clip is reported, and it needs a z', () => {
        const two = captureOpArgs({ z: 210, descent_segment_mm: 2 }, 'ops[1]');
        assert.equal(two.descent_segment_mm, 2);
        assert.equal(two.descent_segment_requested_mm, null, 'not a clip');
        const clipped = captureOpArgs({ z: 210, descent_segment_mm: 12 }, 'ops[1]');
        assert.equal(clipped.descent_segment_mm, DESCENT_SEGMENT_MM.max, 'the cap never rises');
        assert.equal(clipped.descent_segment_requested_mm, 12, 'the clip is reported');
        assert.equal(captureOpArgs({ z: 210, descent_segment_mm: 0.2 }, 'ops[1]').descent_segment_mm, DESCENT_SEGMENT_MM.min);
        assert.throws(() => captureOpArgs({ descent_segment_mm: 2 }, 'ops[1]'), /needs a z/);
    }],

    ['the capture motion list is the hop and the column the envelope check sees; a column into a keep-out volume is refused', () => {
        const from = { x: -19, y: 342, z: 328 };
        // The chuck jaws as a program keep_out: a VOLUME nothing enters.
        const jaws: ObstacleBox = { name: 'chuck jaws', machine: { x0: 150, y0: 269, x1: 190, y1: 310 }, clearanceZ: 250, mode: 'volume' };
        assert.deepEqual(captureMotion({ view: null, z: null }, from, 328), [], 'a capture that moves nothing');
        const hopOnly = captureMotion({ view: { x: 170, y: 100 }, z: null }, from, 328);
        assert.deepEqual(hopOnly.map((m) => m.kind), ['hop']);
        assert.deepEqual(checkMotion(hopOnly, [jaws]), [], 'the hop runs at the traverse height');
        const hopAndColumn = captureMotion({ view: { x: 170, y: 290 }, z: 230 }, from, 328);
        assert.deepEqual(hopAndColumn.map((m) => m.kind), ['hop', 'column']);
        assert.deepEqual(hopAndColumn[1].from, { x: 170, y: 290, z: 328 });
        assert.deepEqual(hopAndColumn[1].to, { x: 170, y: 290, z: 230 });
        const violations = checkMotion(hopAndColumn, [jaws]);
        assert.equal(violations.length, 1, 'the column into the jaws is the violation');
        assert.equal(violations[0].obstacle, 'chuck jaws');
        assert.ok(violations[0].what.includes('descend column'), violations[0].what);
        const columnOnly = captureMotion({ view: null, z: 230 }, { x: 60, y: 60, z: 328 }, 328);
        assert.deepEqual(columnOnly.map((m) => m.kind), ['column']);
        assert.deepEqual(columnOnly[0].to, { x: 60, y: 60, z: 230 }, 'without a view the column stands where the head is');
        assert.deepEqual(checkMotion(columnOnly, [jaws]), []);
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
];
