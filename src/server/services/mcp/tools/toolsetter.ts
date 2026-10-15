/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import { connectionManager } from '../../machine/ConnectionManager';
import { describeActiveTool, getActiveTool, invalidateActiveTool, setActiveTool } from '../activeTool';
import { jobManager } from '../jobs';
import { probeFeedService } from '../probeFeed';
import { McpToolError, ToolRegistry } from '../registry';
import {
    describePlanAsGcode,
    getMeasurements,
    getToolSetterConfig,
    planToolSetterRun,
    runToolSetterProcedure,
    setToolSetterConfig,
} from '../toolSetter';
import { MAX_TOOL_LENGTH_DELTA_MM, TOOL_SETTER_FLOOR_MARGIN_MM, within } from '../procedureLimits';
import { validateStagedEnvelope } from './staging';
import { getPositionSnapshot, machinePositionDiagnostics, requireReliableMachine } from './machine';

export function registerToolSetterTools(registry: ToolRegistry, getConfirmBaseUrl: () => string): void {
    registry.register({
        name: 'set_tool_setter_config',
        description: 'Store the tool setter reference: its centre in MACHINE coordinates, the machine '
            + 'Z at which a known bit triggers it, that bit\'s length, and the longest bit in use. All '
            + 'values come from the OPERATOR (or a store_as_reference run) - never from visual '
            + 'estimation. The expected trigger Z for any bit follows as '
            + 'triggerZ + (bit length - reference length).',
        inputSchema: {
            type: 'object',
            properties: {
                center_x: { type: 'number', description: 'Machine X of the setter centre.' },
                center_y: { type: 'number', description: 'Machine Y of the setter centre.' },
                trigger_z: { type: 'number', description: 'Machine Z at trigger with the reference bit.' },
                reference_bit_length_mm: { type: 'number', description: 'Protrusion of the reference bit, mm.' },
                disc_diameter_mm: {
                    type: 'number',
                    description: 'Diameter of the setter\'s contact disc, if measured. Nothing here needs it; the '
                        + 'camera bootstrap uses it as an absolute scale reference in a frame.',
                },
                longest_bit_length_mm: { type: 'number', description: 'Longest bit in use, mm - sets the safe start height.' },
                floor_margin_mm: { type: 'number', description: 'Allowed descent below the expected trigger Z, default 3.' },
                tool_change_x: { type: 'number', description: 'Machine X of the tool-change park position (operator preference).' },
                tool_change_y: { type: 'number', description: 'Machine Y of the park position; omit if Y does not matter.' },
                tool_change_z: { type: 'number', description: 'Machine Z of the park position, typically the homing height.' },
                notes: { type: 'string' },
            },
            required: ['center_x', 'center_y', 'trigger_z', 'reference_bit_length_mm', 'longest_bit_length_mm'],
            additionalProperties: false,
        },
        handler: async (args: {
            center_x?: number;
            center_y?: number;
            trigger_z?: number;
            reference_bit_length_mm?: number;
            disc_diameter_mm?: number;
            longest_bit_length_mm?: number;
            floor_margin_mm?: number;
            tool_change_x?: number;
            tool_change_y?: number;
            tool_change_z?: number;
            notes?: string;
        }) => {
            const numbers = {
                centerX: Number(args.center_x),
                centerY: Number(args.center_y),
                triggerZ: Number(args.trigger_z),
                referenceBitLengthMm: Number(args.reference_bit_length_mm),
                longestBitLengthMm: Number(args.longest_bit_length_mm),
                discDiameterMm: args.disc_diameter_mm === undefined ? undefined : Number(args.disc_diameter_mm),
            };
            if (Object.values(numbers).some((v) => !Number.isFinite(v))) {
                throw new McpToolError('All coordinates and lengths must be finite numbers.');
            }
            if (numbers.referenceBitLengthMm <= 0 || numbers.longestBitLengthMm < numbers.referenceBitLengthMm - 0.001) {
                throw new McpToolError('Bit lengths must be positive and longest >= reference.');
            }
            const floorMarginMm = args.floor_margin_mm !== undefined ? Number(args.floor_margin_mm) : TOOL_SETTER_FLOOR_MARGIN_MM.default;
            if (!within(floorMarginMm, TOOL_SETTER_FLOOR_MARGIN_MM)) {
                throw new McpToolError(`floor_margin_mm must be ${TOOL_SETTER_FLOOR_MARGIN_MM.min}-${TOOL_SETTER_FLOOR_MARGIN_MM.max}.`);
            }
            const existing = getToolSetterConfig();
            const changeCoord = (value: number | undefined, previous: number | null): number | null => {
                if (value === undefined) {
                    return previous;
                }
                if (!Number.isFinite(Number(value))) {
                    throw new McpToolError('Tool change coordinates must be finite numbers.');
                }
                return Number(value);
            };
            setToolSetterConfig({
                ...numbers,
                floorMarginMm,
                changeX: changeCoord(args.tool_change_x, existing ? existing.changeX : null),
                changeY: changeCoord(args.tool_change_y, existing ? existing.changeY : null),
                changeZ: changeCoord(args.tool_change_z, existing ? existing.changeZ : null),
                notes: args.notes ? String(args.notes) : null,
            });
            return { config: getToolSetterConfig() };
        },
    });

    registry.register({
        name: 'get_tool_setter_config',
        description: 'The stored tool setter reference (centre, trigger Z, bit lengths, tool-change '
            + 'park position) and the last two measurements. Read-only.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => ({ config: getToolSetterConfig(), measurements: getMeasurements(), active_tool: describeActiveTool() }),
    });

    registry.register({
        name: 'set_active_tool',
        description: 'Record the operator-confirmed fitted tool for clearance, no motion or confirm page. protrusion_mm is the conservative distance below the toolhead, NOT probe contact calibration or necessarily overall length. A shorter active tool lowers physical-obstacle clearance; it never bypasses the motion floor or legacy clearance_z boxes. run_tool_setter replaces it automatically. Restart, detected disconnect/reboot and tool-change parking make it stale; re-confirm the fitted tool, do not blindly replay a historical value.',
        inputSchema: {
            type: 'object',
            properties: {
                protrusion_mm: { type: 'number', description: 'Measured or operator-confirmed protrusion below the toolhead, mm.' },
                source: { type: 'string', enum: ['operator', 'tool_setter', 'spindle_probe'], description: 'Provenance of the assertion. Measurement procedures write their own source; operator is for an explicit fitted-tool confirmation.' },
                tool_identity: { type: 'string', description: 'Optional bit/probe identity.' },
                note: { type: 'string', description: 'Why this value is trusted.' },
                measurement_job_id: { type: 'string', description: 'Job that produced a measured assertion, when source is tool_setter or spindle_probe.' },
            },
            required: ['protrusion_mm', 'source'],
            additionalProperties: false,
        },
        handler: async (args: { protrusion_mm?: number; source?: string; tool_identity?: string; note?: string; measurement_job_id?: string }) => {
            const source = args.source as 'operator' | 'tool_setter' | 'spindle_probe';
            if (!['operator', 'tool_setter', 'spindle_probe'].includes(source)) {
                throw new McpToolError('source must be operator, tool_setter, or spindle_probe.');
            }
            if (source !== 'operator' && !String(args.measurement_job_id || '').trim()) {
                throw new McpToolError('A measured active tool needs measurement_job_id provenance.');
            }
            const protrusionMm = Number(args.protrusion_mm);
            if (!Number.isFinite(protrusionMm) || protrusionMm <= 0) {
                throw new McpToolError('protrusion_mm must be a positive finite number.');
            }
            if (source !== 'operator') {
                if (getActiveTool()?.measurementJobId !== args.measurement_job_id) {
                    throw new McpToolError('This measurement is not the current fitted-tool assertion. After invalidation, confirm the current fitting with source operator or measure again.');
                }
                const measurement = jobManager.get(String(args.measurement_job_id));
                const result = measurement?.result as { active_tool?: { source?: string; protrusionMm?: number } } | undefined;
                if (measurement?.state !== 'completed' || result?.active_tool?.source !== source
                    || Math.abs(Number(result.active_tool.protrusionMm) - protrusionMm) > 0.001) {
                    throw new McpToolError('Measured provenance must match a completed tool-setter job and its actual protrusion. For a current operator assertion use source operator and quote that confirmation.');
                }
            }
            const active = setActiveTool({
                protrusionMm,
                source,
                measurementJobId: args.measurement_job_id || null,
                toolIdentity: args.tool_identity || null,
                note: args.note || null,
            });
            return describeActiveTool(active);
        },
    });

    registry.register({
        name: 'get_active_tool',
        description: 'Read the usable active-tool clearance assertion, age and provenance, or active:null plus stored/staleReason when invalidated. Re-read after every setter run or swap. Stale records are not used to shorten physical clearances; fallback is the configured worst case. No motion or confirm page.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => describeActiveTool(),
    });

    registry.register({
        name: 'run_tool_setter',
        description: 'Stage a tool height measurement against the tool setter for human confirmation. '
            + 'The declared bit_length_mm comes from the OPERATOR. Preconditions: machine homed and '
            + 'idle, probe feed connected (overtravel tripwire armed), toolsetter sensor readable and '
            + 'not triggered. The confirm page shows the full motion envelope; after approval one '
            + 'start_gcode_job call runs the whole server-driven routine: XY to the centre, Z travel '
            + 'to the safe start height, 1 mm sensor-gated descent to a slow zone, 0.1 mm approach to '
            + 'contact, then repeated quick lift-and-retest confirm cycles - then raises STRAIGHT UP '
            + 'to the traverse height (machine Z328, never the start height; result.finalZ) and '
            + 'reports the median trigger Z, the per-pass contacts and spread, and the derived bit '
            + 'length. A hard floor and the overtravel tripwire bound it (~1-2 minutes).',
        inputSchema: {
            type: 'object',
            properties: {
                bit_length_mm: {
                    type: 'number',
                    description: 'Approximate protrusion of the FITTED bit in mm, as stated by the operator.',
                },
                coarse_step_mm: { type: 'number', description: 'Coarse descent step, default 1 (0.2-2).' },
                fine_step_mm: { type: 'number', description: 'Fine step, default 0.1 (0.02-0.5).' },
                backoff_mm: { type: 'number', description: 'Backoff before the confirm pass, default 0.3.' },
                sensor_delay_ms: { type: 'number', description: 'Wait for the sensor report after each step, default 200.' },
                confirm_passes: {
                    type: 'number',
                    description: 'Quick lift-and-retest cycles after first fine contact; the result is '
                        + 'their median and the spread is reported. Default 3 (1-10).',
                },
                start_clearance_mm: { type: 'number', description: 'Clearance above the longest-bit trigger height, default 30 (10-150).' },
                slow_zone_mm: {
                    type: 'number',
                    description: 'The coarse ladder stops this far above the expected trigger and fine '
                        + 'steps take over, capping the press into the setter at one fine step. Default 1.',
                },
                store_as_reference: {
                    type: 'boolean',
                    description: 'After a successful run, store the measured trigger Z and this bit '
                        + 'length as the new reference (locks in the setter height).',
                },
                stay_at_trigger: {
                    type: 'boolean',
                    description: 'HOLD the tip at the measured trigger (in contact) instead of '
                        + 'retreating - for the touchscreen manual-swap wizard, where the operator '
                        + 'confirms the matched position there. Send no other motion until they finish.',
                },
                start_from_current: {
                    type: 'boolean',
                    description: 'Skip the XY move and Z travel; descend from the CURRENT position '
                        + '(verified over the setter centre within 1.5 mm) - for when the touchscreen '
                        + 'wizard has already returned the new tool over the setter.',
                },
                accept_probe_contact: {
                    type: 'boolean',
                    description: 'REQUIRED when the fitted tool is the spindle TOUCH PROBE: its own '
                        + 'channel fires before the setter switch and pressing on would bend it, so '
                        + 'EITHER channel counts as the height confirmation (the result notes which).',
                },
                reason: { type: 'string', description: 'Shown to the operator: why this measurement is needed.' },
            },
            required: ['bit_length_mm', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { bit_length_mm?: number; reason?: string; [key: string]: unknown }) => {
            if (!String(args.reason || '').trim()) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            const plan = planToolSetterRun(args);
            const envelope = describePlanAsGcode(plan);
            const validation = validateStagedEnvelope(envelope, 'run_tool_setter');
            const job = jobManager.submit(
                envelope,
                `tool-setter bit ${plan.bitLengthMm}mm - ${String(args.reason).slice(0, 40)}`,
                'cnc',
                validation,
                'procedure'
            );
            job.runner = async () => runToolSetterProcedure(plan, job.id);

            return {
                job: jobManager.describe(job),
                plan: {
                    center: { x: plan.config.centerX, y: plan.config.centerY },
                    expected_trigger_z: plan.expectedTriggerZ,
                    start_z: plan.startZ,
                    end_z: plan.stayAtTrigger ? null : plan.endZ,
                    floor_z: plan.floorZ,
                    coarse_floor_z: plan.coarseFloorZ,
                    slow_zone_mm: plan.slowZoneMm,
                    coarse_step_mm: plan.coarseStepMm,
                    fine_step_mm: plan.fineStepMm,
                    backoff_mm: plan.backoffMm,
                    sensor_delay_ms: plan.sensorDelayMs,
                    confirm_passes: plan.confirmPasses,
                    store_as_reference: plan.storeAsReference,
                    stay_at_trigger: plan.stayAtTrigger,
                    start_from_current: plan.startFromCurrent,
                    accept_probe_contact: plan.acceptProbeContact,
                },
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url, review the SERVER-DRIVEN PROCEDURE '
                    + 'banner and the motion envelope, and approve. Their one-time code passed to '
                    + 'start_gcode_job runs the whole routine; it returns the measurement when done '
                    + '(several minutes - the confirm pass is deliberately slow).',
            };
        },
    });

    registry.register({
        name: 'goto_tool_change_position',
        description: 'Stage the move to the operator-set tool-change park position (machine coords '
            + 'from set_tool_setter_config: typically Z at the homing height and X at the far end; '
            + 'Y only if configured). One approval covers two exact steps: Z up first, then X/Y, one start_gcode_job call each. The operator then '
            + 'swaps the tool BY HAND; afterwards run_tool_setter measures the new tool and '
            + 'apply_tool_length_offset shifts the work origin by the length difference.',
        inputSchema: {
            type: 'object',
            properties: {
                reason: { type: 'string', description: 'Shown to the operator.' },
            },
            required: ['reason'],
            additionalProperties: false,
        },
        handler: async (args: { reason?: string }) => {
            probeFeedService.assertNoOvertravel();
            const cfg = getToolSetterConfig();
            if (!cfg || cfg.changeZ === null || cfg.changeX === null) {
                throw new McpToolError('No tool-change position stored. Ask the operator for it and set '
                    + 'tool_change_x / tool_change_z (and optionally _y) via set_tool_setter_config.');
            }
            const position = getPositionSnapshot();
            requireReliableMachine(position, 'this tool-setter operation');
            if (position.machineStatus !== 'idle') {
                throw new McpToolError(`Machine is ${position.machineStatus || 'in an unknown state'}, not idle.`);
            }
            if (position.isHomed !== true) {
                throw new McpToolError('Machine does not report homed; home before the tool-change move.');
            }
            const state = connectionManager.getLatestMachineState() as { headStatus?: unknown; headPower?: unknown } | null;
            const headPower = Number(state && state.headPower);
            if ((Number.isFinite(headPower) && headPower > 0) || (state && (state.headStatus === true || state.headStatus === 'on'))) {
                throw new McpToolError('Toolhead appears to be on; refusing the tool-change move.');
            }

            // Z clears first, at the move_z feed cap; XY travels as a rapid
            // only once at height. One approval covers both exact steps.
            const steps = [
                `G90\nG53;\nG1 Z${cfg.changeZ.toFixed(3)} F600;\nG54;`,
                `G90\nG53;\nG0 X${cfg.changeX.toFixed(3)}${cfg.changeY !== null ? ` Y${cfg.changeY.toFixed(3)}` : ''};\nG54;`,
            ];
            const reviewText = steps.join('\n; --- next approved step ---\n');
            invalidateActiveTool('Tool-change park requested; confirm the fitted tool after the manual swap.');
            const validation = validateStagedEnvelope(reviewText, 'goto_tool_change_position');
            const job = jobManager.submit(
                reviewText,
                `tool-change park Z${cfg.changeZ} X${cfg.changeX} - ${String(args.reason).slice(0, 40)}`,
                'cnc',
                validation,
                'direct',
                steps
            );
            return {
                job: jobManager.describe(job),
                park: { x: cfg.changeX, y: cfg.changeY, z: cfg.changeZ },
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Operator approves once; call start_gcode_job with the code TWICE (Z step, '
                    + 'then XY step). Then the operator swaps the tool by hand; measure it with '
                    + 'run_tool_setter and finish with apply_tool_length_offset.',
            };
        },
    });

    registry.register({
        name: 'apply_tool_length_offset',
        description: 'After a tool change: shift the CURRENT work origin Z by the measured length '
            + 'difference between the last two tool setter measurements (new - previous; overridable '
            + 'via explicit old/new trigger Zs), so work Z keeps meaning the same physical plane with '
            + 'the new tool. Stages a single G92 for operator confirmation - nothing moves; the work '
            + 'coordinate frame shifts. This is the sanctioned tool-length transfer: it does what the '
            + 'touchscreen manual tool-change wizard does after its two operator confirmations. The two '
            + 'stored measurements must be an ordered old/new pair taken since the machine last '
            + '(re)connected (work origins die on a reboot) unless old/new trigger Zs are passed '
            + 'explicitly. Verify with get_position afterwards.',
        inputSchema: {
            type: 'object',
            properties: {
                old_trigger_z: { type: 'number', description: 'Machine trigger Z of the OLD tool. Default: the previous measurement.' },
                new_trigger_z: { type: 'number', description: 'Machine trigger Z of the NEW tool. Default: the last measurement.' },
                reason: { type: 'string', description: 'Shown to the operator.' },
            },
            required: ['reason'],
            additionalProperties: false,
        },
        handler: async (args: { old_trigger_z?: number; new_trigger_z?: number; reason?: string }) => {
            probeFeedService.assertNoOvertravel();
            const measurements = getMeasurements();
            const oldZ = args.old_trigger_z !== undefined ? Number(args.old_trigger_z)
                : measurements.previous?.measuredTriggerZ;
            const newZ = args.new_trigger_z !== undefined ? Number(args.new_trigger_z)
                : measurements.last?.measuredTriggerZ;
            if (oldZ === undefined || newZ === undefined || !Number.isFinite(oldZ) || !Number.isFinite(newZ)) {
                throw new McpToolError('Need two measurements: previous (old tool) and last (new tool). '
                    + 'Either run run_tool_setter before and after the change, or pass old_trigger_z / '
                    + `new_trigger_z explicitly. Stored: ${JSON.stringify(measurements)}`);
            }
            // The stored pair must really be old -> new on THIS connection: a
            // measurement from before a reconnect may belong to a work origin the
            // machine has since forgotten (operator law 2026-09-14). Explicit
            // trigger Zs bypass this - the operator vouches for them.
            const explicit = args.old_trigger_z !== undefined || args.new_trigger_z !== undefined;
            if (!explicit && measurements.previous && measurements.last) {
                if (measurements.last.at < measurements.previous.at) {
                    throw new McpToolError('The stored measurements are not an old -> new pair (the "last" one is older than the '
                        + '"previous" one). Re-measure, or pass old_trigger_z / new_trigger_z explicitly.');
                }
                const resetAt = machinePositionDiagnostics().resetAt;
                if (resetAt !== null && (measurements.previous.at < resetAt || measurements.last.at < resetAt)) {
                    throw new McpToolError('A stored measurement predates the machine\'s last (re)connection at '
                        + `${new Date(resetAt).toISOString()} - the work origin it was taken against may no longer exist `
                        + '(work origins die on a machine reboot). Re-measure both tools, or pass old_trigger_z / '
                        + 'new_trigger_z explicitly if the operator vouches for them.');
                }
            }
            const deltaMm = Number((newZ - oldZ).toFixed(3));
            if (Math.abs(deltaMm) > MAX_TOOL_LENGTH_DELTA_MM) {
                throw new McpToolError(`Computed length difference ${deltaMm} mm exceeds the ${MAX_TOOL_LENGTH_DELTA_MM} mm sanity `
                    + 'limit - the two measurements are probably not an old/new pair of the same setup.');
            }

            const position = getPositionSnapshot();
            requireReliableMachine(position, 'this tool-setter operation');
            if (position.machineStatus !== 'idle') {
                throw new McpToolError(`Machine is ${position.machineStatus || 'in an unknown state'}, not idle.`);
            }
            if (position.work.z === null) {
                throw new McpToolError('Current work Z unknown; cannot compute the G92.');
            }
            // A tool longer by delta puts the tip delta lower at the same
            // toolhead height, so the SAME position must now read delta LESS
            // work Z: G92 Z(current work Z - delta). Nothing moves.
            const newWorkZ = Number((position.work.z - deltaMm).toFixed(3));
            // machine = work - offset and machine does not move, so the offset
            // shifts by -delta and work Z0 lands delta higher on the machine scale.
            const offsetAfter = Number((position.originOffset.z - deltaMm).toFixed(3));
            const gcode = [
                `; tool length offset: new tool trigger Z ${newZ} vs old ${oldZ} -> ${deltaMm >= 0 ? '+' : ''}${deltaMm} mm ${deltaMm >= 0 ? 'longer' : 'shorter'}`,
                '; frame: WORK - this G92 rewrites the work origin Z of the selected workspace; the toolhead does NOT move',
                `; toolhead stays at machine Z ${position.machine.z}; current work Z reads ${position.work.z}; after this G92 it reads ${newWorkZ}`,
                `; work-origin Z offset ${position.originOffset.z} -> ${offsetAfter}; work Z0 = machine Z ${(-position.originOffset.z).toFixed(3)} -> ${(-offsetAfter).toFixed(3)}`,
                '; the sanctioned tool-length transfer: what the touchscreen tool-change wizard does after its two confirmations',
                `G92 Z${newWorkZ.toFixed(3)}`,
            ].join('\n');
            const validation = validateStagedEnvelope(gcode, 'apply_tool_length_offset');
            // The generic validator warning points at this tool as the sanctioned
            // path - on this tool's own page it would only confuse. Say it plainly.
            validation.warnings = validation.warnings.filter((w) => !w.startsWith('Contains G92'));
            validation.warnings.push('This job rewrites the WORK ORIGIN Z by G92 - the sanctioned tool-length path (mirrors the '
                + `touchscreen wizard). Nothing moves. Work Z0 moves from machine Z ${(-position.originOffset.z).toFixed(3)} to `
                + `${(-offsetAfter).toFixed(3)}.`);
            const job = jobManager.submit(
                gcode,
                `tool-offset ${deltaMm >= 0 ? '+' : ''}${deltaMm}mm - ${String(args.reason).slice(0, 40)}`,
                'cnc',
                validation,
                'direct'
            );
            return {
                job: jobManager.describe(job),
                old_trigger_z: oldZ,
                new_trigger_z: newZ,
                delta_mm: deltaMm,
                current_work_z: position.work.z,
                work_z_after: newWorkZ,
                machine_z: position.machine.z,
                origin_offset_z_before: position.originOffset.z,
                origin_offset_z_after: offsetAfter,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Operator reviews the G92 (no motion - the work frame shifts by the tool '
                    + 'length difference) and approves; start_gcode_job executes it. Verify with '
                    + 'get_position that originOffset.z changed by the delta.',
            };
        },
    });
}
