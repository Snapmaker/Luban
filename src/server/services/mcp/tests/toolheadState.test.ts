/* eslint-disable camelcase */
// The toolhead-on guards on a machine that never reports its head state (the
// Ray, tyeth/Luban#315 mismatch 2), the M5 lead on its motion, and the MCP's
// own laser-word record (toolheadState.ts, gcodeForms.ts).
import assert from 'assert';
import fs from 'fs';
import path from 'path';

import { GcodeDialect, dialectById } from '../gcodeDialect';
import { homeSequence, relativeStep } from '../gcodeForms';
import { boxFromCorners, planLaserFrame } from '../laserPlan';
import { RAY_IDENTIFIER } from '../machineCapability';
import { SACP_GRBL_MAX_PAYLOAD_BYTES, sacpGrblPayloadRefusal, withoutCommentLines } from '../sacpLineGuard';
import {
    MCP_LASER_RECORD_SCOPE,
    applyLaserWords,
    assessToolhead,
    clearMcpLaserRecord,
    getMcpLaserRecord,
    laserOffSentIn,
    noteLaserSend,
    noteMcpFileJob,
    toolheadNote,
    toolheadOnRefusal,
} from '../toolheadState';
import { planTraverseXy } from '../traversePlan';

const RAY = dialectById('ray-grbl');
const SM2 = dialectById('sm2-marlin');
const ORIGINAL = dialectById('original-marlin');
const ARTISAN = dialectById('artisan-marlin');
const J1 = dialectById('j1-marlin');
const UNKNOWN = dialectById('unknown');

/** A machine-frame XY traverse on `dialect` from `current`, at its current Z (the floor 10 below it). */
function traverseInput(dialect: GcodeDialect, current: { x: number; y: number; z: number }, z: number, targets: Array<{ x: number; y: number }>) {
    return {
        frame: 'machine' as const,
        currentMachine: current,
        originOffset: { x: 0, y: 0, z: 0 },
        travel: null,
        traverseZ: z,
        motionFloorZ: z - 10,
        feedRate: 1500,
        obstacles: [],
        reason: 'test',
        targets,
        machine: {
            hasZ: dialect.id !== 'ray-grbl',
            gcode: dialect.transportForm === 'sm2' ? 'snapmaker-2' as const : 'grbl-relative' as const,
            dialect,
        },
    };
}

function executable(gcode: string): string[] {
    return withoutCommentLines(gcode).split('\n');
}

/** Every file that held a toolhead-on guard (the brief's list plus toolsetter and workspace). */
const GUARD_FILES: Array<[string, number]> = [
    ['tools/camera.ts', 2],
    ['tools/gcode.ts', 2],
    ['tools/laser.ts', 1],
    ['tools/toolsetter.ts', 1],
    ['tools/workspace.ts', 1],
    ['probing.ts', 1],
    ['pendantRuntime.ts', 1],
];

export const tests: Array<[string, () => void]> = [
    // ---- The guard's judgement ------------------------------------------------
    ['the Ray: an absent, null or zero reading is UNKNOWN, never off - whatever the laser is doing', () => {
        for (const state of [null, undefined, {}, { headPower: 0 }, { headPower: 0, headStatus: false }, { headPower: 'x' }]) {
            const a = assessToolhead(RAY, state as never);
            assert.equal(a.state, 'unknown', JSON.stringify(state));
            assert.equal(a.readback, 'unknown');
            assert.equal(a.laser_off_lead, 'M5');
            assert.match(a.basis, /never reports laser power/);
            assert.equal(toolheadOnRefusal(a, 'Toolhead appears to be on; refusing to traverse.'), null, 'unknown does not refuse: M5 leads instead');
        }
    }],
    ['the Ray: a non-zero reading still refuses (the firmware never writes it, so one is a real signal) and says why it is odd', () => {
        const a = assessToolhead(RAY, { headPower: 12 });
        assert.equal(a.state, 'on');
        const refusal = String(toolheadOnRefusal(a, 'Toolhead appears to be on; refusing to traverse.'));
        assert.match(refusal, /^Toolhead appears to be on; refusing to traverse\. \(headPower 12/);
        assert.match(refusal, /not known to report/);
        assert.equal(assessToolhead(RAY, { headStatus: 'on' }).state, 'on');
    }],
    ['the A350, Artisan, J1 and Original report: zero reads off, and an on reading refuses with the guard\'s exact old message', () => {
        for (const dialect of [SM2, ARTISAN, J1, ORIGINAL, UNKNOWN]) {
            const off = assessToolhead(dialect, { headPower: 0 });
            assert.equal(off.state, 'off', dialect.id);
            assert.equal(off.readback, 'reported');
            assert.equal(off.laser_off_lead, null);
            assert.equal(assessToolhead(dialect, null).state, 'off', `${dialect.id}: no state reads as it always has`);
            for (const on of [{ headPower: 100 }, { headStatus: true }, { headStatus: 'on' }]) {
                const a = assessToolhead(dialect, on);
                assert.equal(a.state, 'on');
                assert.equal(toolheadOnRefusal(a, 'Toolhead appears to be on; refusing to move Z.'), 'Toolhead appears to be on; refusing to move Z.');
            }
            assert.equal(toolheadNote(off, getMcpLaserRecord('c')), null, `${dialect.id}: results carry no toolhead block`);
        }
    }],
    ['every guard reads the one helper: no guard file reads headPower / headStatus itself', () => {
        for (const [file, count] of GUARD_FILES) {
            const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
            assert.ok(!/\.head(Power|Status)\b|head(Power|Status)\?:/.test(source), `${file} still reads the head state directly`);
            const calls = (source.match(/assertToolheadNotOn\(|toolheadOnRefusal\(connectedToolhead\(\)/g) || []).length;
            assert.equal(calls, count, `${file}: ${calls} guard call(s)`);
        }
    }],

    // ---- M5 on the Ray's motion, nothing new elsewhere -----------------------------
    ['the Ray: every relative step leads with M5 after its settle comment; the Original and the A350 are byte-identical', () => {
        const ends = { from: { x: 10, y: 10 }, to: { x: 20, y: 30 } };
        assert.deepEqual(executable(relativeStep(RAY, ends, 1500)), ['M5', 'G91', 'G1 X10.000 Y20.000 F1500', 'G90']);
        assert.deepEqual(executable(relativeStep(RAY, ends, 1500, { command: 'G0', settle: false })), ['M5', 'G91', 'G0 X10.000 Y20.000 F1500', 'G90']);
        assert.equal(relativeStep(ORIGINAL, ends, 1500), '; mcp-settle machine X20.000 Y30.000\nG91\nG1 X10.000 Y20.000 F1500\nG90\nG4 P0');
        const ray = planTraverseXy(traverseInput(RAY, { x: 10, y: 10, z: 0 }, 0, [{ x: 20, y: 30 }, { x: 40, y: 30 }]));
        assert.ok(ray.steps.every((s) => executable(s.gcode)[0] === 'M5'), 'every Ray traverse step leads with M5');
        const original = planTraverseXy(traverseInput(ORIGINAL, { x: 10, y: 10, z: 50 }, 50, [{ x: 20, y: 30 }]));
        const a350 = planTraverseXy(traverseInput(SM2, { x: 100, y: 100, z: 328 }, 328, [{ x: 120, y: 130 }]));
        for (const step of [...original.steps, ...a350.steps]) {
            assert.ok(!/\bM5\b/.test(step.gcode), step.gcode);
        }
        assert.equal(a350.steps[0].gcode, 'G90\nG53;\nG1 X120.000 Y130.000 F1500;\nG54;');
    }],
    ['the Ray\'s longest relative step with its M5 still fits one SACP string', () => {
        const step = relativeStep(RAY, { from: { x: 0, y: 0 }, to: { x: -999.999, y: -999.999 } }, 99999, { command: 'G1', hasZ: false });
        const sent = withoutCommentLines(step);
        assert.ok(Buffer.byteLength(sent) <= SACP_GRBL_MAX_PAYLOAD_BYTES, `${Buffer.byteLength(sent)} bytes`);
        assert.equal(sacpGrblPayloadRefusal(sent), null);
        assert.equal(laserOffSentIn(assessToolhead(RAY, null), sent), 'M5');
        assert.equal(laserOffSentIn(assessToolhead(SM2, null), sent), null, 'only where the head state is unknown');
    }],
    ['home: the Ray\'s M5 is a separate payload and $H stays the exact string; nothing new on the A350, Artisan or Original', () => {
        const ray = homeSequence(RAY, { sacp: true, machineIdentifier: RAY_IDENTIFIER, canExecuteGcode: true, canGoHome: true });
        assert.equal(ray.gcode, '$H');
        assert.equal(ray.laserOff, 'M5');
        const a350 = homeSequence(SM2, { sacp: false, machineIdentifier: 'Snapmaker 2.0 A350', canExecuteGcode: true, canGoHome: false });
        const artisan = homeSequence(ARTISAN, { sacp: true, machineIdentifier: 'A400', canExecuteGcode: true, canGoHome: true });
        const original = homeSequence(ORIGINAL, { sacp: false, machineIdentifier: 'Original', canExecuteGcode: true, canGoHome: false });
        for (const command of [a350, artisan, original]) {
            assert.equal('laserOff' in command, false, command.label);
        }
    }],
    ['the laser frame is the exception: it manages its own M5 / M3 / M5, and no extra M5 lands between M3 and the move', () => {
        const frame = (powerPercent: number) => planLaserFrame({
            dialect: RAY,
            hasZ: false,
            current: { x: 10, y: 10, z: null },
            box: boxFromCorners(100, 100, 150, 150),
            boxSource: 'arguments',
            travel: { xMin: 0, xMax: 600, yMin: 0, yMax: 400 },
            reason: 'frame',
            powerPercent,
        });
        const dark = frame(0);
        assert.equal(executable(dark.steps[0].gcode).filter((l) => l === 'M5').length, 1, 'exactly one M5 on the first step');
        const lit = frame(2);
        assert.deepEqual(executable(lit.steps[0].gcode), ['M5', 'G91', 'G0 X90.000 Y90.000 F1500', 'G90']);
        for (const step of lit.steps.slice(1)) {
            assert.deepEqual(executable(step.gcode).filter((l) => !/^G9[01]$/.test(l)).map((l) => l.split(' ')[0]), ['M3', 'G1', 'M5'], step.gcode);
        }
    }],

    // ---- The MCP's own laser words (advisory) ---------------------------------------
    ['the record: M3/M4 with S > 0 and no M5 after is on; M5, S0 and M2/M30 are off; GRBL\'s S is modal', () => {
        assert.deepEqual(applyLaserWords({ mode: null, s: null }, 'M3 S100\nG1 X1 F100'), { mode: 'M3', s: 100, line: 'M3 S100' });
        assert.equal(applyLaserWords({ mode: null, s: null }, 'M3 S100\nG1 X1\nM5').mode, 'M5');
        assert.deepEqual(applyLaserWords({ mode: 'M5', s: 300 }, 'M4'), { mode: 'M4', s: 300, line: 'M4' }, 'S carries over');
        assert.equal(applyLaserWords({ mode: 'M3', s: 300 }, 'S0').s, 0);
        assert.equal(applyLaserWords({ mode: 'M3', s: 300 }, 'M30').mode, 'M30');
        assert.equal(applyLaserWords({ mode: null, s: null }, '; M3 S100 in a comment\nG0 X1').line, null);
        assert.equal(applyLaserWords({ mode: null, s: null }, 'M2000 L13 P1').line, null, 'the crosshair is not a laser word');
    }],
    ['the record follows acknowledged sends per connection, marks doubt, and a file job makes it uncertain', () => {
        clearMcpLaserRecord();
        let t = 1000;
        const now = () => t;
        assert.equal(getMcpLaserRecord('c1').laser, 'none');
        noteLaserSend('c1', 'G91\nG0 X1 Y1 F100\nG90', now)('accepted');
        assert.equal(getMcpLaserRecord('c1').laser, 'none', 'no laser words, no change');
        noteLaserSend('c1', 'M3 S20\nG91\nG1 X1 Y0 F100\nG90', now)('pending');
        assert.equal(getMcpLaserRecord('c1').laser, 'none', 'pending changes nothing');
        noteLaserSend('c1', 'M3 S20\nG91\nG1 X1 Y0 F100\nG90', now)('accepted');
        const on = getMcpLaserRecord('c1');
        assert.equal(on.laser, 'on');
        assert.equal(on.s, 20);
        assert.equal(on.at, 1000);
        t = 2000;
        noteLaserSend('c1', 'M5\nG91\nG0 X1 Y0 F100\nG90', now)('accepted');
        assert.equal(getMcpLaserRecord('c1').laser, 'off');
        noteLaserSend('c1', 'M4', now)('accepted');
        assert.equal(getMcpLaserRecord('c1').laser, 'on', 'M4 picks up the S20 this MCP sent');
        noteLaserSend('c1', 'M5', now)('indeterminate');
        assert.equal(getMcpLaserRecord('c1').laser, 'uncertain');
        assert.equal(getMcpLaserRecord('c2').laser, 'none', 'another connection never inherits the record');
        assert.match(getMcpLaserRecord('c2').note, /previous connection/);
        noteLaserSend('c2', 'M3', now)('accepted');
        assert.equal(getMcpLaserRecord('c2').laser, 'uncertain', 'M3 with no S this MCP knows');
        noteLaserSend('c2', 'M5', now)('accepted');
        noteMcpFileJob('c2', 'engrave', now);
        assert.equal(getMcpLaserRecord('c2').laser, 'uncertain');
        assert.match(getMcpLaserRecord('c2').note, /file job "engrave"/);
        clearMcpLaserRecord();
    }],
    ['on the Ray the toolhead block is labelled MCP-sent only and names the M5 a call sent', () => {
        clearMcpLaserRecord();
        const note = toolheadNote(assessToolhead(RAY, { headPower: 0 }), getMcpLaserRecord('c'), 'M5');
        assert.ok(note);
        assert.equal(note.state, 'unknown');
        assert.equal(note.laser_off_sent, 'M5');
        assert.equal(note.mcp_sent_laser.laser, 'none');
        assert.equal(note.mcp_sent_laser.scope, MCP_LASER_RECORD_SCOPE);
        assert.match(MCP_LASER_RECORD_SCOPE, /MCP-sent only/);
        assert.match(MCP_LASER_RECORD_SCOPE, /started from Luban's UI or the phone app, .* are invisible to it/);
        assert.match(MCP_LASER_RECORD_SCOPE, /never gates motion/);
    }],
];
