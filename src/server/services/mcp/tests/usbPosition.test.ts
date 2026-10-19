// Text-serial position trust, #265 follow-up: the Snapmaker 2.0 (A350) over
// USB maps its LOGICAL M114 position to machine coordinates through a fresh,
// consistent M1007 work offset cross-checked against the stepper Count, and
// the Original's home is lost once its steppers may have been released on
// idle (logicalFrame.ts, machine/channels/textSerialMachineState.ts).
// Injected clock; nothing is written to a machine.
import assert from 'assert';
import { STEPPER_IDLE_EPSILON_MS, TextSerialMachineStateTracker, classifyWrittenLine, writtenIdleTimeoutSeconds }
    from '../../machine/channels/textSerialMachineState';
import { dialectById } from '../gcodeDialect';
import { judgeLogicalFrame, readLogicalFrameEvidence } from '../logicalFrame';
import { JudgeConnectionContext, createMachinePositionState, judgeBeatStateful, reliableForMotion, setJudgeConnectionContextProvider }
    from '../machinePosition';
import { OperatorReviewStore } from '../operatorReviews';
import { machineToolsFixture } from './machineStore.test';

const SM2 = dialectById('sm2-marlin');
const ORIGINAL = dialectById('original-marlin');
const GEN = 1;
/** native - machine on the A350 (Count / 400 = machine + (19, 4, 0), measured 2026-10-05). */
const K = { x: 19, y: 4, z: 0 };
const HOME = { x: 320, y: 350, z: 330 };
const W = { x: 120.5, y: 80.25, z: 200 };

type P = { x: number; y: number; z: number };

function near(actual: number | null, expected: number, what: string) {
    assert.ok(actual !== null && Math.abs(actual - expected) < 0.001, `${what}: ${actual} vs ${expected}`);
}

function a350() {
    const clock = { now: 1000 };
    const t = new TextSerialMachineStateTracker(() => clock.now);
    const write = (line: string) => {
        clock.now += 10;
        t.noteLineWritten(line, GEN);
    };
    /** An M114 written now and answered: logical = machine + offset, Count = (machine + K) * 400 (or the counts given). */
    const report = (machine: P, offset: P, counts: P = machine) => {
        write('M114');
        clock.now += 10;
        const pos = { x: machine.x + offset.x, y: machine.y + offset.y, z: machine.z + offset.z };
        const c = { x: Math.round((counts.x + K.x) * 400), y: Math.round((counts.y + K.y) * 400), z: Math.round((counts.z + K.z) * 400) };
        t.notePosition({ pos: { x: pos.x.toFixed(2), y: pos.y.toFixed(2), z: pos.z.toFixed(2) },
            raw: `X:${pos.x.toFixed(2)} Y:${pos.y.toFixed(2)} Z:${pos.z.toFixed(2)} E:0.00 Count X:${c.x} Y:${c.y} Z:${c.z}` }, GEN);
    };
    /** The lines of one M1007 reply (Snapmaker2-Controller M1005_1007.cpp order). */
    const replyM1007 = (origin: number, current: boolean, offset: P) => {
        clock.now += 10;
        t.noteOriginSelection({ message: String(origin), raw: `Selected origin num: ${origin}` }, GEN);
        t.noteOriginSelection({ message: current ? 'YES' : 'NO', raw: `Selected == Current: ${current ? 'YES' : 'NO'}` }, GEN);
        t.noteOriginOffset({ originOffset: { x: offset.x } }, GEN);
        t.noteOriginOffset({ originOffset: { y: offset.y } }, GEN);
        t.noteOriginOffset({ originOffset: { z: offset.z } }, GEN);
        t.noteOriginOffset({ originOffset: { b: 0 } }, GEN);
    };
    const m1007 = (origin: number, current: boolean, offset: P) => {
        write('M1007');
        replyM1007(origin, current, offset);
    };
    const state = () => t.get(GEN, { workflowState: 'idle' });
    const judge = () => {
        const s = state();
        return judgeLogicalFrame(SM2, readLogicalFrameEvidence(s && s.frameEvidence),
            { now: clock.now, report: s ? { pos: s.pos, counts: s.counts } : null });
    };
    /** The MCP home (gcodeForms G53;G28;G54), then the reports Luban's poll brings. */
    const home = (offset: P = W) => {
        write('G53;');
        write('G28;');
        write('G54;');
        m1007(1, true, offset);
        report(HOME, offset);
    };
    return { t, clock, write, report, m1007, replyM1007, state, judge, home };
}

export const tests: Array<[string, () => void]> = [
    ['M18/M84 with S only set the idle timeout; bare (or with axes) they release; M1007 is its own kind', () => {
        assert.equal(classifyWrittenLine('M84 S0'), 'idle-timeout');
        assert.equal(classifyWrittenLine('M18 S30'), 'idle-timeout');
        assert.equal(classifyWrittenLine('M84'), 'lost');
        assert.equal(classifyWrittenLine('M84 X'), 'lost');
        assert.equal(classifyWrittenLine('M18'), 'lost');
        assert.equal(classifyWrittenLine('M1007'), 'm1007');
        assert.equal(writtenIdleTimeoutSeconds('M84 S0'), 0);
        assert.equal(writtenIdleTimeoutSeconds('M18 S30'), 30);
        assert.equal(writtenIdleTimeoutSeconds('M84'), null);
        assert.equal(writtenIdleTimeoutSeconds('M3 S1000'), null);
    }],

    ['A350 over USB: after G53;G28;G54 with a fresh consistent M1007 and a resting report, machine = logical - offset', () => {
        const m = a350();
        m.home();
        const verdict = m.judge();
        assert.equal(verdict.mappable, true);
        assert.equal(verdict.mapping, 'work-offset');
        assert.equal(verdict.trusted, true, verdict.reason);
        assert.equal(verdict.homed, true);
        assert.equal(verdict.atRest, true);
        assert.deepEqual(verdict.offset, W);
        assert.equal(verdict.stepperIdle, null, 'the A350 never releases on idle (DISABLE_INACTIVE_* false)');
        // The judge subtracts it (Luban's own work - originOffset), never adds.
        const connection: JudgeConnectionContext = { session: '4.1', positionFrame: 'logical' };
        setJudgeConnectionContextProvider(() => connection);
        try {
            const s = m.state() as { pos: P; timestamp: number };
            const judged = judgeBeatStateful(createMachinePositionState(), { raw: s.pos,
                offsetReported: { x: null, y: null, z: null },
                reportedAt: s.timestamp }, { now: s.timestamp + 10,
                staleMs: 10000,
                bounds: null,
                verified: null,
                directGcodeQuiet: true,
                logicalAsMachine: true,
                logicalOffset: verdict.offset });
            assert.equal(judged.accepted, true);
            assert.equal(reliableForMotion(judged.reliability), true);
            near(judged.machine.x, HOME.x, 'x');
            near(judged.machine.y, HOME.y, 'y');
            near(judged.machine.z, HOME.z, 'z');
        } finally {
            setJudgeConnectionContextProvider(null);
        }
    }],

    ['A350 over USB: refused before the home, and while no M1007 has answered since it', () => {
        const m = a350();
        m.m1007(1, true, W);
        m.report(HOME, W);
        assert.match(m.judge().reason, /first: the position shift is unknown since connect/);
        m.write('G53;');
        m.write('G28;');
        m.write('G54;');
        m.report(HOME, W);
        const verdict = m.judge();
        assert.equal(verdict.trusted, false);
        assert.equal(verdict.homed, true);
        assert.match(verdict.reason, /fresh M1007 work-offset report: G54; was written/);
    }],

    ['A350 over USB: an M1007 requested before the G54 (answered after it) is stale; the next one maps', () => {
        const m = a350();
        m.write('G53;');
        m.write('G28;');
        m.write('M1007');
        m.write('G54;');
        m.replyM1007(1, true, W);
        m.report(HOME, W);
        assert.match(m.judge().reason, /fresh M1007 work-offset report: G54; was written/);
        m.m1007(1, true, W);
        m.report(HOME, W);
        assert.equal(m.judge().trusted, true, m.judge().reason);
    }],

    ['A350 over USB: an unmatched M1007 reply (no outstanding write) never counts as fresh', () => {
        const m = a350();
        m.write('G53;');
        m.write('G28;');
        m.write('G54;');
        m.replyM1007(1, true, W);
        m.report(HOME, W);
        assert.match(m.judge().reason, /matched no outstanding write/);
    }],

    ['A350 over USB: "Selected == Current: NO" refuses; a workspace other than the last selected refuses', () => {
        const m = a350();
        m.write('G53;');
        m.write('G28;');
        m.write('G54;');
        m.m1007(1, false, W);
        m.report(HOME, W);
        assert.match(m.judge().reason, /Selected == Current: NO/);
        m.m1007(2, true, W);
        m.report(HOME, W);
        assert.match(m.judge().reason, /reports workspace 2 selected, but G54; \(workspace 1\)/);
    }],

    ['A350 over USB: a G92 after the offset was read invalidates it until a fresh M1007 and report re-derive', () => {
        const m = a350();
        m.home();
        assert.equal(m.judge().trusted, true);
        // Luban's set-work-origin: G92 (Snapmaker2-Controller G92.cpp copies the shift into the active workspace).
        m.write('G92 X0 Y0 Z0');
        let verdict = m.judge();
        assert.equal(verdict.trusted, false);
        assert.match(verdict.reason, /fresh M1007 work-offset report: G92 X0 Y0 Z0 was written/);
        const W2 = { x: -HOME.x, y: -HOME.y, z: -HOME.z };
        m.m1007(1, true, W2);
        verdict = m.judge();
        assert.match(verdict.reason, /position report taken after G92 X0 Y0 Z0/, 'the last M114 is in the frame before the G92');
        m.report(HOME, W2);
        verdict = m.judge();
        assert.equal(verdict.trusted, true, verdict.reason);
        assert.deepEqual(verdict.offset, W2, 're-derived from the new offset; the Count (no motion) agrees');
    }],

    ['A350 over USB: the Count catches a frame change the write path never saw, and a report taken mid-move', () => {
        const m = a350();
        m.home();
        // Touchscreen origin change: M114 jumps 5 mm in X, the steppers did not move, the old offset still looks fresh.
        m.report(HOME, { ...W, x: W.x + 5 }, HOME);
        let verdict = m.judge();
        assert.equal(verdict.trusted, false);
        assert.equal(verdict.atRest, false);
        assert.match(verdict.reason, /x differ by more than 0.05 mm/);
        // A staged step (sm2 form G53; G1; G54;): the planner target is reported before the steppers get there.
        const m2 = a350();
        m2.home();
        const target = { x: 100, y: 120, z: HOME.z };
        m2.write('G90');
        m2.write('G53;');
        m2.write('G1 X100.000 Y120.000 F3000;');
        m2.write('G54;');
        m2.m1007(1, true, W);
        m2.report(target, W, { x: 250, y: 300, z: HOME.z });
        verdict = m2.judge();
        assert.equal(verdict.trusted, false, 'mid-move: Count still on the way');
        assert.equal(verdict.atRest, false);
        m2.report(target, W, target);
        verdict = m2.judge();
        assert.equal(verdict.trusted, true, verdict.reason);
        assert.equal(verdict.atRest, true, 'arrived: settles the traverse');
    }],

    ['A350 over USB: within the 0.05 mm epsilon the Count agrees (M114 prints hundredths)', () => {
        const m = a350();
        m.home();
        m.report(HOME, W, { x: HOME.x + 0.04, y: HOME.y - 0.04, z: HOME.z });
        assert.equal(m.judge().trusted, true);
        m.report(HOME, W, { x: HOME.x + 0.06, y: HOME.y, z: HOME.z });
        assert.equal(m.judge().trusted, false);
    }],

    ['A350 over USB: no Count tail, or a persistent shift, refuses', () => {
        const m = a350();
        m.home();
        m.write('M114');
        m.t.notePosition({ pos: { x: '440.50', y: '430.25', z: '530.00' }, raw: 'X:440.50 Y:430.25 Z:530.00 E:0.00' }, GEN);
        assert.match(m.judge().reason, /no complete X\/Y\/Z and Count tail/);
        const m2 = a350();
        m2.home();
        m2.write('M206 X5');
        assert.match(m2.judge().reason, /M206 X5 was written/);
    }],

    ['SSTP/SACP beats are judged exactly as before: logicalOffset is ignored off the logical frame', () => {
        const connection: JudgeConnectionContext = { session: '7.1', positionFrame: null };
        setJudgeConnectionContextProvider(() => connection);
        try {
            const beat = { raw: { x: 150, y: 160, z: 300 }, offsetReported: { x: 20, y: 30, z: 0 }, reportedAt: 5000 };
            const ctx = { now: 5100, staleMs: 10000, bounds: null, verified: null, directGcodeQuiet: true };
            const plain = judgeBeatStateful(createMachinePositionState(), beat, ctx);
            const withMapping = judgeBeatStateful(createMachinePositionState(), beat, { ...ctx, logicalAsMachine: true, logicalOffset: { x: 1, y: 2, z: 3 } });
            assert.deepEqual(withMapping, plain);
            assert.deepEqual(plain.machine, { x: 130, y: 130, z: 300 });
        } finally {
            setJudgeConnectionContextProvider(null);
        }
    }],

    ['the Original: the home is lost at the idle boundary (timeout - epsilon) with the stated refusal', () => {
        const m = a350(); // same tracker; judged with the Original's dialect
        m.write('G28');
        m.write('M114');
        m.t.notePosition({ pos: { x: '0.00', y: '0.00', z: '0.00' }, raw: 'X:0.00 Y:0.00 Z:0.00 E:0.00' }, GEN);
        const homedAt = 1010; // the G28 write: the idle clock starts there
        const judgeAt = (now: number) => {
            const s = m.state();
            return judgeLogicalFrame(ORIGINAL, readLogicalFrameEvidence(s && s.frameEvidence),
                { now, report: s ? { pos: s.pos, counts: s.counts } : null, stepperIdleTimeout: { seconds: 120, source: 'default' } });
        };
        const boundary = homedAt + 120000 - STEPPER_IDLE_EPSILON_MS;
        let verdict = judgeAt(boundary - 1);
        assert.equal(verdict.trusted, true, verdict.reason);
        assert.equal(verdict.stepperIdle && verdict.stepperIdle.timeoutS, 120);
        assert.equal(verdict.stepperIdle && verdict.stepperIdle.remainingS, 0);
        verdict = judgeAt(homedAt + 60000);
        assert.equal(verdict.stepperIdle && verdict.stepperIdle.remainingS, 59);
        verdict = judgeAt(boundary);
        assert.equal(verdict.trusted, false);
        assert.equal(verdict.homed, false);
        assert.match(verdict.reason, /the Original's steppers may have been released after 120 s idle; home again/i);
        assert.equal(verdict.stepperIdle && verdict.stepperIdle.remainingS, 0);
    }],

    ['the Original: a closed idle gap past the timeout stays lost after later motion; reported motion keeps it alive', () => {
        const policy = { seconds: 120, source: 'default' };
        const judge = (m: ReturnType<typeof a350>) => {
            const s = m.state();
            return judgeLogicalFrame(ORIGINAL, readLogicalFrameEvidence(s && s.frameEvidence), { now: m.clock.now, stepperIdleTimeout: policy });
        };
        const homed = () => {
            const m = a350();
            m.write('G28');
            m.write('M114');
            m.t.notePosition({ pos: { x: '0.00', y: '0.00', z: '0.00' }, raw: 'X:0.00 Y:0.00 Z:0.00 E:0.00 Count X:0 Y:0 Z:0' }, GEN);
            return m;
        };
        const m = homed();
        m.clock.now += 130000;
        m.write('G1 X10 F600');
        assert.match(judge(m).reason, /released after 120 s idle/, 'the gap before the move was already too long');
        // A long move: the Count changes between polls, so the clock restarts at each poll.
        const m2 = homed();
        for (let i = 1; i <= 5; i++) {
            m2.clock.now += 50000;
            m2.write('M114');
            m2.t.notePosition({ pos: { x: '0.00', y: '0.00', z: '0.00' }, raw: `X:0.00 Y:0.00 Z:0.00 E:0.00 Count X:${i * 800} Y:0 Z:0` }, GEN);
        }
        assert.equal(judge(m2).trusted, true, judge(m2).reason);
    }],

    ['the Original: M84 S0 written disables the expiry; M18 S30 shortens it; a bare M84 still loses the home', () => {
        const policy = { seconds: 120, source: 'default' };
        const setup = () => {
            const m = a350();
            m.write('G28');
            m.write('M114');
            m.t.notePosition({ pos: { x: '0.00', y: '0.00', z: '0.00' }, raw: 'X:0.00 Y:0.00 Z:0.00 E:0.00' }, GEN);
            const judge = () => {
                const s = m.state();
                return judgeLogicalFrame(ORIGINAL, readLogicalFrameEvidence(s && s.frameEvidence), { now: m.clock.now, stepperIdleTimeout: policy });
            };
            return { m, judge };
        };
        const never = setup();
        never.m.write('M84 S0');
        never.m.clock.now += 10 * 3600 * 1000;
        let verdict = never.judge();
        assert.equal(verdict.trusted, true, verdict.reason);
        assert.equal(verdict.stepperIdle && verdict.stepperIdle.timeoutS, null);
        assert.equal(verdict.stepperIdle && verdict.stepperIdle.remainingS, null);
        const short = setup();
        short.m.write('M18 S30');
        short.m.clock.now += 28000;
        assert.equal(short.judge().trusted, true);
        short.m.clock.now += 1500;
        verdict = short.judge();
        assert.equal(verdict.trusted, false);
        assert.match(verdict.reason, /released after 30 s idle; home again/);
        // Latched: motion after the expiry does not bring the home back.
        short.m.write('G1 X5 F600');
        assert.equal(short.judge().trusted, false);
        const bare = setup();
        bare.m.write('M84');
        assert.match(bare.judge().reason, /lost after M84/);
    }],

    ['stepper_idle_timeout_s: the Original only; default is the labelled upstream Marlin value; clearing after a tightening is staged', () => {
        const f = machineToolsFixture({});
        f.connect({ machineIdentifier: 'Snapmaker 2.0 A350' });
        assert.throws(() => f.tools.setMachinePolicy({ stepper_idle_timeout_s: 60 }), /only the Snapmaker Original releases its steppers/);
        assert.equal(f.tools.stepperIdleTimeout(), null);
        const o = machineToolsFixture({});
        o.connect({ machineIdentifier: 'Original' });
        const reviews = new OperatorReviewStore();
        o.tools.setMachinePolicyReviews(reviews);
        const timeout = o.tools.stepperIdleTimeout();
        assert.equal(timeout && timeout.seconds, 120);
        assert.match(String(timeout && timeout.source), /upstream Marlin firmware default .* NOT measured on the Original/);
        assert.throws(() => o.tools.setMachinePolicy({ stepper_idle_timeout_s: 1 }), /stepper_idle_timeout_s must be a number in 2..3600/);
        assert.equal(o.tools.setMachinePolicy({ stepper_idle_timeout_s: 60 }).staged, undefined, 'tightening applies at once');
        assert.ok(o.tools.setMachinePolicy({ stepper_idle_timeout_s: null }).staged, 'null -> the 120 s default is a loosening');
        const after = o.tools.stepperIdleTimeout();
        assert.equal(after && after.seconds, 60);
    }],
];
