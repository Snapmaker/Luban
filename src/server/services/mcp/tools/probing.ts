/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import crypto from 'crypto';
import * as fs from 'fs-extra';
import path from 'path';

import DataStorage from '../../../DataStorage';
import { connectionManager } from '../../machine/ConnectionManager';
import { captureFrame } from '../camera';
import { cameraFailure, savePartialCameraIndex } from '../cameraRecovery';
import { probeCaptureSchema, surfaceCaptureSchema } from '../probeCapture';
import { jobEventLimit, jobManager } from '../jobs';
import { describeProbeCirclePlanAsGcode, planProbeCircle, runProbeCircleProcedure } from '../probeCircle';
import { describeProbePlanAsGcode, planProbePoint, runProbePointProcedure } from '../probeTool';
import { describeProbeSequencePlanAsGcode, planProbeSequence, runProbeSequenceProcedure } from '../probeSequence';
import {
    ProbeSurfacePlan,
    describeProbeSurfacePlanAsGcode,
    planProbeSurfaceGrid,
    planProbeSurfacePath,
    runProbeSurfaceProcedure,
} from '../probeSurface';
import { describeProbeOutlinePlanAsGcode, planProbeOutline, runProbeOutlineProcedure } from '../probeOutline';
import { describeProbeWallFollowPlanAsGcode, planProbeWallFollow, runProbeWallFollowProcedure } from '../probeWallFollow';
import { describeProbeCornerPlanAsGcode, planProbeCorner, runProbeCornerProcedure } from '../probeCorner';
import { describeProbeTracePlanAsGcode, planProbeTracePerimeter, runProbeTracePerimeterProcedure } from '../probeTracePerimeter';
import { describeProbeProgramAsGcode, planProbeProgram, runProbeProgramProcedure } from '../probeProgram';
import { describeProbeVectorPlanAsGcode, planProbeVector, runProbeVectorProcedure } from '../probeVector';
import { probeFeedService } from '../probeFeed';
import { TRAVEL_FEED, assertMachineReadyForProcedure, moveMachineSettled } from '../probing';
import { McpToolError, ToolRegistry } from '../registry';
import { geometryValue } from '../rotaryGeometry';
import { checkMotion, describeViolations } from '../envelopeChecks';
import { belowCameraFloor } from '../cameraSafety';
import { TRAVERSE_Z_TOLERANCE_MM } from '../traversePlan';
import { fovAt } from '../cameraGeometry';
import { judgeSeams, pitchForOverlap } from '../surveyMosaic';
import { modelContext, requireCameraModel } from './cameraModel';
import { judgeCameraModel } from '../cameraModel';
import { cameraModelStore } from '../cameraModelStore';
import { renderMosaic } from '../surveyRender';
import {
    getPositionSnapshot,
    getMachineSizeByIdentifier,
    motionFloorZ,
    requirePlanningTravel,
    requireReliableMachine,
    safeTraverseZ,
} from './machine';
import { clampBand, describeClipping } from '../machineTravel';
import { clearanceOptions } from '../clearanceContext';
import { landmarkStore } from '../landmarks';
import { SurveyLeg, describeSurveyLegs, planSurvey } from '../surveyPlan';
import {
    MAX_OVERLAP_FRACTION,
    MAX_SURVEY_LEVELS,
    SURVEY_LINK_FEED_FACTOR,
    SURVEY_MARGIN_MM,
    SURVEY_PITCH_MM,
    clampTo,
} from '../procedureLimits';
import { validateStagedEnvelope } from './staging';

// The spindle touch probe (probe feed channel) and the whole-bed camera
// survey: the survey gives the agent visual context ("measure the stock on
// the rotary axis"), the probe turns that context into millimetres.


export function registerProbingTools(registry: ToolRegistry, getConfirmBaseUrl: () => string): void {
    registry.register({
        name: 'probe_point',
        description: 'Stage a touch-probe point measurement for human confirmation: a single-axis '
            + 'sensor-gated march FROM THE CURRENT POSITION along +/-X, +/-Y or -Z, using the '
            + 'spindle touch probe (probe feed channel). Same staged mechanics as the tool setter: '
            + 'coarse steps to contact, retreat to release, fine steps, quick lift-and-retest '
            + 'confirm cycles - returns the median contact coordinate in machine coords with '
            + 'spread. Position first (move_and_capture / move_z), then stage; the envelope is '
            + 'anchored to the staging position and re-verified before motion. Remember the tip '
            + 'radius on side probes: the surface is one tip-radius beyond the contact centre.',
        inputSchema: {
            type: 'object',
            properties: {
                axis: { type: 'string', enum: ['x', 'y', 'z'], description: 'Axis to march along.' },
                direction: { type: 'number', enum: [1, -1], description: 'Sign of travel; Z is -1 only.' },
                max_travel_mm: {
                    type: 'number',
                    description: 'REQUIRED hard travel limit (1-150): the march aborts here without contact.',
                },
                coarse_step_mm: { type: 'number', description: 'Coarse step, default 1 (0.2-1; never larger - the coarse step is also the press into the probe).' },
                fine_step_mm: { type: 'number', description: 'Fine step, default 0.1 (0.02-0.5).' },
                backoff_mm: { type: 'number', description: 'Confirm-cycle lift, default 1 (also the confirm re-contact window).' },
                sensor_delay_ms: { type: 'number', description: 'Contact-check window per step, default 300.' },
                confirm_passes: { type: 'number', description: 'Lift-and-retest cycles, default 3 (1-10).' },
                reason: { type: 'string', description: 'Shown to the operator: what is being measured and why.' },
            },
            required: ['axis', 'direction', 'max_travel_mm', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            if (!String(args.reason || '').trim()) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            probeFeedService.assertNoOvertravel();
            const plan = planProbePoint(args as Parameters<typeof planProbePoint>[0]);
            const envelope = `; reason: ${String(args.reason).trim()}
${describeProbePlanAsGcode(plan)}`;
            const validation = validateStagedEnvelope(envelope, 'probe_point');
            const job = jobManager.submit(
                envelope,
                `probe ${plan.direction === 1 ? '+' : '-'}${plan.axis.toUpperCase()} `
                    + `${plan.maxTravelMm}mm - ${String(args.reason).slice(0, 40)}`,
                'cnc',
                validation,
                'procedure'
            );
            job.runner = async () => runProbePointProcedure(plan);
            return {
                job: jobManager.describe(job),
                plan,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url, review the envelope (anchored to the '
                    + 'current position), and approve. Their one-time code passed to start_gcode_job '
                    + 'runs the march and returns the contact coordinate.',
            };
        },
    });

    registry.register({
        name: 'probe_vector',
        description: 'Stage a touch-probe march along an ARBITRARY direction for human confirmation: '
            + 'from the CURRENT position along the given (dx, dy, dz) heading - any XY direction, '
            + 'optionally angled downward, never upward. Same staged mechanics as probe_point '
            + '(coarse steps to contact, retreat to release, fine steps, lift-and-retest confirm '
            + 'cycles); the march is parametrized along the unit vector so every commanded position '
            + 'lies on the approved segment. Returns the median contact as machine XYZ plus the '
            + 'distance along the vector. probe_point is the axis-aligned special case; use this '
            + 'for angled edges, chamfers, polygon faces, and inside-a-hole checks. Position first '
            + '(top-gantry traverse, operator-confirmed descent), then stage.',
        inputSchema: {
            type: 'object',
            properties: {
                dx: { type: 'number', description: 'Direction X component (machine frame). Magnitude ignored.' },
                dy: { type: 'number', description: 'Direction Y component.' },
                dz: { type: 'number', description: 'Direction Z component; must be <= 0 (downward or level).' },
                max_travel_mm: {
                    type: 'number',
                    description: 'REQUIRED hard travel limit (1-150) along the vector: the march aborts '
                        + 'there without contact. Clamped so the whole segment stays in the machine envelope.',
                },
                coarse_step_mm: { type: 'number', description: 'Coarse step, default 1 (0.2-1; never larger - the coarse step is also the press into the probe).' },
                fine_step_mm: { type: 'number', description: 'Fine step, default 0.1 (0.02-0.5).' },
                backoff_mm: { type: 'number', description: 'Confirm-cycle lift, default 1 (also the confirm re-contact window).' },
                sensor_delay_ms: { type: 'number', description: 'Contact-check window per step, default 300.' },
                confirm_passes: { type: 'number', description: 'Lift-and-retest cycles, default 3 (1-10).' },
                reason: { type: 'string', description: 'Shown to the operator: what is being measured and why.' },
            },
            required: ['max_travel_mm', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            if (!String(args.reason || '').trim()) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            probeFeedService.assertNoOvertravel();
            const plan = planProbeVector(args as Parameters<typeof planProbeVector>[0]);
            const envelope = `; reason: ${String(args.reason).trim()}
${describeProbeVectorPlanAsGcode(plan)}`;
            const validation = validateStagedEnvelope(envelope, 'probe_vector');
            const job = jobManager.submit(
                envelope,
                `probe-vector (${plan.unit.x},${plan.unit.y},${plan.unit.z}) ${plan.maxTravelMm}mm `
                    + `- ${String(args.reason).slice(0, 40)}`,
                'cnc',
                validation,
                'procedure'
            );
            job.runner = async () => runProbeVectorProcedure(plan);
            return {
                job: jobManager.describe(job),
                plan,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url, review the envelope (anchored to the '
                    + 'current position), and approve. Their one-time code passed to start_gcode_job '
                    + 'runs the march and returns the contact coordinate.',
            };
        },
    });

    registry.register({
        name: 'probe_sequence',
        description: 'Stage a whole measurement CIRCUIT as ONE operator approval: an ordered list of '
            + 'steps - hop (XY traverse; the runner always raises to the safe traverse height first), '
            + 'descend (absolute Z at current XY), probe (named sensor-gated march along +/-X/+/-Y/-Z '
            + 'or any downward vector, with the proven coarse/release/fine/confirm mechanics). The '
            + 'plan is simulated at staging so the confirm page enumerates every commanded move with '
            + 'concrete numbers; the runner re-verifies the machine matches the simulation before '
            + 'every march. Contact is expected ONLY during marches - a touch during any hop, raise '
            + 'or descent latches the CRASH alarm. Every number must be measured or operator-stated. '
            + 'Optional capture on a probe step photographs the final contact before retracting. '
            + 'EVERY probe, including a continuing miss, returns to its own start and then raises before the next step. '
            + 'For related local stations prefer surface_path/grid, wall_follow, trace, corner or stock_outline when their '
            + 'geometry fits; one approval does not make this sequence a continuous low path. '
            + 'Results keyed by march name, machine coords only.',
        inputSchema: {
            type: 'object',
            properties: {
                steps: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 60,
                    description: 'Ordered circuit steps.',
                    items: {
                        type: 'object',
                        properties: {
                            kind: { type: 'string', enum: ['hop', 'descend', 'probe'] },
                            x: { type: 'number', description: 'hop: target machine X.' },
                            y: { type: 'number', description: 'hop: target machine Y.' },
                            z: { type: 'number', description: 'descend: absolute machine Z.' },
                            name: { type: 'string', description: 'probe: unique result key.' },
                            capture: probeCaptureSchema,
                            dx: { type: 'number', description: 'probe: direction X component.' },
                            dy: { type: 'number', description: 'probe: direction Y component.' },
                            dz: { type: 'number', description: 'probe: direction Z component (<= 0).' },
                            max_travel_mm: { type: 'number', description: 'probe: hard travel limit (1-150).' },
                            on_miss: {
                                type: 'string',
                                enum: ['continue', 'abort'],
                                description: 'probe: reaching max_travel_mm without contact records a no_contact result and continues '
                                    + '(default) or aborts the sequence. A later reference to a missed probe is refused at that op.',
                            },
                        },
                        required: ['kind'],
                        additionalProperties: false,
                    },
                },
                coarse_step_mm: { type: 'number', description: 'Coarse step for all marches, default 1 (0.2-2).' },
                fine_step_mm: { type: 'number', description: 'Fine step, default 0.1 (0.02-0.5).' },
                backoff_mm: { type: 'number', description: 'Confirm-cycle lift, default 1 (also the confirm re-contact window).' },
                sensor_delay_ms: { type: 'number', description: 'Contact-check window per step, default 300.' },
                confirm_passes: { type: 'number', description: 'Lift-and-retest cycles per march, default 3 (1-10).' },
                reason: { type: 'string', description: 'Shown to the operator: what the circuit measures and why.' },
            },
            required: ['steps', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            if (!String(args.reason || '').trim()) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            probeFeedService.assertNoOvertravel();
            const plan = planProbeSequence(args as Parameters<typeof planProbeSequence>[0]);
            const envelope = `; reason: ${String(args.reason).trim()}
${describeProbeSequencePlanAsGcode(plan)}`;
            const validation = validateStagedEnvelope(envelope, 'probe_sequence');
            const marches = plan.steps.filter((s) => s.kind === 'probe').length;
            const job = jobManager.submit(
                envelope,
                `probe-sequence ${plan.steps.length}steps/${marches}marches - ${String(args.reason).slice(0, 40)}`,
                'cnc',
                validation,
                'procedure'
            );
            job.runner = async () => runProbeSequenceProcedure(plan);
            return {
                job: jobManager.describe(job),
                plan,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url, review the ENTIRE circuit (every hop, '
                    + 'descent and march is enumerated), and approve once. Their one-time code passed to '
                    + 'start_gcode_job runs the whole circuit and returns all named contacts.',
            };
        },
    });

    registry.register({
        name: 'probe_circle',
        description: 'Stage an N-point circle measurement of a roughly-round vertical feature for '
            + 'human confirmation: radial sensor-gated marches from evenly spaced azimuths, then a '
            + 'least-squares circle fit. OUTSIDE mode (post/boss/pin, default): marches step inward; '
            + 'requires the estimated centre and a MEASURED top height; yields the COMBINED diameter '
            + '(feature + tip). INSIDE mode (inside: true, a HOLE): the operator first positions the '
            + 'tip INSIDE the hole at the measuring depth; marches step OUTWARD from that staged '
            + 'position to the wall, no hops, ending with a vertical raise out along the entry path; '
            + 'yields hole diameter MINUS tip. Both need the operator\'s MIN and MAX diameter '
            + 'estimates - they bound every march so a wrong guess aborts instead of pressing on. '
            + 'Residuals expose an out-of-round tip or feature. Outside repositioning obeys motion '
            + 'law 2 (traverse-height hops); a probe touch during a hop or descent latches CRASH. '
            + 'All results in MACHINE coordinates.',
        inputSchema: {
            type: 'object',
            properties: {
                inside: {
                    type: 'boolean',
                    description: 'true = measure a HOLE from inside (tip already positioned in it at '
                        + 'depth); false/omitted = measure a feature from outside.',
                },
                center_x: { type: 'number', description: 'OUTSIDE mode: estimated feature centre X, machine coords. Ignored inside (the staged position is the march origin).' },
                center_y: { type: 'number', description: 'OUTSIDE mode: estimated feature centre Y, machine coords.' },
                diameter_min_mm: {
                    type: 'number',
                    description: 'Operator\'s LOWER bound on the feature diameter: marches abort at this '
                        + 'radius without contact instead of pressing on.',
                },
                diameter_max_mm: {
                    type: 'number',
                    description: 'Operator\'s UPPER bound on the feature diameter: approaches start '
                        + 'approach_clearance_mm beyond this radius.',
                },
                top_z_machine: {
                    type: 'number',
                    description: 'OUTSIDE mode (required there): toolhead machine Z at which the probe '
                        + 'tip touches the feature TOP - measured (probe_point -Z) or operator-stated, '
                        + 'never guessed. Optional record-keeping inside.',
                },
                probe_depth_mm: { type: 'number', description: 'Side contacts this far below the top, default 3 (0.5-20).' },
                points: { type: 'number', description: 'Contact points around the circle, default 8 (4-16).' },
                approach_clearance_mm: {
                    type: 'number',
                    description: 'Start-radius margin beyond max/2, default 5 (1-20). Must exceed the '
                        + 'probe tip radius plus a safety margin.',
                },
                coarse_step_mm: { type: 'number', description: 'Coarse radial step, default 0.5 (0.2-2).' },
                fine_step_mm: { type: 'number', description: 'Fine step, default 0.1 (0.02-0.5).' },
                backoff_mm: { type: 'number', description: 'Confirm-cycle lift, default 1 (also the confirm re-contact window).' },
                sensor_delay_ms: { type: 'number', description: 'Contact-check window per step, default 300.' },
                confirm_passes: { type: 'number', description: 'Lift-and-retest cycles per point, default 2 (1-5).' },
                reason: { type: 'string', description: 'Shown to the operator: what is being measured and why.' },
            },
            required: ['diameter_min_mm', 'diameter_max_mm', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            if (!String(args.reason || '').trim()) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            probeFeedService.assertNoOvertravel();
            const plan = planProbeCircle(args as Parameters<typeof planProbeCircle>[0]);
            const envelope = `; reason: ${String(args.reason).trim()}
${describeProbeCirclePlanAsGcode(plan)}`;
            const validation = validateStagedEnvelope(envelope, 'probe_circle');
            const job = jobManager.submit(
                envelope,
                `probe-circle${plan.inside ? ' INSIDE' : ''} ${plan.points.length}pts d${plan.diameterMinMm}-${plan.diameterMaxMm} `
                    + `- ${String(args.reason).slice(0, 40)}`,
                'cnc',
                validation,
                'procedure'
            );
            job.runner = async () => runProbeCircleProcedure(plan);
            return {
                job: jobManager.describe(job),
                plan,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url, review the full envelope (all marches, '
                    + 'hops and depths), and approve. Their one-time code passed to start_gcode_job runs '
                    + 'the whole star and returns the circle fit.',
            };
        },
    });

    // Shared staging for the two top-surface scans. The envelope description
    // is repeated in both tool descriptions on purpose: the MCP client caches
    // schemas, and the operator-authorised law-2 exception must be visible
    // wherever the tool is read.
    const SURFACE_ENVELOPE_TEXT = 'SURFACE ENVELOPE (operator-authorised 2026-09-05; valid only inside this '
        + 'procedure between consecutive stations; other probing procedures have their own bounded links): '
        + 'guarded mode retracts to LAST CONTACT + z_safe_delta_mm (default 20, HARD CAP 20) and hops in <= 10 mm '
        + 'sensor-checked segments expecting NO contact; a touch latches CRASH. Stepped mode uses LAST CONTACT + '
        + 'hop_lift_mm (default 2) and touch-probing links with backoff/lift recovery; contact during a lift holds. '
        + 'Both modes require the next station within max_hop_mm (default 60, HARD CAP 60) - wider spacing/pitch '
        + 'is REFUSED at staging, never split silently. Each -Z march '
        + 'searches from the hop height down to max(last contact - max_drop_mm (default 40, cap 80), '
        + 'floor_z_machine (default start_z_machine - max_drop_mm)); reaching the floor without contact records '
        + 'the station as no_contact and continues with the reference height unchanged (the first station finding '
        + 'nothing aborts). The approach to the FIRST station is a full law-2 move: raise to the safe traverse '
        + 'height, traverse, guarded 1 mm descent to start_z_machine (REQUIRED - a measured or operator-stated '
        + 'toolhead machine Z with the tip just above the surface, never a guess). Ends raised at the traverse '
        + 'height. All numbers MACHINE coordinates; Z values are toolhead Z at contact (surface = Z - probe length).';
    const surfaceCommonProperties = {
        capture: surfaceCaptureSchema,
        start_z_machine: {
            type: 'number',
            description: 'REQUIRED. Toolhead machine Z where the first -Z march starts (probe tip just above the '
                + 'surface) - measured (probe_point -Z, an earlier scan) or operator-stated. Reached by a guarded descent.',
        },
        floor_z_machine: {
            type: 'number',
            description: 'Absolute deepest toolhead machine Z any march may command. Default start_z_machine - '
                + 'max_drop_mm. State it explicitly (lower) to scan into a deep pocket; must stay within 150 mm of start_z_machine.',
        },
        z_safe_delta_mm: {
            type: 'number',
            description: 'Guarded mode: retract above the last contact for the next hop. Stepped mode uses hop_lift_mm instead. Default 20, HARD CAP 20 '
                + '(operator law), min 3. Above the cap = refused.',
        },
        max_hop_mm: {
            type: 'number',
            description: 'Largest allowed horizontal distance between consecutive stations. Default 60, HARD CAP 60 '
                + '(operator law). A plan whose spacing/pitch exceeds it is refused at staging.',
        },
        max_drop_mm: {
            type: 'number',
            description: 'How far below the previous contact one station may search before recording no_contact. '
                + 'Default 40, cap 80 (also bounded by floor_z_machine).',
        },
        coarse_step_mm: {
            type: 'number',
            description: 'Coarse -Z step for every march, default 1, range 0.5-1 (operator law: never larger - the '
                + 'coarse step is ALSO the worst-case press into the probe wherever the surface is found by a coarse '
                + 'step, because the controller finishes the step before the runner sees the sensor; inside the slow '
                + 'zone the press is one fine step instead). Values above 1 are clamped to 1.',
        },
        fine_step_mm: { type: 'number', description: 'Fine step, default 0.1 (0.02-0.5).' },
        backoff_mm: { type: 'number', description: 'Confirm-cycle lift, default 1 (also the confirm re-contact window).' },
        sensor_delay_ms: {
            type: 'number',
            description: 'Contact-check window per step, default 300, floor 30 (GPIO transport: 50 is ample - the trigger led '
                + 'the controller reply on every contact measured).',
        },
        confirm_passes: { type: 'number', description: 'Lift-and-retest cycles per station, default 3 (1-10).' },
        slow_zone_mm: {
            type: 'number',
            description: 'Coarse steps stop this far ABOVE the expected contact (the previous station\'s Z; '
                + 'expected_z_machine for station 1) and fine steps take over, down to slow_zone + 2 x coarse below it '
                + '(coarse resumes lower). Caps the press into the probe at one fine step where the surface is where '
                + 'expected. Default 1, min 0.3, max z_safe_delta_mm.',
        },
        hop_mode: {
            type: 'string',
            enum: ['guarded', 'stepped'],
            description: 'Travel between stations: "guarded" (default) hops at last contact + z_safe_delta_mm expecting no contact '
                + '(a contact aborts); "stepped" travels at last contact + hop_lift_mm as a touch-probing traverse (1 mm steps, '
                + 'probe expected) that backs off with up to one ball radius of extra clearance on a verified incoming path, '
                + 'then lifts in sensor-checked 0.5 mm segments. Contact during a lift holds the program. The height follows the surface '
                + 'in steps, gentle over a slope or one lift at the wall of a hole, instead of a fixed clearance.',
        },
        hop_lift_mm: { type: 'number', description: 'stepped hop_mode: lift per contact and travel height above the last contact, default 2 (0.5-10).' },
        expected_profile: {
            type: 'object',
            description: 'Optional surface MODEL for curved stock: {"circle": {"center_x", "center_z_contact", "radius", '
                + '"tip_radius"?}} = a cylinder along machine Y (the rotary axis) with the given axis X, toolhead Z with the '
                + 'tip on the axis (axis.z_contact when the geometry is configured) and stock radius (operator-bounded). '
                + 'Every station then gets its own expected contact Z from the model (slow zone + max_drop band follow it, '
                + 'not the previous station); stations more than 0.7 x radius off the axis are refused (the tip would '
                + 'glance). In a probe_program the numbers may be references.',
        },
        expected_z_machine: {
            type: 'number',
            description: 'Optional: toolhead machine Z of a MEASURED neighbouring contact (probe_point -Z, a probe_sequence '
                + 'centre, an earlier scan) so station 1 gets the slow zone too. Never inferred (law 3). Without it '
                + 'station 1 uses coarse steps capped at 1 mm.',
        },
        reason: { type: 'string', description: 'Shown to the operator: what surface is being scanned and why.' },
    };
    const stageSurfaceScan = (plan: ProbeSurfacePlan, reason: string, label: string) => {
        const envelope = `; reason: ${reason}
${describeProbeSurfacePlanAsGcode(plan)}`;
        const validation = validateStagedEnvelope(envelope, 'probe_surface');
        const job = jobManager.submit(
            envelope,
            `surface-${plan.kind} ${plan.stations.length}st ${label} - ${reason.slice(0, 40)}`,
            'cnc',
            validation,
            'procedure'
        );
        job.runner = async () => runProbeSurfaceProcedure(plan);
        return {
            job: jobManager.describe(job),
            plan,
            confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
            next_step: 'Ask the operator to open confirm_url and review the WHOLE scan: the law-2 exception '
                + `(hops at last contact + ${plan.zSafeDeltaMm} mm, largest hop ${plan.worstHopMm} mm), every station, `
                + `the guarded descent to Z${plan.startZMachine} and the absolute floor Z${plan.absoluteFloorZ}. One approval `
                + 'covers the circuit; their one-time code passed to start_gcode_job runs it (detached - long-poll '
                + 'get_gcode_job_status for the result: per-station machine XYZ plus flatness statistics).',
        };
    };

    registry.register({
        name: 'probe_surface_path',
        description: 'Stage a TOP-SURFACE FLATNESS scan along a straight line for human confirmation: N stations '
            + 'from a start point to an end point (or direction + length), spaced by count or maximum spacing, '
            + 'each measured with a -Z sensor-gated march of the spindle touch probe (coarse towards the expected contact, fine steps in a slow zone, '
            + 'lift-and-retest confirm, median). Result per station: machine XYZ of contact or no_contact; '
            + 'plus Z min/max/range, the best-fit line (slope in mm per 100 mm and degrees, rise over the length) '
            + 'and flatness as residual peak-to-valley, and a text profile. Purpose: level/flatness of stock along a '
            + `line, e.g. along a rotary-mounted board. ${SURFACE_ENVELOPE_TEXT}`,
        inputSchema: {
            type: 'object',
            properties: {
                start_x: { type: 'number', description: 'First station machine X.' },
                start_y: { type: 'number', description: 'First station machine Y.' },
                end_x: { type: 'number', description: 'Last station machine X (with end_y). Alternative: dx/dy + length_mm.' },
                end_y: { type: 'number', description: 'Last station machine Y.' },
                dx: { type: 'number', description: 'Path direction X component (with dy and length_mm) when end_x/end_y are not given. Magnitude ignored.' },
                dy: { type: 'number', description: 'Path direction Y component.' },
                length_mm: { type: 'number', description: 'Path length along dx/dy (1-400).' },
                stations: { type: 'number', description: 'Station count including both ends (2-400; above 60 the confirm page warns about duration and the event budget). Alternative: spacing_mm.' },
                spacing_mm: {
                    type: 'number',
                    description: 'MAXIMUM spacing: the length is divided evenly into steps no larger than this, both ends '
                        + 'covered. Must give consecutive stations within max_hop_mm or staging refuses.',
                },
                ...surfaceCommonProperties,
            },
            required: ['start_x', 'start_y', 'start_z_machine', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            const reason = String(args.reason || '').trim();
            if (!reason) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            probeFeedService.assertNoOvertravel();
            const plan = planProbeSurfacePath(args as Parameters<typeof planProbeSurfacePath>[0]);
            return stageSurfaceScan(plan, reason, `${plan.path ? plan.path.lengthMm : 0}mm`);
        },
    });

    registry.register({
        name: 'probe_surface_grid',
        description: 'Stage a TOP-SURFACE HEIGHT MAP for human confirmation: a serpentine grid of -Z touches of the '
            + 'spindle touch probe over a region (x/y extents, or centre + size; sampled by maximum pitch or by '
            + 'x_count/y_count), every station a sensor-gated march (coarse towards the expected contact, fine steps in a slow zone, '
            + 'lift-and-retest confirm, median). Result: per-station machine XYZ or no_contact, a zMatrix '
            + '(rows = ys ascending, cols = xs ascending, null = no contact) with its coordinates, Z min/max/range, '
            + 'the best-fit plane (tilt X/Y in mm per 100 mm and degrees) with per-point residuals and flatness '
            + '(residual peak-to-valley), and a compact text height map (+Y at the top). Purpose: scan a pocketed '
            + `box, a log, a wasteboard - anything with a top. ${SURFACE_ENVELOPE_TEXT}`,
        inputSchema: {
            type: 'object',
            properties: {
                x_min: { type: 'number', description: 'Region machine X minimum (with x_max/y_min/y_max). Alternative: center_x/center_y + size.' },
                x_max: { type: 'number', description: 'Region machine X maximum.' },
                y_min: { type: 'number', description: 'Region machine Y minimum.' },
                y_max: { type: 'number', description: 'Region machine Y maximum.' },
                center_x: { type: 'number', description: 'Region centre machine X (with center_y, size_x_mm[, size_y_mm]).' },
                center_y: { type: 'number', description: 'Region centre machine Y.' },
                size_x_mm: { type: 'number', description: 'Region width along X.' },
                size_y_mm: { type: 'number', description: 'Region depth along Y (default = size_x_mm).' },
                pitch_mm: {
                    type: 'number',
                    description: 'MAXIMUM grid pitch on both axes: each extent is divided evenly into steps no larger than '
                        + 'this, both edges covered. Must be within max_hop_mm (cap 60) or staging refuses - the operator '
                        + 'picks a finer pitch, the plan is never split.',
                },
                x_count: { type: 'number', description: 'Number of X lines (2-40) instead of pitch_mm for X.' },
                y_count: { type: 'number', description: 'Number of Y lines (2-40) instead of pitch_mm for Y. Max 400 stations total.' },
                ...surfaceCommonProperties,
            },
            required: ['start_z_machine', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            const reason = String(args.reason || '').trim();
            if (!reason) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            probeFeedService.assertNoOvertravel();
            const plan = planProbeSurfaceGrid(args as Parameters<typeof planProbeSurfaceGrid>[0]);
            return stageSurfaceScan(plan, reason, plan.grid ? `${plan.grid.xs.length}x${plan.grid.ys.length}` : '');
        },
    });

    registry.register({
        name: 'survey_bed',
        description: 'Stage a whole-bed camera survey for human confirmation: a serpentine XY grid at '
            + 'the CURRENT Z or at stated z_levels (each at or above the motion floor unless the operator '
            + 'has confirmed clearance), capturing a frame at every waypoint. Stored landmarks are '
            + 'obstacles (law 4): a waypoint the toolhead cannot stand on at a level is DROPPED from that '
            + 'pass and reported (result.dropped), and a link between waypoints that would cross a keep-out '
            + 'at the level is lifted to the park height leg by leg - never planned through. Frames are '
            + 'saved to disk with a machine-position index so the scene can be reviewed as a whole (read '
            + 'index with get_camera_capture_set, images with get_frame); saved images do not depend on the 12-frame RAM cache. Active tools never bypass the motion floor. Legacy clearance_z boxes still exclude lower waypoints. plane_z is PHYSICAL surface Z, not TOOLHEAD Z. Requires a working camera '
            + '(mcpCameraUrl or ffmpeg).',
        inputSchema: {
            type: 'object',
            properties: {
                pitch_mm: { type: 'number', description: 'MAXIMUM grid spacing, default 80 (20-160). Each axis span is divided into equal steps no larger than this, so rows and columns are uniform and both edges are covered - no fixed-pitch stub at the far end.' },
                overlap_fraction: {
                    type: 'number',
                    description: 'Fraction of each frame that must be shared with its neighbour, 0-0.9. Given this, '
                        + 'the pitch is DERIVED from the camera model\'s field of view on plane_z instead of guessed - '
                        + '"seamless" is a relationship between pitch and field of view, and a picked number is not '
                        + 'one. Needs a verified camera model (camera_bootstrap); pitch_mm then just caps the result.',
                },
                machine_z: {
                    type: 'number',
                    description: 'Explicit initial machine Z. The runner verifies this exact Z before any XY motion; use this instead of relying on CURRENT Z.',
                },
                plane_z: {
                    type: 'number',
                    description: 'Machine Z of the surface being surveyed, for the field of view and the mosaic '
                        + 'index. Uses measured bed_plane_z when stored, otherwise 0 is an unmeasured placeholder (not a bed measurement). Required for overlap or metric mosaics if no bed plane is stored. This is PHYSICAL surface Z, not TOOLHEAD Z, and is '
                        + 'stated, never inferred.',
                },
                margin_mm: { type: 'number', description: 'Inset of the default bounds from the toolhead travel, default 10 (0-50).' },
                z_levels: {
                    type: 'array',
                    description: 'Machine Z heights to run the whole grid at, highest first; one approval covers the '
                        + 'series. Every level must be at or above the motion floor. Each level is entered with XY '
                        + 'STATIONARY, so the grid is a stack of flat passes and never a diagonal. Default: the '
                        + 'current Z alone.',
                    items: { type: 'number' },
                },
                x_min: { type: 'number', description: 'Machine-coord grid bounds. Default: the toolhead travel inset by margin_mm - the travel as stated for this rig (set_probe_geometry travel_*), widened by where the head has been observed, else the machine definition.' },
                x_max: { type: 'number', description: 'A bound beyond the travel is clipped to it and the clipping REPORTED (result.clipped, and on the confirm page) - never silently planned. To survey reachable overtravel the definition omits (the far-X column the camera angle otherwise misses), state the travel with set_probe_geometry travel_x_max.' },
                y_min: { type: 'number' },
                y_max: { type: 'number' },
                operator_confirmed_clearance: {
                    type: 'boolean',
                    description: 'Set true ONLY on the operator\'s explicit word that the current Z and every '
                        + 'z_level clear everything on the bed; required when one is below the motion floor. '
                        + 'Stored landmarks are still honoured.',
                },
                reason: { type: 'string', description: 'Shown to the operator.' },
            },
            required: ['reason'],
            additionalProperties: false,
        },
        handler: async (args: {
            pitch_mm?: number;
            overlap_fraction?: number;
            plane_z?: number;
            machine_z?: number;
            margin_mm?: number;
            z_levels?: number[];
            x_min?: number;
            x_max?: number;
            y_min?: number;
            y_max?: number;
            operator_confirmed_clearance?: boolean;
            reason?: string;
        }) => {
            probeFeedService.assertNoOvertravel();
            const position = getPositionSnapshot();
            requireReliableMachine(position, 'a bed survey');
            const { x, y, z } = position.machine;
            if (x === null || y === null || z === null) {
                throw new McpToolError('Current machine position unknown.');
            }
            if (z < motionFloorZ() - TRAVERSE_Z_TOLERANCE_MM && args.machine_z === undefined
                && args.z_levels === undefined && args.operator_confirmed_clearance !== true) {
                throw new McpToolError(`Machine Z ${z.toFixed(1)} is below the motion floor `
                    + `${motionFloorZ()} (law 2 - the lowest Z any X/Y move may happen at) - raise Z `
                    + '(move_z), or pass operator_confirmed_clearance: true only on the operator\'s '
                    + 'explicit word that this Z clears everything on the bed.');
            }
            const travel = requirePlanningTravel('a bed survey', { x, y });
            // Levels: highest first, deduplicated, and every one of them at or
            // above the motion floor unless the operator has said otherwise.
            if (args.machine_z !== undefined && args.z_levels !== undefined) {
                throw new McpToolError('machine_z and z_levels are mutually exclusive; use machine_z for one explicit survey height or z_levels for a stated series.');
            }
            let rawLevels: number[];
            if (args.machine_z !== undefined) {
                rawLevels = [Number(args.machine_z)];
            } else if (Array.isArray(args.z_levels) && args.z_levels.length) {
                rawLevels = args.z_levels.map(Number);
            } else {
                rawLevels = [z];
            }
            if (rawLevels.some((level) => !Number.isFinite(level))) {
                throw new McpToolError('z_levels must be finite machine Z heights.');
            }
            if (rawLevels.length > MAX_SURVEY_LEVELS) {
                throw new McpToolError(`At most ${MAX_SURVEY_LEVELS} z_levels: each one is a full pass of the grid.`);
            }
            const levels = [...new Set(rawLevels.map((level) => Number(level.toFixed(3))))].sort((a, b) => b - a);
            const size = getMachineSizeByIdentifier(connectionManager.getConnectionStatus().machineIdentifier);
            const maxZ = Math.max(size?.z || 0, safeTraverseZ());
            if (levels.some((level) => level < 0 || level > maxZ)) throw new McpToolError(`Survey heights must be within machine Z 0..${maxZ}.`);
            const belowFloor = belowCameraFloor(levels, motionFloorZ(), TRAVERSE_Z_TOLERANCE_MM, args.operator_confirmed_clearance === true);
            if (belowFloor.length) {
                throw new McpToolError(`z_levels ${belowFloor.join(', ')} are below the motion floor ${motionFloorZ()} `
                    + '(law 2 - the lowest Z any X/Y move may happen at). Raise them, or pass '
                    + 'operator_confirmed_clearance: true only on the operator\'s explicit word that these heights '
                    + 'clear everything on the bed.');
            }
            let pitch = clampTo(args.pitch_mm, SURVEY_PITCH_MM);
            let pitchNote = `pitch ${pitch} mm (stated)`;
            const statedPlane = args.plane_z === undefined ? geometryValue('bed_plane_z') : Number(args.plane_z);
            if (statedPlane !== null && !Number.isFinite(statedPlane)) throw new McpToolError('plane_z must be a finite physical surface height.');
            const planeZ = statedPlane === null ? 0 : statedPlane;
            if (args.overlap_fraction !== undefined) {
                if (statedPlane === null) throw new McpToolError('overlap_fraction needs physical plane_z or a measured bed_plane_z; toolhead Z is not the surface.');
                const overlap = Number(args.overlap_fraction);
                if (!Number.isFinite(overlap) || overlap < 0 || overlap > MAX_OVERLAP_FRACTION) {
                    throw new McpToolError(`overlap_fraction must be between 0 and ${MAX_OVERLAP_FRACTION}.`);
                }
                // A verified model, or nothing: the field of view is the whole
                // basis of the number, and guessing it is what this replaces.
                const model = requireCameraModel('an overlap-derived survey pitch');
                const fovs = levels.map((level) => fovAt(model, { x, y, z: level }, planeZ));
                const fov = fovs[0];
                for (const view of fovs) {
                    const derived = pitchForOverlap(view.widthMm, view.heightMm, overlap);
                    pitch = Math.min(derived.x, derived.y, pitch);
                }
                if (!Number.isFinite(pitch) || pitch <= 0) throw new McpToolError('Camera model produced an invalid overlap pitch.');
                pitchNote = `pitch ${pitch} mm, derived from a ${fov.widthMm.toFixed(0)}x${fov.heightMm.toFixed(0)} mm `
                    + `field of view on plane Z ${planeZ} at ${(overlap * 100).toFixed(0)}% overlap`
                    + `${fov.extrapolated ? ' (EXTRAPOLATED: this Z is outside the band the model was solved over)' : ''}`;
            }
            const margin = clampTo(args.margin_mm, SURVEY_MARGIN_MM);

            // Serpentine grid. The bounds default to the toolhead's travel
            // inset by the margin, and stated bounds are clamped INTO that
            // travel with the clipping reported - not to the garbage-beat
            // filter's -25..size+40 (until 2026-09-21), which on the A350
            // planned a first column at X-25 against a travel that stops at
            // X-19 and would have aborted the approved job on its first move.
            // BOTH endpoints are always covered: each axis is divided EVENLY
            // into steps no larger than the pitch (operator, 2026-09-05: the
            // old fixed pitch gave 80 mm jumps and then a 9-10 mm stub at the
            // far edge); the far reach is often the only view of its region.
            const limits = travel.limits;
            const wanted = {
                xMin: args.x_min !== undefined ? Number(args.x_min) : limits.xMin + margin,
                xMax: args.x_max !== undefined ? Number(args.x_max) : limits.xMax - margin,
                yMin: args.y_min !== undefined ? Number(args.y_min) : limits.yMin + margin,
                yMax: args.y_max !== undefined ? Number(args.y_max) : limits.yMax - margin,
            };
            if (Object.values(wanted).some((v) => !Number.isFinite(v))) {
                throw new McpToolError('x_min / x_max / y_min / y_max must be finite machine coordinates.');
            }
            if (!(wanted.xMax > wanted.xMin) || !(wanted.yMax > wanted.yMin)) {
                throw new McpToolError(`Survey bounds are empty: X ${wanted.xMin}..${wanted.xMax}, Y ${wanted.yMin}..${wanted.yMax}.`);
            }
            const xBand = clampBand((wanted.xMin + wanted.xMax) / 2, (wanted.xMax - wanted.xMin) / 2, limits.xMin, limits.xMax);
            const yBand = clampBand((wanted.yMin + wanted.yMax) / 2, (wanted.yMax - wanted.yMin) / 2, limits.yMin, limits.yMax);
            const clipped = [describeClipping('X', xBand), describeClipping('Y', yBand), ...travel.conflicts].filter(Boolean) as string[];
            const bounds = { xMin: xBand.min, xMax: xBand.max, yMin: yBand.min, yMax: yBand.max };
            if (!(bounds.xMax > bounds.xMin) || !(bounds.yMax > bounds.yMin)) {
                throw new McpToolError(`Survey bounds lie entirely outside the toolhead travel (X ${limits.xMin}..${limits.xMax}, `
                    + `Y ${limits.yMin}..${limits.yMax}): ${clipped.join(' ')}`);
            }
            const axisPoints = (min: number, max: number): { points: number[]; step: number } => {
                const span = max - min;
                const intervals = Math.max(1, Math.ceil(span / pitch - 1e-9));
                const step = span / intervals;
                const points: number[] = [];
                for (let i = 0; i <= intervals; i++) {
                    points.push(Number((min + (step * i)).toFixed(1)));
                }
                return { points, step: Number(step.toFixed(2)) };
            };
            const count = (Math.ceil((bounds.xMax - bounds.xMin) / pitch) + 1) * (Math.ceil((bounds.yMax - bounds.yMin) / pitch) + 1) * levels.length;
            if (count > 2000) throw new McpToolError(`${count} captures exceed 2000; narrow bounds or reduce overlap.`);
            const xAxis = axisPoints(bounds.xMin, bounds.xMax);
            const yAxis = axisPoints(bounds.yMin, bounds.yMax);
            const xs = xAxis.points;
            const ys = yAxis.points;
            const waypoints: { x: number; y: number }[] = [];
            ys.forEach((wy, row) => {
                const ordered = row % 2 === 0 ? xs : [...xs].reverse();
                ordered.forEach((wx) => waypoints.push({ x: wx, y: wy }));
            });

            // Landmarks are obstacles (law 4, issue #141): every column into a
            // level and every link between waypoints is checked against the
            // stored boxes as volumes. A waypoint that cannot be stood on at a
            // level is dropped from that pass and reported; a link the level
            // cannot make is lifted to the park height, leg by leg.
            const parkZ = safeTraverseZ();
            const explicitMachineZ = args.machine_z !== undefined ? levels[0] : null;
            if (explicitMachineZ !== null) {
                const violations = checkMotion([{ kind: 'column', what: 'survey initial machine_z', from: { x, y, z }, to: { x, y, z: explicitMachineZ } }],
                    landmarkStore.obstacleBoxes().map((box) => ({ ...box, mode: 'volume' as const })), clearanceOptions());
                if (violations.length) throw new McpToolError(describeViolations(violations));
            }
            const plan = planSurvey({
                levels,
                waypoints,
                parkZ,
                fromMachine: { x, y, z: explicitMachineZ === null ? z : explicitMachineZ },
                obstacles: landmarkStore.obstacleBoxes(),
                ...clearanceOptions(),
            });
            if (!plan.captureCount) {
                throw new McpToolError('Every waypoint of the survey is inside a keep-out at every requested level - nothing to '
                    + `capture. First reason: ${plan.dropped[0] ? plan.dropped[0].reason : 'unknown'}`);
            }
            const droppedLines = plan.dropped.map((d) => `; DROPPED Z${d.z} waypoint ${d.index} (${d.x}, ${d.y}): ${d.reason}`);

            const envelope = [
                `; BED SURVEY: ${waypoints.length} waypoints, serpentine grid step X ${xAxis.step} / Y ${yAxis.step} mm (max ${pitch})`,
                `; ${levels.length} pass(es) at machine Z ${levels.join(', ')} - each entered with XY stationary`,
                ...(explicitMachineZ === null ? [] : [`; ASSERT machine Z${explicitMachineZ.toFixed(3)} before any XY motion; this invariant is verified at run time`]),
                `; ${plan.captureCount} captures planned${plan.dropped.length ? `, ${plan.dropped.length} waypoint(s) DROPPED (see below)` : ''}`
                    + `${plan.liftedLinks ? `, ${plan.liftedLinks} link(s) lifted to park Z${parkZ} over a keep-out` : ''}`,
                `; ${pitchNote}`,
                `; bounds X ${bounds.xMin}..${bounds.xMax}, Y ${bounds.yMin}..${bounds.yMax} within the toolhead travel `
                    + `X ${limits.xMin}..${limits.xMax}, Y ${limits.yMin}..${limits.yMax}`,
                ...clipped.map((line) => `; ${line}`),
                ...droppedLines,
                '; one frame captured per waypoint after the move settles; frames saved to disk with a',
                '; machine-position index. Each line is sent individually. Aborts on the first capture failure.',
                'G90',
                'G53;',
                ...plan.levels.flatMap((level) => [
                    `; ---- Z${level.z} pass: ${level.captures} capture(s)${level.liftedLinks ? `, ${level.liftedLinks} lifted link(s)` : ''}`,
                    ...describeSurveyLegs(level),
                ]),
                'G54;',
            ].join('\n');
            const validation = validateStagedEnvelope(envelope, 'survey_bed');
            const job = jobManager.submit(
                envelope,
                `bed-survey ${plan.captureCount}pts pitch${pitch} - ${String(args.reason).slice(0, 40)}`,
                'cnc',
                validation,
                'procedure'
            );
            job.runner = async () => {
                assertMachineReadyForProcedure();
                validateStagedEnvelope(envelope, 'survey_bed');
                const surveyId = crypto.randomBytes(4).toString('hex');
                const dir = path.join(DataStorage.userDataDir, 'mcp-surveys', surveyId);
                fs.ensureDirSync(dir);
                const frames: object[] = [];
                try {
                    if (explicitMachineZ !== null) {
                        const live = getPositionSnapshot();
                        if (live.machine.z === null) {
                            throw new McpToolError('Explicit survey machine_z cannot be verified: live machine Z is unknown.');
                        }
                        if (Math.abs(live.machine.z - explicitMachineZ) > TRAVERSE_Z_TOLERANCE_MM) {
                            await moveMachineSettled('survey:assert-machine-z', { z: explicitMachineZ }, TRAVEL_FEED);
                        }
                        const verified = getPositionSnapshot().machine.z;
                        if (verified === null || Math.abs(verified - explicitMachineZ) > TRAVERSE_Z_TOLERANCE_MM) {
                            throw new McpToolError(`Explicit survey machine_z ${explicitMachineZ} was not verified before XY motion.`);
                        }
                    }
                    for (const level of plan.levels) {
                    // The legs exactly as approved: Z changes with XY stationary
                    // (the grid is a stack of flat passes, never a diagonal),
                    // links at the height the planner checked them at, and a
                    // capture at every kept waypoint.
                        for (const leg of level.legs as SurveyLeg[]) {
                            if (leg.kind === 'raise' || leg.kind === 'descend') {
                                if (Math.abs(leg.z - (getPositionSnapshot().machine.z ?? leg.z)) > TRAVERSE_Z_TOLERANCE_MM) {
                                    await moveMachineSettled('survey:level', { z: leg.z }, TRAVEL_FEED);
                                }
                                continue;
                            }
                            if (leg.kind === 'hop') {
                                await moveMachineSettled(leg.lifted ? 'survey:lifted-link' : 'survey:move', { x: leg.x, y: leg.y }, TRAVEL_FEED * SURVEY_LINK_FEED_FACTOR);
                                continue;
                            }
                            let frame;
                            try {
                                frame = await captureFrame();
                            } catch (err) {
                                throw new McpToolError(`Capture failed at waypoint ${leg.index}/${waypoints.length} of the `
                                + `Z ${level.z} pass (machine ${leg.x}, ${leg.y}): ${(err as Error).message}. Survey aborted; `
                                + `${frames.length} frames saved in ${dir}.`);
                            }
                            const file = path.join(dir, `z${level.z}_wp${String(leg.index).padStart(3, '0')}_x${leg.x}_y${leg.y}.jpg`);
                            fs.writeFileSync(file, Buffer.from(frame.imageBase64, 'base64'));
                            frames.push({ file, machine: { x: leg.x, y: leg.y, z: level.z }, capturedAt: frame.capturedAt });
                        }
                    }
                    // One mosaic per pass, indexed in machine coordinates: with a
                    // verified model, "the feature is at mosaic pixel (u, v)"
                    // becomes a lookup through the affine instead of an inference
                    // from one frame and a remembered scale.
                    const mosaics: object[] = [];
                    const model = cameraModelStore.current();
                    if (model && statedPlane !== null && judgeCameraModel(model, modelContext(null)).usable) {
                        for (const level of levels) {
                            const levelFrames = (frames as Array<{ file: string; machine: { x: number; y: number; z: number } }>)
                                .filter((f) => Math.abs(f.machine.z - level) < 1e-6);
                            const out = path.join(dir, `mosaic_z${level}.jpg`);
                            try {
                                const rendered = renderMosaic(model, levelFrames, planeZ, out);
                                if (rendered) {
                                    const seams = judgeSeams(rendered.seams);
                                    if (seams.drifted) {
                                        cameraModelStore.invalidate(model.id, `survey ${surveyId} seam mismatch`);
                                    }
                                    mosaics.push({
                                        seams: { ...rendered.seams,
                                            ...seams,
                                            planeZ,
                                            diagnostic: seams.drifted ? 'Seam disagreement can mean wrong surface plane, raised-object parallax, wrong matches or camera drift. No unique corrective plane follows from this residual. Re-verify at a known target before re-solving.' : null },
                                        file: out,
                                        passZ: level,
                                        planeZ,
                                        bounds: rendered.layout.bounds,
                                        widthPx: rendered.layout.widthPx,
                                        heightPx: rendered.layout.heightPx,
                                        mmPerPixel: rendered.layout.mmPerPixel,
                                        // mosaic pixel -> machine XY on planeZ.
                                        affine: rendered.layout.affine,
                                        uncoveredFraction: rendered.uncoveredFraction,
                                        modelId: model.id,
                                    });
                                }
                            } catch (err) {
                                mosaics.push({ passZ: level, error: (err as Error).message });
                            }
                        }
                    }
                    let mosaicNote = 'No mosaic: verify the camera model and inspect any rendering errors before retrying. The saved frames remain available.';
                    if (statedPlane === null) {
                        mosaicNote = 'No mosaic: supply a measured PHYSICAL plane_z or bed_plane_z. Qualitative frames are saved; do not re-bootstrap merely because the surface plane is missing.';
                    }
                    if (mosaics.length) {
                        mosaicNote = 'Each mosaic carries the affine that turns its pixels into machine XY on planeZ. Read a feature position off it rather than estimating one from a single frame.';
                    }
                    const index = {
                        surveyId,
                        machineZ: levels[0],
                        zLevels: levels,
                        planeZ,
                        pitchMm: pitch,
                        dropped: plan.dropped,
                        liftedLinks: plan.liftedLinks,
                        frames,
                        mosaics,
                        mosaicNote,
                    };
                    fs.writeJsonSync(path.join(dir, 'index.json'), index, { spaces: 2 });
                    return {
                        surveyId,
                        directory: dir,
                        mosaics,
                        frameCount: frames.length,
                        index_file: path.join(dir, 'index.json'),
                        frames,
                        note: 'Read the saved index via get_camera_capture_set and images with get_frame. Frame positions are toolhead positions, not inferred feature coordinates.',
                    };
                } catch (err) {
                    const partial = { surveyId, directory: dir, planeZ, frames, dropped: plan.dropped };
                    savePartialCameraIndex(dir, partial);
                    return cameraFailure('survey_bed', err, partial);
                }
            };
            return {
                job: jobManager.describe(job),
                waypoints: waypoints.length,
                captures: plan.captureCount,
                // Law 4 at staging: what the landmarks cost this survey, and why.
                dropped: plan.dropped,
                lifted_links: plan.liftedLinks,
                grid: {
                    max_pitch_mm: pitch,
                    step_x_mm: xAxis.step,
                    step_y_mm: yAxis.step,
                    xs,
                    ys,
                    machine_z: explicitMachineZ === null ? z : explicitMachineZ,
                    columns: xs.length,
                    rows: ys.length,
                },
                travel: {
                    ...limits,
                    source: {
                        x_min: travel.ends.xMin.source,
                        x_max: travel.ends.xMax.source,
                        y_min: travel.ends.yMin.source,
                        y_max: travel.ends.yMax.source,
                    },
                },
                clipped,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: `Ask the operator to open confirm_url, check the Z clears everything on the bed that has no landmark${
                    plan.dropped.length ? `, review the ${plan.dropped.length} DROPPED waypoint(s) and their reasons` : ''}, and approve. `
                    + 'start_gcode_job then drives the whole grid and returns the frame index.',
            };
        },
    });

    registry.register({
        name: 'probe_stock_outline',
        description: 'Stage ONE approved procedure that finds a block\'s top, true outline and CENTRE from an ESTIMATE of '
            + 'where it is and how big it is - no re-probing the centre for every side. 1) TOP: -Z marches at top_points '
            + '(default 3 along the longer axis around center_x/center_y) from the operator-stated start_z_machine to '
            + 'floor_z_machine; the HIGHEST contact is the top and a sample lower by more than hole_tolerance_mm (default 2) '
            + 'is a hole and ignored (a first probe landing in a drilled hole does not define the surface); between points '
            + 'the probe travels close above the surface as a stepped traverse that lifts hop_lift_mm on contact. 2) SIDES '
            + '(default all four): horizontal marches toward the stock from overextend_mm (default 5) OUTSIDE the estimate '
            + 'at top - side_depth_mm (default 2), points_per_side (default 3, midpoint first) per side, each up to '
            + 'side_max_travel_mm (default 25 - generous on purpose: the combined error of the centre and width estimate '
            + 'must fit inside it, a short march silently misses the face); a march that finds nothing records no_contact '
            + 'and the procedure continues. 3) FIT: per-side mean and slope -> centre (machine AND work frame), size '
            + 'centre-to-centre and PHYSICAL (minus the tip diameter when set_probe_geometry stored it - external faces lie '
            + 'one tip radius inside their contacts), yaw. Result: top, topSamples, sides, fit, centerMachine, centerWork, '
            + 'sizeMm, sizePhysicalMm, yawDeg, lifts. Also available as probe_program op kind "stock_outline".',
        inputSchema: {
            type: 'object',
            properties: {
                center_x: { type: 'number', description: 'Estimated stock centre, machine X (default: current X).' },
                center_y: { type: 'number', description: 'Estimated stock centre, machine Y (default: current Y).' },
                size_x_mm: { type: 'number', description: 'REQUIRED estimated size along machine X (2-400).' },
                size_y_mm: { type: 'number', description: 'REQUIRED estimated size along machine Y (2-400).' },
                overextend_mm: { type: 'number', description: 'Side marches start this far outside the estimated face, default 5 (3-60).' },
                side_max_travel_mm: { type: 'number', description: 'Travel of each side march from its start, default max(25, 2 x overextend + 10) (5-150). Must cover overextend + width uncertainty + centre uncertainty + margin; 25 suits a few mm of each.' },
                start_z_machine: { type: 'number', description: 'REQUIRED toolhead machine Z above the top where the -Z search starts (operator-stated or from an earlier contact; never a guess).' },
                floor_z_machine: { type: 'number', description: 'REQUIRED deepest toolhead Z the top search may reach (<= 150 mm below start).' },
                top_points: { type: 'number', description: 'Top samples: 1-5, default 3 (centre, +/- a quarter of the longer axis; 4-5 add the shorter axis).' },
                hole_tolerance_mm: { type: 'number', description: 'A top sample lower than the highest by more than this is a hole, default 2.' },
                side_depth_mm: { type: 'number', description: 'Side marches run at (measured top) - this, default 2 (1-40).' },
                points_per_side: { type: 'number', description: '1-4 marches per side over the middle half of the side, midpoint first then away from the corners, default 3.' },
                sides: { type: 'array', items: { type: 'string', enum: ['west', 'east', 'south', 'north'] }, description: 'Which sides to probe (west marches +X, east -X, south +Y, north -Y). Default all four.' },
                hop_lift_mm: { type: 'number', description: 'Stepped traverse lift per contact and height above the last contact, default 2 (0.5-10).' },
                coarse_step_mm: { type: 'number', description: 'Coarse step, default 1 (0.2-1; never larger).' },
                fine_step_mm: { type: 'number', description: 'Fine step, default 0.1 (0.02-0.5).' },
                backoff_mm: { type: 'number', description: 'Confirm-cycle lift, default 1.' },
                sensor_delay_ms: { type: 'number', description: 'Contact-check window per step, default 300, floor 30 (GPIO: 50).' },
                confirm_passes: { type: 'number', description: 'Lift-and-retest cycles per contact, default 3 (1-10).' },
                reason: { type: 'string', description: 'Shown to the operator: what is being measured and why.' },
            },
            required: ['size_x_mm', 'size_y_mm', 'start_z_machine', 'floor_z_machine', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            const reason = String(args.reason || '').trim();
            if (!reason) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            probeFeedService.assertNoOvertravel();
            const plan = planProbeOutline(args as Parameters<typeof planProbeOutline>[0]);
            const envelope = `; reason: ${reason}
${describeProbeOutlinePlanAsGcode(plan)}`;
            const validation = validateStagedEnvelope(envelope, 'probe_stock_outline');
            const job = jobManager.submit(
                envelope,
                `stock-outline ${plan.topPoints.length}top/${plan.sidePoints.length}sides - ${reason.slice(0, 40)}`,
                'cnc',
                validation,
                'procedure'
            );
            job.runner = async () => runProbeOutlineProcedure(plan);
            return {
                job: jobManager.describe(job),
                plan,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url and review the whole procedure (top points, every side start and '
                    + 'travel limit, the stepped traverses), then start with start_gcode_job wait_for_approval_ms. The result '
                    + 'carries centerMachine / centerWork and the fitted size; the true faces are one tip radius beyond the contacts.',
            };
        },
    });

    registry.register({
        name: 'probe_wall_follow',
        description: 'Stage ONE approved procedure that follows a VERTICAL wall (a pocket side, a boss face) at N stations '
            + 'WITHOUT retreating to the start line between them - probe_surface_path for walls (operator, 2026-09-21). Law 2 '
            + 'to station 1 (raise, hop to start_x/start_y, guarded segmented descent to z_machine - a MEASURED height, top '
            + 'minus depth, never a guess; any contact on the way down aborts). Per station: sensor-gated march along dir_x/dir_y '
            + 'toward the wall up to max_travel_mm; back off standoff_mm (default 2) from the contact; STEP ALONG THE WALL at that '
            + 'standoff to the next station\'s line (step_mm apart along along_x/along_y, default dir turned +90 deg) as a stepped '
            + 'touch-probing traverse (1 mm steps, probe expected) whose retreat is AWAY from the face and capped at the approved '
            + 'start line - the low traverse only ever runs inside the corridor the marches have proven; the next march starts '
            + 'where the step arrives. A miss records no_contact, retreats to the start line and continues (on_miss default) or '
            + 'aborts. Result: contacts (tip-centre, machine), bumps (the wall turned toward the probe during a step), fit (line '
            + 'through the contacts: direction, normal, residuals per point, rms/max, yaw from the step direction - a residual '
            + 'trend at one end is the wall curving into a corner), surfacePoints (contacts + tip radius along dir, when '
            + 'set_probe_geometry stored the tip). Ends raised at the traverse height. Also probe_program op kind "wall_follow".',
        inputSchema: {
            type: 'object',
            properties: {
                start_x: { type: 'number', description: 'REQUIRED machine X of the first march start, over free space (>= tip radius + margin inside the wall).' },
                start_y: { type: 'number', description: 'REQUIRED machine Y of the first march start.' },
                z_machine: { type: 'number', description: 'REQUIRED toolhead machine Z the wall is probed at: a MEASURED top minus the depth (0..traverse height).' },
                dir_x: { type: 'number', description: 'REQUIRED march direction toward the wall (X component; normalised with dir_y).' },
                dir_y: { type: 'number', description: 'REQUIRED march direction toward the wall (Y component).' },
                along_x: { type: 'number', description: 'Step direction along the wall (made perpendicular to dir). Default: dir turned +90 deg.' },
                along_y: { type: 'number', description: 'Step direction along the wall (Y component).' },
                step_mm: { type: 'number', description: 'Distance between stations along the wall, default 5 (0.5-60).' },
                stations: { type: 'number', description: 'Number of stations, default 5 (1-400).' },
                max_travel_mm: { type: 'number', description: 'REQUIRED march travel from the start line before a station records no_contact (1-150). Generous: a short march silently misses.' },
                standoff_mm: { type: 'number', description: 'Back-off from each contact before stepping along, and the lift per bump, default 2 (0.5-10).' },
                on_miss: { type: 'string', enum: ['continue', 'abort'], description: 'A station with no contact: continue (default) or abort.' },
                line_tolerance_mm: {
                    type: 'number',
                    description: 'Optional (0.02-5): split the contacts into the straight wall at each end and the CORNER between (a contact further '
                        + 'than this off its wall\'s line is a corner point); the result\'s segments carry the corner\'s arc fit with residuals.',
                },
                coarse_step_mm: { type: 'number', description: 'Coarse step, default 1 (0.2-1; never larger).' },
                fine_step_mm: { type: 'number', description: 'Fine step, default 0.1 (0.02-0.5).' },
                backoff_mm: { type: 'number', description: 'Confirm-cycle lift, default 1.' },
                sensor_delay_ms: { type: 'number', description: 'Contact-check window per step, default 300, floor 30 (GPIO: 50).' },
                confirm_passes: { type: 'number', description: 'Lift-and-retest cycles per contact, default 3 (1-10).' },
                reason: { type: 'string', description: 'Shown to the operator: which wall, and why.' },
            },
            required: ['start_x', 'start_y', 'z_machine', 'dir_x', 'dir_y', 'max_travel_mm', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            const reason = String(args.reason || '').trim();
            if (!reason) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            probeFeedService.assertNoOvertravel();
            const plan = planProbeWallFollow(args as Parameters<typeof planProbeWallFollow>[0]);
            const envelope = `; reason: ${reason}
${describeProbeWallFollowPlanAsGcode(plan)}`;
            const validation = validateStagedEnvelope(envelope, 'probe_wall_follow');
            const job = jobManager.submit(
                envelope,
                `wall-follow ${plan.stations.length}st at Z${plan.zMachine} - ${reason.slice(0, 40)}`,
                'cnc',
                validation,
                'procedure'
            );
            job.runner = async () => runProbeWallFollowProcedure(plan);
            return {
                job: jobManager.describe(job),
                plan,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url and review the start line, every march limit and the along-steps, '
                    + 'then start with start_gcode_job wait_for_approval_ms. The result carries contacts (tip-centre), the line fit '
                    + 'with residuals, and surfacePoints one tip radius beyond the contacts.',
            };
        },
    });

    registry.register({
        name: 'probe_corner',
        description: 'Stage ONE approved procedure that measures the RADIUS of an internal corner between two walls earlier marches have '
            + 'fitted (operator, 2026-09-21: rounded corners are the normal case - a station in the radius reads a blend). wall_a / wall_b '
            + 'are the fitted TIP-CENTRE lines ({x, y, nx, ny}: a point and the normal toward the free side, as probe_wall_follow returns in '
            + 'fit.point / fit.normal); radius_max_mm is the operator\'s bound on the physical radius (law 3). 1) Law 2 to the start on the '
            + 'corner\'s BISECTOR, placed so a fillet as large as the bound plus approach_clearance_mm still leaves it in free space '
            + '(guarded descent to z_machine, a MEASURED height). 2) Bisector march toward the apex: where it stops gives the radius '
            + '(rho = reach / (1/sin(angle/2) - 1)); a contact at the apex = SHARP corner, reported, radial pass skipped. 3) Retreat along '
            + 'the bisector (the path just proven) to the arc CENTRE and march RADIALLY at `points` azimuths from wall A\'s tangent point '
            + 'to wall B\'s, retreating to the centre between them - every station and link lies on proven ground, nothing is placed '
            + 'inside an unmeasured radius. 4) Circle fit: radius (tip-centre and physical = + tip radius), centre, per-point residuals '
            + '(an irregular round is reported as large residuals, never hidden). Result: geometry (apex, bisector, interior angle), '
            + 'bisector contact and estimate, centre, radials, fit, radiusTipCentreMm, radiusPhysicalMm. Also probe_program op kind "corner".',
        inputSchema: {
            type: 'object',
            properties: {
                wall_a: {
                    type: 'object',
                    properties: { x: { type: 'number' }, y: { type: 'number' }, nx: { type: 'number' }, ny: { type: 'number' } },
                    required: ['x', 'y', 'nx', 'ny'],
                    additionalProperties: false,
                    description: 'REQUIRED: a point on wall A\'s fitted tip-centre line (machine) and the unit normal toward the free side.',
                },
                wall_b: {
                    type: 'object',
                    properties: { x: { type: 'number' }, y: { type: 'number' }, nx: { type: 'number' }, ny: { type: 'number' } },
                    required: ['x', 'y', 'nx', 'ny'],
                    additionalProperties: false,
                    description: 'REQUIRED: the same for wall B.',
                },
                z_machine: { type: 'number', description: 'REQUIRED toolhead machine Z the walls were probed at (a MEASURED top minus a depth).' },
                radius_max_mm: { type: 'number', description: 'REQUIRED bound on the corner\'s PHYSICAL radius (law 3); places the bisector start in free space (0-200).' },
                points: { type: 'number', description: 'Radial stations across the arc, default 5 (3-16).' },
                approach_clearance_mm: { type: 'number', description: 'Free space kept beyond the largest possible arc at the bisector start and past the radial travel, default 5 (1-20).' },
                coarse_step_mm: { type: 'number', description: 'Coarse step, default 1 (0.2-1; never larger).' },
                fine_step_mm: { type: 'number', description: 'Fine step, default 0.1 (0.02-0.5).' },
                backoff_mm: { type: 'number', description: 'Confirm-cycle lift, default 1; a radius below it is reported as sharp.' },
                sensor_delay_ms: { type: 'number', description: 'Contact-check window per step, default 300, floor 30 (GPIO: 50).' },
                confirm_passes: { type: 'number', description: 'Lift-and-retest cycles per contact, default 3 (1-10).' },
                reason: { type: 'string', description: 'Shown to the operator: which corner, and why.' },
            },
            required: ['wall_a', 'wall_b', 'z_machine', 'radius_max_mm', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            const reason = String(args.reason || '').trim();
            if (!reason) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            probeFeedService.assertNoOvertravel();
            const plan = planProbeCorner(args as Parameters<typeof planProbeCorner>[0]);
            const envelope = `; reason: ${reason}
${describeProbeCornerPlanAsGcode(plan)}`;
            const validation = validateStagedEnvelope(envelope, 'probe_corner');
            const job = jobManager.submit(
                envelope,
                `corner ${plan.radials.length}rad r<=${plan.radiusMaxMm} at Z${plan.zMachine} - ${reason.slice(0, 40)}`,
                'cnc',
                validation,
                'procedure'
            );
            job.runner = async () => runProbeCornerProcedure(plan);
            return {
                job: jobManager.describe(job),
                plan,
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url and review the bisector start, the apex, and the radial limits, then start '
                    + 'with start_gcode_job wait_for_approval_ms. The result carries the fitted radius (tip-centre and physical), centre and '
                    + 'per-point residuals - large residuals mean the corner is not a circular arc.',
            };
        },
    });

    registry.register({
        name: 'probe_trace_perimeter',
        description: 'Stage ONE approved procedure that traces the whole INTERNAL PERIMETER of a pocket of UNKNOWN shape from one point '
            + 'known to be inside it (operator spec 2026-09-22). Law 2 to start_x/start_y (raise, hop, guarded descent to z_machine - a '
            + 'MEASURED top minus a depth), a sensor-gated march along dir_x/dir_y (default +X) to the first wall, then a CRAWL with the '
            + 'probe expected on every move and the wall on wall_side (default right = counter-clockwise inside): step fine_step_mm '
            + '(default 0.1) along the wall, bump toward it until contact (each contact is a perimeter point; the head backs off the '
            + 'one 0.1 mm step that touched - no retreat wastage); a BLOCKED step retreats exactly the step attempted and turns '
            + 'turn_step_deg AWAY from the wall (internal corners, inward curves at 0.1 mm resolution; a full 360 of blocked steps '
            + 'aborts); a wall that falls away for bump_cap_steps turns TOWARD it (outward curves, external corners); on a run proven '
            + 'straight (last straight_points contacts within line_tolerance_mm of a line) the step becomes coarse_step_mm (default 1) '
            + 'and the heading is aligned to the fitted wall; closure = heading turned 360 and back within a coarse step of the first '
            + 'wall point; otherwise it stops with the partial perimeter on max_perimeter_mm (REQUIRED budget, law 3), max_steps, the '
            + 'REQUIRED bounds {x0,y0,x1,y1} the tip centre never leaves (the pocket\'s outer extent plus a margin for the bump into the '
            + 'wall), or a keep-out. Lift-and-retest CONFIRM cycles run only where they buy accuracy (confirm_at, default '
            + '["first","turns","unexpected"]: the first wall, after a major direction change, an unexpected contact after a straight '
            + 'run; add "every" with accuracy_every_mm for accuracy points) - a routine bump is one sensed contact. Result: perimeter '
            + '(ordered tip-centre points; normal = the LOCAL wall normal from a line through the neighbouring contacts, surface = + tip '
            + 'radius along it; step kind, confirmed flag), segments (straight walls with collinear runs merged, each with its tip-centre '
            + 'fit and wall surface line; curves with a shape), corners (circle fitted only to the points off BOTH adjacent walls: '
            + 'radius tip-centre + physical, centre, per-point residuals, interior angle; shape arc / sharp / irregular - an IRREGULAR '
            + 'lobe reports no radius but a polyline, line / arc pieces and the one-circle misfit), lengths (tipCentreMm and surfaceMm, '
            + 'the one to compare with CAD), closed, counts, timing. The confirm page states the step count and time estimate (~0.3 s per sensor-checked step on GPIO). Also '
            + 'probe_program op kind "trace". The same crawl with the normal flipped traces a boss / the outer stock outline (not yet exposed).',
        inputSchema: {
            type: 'object',
            properties: {
                start_x: { type: 'number', description: 'REQUIRED machine X of a point KNOWN to be inside the pocket (operator / camera).' },
                start_y: { type: 'number', description: 'REQUIRED machine Y of that point.' },
                z_machine: { type: 'number', description: 'REQUIRED toolhead machine Z of the crawl: a MEASURED top minus a depth, never a guess.' },
                dir_x: { type: 'number', description: 'First march direction toward a wall, X component (default 1).' },
                dir_y: { type: 'number', description: 'First march direction, Y component (default 0).' },
                max_travel_mm: { type: 'number', description: 'REQUIRED travel of the first march before it aborts with no wall (1-150).' },
                fine_step_mm: { type: 'number', description: 'Step along the wall and bump toward it, default 0.1 (0.05-1).' },
                coarse_step_mm: { type: 'number', description: 'Step on a run proven straight, default 1 (up to 5; never below the fine step).' },
                turn_step_deg: { type: 'number', description: 'Heading change per blocked step / fallen-away wall, default 10 (2-45).' },
                bump_mm: { type: 'number', description: 'Back-off from the first wall before the crawl, default = fine_step_mm.' },
                bump_cap_steps: { type: 'number', description: 'Fine steps toward the wall before it counts as fallen away, default 3 (1-10).' },
                line_tolerance_mm: { type: 'number', description: 'Largest residual for a run to count as straight, default = fine_step_mm (0.02-5).' },
                straight_points: { type: 'number', description: 'Contacts the straightness line is fitted over, default 6 (3-20); the window spans that many coarse steps.' },
                max_perimeter_mm: { type: 'number', description: 'REQUIRED perimeter budget (1-1400), law 3: the crawl stops here with the partial result.' },
                max_steps: { type: 'number', description: 'Step budget, default 20000 (10-100000).' },
                bounds: {
                    type: 'object',
                    properties: { x0: { type: 'number' }, y0: { type: 'number' }, x1: { type: 'number' }, y1: { type: 'number' } },
                    required: ['x0', 'y0', 'x1', 'y1'],
                    additionalProperties: false,
                    description: 'REQUIRED machine XY box the tip centre never leaves: the pocket\'s outer extent as estimated PLUS a margin of at least one step for the bump into the wall.',
                },
                wall_side: { type: 'string', enum: ['right', 'left'], description: 'Which side the wall is kept on while crawling, default right (counter-clockwise round the inside).' },
                confirm_at: {
                    type: 'array',
                    items: { type: 'string', enum: ['first', 'turns', 'unexpected', 'every'] },
                    description: 'Where lift-and-retest confirm cycles run, default ["first","turns","unexpected"]; "every" needs accuracy_every_mm.',
                },
                accuracy_every_mm: { type: 'number', description: 'With confirm_at "every": an accuracy confirm cycle each this many mm of perimeter (1-1400).' },
                major_turn_deg: { type: 'number', description: 'Accumulated turn since the last confirm that counts as a major direction change, default 45 (5-180).' },
                expected_corners: { type: 'number', description: 'For the time / confirm-cycle estimate only, default 4.' },
                fine_step_march_mm: { type: 'number', description: 'Ignored (reserved).' },
                backoff_mm: { type: 'number', description: 'Confirm-cycle lift, default 1.' },
                sensor_delay_ms: { type: 'number', description: 'Contact-check window per step, default 300, floor 30 (GPIO: 50 - use it, every step pays it).' },
                confirm_passes: { type: 'number', description: 'Lift-and-retest cycles per confirmed contact, default 3 (1-10).' },
                reason: { type: 'string', description: 'Shown to the operator: which pocket, and why.' },
            },
            required: ['start_x', 'start_y', 'z_machine', 'max_travel_mm', 'max_perimeter_mm', 'bounds', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            const reason = String(args.reason || '').trim();
            if (!reason) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            probeFeedService.assertNoOvertravel();
            const plan = planProbeTracePerimeter(args as Parameters<typeof planProbeTracePerimeter>[0]);
            const envelope = `; reason: ${reason}
${describeProbeTracePlanAsGcode(plan)}`;
            const validation = validateStagedEnvelope(envelope, 'probe_trace_perimeter');
            const job = jobManager.submit(
                envelope,
                `perimeter-trace <=${plan.params.maxPerimeterMm}mm at Z${plan.zMachine} - ${reason.slice(0, 40)}`,
                'cnc',
                validation,
                'procedure'
            );
            job.runner = async () => runProbeTracePerimeterProcedure(plan);
            return {
                job: jobManager.describe(job),
                plan: {
                    start: plan.start,
                    dir: plan.dir,
                    zMachine: plan.zMachine,
                    bounds: plan.params.bounds,
                    maxPerimeterMm: plan.params.maxPerimeterMm,
                    fineStepMm: plan.params.fineStepMm,
                    coarseStepMm: plan.params.coarseStepMm,
                    turnStepDeg: plan.params.turnStepDeg,
                    wallSide: plan.params.wallSide,
                    confirmAt: plan.confirmAt,
                    estimate: plan.estimate,
                    hopZ: plan.hopZ,
                    staged: plan.staged,
                },
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url and review the start, the bounds, the budget and the time estimate, then start '
                    + 'with start_gcode_job wait_for_approval_ms and long-poll get_gcode_job_status. The result carries the ordered '
                    + 'perimeter, segments and corners; a long crawl exceeds the job event buffer but result.perimeter is never trimmed.',
            };
        },
    });

    registry.register({
        name: 'probe_program',
        description: 'Stage a COMPOSITE probing program for ONE human approval: an ordered list of operations - '
            + 'rotate_b (turn the rotary axis to an absolute B, toolhead at/above the traverse height), '
            + 'surface_path, surface_grid, sequence, stock_outline, wall_follow, corner and trace (the same arguments as the standalone tools), '
            + 'sequence probe steps and surface scans can request capture before retraction (see their capture schema). '
            + 'capture (one camera frame, stamped with position and B, saved on the job record - view it afterwards with '
            + 'get_frame; give it x/y and it first hops there at the traverse height like a sequence hop, else no motion) '
            + 'and home (machine home, LAST op only; '
            + 'it also homes B) - run by one '
            + 'runner that hands the machine from op to op. Each successful probing op ends raised at the traverse height; '
            + 'references and groups do not retain a low pose between ops. Keep related stations in one suitable surface, '
            + 'wall_follow, trace, corner or stock_outline op to use its local links; sequence raises after every probe. Numbers an op '
            + 'cannot know at staging are REFERENCES to earlier results: {"from": "<opId>.<path>", "plus"?, "minus"?, '
            + '"between": [low, high]} - e.g. expected_z_machine: {"from": "c90.top.z", "between": [195, 240]} where c90 '
            + 'is a sequence op with a probe named "top" (.x/.y/.z read contactMachine), or start_z_machine: {"from": '
            + '"ns90.summary.zMean", "plus": 7, "between": [200, 250]}. Two-operand forms: {"mid": [a, b]} = (a+b)/2 '
            + '(stock centre from two side contacts), {"diff": [a, b], "scale"?: 0.5} = (a-b)*scale (width, half-width), '
            + '{"min"|"max": [a, b, ...]}; "plus"/"minus" may be a number or a path. Once set_probe_geometry has stored '
            + 'the rotary axis and probe length, the seeded namespace "axis" offers axis.x, axis.z_physical, axis.z_contact '
            + '(toolhead Z with the tip on the axis), axis.tip_radius, axis.probe_length - so the B90 face height is '
            + '{"diff": ["s0.east.x", "s0.west.x"], "scale": 0.5, "plus": "axis.z_contact", "between": [...]}. A program that '
            + 'references only its own earlier ops (any B0-only, stationary or off-rotary survey) needs NO geometry. '
            + 'The bounds are REQUIRED (law 3): the confirm '
            + 'page shows them with a preview at the mid-point and the runner refuses the op (stopping the program '
            + 'raised, keeping earlier results) if the value resolves outside them. A failed op stops the program '
            + 'unless on_fail: "skip"; a held probe contact always stops the program. Result: per-op status and the standalone tool\'s result object (stations, fits, '
            + 'timing), plus the B schedule. Use it to string the four faces, sides and end of a rotary stock into one '
            + 'approved operation instead of 18 approvals - or "capture at (x, y), rotate_b 180, capture, home" to look '
            + 'at both sides of a rotary part under one click.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Program name shown to the operator.' },
                ops: {
                    type: 'array',
                    description: 'Ordered operations. Each: {id, kind, on_fail?, ...args}. kinds: rotate_b {b, require_z_at_least?, '
                        + 'swept_radius_mm? (largest reach of THIS stock and clamping about the axis - adds a tip-outside-the-cylinder check)}; '
                        + 'capture {x?, y?, settle_ms? (default 500, max 5000), label?} - a frame; with x/y (machine) it raises and hops '
                        + 'there first (travel + obstacle checked), without them no motion; '
                        + 'home {} - G53;G28;G54, every axis to its switches AND B to 0, allowed only as the last op; '
                        + 'surface_path / surface_grid / sequence / stock_outline / wall_follow / corner / trace: the standalone tool arguments, where ANY number (start_z_machine, '
                        + 'expected_z_machine, floor_z_machine, start_x/end_x, sequence hop x/y and descend z, expected_profile.circle.*) '
                        + 'may be a reference; group {id, for_b: [0, 90, 180, 270], ops: [...]} = the inner ops run once per angle '
                        + `after a rotate_b to it, with the token "${'$'}{b}" in any string replaced by the angle and inner ids without it `
                        + 'suffixed "_b<angle>" (references between them are rewritten to match). Up to 80 ops after expansion.',
                    items: { type: 'object' },
                    minItems: 1,
                    maxItems: 80,
                },
                reason: { type: 'string', description: 'Shown to the operator: what is being measured and why.' },
                keep_out: {
                    type: 'array',
                    description: 'Transient obstacle boxes for THIS clamping (chuck jaws, tailstock): [{name, machine: {x0, y0, x1, y1}, '
                        + 'clearance_z}] with clearance_z the minimum safe TOOLHEAD machine Z over the box. Checked together with '
                        + 'the stored landmarks against every hop, descent column and march of every op at staging (law 4); shown on '
                        + 'the confirm page; never persisted.',
                    items: { type: 'object' },
                    maxItems: 20,
                },
                dry_run: { type: 'boolean', description: 'Validate and return the complete plan and event estimate without staging a job or issuing a confirm URL. No motion. Does not bypass geometry or position checks.' },
            },
            required: ['name', 'ops', 'reason'],
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            const reason = String(args.reason || '').trim();
            if (!reason) {
                throw new McpToolError('reason is required; it is shown to the operator.');
            }
            probeFeedService.assertNoOvertravel();
            const plan = planProbeProgram({ name: args.name, ops: args.ops, keep_out: args.keep_out });
            // W6: a program of 30+ minutes must fit its own job event log, or the
            // record the operator approved is lost while it runs.
            const limit = jobEventLimit();
            if (args.dry_run === true) {
                return { dry_run: true,
                    plan,
                    eventBudget: plan.eventBudget,
                    jobEventLimit: limit,
                    fitsEventLimit: plan.eventBudget <= limit,
                    recommendedEventLimit: Math.ceil(plan.eventBudget * 1.2 / 1000) * 1000 };
            }
            if (plan.eventBudget > limit) {
                throw new McpToolError(`This program will write about ${plan.eventBudget} job events but the job event log keeps ${limit}. `
                    + `Raise it to at least ${Math.ceil(plan.eventBudget * 1.2 / 1000) * 1000} first (Settings -> MCP Server -> Diagnostic buffers, `
                    + 'or LUBAN_MCP_JOB_EVENT_LIMIT), then stage again.');
            }
            const envelope = `; reason: ${reason}
${describeProbeProgramAsGcode(plan)}`;
            const validation = validateStagedEnvelope(envelope, 'probe_program');
            const job = jobManager.submit(
                envelope,
                `program ${plan.name} (${plan.ops.length} ops${plan.rotations.length ? `, B ${plan.rotations.join('/')}` : ''}) - ${reason.slice(0, 40)}`,
                'cnc',
                validation,
                'procedure'
            );
            job.runner = async () => runProbeProgramProcedure(plan);
            return {
                job: jobManager.describe(job),
                plan: {
                    name: plan.name,
                    ops: plan.ops.map((op) => ({ id: op.id, kind: op.kind, on_fail: op.on_fail, refs: op.refs })),
                    rotations: plan.rotations,
                    hopZ: plan.hopZ,
                    staged: plan.staged,
                    keepOut: plan.keepOut,
                    axis: plan.seeds.axis || null,
                    groups: plan.groups,
                    eventBudget: plan.eventBudget,
                    jobEventLimit: limit,
                },
                confirm_url: `${getConfirmBaseUrl()}/confirm/${job.id}`,
                next_step: 'Ask the operator to open confirm_url and review the WHOLE program: every operation\'s envelope, every '
                    + 'reference with its bounds, and the B rotation schedule. One approval covers the program; call '
                    + 'start_gcode_job with wait_for_approval_ms, then long-poll get_gcode_job_status (a full four-face survey '
                    + 'runs 35-75 minutes; budget the job event limit first).',
            };
        },
    });
}
