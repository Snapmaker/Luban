/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import { connectionManager } from '../../machine/ConnectionManager';
import { describeActiveTool, getActiveTool, invalidateActiveTool, setActiveTool } from '../activeTool';
import { jobManager } from '../jobs';
import { SetterDatum, parseSetterDatum } from '../toolDatum';
import { currentSetterDatum } from '../toolDatumState';
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
import { MAX_TOOL_LENGTH_DELTA_MM, TOOL_SETTER_FLOOR_MARGIN_MM, TRAVERSE_FEED, within } from '../procedureLimits';
import { clearanceOptions } from '../clearanceContext';
import { landmarkStore } from '../landmarks';
import { decideSafeZTraverse } from '../safeZPolicy';
import { TRAVERSE_Z_TOLERANCE_MM, planTraverseXy } from '../traversePlan';
import { runPolicyApprovedDirectJob } from './gcode';
import { validateStagedEnvelope } from './staging';
import {
    getPositionSnapshot,
    machinePositionDiagnostics,
    requirePlanningTravel,
    requireReliableMachine,
    requireZAxis,
    safeTraverseZ,
    safeZApprovalInput,
} from './machine';

export function registerToolSetterTools(registry: ToolRegistry, getConfirmBaseUrl: () => string): void {
    registry.register({
        name: 'set_tool_setter_config',
        description: 'Store the tool setter reference: its centre in MACHINE coordinates, the machine '
            + 'Z at which a reference fitting triggers it and nominal approach lengths in that same convention. All '
            + 'values come from the OPERATOR (or a store_as_reference run) - never from visual '
            + 'estimation. The expected trigger Z for any bit follows as '
            + 'triggerZ + (approach length - reference approach length). A named setter_datum and independent '
            + 'toolhead_clearance_bound are separate from these approach estimates.',
        inputSchema: {
            type: 'object',
            properties: {
                center_x: { type: 'number', description: 'Machine X of the setter centre.' },
                center_y: { type: 'number', description: 'Machine Y of the setter centre.' },
                trigger_z: { type: 'number', description: 'Machine Z at trigger with the reference bit.' },
                reference_bit_length_mm: { type: 'number', description: 'Nominal reference length for approach planning, mm; not independently calibrated geometry.' },
                setter_datum: {
                    type: 'object',
                    description: 'Explicit named coordinate datum. Omission preserves the existing datum; legacy references are labelled conventional, not physically verified.',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        machine_z: { type: 'number' },
                        basis: { type: 'string', enum: ['measured', 'legacy_reference_convention'] },
                        source: { type: 'string', description: 'Measurement/evidence establishing this datum and its physical reference; never an approach estimate.' },
                        uncertainty_mm: { type: 'number', minimum: 0, description: 'Bound including datum setup and sensor-trigger effects; required for measured basis.' },
                    },
                    required: ['id', 'name', 'machine_z', 'basis', 'source'],
                    additionalProperties: false,
                },
                disc_diameter_mm: {
                    type: 'number',
                    description: 'Diameter of the setter\'s contact disc, if measured. Nothing here needs it; the '
                        + 'camera bootstrap uses it as an absolute scale reference in a frame.',
                },
                longest_bit_length_mm: { type: 'number', description: 'Largest nominal approach length in use, in the approach reference convention; sets start height, never physical clearance.' },
                toolhead_clearance_bound: { type: ['object', 'null'],
                    description: 'Optional independent conservative maximum below the machine toolhead reference; never collet protrusion. Omit to preserve; null clears.',
                    properties: { mm: { type: 'number', exclusiveMinimum: 0 }, source: { type: 'string' } },
                    required: ['mm', 'source'],
                    additionalProperties: false },
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
            setter_datum?: { id: string; name: string; machine_z: number; basis: SetterDatum['basis']; source: string; uncertainty_mm?: number };
            disc_diameter_mm?: number;
            longest_bit_length_mm?: number;
            toolhead_clearance_bound?: { mm: number; source: string } | null;
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
            if (Object.values(numbers).some((v) => v !== undefined && !Number.isFinite(v))) {
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
            let datum = currentSetterDatum();
            if (args.setter_datum !== undefined) {
                const input = args.setter_datum;
                datum = parseSetterDatum({ id: String(input.id || '').trim(),
                    name: String(input.name || '').trim(),
                    machineZ: input.machine_z,
                    basis: input.basis,
                    source: String(input.source || '').trim(),
                    uncertaintyMm: input.uncertainty_mm ?? null,
                    at: Date.now() });
                if (!datum || (datum.basis === 'measured' && datum.uncertaintyMm === null)) {
                    throw new McpToolError('setter_datum requires a name/id, finite machine_z, source and valid basis; measured datum also requires a nonnegative uncertainty_mm bound.');
                }
            }
            const toolheadClearanceBound = args.toolhead_clearance_bound === undefined
                ? existing?.toolheadClearanceBound : args.toolhead_clearance_bound;
            if (toolheadClearanceBound && (!Number.isFinite(toolheadClearanceBound.mm) || toolheadClearanceBound.mm <= 0
                || !String(toolheadClearanceBound.source || '').trim())) {
                throw new McpToolError('toolhead_clearance_bound requires a positive finite mm bound and its source/reference.');
            }
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
                datum,
                toolheadClearanceBound,
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
            + 'park position), named datum and retained measurement history. Read-only.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => ({
            config: getToolSetterConfig(), datum: currentSetterDatum(), measurements: getMeasurements(), active_tool: describeActiveTool(),
        }),
    });

    registry.register({
        name: 'set_active_tool',
        description: 'Record the operator-confirmed fitted tool for clearance, no motion or confirm page. protrusion_mm is the conservative distance below the toolhead, NOT probe contact calibration or necessarily overall length. Only protrusion_reference toolhead establishes a fitted physical bound; collet or unknown references cannot lower physical-obstacle clearance; it never bypasses the motion floor or legacy clearance_z boxes. run_tool_setter replaces it automatically. Restart, detected disconnect/reboot and tool-change parking make it stale; re-confirm the fitted tool, do not blindly replay a historical value.',
        inputSchema: {
            type: 'object',
            properties: {
                protrusion_mm: { type: 'number', description: 'Measured or operator-confirmed protrusion below the toolhead, mm.' },
                source: { type: 'string', enum: ['operator', 'tool_setter', 'spindle_probe'], description: 'Provenance of the assertion. Measurement procedures write their own source; operator is for an explicit fitted-tool confirmation.' },
                tool_identity: { type: 'string', description: 'Optional bit/probe identity.' },
                protrusion_reference: { type: 'string', enum: ['toolhead', 'collet', 'unknown'], description: 'Only an explicitly bounded distance below the machine toolhead reference may shorten physical clearance. Collet or unknown references are recorded but cannot shorten it.' },
                note: { type: 'string', description: 'Why this value is trusted, including the physical reference used.' },
                measurement_job_id: { type: 'string', description: 'Job that produced a measured assertion, when source is tool_setter or spindle_probe.' },
            },
            required: ['protrusion_mm', 'source'],
            additionalProperties: false,
        },
        handler: async (args: {
            protrusion_mm?: number; source?: string; tool_identity?: string; protrusion_reference?: string; note?: string; measurement_job_id?: string;
        }) => {
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
                const current = getActiveTool();
                if (current?.clearanceBasis !== 'toolhead_reference') {
                    throw new McpToolError('This setter measurement has an unverified physical datum; it cannot establish a physical clearance bound. Preserve its conventional offset separately.');
                }
                const measurement = jobManager.get(String(args.measurement_job_id));
                const result = measurement?.result as { active_tool?: { source?: string; protrusionMm?: number } } | undefined;
                if (measurement?.state !== 'completed' || result?.active_tool?.source !== source
                    || Math.abs(Number(result.active_tool.protrusionMm) - protrusionMm) > 0.001) {
                    throw new McpToolError('Measured provenance must match a completed tool-setter job and its actual protrusion. For a current operator assertion use source operator and quote that confirmation.');
                }
            }
            const previous = getActiveTool();
            const active = setActiveTool({
                protrusionMm,
                clearanceBasis: source !== 'operator' || args.protrusion_reference === 'toolhead' ? 'toolhead_reference' : 'unknown',
                measurementId: source !== 'operator' ? previous?.measurementId : null,
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
        description: 'Read the usable active-tool clearance assertion, age and provenance, or active:null plus stored/staleReason when invalidated. Re-read after every setter run or swap. Stale fitting records cannot bound an unknown replacement; fallback requires the explicitly configured toolhead_clearance_bound. Legacy approach lengths and probe offsets do not establish that bound. No motion or confirm page.',
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
            + 'reports the raw median trigger Z, per-pass contacts and spread, fitting identity, and the named datum '
            + 'used for a separate tip projection. bit_length_mm controls the approach only. A hard floor and '
            + 'the overtravel tripwire bound the descent.',
        inputSchema: {
            type: 'object',
            properties: {
                bit_length_mm: {
                    type: 'number',
                    description: 'Approximate fitted length for APPROACH PLANNING only, in the same nominal convention as the approach reference; never calibrated tool geometry.',
                },
                tool_identity: { type: 'string', description: 'Stable tool name/id retained with this raw trigger measurement.' },
                fitting_id: { type: 'string', description: 'Identity of this seating of the tool; defaults to the measurement job. Re-fitting requires a new identity.' },
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
                    description: 'After a successful run, update the APPROACH reference trigger and nominal length. The named coordinate datum remains unchanged; the approach estimate is never a calibration.',
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
            + 'Y only if configured). One approval covers two exact steps: Z up first, then X/Y, one start_gcode_job call each. '
            + 'If the head is ALREADY at the park Z (= at or above the traverse height) on a verified, homed position and '
            + 'mcpTraverseWithoutApprovalAtSafeZ is on (operator ruling 2026-10-17, #241), the no-op Z step is skipped and the XY leg runs '
            + 'on the call after the landmark/travel checks, with no confirm page (result executed_without_approval: true). The operator then '
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
            // A tool-change park is a CNC move with a Z step; a machine with
            // no Z axis has neither the step nor the tool change.
            requireZAxis('goto_tool_change_position (its first step is a Z move)');
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

            // Operator ruling 2026-10-17 (#241): with the head already at the
            // park Z - which is at or above the traverse height - on a
            // verified, homed position, the Z step is a no-op and the XY leg
            // is exactly the transport traverse_xy runs without a page: plan
            // it through the same planner (travel + landmark checks at the
            // current Z; a landmark above the head refuses, never auto-runs)
            // and execute it on the call. Otherwise stage both steps as before.
            const { x: mx, y: my, z: mz } = position.machine;
            const atParkZ = mx !== null && my !== null && mz !== null
                && Math.abs(mz - cfg.changeZ) <= TRAVERSE_Z_TOLERANCE_MM;
            const policy = decideSafeZTraverse({
                ...safeZApprovalInput(),
                reliability: position.reliability,
                homed: position.isHomed,
                currentZ: mz,
                traverseZ: safeTraverseZ(),
            });
            if (atParkZ && policy.allowed) {
                const travel = requirePlanningTravel('the tool-change park move', { x: mx, y: my });
                let plan;
                try {
                    plan = planTraverseXy({
                        targets: [{ x: cfg.changeX, ...(cfg.changeY !== null ? { y: cfg.changeY } : {}) }],
                        frame: 'machine',
                        currentMachine: { x: mx as number, y: my as number, z: mz as number },
                        originOffset: position.originOffset,
                        travel: travel.limits,
                        traverseZ: safeTraverseZ(),
                        feedRate: TRAVERSE_FEED.default,
                        obstacles: landmarkStore.obstacleBoxes(),
                        ...clearanceOptions(),
                        reason: `tool-change park: ${String(args.reason)}`,
                    });
                } catch (err) {
                    if ((err as Error).name === 'TraversePlanError') {
                        throw new McpToolError(`Tool-change park XY leg refused: ${(err as Error).message}`);
                    }
                    throw err;
                }
                invalidateActiveTool('Tool-change park requested; confirm the fitted tool after the manual swap.');
                const validation = validateStagedEnvelope(plan.reviewText, 'goto_tool_change_position');
                const job = jobManager.submit(
                    plan.reviewText,
                    `tool-change park X${cfg.changeX} (already at Z${cfg.changeZ}) - ${String(args.reason).slice(0, 40)}`,
                    'cnc',
                    validation,
                    'direct'
                );
                const token = jobManager.approveByPolicy(job, policy.policy, `${policy.reason}; head already at the park Z ${cfg.changeZ}`);
                const run = await runPolicyApprovedDirectJob(job, token, true);
                return {
                    job: jobManager.describe(job),
                    executed_without_approval: true,
                    approval: { source: 'policy', policy: policy.policy, reason: policy.reason },
                    park: { x: cfg.changeX, y: cfg.changeY, z: cfg.changeZ },
                    z_step_skipped: `already at the park Z (machine Z ${(mz as number).toFixed(3)} vs ${cfg.changeZ})`,
                    distance_mm: Number(plan.totalDistanceMm.toFixed(1)),
                    position: run.settle.position,
                    position_verified: run.settle.verified,
                    warning: run.settle.warning,
                    next_step: `Moved to the park position on the call under ${policy.policy} (no confirm page). The operator swaps `
                        + 'the tool by hand; measure it with run_tool_setter and finish with apply_tool_length_offset.',
                };
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
                staged_because: atParkZ ? policy.reason : `the head is at machine Z ${mz === null ? 'unknown' : mz.toFixed(3)}, not the park Z ${cfg.changeZ}`,
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
