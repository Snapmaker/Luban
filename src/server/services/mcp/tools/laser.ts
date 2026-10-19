/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import { connectionManager } from '../../machine/ConnectionManager';
import { clearanceOptions } from '../clearanceContext';
import { connectedMachineCapability, connectedMachineTag, describeConnectedMachine } from '../connectedMachine';
import { jobManager } from '../jobs';
import { landmarkStore } from '../landmarks';
import { HeadFacts, LaserBox, LaserSwitchPlan, boxFromCorners, boxFromJobExtents, laserFocusRefusal, laserHeadCheck, planAirAssist,
    planCrosshair, planLaserFrame } from '../laserPlan';
import { probeFeedService } from '../probeFeed';
import { McpToolError, ToolRegistry } from '../registry';
import { assertFreshHeartbeat, assertWithinTravel, describePlanningTravel, getPositionSnapshot, motionGcodeForm, requirePlanningTravel,
    traverseMachine } from './machine';
import { validateStagedEnvelope } from './staging';

/**
 * Laser tools (#265 WP7, plan 2.5; Ray first): laser_frame, set_air_assist,
 * set_crosshair, and laser_focus as a refusal. Gated on the `laser`
 * capability (procedureGates.ts LASER_GATES); the bodies come from the
 * connected machine's dialect row through laserPlan.ts. Every one is STAGED
 * through the confirm page exactly like traverse_xy (a direct job, one
 * approved step per start_gcode_job call) and NEVER auto-executed: the
 * safeZPolicy top-Z rule is an XY-transport rule for a head at the traverse
 * height - on the Ray there is no Z to justify skipping approval, and on a Z
 * machine a laser frame runs at the focus height, below it. Results carry
 * connected_machine and gcode_form.
 */

const NEVER_AUTO = 'laser tools are never auto-executed: the top-Z policy (safeZPolicy.ts) only skips approval for an XY transport '
    + 'with the head at the traverse height. A machine with no Z axis has no such height, and a laser frame on a Z machine runs at the '
    + 'focus height below it - so every laser body waits for the operator on the confirm page.';

function plannerError(err: unknown): never {
    if (err && ['LaserPlanError', 'GcodeFormError'].includes((err as Error).name)) {
        throw new McpToolError(`${(err as Error).message} ${connectedMachineTag()}`);
    }
    throw err;
}

/** What the connection reports about the fitted head (Luban channel state headType / toolHead). */
function connectedHead(): HeadFacts {
    const state = connectionManager.getLatestMachineState() as { headType?: unknown; toolHead?: unknown } | null;
    const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
    return { headType: text(state && state.headType), toolHead: text(state && state.toolHead) };
}

/** The checks every laser body shares with traverse_xy: no overtravel, fresh heartbeat, idle, and the toolhead not already on. */
function assertReadyForLaser(what: string): void {
    probeFeedService.assertNoOvertravel();
    assertFreshHeartbeat(`staging ${what}`);
    const position = getPositionSnapshot();
    if (position.machineStatus !== 'idle') {
        throw new McpToolError(`Machine is ${position.machineStatus || 'in an unknown state'}, not idle.`);
    }
    const state = connectionManager.getLatestMachineState() as { headStatus?: unknown; headPower?: unknown } | null;
    const headPower = Number(state && state.headPower);
    if ((Number.isFinite(headPower) && headPower > 0) || (state && (state.headStatus === true || state.headStatus === 'on'))) {
        throw new McpToolError(`Toolhead appears to be on; refusing to stage ${what}.`);
    }
}

function stageSwitch(plan: LaserSwitchPlan, tool: string, baseUrl: () => string) {
    const machine = traverseMachine(tool);
    const validation = validateStagedEnvelope(plan.reviewText, tool, { relativeTransport: machine.gcode === 'grbl-relative' });
    const job = jobManager.submit(plan.reviewText, plan.name, 'laser', validation, 'direct');
    return {
        job: jobManager.describe(job),
        connected_machine: describeConnectedMachine(),
        gcode_form: motionGcodeForm(),
        gcode: plan.gcode,
        head: plan.headNote,
        staged_because: NEVER_AUTO,
        confirm_url: `${baseUrl()}/confirm/${job.id}`,
        next_step: 'Ask the operator to open confirm_url, review the line and approve; start_gcode_job with wait_for_approval_ms sends it.',
    };
}

export function registerLaserTools(registry: ToolRegistry, getConfirmBaseUrl: () => string): void {
    registry.register({
        name: 'laser_frame',
        description: 'Trace the bounding box of a laser job so the operator can see where it will run. Box from x0, y0, x1, y1 '
            + '(MACHINE coordinates) or from a staged job\'s validator extents (job_id; a work-frame job only while the live '
            + 'work-origin offset is reliable). power_percent 0 (default) = laser OFF: M5 first, then G0 moves only (G0 is laser-off '
            + 'by definition on the Ray). power_percent > 0 = a dim visible trace: M3 at that power, CAPPED at 5 % '
            + '(LASER_FRAME_POWER_PERCENT; Ray S0-1000 -> 5 % = S50; Snapmaker 2.0 / Artisan / Original `M3 P<%> S<PWM>`); a clip '
            + 'is REPORTED in `clipped` and on the confirm page. Each powered side is its own approved step ending M5, so the laser is '
            + 'never on between steps. Every corner is checked against the toolhead travel and the landmarks. Staged for ONE operator '
            + 'approval and executed one step per start_gcode_job call, like traverse_xy - and NEVER auto-executed (staged_because '
            + 'says why). Motion is relative G91/G90 steps with settle comments on the Ray and the Original, the own-line G53 '
            + 'machine-frame form on the Snapmaker 2.0 and the Artisan; on a Z machine the frame runs at the CURRENT Z (the focus '
            + 'height) and Z is never written. power_percent > 0 needs a laser head the connection reports (a 2.0 / Artisan / '
            + 'Original with a CNC or unreported head is refused: M3 would spin a spindle). Results carry connected_machine and gcode_form.',
        inputSchema: {
            type: 'object',
            properties: {
                x0: { type: 'number', description: 'Box corner X, machine coordinates (mm).' },
                y0: { type: 'number', description: 'Box corner Y, machine coordinates (mm).' },
                x1: { type: 'number', description: 'Opposite corner X, machine coordinates (mm).' },
                y1: { type: 'number', description: 'Opposite corner Y, machine coordinates (mm).' },
                job_id: { type: 'string', description: 'A staged job whose validator XY extents are the box (instead of x0..y1).' },
                power_percent: { type: 'number', description: 'Laser power for a visible trace, % of full. Default 0 = laser off. Max 5 (clipped and reported).' },
                feed: { type: 'number', description: 'mm/min, default 1500, 100..3000 (clipped and reported).' },
                repeat: { type: 'number', description: 'Passes round the box, default 1, max 4 (clipped and reported).' },
                reason: { type: 'string', description: 'Shown to the operator: why this frame is needed.' },
                wait_until_moved: { type: 'boolean', description: 'Staged default for execution, as traverse_xy. Default true.' },
            },
            required: ['reason'],
            additionalProperties: false,
        },
        handler: async (args: {
            x0?: number; y0?: number; x1?: number; y1?: number; job_id?: string;
            power_percent?: number; feed?: number; repeat?: number; reason?: string; wait_until_moved?: boolean;
        }) => {
            const reason = String(args.reason || '').trim();
            if (!reason) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            const corners = [args.x0, args.y0, args.x1, args.y1];
            const fromArgs = corners.some((v) => v !== undefined);
            const fromJob = args.job_id !== undefined;
            if (fromArgs === fromJob) {
                throw new McpToolError('Give the box as x0, y0, x1, y1 (machine coordinates) or as job_id - not both, not neither.');
            }
            if (fromArgs && corners.some((v) => v === undefined)) {
                throw new McpToolError('A box from arguments needs all four of x0, y0, x1, y1 (machine coordinates).');
            }
            const machine = traverseMachine('laser_frame');
            const capability = connectedMachineCapability();
            assertReadyForLaser('a laser frame');
            const position = getPositionSnapshot();
            if (position.isHomed !== true) {
                throw new McpToolError(`Machine does not report homed; home before a laser frame ${connectedMachineTag()}.`);
            }
            const { x: mx, y: my, z: mz } = position.machine;
            if (mx === null || my === null) {
                throw new McpToolError('Current machine position unknown; cannot plan the frame.');
            }
            const dialect = machine.dialect || capability.dialect;
            const head = connectedHead();
            let headNote: string;
            try {
                const check = laserHeadCheck(dialect, head, 'laser_frame');
                headNote = check.note;
                if (Number(args.power_percent) > 0 && !check.laserKnown) {
                    throw new McpToolError('Refusing a powered laser_frame: this connection does not report which head is fitted, and on the '
                        + `${dialect.label} M3 also drives a CNC spindle. A frame at power_percent 0 (M5, G0 only) needs no laser head. `
                        + `${connectedMachineTag()}`);
                }
            } catch (err) {
                plannerError(err);
            }

            let box: LaserBox;
            let boxSource: string;
            try {
                if (fromJob) {
                    const job = jobManager.get(String(args.job_id));
                    if (!job) {
                        throw new McpToolError(`No job ${args.job_id}.`);
                    }
                    const stagedFor = job.stagedFor ? job.stagedFor.identifier : null;
                    if (stagedFor && stagedFor !== capability.identifier) {
                        throw new McpToolError(`Job ${job.id} was staged for the ${stagedFor}, not the connected machine ${connectedMachineTag()}; `
                            + 'its extents are not a box on this machine.');
                    }
                    const offsetReliable = position.originOffsetSource === 'heartbeat' && position.warnings.length === 0;
                    box = boxFromJobExtents(job.id, job.validation, offsetReliable ? position.originOffset : null);
                    boxSource = `job ${job.id} validator extents (${job.validation.frame.declared} frame)`;
                } else {
                    box = boxFromCorners(Number(args.x0), Number(args.y0), Number(args.x1), Number(args.y1));
                    boxSource = 'arguments (machine coordinates)';
                }
            } catch (err) {
                plannerError(err);
            }
            const travel = requirePlanningTravel('a laser frame', { x: mx, y: my });
            assertWithinTravel([
                { label: 'Frame corner (xMin, yMin)', x: box.xMin, y: box.yMin },
                { label: 'Frame corner (xMax, yMin)', x: box.xMax, y: box.yMin },
                { label: 'Frame corner (xMax, yMax)', x: box.xMax, y: box.yMax },
                { label: 'Frame corner (xMin, yMax)', x: box.xMin, y: box.yMax },
            ], travel);

            let plan;
            try {
                plan = planLaserFrame({
                    dialect,
                    hasZ: capability.hasZ,
                    current: { x: mx, y: my, z: capability.hasZ ? mz : null },
                    box,
                    boxSource,
                    powerPercent: args.power_percent,
                    feed: args.feed,
                    repeat: args.repeat,
                    travel: travel.limits,
                    // Only landmarks set on THIS machine (landmarks.ts scopes by the connected identifier).
                    obstacles: landmarkStore.obstacleBoxes(),
                    ...clearanceOptions(),
                    reason,
                });
            } catch (err) {
                plannerError(err);
            }
            const relative = plan.gcodeForm === 'relative-steps';
            const validation = validateStagedEnvelope(plan.reviewText, 'laser_frame', { relativeTransport: relative });
            const job = jobManager.submit(plan.reviewText, plan.name, 'laser', validation, 'direct', plan.steps.map((s) => s.gcode));
            job.waitUntilMoved = args.wait_until_moved !== false;
            return {
                job: jobManager.describe(job),
                connected_machine: describeConnectedMachine(),
                gcode_form: motionGcodeForm(),
                gcode_form_note: relative
                    ? 'relative G91/G90 steps (no G53/G54 on this machine); each names its machine endpoint in a settle comment'
                    : 'absolute machine-frame steps (own-line G53; .. G54;), each naming its endpoint in a settle comment',
                box: { ...plan.box, source: boxSource },
                power: plan.power.line
                    ? { percent: plan.power.percent, line: plan.power.line, note: 'each side is M3 .. move .. M5 - never on between steps' }
                    : { percent: 0, line: null, note: 'laser OFF: M5 first, G0 moves only, no M3/M4' },
                clipped: plan.clipped,
                feed: plan.feed,
                repeat: plan.repeat,
                run_z: plan.runZ,
                head: headNote,
                steps: plan.steps.map((s) => ({ what: s.what, laser: s.laser, machine: s.to, distance_mm: Number(s.distanceMm.toFixed(1)) })),
                perimeter_mm: Number(plan.perimeterMm.toFixed(1)),
                total_distance_mm: Number(plan.totalDistanceMm.toFixed(1)),
                travel: { ...travel.limits, basis: describePlanningTravel(travel), conflicts: travel.conflicts },
                staged_because: NEVER_AUTO,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url, review the frame (box, power, every step) and approve once. Then call '
                    + 'start_gcode_job once PER STEP (wait_for_approval_ms on the first); each call runs the next approved step and settles.',
            };
        },
    });

    registry.register({
        name: 'set_air_assist',
        description: 'Air assist on/off: the connected machine\'s dialect line (M8 / M9 on the Ray, the Snapmaker 2.0 with the 20 W / '
            + '40 W laser module, and the Artisan), STAGED for operator approval and sent by start_gcode_job - never auto-executed. '
            + 'Refused on machines whose dialect row has no air assist (the Original, the J1), on a reported non-laser head, and on a '
            + '2.0 whose reported module is not the 20 W / 40 W; when the head is not knowable over the connection the result says so. '
            + 'Results carry connected_machine and gcode_form.',
        inputSchema: {
            type: 'object',
            properties: {
                on: { type: 'boolean', description: 'true = air on (M8), false = off (M9).' },
                reason: { type: 'string', description: 'Shown to the operator.' },
            },
            required: ['on', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { on?: boolean; reason?: string }) => {
            if (typeof args.on !== 'boolean') {
                throw new McpToolError('on must be true or false.');
            }
            const reason = String(args.reason || '').trim() || (args.on ? 'air assist on' : 'air assist off');
            const machine = traverseMachine('set_air_assist');
            assertReadyForLaser('air assist');
            let plan: LaserSwitchPlan;
            try {
                plan = planAirAssist(machine.dialect || connectedMachineCapability().dialect, connectedHead(), args.on, reason);
            } catch (err) {
                plannerError(err);
            }
            return stageSwitch(plan, 'set_air_assist', getConfirmBaseUrl);
        },
    });

    registry.register({
        name: 'set_crosshair',
        description: 'Laser crosshair (red-dot pointer) on/off: the dialect line (Ray and Artisan `M2000 L13 P1/P0`, Snapmaker 2.0 '
            + '`M2002 T3 P1/P0`), STAGED for operator approval and sent by start_gcode_job - never auto-executed. Refused where the '
            + 'dialect row has no crosshair (the Original, the J1) and on a reported non-laser head. Results carry connected_machine and gcode_form.',
        inputSchema: {
            type: 'object',
            properties: {
                on: { type: 'boolean', description: 'true = crosshair on, false = off.' },
                reason: { type: 'string', description: 'Shown to the operator.' },
            },
            required: ['on', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { on?: boolean; reason?: string }) => {
            if (typeof args.on !== 'boolean') {
                throw new McpToolError('on must be true or false.');
            }
            const reason = String(args.reason || '').trim() || (args.on ? 'crosshair on' : 'crosshair off');
            const machine = traverseMachine('set_crosshair');
            assertReadyForLaser('the crosshair');
            let plan: LaserSwitchPlan;
            try {
                plan = planCrosshair(machine.dialect || connectedMachineCapability().dialect, connectedHead(), args.on, reason);
            } catch (err) {
                plannerError(err);
            }
            return stageSwitch(plan, 'set_crosshair', getConfirmBaseUrl);
        },
    });

    registry.register({
        name: 'laser_focus',
        description: 'Always REFUSED, with the reason: the Ray has no Z axis (focus is set mechanically on the module), and a laser '
            + 'focus move is deferred on every other machine. Nothing is ever sent.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => {
            const capability = connectedMachineCapability();
            throw new McpToolError(laserFocusRefusal(capability.dialect, capability.hasZ, String(capability.identifier)));
        },
    });
}
