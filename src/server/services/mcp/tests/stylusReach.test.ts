import { strict as assert } from 'assert';

import { STYLUS_REACH_MARGIN_MM } from '../procedureLimits';
import {
    STYLUS_REACH_UNKNOWN_TEXT,
    checkStylusReach,
    describeStylusReach,
    parseReachMargin,
    parseRimZ,
} from '../stylusReach';

// Issue #187: a floor probe of a pocket deeper than the stylus. The fitted
// probe in the incident: ~21 mm of stylus below a ~10 mm body, 2.5 mm ball;
// the pocket rim was touched at toolhead Z210 and the floor was planned ~25
// mm lower.
const fitted = { reachMm: 21, tipDiameterMm: 2.5, marginMm: 2 };

export const tests: Array<[string, () => void]> = [
    ['a floor deeper than reach - ball - margin below the stated rim is refused with the numbers', () => {
        const v = checkStylusReach({ ...fitted, rimZMachine: 210, deepestZMachine: 185 });
        assert.equal(v.status, 'refused');
        if (v.status !== 'refused') return;
        assert.equal(v.depthBelowRimMm, 25);
        assert.equal(v.allowedDepthMm, 16.5);
        assert.equal(v.bodyFloorZMachine, 193.5);
        assert.match(v.note, /25 mm below the stated rim Z210/);
        assert.match(v.note, /reach 21 - ball 2.5 - margin 2 = 16.5 mm/);
        assert.match(v.note, /below toolhead Z193.5 the body lands on the rim/);
    }],

    ['a contact exactly at the allowed depth passes; one fine step deeper is refused', () => {
        assert.equal(checkStylusReach({ ...fitted, rimZMachine: 210, deepestZMachine: 193.5 }).status, 'ok');
        assert.equal(checkStylusReach({ ...fitted, rimZMachine: 210, deepestZMachine: 193.4 }).status, 'refused');
    }],

    ['a march that never goes below the rim is fine whatever the reach', () => {
        const v = checkStylusReach({ reachMm: 5, tipDiameterMm: 2, marginMm: 2, rimZMachine: 210, deepestZMachine: 212 });
        assert.equal(v.status, 'ok');
        if (v.status !== 'ok') return;
        assert.equal(v.depthBelowRimMm, -2);
    }],

    ['an unknown tip diameter is taken as 0 and said so, never silently', () => {
        const v = checkStylusReach({ reachMm: 21, tipDiameterMm: null, marginMm: 2, rimZMachine: 210, deepestZMachine: 192 });
        assert.equal(v.status, 'ok');
        if (v.status !== 'ok') return;
        assert.equal(v.allowedDepthMm, 19);
        assert.match(v.note, /ball 0 \(tip diameter unknown\)/);
    }],

    ['no stored reach: the verdict says "stylus reach unknown: body collision not checked" whether or not a rim was stated', () => {
        const withRim = checkStylusReach({ reachMm: null, tipDiameterMm: 2.5, marginMm: 2, rimZMachine: 210, deepestZMachine: 185 });
        assert.equal(withRim.status, 'reach-unknown');
        assert.ok(withRim.note.startsWith(STYLUS_REACH_UNKNOWN_TEXT));
        assert.match(withRim.note, /25 mm below the stated rim Z210/);
        assert.match(withRim.note, /set_probe_geometry probe_stylus_exposed_mm/);
        if (withRim.status === 'reach-unknown') {
            assert.equal(withRim.depthBelowRimMm, 25);
        }
        const noRim = checkStylusReach({ reachMm: null, tipDiameterMm: null, marginMm: 2, rimZMachine: null, deepestZMachine: 185 });
        assert.equal(noRim.status, 'reach-unknown');
        assert.ok(noRim.note.startsWith(STYLUS_REACH_UNKNOWN_TEXT));
        assert.match(describeStylusReach(noRim), /^; STYLUS REACH: stylus reach unknown: body collision not checked/);
    }],

    ['reach stored but no rim stated: not refused, the note asks for rim_z_machine inside a pocket', () => {
        const v = checkStylusReach({ ...fitted, rimZMachine: null, deepestZMachine: 100 });
        assert.equal(v.status, 'rim-unknown');
        assert.match(v.note, /no rim_z_machine stated/);
        assert.match(v.note, /surface_z_machine/);
    }],

    ['parseRimZ reads rim_z_machine or its alias surface_z_machine, refuses a contradiction and nonsense', () => {
        assert.equal(parseRimZ({}), null);
        assert.equal(parseRimZ({ rim_z_machine: 210 }), 210);
        assert.equal(parseRimZ({ surface_z_machine: '210.5' }), 210.5);
        assert.equal(parseRimZ({ rim_z_machine: 210, surface_z_machine: 210 }), 210);
        assert.throws(() => parseRimZ({ rim_z_machine: 210, surface_z_machine: 205 }), /disagree/);
        assert.throws(() => parseRimZ({ rim_z_machine: 'abc' }), /rim_z_machine must be/);
        assert.throws(() => parseRimZ({ rim_z_machine: -1 }), /rim_z_machine must be/);
        assert.throws(() => parseRimZ({ surface_z_machine: 900 }), /surface_z_machine must be/);
        assert.equal(parseRimZ({ rim_z_machine: null, surface_z_machine: '' }), null);
    }],

    ['parseReachMargin defaults to the named limit, clamps, and honours an explicit 0', () => {
        assert.equal(parseReachMargin({}), STYLUS_REACH_MARGIN_MM.default);
        assert.equal(parseReachMargin({ reach_margin_mm: 50 }), STYLUS_REACH_MARGIN_MM.max);
        assert.equal(parseReachMargin({ reach_margin_mm: 0 }), 0);
        assert.equal(parseReachMargin({ reach_margin_mm: 1.5 }), 1.5);
        // With margin 0 the allowed depth is reach - ball exactly.
        const v = checkStylusReach({ reachMm: 21, tipDiameterMm: 2.5, marginMm: 0, rimZMachine: 210, deepestZMachine: 191.5 });
        assert.equal(v.status, 'ok');
    }],
];
