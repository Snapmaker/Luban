import { test } from 'tape';

import {
    transformBeltGcode,
    detectLayout,
} from '../src/server/lib/GcodeGenerator/beltTransform';

// A tiny rotary body as parseAsLaser emits it (string lines): the laser sweeps
// on Y and the feed steps on B, with a centered feed that decreases (+10 -> -10),
// plus the unused seed `G0 X0.00`, a G92 reset and a trailing park move.
const rotaryBody = () => [
    'G0 X0.00',
    'G1 Y0.00 B10.00 F2400',
    'G1 F6000',
    'G1 Y0.00 S255',
    'G1 Y5.00 S0',
    'G1 Y0.00 B5.00 S255',
    'G1 Y5.00 S0',
    'G1 Y0.00 B-5.00 S255',
    'G1 Y5.00 S0',
    'G1 Y0.00 B-10.00 S255',
    'G1 Y5.00 S0',
    'G92 B0',
    'G0 B-10.00',
];

test('detectLayout picks the sweep axis with the most single-axis engraving moves', (t) => {
    const layout = detectLayout(rotaryBody());
    t.equal(layout.scanAxis, 'Y', 'sweep detected on Y');
    t.equal(layout.feedAxis, 'B', 'feed detected on B');
    t.end();
});

test('transformBeltGcode relabels sweep->X and feed->B, dropping seed/park/G92', (t) => {
    const { lines } = transformBeltGcode(rotaryBody());
    const body = lines.join('\n');

    t.ok(/\bX5\.00\b/.test(body), 'Y sweep became an X move');
    t.notOk(/\bY\d/.test(body), 'no Y tokens remain on motion lines');
    t.ok(/\bB\d/.test(body), 'feed preserved on B');
    t.notOk(/^G0 X0\.00\s*$/m.test(body), 'unused seed G0 X0.00 dropped');
    t.notOk(/G92/.test(body), 'G92 rotary-origin reset dropped');
    t.notOk(/^G0 B/m.test(body), 'trailing park move (G0 carrying feed axis) dropped');
    t.end();
});

test('transformBeltGcode b-zeroes the feed to start at 0 and rise', (t) => {
    const { extents } = transformBeltGcode(rotaryBody());
    t.equal(extents.minB, 0, 'feed starts at 0');
    t.equal(extents.maxB, 20, 'feed span preserved (original +10..-10 => 20)');
    t.end();
});

test('transformBeltGcode reports sweep extents on X and zero elsewhere', (t) => {
    const { extents } = transformBeltGcode(rotaryBody());
    t.equal(extents.minX, 0, 'min X sweep');
    t.equal(extents.maxX, 5, 'max X sweep (from the Y 0..5 sweep)');
    t.end();
});

test('transformBeltGcode with bZero=false keeps the raw centered feed', (t) => {
    const { extents } = transformBeltGcode(rotaryBody(), { bZero: false });
    // Feed axis relabelled but not shifted: still spans the original -10..+10.
    t.equal(extents.minB, -10, 'raw min B kept');
    t.equal(extents.maxB, 10, 'raw max B kept');
    t.end();
});

test('detectLayout handles the scan-on-B layout', (t) => {
    // Same job sliced the other way round: sweep on B, feed steps on Y.
    const lines = [
        'G0 X0.00',
        'G1 B0.00 Y10.00 F2400',
        'G1 B0.00 S255',
        'G1 B5.00 S0',
        'G1 B0.00 Y5.00 S255',
        'G1 B5.00 S0',
    ];
    const layout = detectLayout(lines);
    t.equal(layout.scanAxis, 'B', 'sweep detected on B');
    t.equal(layout.feedAxis, 'Y', 'feed detected on Y');
    t.end();
});
