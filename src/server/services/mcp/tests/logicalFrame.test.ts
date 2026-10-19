// The Original's LOGICAL M114 position as machine coordinates (WP4a): the
// text-serial write-path evidence (machine/channels/textSerialMachineState.ts),
// the trust decision (logicalFrame.ts) and the judge's zero-offset path
// (machinePosition.ts). Injected clock; nothing is written to a machine.
import assert from 'assert';
import { TextSerialMachineStateTracker, classifyWrittenLine } from '../../machine/channels/textSerialMachineState';
import { dialectById } from '../gcodeDialect';
import { judgeLogicalFrame, readLogicalFrameEvidence } from '../logicalFrame';
import {
    JudgeConnectionContext,
    LOGICAL_FRAME_REASON,
    createMachinePositionState,
    judgeBeatStateful,
    reliableForMotion,
    setJudgeConnectionContextProvider,
} from '../machinePosition';

const ORIGINAL = dialectById('original-marlin');
const SM2 = dialectById('sm2-marlin');
const GEN = 1;

function tracker() {
    const clock = { now: 1000 };
    const t = new TextSerialMachineStateTracker(() => clock.now);
    const write = (line: string) => {
        clock.now += 10;
        t.noteLineWritten(line, GEN);
    };
    const reply = (x: number, y: number, z: number) => {
        clock.now += 10;
        t.notePosition({ pos: { x: x.toFixed(2), y: y.toFixed(2), z: z.toFixed(2) }, raw: `X:${x} Y:${y} Z:${z} E:0.00` }, GEN);
    };
    const state = () => t.get(GEN, { workflowState: 'idle', isHomed: true });
    return { t, write, reply, state, clock };
}

function trust(s: ReturnType<ReturnType<typeof tracker>['state']>) {
    return judgeLogicalFrame(ORIGINAL, readLogicalFrameEvidence(s && s.frameEvidence));
}

export const tests: Array<[string, () => void]> = [
    ['written lines are classified: full/partial home, shifts, losses, motion, syncs, M114', () => {
        assert.equal(classifyWrittenLine('G28'), 'full-home');
        assert.equal(classifyWrittenLine('G28 X Y Z'), 'full-home');
        assert.equal(classifyWrittenLine('G28 X0'), 'partial-home');
        assert.equal(classifyWrittenLine('G92 X0 Y0 Z0'), 'shift');
        assert.equal(classifyWrittenLine('G92.1'), 'shift');
        assert.equal(classifyWrittenLine('G53;'), 'shift');
        assert.equal(classifyWrittenLine('G54'), 'shift');
        assert.equal(classifyWrittenLine('G59.3'), 'shift');
        assert.equal(classifyWrittenLine('M206 X5'), 'persistent-shift');
        assert.equal(classifyWrittenLine('M84'), 'lost');
        assert.equal(classifyWrittenLine('G1 X10 F300'), 'motion');
        assert.equal(classifyWrittenLine('G01 Z5'), 'motion');
        assert.equal(classifyWrittenLine('G4 P0'), 'sync');
        assert.equal(classifyWrittenLine('M114'), 'm114');
        assert.equal(classifyWrittenLine('G90 ; G92 in a comment'), 'other');
        assert.equal(classifyWrittenLine('M105'), 'other');
        assert.equal(classifyWrittenLine('G28.2 X Y Z'), 'motion', 'MarlinController\'s own G28.2: motion, never a full home');
        assert.equal(classifyWrittenLine('G17'), 'other');
        assert.equal(classifyWrittenLine('G29'), 'motion', 'an unlisted G word counts as motion');
    }],

    ['position refused before any home: "home first: position shift unknown since connect"', () => {
        const m = tracker();
        m.write('M114');
        m.reply(10, 20, 30);
        const verdict = trust(m.state());
        assert.equal(verdict.trusted, false);
        assert.equal(verdict.homed, false);
        assert.match(verdict.reason, /Home the Snapmaker Original .* first: the position shift is unknown since connect/);
    }],

    ['a SENT G28 is not a home: only an M114 written after it and answered completes it', () => {
        const m = tracker();
        m.write('M114'); // outstanding before the home: its reply predates the homing
        m.write('G28');
        assert.equal(trust(m.state()).trusted, false);
        m.reply(10, 20, 30); // answers the M114 written BEFORE the G28
        assert.equal(trust(m.state()).homed, false, 'a reply to an earlier M114 does not complete the home');
        assert.match(trust(m.state()).reason, /Homing .* waiting for the first position report taken after it/);
        m.write('M114');
        m.reply(0, 0, 0);
        const verdict = trust(m.state());
        assert.equal(verdict.trusted, true);
        assert.equal(verdict.homed, true);
        assert.equal((m.state() as { reportAtRest: boolean }).reportAtRest, true, 'G28 is its own planner sync');
    }],

    ['after an observed home, a G92 refuses again until the next home; Luban\'s G53/G28/G54 Home leaves it refused', () => {
        const m = tracker();
        m.write('G28');
        m.write('M114');
        m.reply(0, 0, 0);
        assert.equal(trust(m.state()).trusted, true);
        m.write('G92 X0 Y0 Z0');
        const shifted = trust(m.state());
        assert.equal(shifted.trusted, false);
        assert.match(shifted.reason, /a G92 X0 Y0 Z0 was written at .* after the home/);
        m.write('G53');
        m.write('G28');
        m.write('G54');
        m.write('M114');
        m.reply(0, 0, 0);
        assert.equal(trust(m.state()).trusted, false, 'the trailing G54 of Luban\'s Home button');
        m.write('G28');
        m.write('M114');
        m.reply(0, 0, 0);
        assert.equal(trust(m.state()).trusted, true, 'the MCP home (G28 alone) restores trust');
    }],

    ['M206 taints the whole connection; M84 loses the home; a new generation forgets everything', () => {
        const m = tracker();
        m.write('G28');
        m.write('M114');
        m.reply(0, 0, 0);
        m.write('M84');
        assert.equal(trust(m.state()).homed, false);
        assert.match(trust(m.state()).reason, /lost after M84/);
        m.write('M206 Z1');
        m.write('G28');
        m.write('M114');
        m.reply(0, 0, 0);
        assert.match(trust(m.state()).reason, /M206 Z1 .* homing does not clear/);
        assert.equal(m.t.get(GEN + 1), null, 'a reopened port starts empty');
        m.t.noteLineWritten('M114', GEN + 1);
        m.t.notePosition({ pos: { x: '0', y: '0', z: '0' }, raw: '' }, GEN + 1);
        assert.equal(judgeLogicalFrame(ORIGINAL, readLogicalFrameEvidence(m.t.get(GEN + 1)?.frameEvidence)).homed, false);
    }],

    ['at rest only for an M114 written after a planner sync that followed the last motion', () => {
        const m = tracker();
        m.write('G28');
        m.write('M114');
        m.reply(0, 0, 0);
        m.write('G91');
        m.write('G1 X20.000 Y0.000 F1500');
        m.write('M114'); // preemptive query mid-step: reports the QUEUED target
        m.write('G90');
        m.reply(20, 0, 0);
        assert.equal((m.state() as { reportAtRest: boolean }).reportAtRest, false);
        m.write('G4 P0');
        m.write('M114');
        m.reply(20, 0, 0);
        assert.equal((m.state() as { reportAtRest: boolean }).reportAtRest, true);
        // A lost reply never lets a later one claim rest across a new move.
        m.write('M114'); // its reply is lost
        m.write('G1 X5');
        m.write('M114');
        m.reply(25, 0, 0); // attributed to the lost one - which the move reset
        assert.equal((m.state() as { reportAtRest: boolean }).reportAtRest, false);
    }],

    ['a machine WITH workspaces over USB text serial: a clean G28 alone never maps it (A350 waits for M1007; Artisan, Ray refused)', () => {
        const m = tracker();
        m.write('G28');
        m.write('M114');
        m.reply(0, 0, 0);
        const verdict = judgeLogicalFrame(SM2, readLogicalFrameEvidence(m.state()?.frameEvidence));
        assert.equal(verdict.trusted, false);
        assert.equal(verdict.mapping, 'work-offset', 'the A350 maps through its M1007 offset (usbPosition.test.ts)');
        assert.match(verdict.reason, /first M1007 work-offset report/);
        const artisan = judgeLogicalFrame(dialectById('artisan-marlin'), readLogicalFrameEvidence(m.state()?.frameEvidence));
        assert.equal(artisan.trusted, false);
        assert.match(artisan.reason, /selected work workspace over USB text serial/);
        assert.equal(artisan.mappable, false, 'no home bypass for an Artisan over USB');
        assert.equal(judgeLogicalFrame(dialectById('ray-grbl'), null).mappable, false, 'nor a Ray over USB');
        assert.equal(judgeLogicalFrame(ORIGINAL, null).mappable, true);
    }],

    ['the judge: a trusted logical beat is the machine position (zero offset); untrusted keeps the WPC refusal plus the reason', () => {
        const connection: JudgeConnectionContext = { session: '9.1', positionFrame: 'logical' };
        setJudgeConnectionContextProvider(() => connection);
        try {
            const bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 125, y: 125, z: 125 } };
            const base = { staleMs: 10000, bounds, verified: null, directGcodeQuiet: true };
            const state = createMachinePositionState();
            const beat = { raw: { x: 10, y: 20, z: 30 }, offsetReported: { x: null, y: null, z: null }, reportedAt: 5000 };
            const refused = judgeBeatStateful(state, beat, { ...base, now: 5100, logicalFrameReason: 'Home the Original first' });
            assert.equal(reliableForMotion(refused.reliability), false);
            assert.equal(refused.rejectedReason, 'no-offset-yet');
            assert.ok(refused.reasons.includes(LOGICAL_FRAME_REASON));
            assert.ok(refused.reasons.includes('Home the Original first'));
            const trusted = judgeBeatStateful(state, { ...beat, reportedAt: 7000 }, { ...base, now: 7100, logicalAsMachine: true });
            assert.equal(trusted.accepted, true);
            assert.equal(trusted.reliability, 'heartbeat');
            assert.deepEqual(trusted.machine, { x: 10, y: 20, z: 30 });
            assert.deepEqual(trusted.offset.offset, { x: 0, y: 0, z: 0 });
            assert.ok(!trusted.reasons.includes(LOGICAL_FRAME_REASON));
            // Trust withdrawn (a G92): the held position is NOT kept on display.
            const again = judgeBeatStateful(state, { ...beat, reportedAt: 9000 }, { ...base, now: 9100, logicalAsMachine: false });
            assert.deepEqual(again.machine, { x: null, y: null, z: null });
            assert.equal(reliableForMotion(again.reliability), false);
        } finally {
            setJudgeConnectionContextProvider(null);
        }
    }],
];
