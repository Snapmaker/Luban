// The head-position re-check at the start of a direct job and between the
// steps of a batch (tyeth/Luban#323): the pure judgement (startPosition.ts) and
// start_gcode_job over the stubbed tool module on the Ray (relative steps) and
// the A350 (absolute G53 steps, unchecked). No machine access.
import assert from 'assert';
import { HEAD_MOVED, expectedStepStart, startPositionRefusal } from '../startPosition';
import { fixture } from './fileJobStart.test';

const STAY_POWER = 3;
const ray = () => fixture('direct-only', { dialect: 'ray-grbl', readMotorPowerMode: async () => STAY_POWER });

/** Two Ray legs from (1, 399): +10 X, then +10 Y, each naming its endpoint. */
const LEGS = [
    '; mcp-settle machine X11.000 Y399.000\nM5\nG91\nG0 X10.000 Y0.000 F3000\nG90',
    '; mcp-settle machine X11.000 Y409.000\nM5\nG91\nG0 X0.000 Y10.000 F3000\nG90',
];

const at = (x: number | null, y: number | null, z: number | null = null) => ({ x, y, z });

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['pure: the first step starts from the staging position, a later one from the previous settle line', () => {
        const job = { steps: LEGS, stagedAtMachine: at(1, 399, 0) };
        assert.deepEqual(expectedStepStart(job, 0).at, at(1, 399, 0));
        assert.deepEqual(expectedStepStart(job, 1).at, at(11, 399, 0), 'Z carried forward from staging');
        assert.deepEqual(expectedStepStart({ stagedAtMachine: at(5, 6, 7) }, 0).at, at(5, 6, 7), 'a single move');
        assert.equal(expectedStepStart({ stagedAtMachine: null }, 0).at, null, 'unreadable at staging');
        assert.equal(expectedStepStart({ steps: ['G91\nG0 X1\nG90', 'G0 X2'], stagedAtMachine: at(0, 0) }, 1).at, null,
            'a step without a settle line names no endpoint');
        // move_z on the Original: Z steps name Z, and a later XY-only step keeps it.
        const z = { steps: ['; mcp-settle machine X5.000 Y5.000 Z40.000\nG91\nG1 X0 Y0 Z10\nG90', '; mcp-settle machine X6.000 Y5.000\nG91', 'G0'],
            stagedAtMachine: at(5, 5, 30) };
        assert.deepEqual(expectedStepStart(z, 1).at, at(5, 5, 40));
        assert.deepEqual(expectedStepStart(z, 2).at, at(6, 5, 40));
    }],
    ['pure: within POSITION_EPSILON_MM runs; beyond it, unhomed or unreliable refuses with the #323 lead', () => {
        const expected = { at: at(1, 399, 0), basis: 'staging' };
        const base = { expected, reliability: 'heartbeat' as const, isHomed: true, hasZ: false };
        assert.equal(startPositionRefusal({ ...base, current: at(1.03, 398.97, 12) }), null, '0.03 mm passes; Z ignored with no Z axis');
        assert.match(startPositionRefusal({ ...base, current: at(6, 399, 0) }) || '', /head moved since staging - withdraw and restage.*X planned 1\.000, now 6\.000/);
        assert.match(startPositionRefusal({ ...base, current: at(1, 399, 0), isHomed: false }) || '', /does not report homed/);
        assert.match(startPositionRefusal({ ...base, current: at(1, 399, 0), isHomed: null }) || '', /does not report homed/);
        assert.match(startPositionRefusal({ ...base, current: at(1, 399, 0), reliability: 'awaiting-resync' }) || '', /awaiting-resync/);
        assert.match(startPositionRefusal({ ...base, current: at(null, 399, 0) }) || '', /X unknown/);
        assert.match(startPositionRefusal({ ...base, expected: { at: null, basis: 'nothing' }, current: at(1, 399) }) || '', /unknown \(nothing\)/);
        assert.match(startPositionRefusal({ ...base, hasZ: true, current: at(1, 399, 0.5) }) || '', /Z planned 0\.000, now 0\.500/);
        for (const reason of [startPositionRefusal({ ...base, current: at(9, 9) }), startPositionRefusal({ ...base, current: at(1, 399), isHomed: false })]) {
            assert.ok((reason || '').startsWith(HEAD_MOVED));
        }
    }],
    ['Ray: stage, move, start - refused, token unconsumed, nothing sent', async () => {
        const f = ray(); const job = f.createDirectJob();
        f.setPosition({ at: { x: 6 } });
        await assert.rejects(f.startDirect(job), (err: Error) => /Refusing to start this job: the head moved since staging - withdraw and restage/
            .test(err.message)
            && /Nothing was sent and the approval was not used/.test(err.message) && /\(machine: direct-only\)/.test(err.message));
        assert.equal(job.tokenUsed, false); assert.equal(job.state, 'approved');
        assert.deepEqual(f.executed, []);
        assert.ok(job.events.some((event) => event.phase === 'start_refused'));
        // Moved back to where it was planned from, the approved increment is right again.
        f.setPosition({ at: { x: 1 } });
        await f.startDirect(job);
        assert.equal(f.executed.length, 1);
    }],
    ['Ray: stage then start with no move runs', async () => {
        const f = ray(); const job = f.createDirectJob();
        assert.deepEqual(job.stagedAtMachine, at(1, 399, 0));
        await f.startDirect(job);
        assert.equal(job.state, 'completed'); assert.equal(f.executed.length, 1);
    }],
    ['Ray: unhomed (restarted) and unreadable-at-staging are refused before the token', async () => {
        const f = ray(); const job = f.createDirectJob();
        f.setPosition({ isHomed: false, at: { x: 0, y: 0 } });
        await assert.rejects(f.startDirect(job), /does not report homed/);
        assert.equal(job.tokenUsed, false); assert.deepEqual(f.executed, []);
        const g = ray();
        g.setPosition({ at: { x: null } });
        const blind = g.createDirectJob();
        g.setPosition({ at: { x: 1 } });
        await assert.rejects(g.startDirect(blind), /X unknown/);
        assert.deepEqual(g.executed, []);
    }],
    ['Ray batch: step 2 starts from step 1\'s endpoint and is refused after an external move', async () => {
        const f = ray(); const job = f.createDirectBatch(LEGS);
        await f.startDirect(job);
        assert.equal(f.executed.length, 1); assert.equal(job.nextStep, 1);
        // Step 1 arrived (within 0.03 mm), then the head is jogged 5 mm in Luban.
        f.setPosition({ at: { x: 11.03, y: 399 } });
        f.setPosition({ at: { x: 16 } });
        await assert.rejects(f.startDirect(job), /Refusing to start step 2\/2: the head moved since staging - withdraw and restage.*step 1's planned endpoint/);
        assert.equal(job.tokenUsed, false); assert.equal(f.executed.length, 1);
        f.setPosition({ at: { x: 11.03 } });
        await f.startDirect(job);
        assert.equal(f.executed.length, 2); assert.equal(job.state, 'completed');
    }],
    ['A350: unchanged - absolute steps are not checked and send exactly as before', async () => {
        const f = fixture(); const job = f.createDirectJob();
        f.setPosition({ at: { x: 200 }, isHomed: false });
        await f.startDirect(job);
        assert.deepEqual(f.executed, ['M5\nG91\nG0 X10 Y0\nG90']);
        assert.equal(job.state, 'completed');
        assert.ok(!job.events.some((event) => event.phase === 'start_refused'));
    }],
];
