/* eslint-disable camelcase */
import { connectionManager } from '../../machine/ConnectionManager';
import { jobManager, McpJob } from '../jobs';
import { currentGcodeSequence } from '../positionOfRecord';
import { probeFeedService } from '../probeFeed';
import { assertMachineReadyForProcedure, checkProcedureStop, clearProcedureStop, getDirectChannel, sleep } from '../probing';
import { McpToolError, ToolRegistry } from '../registry';
import { FileWorkspaceVerification, WORKSPACES, WorkspaceIo, planWorkspace, runWorkspace, verifyWorkspaceForFile } from '../workspace';
import { GcodeChannel, sendGcodeVisible } from './camera';
import { getPositionSnapshot, machinePositionDiagnostics } from './machine';
import { validateStagedEnvelope } from './staging';

/**
 * The controller I/O a no-motion workspace runner uses: every send is guarded
 * (idle, homed, head off, fresh status, no overtravel, same connection) and the
 * MCP command sequence must advance only by the runner's own commands.
 */
function workspaceRunnerIo(job: McpJob, label: string, channel: GcodeChannel, resetAt: unknown, startSequence: number): WorkspaceIo {
    let expectedSequence = startSequence;
    return {
        snapshot: getPositionSnapshot,
        guard: () => {
            checkProcedureStop();
            probeFeedService.assertNoOvertravel();
            // A G53/G5x transition can briefly make position-of-record incoherent.
            // Permit that while stationary; runWorkspace requires coherent readback before G92.
            const state = connectionManager.getLatestMachineState();
            const position = getPositionSnapshot();
            if (!state || Date.now() - state.timestamp > 10000 || position.machineStatus !== 'idle' || position.isHomed !== true
                || Number(state.headPower) > 0 || state.headStatus === true || state.headStatus === 'on') {
                throw new McpToolError('Workspace update requires fresh status, idle/homed machine and toolhead off.');
            }
            if (currentGcodeSequence() !== expectedSequence) throw new McpToolError('Another controller command interrupted the workspace update.');
            if (getDirectChannel() !== channel || machinePositionDiagnostics().resetAt !== resetAt) throw new McpToolError('Machine connection changed; workspace approval is stale.');
        },
        send: async (gcode) => {
            // sendGcodeVisible increments synchronously before awaiting its reply.
            const pending = sendGcodeVisible(channel, label, gcode);
            expectedSequence += 1;
            const reply = await pending;
            if (currentGcodeSequence() !== expectedSequence) throw new McpToolError('Another controller command interrupted the workspace update.');
            return reply;
        },
        invalidateApprovals: () => jobManager.invalidateWorkspaceApprovals(job),
        now: Date.now,
        wait: sleep,
    };
}

/**
 * start_gcode_job, for an approved file whose machine Z extents assume a named
 * workspace: select it (no motion) and prove its offset is the one the confirm
 * page resolved with, before anything is uploaded or streamed.
 */
export async function verifyFileJobWorkspace(job: McpJob): Promise<FileWorkspaceVerification> {
    const workspace = job.validation.machineZResolvedFor;
    const stagingZ = job.validation.originOffsetZAtStaging;
    if (!workspace || stagingZ === null) throw new McpToolError('This job has no workspace assumption to verify.');
    probeFeedService.assertNoOvertravel();
    clearProcedureStop();
    const channel = getDirectChannel();
    const io = workspaceRunnerIo(job, `verify-${workspace}:${job.name}`, channel, machinePositionDiagnostics().resetAt, currentGcodeSequence());
    return verifyWorkspaceForFile(workspace, stagingZ, io);
}

export function registerWorkspaceTools(registry: ToolRegistry, getConfirmBaseUrl: () => string): void {
    for (const write of [true, false]) {
        const name = write ? 'set_workspace_origin' : 'select_workspace';
        registry.register({
            name,
            description: `${write
                ? 'Stage a HUMAN-GATED origin write to an explicitly named G54..G59.3 workspace. origin_machine is the machine XYZ where work XYZ=0 should be, with Z as TOOLHEAD Z for the fitted tool, derived from verified datum measurements. Sets ALL XYZ using firmware G92 from the current stationary pose; no need to visit the origin. '
                : 'Stage a HUMAN-GATED selection of an existing G54..G59.3 workspace without changing any stored origin. '
            }NO AXIS MOTION. Requires fresh reliable position, idle/homed machine and toolhead off. Approval shows the target workspace and effects. `
                + 'The runner refuses changed staging state, requires firmware selection acknowledgement and verifies two fresh offset/position readbacks. '
                + 'Leaves the requested workspace selected; other MCP procedures may reselect G54. Existing staged jobs are invalidated; restage after verification. '
                + 'Prefer one established WCS across indexed cuts. Multiple workspaces are discouraged unless necessary, particularly for an existing G-code job. '
                + 'A valid WCS may have an obstructed origin after rotation: this tool does not move there or certify return clearance. '
                + 'After staging, deliver confirm_url; start_gcode_job requires the operator approval. Do not use raw G92/G10 to bypass this tool.',
            inputSchema: {
                type: 'object',
                properties: {
                    workspace: { type: 'string', enum: [...WORKSPACES], description: 'Explicit target workspace; normally retain G54. Additional workspaces only when required by the existing setup/job.' },
                    ...(write ? {
                        origin_machine: {
                            type: 'object',
                            properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number', description: 'Machine TOOLHEAD Z for work Z0 with the fitted tool; not physical surface height.' } },
                            required: ['x', 'y', 'z'],
                            additionalProperties: false,
                            description: 'Measured/derived work-zero location in machine coordinates. All XYZ are replaced; B and E are never changed. No movement to this point.',
                        },
                        datum_reference: { type: 'string', description: 'Measurement/job references, fitted tool, B orientation and how the datum is established/rechecked; displayed for human review.' },
                    } : {}),
                    reason: { type: 'string', description: 'Purpose of the change, shown to the operator; explain any non-default workspace required by an existing job.' },
                },
                required: write ? ['workspace', 'origin_machine', 'datum_reference', 'reason'] : ['workspace', 'reason'],
                additionalProperties: false,
            },
            handler: async (args) => {
                probeFeedService.assertNoOvertravel();
                assertMachineReadyForProcedure();
                if (['starting', 'started', 'start_unverified'].includes(jobManager.getActive()?.state || '')) throw new McpToolError('Another job is active; finish it before staging a workspace change.');
                let plan: ReturnType<typeof planWorkspace>;
                try { plan = planWorkspace(args, getPositionSnapshot(), write); } catch (err) { throw new McpToolError((err as Error).message); }
                const channel = getDirectChannel();
                const resetAt = machinePositionDiagnostics().resetAt;
                const stagedSequence = currentGcodeSequence();
                const validation = validateStagedEnvelope(plan.review, name);
                validation.warnings = validation.warnings.filter((w) => !w.startsWith('Contains G92'));
                validation.warnings.push(`${write ? 'REPLACES ALL XYZ ORIGIN VALUES IN' : 'SELECTS'} ${plan.workspace}; no motion. Requested workspace remains selected. Restage other jobs afterwards. Prefer one WCS; verify each workspace required by an existing file.`);
                const job = jobManager.submit(plan.review, `${name}-${plan.workspace}-${plan.reason.slice(0, 40)}`, 'cnc', validation, 'procedure');
                job.runner = async () => {
                    if (currentGcodeSequence() !== stagedSequence) throw new McpToolError('Controller commands ran after staging this workspace change; restage for a fresh approval.');
                    return runWorkspace(plan, workspaceRunnerIo(job, name, channel, resetAt, stagedSequence));
                };
                return { job: jobManager.describe(job), workspace: plan.workspace, origin_machine: plan.originMachine, current_machine: plan.machine, work_at_write: plan.workAtWrite, motion: false, confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}` };
            },
        });
    }
}
