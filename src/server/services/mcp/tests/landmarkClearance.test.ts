import { strict as assert } from 'assert';

import {
    CLEARANCE_BASES,
    CLEARANCE_MARGIN_MM,
    LEGACY_CLEARANCE_BASIS,
    needsRestatement,
    normaliseClearanceBasis,
    requiredToolheadZ,
    restatementAdvice,
} from '../landmarkClearance';

export const tests: Array<[string, () => void]> = [
    // B1: a record written before the basis existed means what it meant then.
    // Re-reading 328 as a physical height would demand a toolhead Z of 400.
    ['a stored record with no basis is the legacy toolhead height', () => {
        assert.equal(normaliseClearanceBasis(undefined), 'toolhead');
        assert.equal(normaliseClearanceBasis(null), 'toolhead');
        assert.equal(LEGACY_CLEARANCE_BASIS, 'toolhead');
    }],

    ['only the exact string "physical" opts a record into the new meaning', () => {
        assert.equal(normaliseClearanceBasis('physical'), 'physical');
        assert.equal(normaliseClearanceBasis('toolhead'), 'toolhead');
        // Anything unrecognised falls back to the cautious reading, never the new one.
        assert.equal(normaliseClearanceBasis('Physical'), 'toolhead');
        assert.equal(normaliseClearanceBasis(''), 'toolhead');
        assert.equal(normaliseClearanceBasis(0), 'toolhead');
        assert.equal(normaliseClearanceBasis({ basis: 'physical' }), 'toolhead');
    }],

    ['both bases are enumerated for the tools that offer the choice', () => {
        assert.deepEqual(CLEARANCE_BASES, ['toolhead', 'physical']);
    }],

    ['an obstacle still on the legacy basis is the one that wants re-stating', () => {
        assert.equal(needsRestatement(328, 'toolhead'), true);
        assert.equal(needsRestatement(250, 'physical'), false);
        // Not an obstacle at all: nothing to re-state.
        assert.equal(needsRestatement(null, 'toolhead'), false);
        assert.equal(needsRestatement(null, 'physical'), false);
    }],

    ['the advice says what to do and that nothing changed meanwhile', () => {
        const advice = restatementAdvice('rotary-axis', 328);
        assert.ok(/rotary-axis/.test(advice));
        assert.ok(/328/.test(advice));
        assert.ok(/obstacle_top_z/.test(advice), 'names the argument to use');
        assert.ok(/enforced exactly as before/.test(advice), 'says the old number is still in force');
    }],

    // B3: what toolhead Z an obstacle actually demands.
    ['a legacy clearance IS the toolhead height - nothing is added to it', () => {
        // The rotary-axis landmark as stored: 328, with a probe already in it.
        assert.equal(requiredToolheadZ(328, 'toolhead', 73, 5), 328);
        assert.equal(requiredToolheadZ(328, 'toolhead', null, 5), 328, 'and it needs no tool length to be judged');
    }],

    ['a physical clearance adds the tool and the margin', () => {
        assert.equal(requiredToolheadZ(250, 'physical', 73, 5), 328, 'the probe reproduces the old ceiling');
        assert.equal(requiredToolheadZ(250, 'physical', 2, 5), 257, 'an engraving bit does not');
        assert.equal(requiredToolheadZ(250, 'physical', 73), 250 + 73 + CLEARANCE_MARGIN_MM, 'default margin');
    }],

    ['a physical clearance with no tool length known is null - impassable, not passable', () => {
        assert.equal(requiredToolheadZ(250, 'physical', null, 5), null);
        assert.equal(requiredToolheadZ(250, 'physical', Number.NaN, 5), null);
    }],
];
