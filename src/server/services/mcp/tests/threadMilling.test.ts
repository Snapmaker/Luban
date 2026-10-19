import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { convertThreadMillingGcode, THREAD_MILLING_CONTROLLERS, ThreadMillingOptions } from '../threadMilling';
import { McpToolError, ToolRegistry } from '../registry';
import { registerThreadMillingTools } from '../tools/threadMilling';
import { resolveJobFrame, validateGcode } from '../validator';

const sample = fs.readFileSync(path.join(__dirname, 'fixtures/thread-milling-m2_5-fanuc.nc'), 'utf8');
const options: ThreadMillingOptions = { toolCenterPath: true, toolLengthApplied: true, spindleMode: 'cnc_200w_rpm' };
const convert = (source = sample, overrides: Partial<ThreadMillingOptions> = {}) => convertThreadMillingGcode(source, { ...options, ...overrides });
const near = (actual: number, expected: number, tolerance = 0.000002): void => {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};
function points(gcode: string): Array<{ x: number; y: number; z: number }> {
    let point = { x: 0, y: 0, z: 0 };
    return gcode.split('\n').filter((line) => /^G[01] /.test(line)).map((line) => {
        point = { ...point };
        (['x', 'y', 'z'] as const).forEach((axis) => {
            const match = new RegExp(`${axis.toUpperCase()}(-?[0-9.]+)`).exec(line);
            if (match) point[axis] = Number(match[1]);
        });
        return point;
    });
}
function simple(body: string): string {
    return `G21 G17 G94 G54 G90\nS12000 M3\nG0 X1 Y0 Z-5\nF100\n${body}\nM30`;
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['raw Fanuc validation points to the offline converter', () => {
        assert.ok(validateGcode(sample).warnings.some((w) => w.includes('convert_thread_milling_gcode')));
    }],
    ['exact supplied Fanuc sample retains G43 height, compensated-block XY, nine arcs and three full turns', () => {
        const result = convert();
        assert.equal(result.arcCount, 9);
        assert.equal(result.fullCircleCount, 3);
        assert.ok(result.gcode.includes('G0 Z20'));
        assert.ok(result.gcode.includes('G1 X0.288 Y-0.288 F2159'));
        assert.ok(result.gcode.includes('G1 X0 Y0 F2000'));
        assert.ok(result.gcode.includes('M3 S17991'));
        assert.ok(result.gcode.endsWith('M5\nG90\n'));
        assert.deepEqual(result.sourceSpindleRpm, [17991]);
        assert.equal(result.validation.usesRelativeMotion, false);
        assert.equal(result.validation.usesArcs, false);
        assert.deepEqual(result.validation.extents.z, { min: -5.056, max: 20 });
        assert.ok((result.validation.extents.x as { min: number }).min < -0.57);
        assert.ok((result.validation.extents.y as { min: number }).min < -0.57);
        assert.ok((result.validation.extents.y as { max: number }).max > 0.57);
        const pathPoints = points(result.gcode);
        near(pathPoints[pathPoints.length - 2].z, 0.006);
        assert.deepEqual(pathPoints[pathPoints.length - 1], { x: 0, y: 0, z: 20 });
        result.gcode.split('\n').filter((line) => line && !line.startsWith(';')).forEach((line) => {
            assert.equal((line.match(/[GM]\d+/g) || []).length, 1, line);
            assert.ok(/^(G(?:0 |1 |21$|90$|54$)|M(?:3 |5$))/.test(line), line);
        });
    }],
    ['full helical circle preserves direction, pitch, radius, feed and chord tolerance', () => {
        for (const code of ['G2', 'G3']) {
            const result = convert(simple(`G91 ${code} Z0.45 I-1 J0`));
            const pts = points(result.gcode);
            assert.equal(result.fullCircleCount, 1);
            assert.ok((pts[1].y > 0) === (code === 'G3'));
            near(pts[pts.length - 1].z, -4.55);
            let angle = 0;
            for (let i = 1; i < pts.length; i += 1) {
                const a = pts[i - 1];
                const b = pts[i];
                near(Math.hypot(b.x, b.y), 1);
                angle += Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
                assert.ok(1 - Math.hypot((a.x + b.x) / 2, (a.y + b.y) / 2) <= 0.002);
                assert.ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) <= 0.250002);
                assert.ok(b.z > a.z);
            }
            near(angle, code === 'G3' ? 2 * Math.PI : -2 * Math.PI);
        }
    }],
    ['inch coordinates, incremental centres and feeds become mm without scaling RPM', () => {
        const result = convert(simple('G91 G3 Z0.05 I-1 J0').replace('G21', 'G20'));
        const pts = points(result.gcode);
        near(pts[0].x, 25.4);
        near(pts[pts.length - 1].z, -125.73);
        assert.deepEqual(result.validation.feedRates, { min: 2540, max: 2540 });
        assert.ok(result.gcode.includes('M3 S12000'));
    }],
    ['rapid-block feed words survive conversion and remain modal for cutting', () => {
        const result = convert(simple('G3 I-1 J0').replace('G0 X1 Y0 Z-5\nF100', 'G0 X1 Y0 Z-5 F123'));
        assert.ok(result.gcode.includes('G0 X1 Y0 Z-5 F123'));
        assert.deepEqual(result.validation.feedRates, { min: 123, max: 123 });
    }],
    ['partial absolute arc keeps quarter-turn sweep and helical endpoint', () => {
        const result = convert(simple('G3 X0 Y1 Z-4.8 I-1 J0'));
        const pts = points(result.gcode);
        assert.equal(result.fullCircleCount, 0);
        assert.deepEqual(pts[pts.length - 1], { x: 0, y: 1, z: -4.8 });
        assert.ok(pts.every((p) => p.x >= 0 && p.y >= 0));
    }],
    ['modal compact blocks, nested comments, omitted arc command and changing RPM', () => {
        const result = convert(simple('G91G3Z.45I-1J0 (outer (nested))\nZ.45I-1J0\nS13000'));
        assert.equal(result.fullCircleCount, 2);
        assert.ok(result.gcode.includes('M3 S13000'));
        near(points(result.gcode).slice(-1)[0].z, -4.1);
    }],
    ['explicit power conversion uses P and retains source feed and RPM report', () => {
        const result = convert(sample, { spindleMode: 'power_percent', spindlePowerPercent: 80 });
        assert.ok(result.gcode.includes('M3 P80'));
        assert.ok(!result.gcode.includes('S17991'));
        assert.ok(result.gcode.includes('F981'));
        assert.deepEqual(result.sourceSpindleRpm, [17991]);
    }],
    ['rounding mismatch is reported; malformed arcs fail instead of silently becoming lines', () => {
        const result = convert(simple('G3 X0 Y1.001 I-1 J0'));
        assert.ok(result.warnings.some((w) => w.includes('radii differ')));
        assert.throws(() => convert(simple('G3 X0 Y2 I-1 J0')), /radius differs/);
        assert.throws(() => convert(simple('G3 Z1 I0 J0')), /radius must/);
    }],
    ['declarations, spindle ranges, unsupported modes, syntax and resource limits fail closed', () => {
        assert.throws(() => convert(sample, { toolCenterPath: false }), /tool_center_path/);
        assert.throws(() => convert(sample.replace('COMPENSATION D=0', 'COMPENSATION D=0.69')), /nonzero cutter compensation/);
        assert.throws(() => convert(sample, { toolLengthApplied: false }), /tool_length_applied/);
        assert.throws(() => convert(sample, { spindleMode: 'power_percent' }), /spindle_power_percent/);
        assert.throws(() => convert(sample, { chordToleranceMm: 0 }), /chord_tolerance_mm/);
        assert.throws(() => convert(sample.replace('17991', '20000')), /8000 to 18000/);
        assert.throws(() => convert(sample.replace('M30', 'M30\nG0 Z0')), /after program end/);
        assert.throws(() => convert(sample.replace('M30', '')), /must end/);
        assert.throws(() => convert(sample.replace('G43 H1', 'G43')), /requires an H/);
        for (const command of ['G20', 'F0.000000001', 'G18', 'G95', 'G53', 'G92', 'G90.1', 'M4', 'M98 P1', 'G3 R1', '#1=3', 'G1 X1 X2', 'G90 G91', 'G1 Q2']) {
            assert.throws(() => convert(simple(command)), /Line \d+:/, command);
        }
        assert.throws(() => convert(simple('G91 G3 Z1 I-1000000 J0')), /too many segments/);
        assert.throws(() => convert(simple('G91 G3 Z1 I-1 J0').replace('G0 X1 Y0 Z-5', 'G0 Z-5')), /established/);
        assert.throws(() => convert(simple('M6 T2\nG3 I-1 J0')), /initial M6/);
    }],
    ['offline MCP surface returns the converted validation and exposes readable errors', async () => {
        const registry = new ToolRegistry();
        registerThreadMillingTools(registry);
        const args = { gcode: sample, tool_center_path: true, tool_length_applied: true, spindle_mode: 'cnc_200w_rpm' };
        const result = await registry.call('convert_thread_milling_gcode', args) as { gcode: string; validation: object };
        assert.deepEqual(result.validation, validateGcode(result.gcode));
        await assert.rejects(registry.call('convert_thread_milling_gcode', { ...args, tool_center_path: false }), McpToolError);
    }],
];

// Synthetic option matrix, not exports captured from the live website. Geometry
// carries these choices; flute count never changes or duplicates a toolpath.
for (const internal of [true, false]) {
    for (const rightHand of [true, false]) {
        for (const climb of [true, false]) {
            for (const cutter of ['single', 'multi-long', 'multi-short'] as const) {
                tests.push([`${internal ? 'internal' : 'external'} / ${rightHand ? 'RH' : 'LH'} / ${climb ? 'climb' : 'conventional'} / ${cutter} / two radial passes`, () => {
                    const cw = internal ? !climb : climb;
                    const dz = (rightHand ? !cw : cw) ? 0.7 : -0.7;
                    const turns = { single: 5, 'multi-long': 1, 'multi-short': 3 }[cutter] as number;
                    const lines = ['G21 G17 G94 G54 G90', 'M6 T1', 'M3 S12000'];
                    for (const radius of (internal ? [1.2, 1.3] : [2.8, 2.7])) {
                        lines.push(`G90 G0 X${40 + radius} Y30 Z10`, 'G1 Z-5 F200', 'G91');
                        for (let turn = 0; turn < turns; turn += 1) {
                            lines.push(`G${cw ? 2 : 3} Z${dz} I${-radius} J0 F123`);
                            if (cutter === 'multi-short' && turn < turns - 1) lines.push(`G1 X${-radius}`, `G1 Z${dz * 2}`, `G1 X${radius}`);
                        }
                    }
                    lines.push('G90 G0 Z10', 'M30');
                    const result = convert(lines.join('\n'));
                    assert.equal(result.fullCircleCount, turns * 2);
                    assert.equal(result.arcCount, turns * 2);
                    const pts = points(result.gcode);
                    assert.ok((pts[2].y < 30) === cw);
                    const expectedZ = -5 + dz * (cutter === 'multi-short' ? 7 : turns);
                    near(pts[pts.length - 2].z, expectedZ);
                    assert.equal(pts[pts.length - 1].z, 10);
                }]);
            }
        }
    }
}

for (const controller of THREAD_MILLING_CONTROLLERS) {
    tests.push([`live ${controller} export preserves the same six arcs and four full turns`, () => {
        const source = fs.readFileSync(path.join(__dirname, 'fixtures/thread-milling-controllers', `${controller}.nc`), 'utf8');
        const result = convert(source, { sourceController: controller });
        const reference = convert(fs.readFileSync(path.join(__dirname, 'fixtures/thread-milling-controllers/fanuc.nc'), 'utf8'));
        assert.equal(result.arcCount, 6);
        assert.equal(result.fullCircleCount, 4);
        assert.deepEqual(points(result.gcode), points(reference.gcode));
        assert.deepEqual(result.validation, reference.validation);
        if (['okuma', 'mazak', 'siemens_c', 'siemens_d'].includes(controller)) {
            assert.throws(() => convert(source), /Line \d+:/);
        }
    }]);
}

tests.push(['a converted program resolves machine Z on the confirm page, stating the G54 assumption start verifies', () => {
    const converted = convert();
    const resolved = resolveJobFrame(validateGcode(converted.gcode), { frameArgument: 'work', originOffsetZ: -200, offsetReliable: true, machineZMax: 328, verifiesG54AtStart: true });
    assert.equal(resolved.refusal, null);
    assert.deepEqual(resolved.report.frame.workspaceSelects, ['G54']);
    assert.equal(resolved.report.machineZResolvedFor, 'G54');
    assert.deepEqual(resolved.report.machineZExtents, { min: 194.944, max: 220 });
}]);
tests.push(['controller handling is explicit and refuses unrecognised workspace/preselection variants', () => {
    const okuma = fs.readFileSync(path.join(__dirname, 'fixtures/thread-milling-controllers/okuma.nc'), 'utf8');
    assert.throws(() => convert(okuma.replace('G15 H1', 'G15 H2'), { sourceController: 'okuma' }), /G15 H1/);
    assert.throws(() => convert(sample, { sourceController: 'okuma' }), /Fanuc offset codes/);
    const mazak = fs.readFileSync(path.join(__dirname, 'fixtures/thread-milling-controllers/mazak.nc'), 'utf8');
    assert.throws(() => convert(mazak.replace('T1 T0', 'T1 T2'), { sourceController: 'mazak' }), /Duplicate T/);
}]);

interface LiveOptionCase {
    name: string;
    gcode: string[];
    expectedArcs: number;
    expectedFullCircles: number;
    expectedMinZ: number;
    expectedFinalZ: number;
}
const liveOptions: LiveOptionCase[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/thread-milling-live-options.json'), 'utf8'));
for (const fixture of liveOptions) {
    tests.push([`live generator options: ${fixture.name}`, () => {
        const result = convert(fixture.gcode.join('\n'), { spindleMode: 'power_percent', spindlePowerPercent: 80 });
        assert.equal(result.arcCount, fixture.expectedArcs);
        assert.equal(result.fullCircleCount, fixture.expectedFullCircles);
        assert.equal(result.validation.usesRelativeMotion, false);
        near((result.validation.extents.z as { min: number }).min, fixture.expectedMinZ);
        near(points(result.gcode).slice(-1)[0].z, fixture.expectedFinalZ);
        assert.ok(result.gcode.includes('M3 P80'));
    }]);
}
