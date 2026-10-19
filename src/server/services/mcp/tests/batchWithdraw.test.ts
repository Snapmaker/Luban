// Stopping a direct batch between its steps (tyeth/Luban#320): the pure stop
// plan with a step context (jobEnding.ts), stop_gcode_job over the stubbed tool
// module on the Ray (no firmware stop over SACP-UDP) and the A350 (firmware
// stop), and the dashboard's Stop for a batch that is not the active job. No
// machine access.
import assert from 'assert';
import { DirectStepContext, planJobStop } from '../jobEnding';
import { summarizeDashboardJob } from '../jobDashboardState';
import type { McpJob } from '../jobs';
import { fixture } from './fileJobStart.test';
import { request } from './jobDashboard.test';

const STAY_POWER = 3;
const ray = () => fixture('direct-only', { dialect: 'ray-grbl', readMotorPowerMode: async () => STAY_POWER });

const LEGS = [
    '; mcp-settle machine X11.000 Y399.000\nM5\nG91\nG0 X10.000 Y0.000 F3000\nG90',
    '; mcp-settle machine X11.000 Y409.000\nM5\nG91\nG0 X0.000 Y10.000 F3000\nG90',
    '; mcp-settle machine X1.000 Y409.000\nM5\nG91\nG0 X-10.000 Y0.000 F3000\nG90',
];

const context = (change: Partial<DirectStepContext>): DirectStepContext => ({
    stepsLeft: 2, totalSteps: 3, stepInFlight: false, machineMoving: false, firmwareStop: false, ...change,
});

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['pure: between steps withdraws; a running step keeps the firmware stop where there is one', () => {
        assert.equal(planJobStop('direct', 'started', context({})).action, 'withdraw-remaining');
        assert.match(planJobStop('direct', 'started', context({})).note, /after step 1 of 3: the remaining 2 step\(s\) were never sent/);
        assert.equal(planJobStop('direct', 'started', context({ firmwareStop: true })).action, 'withdraw-remaining', 'the A350 too');
        assert.equal(planJobStop('direct', 'starting', context({ stepInFlight: true, stepsLeft: 1, firmwareStop: true })).action, 'machine-stop');
        assert.equal(planJobStop('direct', 'starting', context({ stepInFlight: true, stepsLeft: 1 })).action, 'withdraw-after-step');
        assert.match(planJobStop('direct', 'starting', context({ stepInFlight: true, stepsLeft: 1 })).note,
            /Step 2 of 3 is executing, and a running step cannot be stopped by firmware command over this transport/);
        assert.equal(planJobStop('direct', 'starting', context({ stepInFlight: true, stepsLeft: 0, totalSteps: 0 })).action, 'no-firmware-stop');
        // A step that was not awaited may still be moving: the firmware stop where there is one, else withdraw and say so.
        assert.equal(planJobStop('direct', 'started', context({ machineMoving: true, firmwareStop: true })).action, 'machine-stop');
        const moving = planJobStop('direct', 'started', context({ machineMoving: true }));
        assert.equal(moving.action, 'withdraw-remaining');
        assert.match(moving.note, /may still be moving, and a running step cannot be stopped by firmware command/);
        // Without the context, and for other kinds, the plan is what it was.
        assert.equal(planJobStop('direct', 'started').action, 'machine-stop');
        assert.equal(planJobStop('file', 'started', context({})).action, 'machine-stop');
        assert.equal(planJobStop('direct', 'approved', context({})).action, 'withdraw');
        assert.equal(planJobStop('direct', 'stopped', context({})).action, 'already-ended');
    }],
    ['Ray: a batch stopped between steps is withdrawn, nothing is sent and the next leg cannot start', async () => {
        const f = ray(); const job = f.createDirectBatch(LEGS);
        await f.startDirect(job);
        assert.equal(f.executed.length, 1);
        f.setPosition({ at: { x: 11 } });
        const result = await f.stop(job);
        assert.equal(result.withdrawn, true); assert.equal(result.stopped, true);
        assert.equal(job.state, 'stopped'); assert.equal(job.ending?.kind, 'withdrawn');
        assert.match(job.ending?.reason || '', /between steps/);
        assert.equal(job.confirmToken, null);
        assert.equal(f.executed.length, 1, 'nothing sent by the stop');
        assert.equal(f.counts().stops, 0);
        await assert.rejects(f.startDirect(job), /not approved/);
        assert.equal(f.executed.length, 1);
    }],
    ['Ray: stop during a running step withdraws the rest; the step finishes and the job ends withdrawn', async () => {
        const f = ray(); const job = f.createDirectBatch(LEGS);
        let during: { stopping?: boolean; withdrawn?: boolean; note?: string } = {};
        f.setOnExecute(async () => { during = await f.stop(job); });
        const result = await f.startDirect(job);
        assert.equal(during.stopping, true); assert.equal(during.withdrawn, true);
        assert.match(during.note || '', /cannot be stopped by firmware command over this transport.*\(machine: direct-only\)/);
        assert.equal(job.state, 'stopped'); assert.equal(job.ending?.kind, 'withdrawn');
        assert.match(job.ending?.reason || '', /during step 1 of 3; the remaining 2 step\(s\) were never sent/);
        assert.match(result.note, /remaining steps were withdrawn/);
        assert.equal(f.executed.length, 1);
        f.setOnExecute(async () => undefined);
        await assert.rejects(f.startDirect(job), /not approved/);
        assert.equal(f.executed.length, 1);
    }],
    ['Ray: a single running move reports that it cannot be stopped by firmware command', async () => {
        const f = ray(); const job = f.createDirectJob();
        let refusal = '';
        f.setOnExecute(async () => { await f.stop(job).catch((err: Error) => { refusal = err.message; }); });
        await f.startDirect(job);
        assert.match(refusal, /cannot be stopped by firmware command over this transport; nothing is left to withdraw/);
    }],
    ['A350: between steps withdraws with no firmware stop; a running step still gets it', async () => {
        const f = fixture(); const job = f.createDirectBatch(LEGS.map((leg) => leg.replace(/^; mcp-settle.*\n/, '')));
        await f.startDirect(job);
        await f.stop(job);
        assert.equal(job.ending?.kind, 'withdrawn'); assert.equal(f.counts().stops, 0);
        const g = fixture(); const running = g.createDirectBatch(LEGS);
        g.setOnExecute(async () => { await g.stop(running); });
        await g.startDirect(running).catch(() => undefined);
        assert.equal(g.counts().stops, 1, 'the firmware stop, as before');
        assert.equal(running.ending?.kind, 'machine-stopped');
    }],
    ['dashboard: Stop is offered and accepted for a batch between steps that is not the active job', async () => {
        const f = ray(); const job = f.createDirectBatch(LEGS);
        await f.startDirect(job);
        assert.equal(f.manager.getActive(), null);
        assert.equal((summarizeDashboardJob(job) as { betweenSteps: boolean }).betweenSteps, true);
        const stopped: string[] = [];
        const response = await request(f.manager, `/jobs/${job.id}/stop`, 'POST', { 'x-luban-job-action': '1' },
            async (id) => { stopped.push(id); return { ok: true }; });
        assert.equal(response.status, 200); assert.deepEqual(stopped, [job.id]);
        const staged = f.createDirectBatch(LEGS) as McpJob;
        assert.equal((summarizeDashboardJob(staged) as { betweenSteps: boolean }).betweenSteps, false);
        assert.equal((await request(f.manager, `/jobs/${staged.id}/stop`, 'POST', { 'x-luban-job-action': '1' })).status, 409);
    }],
];
