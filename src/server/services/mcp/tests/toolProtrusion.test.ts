import { strict as assert } from 'assert';

import { PROTRUSION_UNKNOWN_NOTE, resolveToolProtrusion } from '../toolProtrusion';

const T = 1_700_000_000_000;

export const tests: Array<[string, () => void]> = [
    // B2: nothing reports which tool is fitted, so the longest candidate wins.
    ['the longest candidate wins, whichever it is', () => {
        const probe = resolveToolProtrusion({
            measured: null, probeEffectiveLengthMm: 71.3, longestBitLengthMm: 40,
        });
        assert.equal(probe.mm, 71.3);
        assert.equal(probe.source, 'probe');

        const bit = resolveToolProtrusion({
            measured: null, probeEffectiveLengthMm: 20, longestBitLengthMm: 40,
        });
        assert.equal(bit.mm, 40);
        assert.equal(bit.source, 'longest-bit');
    }],

    ['an active fitted tool overrides the conservative legacy candidates', () => {
        const r = resolveToolProtrusion({
            active: { protrusionMm: 20, source: 'operator', status: 'operator_confirmed', measuredAt: null },
            measured: { protrusionMm: 85, at: T },
            probeEffectiveLengthMm: 71.3,
            longestBitLengthMm: 40,
        });
        assert.equal(r.mm, 20);
        assert.equal(r.source, 'active-tool');
        assert.ok(/routine route clearance/.test(r.note));
    }],

    ['a measurement only ever LENGTHENS the requirement', () => {
        // A long tool was measured: it beats the declared maxima and wins.
        const longer = resolveToolProtrusion({
            measured: { protrusionMm: 85, at: T }, probeEffectiveLengthMm: 71.3, longestBitLengthMm: 40,
        });
        assert.equal(longer.mm, 85);
        assert.equal(longer.source, 'measured');

        // A short tool was measured, but nothing says the probe was removed:
        // shortening on the strength of that would be the risky reading.
        const shorter = resolveToolProtrusion({
            measured: { protrusionMm: 12, at: T }, probeEffectiveLengthMm: 71.3, longestBitLengthMm: 40,
        });
        assert.equal(shorter.mm, 71.3);
        assert.equal(shorter.source, 'probe');
    }],

    ['the note says what won and what it beat', () => {
        const r = resolveToolProtrusion({
            measured: { protrusionMm: 85, at: T }, probeEffectiveLengthMm: 71.3, longestBitLengthMm: 40,
        });
        assert.ok(/85 mm/.test(r.note));
        assert.ok(/tool-setter measurement/.test(r.note));
        assert.ok(/longer than/.test(r.note), 'names what it beat');
        assert.ok(/which tool is actually fitted/.test(r.note), 'says why the longest is taken');
        assert.deepEqual(r.candidates.map((c) => c.source), ['measured', 'probe', 'longest-bit']);
        assert.equal(r.candidates[0].at, T, 'the measurement keeps its timestamp');
    }],

    ['one source is enough', () => {
        const r = resolveToolProtrusion({ measured: null, probeEffectiveLengthMm: null, longestBitLengthMm: 40 });
        assert.equal(r.mm, 40);
        assert.equal(r.source, 'longest-bit');
        assert.ok(!/longer than/.test(r.note), 'nothing to compare against');
    }],

    ['nothing known is null, not a guess', () => {
        const r = resolveToolProtrusion({ measured: null, probeEffectiveLengthMm: null, longestBitLengthMm: null });
        assert.equal(r.mm, null);
        assert.equal(r.source, null);
        assert.deepEqual(r.candidates, []);
        assert.equal(r.note, PROTRUSION_UNKNOWN_NOTE);
        assert.ok(/set_probe_geometry/.test(r.note), 'names the tools that would fix it');
        assert.ok(/set_tool_setter_config/.test(r.note));
    }],

    ['nonsense values are ignored rather than believed', () => {
        const r = resolveToolProtrusion({
            measured: { protrusionMm: Number.NaN, at: T },
            probeEffectiveLengthMm: 0,
            longestBitLengthMm: -5,
        });
        assert.equal(r.mm, null, 'NaN, zero and negative protrusions are not lengths');
    }],
];
