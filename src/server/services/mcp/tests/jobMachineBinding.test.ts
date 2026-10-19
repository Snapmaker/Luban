import { strict as assert } from 'assert';

import type { JobManager, McpJob } from '../jobs';
import { StagedMachine, machineBindingRefusal } from '../jobMachineBinding';
import { isolatedModule } from './jobDashboard.test';

const A350: StagedMachine = { identifier: 'Snapmaker 2.0 A350', dialect: 'sm2-marlin', deviceSerial: null };
const A350_SN1: StagedMachine = { ...A350, deviceSerial: 'SN-0001' };
const A350_SN2: StagedMachine = { ...A350, deviceSerial: 'SN-0002' };
const RAY: StagedMachine = { identifier: 'Ray', dialect: 'ray-grbl', deviceSerial: null };

/** jobs.ts with its server dependencies stubbed (as in jobDashboard.test.ts) and a switchable connected machine. */
function managerWith(connected: { current: StagedMachine | null }): JobManager {
    const files = new Map<string, string>();
    const loaded = isolatedModule('jobs.ts', {
        'fs-extra': {
            ensureDirSync: () => undefined,
            writeFileSync: (name: string, text: string) => files.set(name, text),
            readFileSync: (name: string) => files.get(name),
            remove: async (name: string) => files.delete(name),
        },
        '../../DataStorage': { tmpDir: '/fake', userDataDir: '/fake' },
        '../../lib/logger': () => ({ info: () => undefined }),
        '../configstore': { get: () => undefined },
        './gcodeIntake': require('../gcodeIntake'),
        './jobEnding': require('../jobEnding'),
        './jobDashboardState': require('../jobDashboardState'),
        './telemetryConfig': require('../telemetryConfig'),
        './jobMachineBinding': require('../jobMachineBinding'),
        './activeTool': { describeActiveTool: () => ({ active: null }) },
    });
    const manager: JobManager = new loaded.JobManager();
    manager.setMachineSource(() => connected.current);
    return manager;
}

const VALIDATION = { warnings: [], extents: {}, spindle: {}, motionLineCount: 0 } as unknown as McpJob['validation'];

function approve(job: McpJob): void {
    job.state = 'approved';
    job.confirmToken = 'human-token';
    job.approvedAt = Date.now();
}

export const tests: Array<[string, () => void]> = [
    ['the same machine may approve and start; a different model is refused naming both, nothing sent', () => {
        assert.equal(machineBindingRefusal(A350, A350, 'start'), null);
        const refusal = machineBindingRefusal(A350, RAY, 'start');
        assert.ok(refusal);
        assert.ok(refusal.includes('Snapmaker 2.0 A350 (sm2-marlin)') && refusal.includes('Ray (ray-grbl)'), refusal);
        assert.ok(refusal.includes('Nothing was sent.'), refusal);
        const approval = machineBindingRefusal(A350, RAY, 'approve');
        assert.ok(approval && approval.startsWith('Approval refused') && approval.includes('nothing was sent'), approval || '');
    }],
    ['a different serial of the same model is refused; a serial on one side only is not judged', () => {
        assert.ok((machineBindingRefusal(A350_SN1, A350_SN2, 'start') || '').includes('SN-0002'));
        assert.equal(machineBindingRefusal(A350_SN1, A350, 'start'), null, 'the same A350 over SSTP or USB reports no serial');
        assert.equal(machineBindingRefusal(A350, A350_SN1, 'start'), null);
        assert.equal(machineBindingRefusal(A350_SN1, A350_SN1, 'approve'), null);
    }],
    ['staged with nothing connected: refused once a machine is; unrecorded jobs and no connection are not judged here', () => {
        assert.ok((machineBindingRefusal(null, A350, 'start') || '').includes('no machine connected'));
        assert.equal(machineBindingRefusal(undefined, RAY, 'start'), null);
        assert.equal(machineBindingRefusal(A350, null, 'approve'), null, 'start refuses a job with no machine by itself');
    }],
    ['JobManager: a job staged on the A350 records it, and its token is refused after a switch to the Ray', () => {
        const connected: { current: StagedMachine | null } = { current: A350 };
        const manager = managerWith(connected);
        const job = manager.submit('G90\n', 'cut', 'cnc', VALIDATION);
        assert.deepEqual(job.stagedFor, A350);
        assert.deepEqual((manager.describe(job) as { [key: string]: unknown }).staged_for, A350);
        approve(job);
        connected.current = RAY;
        const verdict = manager.consumeToken(job, 'human-token');
        assert.equal(verdict.ok, false);
        assert.ok((verdict.reason || '').includes('Ray (ray-grbl)'), verdict.reason);
        assert.equal(job.tokenUsed, false, 'the token is not spent by a refused start');
        connected.current = A350;
        assert.equal(manager.consumeToken(job, 'human-token').ok, true, 'back on the A350 the same approval starts it');
    }],
    ['JobManager: policy approval refuses a job staged for another machine', () => {
        const connected: { current: StagedMachine | null } = { current: RAY };
        const manager = managerWith(connected);
        const job = manager.submit('G91\nG1 X1 F600\nG90\n', 'step', 'laser', VALIDATION, 'direct');
        connected.current = A350;
        assert.throws(() => manager.approveByPolicy(job, 'test-policy', 'test'), /Approval refused/);
        assert.equal(job.state, 'awaiting_confirmation');
    }],
];
