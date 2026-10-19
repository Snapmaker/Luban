import { strict as assert } from 'assert';

import {
    ASSUMED_LASER_ACCELERATION_MM_S2,
    RulePhase,
    accelerationDistanceMm,
    codeStatusOf,
    isLaserJob,
} from '../dialectRules';
import { dialectById, dialectFor } from '../gcodeDialect';
import { resolveTravel } from '../machineTravel';
import { GcodeValidationReport, ValidationOptions, resolveJobFrame, validateGcode } from '../validator';
import { a350CncExport, lubanHeader, rayExport } from './fixtures/lubanExports';

const RAY = dialectFor('Ray');
const SM2 = dialectById('sm2-marlin');

const FUDGE = { x: 25, y: 25 };
const RAY_TRAVEL = resolveTravel({ size: { x: 600, y: 400 }, fudge: FUDGE, stated: { xMin: null, xMax: null, yMin: null, yMax: null }, observed: null });
const A350_TRAVEL = resolveTravel({ size: { x: 320, y: 350 }, fudge: FUDGE, stated: { xMin: -19, xMax: 339, yMin: null, yMax: null }, observed: null });

function ray(phase: RulePhase = 'validate', over: Partial<ValidationOptions> = {}): ValidationOptions {
    return { dialect: RAY, machineIdentifier: 'Ray', hasZ: false, supportsRotary: false, travel: RAY_TRAVEL, phase, ...over };
}

function a350(phase: RulePhase = 'validate', over: Partial<ValidationOptions> = {}): ValidationOptions {
    return { dialect: SM2, machineIdentifier: 'Snapmaker 2.0 A350', hasZ: true, supportsRotary: true, travel: A350_TRAVEL, phase, ...over };
}

function findings(report: GcodeValidationReport, rule: string, severity?: 'warning' | 'refusal') {
    assert.ok(report.machine, 'a judged report carries its machine block');
    return report.machine.findings.filter((f) => f.rule === rule && (!severity || f.severity === severity));
}

// The 2026-10 kiss-cut that did not fire on the Ray: M4 S120 F3000 around
// openings far shorter than the 1.25 mm the head needs to reach F3000.
const KISS_CUT = [
    'G90',
    'G0 X10 Y10 F6000',
    'M4 S120',
    'G1 X11 Y10 F3000',
    'G1 X11 Y11',
    'G1 X10 Y11',
    'G1 X10 Y10',
    'G0 X20 Y10',
    'G1 X21 Y10',
    'G1 X21 Y11',
    'G1 X20.5 Y11',
    'G1 X20 Y10',
    'G1 X40 Y10',
    'M5',
].join('\n');

export const tests: Array<[string, () => void]> = [
    ['a dotted code is judged by its integer form unless the reference lists it exactly', () => {
        assert.equal(codeStatusOf(SM2, 'G38.2'), 'incompatible', 'the SM2 list names G38, not each variant');
        assert.equal(codeStatusOf(RAY, 'G59.1'), 'incompatible', 'listed exactly on the Ray');
        assert.equal(codeStatusOf(RAY, 'G92.1'), 'supported');
        assert.equal(codeStatusOf(SM2, 'G2'), 'unverified');
        assert.equal(codeStatusOf(SM2, 'G17'), 'unlisted');
    }],
    ['the acceleration distance is (F/60)^2 / 2a at the stated assumption', () => {
        assert.equal(ASSUMED_LASER_ACCELERATION_MM_S2, 1000);
        assert.equal(accelerationDistanceMm(3000), 1.25);
        assert.equal(accelerationDistanceMm(600), 0.05);
    }],
    ['a laser job: header first, then a laser-only machine, then the staged head', () => {
        assert.equal(isLaserJob({ dialect: SM2, header: null, headType: 'cnc' }), false);
        assert.equal(isLaserJob({ dialect: SM2, header: null, headType: 'laser' }), true);
        assert.equal(isLaserJob({ dialect: RAY, header: null, headType: 'cnc' }), true, 'the Ray has no other head, whatever head_type defaulted to');
    }],
    ['laser-mode-dynamic-short-segments: the kiss-cut gets ONE summary warning with its count', () => {
        const report = validateGcode(KISS_CUT, ray());
        const found = findings(report, 'laser-mode-dynamic-short-segments');
        assert.equal(found.length, 1);
        assert.equal(found[0].severity, 'warning');
        const text = found[0].message;
        assert.ok(text.includes('8 of 9 M4'), text);
        assert.ok(text.includes('median 1 mm'), text);
        assert.ok(text.includes('F3000') && text.includes('1.25 mm') && text.includes('S120'), text);
        assert.ok(text.includes('ASSUMPTION') && text.includes('1000 mm/s^2'), text);
        assert.ok(text.includes('use M3'), text);
        assert.equal(report.warnings.filter((w) => w.includes('[laser-mode-dynamic-short-segments]')).length, 1);
        assert.deepEqual(report.machine && report.machine.refusals, [], 'a warning, never a refusal');
    }],
    ['laser-mode-dynamic-short-segments: M3, long segments, or a lower F stay quiet', () => {
        assert.equal(findings(validateGcode(KISS_CUT.replace('M4 S120', 'M3 S120'), ray()), 'laser-mode-dynamic-short-segments').length, 0);
        assert.equal(findings(validateGcode(KISS_CUT.replace(/F3000/g, 'F300'), ray()), 'laser-mode-dynamic-short-segments').length, 0,
            'at F300 the head reaches speed in 0.0125 mm');
        assert.equal(findings(validateGcode(KISS_CUT.replace('M4 S120', 'M4 S0'), ray()), 'laser-mode-dynamic-short-segments').length, 0, 'S0 burns nothing');
    }],
    ['laser-mode-dynamic-short-segments: a raster stays one line, and a greyscale-dot header skips it', () => {
        const rows: string[] = ['G90', 'G0 X0 Y0 F6000', 'M4 S300', 'G1 F3000'];
        for (let row = 0; row < 40; row++) {
            for (let px = 1; px <= 50; px++) {
                rows.push(`G1 X${row % 2 ? 50 - px : px}.0 Y${row * 0.1}`);
            }
        }
        rows.push('M5');
        const raster = validateGcode(rows.join('\n'), ray());
        assert.equal(findings(raster, 'laser-mode-dynamic-short-segments').length, 1, 'one summary, not one per pixel');
        const dot = lubanHeader({ headType: 'laser', toolHead: '20W Laser Module', machine: 'Ray', gcodeFlavor: 'grbl', maxPower: 1000, renderMethod: 'point' });
        assert.equal(findings(validateGcode(dot + rows.join('\n'), ray()), 'laser-mode-dynamic-short-segments').length, 0);
    }],
    ['laser-mode-dynamic-short-segments can fire on an A350 laser file (call-out a)', () => {
        const report = validateGcode(KISS_CUT, a350('validate', { headType: 'laser' }));
        assert.equal(findings(report, 'laser-mode-dynamic-short-segments').length, 1);
        assert.ok(!report.machine || !report.machine.rulesApplied.includes('z-on-zless'));
    }],
    ['s-range: S1000 is full power on the Ray, S1200 is refused', () => {
        assert.deepEqual(validateGcode(rayExport({}, 1000), ray('submit')).machine?.refusals, []);
        const over = validateGcode(rayExport({}, 1200), ray('submit'));
        assert.equal(findings(over, 's-range', 'refusal').length, 1);
        assert.ok(over.machine?.refusals[0].includes('S1200') && over.machine.refusals[0].includes('S0-1000'), over.machine?.refusals[0]);
    }],
    ['s-range: a Marlin-scale S255 in a file headed marlin on the Ray gets the "did you mean S1000?" hint', () => {
        const report = validateGcode(rayExport({ gcodeFlavor: 'marlin' }, 255), ray());
        const hint = findings(report, 's-range', 'warning');
        assert.equal(hint.length, 1);
        assert.ok(hint[0].message.includes('25.5 %') && hint[0].message.includes('S1000'), hint[0].message);
    }],
    ['s-range: S1000 on a Marlin laser is refused; the 200 W spindle\'s S12000 is not a laser word', () => {
        const laser = validateGcode('G90\nG0 X1 Y1 F3000\nM3 S1000\nG1 X5 Y1 F600\nM5', a350('submit', { headType: 'laser' }));
        assert.equal(findings(laser, 's-range', 'refusal').length, 1);
        assert.ok(laser.machine?.refusals[0].includes('GRBL (Ray) scale'));
        const cnc = validateGcode(a350CncExport(), a350('submit', { headType: 'cnc' }));
        assert.ok(!cnc.machine?.rulesApplied.includes('s-range'));
        assert.deepEqual(cnc.machine?.refusals, []);
    }],
    ['s-range: P outside 0-100 on M3/M4 is refused; G4 P and M2000 P are not power', () => {
        const report = validateGcode('G90\nM3 P150 S255\nG4 P1000\nM2000 L13 P1\nG1 X5 Y1 F600\nM5', a350('submit', { headType: 'laser' }));
        const p = findings(report, 's-range', 'refusal');
        assert.equal(p.length, 1);
        assert.ok(p[0].message.includes('line(s) 2 '), p[0].message);
    }],
    ['frame-form: own-line G53 on the Ray is refused (non-modal on GRBL); a same-line prefix is accepted', () => {
        const alone = validateGcode('G90\nG53\nG0 X10 Y10 F3000\nG54', ray('submit'));
        const refused = findings(alone, 'frame-form', 'refusal');
        assert.equal(refused.length, 1);
        assert.ok(refused[0].message.includes('NON-MODAL') && refused[0].message.includes('no effect'), refused[0].message);
        const prefix = validateGcode('G90\nG53 G0 X10 Y10 F3000', ray('submit'));
        assert.equal(findings(prefix, 'frame-form').length, 0);
        assert.ok(!prefix.warnings.some((w) => w.startsWith('Inline G53')), 'the SM2 inline-G53 warning is not the Ray\'s');
    }],
    ['frame-form: a machine without workspaces refuses any G53/G54', () => {
        const original = validateGcode('G90\nG54\nG0 X1 Y1 F600', { dialect: dialectFor('Original'), machineIdentifier: 'Original', phase: 'submit' });
        assert.equal(findings(original, 'frame-form', 'refusal').length, 1);
        const j1 = validateGcode('G90\nG53\nG0 X1 Y1 F600\nG54', { dialect: dialectFor('Snapmaker J1'), machineIdentifier: 'Snapmaker J1', phase: 'staged' });
        assert.equal(findings(j1, 'frame-form', 'refusal').length, 1);
    }],
    ['homing-form: $H in a Marlin file and G28 in a Ray file are refused', () => {
        const marlin = validateGcode('$H\nG90\nG0 X1 Y1 F600', a350('submit'));
        assert.equal(findings(marlin, 'homing-form', 'refusal').length, 1);
        const grbl = validateGcode('G28\nG90\nG0 X1 Y1 F600', ray('submit'));
        assert.equal(findings(grbl, 'homing-form', 'refusal').length, 1);
        assert.equal(findings(grbl, 'unknown-command').length, 0, 'G28 on GRBL is homing-form\'s, not also unknown-command\'s');
        assert.equal(findings(validateGcode('$H\nG90\nG0 X1Y1F600', ray('submit')), 'homing-form').length, 0, '$H is the Ray\'s own home');
    }],
    ['z-on-zless: any Z word on a Ray motion line is refused', () => {
        const report = validateGcode('G90\nG0 X1 Y1 F600\nG0 Z5\nG1 X2 Y2 Z0 F300', ray('validate'));
        const z = findings(report, 'z-on-zless', 'refusal');
        assert.equal(z.length, 1);
        assert.ok(z[0].message.includes('3, 4'), z[0].message);
    }],
    ['header-machine: another model of the same family is warned at validate, refused at submit', () => {
        const a250 = a350CncExport('Snapmaker 2.0 A250');
        const validate = validateGcode(a250, a350('validate'));
        assert.equal(findings(validate, 'header-machine', 'warning').length, 1);
        assert.deepEqual(validate.machine?.refusals, []);
        const submit = validateGcode(a250, a350('submit'));
        const refused = findings(submit, 'header-machine', 'refusal');
        assert.equal(refused.length, 1);
        assert.ok(refused[0].message.includes('Snapmaker 2.0 A250') && refused[0].message.includes('Snapmaker 2.0 A350'));
    }],
    ['header-machine: an A350 CNC file on the Ray is refused (machine at submit, flavour always)', () => {
        const submit = validateGcode(a350CncExport(), ray('submit'));
        const refused = findings(submit, 'header-machine', 'refusal').map((f) => f.message);
        assert.ok(refused.some((m) => m.includes('"Snapmaker 2.0 A350"')), refused.join('\n'));
        assert.ok(refused.some((m) => m.includes(';gcode_flavor: marlin')), refused.join('\n'));
    }],
    ['header-machine: ;is_rotate: true on the Ray is refused; on the A350 it is not', () => {
        const rotary = rayExport({ isRotate: true });
        assert.equal(findings(validateGcode(rotary, ray('validate')), 'header-machine', 'refusal').length, 1);
        assert.equal(findings(validateGcode(a350CncExport('Snapmaker 2.0 A350', true), a350('submit')), 'header-machine').length, 0);
    }],
    ['unknown-command: an incompatible SM2 code warns at validate and refuses only where the body is sent', () => {
        const program = 'G90\nG53\nG0 X10 Y10 Z300 F600\nG38.2 Z280 F60\nG0 Z300\nG54';
        const validate = validateGcode(program, a350('validate'));
        assert.equal(findings(validate, 'unknown-command', 'warning').length, 1);
        assert.deepEqual(validate.machine?.refusals, []);
        for (const phase of ['submit', 'staged'] as RulePhase[]) {
            const sent = validateGcode(program, a350(phase));
            const refused = findings(sent, 'unknown-command', 'refusal');
            assert.equal(refused.length, 1, phase);
            assert.ok(refused[0].message.includes('G38.2 (line 4)') && refused[0].message.includes('run_probing_gcode'), refused[0].message);
        }
    }],
    ['unknown-command: on the A350 arcs and G17 are reported, never warned; on the unverified Ray they are warned', () => {
        const a = validateGcode(a350CncExport(), a350('submit'));
        assert.equal(findings(a, 'unknown-command').length, 0);
        assert.deepEqual(a.machine?.codesOutsideReference.map((c) => c.code).sort(), ['G17', 'G2', 'G3']);
        const r = validateGcode('G90\nG0 X1Y1F600\nM3 S100\nG2 X5Y5I2J2F600\nM5', ray('validate'));
        const warned = findings(r, 'unknown-command', 'warning');
        assert.equal(warned.length, 1);
        assert.ok(warned[0].message.includes('G2 (unlisted, line 4)'), warned[0].message);
    }],
    ['travel: a machine-frame file outside the A350 travel is refused in assertWithinTravel\'s words; a work-frame file is not judged', () => {
        const outside = validateGcode('G90\nG53\nG0 X355 Y10 F600\nG54', a350('submit'));
        const refused = findings(outside, 'travel', 'refusal');
        assert.equal(refused.length, 1);
        assert.ok(refused[0].message.includes('X 355 is 16 mm beyond the X maximum 339'), refused[0].message);
        assert.ok(refused[0].message.includes('mcpTravelFudgeMm'));
        const work = validateGcode('G90\nG54\nG0 X355 Y10 F600', a350('submit'));
        assert.equal(findings(work, 'travel').length, 0);
        const staged = validateGcode('G90\nG53\nG0 X355 Y10 F600\nG54', a350('staged'));
        assert.ok(!staged.machine?.rulesApplied.includes('travel'), 'server bodies were planned inside the travel already');
    }],
    ['rulesApplied names every rule the file was judged by, in order', () => {
        assert.deepEqual(validateGcode(rayExport(), ray('submit')).machine?.rulesApplied, [
            'unknown-command', 'frame-form', 's-range', 'laser-mode-dynamic-short-segments', 'z-on-zless', 'travel', 'header-machine', 'homing-form',
        ]);
        assert.deepEqual(validateGcode(a350CncExport(), a350('staged')).machine?.rulesApplied, ['unknown-command', 'frame-form', 'homing-form']);
    }],
    ['frame-form on GRBL: every move prefixed with G53 declares the machine frame, and the travel rule holds it', () => {
        const machine = validateGcode('G90\nG53 G0 X10 Y10 F3000\nG53 G0 X590 Y390', ray('submit'));
        assert.equal(machine.frame.declared, 'machine');
        assert.equal(machine.frame.source, 'gcode');
        assert.deepEqual(machine.machine?.refusals, []);
        assert.notEqual(resolveJobFrame(machine, { frameArgument: 'work', originOffsetZ: null, offsetReliable: false, machineZMax: null }).refusal, null,
            'frame: "work" contradicts a fully prefixed file');
        const outside = validateGcode('G90\nG53 G0 X10 Y10 F3000\nG53 G0 X700 Y10', ray('submit'));
        assert.ok((outside.machine?.refusals || []).some((r) => r.includes('X 700 is 75 mm beyond the X maximum 625')), outside.machine?.refusals.join('\n'));
        const legacy = validateGcode('G90\nG53 G0 X10 Y10 F3000');
        assert.equal(legacy.frame.declared, null, 'the A350 does not honour an inline G53: unchanged');
    }],
    ['frame-form on GRBL: a file that prefixes only some moves is refused', () => {
        const mixed = validateGcode('G90\nG53 G0 X10 Y10 F3000\nG0 X20 Y20', ray('submit'));
        const refused = findings(mixed, 'frame-form', 'refusal');
        assert.equal(refused.length, 1);
        assert.ok(refused[0].message.includes('1 of 2 motion lines'), refused[0].message);
    }],
    ['frame-form on a staged body judges what moves: an inert G53; G54; description pair passes, a G53 governing a move does not', () => {
        const original: ValidationOptions = { dialect: dialectFor('Original'), machineIdentifier: 'Original', phase: 'staged' };
        const inert = 'G90\nG53;\nG54;';
        assert.deepEqual(validateGcode(inert, ray('staged')).machine?.refusals, []);
        assert.deepEqual(validateGcode(inert, original).machine?.refusals, []);
        assert.equal(findings(validateGcode(inert, ray('submit')), 'frame-form', 'refusal').length, 1, 'a submitted file is judged as written');
        const moving = 'G90\nG53;\nG0 X10 Y10 F3000\nG54;';
        assert.equal(findings(validateGcode(moving, ray('staged')), 'frame-form', 'refusal').length, 1);
        assert.equal(findings(validateGcode(moving, original), 'frame-form', 'refusal').length, 1);
    }],
];
