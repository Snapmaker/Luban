import { strict as assert } from 'assert';

import { parseGcodeHeader, parseHeaderLine } from '../gcodeHeader';
import { ORIGINAL_LASER_EXPORT, a350CncExport, lubanHeader, rayExport } from './fixtures/lubanExports';

export const tests: Array<[string, () => void]> = [
    ['a Ray export: machine, flavour, header type, power and no thumbnail', () => {
        const h = parseGcodeHeader(rayExport());
        assert.ok(h);
        assert.equal(h.machine, 'Ray');
        assert.equal(h.gcodeFlavor, 'grbl');
        assert.equal(h.headerType, 'laser');
        assert.equal(h.toolHead, '20W Laser Module');
        assert.equal(h.maxPower, 1000);
        assert.equal(h.isRotate, false);
        assert.equal(h.renderMethod, 'line');
        assert.deepEqual(h.renderMethods, ['line']);
        assert.equal(h.startLine, 1);
    }],
    ['the A350 identifier with spaces is read whole, and the thumbnail is never copied', () => {
        const h = parseGcodeHeader(a350CncExport());
        assert.ok(h);
        assert.equal(h.machine, 'Snapmaker 2.0 A350');
        assert.equal(h.headerType, 'cnc');
        assert.equal(h.gcodeFlavor, 'marlin');
        assert.ok(!JSON.stringify(h).includes('base64'), 'the thumbnail data URL stays out of the result');
    }],
    ['is_rotate true, and a fractional max_power, parse as Luban parses them', () => {
        const h = parseGcodeHeader(a350CncExport('Snapmaker 2.0 A350', true));
        assert.ok(h);
        assert.equal(h.isRotate, true);
        const original = parseGcodeHeader(ORIGINAL_LASER_EXPORT);
        assert.ok(original);
        assert.equal(original.maxPower, 127.5);
        assert.equal(original.machine, 'Original');
    }],
    ['a line is split at its FIRST colon, the key keeping its ";" (parseGcodeHeader.js)', () => {
        assert.deepEqual(parseHeaderLine(';thumbnail: data:image/png;base64,AAA'), { key: ';thumbnail', value: 'data:image/png;base64,AAA' });
        assert.deepEqual(parseHeaderLine(';max_power: 255'), { key: ';max_power', value: 255 });
        assert.deepEqual(parseHeaderLine(';estimated_time(s): 61.2'), { key: ';estimated_time(s)', value: 61.2 });
        assert.equal(parseHeaderLine('   '), null);
        assert.equal(parseHeaderLine('; no colon here'), null);
    }],
    ['no header, or a Start never closed, is null', () => {
        assert.equal(parseGcodeHeader('G90\nG0 X1\n'), null);
        // The validator suite's LUBAN_EXPORT borrows the marker with no block behind it.
        assert.equal(parseGcodeHeader(';Header Start\nG90\nG0 Z10 F1500\n'), null);
    }],
    ['only the first block is the header; later per-toolpath blocks add their renderMethod', () => {
        const first = lubanHeader({ headType: 'laser', toolHead: '20W Laser Module', machine: 'Ray', gcodeFlavor: 'grbl', maxPower: 1000 });
        const text = `${first}G90\nG1 X1Y1F100\n\n\n;Header Start\n;renderMethod: point\n;max_power: 500\n;Header End\n\nG1 X2Y2\n`;
        const h = parseGcodeHeader(text);
        assert.ok(h);
        assert.equal(h.maxPower, 1000, 'the first block wins');
        assert.equal(h.renderMethod, 'line');
        assert.deepEqual(h.renderMethods, ['line', 'point']);
    }],
    ['CRLF files parse the same', () => {
        const h = parseGcodeHeader(rayExport().replace(/\n/g, '\r\n'));
        assert.ok(h);
        assert.equal(h.machine, 'Ray');
        assert.equal(h.gcodeFlavor, 'grbl');
    }],
];
