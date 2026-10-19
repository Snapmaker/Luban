/* eslint-disable camelcase */
// set_motor_power and the two operator-only approval-free settings
// (tyeth/Luban#326): the pure settings helpers (motionRules.ts), the stored
// settings and set_machine_policy's refusal over the real store
// (tools/machine.ts), the released-motors latch in getPositionSnapshot, and
// the tool itself over the real connectedMachine.ts setter and the real
// camera.ts home on a stub Ray channel. No machine access.
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as jobEnding from '../jobEnding';
import * as motionRules from '../motionRules';
import * as motorPower from '../motorPower';
import { McpToolError } from '../registry';
import type { McpJob } from '../jobs';
import { isolatedModule } from './jobDashboard.test';
import { managerFixture } from './jobModalRecovery.test';
import { machineToolsFixture } from './machineStore.test';
import { machineToolsFixture as positionFixture } from './connectionLease.test';
import { cameraFixture } from './sstpConnection.test';
import { connectedMachineFor } from './motorPower.test';
import { fixture as jobFixture } from './fileJobStart.test';

const RAY = 'Ray';
const A350 = 'Snapmaker 2.0 A350';
const SHUT_ALL = 1;
const STAY_POWER = 3;
const ON = { value: true, source: 'settings', setAt: 1 };

/** set_motor_power over the real setter (connectedMachine.ts) and the real Ray home (camera.ts), sharing one command log. */
function switchFixture(options: { machine?: string; settingOn?: boolean; initialMode?: number } = {}) {
    const machine = options.machine || RAY;
    const ray = machine === RAY;
    const mode = { value: options.initialMode ?? SHUT_ALL };
    const { camera, commands } = cameraFixture(ray, async () => mode.value);
    const channel = {
        executeGcode: async (gcode: string) => { commands.push(gcode); return { result: 0, text: 'ok' }; },
        getMotorPowerMode: async () => mode.value,
        setMotorPowerMode: async (byte: number) => { commands.push(`0x48:${byte === STAY_POWER ? 'STAYPOWER' : 'SHUTAll'}`); mode.value = byte; return byte; },
    };
    const connected = connectedMachineFor(machine, channel);
    const files = new Map<string, string>();
    const manager = managerFixture(files);
    const dependencies: Record<string, unknown> = {};
    const source = fs.readFileSync(path.join(__dirname, '../tools/motorPower.ts'), 'utf8');
    for (const match of source.matchAll(/from '([^']+)'/g)) dependencies[match[1]] = {};
    const settings = { on: options.settingOn === true };
    Object.assign(dependencies, {
        '../../machine/ConnectionManager': { connectionManager: { getCurrentChannel: () => channel } },
        '../connectedMachine': connected,
        '../jobs': { jobManager: manager },
        '../machineStore': { machineStore: { currentMachine: () => ({ machineKey: machine }) } },
        '../motionRules': motionRules,
        '../motorPower': motorPower,
        '../probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined } },
        '../registry': { McpToolError },
        './camera': {
            // The real home on the Ray: M5 then $H, its own motor-power read first (not awaited: no heartbeats here).
            homeMachine: (tool: string) => camera.homeMachine(tool, false, true),
            sendGcodeVisible: async (target: typeof channel, _tool: string, payload: string) => target.executeGcode(payload),
        },
        './machine': {
            approvalFreeSettingsFor: () => ({ motorMode: { on: settings.on }, moves: { on: false } }),
            assertFreshHeartbeat: () => undefined,
            getPositionSnapshot: () => ({ machineStatus: 'idle' }),
        },
        './operatorInstruction': { OPERATOR_INSTRUCTION_POLICY: 'operator-instruction' },
        './staging': { validateStagedEnvelope: () => ({ warnings: [] }) },
    });
    const loaded = isolatedModule('tools/motorPower.ts', dependencies);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers: Record<string, (args: object) => Promise<any>> = {};
    loaded.registerMotorPowerTools({ register: (tool: { name: string; handler: typeof handlers[string] }) => { handlers[tool.name] = tool.handler; } },
        () => 'http://localhost');
    return { call: handlers.set_motor_power, manager, commands, mode, files, settings };
}

/**
 * "Allow moves without an approval page" (tools/operatorInstruction.ts) over the
 * real runPolicyApprovedDirectJob of the start fixture: a Ray (or A350) direct
 * job staged and NOT approved, the setting and the judged position adjustable.
 */
function movesFixture(options: { dialect?: 'ray-grbl' | 'sm2-marlin'; settingOn?: boolean; motorMode?: number } = {}) {
    const motor = { value: options.motorMode ?? STAY_POWER };
    const f = jobFixture('direct-only', { dialect: options.dialect || 'ray-grbl', readMotorPowerMode: async () => motor.value });
    const setting = { on: options.settingOn === true };
    const position = { isHomed: true as boolean | null, reliability: 'heartbeat' };
    const dependencies: Record<string, unknown> = {};
    const source = fs.readFileSync(path.join(__dirname, '../tools/operatorInstruction.ts'), 'utf8');
    for (const match of source.matchAll(/from '([^']+)'/g)) dependencies[match[1]] = {};
    Object.assign(dependencies, {
        '../jobs': { jobManager: f.manager },
        '../machinePosition': require('../machinePosition'),
        '../motionRules': motionRules,
        '../machineStore': { machineStore: { currentMachine: () => ({ machineKey: RAY }) } },
        './gcode': { runPolicyApprovedDirectJob: f.loaded.runPolicyApprovedDirectJob },
        './machine': {
            approvalFreeSettingsFor: () => ({ moves: { on: setting.on }, motorMode: { on: false } }),
            getPositionSnapshot: () => position,
        },
    });
    const helper = isolatedModule('tools/operatorInstruction.ts', dependencies);
    const stage = () => {
        const validation = { warnings: [], extents: {}, spindle: {}, motionLineCount: 1 } as unknown as McpJob['validation'];
        return f.manager.submit('; mcp-settle machine X11.000 Y399.000\nM5\nG91\nG0 X10.000 Y0.000\nG90', 'traverse', 'cnc', validation, 'direct');
    };
    return { f, helper, stage, setting, position, motor };
}

/** Approve a staged job as the confirm page does and run its runner as start_gcode_job's procedure path does. */
async function approveAndRun(job: McpJob): Promise<object> {
    job.state = 'started';
    return (job.runner as () => Promise<object>)();
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['settings: parsed per machine, on only when the operator\'s click stated it; the instruction is trimmed or null', () => {
        const section = motionRules.motionRulesOf({ motionRules: {
            movesWithoutApprovalPage: ON,
            motorModeWithoutApprovalPage: { value: true, source: 'set_machine_policy', setAt: 2 },
            computedHeight: 'garbage',
        } });
        assert.equal(motionRules.operatorSettingOn(section.movesWithoutApprovalPage), true);
        assert.equal(motionRules.operatorSettingOn(section.motorModeWithoutApprovalPage), false, 'any other writer reads off');
        assert.equal(motionRules.operatorSettingOn(undefined), false, 'default off');
        assert.equal(motionRules.operatorInstructionOf('  move to the corner  '), 'move to the corner');
        assert.equal(motionRules.operatorInstructionOf('   '), null);
        assert.equal(motionRules.operatorInstructionOf(42), null);
    }],
    ['settings: default off; only the operator\'s pane turns them on; the motor-mode one is refused off the Ray', () => {
        const f = machineToolsFixture();
        f.connect({ machineIdentifier: RAY });
        const before = f.tools.approvalFreeSettingsFor(RAY);
        assert.equal(before.moves.on, false); assert.equal(before.motorMode.on, false);
        assert.equal(before.motorMode.applies, true);
        f.tools.setMotionRuleFromSettings({ machineKey: RAY, movesWithoutApprovalPage: true, motorModeWithoutApprovalPage: true });
        const after = f.tools.approvalFreeSettingsFor(RAY);
        assert.equal(after.moves.on, true); assert.equal(after.motorMode.on, true); assert.equal(after.moves.source, 'settings');
        const described = f.tools.describeMotionRules().machines.find((m: { machineKey: string }) => m.machineKey === RAY);
        assert.equal(described.approvalFree.motorMode.on, true);
        f.connect({ machineIdentifier: A350 });
        assert.equal(f.tools.approvalFreeSettingsFor(A350).motorMode.applies, false);
        assert.throws(() => f.tools.setMotionRuleFromSettings({ machineKey: A350, motorModeWithoutApprovalPage: true }), /no motor-power mode/);
        assert.equal(f.tools.approvalFreeSettingsFor(A350).moves.on, false, 'the A350 stays off unless its operator turns it on');
    }],
    ['set_machine_policy cannot change either setting, on or off; a measured-value write keeps them', () => {
        const f = machineToolsFixture();
        f.connect({ machineIdentifier: RAY });
        f.tools.setMotionRuleFromSettings({ machineKey: RAY, movesWithoutApprovalPage: true });
        for (const args of [{ moves_without_approval_page: true }, { motor_mode_without_approval_page: true }, { moves_without_approval_page: false },
            { motor_mode_without_approval_page: null, travel_fudge_mm: 10 }]) {
            const writes = f.writes.length;
            assert.throws(() => f.tools.setMachinePolicy({ ...args, reason: 'agent' }),
                (err: Error) => /can only be changed by the operator, in Luban's Settings > MCP > Motion rules/.test(err.message)
                    && /Nothing was changed/.test(err.message), JSON.stringify(args));
            assert.equal(f.writes.length, writes, 'nothing written');
        }
        // A write through set_machine_policy that rewrites the motion-rules section keeps the operator's settings.
        f.tools.setMachinePolicy({ toolhead_body_below_reference_mm: 3, reason: 'measured' });
        assert.equal(f.tools.approvalFreeSettingsFor(RAY).moves.on, true);
    }],
    ['position: released motors read unhomed with the reason on that machine only, until a home clears the latch', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'released-'));
        try {
            const f = positionFixture(dir);
            assert.equal(f.tools.getPositionSnapshot().isHomed, true);
            motorPower.noteMotorsReleased({ machineIdentifier: 'Ray', at: 1, by: 'test' });
            assert.equal(f.tools.getPositionSnapshot().isHomed, true, 'another machine\'s latch does not touch this one');
            motorPower.noteMotorsReleased({ machineIdentifier: 'A350', at: 1, by: 'set_motor_power job abc' });
            const released = f.tools.getPositionSnapshot();
            assert.equal(released.isHomed, false);
            assert.ok(released.warnings.some((w: string) => /motors were released .*set_motor_power job abc/.test(w)));
            motorPower.clearMotorsReleased('A350');
            assert.equal(f.tools.getPositionSnapshot().isHomed, true);
        } finally {
            motorPower.clearMotorsReleased();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }],
    ['control stages a confirm page and sends nothing; approved, it sends STAYPOWER, then M5 and $H', async () => {
        const f = switchFixture();
        const staged = await f.call({ mode: 'control', reason: 'operator asked for Control Mode' });
        assert.match(staged.confirm_url, /\/confirm\//);
        assert.equal(staged.job.kind, 'procedure');
        assert.match(staged.staged_because, /always stages/);
        assert.deepEqual(f.commands, [], 'nothing sent at staging');
        const job = f.manager.get(staged.job.id) as McpJob;
        assert.equal(job.motorPowerSwitch, 'control');
        assert.match(f.files.get(job.filePath) || '', /STAYPOWER \(3\)[\s\S]*M5 \(laser off\), then \$H\. THE HEAD MOVES/);
        const result = await approveAndRun(job) as { mode: string; motor_power: { mode: string } };
        assert.deepEqual(f.commands, ['0x48:STAYPOWER', 'M5', '$H']);
        assert.equal(result.mode, 'control'); assert.equal(result.motor_power.mode, 'STAYPOWER');
        assert.ok(job.events.some((event) => event.phase === 'motor_power_set'));
    }],
    ['manual stages; approved, it sends M5 then SHUTAll and the position is untrusted until a home', async () => {
        try {
            const f = switchFixture({ initialMode: STAY_POWER });
            const staged = await f.call({ mode: 'manual', reason: 'operator wants to push the head' });
            assert.deepEqual(f.commands, []);
            const job = f.manager.get(staged.job.id) as McpJob;
            assert.match(f.files.get(job.filePath) || '', /SHUTAll \(1\)[\s\S]*UNTRUSTED/);
            const result = await approveAndRun(job) as { position_untrusted: boolean };
            assert.deepEqual(f.commands, ['M5', '0x48:SHUTAll']);
            assert.equal(result.position_untrusted, true);
            assert.match(motorPower.motorsReleasedFor('Ray')?.by || '', new RegExp(`job ${job.id} \\(operator-approved\\)`));
            // A later start is refused: the snapshot reads unhomed (above), which the start re-check (#323) refuses.
            const g = jobFixture('direct-only', { dialect: 'ray-grbl', readMotorPowerMode: async () => STAY_POWER });
            const move = g.createDirectJob();
            g.setPosition({ isHomed: false });
            await assert.rejects(g.startDirect(move), /does not report homed/);
            assert.deepEqual(g.executed, []);
            // Control homes, which clears the latch.
            const back = await f.call({ mode: 'control', reason: 'back to Control Mode' });
            await approveAndRun(f.manager.get(back.job.id) as McpJob);
            assert.equal(motorPower.motorsReleasedFor('Ray'), null);
        } finally {
            motorPower.clearMotorsReleased();
        }
    }],
    ['setting off: an instruction still stages; setting on without one stages; on with one runs on the call and records the quote', async () => {
        const off = switchFixture();
        const staged = await off.call({ mode: 'control', reason: 'r', operator_instruction: 'switch to control mode' });
        assert.match(staged.staged_because, /is off for this machine - only the operator turns it on/);
        assert.deepEqual(off.commands, []);
        const noQuote = switchFixture({ settingOn: true });
        assert.match((await noQuote.call({ mode: 'control', reason: 'r' })).staged_because, /no operator_instruction was given/);
        assert.deepEqual(noQuote.commands, []);
        const on = switchFixture({ settingOn: true });
        const ran = await on.call({ mode: 'control', reason: 'r', operator_instruction: '  Put the Ray in control mode please ' });
        assert.equal(ran.executed_without_approval, true);
        assert.equal(ran.operator_instruction, 'Put the Ray in control mode please');
        assert.equal(ran.approval_free_setting, motionRules.MOTOR_MODE_WITHOUT_APPROVAL_TOGGLE);
        assert.deepEqual(on.commands, ['0x48:STAYPOWER', 'M5', '$H']);
        const job = on.manager.get(ran.job.id) as McpJob;
        assert.equal(job.state, 'completed'); assert.equal(job.approval?.policy, 'operator-instruction');
        assert.ok(job.events.some((event) => event.phase === 'operator_instruction' && event.operator_instruction === 'Put the Ray in control mode please'));
    }],
    ['moves: setting off stages (an instruction is reported unused); on without an instruction stages; nothing is sent', async () => {
        const m = movesFixture();
        const job = m.stage();
        const off = await m.helper.runDirectOnOperatorInstruction(job, { operator_instruction: 'go to the corner' });
        assert.equal(off.ran, false); assert.match(off.staged_because, /is off for this machine/);
        assert.equal((await m.helper.runDirectOnOperatorInstruction(job, {})).staged_because, null, 'off and no instruction: plain staging');
        m.setting.on = true;
        const bare = await m.helper.runDirectOnOperatorInstruction(job, { operator_instruction: '  ' });
        assert.equal(bare.ran, false); assert.match(bare.staged_because, /no operator_instruction was given/);
        m.position.isHomed = false;
        assert.match((await m.helper.runDirectOnOperatorInstruction(job, { operator_instruction: 'go' })).staged_because, /not homed/);
        assert.equal(job.state, 'awaiting_confirmation'); assert.deepEqual(m.f.executed, []);
    }],
    ['moves: on with the operator\'s instruction runs on the call through every gate and records the quote', async () => {
        const m = movesFixture({ settingOn: true });
        const job = m.stage();
        const ran = await m.helper.runDirectOnOperatorInstruction(job, { operator_instruction: 'Move the head 10 mm right' });
        assert.equal(ran.ran, true);
        assert.equal(ran.result.operator_instruction, 'Move the head 10 mm right');
        assert.equal(ran.result.executed_without_approval, true);
        assert.equal(ran.result.approval_free_setting, motionRules.MOVES_WITHOUT_APPROVAL_TOGGLE);
        assert.deepEqual(m.f.executed, ['M5\nG91\nG0 X10.000 Y0.000\nG90']);
        assert.equal(job.state, 'completed'); assert.equal(job.approval?.policy, 'operator-instruction');
        assert.match(job.approval?.note || '', /"Move the head 10 mm right"/);
        assert.ok(job.events.some((event) => event.phase === 'operator_instruction'));
        // The motor-power gate (#321) and the start re-check (#323) still refuse; nothing is sent.
        const off = movesFixture({ settingOn: true, motorMode: SHUT_ALL });
        await assert.rejects(off.helper.runDirectOnOperatorInstruction(off.stage(), { operator_instruction: 'go' }), /motors are off/);
        const moved = movesFixture({ settingOn: true });
        const stale = moved.stage();
        moved.f.setPosition({ at: { x: 50 } });
        await assert.rejects(moved.helper.runDirectOnOperatorInstruction(stale, { operator_instruction: 'go' }), /head moved since staging/);
        assert.deepEqual([...off.f.executed, ...moved.f.executed], []);
    }],
    ['non-Ray machines are refused, naming the machine; nothing is staged or sent', async () => {
        const f = switchFixture({ machine: A350 });
        await assert.rejects(f.call({ mode: 'control', reason: 'r' }), /applies only to a machine with a motor-power mode \(the Ray\).*A350/);
        await assert.rejects(f.call({ mode: 'sideways', reason: 'r' }), /mode must be/);
        assert.deepEqual(f.commands, []);
    }],
    ['start_gcode_job: set_motor_power\'s own job is not refused for the motors being off; any other job still is', async () => {
        const f = jobFixture('direct-only', { dialect: 'ray-grbl', readMotorPowerMode: async () => SHUT_ALL });
        const other = f.createDirectJob('procedure');
        other.runner = async () => ({ ran: true });
        await assert.rejects(f.handlers.start_gcode_job({ job_id: other.id, confirm_token: 'human', wait_ms: 0 }), /motors are off/);
        const own = f.createDirectJob('procedure');
        own.motorPowerSwitch = 'control';
        own.runner = async () => ({ switched: true });
        // The procedure runner's own machinery is inert in this harness: only the gate matters here.
        const outcome = await f.handlers.start_gcode_job({ job_id: own.id, confirm_token: 'human', wait_ms: 1000 }).catch((err: Error) => err);
        assert.ok(!(outcome instanceof Error && /motors are off/.test(outcome.message)), String(outcome));
        assert.equal(own.tokenUsed, true, 'the approval was used: the gate let it through');
        assert.equal(other.tokenUsed, false);
        assert.ok(jobEnding.TERMINAL_JOB_STATES.length > 0);
    }],
    ['A350: unchanged - no motor-power read at start, the direct job runs; the setter refuses a machine without the mode', async () => {
        const f = jobFixture('file+direct', { readMotorPowerMode: async () => SHUT_ALL });
        const job = f.createDirectJob();
        await f.startDirect(job);
        assert.equal(job.state, 'completed');
        const a350 = connectedMachineFor(A350, { setMotorPowerMode: async () => { throw new Error('must not be called'); } });
        await assert.rejects(a350.setConnectedMotorPower('STAYPOWER', { kind: 'approved-job', jobId: 'x' }), /this machine has none \(only the Ray does\)/);
        const ray = connectedMachineFor(RAY, { setMotorPowerMode: async () => SHUT_ALL });
        await assert.rejects(ray.setConnectedMotorPower('STAYPOWER', { kind: 'approved-job', jobId: 'x' }), /did not confirm motor-power mode STAYPOWER/);
        await assert.rejects(ray.setConnectedMotorPower('STAYPOWER', { kind: 'operator-setting', setting: 's', instruction: ' ' }),
            /without the operator's approval or instruction/);
    }],
];
