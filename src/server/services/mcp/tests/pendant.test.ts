import assert from 'assert';
import { ManualControlGate } from '../manualControl';
import { JogBounds, PendantInput, PendantSession, firmwareMotionProblem, parsePendantInput, validateJogBounds } from '../pendant';

const bounds: JogBounds = { xMin: 0, xMax: 20, yMin: 0, yMax: 20, zMin: 0, zMax: 20 };
const current = { x: 10, y: 10, z: 10 };
const frame = (over: Partial<PendantInput> = {}): PendantInput => ({
    v: 1, seq: 0, x: 0, y: 0, z: 0, feed: 300, mode: 'feed', deadman: false, stop: false, ready: true, ...over
});

export const tests: Array<[string, () => void]> = [
    ['the bounds clamp never pulls a head that starts outside them', () => {
        const session = new PendantSession();
        const outside = { x: 10, y: -0.4, z: 10 };
        session.arm({ ...bounds, yMin: -0.4 }, outside, 1000);
        session.bounds = bounds; // DRO corrected to just outside the envelope after arming
        session.receive(frame({ seq: 1 }), 1010);
        session.receive(frame({ seq: 2, y: -1, deadman: true }), 1020);
        assert.equal(session.target(outside, 1300), null);
        session.receive(frame({ seq: 3, y: 1, deadman: true }), 1400);
        const inward = session.target(outside, 1700);
        assert.ok(inward && inward.position.y > outside.y);
    }],
    ['envelope accepts heartbeat noise within 0.05 mm of an edge, refuses beyond', () => {
        const edge: JogBounds = { xMin: -19, xMax: 339, yMin: 0, yMax: 342, zMin: 280, zMax: 328 };
        validateJogBounds(edge, { x: 10, y: -0.0000051269531127218215, z: 327.999 });
        validateJogBounds(edge, { x: 339.04, y: 342.04, z: 328.04 });
        assert.throws(() => validateJogBounds(edge, { x: 10, y: -0.06, z: 300 }), /contain current position/);
    }],
    ['wire protocol rejects nonfinite axes, strings, bad mode, feed, version and oversized frames', () => {
        for (const over of [{ x: null }, { y: '1' }, { z: 2 }, { feed: 3001 }, { feed: 59 }, { feed: 0 }, { v: 2 },
            { mode: 'z', feed: 1001 },
            { mode: 'other' }, { seq: -1 }, { seq: 0.5 }, { deadman: 1 }, { ready: null }, { z: 0.5 }]) {
            assert.throws(() => parsePendantInput(JSON.stringify({ ...frame(), ...over })));
        }
        assert.throws(() => parsePendantInput(' '.repeat(513)));
        assert.deepEqual(parsePendantInput(JSON.stringify(frame())), frame());
    }],
    ['rejected frames name the failing field and accept firmware id and event text', () => {
        assert.throws(() => parsePendantInput(JSON.stringify(frame({ feed: 59 }))), /feed 59 outside 60–3000/);
        assert.throws(() => parsePendantInput(JSON.stringify(frame({ mode: 'z', feed: 1200 }))), /above the Z-mode limit 1000/);
        assert.equal(parsePendantInput(JSON.stringify(frame({ feed: 60 }))).feed, 60);
        assert.equal(parsePendantInput(JSON.stringify(frame({ mode: 'z', feed: 1000 }))).feed, 1000);
        assert.throws(() => parsePendantInput('{"v":1,'), /not JSON/);
        assert.throws(() => parsePendantInput(JSON.stringify({ ...frame(), fw: 'x'.repeat(33) })), /: fw\./);
        const withFw = { ...frame(), fw: 'pendant-2026-10-05', log: 'linked' };
        assert.deepEqual(parsePendantInput(JSON.stringify(withFw)), withFw);
    }],
    ['no movement before operator arm, real neutral and deadman', () => {
        const session = new PendantSession();
        session.receive(frame({ x: 1, deadman: true }), 1000);
        assert.equal(session.target(current, 1000), null);
        session.arm(bounds, current, 1000);
        session.receive(frame({ seq: 1, x: 1, deadman: true }), 1010);
        assert.equal(session.target(current, 1010), null);
        session.receive(frame({ seq: 2, ready: false }), 1020);
        assert.equal(session.neutral, false);
        session.receive(frame({ seq: 3 }), 1030);
        assert.equal(session.target(current, 1030), null);
        session.receive(frame({ seq: 4, x: 1, deadman: true }), 1040);
        assert.ok(session.target(current, 1040));
    }],
    ['diagonal motion caps duration, feed scales slow input, and latest intent replaces old intent', () => {
        const session = new PendantSession();
        session.arm(bounds, current, 1000);
        session.receive(frame(), 1000);
        session.receive(frame({ seq: 1, x: 1, y: 1, feed: 3000, deadman: true }), 1010);
        const target = session.target(current, 1010);
        assert.ok(target);
        if (!target) { throw new Error('Expected jog target'); }
        assert.ok(Math.hypot(target.position.x - 10, target.position.y - 10) <= 5.000001);
        session.receive(frame({ seq: 2, x: -1, feed: 300, deadman: true }), 1020);
        const latest = session.target(current, 1020);
        assert.ok(latest);
        if (!latest) { throw new Error('Expected latest jog target'); }
        assert.equal(latest.position.x, 9.5);
        session.receive(frame({ seq: 3 }), 1030);
        assert.equal(session.target(current, 1030), null);
    }],
    ['time-based travel scales with feed, shrinks on changing intent, and reserves measured link overhead', () => {
        const session = new PendantSession();
        const wideBounds = { ...bounds, xMax: 100 };
        session.arm(wideBounds, current, 1000, 1000);
        session.receive(frame(), 1000);
        session.receive(frame({ seq: 1, x: 1, feed: 3000, deadman: true }), 1010);
        assert.equal(session.target(current, 1010)?.durationMs, 100);
        session.receive(frame({ seq: 2, x: 1, feed: 3000, deadman: true }), 3000);
        const fast = session.target(current, 3000);
        assert.equal(fast?.durationMs, 900);
        assert.equal(fast?.distanceMm, 45);
        assert.equal(session.target(current, 3000, 400)?.durationMs, 500);
        // Pipelined runs pass their own cap: it replaces the overhead ceiling but
        // never exceeds the operator's maxSegmentMs.
        assert.equal(session.target(current, 3000, 800, 425)?.durationMs, 425);
        assert.equal(session.target(current, 3000, 0, 5000)?.durationMs, 1000);
        session.receive(frame({ seq: 3, x: -0.5, feed: 300, deadman: true }), 3010);
        const changed = session.target(current, 3010);
        assert.equal(changed?.durationMs, 100);
        assert.equal(changed?.feed, 150);
        assert.equal(changed?.distanceMm, 0.25);
        session.receive(frame({ seq: 4, x: 1, feed: 300, deadman: true }), 3020);
        session.receive(frame({ seq: 5, x: 1, feed: 300, deadman: true }), 5000);
        const slow = session.target(current, 5000);
        assert.ok(Math.abs((slow?.distanceMm || 0) - 4.5) < 0.000001);
        for (const duration of [499, 1001, NaN]) { assert.throws(() => session.arm(bounds, current, 0, duration)); }
    }],
    ['brief USB jitter pauses new segments without dropping the arm', () => {
        const session = new PendantSession(); session.arm(bounds, current, 1000);
        session.receive(frame(), 1000);
        session.receive(frame({ seq: 1, x: 1, deadman: true }), 1010);
        assert.equal(session.target(current, 1400), null); assert.equal(session.armed, true);
        session.receive(frame({ seq: 2, x: 1, deadman: true }), 1410);
        assert.ok(session.target(current, 1410));
    }],
    ['stale USB, expiry, physical stop and replay require a new arm', () => {
        for (const cause of ['stale', 'expired', 'stop']) {
            const session = new PendantSession();
            session.arm(bounds, current, 1000);
            session.receive(frame(), 1000);
            session.receive(frame({ seq: 1, x: 1, deadman: true, stop: cause === 'stop' }), 1010);
            const times: { [key: string]: number } = { stale: 2000, expired: 601001, stop: 1010 };
            assert.equal(session.target(current, times[cause]), null);
            assert.equal(session.armed, false);
        }
        const session = new PendantSession();
        session.receive(frame(), 1000);
        assert.throws(() => session.receive(frame(), 1010), /sequence/);
        session.reset();
        session.receive(frame(), 1020);
    }],
    ['envelope forbids crossing its edge and invalid bounds', () => {
        validateJogBounds({ ...bounds, xMax: 350 }, current);
        assert.throws(() => validateJogBounds({ ...bounds, xMax: Infinity }, current));
        assert.throws(() => validateJogBounds({ ...bounds, zMin: 11 }, current));
        assert.throws(() => validateJogBounds({ ...bounds, yMin: NaN }, current));
        const session = new PendantSession();
        session.arm(bounds, current, 1000);
        session.receive(frame(), 1000);
        session.receive(frame({ seq: 1, x: 1, deadman: true }), 1010);
        assert.equal(session.target({ ...current, x: 20 }, 1010), null);
        assert.deepEqual(session.limitedAxes, ['X']);
        assert.equal(session.armed, true);
    }],
    ['MCP and manual ownership excludes pending mutations but preserves status and stop', () => {
        const gate = new ManualControlGate();
        const leave = gate.enterTool('start_gcode_job');
        assert.throws(() => gate.acquire());
        leave();
        let stopped = false;
        gate.acquire(() => { stopped = true; });
        assert.throws(() => gate.enterTool('home'));
        assert.throws(() => gate.enterTool('query_firmware_position'));
        gate.enterTool('get_position')();
        gate.enterTool('stop_gcode_job')();
        assert.equal(stopped, true);
        assert.throws(() => gate.acquire());
        gate.release();
        gate.enterTool('home')();
    }],
    ['firmware motion limits must be reported and fit the pipelining model', () => {
        const snapmaker = 'echo:; Maximum feedrates (units/s):\necho:  M203 X120.00 Y120.00 Z40.00 E45.00\n'
            + 'echo:  M201 X3000 Y3000 Z100 E10000\necho:  M204 P1000.00 R1000.00 T1000.00\nok';
        assert.equal(firmwareMotionProblem(snapmaker, 3000, 500), null);
        assert.match(String(firmwareMotionProblem(snapmaker.replace('M203 X120.00', 'M203 X40.00'), 3000, 500)), /max feed/);
        assert.match(String(firmwareMotionProblem(snapmaker.replace('T1000.00', 'T400.00'), 3000, 500)), /acceleration/);
        assert.match(String(firmwareMotionProblem(snapmaker.replace('M201 X3000 Y3000', 'M201 X3000 Y300'), 3000, 500)), /acceleration/);
        assert.match(String(firmwareMotionProblem('ok', 3000, 500)), /unknown/);
    }],
];
