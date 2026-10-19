/* eslint-disable camelcase */
import assert from 'assert';
import { WORKSPACES, WorkspaceIo, WorkspaceSnapshot, planWorkspace, runWorkspace, verifyWorkspaceForFile } from '../workspace';
import { resolveJobFrame, validateGcode } from '../validator';

function snapshot(): WorkspaceSnapshot {
    return { machine: { x: 230, y: 245, z: 328 }, work: { x: 60, y: 110, z: 120 }, originOffset: { x: -170, y: -135, z: -208 }, originOffsetSource: 'heartbeat', reliability: 'heartbeat', frame: 'work-frame', warnings: [], machineStatus: 'idle', isHomed: true, b: 90, isFourAxis: true, reportedAt: 1000, reportAgeMs: 0 };
}
const args = { workspace: 'G54', origin_machine: { x: 230, y: 245, z: 231.3 }, reason: 'Measured common datum', datum_reference: 'Top job 123; probe 70.95 mm, B0 registration retained at B90' };
function rig() {
    const s = snapshot();
    let time = 1000;
    let selected = 0;
    let invalidated = 0;
    const commands: string[] = [];
    const offsets = WORKSPACES.map((_, i) => ({ x: -170 - i, y: -135, z: -208 }));
    const io: WorkspaceIo = {
        snapshot: () => JSON.parse(JSON.stringify(s)),
        guard: () => undefined,
        send: async (code) => {
            commands.push(code);
            let text = '';
            for (const line of code.split('\n')) {
                const w = WORKSPACES.indexOf(line.replace(';', '') as typeof WORKSPACES[number]);
                if (w >= 0) { selected = w; text = `Select workspace ${w}`; }
                if (line.startsWith('G92')) {
                    for (const axis of ['x', 'y', 'z'] as const) {
                        const match = line.match(new RegExp(`${axis.toUpperCase()}(-?[\\d.]+)`));
                        assert(match);
                        const value = Number(match[1]);
                        offsets[selected][axis] = value - Number(s.machine[axis]);
                    }
                }
            }
            s.originOffset = { ...offsets[selected] };
            for (const axis of ['x', 'y', 'z'] as const) s.work[axis] = Number(s.machine[axis]) + s.originOffset[axis];
            return { result: 0, text };
        },
        invalidateApprovals: () => { invalidated++; },
        now: () => time,
        wait: async (ms) => { time += ms; s.reportedAt = time; },
    };
    return { s, commands, offsets, io, invalidated: () => invalidated };
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['workspace origin rejects missing, malformed, B/E and injected coordinate arguments', () => {
        for (const value of [undefined, {}, { x: 1, y: 2, z: NaN }, { x: 1, y: 2, z: Infinity }, { x: '1', y: 2, z: 3 }, { x: 1, y: 2, z: 3, b: 0 }]) {
            assert.throws(() => planWorkspace({ ...args, origin_machine: value }, snapshot(), true));
        }
        for (const workspace of ['G53', 'G59.4', 'G54\nG0 X0', undefined]) assert.throws(() => planWorkspace({ ...args, workspace }, snapshot(), true));
        assert.throws(() => planWorkspace({ ...args, datum_reference: '' }, snapshot(), true));
        assert.throws(() => planWorkspace({ ...args, reason: '' }, snapshot(), true));
        const plan = planWorkspace({ ...args, reason: 'abc\nG0 X0' }, snapshot(), true);
        assert.equal(validateGcode(plan.review).motionLineCount, 0);
    }],
    ['workspace requires fresh homed idle work-frame evidence', () => {
        for (const bad of [{ reportAgeMs: 10001 }, { reportedAt: NaN }, { isHomed: false }, { machineStatus: 'running' },
            { frame: 'machine-frame' }, { originOffsetSource: 'cached' }, { warnings: ['unreliable'] }, { b: null }]) {
            assert.throws(() => planWorkspace(args, { ...snapshot(), ...bad }, true));
        }
    }],
    ['stale pose, offset and B refuse before any selection or write', async () => {
        for (const change of [
            (s: WorkspaceSnapshot) => { s.machine.x = 231; },
            (s: WorkspaceSnapshot) => { s.originOffset.z = -200; },
            (s: WorkspaceSnapshot) => { s.b = 180; },
        ]) {
            const r = rig();
            const plan = planWorkspace(args, r.s, true);
            change(r.s);
            await assert.rejects(async () => runWorkspace(plan, r.io), /changed since/);
            assert.equal(r.commands.length, 0);
            assert.equal(r.invalidated(), 0);
        }
    }],
    ['missing or incorrect selection acknowledgement never sends G92', async () => {
        for (const text of ['', 'Select workspace 1', 'Unknown command G54']) {
            const r = rig();
            r.io.send = async (code) => { r.commands.push(code); return { result: 0, text }; };
            await assert.rejects(async () => runWorkspace(planWorkspace(args, r.s, true), r.io));
            assert(!r.commands.some((code) => code.includes('G92')));
            assert.equal(r.invalidated(), 2);
        }
    }],
    ['stale readbacks time out without an origin write', async () => {
        const r = rig();
        const initial = snapshot();
        r.io.snapshot = () => initial;
        await assert.rejects(async () => runWorkspace(planWorkspace(args, r.s, true), r.io), /Timed out/);
        assert(!r.commands.some((code) => code.includes('G92')));
    }],
    ['disagreeing fresh offsets cannot authorize a write', async () => {
        const r = rig();
        const wait = r.io.wait;
        r.io.wait = async (ms) => {
            await wait(ms);
            r.s.originOffset.x = r.s.originOffset.x === -170 ? -171 : -170;
            r.s.work.x = Number(r.s.machine.x) + r.s.originOffset.x;
        };
        await assert.rejects(async () => runWorkspace(planWorkspace(args, r.s, true), r.io), /Timed out/);
        assert(!r.commands.some((code) => code.includes('G92')));
    }],
    ['ignored G92 remains unverified, with no retry, rollback or recovery motion', async () => {
        const r = rig();
        const send = r.io.send;
        r.io.send = async (code) => {
            if (code.startsWith('G92')) { r.commands.push(code); return { result: 0, text: 'ok' }; }
            return send(code);
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await assert.rejects(async () => runWorkspace(planWorkspace(args, r.s, true), r.io), (err: any) => {
            assert.equal(err.partial.origin_write_attempted, true);
            assert.equal(err.partial.verified, false);
            return /Timed out/.test(err.message);
        });
        assert.equal(r.commands.filter((code) => code.includes('G92')).length, 1);
        assert.equal(validateGcode(r.commands.join('\n')).motionLineCount, 0);
    }],
    ['stop after selection prevents writing', async () => {
        const r = rig();
        const plan = planWorkspace(args, r.s, true);
        r.io.guard = () => { if (r.commands.length >= 2) throw new Error('operator stop'); };
        await assert.rejects(async () => runWorkspace(plan, r.io), /operator stop/);
        assert.equal(r.commands.length, 2);
    }],
    ['file verification re-selects the active G54 with no motion, no G92 and no invalidation', async () => {
        const r = rig();
        const result = await verifyWorkspaceForFile('G54', -208, r.io);
        assert.equal(result.verified, true);
        assert.equal(result.selectionChanged, false);
        assert.equal(r.invalidated(), 0);
        assert.deepEqual(r.commands, ['G21\nG53;', 'G54;\nM114']);
        assert.equal(validateGcode(r.commands.join('\n')).motionLineCount, 0);
    }],
    ['file verification refuses when G55 was active and G54 has a different Z offset', async () => {
        const r = rig();
        r.offsets[0].z = -200;
        r.s.originOffset = { ...r.offsets[1] };
        for (const axis of ['x', 'y', 'z'] as const) r.s.work[axis] = Number(r.s.machine[axis]) + r.s.originOffset[axis];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await assert.rejects(async () => verifyWorkspaceForFile('G54', -208, r.io), (err: any) => {
            assert.equal(err.partial.verified, false);
            assert.equal(err.partial.selection_changed, true);
            assert.equal(err.partial.motion, false);
            return /does not match the offset Z -208/.test(err.message);
        });
        assert.equal(r.invalidated(), 1, 'other staged jobs were resolved against the G55 offset');
        assert(!r.commands.some((code) => code.includes('G92')));
    }],
    ['file verification passes, and invalidates others, when a different active workspace shared G54 Z', async () => {
        const r = rig();
        r.s.originOffset = { ...r.offsets[1] };
        for (const axis of ['x', 'y', 'z'] as const) r.s.work[axis] = Number(r.s.machine[axis]) + r.s.originOffset[axis];
        const result = await verifyWorkspaceForFile('G54', -208, r.io);
        assert.equal(result.selectionChanged, true);
        assert.equal(r.invalidated(), 1);
    }],
    ['file verification sends nothing when the position of record is not coherent', async () => {
        const r = rig();
        r.s.reliability = 'awaiting-resync';
        await assert.rejects(async () => verifyWorkspaceForFile('G54', -208, r.io), /Cannot verify G54 before streaming/);
        assert.equal(r.commands.length, 0);
        assert.equal(r.invalidated(), 0);
    }],
    ['a missing selection acknowledgement fails verification and invalidates other approvals', async () => {
        const r = rig();
        r.io.send = async (code) => { r.commands.push(code); return { result: 0, text: '' }; };
        await assert.rejects(async () => verifyWorkspaceForFile('G54', -208, r.io), /did not acknowledge G54/);
        assert.equal(r.invalidated(), 1);
    }],
    ['named or mixed workspace files never inherit a misleading single live offset', () => {
        for (const code of ['G54\nG0 Z0\nG55\nG0 Z5', 'G59.3\nG0 Z0', 'G53\nG0 Z328\nG54\nG0 Z0']) {
            const result = resolveJobFrame(validateGcode(code), { originOffsetZ: -200, offsetReliable: true, machineZMax: 328 });
            assert.equal(result.refusal, null);
            assert.equal(result.report.machineZExtents, null);
            assert(result.report.warnings.some((w) => w.includes('UNRESOLVED')));
        }
    }],
];

for (const workspace of WORKSPACES) {
    tests.push([`${workspace} writes only its origin from a parked pose without axis motion`, async () => {
        const r = rig();
        const index = WORKSPACES.indexOf(workspace);
        const original = JSON.parse(JSON.stringify(r.offsets));
        const plan = planWorkspace({ ...args, workspace }, r.s, true);
        assert.deepEqual(plan.workAtWrite, { x: 0, y: 0, z: 96.7 });
        const result = await runWorkspace(plan, r.io) as { verified: boolean; motion: boolean };
        assert.equal(result.verified, true);
        assert.equal(result.motion, false);
        assert.deepEqual(r.s.machine, snapshot().machine);
        assert.equal(r.s.b, 90);
        r.offsets.forEach((offset, i) => {
            if (i !== index) assert.deepEqual(offset, original[i]);
            else assert(Math.abs(offset.z + 231.3) < 1e-6);
        });
        assert.equal(r.invalidated(), 2);
        assert.equal(validateGcode(r.commands.join('\n')).motionLineCount, 0);
        assert.equal(r.commands.length, 3);
        assert.deepEqual(validateGcode(`${workspace}\nG0 Z0`).frame.workspaceSelects, [workspace]);
    }]);
    tests.push([`${workspace} selection verifies its stored offset without rewriting it`, async () => {
        const r = rig();
        const original = JSON.parse(JSON.stringify(r.offsets));
        await runWorkspace(planWorkspace({ ...args, workspace }, r.s, false), r.io);
        assert.deepEqual(r.offsets, original);
        assert.equal(r.commands.length, 2);
        assert(!r.commands.some((code) => code.includes('G92')));
    }]);
}
