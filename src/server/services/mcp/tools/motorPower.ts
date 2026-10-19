/* eslint-disable camelcase */
// Result keys are snake_case: they are serialised straight into tool results.
//
// set_motor_power (tyeth/Luban#326; #321, #322; the Ray data map #315): switch
// the Ray's motor-power mode, Luban's Set Origin Mode, through SACP 0x01 0x48.
//
// - control: STAYPOWER, then home - M5 and `$H` through homeMachine, waiting
//   for homed exactly as `home` does. That is what Luban's own Control Mode
//   radio does (SetOriginView.tsx sends STAYPOWER, then `$H` after its
//   "This mode requires homing to update the current machine coordinates"
//   prompt): coordinates kept while the motors were off are not coordinates.
// - manual: M5, then SHUTAll. The motors are released, the head can be pushed
//   by hand, and the position is latched untrusted (motorPower.ts
//   noteMotorsReleased) so staging, the start re-check (#323) and every policy
//   path refuse until a home.
//
// Both stage a confirm page by default (a procedure job; the operator's click
// plus start_gcode_job runs it). Only with the operator-only setting "Allow
// motor-mode changes without an approval page" on for this machine AND the
// agent quoting the operator's instruction from this session does it run on
// the call - recorded on the result and the job. The setter
// (connectedMachine.setConnectedMotorPower) is reached from nowhere else.
import { connectionManager } from '../../machine/ConnectionManager';
import {
    MotorPowerAuthority,
    assertToolheadNotOn,
    connectedDialect,
    connectedMachineIdentifier,
    connectedMachineTag,
    connectedMotorPower,
    connectedMotorPowerNote,
    describeConnectedMachine,
    setConnectedMotorPower,
} from '../connectedMachine';
import { McpJob, jobManager } from '../jobs';
import { machineStore } from '../machineStore';
import { MOTOR_MODE_WITHOUT_APPROVAL_TOGGLE, operatorInstructionOf } from '../motionRules';
import { MOTOR_POWER_SET_BYTES, noteMotorsReleased } from '../motorPower';
import { probeFeedService } from '../probeFeed';
import { McpToolError, ToolRegistry } from '../registry';
import { GcodeChannel, homeMachine, sendGcodeVisible } from './camera';
import { approvalFreeSettingsFor, assertFreshHeartbeat, getPositionSnapshot } from './machine';
import { OPERATOR_INSTRUCTION_POLICY } from './operatorInstruction';
import { validateStagedEnvelope } from './staging';

export type MotorPowerSwitch = 'control' | 'manual';

const TOOL = 'set_motor_power';

/** The confirm page's text: what each mode does, in order. Comment lines only - the page shows it, nothing parses it as G-code. */
export function motorPowerReview(mode: MotorPowerSwitch, reason: string, current: string, tag: string): string {
    const header = [
        `; set_motor_power ${mode} ${tag}`,
        `; reason: ${reason}`,
        `; motor-power mode now: ${current}`,
    ];
    const body = mode === 'control'
        ? [
            `; 1. Power the steppers: SACP 0x01 0x48 STAYPOWER (${MOTOR_POWER_SET_BYTES.STAYPOWER}) - Luban's Control Mode.`,
            '; 2. Home: M5 (laser off), then $H. THE HEAD MOVES to the home corner (about 4 s on the Ray).',
            ';    Homing re-establishes the machine coordinates, as Luban\'s own Control Mode switch does',
            ';    ("This mode requires homing to update the current machine coordinates").',
            '; 3. Wait until the Ray reports homed and idle, then report the position.',
            '; Keep hands clear of the gantry: the motors are powered from step 1.',
        ]
        : [
            '; 1. M5 (laser off).',
            `; 2. Release the motors: SACP 0x01 0x48 SHUTAll (${MOTOR_POWER_SET_BYTES.SHUTAll}) - Luban's Manual Mode.`,
            ';    The head can then be pushed by hand. Nothing moves.',
            '; 3. The MCP treats the position as UNTRUSTED (unhomed) from then on: every move and job start refuses',
            ';    until a home in Control Mode (set_motor_power {mode:\'control\'}).',
        ];
    return [...header, ...body].join('\n');
}

/**
 * Run the switch with `authority` (the approved job, or the setting with the
 * operator's instruction). Throws on any failure; the job record says how far
 * it got.
 */
export async function runMotorPowerSwitch(job: McpJob, mode: MotorPowerSwitch, authority: MotorPowerAuthority): Promise<object> {
    if (mode === 'control') {
        const set = await setConnectedMotorPower('STAYPOWER', authority);
        jobManager.appendEvent(job, 'motor_power_set', { note: 'STAYPOWER confirmed by the Ray (Control Mode); homing next', mode: set.mode });
        // homeMachine re-reads the mode (it must read STAYPOWER), sends M5 then $H and waits for homed.
        const home = await homeMachine(TOOL, true);
        return {
            mode: 'control',
            motor_power: connectedMotorPowerNote(set),
            home,
            note: 'The Ray is in Control Mode (STAYPOWER) and homed; its machine coordinates are re-established. Stage moves from here.',
        };
    }
    const channel = connectionManager.getCurrentChannel() as unknown as GcodeChannel;
    if (!channel || typeof channel.executeGcode !== 'function') {
        throw new McpToolError(`The connected channel cannot send M5, so the motors were not released. ${connectedMachineTag()}`);
    }
    const off = await sendGcodeVisible(channel, `${TOOL} - laser off`, 'M5');
    if (off.result !== 0) {
        throw new McpToolError(`M5 was rejected by the controller (${off.text || off.result}), so the motors were not released. ${connectedMachineTag()}`);
    }
    // Untrusted from before the release: if the setter fails half-way the head may still be free.
    const by = authority.kind === 'approved-job'
        ? `set_motor_power job ${authority.jobId} (operator-approved)`
        : `set_motor_power under '${authority.setting}' on the operator's instruction "${authority.instruction}"`;
    noteMotorsReleased({ machineIdentifier: connectedMachineIdentifier(), at: Date.now(), by });
    const set = await setConnectedMotorPower('SHUTAll', authority);
    jobManager.appendEvent(job, 'motor_power_set', { note: 'SHUTAll confirmed by the Ray (Manual Mode); position untrusted until a home', mode: set.mode });
    return {
        mode: 'manual',
        motor_power: connectedMotorPowerNote(set),
        laser_off_sent: 'M5',
        position_untrusted: true,
        note: 'The Ray\'s motors are released (Manual Mode / SHUTAll): the head can be pushed by hand. The MCP reads the position as '
            + 'unhomed and refuses every move and job start until set_motor_power {mode:\'control\'} (which homes).',
    };
}

/**
 * The setting path: approve the staged job under the setting, record the
 * operator's instruction, and run it here as a procedure would run.
 */
async function runOnCall(job: McpJob, mode: MotorPowerSwitch, instruction: string): Promise<object> {
    const reason = `'${MOTOR_MODE_WITHOUT_APPROVAL_TOGGLE}' is on for this machine and the agent quoted the operator's instruction from `
        + `this session: "${instruction}"`;
    const token = jobManager.approveByPolicy(job, OPERATOR_INSTRUCTION_POLICY, reason);
    jobManager.appendEvent(job, 'operator_instruction', { note: reason, operator_instruction: instruction, setting: MOTOR_MODE_WITHOUT_APPROVAL_TOGGLE });
    const verdict = jobManager.consumeToken(job, token);
    if (!verdict.ok) {
        throw new McpToolError(verdict.reason || 'The setting\'s approval could not be used.');
    }
    job.state = 'started';
    job.startedAt = Date.now();
    jobManager.appendEvent(job, 'started', { note: `set_motor_power ${mode} on the call` });
    jobManager.setActive(job);
    try {
        const outcome = await runMotorPowerSwitch(job, mode, { kind: 'operator-setting', setting: MOTOR_MODE_WITHOUT_APPROVAL_TOGGLE, instruction });
        job.result = outcome;
        job.state = 'completed';
        job.endedAt = Date.now();
        job.ending = { kind: 'completed', reason: `motor-power mode set to ${mode} on the call`, at: job.endedAt };
        jobManager.appendEvent(job, 'completed', { note: job.ending.reason });
        return {
            job: jobManager.describe(job),
            executed_without_approval: true,
            approval: { source: 'policy', policy: OPERATOR_INSTRUCTION_POLICY, reason },
            approval_free_setting: MOTOR_MODE_WITHOUT_APPROVAL_TOGGLE,
            operator_instruction: instruction,
            result: outcome,
        };
    } catch (err) {
        job.state = 'start_failed';
        job.error = (err as Error).message;
        job.endedAt = Date.now();
        job.ending = { kind: 'operation-failure', reason: job.error, at: job.endedAt };
        jobManager.appendEvent(job, 'failed', { note: job.error });
        throw err;
    } finally {
        if (jobManager.getActive() === job) {
            jobManager.setActive(null);
        }
    }
}

export function registerMotorPowerTools(registry: ToolRegistry, getConfirmBaseUrl: () => string): void {
    registry.register({
        name: TOOL,
        description: 'Ray only: switch the motor-power mode (Luban\'s Set Origin Mode, SACP 0x01 0x48). mode "control" powers the '
            + 'steppers (STAYPOWER) and then HOMES the Ray (M5, then $H, waiting for homed as `home` does) - the head moves - because '
            + 'coordinates kept while the motors were off cannot be trusted; this is what Luban\'s own Control Mode switch does. mode '
            + '"manual" sends M5 and releases the motors (SHUTAll): the head can be pushed by hand, and the MCP then reads the position '
            + 'as unhomed and refuses every move and job start until a home (set_motor_power control). STAGED for the operator\'s '
            + 'click on a confirm page, then start_gcode_job runs it - use only on the operator\'s explicit instruction. With the '
            + 'operator-only setting "Allow motor-mode changes without an approval page" on for this machine (Settings > MCP > Motion '
            + 'rules; no MCP tool can change it), passing operator_instruction - the operator\'s instruction from this session, word '
            + 'for word - runs it on the call and records the quote on the job and the result. Any other machine is refused.',
        inputSchema: {
            type: 'object',
            properties: {
                mode: { type: 'string', enum: ['control', 'manual'], description: 'control = STAYPOWER then home; manual = M5 then SHUTAll.' },
                reason: { type: 'string', description: 'Shown to the operator on the confirm page.' },
                operator_instruction: {
                    type: 'string',
                    description: 'Only with "Allow motor-mode changes without an approval page" on: the operator\'s explicit instruction '
                        + 'for this switch from the current session, quoted word for word. Never invent or paraphrase one; without it, or '
                        + 'with the setting off, the switch stages a confirm page.',
                },
            },
            required: ['mode', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { mode?: string; reason?: string; operator_instruction?: string }) => {
            const mode = args.mode;
            if (mode !== 'control' && mode !== 'manual') {
                throw new McpToolError('mode must be "control" (STAYPOWER, then home) or "manual" (M5, then SHUTAll).');
            }
            const reason = String(args.reason || '').trim();
            if (!reason) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            if (connectedDialect().motorPower.read === 'none') {
                throw new McpToolError('set_motor_power applies only to a machine with a motor-power mode (the Ray); this one has none. '
                    + `${connectedMachineTag()}`);
            }
            probeFeedService.assertNoOvertravel();
            // As homeMachine: homing is what re-establishes the position, so only freshness and the frame latch apply here.
            assertFreshHeartbeat(TOOL, { homing: true });
            const position = getPositionSnapshot();
            if (position.machineStatus !== 'idle') {
                throw new McpToolError(`Machine is ${position.machineStatus || 'in an unknown state'}, not idle.`);
            }
            const active = jobManager.getActive();
            if (active && ['starting', 'started', 'start_unverified'].includes(active.state)) {
                throw new McpToolError('Another job or step is still active; wait for it to finish before switching the motor-power mode.');
            }
            assertToolheadNotOn('Toolhead appears to be on; refusing to switch the motor-power mode.');
            const reading = await connectedMotorPower();
            const current = reading ? `${reading.mode}${reading.error ? ` (${reading.error})` : ''}` : 'unknown';

            const review = motorPowerReview(mode, reason, current, connectedMachineTag());
            const validation = validateStagedEnvelope(review, TOOL);
            validation.warnings.push(mode === 'control'
                ? 'Powers the Ray\'s steppers, then HOMES it: the head moves to the home corner.'
                : 'Releases the Ray\'s motors (Manual Mode); the position is untrusted until a home.');
            const job = jobManager.submit(review, `motor-power ${mode} - ${reason.slice(0, 40)}`, 'laser', validation, 'procedure');
            job.motorPowerSwitch = mode;
            job.runner = async () => runMotorPowerSwitch(job, mode, { kind: 'approved-job', jobId: job.id });

            const instruction = operatorInstructionOf(args.operator_instruction);
            const setting = approvalFreeSettingsFor(machineStore.currentMachine().machineKey).motorMode;
            if (setting.on && instruction) {
                return {
                    connected_machine: describeConnectedMachine(),
                    motor_power_before: connectedMotorPowerNote(reading),
                    ...await runOnCall(job, mode, instruction),
                };
            }
            let stagedBecause = 'set_motor_power always stages a confirm page unless the operator turned on '
                + `'${MOTOR_MODE_WITHOUT_APPROVAL_TOGGLE}' for this machine and the agent quotes their instruction`;
            if (setting.on) {
                stagedBecause = `'${MOTOR_MODE_WITHOUT_APPROVAL_TOGGLE}' is on, but no operator_instruction was given`;
            } else if (instruction) {
                stagedBecause = `operator_instruction was given, but '${MOTOR_MODE_WITHOUT_APPROVAL_TOGGLE}' is off for this machine - only `
                    + 'the operator turns it on, in Luban\'s Settings > MCP > Motion rules';
            }
            return {
                job: jobManager.describe(job),
                connected_machine: describeConnectedMachine(),
                motor_power_before: connectedMotorPowerNote(reading),
                mode,
                staged_because: stagedBecause,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: mode === 'control'
                    ? 'Ask the operator to open confirm_url and approve: it powers the steppers and then HOMES the Ray (the head moves). '
                        + 'Then start_gcode_job {job_id, wait_for_approval_ms: 110000} runs it and returns the home result.'
                    : 'Ask the operator to open confirm_url and approve: it sends M5 and releases the motors. Then start_gcode_job '
                        + '{job_id, wait_for_approval_ms: 110000} runs it; every move is refused afterwards until set_motor_power control.',
            };
        },
    });
}
