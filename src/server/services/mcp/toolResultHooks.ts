/* eslint-disable camelcase */
// Result fields are MCP tool results, snake_case by convention.
// One place that makes every motion / staging result machine-aware
// (tyeth/Luban#265 WP8, R6) instead of editing each of ~30 handlers:
//
//  - applied_records {connected_machine, records} (appliedRecords.ts) on every
//    motion / staging result - the named motion tools, every probe_* tool, the
//    laser tools, and anything else that staged a job (confirm_url) or ran one
//    under a policy - and on the read-only status tools;
//  - landmark_review, compact, whenever the review is not confirmed, on the
//    same results and on get_position (on the Ray the no-Z staged reason wins
//    in staged_because, so this is the only way the question reaches the agent
//    there); get_stored_state carries the full review always (landmarks.ts);
//  - the rotary `stock` scope (rotaryWiring.ts) around the tools that take it,
//    and rotary_clearance on their results.
//
// createToolCallHooks() takes its sources as arguments and is unit-tested in
// tests/appliedRecords.test.ts; liveToolCallHooks() binds the live ones and is
// what index.ts hands to ToolRegistry.setCallHooks.
import { AppliedRecords, describeAppliedRecords } from './appliedRecords';
import { LandmarkReview } from './landmarkReview';
import { landmarkReviewForConnected } from './landmarkReviewState';
import { ToolCallHooks } from './registry';
import { ObstacleTransform, runWithObstacleTransform } from './rotaryCallContext';
import { RotaryResolution, STOCK_TOOLS, rotaryResolutionForCall } from './rotaryWiring';

/** Motion and staging tools whose results carry applied_records (and landmark_review when unconfirmed). */
export const MOTION_RESULT_TOOLS = new Set([
    'traverse_xy', 'move_z', 'goto_work_origin', 'move_and_capture', 'home', 'restore_work_frame',
    'goto_tool_change_position', 'run_tool_setter', 'apply_tool_length_offset', 'survey_bed', 'camera_program',
    'camera_bootstrap', 'run_probing_gcode', 'visual_servo', 'track_feature', 'measure_rotary_angle',
    'submit_gcode_job', 'finish_gcode_upload', 'start_gcode_job',
    // WP7's laser tools (#265): named here so they are covered whenever they exist.
    'laser_frame', 'set_air_assist', 'set_crosshair', 'laser_focus',
]);

/** Read-only status tools that carry applied_records. */
export const STATUS_RESULT_TOOLS = new Set(['get_position', 'get_stored_state', 'get_machine_profile', 'get_connection_status']);

export function isMotionResult(name: string, result: object): boolean {
    if (MOTION_RESULT_TOOLS.has(name) || /^probe_/.test(name)) {
        return true;
    }
    const r = result as { confirm_url?: unknown; executed_without_approval?: unknown };
    return typeof r.confirm_url === 'string' || r.executed_without_approval === true;
}

/** The review as a motion result carries it: the question and how to answer, landmark names only (get_stored_state has the rest). */
export function compactLandmarkReview(review: LandmarkReview & { pending_reviews?: object[] }) {
    return {
        status: review.status,
        confirmed: review.confirmed,
        machine: review.machine.machineKey || review.machine.identifier,
        question: review.question,
        answer_with: review.answer_with,
        invalidated_because: review.invalidated_because,
        landmarks: review.landmarks.map((l) => l.name),
        pending_reviews: review.pending_reviews || [],
        full_review: 'get_stored_state.landmark_review',
    };
}

/** The confirm page's line for a job staged under a computed / raised rotary keep-out. */
export function rotaryNote(resolution: RotaryResolution): string | null {
    const r = resolution.report;
    const stock = r.stock ? `stock r${r.stock.radius_mm ?? '-'}${r.stock.top_z !== null ? ` top Z${r.stock.top_z}` : ''}` : 'no stock';
    if (r.applied === 'computed') {
        return `rotary keep-out for THIS job: computed toolhead Z${r.zMm} (${stock}) - '${r.legacy_landmark}' legacy requirement superseded for this job only`;
    }
    if (r.applied === 'raised') {
        return `rotary keep-out for THIS job: raised to toolhead Z${r.zMm} (${stock}) - crossing the rotary refused`;
    }
    return null;
}

export interface ToolCallHookSources {
    appliedRecords: () => AppliedRecords;
    landmarkReview: () => LandmarkReview & { pending_reviews?: object[] };
    rotaryForCall: (args: { stock?: unknown }) => RotaryResolution | null;
    runScoped: <T>(transform: ObstacleTransform, fn: () => Promise<T>, note: string | null) => Promise<T>;
}

export function createToolCallHooks(sources: ToolCallHookSources): ToolCallHooks {
    return {
        async around(name, args, run) {
            if (!STOCK_TOOLS.has(name)) {
                return run();
            }
            const stated = (args as { stock?: unknown }).stock !== undefined && (args as { stock?: unknown }).stock !== null;
            let resolution: RotaryResolution | null;
            try {
                resolution = sources.rotaryForCall(args as { stock?: unknown });
            } catch (err) {
                if (stated) {
                    // A stated stock that cannot be resolved refuses: never plan a crossing on a guess.
                    throw err;
                }
                // Without stock nothing changes, so a failed read must not block the call (the A350 stays as it was).
                const result = await run();
                return { ...result, rotary_clearance: { error: (err as Error).message, applied: 'legacy' } };
            }
            if (!resolution) {
                return run();
            }
            let result: object;
            try {
                result = resolution.transform
                    ? await sources.runScoped(resolution.transform, run, rotaryNote(resolution))
                    : await run();
            } catch (err) {
                // Duck-typed: an McpToolError from another realm (or a subclass) is still an error with a message.
                if (resolution.report.applied === 'raised' && err && typeof (err as Error).message === 'string') {
                    try {
                        (err as Error).message = `${(err as Error).message}\nRotary clearance: ${resolution.report.reasons.join('; ')}`;
                    } catch (rewriteErr) {
                        // The original refusal goes out unchanged.
                    }
                }
                throw err;
            }
            return { ...result, rotary_clearance: resolution.report };
        },
        decorate(name, args, result) {
            const status = STATUS_RESULT_TOOLS.has(name);
            if (!status && !isMotionResult(name, result)) {
                return result;
            }
            const applied = sources.appliedRecords();
            const out: { [key: string]: unknown } = { ...result, applied_records: applied };
            if ('connected_machine' in out) {
                // One machine description, not two that could disagree: the superset.
                out.connected_machine = applied.connected_machine;
            }
            if (name === 'get_stored_state' || (status && name !== 'get_position')) {
                return out;
            }
            try {
                const review = sources.landmarkReview();
                if (!review.confirmed) {
                    out.landmark_review = compactLandmarkReview(review);
                }
            } catch (err) {
                out.landmark_review = { status: 'unknown', confirmed: false, question: `the landmark review could not be read (${(err as Error).message})` };
            }
            return out;
        },
    };
}

export function liveToolCallHooks(): ToolCallHooks {
    return createToolCallHooks({
        appliedRecords: describeAppliedRecords,
        landmarkReview: landmarkReviewForConnected,
        rotaryForCall: rotaryResolutionForCall,
        runScoped: runWithObstacleTransform,
    });
}
