import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

import * as frameRecovery from '../frameRecovery';
import {
    FRAME_VERIFY_MIN_BEAT_DELAY_MS,
    FrameReading,
    WORK_FRAME_RESTORE_GCODE,
    frameRestoreIsWorthTrying,
    frameRestoreJobRefusal,
    resyncHint,
    verifyWorkFrame,
    workFrameVerificationNote,
} from '../frameRecovery';
import * as machinePosition from '../machinePosition';
import * as procedureLimits from '../procedureLimits';
import { resolveJobFrame, validateGcode } from '../validator';

// A350 travel, and the live 2026-09 work offset: work = machine + offset.
const BOUNDS = { min: { x: 0, y: 0, z: 0 }, max: { x: 345, y: 357, z: 334 } };
const OFFSET = { x: -51, y: -122, z: -328 };
const MACHINE = { x: 170, y: 199, z: 240 };
const WORK_RAW = { x: MACHINE.x + OFFSET.x, y: MACHINE.y + OFFSET.y, z: MACHINE.z + OFFSET.z };
const REPLY_AT = 100000;

function reading(over: Partial<FrameReading> = {}): FrameReading {
    return {
        reliability: 'heartbeat',
        frame: 'work-frame',
        reportedAt: REPLY_AT + FRAME_VERIFY_MIN_BEAT_DELAY_MS + 200,
        originOffset: { ...OFFSET },
        rawImpossibleAsMachine: true,
        ...over,
    };
}

type Result = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * tools/camera.ts in a vm with every server import stubbed, so the real
 * restore_work_frame handler runs against scripted position snapshots and a
 * fake clock (no timers, no channel, no machine).
 */
function restoreFixture(
    snapshots: object[],
    reply: { result: number; text?: string } = { result: 0, text: 'ok' },
    activeJob: object | null = null,
) {
    const source = fs.readFileSync(path.join(__dirname, '../tools/camera.ts'), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true,
    } });
    const dependencies: Record<string, unknown> = {};
    const pattern = /from ['"]([^'"]+)['"]/g;
    for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
        dependencies[match[1]] = {};
    }
    const sent: string[] = [];
    const clock = { now: REPLY_AT - 50 };
    const logger = () => ({ info: () => undefined, warn: () => undefined, debug: () => undefined, error: () => undefined });
    Object.assign(dependencies, {
        '../../../lib/logger': logger,
        '../procedureLimits': procedureLimits,
        '../machinePosition': machinePosition,
        '../frameRecovery': frameRecovery,
        '../index': { mcpBroadcast: () => undefined },
        '../positionOfRecord': { bumpGcodeSequence: () => 1, noteDirectGcodeStart: () => undefined, noteDirectGcodeEnd: () => undefined },
        '../diagnostics': { recordGcodeTiming: () => undefined },
        '../registry': { McpToolError: Error },
        '../failureRecovery': { recordModalSend: () => () => undefined, classifyReply: () => 'accepted', NotSentError: Error },
        '../jobs': { jobManager: { getActive: () => activeJob } },
        '../procedureAbort': { procedureStopRequested: () => null },
        '../probeFeed': { probeFeedService: { motionBegin: () => undefined, motionEnd: () => undefined } },
        './machine': { getPositionSnapshot: () => snapshots.shift(), machineBounds: () => BOUNDS },
        '../../machine/ConnectionManager': { connectionManager: {
            getConnectionStatus: () => ({ connected: true, machineIdentifier: 'A350' }),
            getConnectionGeneration: () => '1.0',
            getCurrentChannel: () => ({ executeGcode: async (gcode: string) => {
                sent.push(gcode);
                clock.now += 50;
                return reply;
            } }),
        } },
    });
    const exports = {} as Result;
    vm.runInNewContext(compiled.outputText, {
        exports,
        Date: { now: () => clock.now },
        setTimeout: (fn: () => void, ms: number) => { clock.now += ms; fn(); },
        clearTimeout: () => undefined,
        setInterval: () => 0,
        clearInterval: () => undefined,
        process: { env: { NODE_ENV: 'test' } },
        require: (name: string) => {
            if (!(name in dependencies)) { throw new Error(`Unstubbed dependency: ${name}`); }
            return dependencies[name];
        },
    });
    const tools: Map<string, { handler: (args: object) => Promise<Result> }> = new Map();
    exports.registerCameraTools({ register: (tool: { name: string; handler: (args: object) => Promise<Result> }) => tools.set(tool.name, tool) });
    const tool = tools.get('restore_work_frame');
    assert.ok(tool, 'restore_work_frame is registered');
    return { restore: tool.handler, sent };
}

/** A position snapshot as getPositionSnapshot returns it, judged on a beat stamped `reportedAt`. */
function snapshot(frame: string, reliability: string, raw: { x: number; y: number; z: number }, reportedAt: number | null) {
    return {
        reliability,
        frame,
        machine: { ...MACHINE },
        work: { ...raw },
        originOffset: { ...OFFSET },
        machineReportedAt: reportedAt,
        warnings: [],
    };
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['the frame restore carries no motion at all', () => {
        const report = validateGcode(WORK_FRAME_RESTORE_GCODE);
        assert.equal(report.motionLineCount, 0, 'no motion lines');
        assert.deepEqual(report.extents, { x: null, y: null, z: null, b: null }, 'no axis words');
        assert.equal(report.spindle.onCommands, 0);
        assert.equal(report.setsWorkOrigin, false, 'restoring the frame is not a G92 origin rewrite');
    }],

    ['the frame restore selects the work workspace and states its distance mode', () => {
        const report = validateGcode(WORK_FRAME_RESTORE_GCODE);
        assert.deepEqual(report.frame.workspaceSelects, ['G54'], 'G54 on its own line');
        assert.equal(report.assumesDistanceMode, false, 'G90 is explicit - the validator refuses a file that assumes it');
        assert.deepEqual(report.frame.inlineG53Lines, [], 'nothing is carried on a motion line');
        // `declared` answers "which frame is in force at the first MOVE", and
        // there is no move: a frame restore changes the workspace without
        // running in it. That is the whole point.
        assert.equal(report.frame.declared, null);
        assert.equal(report.frame.firstMotionLine, null);
    }],

    ['the frame restore would itself pass staging (it is a legal job, not a special case)', () => {
        const resolved = resolveJobFrame(validateGcode(WORK_FRAME_RESTORE_GCODE), {
            frameArgument: null,
            originOffsetZ: 0,
            offsetReliable: true,
            machineZMax: 328,
        });
        assert.equal(resolved.refusal, null, 'a no-motion job needs no frame handshake');
    }],

    ['an incoherent position is told to restore the frame, not to re-home', () => {
        const hint = resyncHint('awaiting-resync');
        assert.ok(/restore_work_frame/.test(hint), 'names the remedy');
        assert.ok(/no motion/.test(hint), 'says why it is allowed');
        assert.ok(/re-home is not the remedy/.test(hint));
    }],

    ['a stale position is told to reconnect - the frame is not the problem', () => {
        const hint = resyncHint('stale');
        assert.ok(/[Rr]econnect/.test(hint));
        assert.ok(!/restore_work_frame/.test(hint), 'a dead connection is not a frame fault');
    }],

    ['a usable position gets no hint at all', () => {
        assert.equal(resyncHint('verified'), '');
        assert.equal(resyncHint('heartbeat'), '');
        assert.equal(resyncHint('cached-offset'), '');
    }],

    ['the restore is worth trying exactly when the position is unusable', () => {
        assert.equal(frameRestoreIsWorthTrying('awaiting-resync'), true);
        assert.equal(frameRestoreIsWorthTrying('stale'), true);
        assert.equal(frameRestoreIsWorthTrying('verified'), false);
        assert.equal(frameRestoreIsWorthTrying('heartbeat'), false);
        assert.equal(frameRestoreIsWorthTrying('cached-offset'), false);
    }],

    ['workspace verification: a fresh work beat impossible as a machine position is the only proof', () => {
        assert.equal(verifyWorkFrame(reading(), REPLY_AT), 'verified');
        assert.equal(verifyWorkFrame(reading({ reliability: 'cached-offset' }), REPLY_AT), 'verified');
    }],

    ['workspace verification: a work beat that would also be a legal machine position is not proof', () => {
        assert.equal(verifyWorkFrame(reading({ rawImpossibleAsMachine: false }), REPLY_AT), 'consistent-unverified');
    }],

    ['workspace verification: a ~0 work offset can never be verified, whatever the beat says', () => {
        assert.equal(verifyWorkFrame(reading({ originOffset: { x: 0.5, y: -0.5, z: 0 } }), REPLY_AT), 'unverifiable-zero-offset');
        assert.equal(verifyWorkFrame(reading({ originOffset: { x: 0, y: 0, z: 0.51 } }), REPLY_AT), 'verified', 'just over 0.5 mm counts');
    }],

    ['workspace verification: a sustained machine-frame beat after the reply is still G53', () => {
        // The case the old before/after reliability check missed: it reads as 'heartbeat'.
        assert.equal(verifyWorkFrame(reading({ frame: 'machine-frame', rawImpossibleAsMachine: false }), REPLY_AT), 'machine-frame');
    }],

    ['workspace verification: nothing judged a poll period after the reply proves nothing', () => {
        assert.equal(verifyWorkFrame(null, REPLY_AT), 'no-fresh-beat');
        assert.equal(verifyWorkFrame(reading({ reportedAt: null }), REPLY_AT), 'no-fresh-beat');
        assert.equal(verifyWorkFrame(reading({ reportedAt: REPLY_AT + FRAME_VERIFY_MIN_BEAT_DELAY_MS - 1 }), REPLY_AT), 'no-fresh-beat');
        assert.equal(verifyWorkFrame(reading({ reportedAt: REPLY_AT + FRAME_VERIFY_MIN_BEAT_DELAY_MS }), REPLY_AT), 'verified', 'exactly one period counts');
        assert.equal(verifyWorkFrame(reading({ frame: 'machine-frame', reportedAt: REPLY_AT - 10 }), REPLY_AT), 'no-fresh-beat',
            'a machine-frame beat from before the reply says nothing about the restore');
        assert.equal(verifyWorkFrame(reading({ reliability: 'stale' }), REPLY_AT), 'no-fresh-beat');
        assert.equal(verifyWorkFrame(reading({ reliability: 'awaiting-resync', frame: 'undetermined' }), REPLY_AT), 'no-fresh-beat');
        // A controller echo is labelled machine-frame because it IS the machine position, not because of G53.
        assert.equal(verifyWorkFrame(reading({ reliability: 'verified', frame: 'machine-frame' }), REPLY_AT), 'no-fresh-beat');
    }],

    ['workspace verification notes name the next step for every outcome', () => {
        assert.ok(/back in the work workspace/.test(workFrameVerificationNote('verified', 'heartbeat')));
        assert.ok(/query_firmware_position/.test(workFrameVerificationNote('consistent-unverified', 'heartbeat')));
        assert.ok(/NOT proven/.test(workFrameVerificationNote('consistent-unverified', 'heartbeat')));
        assert.ok(/unverifiable, not wrong/.test(workFrameVerificationNote('unverifiable-zero-offset', 'heartbeat')));
        assert.ok(/Do not move/.test(workFrameVerificationNote('machine-frame', 'heartbeat')));
        assert.ok(/get_position again/.test(workFrameVerificationNote('no-fresh-beat', 'awaiting-resync')));
    }],

    ['restore_work_frame: a controller stuck in G53 and restored reports recovered (the old check said false)', async () => {
        // Before: sustained machine-frame, which already reads as 'heartbeat'.
        // After: a work-frame beat stamped 4 s after the reply; raw Z -88 is impossible as a machine Z.
        const { restore, sent } = restoreFixture([
            snapshot('machine-frame', 'heartbeat', MACHINE, REPLY_AT - 1000),
            snapshot('work-frame', 'heartbeat', WORK_RAW, REPLY_AT + 4000),
        ]);
        const result = await restore({ reason: 'test' });
        assert.deepEqual(sent, [WORK_FRAME_RESTORE_GCODE], 'one no-motion send');
        assert.equal(result.workspace_verification, 'verified');
        assert.equal(result.recovered, true);
        assert.equal(result.frame_before, 'machine-frame');
        assert.equal(result.frame_after, 'work-frame');
        assert.equal(result.before.frame, 'machine-frame', 'existing fields are kept');
        assert.equal(result.after.reliability, 'heartbeat');
        assert.ok(/back in the work workspace/.test(result.note));
    }],

    ['restore_work_frame: a usable but ambiguous position after the restore is not recovered', async () => {
        // awaiting-resync -> heartbeat used to report recovered: true, but this
        // raw report is ALSO a legal machine position, so the frame is unproven.
        const legalBothWays = { x: 120, y: 150, z: 100 };
        const { restore } = restoreFixture([
            snapshot('undetermined', 'awaiting-resync', legalBothWays, REPLY_AT - 3000),
            snapshot('work-frame', 'heartbeat', legalBothWays, REPLY_AT + 4000),
        ]);
        const result = await restore({});
        assert.equal(result.workspace_verification, 'consistent-unverified');
        assert.equal(result.recovered, false);
        assert.ok(/query_firmware_position/.test(result.note));
    }],

    ['restore_work_frame: still in the machine frame, or no beat yet, is never recovered', async () => {
        let fixture = restoreFixture([
            snapshot('machine-frame', 'heartbeat', MACHINE, REPLY_AT - 1000),
            snapshot('machine-frame', 'heartbeat', MACHINE, REPLY_AT + 4000),
        ]);
        let result = await fixture.restore({});
        assert.equal(result.workspace_verification, 'machine-frame');
        assert.equal(result.recovered, false);
        assert.ok(/Do not move/.test(result.note));

        fixture = restoreFixture([
            snapshot('machine-frame', 'heartbeat', MACHINE, REPLY_AT - 1000),
            snapshot('undetermined', 'awaiting-resync', WORK_RAW, REPLY_AT - 1000),
        ]);
        result = await fixture.restore({});
        assert.equal(result.workspace_verification, 'no-fresh-beat');
        assert.equal(result.recovered, false);
    }],

    ['restore_work_frame: a refused restore is never recovered, whatever the position reads', async () => {
        const { restore } = restoreFixture([
            snapshot('work-frame', 'heartbeat', WORK_RAW, REPLY_AT - 1000),
            snapshot('work-frame', 'heartbeat', WORK_RAW, REPLY_AT + 4000),
        ], { result: -1, text: 'busy' });
        const result = await restore({});
        assert.equal(result.recovered, false);
        assert.ok(/did not accept/.test(result.note));
    }],

    ['the frame restore is refused while a job is starting or running, and only then', () => {
        const job = (state: string) => ({ id: 'abc123', name: 'pocket.nc', kind: 'file', state });
        for (const state of ['starting', 'started']) {
            const refusal = frameRestoreJobRefusal(job(state));
            assert.ok(refusal, state);
            assert.ok(/abc123/.test(refusal) && /pocket\.nc/.test(refusal), 'names the job');
            assert.ok(/Nothing was sent/.test(refusal));
            assert.ok(/stop_gcode_job/.test(refusal) && /end/.test(refusal), 'says to wait for it or stop it');
        }
        for (const state of ['awaiting_confirmation', 'approved', 'rejected', 'start_failed', 'stopped', 'completed']) {
            assert.equal(frameRestoreJobRefusal(job(state)), null, state);
        }
        assert.equal(frameRestoreJobRefusal(null), null);
    }],

    ['restore_work_frame sends nothing into a running procedure or file job', async () => {
        for (const state of ['starting', 'started']) {
            const { restore, sent } = restoreFixture(
                [snapshot('machine-frame', 'heartbeat', MACHINE, REPLY_AT - 1000)],
                { result: 0, text: 'ok' },
                { id: 'p77', name: 'surface_scan', kind: 'procedure', state },
            );
            // eslint-disable-next-line no-await-in-loop
            await assert.rejects(restore({}), /procedure job p77 \("surface_scan"\) is (starting|started)/);
            assert.deepEqual(sent, [], 'nothing reached the controller');
        }
        const { restore, sent } = restoreFixture([
            snapshot('machine-frame', 'heartbeat', MACHINE, REPLY_AT - 1000),
            snapshot('work-frame', 'heartbeat', WORK_RAW, REPLY_AT + 4000),
        ], { result: 0, text: 'ok' }, { id: 'p78', name: 'done', kind: 'file', state: 'completed' });
        assert.equal((await restore({})).recovered, true, 'a finished job does not block the restore');
        assert.deepEqual(sent, [WORK_FRAME_RESTORE_GCODE]);
    }],
];
