/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (planProbeProgram takes the
// probe_program arguments verbatim).
import fs from 'fs';

import { KeepOutError, ObstacleBox, checkMotion, describeViolations, insideSweptCylinder, normalizeKeepOut, sequenceMotion } from './envelopeChecks';
import { clearanceOptions } from './clearanceContext';
import { landmarkStore } from './landmarks';
import { outsideTravel } from './machineTravel';
import { ExpandedGroup, GroupExpandError, expandProgramGroups } from './programGroups';
import { mcpBroadcast } from './index';
import { probeFeedService } from './probeFeed';
import {
    ProbeOutlinePlan,
    describeProbeOutlinePlanAsGcode,
    planProbeOutline,
    runProbeOutlineProcedure,
} from './probeOutline';
import {
    ProbeSequencePlan,
    describeProbeSequencePlanAsGcode,
    planProbeSequence,
    runProbeSequenceProcedure,
} from './probeSequence';
import {
    ProbeSurfacePlan,
    describeProbeSurfacePlanAsGcode,
    planProbeSurfaceGrid,
    planProbeSurfacePath,
    runProbeSurfaceProcedure,
} from './probeSurface';
import {
    ProbeWallFollowPlan,
    describeProbeWallFollowPlanAsGcode,
    planProbeWallFollow,
    runProbeWallFollowProcedure,
} from './probeWallFollow';
import {
    ProbeCornerPlan,
    describeProbeCornerPlanAsGcode,
    planProbeCorner,
    runProbeCornerProcedure,
} from './probeCorner';
import {
    ProbeTracePlan,
    describeProbeTracePlanAsGcode,
    planProbeTracePerimeter,
    runProbeTracePerimeterProcedure,
} from './probeTracePerimeter';
import {
    ProcedureAbort,
    ProcedureStopped,
    ROTATE_FEED,
    TRAVEL_FEED,
    assertMachineReadyForProcedure,
    abortRaiseToTop,
    knownMachinePosition,
    moveMachineSettled,
    procedureStopRequested,
    rotateB,
    isProcedureStopped,
    checkProcedureStop,
    sleep,
    RECHECK_TOLERANCE_MM,
    awaitMachineSettled,
} from './probing';
import {
    RefResolveError,
    RefSpec,
    describeRef,
    refMidpoint,
    refOpIds,
    resolveRef,
    substituteRefs,
    validateRef,
} from './programRefs';
import { B_AXIS_DEG, MAX_SWEPT_RADIUS_MM, within } from './procedureLimits';
import { captureFrame } from './camera';
import { finishProgramAbort, probeAbortHeld } from './programAbort';
import { describeCaptureOp, describeHomeOp, describeRotateOp } from './programEnvelope';
import { programFramePath } from './programFrames';
import {
    CAPTURE_EVENT_BUDGET,
    CaptureOpArgs,
    HOME_EVENT_BUDGET,
    PROGRAM_OP_KINDS,
    captureOpArgs,
    homeOrderError,
    isProgramOpKind,
} from './programOps';
import { McpToolError } from './registry';
import { missingGeometryNote, programSeedNamespaces } from './rotaryGeometry';
import { deriveStockSection } from './stockGeometry';
import { homeMachine } from './tools/camera';
import { getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';

// A composite probing PROGRAM: an ordered list of operations - rotate the
// rotary axis, top-surface scans (path / grid), probe sequences (side and
// end marches), no-motion camera captures and a closing machine home
// (programOps.ts) - staged ONCE, approved ONCE on a single confirm page that
// enumerates every operation's envelope and every rotation, and run by ONE
// runner that hands the machine from operation to operation. Operator
// request 2026-09-05 after a four-face survey that took 18 approvals.
//
// Numbers an operation needs but cannot know at staging (the top of the
// face that a centre probe earlier in the SAME program will measure) are
// REFERENCES to earlier results: { from: "c90.top.z", plus: 7, between:
// [195, 240] }. Law 3 is kept by the bounds: the operator approves the
// range, the runner refuses the operation (and stops the program, raised)
// if the resolved value falls outside it, and the confirm page shows the
// bounds with a preview plan computed at the mid-point. Every other law is
// unchanged: each operation runs through the existing runners (position of
// record, crash guard, hop envelope, slow zone, segmented descents), a
// rotation requires the toolhead at or above the safe traverse height, and
// every operation ends raised at that height.

export { describeRef, isRef, lookupPath, refOpIds, resolveRef, substituteRefs } from './programRefs';
export type { RefSpec } from './programRefs';

export type ProgramOpKind = 'rotate_b' | 'surface_path' | 'surface_grid' | 'sequence' | 'stock_outline' | 'wall_follow' | 'corner' | 'trace' | 'capture' | 'home';

export interface ProgramOp {
    id: string;
    kind: ProgramOpKind;
    /** Raw arguments for the underlying tool (numbers or references). */
    args: { [key: string]: unknown };
    /** What to do when this op fails: stop the program (default) or record and continue. Rotations always stop. */
    on_fail: 'stop' | 'skip';
    /** Dotted arg paths that hold references, with their bounds (for the page). */
    refs: { path: string; ref: RefSpec }[];
}

export interface ProbeProgramPlan {
    name: string;
    ops: ProgramOp[];
    hopZ: number;
    staged: { x: number; y: number; z: number; b: number | null };
    /** Preview descriptions (refs at their mid-point) for the confirm page. */
    previews: { id: string; text: string }[];
    rotations: number[];
    /** Namespaces seeded into the results before op 1 (jig/tool constants: `axis`). */
    seeds: ReturnType<typeof programSeedNamespaces>;
    /** Transient obstacle boxes for THIS clamping (chuck jaws, tailstock), checked with the stored landmarks. */
    keepOut: ObstacleBox[];
    /** `group` ops expanded at staging (for the page header). */
    groups: ExpandedGroup[];
    /** Estimated job events this program writes (100 + 120/station + 60/probe + 20/rotation + 10/capture + 30/home). */
    eventBudget: number;
    /** The program ends with a `home` op: every axis to its switches, B back to 0. */
    homesAtEnd: boolean;
    /** No-motion frame captures in the program, by op id. */
    captures: string[];
}

const MAX_OPS = 80;
/** Extra events for a capture that hops to a viewing position (raise + hop, each settle-verified). */
const CAPTURE_VIEW_EVENT_BUDGET = 20;

/**
 * A capture's viewing hop is a sequence hop in every respect: inside the
 * toolhead travel, at the traverse height, and refused (law 4) when the
 * segment crosses an obstacle box below the Z it demands. Throws Error with
 * the operator-facing text; callers wrap it.
 */
function checkCaptureView(
    view: { x: number; y: number },
    from: { x: number; y: number; z: number },
    hopZ: number,
    keepOut: ObstacleBox[],
    where: string
): void {
    const travel = requirePlanningTravel('a program capture view', { x: from.x, y: from.y });
    const off = outsideTravel({ x: view.x, y: view.y }, travel.limits);
    if (off) {
        throw new Error(`${where} (capture): viewing position is outside the toolhead travel: ${off}.`);
    }
    const violations = checkMotion(
        sequenceMotion({ hopZ, staged: from, steps: [{ kind: 'hop', x: view.x, y: view.y }] }),
        [...landmarkStore.obstacleBoxes(), ...keepOut],
        { traverseZ: hopZ, ...clearanceOptions() }
    );
    if (violations.length) {
        throw new Error(`${where} (capture): viewing hop refused (law 4, landmarks are obstacles): ${describeViolations(violations)}.`);
    }
}

/** Job-event estimate per op (measured: 763 events for an 8-station path; a sequence probe ~60). */
function eventBudgetFor(sub: SubPlan | { kind: 'rotate_b' }): number {
    if (sub.kind === 'rotate_b') {
        return 20;
    }
    if (sub.kind === 'sequence') {
        return 20 + sub.plan.steps.length * 20 + sub.plan.steps.filter((st) => st.kind === 'probe').length * 60
            + sub.plan.steps.filter((st) => st.kind === 'probe' && st.capture).length * CAPTURE_EVENT_BUDGET;
    }
    if (sub.kind === 'stock_outline') {
        return 60 + sub.plan.topPoints.length * 80 + sub.plan.sidePoints.length * 90;
    }
    if (sub.kind === 'wall_follow') {
        // A side march plus an along-step per station, like an outline side point.
        return 40 + sub.plan.stations.length * 90;
    }
    if (sub.kind === 'corner') {
        // The bisector march, then a radial march and retreat per station.
        return 80 + sub.plan.radials.length * 70;
    }
    if (sub.kind === 'trace') {
        // Every crawl step is a send: the worst-case step count of the estimate plus the confirm cycles.
        return 100 + sub.plan.estimate.worstCycles * 3 + sub.plan.estimate.confirmCycles * 60;
    }
    return 40 + sub.plan.stations.length * 120 + (sub.plan.capture?.stations?.length || 0) * CAPTURE_EVENT_BUDGET;
}
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;

type SubPlan =
    | { kind: 'surface_path'; plan: ProbeSurfacePlan }
    | { kind: 'surface_grid'; plan: ProbeSurfacePlan }
    | { kind: 'sequence'; plan: ProbeSequencePlan }
    | { kind: 'stock_outline'; plan: ProbeOutlinePlan }
    | { kind: 'wall_follow'; plan: ProbeWallFollowPlan }
    | { kind: 'corner'; plan: ProbeCornerPlan }
    | { kind: 'trace'; plan: ProbeTracePlan };

function buildSubPlan(kind: ProgramOpKind, args: { [key: string]: unknown }, keepOut: ObstacleBox[]): SubPlan {
    if (kind === 'surface_path') {
        return { kind, plan: planProbeSurfacePath(args as Parameters<typeof planProbeSurfacePath>[0], keepOut) };
    }
    if (kind === 'surface_grid') {
        return { kind, plan: planProbeSurfaceGrid(args as Parameters<typeof planProbeSurfaceGrid>[0], keepOut) };
    }
    if (kind === 'sequence') {
        return { kind, plan: planProbeSequence(args as Parameters<typeof planProbeSequence>[0], keepOut) };
    }
    if (kind === 'stock_outline') {
        return { kind, plan: planProbeOutline(args as Parameters<typeof planProbeOutline>[0], keepOut) };
    }
    if (kind === 'wall_follow') {
        return { kind, plan: planProbeWallFollow(args as Parameters<typeof planProbeWallFollow>[0], keepOut) };
    }
    if (kind === 'corner') {
        return { kind, plan: planProbeCorner(args as Parameters<typeof planProbeCorner>[0], keepOut) };
    }
    if (kind === 'trace') {
        return { kind, plan: planProbeTracePerimeter(args as Parameters<typeof planProbeTracePerimeter>[0], keepOut) };
    }
    throw new McpToolError(`Unsupported op kind ${kind}.`);
}

function describeSubPlan(sub: SubPlan): string {
    if (sub.kind === 'sequence') {
        return describeProbeSequencePlanAsGcode(sub.plan);
    }
    if (sub.kind === 'stock_outline') {
        return describeProbeOutlinePlanAsGcode(sub.plan);
    }
    if (sub.kind === 'wall_follow') {
        return describeProbeWallFollowPlanAsGcode(sub.plan);
    }
    if (sub.kind === 'corner') {
        return describeProbeCornerPlanAsGcode(sub.plan);
    }
    if (sub.kind === 'trace') {
        return describeProbeTracePlanAsGcode(sub.plan);
    }
    return describeProbeSurfacePlanAsGcode(sub.plan);
}

async function runSubPlan(sub: SubPlan): Promise<object> {
    if (sub.kind === 'sequence') {
        return runProbeSequenceProcedure(sub.plan);
    }
    if (sub.kind === 'stock_outline') {
        return runProbeOutlineProcedure(sub.plan);
    }
    if (sub.kind === 'wall_follow') {
        return runProbeWallFollowProcedure(sub.plan);
    }
    if (sub.kind === 'corner') {
        return runProbeCornerProcedure(sub.plan);
    }
    if (sub.kind === 'trace') {
        return runProbeTracePerimeterProcedure(sub.plan);
    }
    return runProbeSurfaceProcedure(sub.plan);
}

export function planProbeProgram(args: { name?: unknown; ops?: unknown; keep_out?: unknown }): ProbeProgramPlan {
    const name = String(args.name || '').trim();
    if (!name) {
        throw new McpToolError('name is required (shown to the operator).');
    }
    let keepOut: ObstacleBox[];
    try {
        keepOut = normalizeKeepOut(args.keep_out);
    } catch (err) {
        if (err instanceof KeepOutError) {
            throw new McpToolError(err.message);
        }
        throw err;
    }
    if (!Array.isArray(args.ops) || args.ops.length < 1) {
        throw new McpToolError(`ops is required: operations of kind ${PROGRAM_OP_KINDS.join(' | ')} | group.`);
    }
    let expandedOps: unknown[];
    let groups: ExpandedGroup[];
    try {
        ({ ops: expandedOps, groups } = expandProgramGroups(args.ops));
    } catch (err) {
        if (err instanceof GroupExpandError) {
            throw new McpToolError(err.message);
        }
        throw err;
    }
    if (expandedOps.length > MAX_OPS) {
        throw new McpToolError(`${expandedOps.length} operations after group expansion exceeds the cap of ${MAX_OPS}.`);
    }
    const snapshot = getPositionSnapshot();
    const { x, y, z } = snapshot.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown; cannot anchor the program.');
    }
    const hopZ = safeTraverseZ();
    const seeds = programSeedNamespaces();
    const seeded = new Set(Object.keys(seeds));
    const ids = new Set<string>();
    const ops: ProgramOp[] = [];
    const previews: { id: string; text: string }[] = [];
    const rotations: number[] = [];
    let anyRotate = false;
    let eventBudget = 100;
    const captures: string[] = [];
    const homeOrder = homeOrderError(expandedOps.map((raw) => String((raw as { kind?: unknown } | null)?.kind || '')));
    if (homeOrder) {
        throw new McpToolError(homeOrder);
    }

    expandedOps.forEach((raw, index) => {
        const where = `ops[${index}]`;
        if (!raw || typeof raw !== 'object') {
            throw new McpToolError(`${where}: must be an object.`);
        }
        const op = raw as { [key: string]: unknown };
        const id = String(op.id || '');
        if (!ID_PATTERN.test(id)) {
            throw new McpToolError(`${where}: id is required (letters, digits, _ or -, max 32 chars) - other ops reference results by it.`);
        }
        if (id === 'axis' || id === 'probe') {
            throw new McpToolError(`${where}: "${id}" is a seeded geometry namespace, not an op id.`);
        }
        if (ids.has(id)) {
            throw new McpToolError(`${where}: duplicate id "${id}".`);
        }
        ids.add(id);
        const kind = String(op.kind || '') as ProgramOpKind;
        if (!isProgramOpKind(kind)) {
            throw new McpToolError(`${where}: kind must be one of ${PROGRAM_OP_KINDS.join(', ')} (or group).`);
        }
        const onFail = op.on_fail === 'skip' ? 'skip' : 'stop';
        const opArgs: { [key: string]: unknown } = {};
        for (const [key, value] of Object.entries(op)) {
            if (!['id', 'kind', 'on_fail'].includes(key)) {
                opArgs[key] = value;
            }
        }

        if (kind === 'capture') {
            // No motion: a frame from wherever the previous op left the head,
            // stamped with the position of record and B, saved on the job.
            let capture: CaptureOpArgs;
            try {
                capture = captureOpArgs(opArgs, where);
            } catch (err) {
                throw new McpToolError((err as Error).message);
            }
            if (capture.view) {
                // Law 2 and law 4 at staging, from the program's anchor (each
                // op ends raised, so the anchor XY is the worst case only for
                // op 1; the runner re-checks from the live position).
                try {
                    checkCaptureView(capture.view, { x, y, z }, hopZ, keepOut, where);
                } catch (err) {
                    throw new McpToolError((err as Error).message);
                }
            }
            captures.push(id);
            eventBudget += CAPTURE_EVENT_BUDGET + (capture.view ? CAPTURE_VIEW_EVENT_BUDGET : 0);
            ops.push({
                id,
                kind,
                args: { settle_ms: capture.settle_ms, label: capture.label, x: capture.view?.x ?? null, y: capture.view?.y ?? null },
                on_fail: onFail,
                refs: [],
            });
            previews.push({ id, text: describeCaptureOp(capture, hopZ) });
            return;
        }
        if (kind === 'home') {
            if (Object.keys(opArgs).length) {
                throw new McpToolError(`${where} (home): takes no arguments.`);
            }
            eventBudget += HOME_EVENT_BUDGET;
            ops.push({ id, kind, args: {}, on_fail: 'stop', refs: [] });
            previews.push({ id, text: describeHomeOp(anyRotate ? rotations[rotations.length - 1] : null) });
            return;
        }
        if (kind === 'rotate_b') {
            const b = Number(opArgs.b);
            if (!within(b, B_AXIS_DEG)) {
                throw new McpToolError(`${where} (rotate_b): b is required, absolute degrees in ${B_AXIS_DEG.min}..${B_AXIS_DEG.max}.`);
            }
            const requireZ = opArgs.require_z_at_least === undefined ? hopZ : Number(opArgs.require_z_at_least);
            if (!Number.isFinite(requireZ) || requireZ < hopZ) {
                throw new McpToolError(`${where} (rotate_b): require_z_at_least must be >= the safe traverse height ${hopZ} (law 2: the stock turns under a raised head).`);
            }
            // Stock size belongs to the program, not the jig: an optional
            // swept radius (largest reach of THIS stock and clamping about the
            // axis) adds a tip-outside-the-cylinder check before the turn.
            let sweptRadius: number | null = null;
            if (opArgs.swept_radius_mm !== undefined && opArgs.swept_radius_mm !== null) {
                sweptRadius = Number(opArgs.swept_radius_mm);
                if (!Number.isFinite(sweptRadius) || sweptRadius <= 0 || sweptRadius > MAX_SWEPT_RADIUS_MM) {
                    throw new McpToolError(`${where} (rotate_b): swept_radius_mm must be 0-${MAX_SWEPT_RADIUS_MM} (largest reach of the stock and clamping about the axis).`);
                }
                if (!seeds.axis) {
                    throw new McpToolError(`${where} (rotate_b): swept_radius_mm needs the rotary axis and probe length. ${missingGeometryNote()}`);
                }
            }
            if (!snapshot.isFourAxis) {
                throw new McpToolError(`${where} (rotate_b): the heartbeat reports no B axis - is the rotary module installed and selected in Machine Settings?`);
            }
            anyRotate = true;
            rotations.push(b);
            eventBudget += eventBudgetFor({ kind: 'rotate_b' });
            ops.push({ id, kind, args: { b, require_z_at_least: requireZ, swept_radius_mm: sweptRadius }, on_fail: 'stop', refs: [] });
            const swept = sweptRadius !== null && seeds.axis
                ? `; swept cylinder (this stock): axis X${seeds.axis.x}, physical Z${seeds.axis.z_physical}, radius ${sweptRadius} -> the probe tip clears it with the toolhead at Z >= ${(seeds.axis.z_contact + sweptRadius).toFixed(3)}`
                : '';
            previews.push({ id, text: describeRotateOp({ b, requireZ, fromB: snapshot.b, rotateFeed: ROTATE_FEED, swept: swept || null }) });
            return;
        }

        // Validate references (bounds), then build a PREVIEW plan at the
        // mid-point of each bounded reference so the page can enumerate the
        // envelope and every cap is checked now, not at run time.
        let previewArgs: { [key: string]: unknown };
        let refs: { path: string; ref: RefSpec }[];
        try {
            ({ args: previewArgs, refs } = substituteRefs(opArgs, (ref, path) => {
                validateRef(ref, `${where}.${path}`);
                return refMidpoint(ref);
            }));
        } catch (err) {
            if (err instanceof RefResolveError) {
                throw new McpToolError(err.message);
            }
            throw err;
        }
        for (const r of refs) {
            const missing = refOpIds(r.ref).find((dep) => dep === id || (!ids.has(dep) && !seeded.has(dep)));
            if (missing === 'axis') {
                throw new McpToolError(`${where}: reference ${describeRef(r.ref)} reads the "axis" namespace, which is not configured. ${missingGeometryNote()}`);
            }
            if (missing) {
                throw new McpToolError(`${where}: reference ${describeRef(r.ref)} reads "${missing}", which is not an op that runs BEFORE this one`
                    + `${seeded.size ? ` (or a seeded namespace: ${Array.from(seeded).join(', ')})` : ''}.`);
            }
        }
        let preview: SubPlan;
        try {
            preview = buildSubPlan(kind, previewArgs, keepOut);
        } catch (err) {
            throw new McpToolError(`${where} ("${id}", ${kind}): ${(err as Error).message}`);
        }
        ops.push({ id, kind, args: opArgs, on_fail: onFail, refs });
        eventBudget += eventBudgetFor(preview);
        const refLines = refs.map((r) => `; REFERENCE ${r.path} = ${describeRef(r.ref)}, `
            + `approved bounds [${r.ref.between[0]}, ${r.ref.between[1]}] - preview below uses ${refMidpoint(r.ref)}; the runner REFUSES the op outside the bounds`);
        previews.push({ id, text: [...refLines, describeSubPlan(preview)].join('\n') });
    });

    return {
        name,
        ops,
        hopZ,
        staged: { x, y, z, b: snapshot.b },
        previews,
        rotations: anyRotate ? rotations : [],
        seeds,
        keepOut,
        groups,
        eventBudget,
        homesAtEnd: ops.length > 0 && ops[ops.length - 1].kind === 'home',
        captures,
    };
}

// The confirm-page body lives in programEnvelope.ts (pure, unit-tested); the
// plan type is structurally what it renders.
export { describeProbeProgramAsGcode } from './programEnvelope';

export interface ProgramOpResult {
    id: string;
    kind: ProgramOpKind;
    /** Rotary angle the op ran at (last verified rotation, or the staged B). */
    b: number | null;
    status: 'completed' | 'failed' | 'skipped';
    resolvedRefs: { path: string; from: string; value: number }[];
    startedAt: number;
    endedAt: number;
    result?: object;
    /** What a failed op measured before it aborted (stations / contacts). */
    partial?: object;
    error?: string;
}

/** The program's result object - returned on success and carried as `partial` on an abort/stop. */
function programResult(
    plan: ProbeProgramPlan,
    report: ProgramOpResult[],
    stoppedAt: string | null,
    startedAt: number,
    phases: { phase: string; note?: string }[]
): object {
    return {
        name: plan.name,
        ops: report,
        completedOps: report.filter((r) => r.status === 'completed').length,
        stoppedAt,
        rotations: plan.rotations,
        axis: plan.seeds.axis || null,
        derived: deriveStockSection(
            report.filter((r) => r.status === 'completed').map((r) => ({ id: r.id, kind: r.kind, b: r.b, result: r.result })),
            plan.seeds.axis || null
        ),
        durationMs: Date.now() - startedAt,
        phases,
        note: `Program ${stoppedAt ? `stopped at "${stoppedAt}"` : 'complete'}: ${report.filter((r) => r.status === 'completed').length}/${plan.ops.length} operations. `
            + 'Each op result is the same object its standalone tool returns (stations / results, fits, timing).',
    };
}

export async function runProbeProgramProcedure(plan: ProbeProgramPlan): Promise<object> {
    assertMachineReadyForProcedure();
    const results: { [opId: string]: unknown } = { ...plan.seeds };
    const report: ProgramOpResult[] = [];
    const phases: { phase: string; note?: string }[] = [];
    const announce = (phase: string, note?: string) => {
        phases.push({ phase, note });
        mcpBroadcast('mcp:activity', { tool: 'probe_program', phase, note });
    };
    const startedAt = Date.now();
    let stoppedAt: string | null = null;
    let currentB: number | null = plan.staged.b;

    for (let index = 0; index < plan.ops.length; index++) {
        const op = plan.ops[index];
        const opStarted = Date.now();
        const resolved: ProgramOpResult['resolvedRefs'] = [];
        announce(`op-${op.id}-start`, `${index + 1}/${plan.ops.length} ${op.kind}`);
        try {
            probeFeedService.assertNoOvertravel();
            if (op.kind === 'capture') {
                checkProcedureStop();
                // Operator law (2026-09-21): a camera op acts on the previous
                // op's position only once the machine confirms it - idle on
                // two consecutive beats, at the B the program believes it is at.
                const settledBefore = await awaitMachineSettled(`probe_program:${op.id}`, { b: currentB });
                if (settledBefore.waitedMs > 1500) {
                    announce(`op-${op.id}-settled`, `waited ${settledBefore.waitedMs} ms for the machine to go idle at B${currentB ?? '?'}`);
                }
                if (op.args.x !== null && op.args.x !== undefined && op.args.y !== null && op.args.y !== undefined) {
                    // Viewing position: re-check from the LIVE position (the
                    // staging check used the program anchor), then law 2 -
                    // raise to the traverse height, hop, never the reverse.
                    const view = { x: Number(op.args.x), y: Number(op.args.y) };
                    const known = knownMachinePosition();
                    const { x: kx, y: ky, z: kz } = known.position;
                    if (kx === null || ky === null || kz === null) {
                        throw new ProcedureAbort('Capture view refused: the machine position is unknown.');
                    }
                    checkCaptureView(view, { x: kx, y: ky, z: kz }, plan.hopZ, plan.keepOut, `op "${op.id}"`);
                    probeFeedService.clearExpectedContact();
                    if (kz < plan.hopZ - RECHECK_TOLERANCE_MM) {
                        await moveMachineSettled(`probe_program:${op.id}:raise`, { z: plan.hopZ }, TRAVEL_FEED);
                    }
                    await moveMachineSettled(`probe_program:${op.id}:view`, { x: view.x, y: view.y }, TRAVEL_FEED);
                    announce(`op-${op.id}-view`, `at machine (${view.x}, ${view.y}) Z${plan.hopZ}`);
                }
                const settleMs = Number(op.args.settle_ms) || 0;
                if (settleMs > 0) {
                    await sleep(settleMs);
                }
                // A view hop moved the head: confirm it, too, before the frame.
                if (op.args.x !== null && op.args.x !== undefined) {
                    await awaitMachineSettled(`probe_program:${op.id}:view`, { b: currentB });
                }
                const frame = await captureFrame();
                const snapshot = getPositionSnapshot();
                const file = programFramePath(startedAt, plan.name, op.id);
                fs.writeFileSync(file, Buffer.from(frame.imageBase64, 'base64'));
                const outcome = {
                    frameId: frame.frameId,
                    file,
                    label: op.args.label ?? null,
                    view: op.args.x === null || op.args.x === undefined ? null : { x: Number(op.args.x), y: Number(op.args.y) },
                    capturedAt: frame.capturedAt,
                    device: frame.device,
                    provider: frame.provider,
                    source: frame.source,
                    mimeType: frame.mimeType,
                    machine: snapshot.machine,
                    reliability: snapshot.reliability,
                    b: snapshot.b,
                    note: 'View with get_frame {frame_id} (last 12 cached) or get_frame {file}. A frame finds things, it clears nothing.',
                };
                results[op.id] = outcome;
                report.push({ id: op.id, kind: op.kind, b: currentB, status: 'completed', resolvedRefs: resolved, startedAt: opStarted, endedAt: Date.now(), result: outcome });
                announce(`op-${op.id}-done`, `frame ${frame.frameId} at machine (${snapshot.machine.x}, ${snapshot.machine.y}, ${snapshot.machine.z}) B${snapshot.b ?? '?'}`);
                continue;
            }
            if (op.kind === 'home') {
                checkProcedureStop();
                const outcome = await homeMachine(`probe_program:${op.id}`, true);
                currentB = 0;
                results[op.id] = outcome;
                report.push({ id: op.id, kind: op.kind, b: currentB, status: 'completed', resolvedRefs: resolved, startedAt: opStarted, endedAt: Date.now(), result: outcome });
                announce(`op-${op.id}-done`, 'machine homed (B 0)');
                continue;
            }
            if (op.kind === 'rotate_b') {
                const b = Number(op.args.b);
                const requireZ = Number(op.args.require_z_at_least);
                const axis = plan.seeds.axis;
                const sweptRadius = op.args.swept_radius_mm === null || op.args.swept_radius_mm === undefined ? null : Number(op.args.swept_radius_mm);
                if (axis && sweptRadius !== null) {
                    // Belt and braces over the Z >= traverse rule: the tip must
                    // be outside this stock's swept cylinder before it turns.
                    const known = knownMachinePosition();
                    const { x: kx, z: kz } = known.position;
                    if (kx !== null && kz !== null
                        && insideSweptCylinder({ x: kx, z: kz }, axis.probe_length, { x: axis.x, zPhysical: axis.z_physical, radius: sweptRadius })) {
                        throw new ProcedureAbort(`Rotation refused: the probe tip (toolhead machine X${kx} Z${kz}, ${known.source}) is inside the `
                            + `stock's swept cylinder (axis X${axis.x}, physical Z${axis.z_physical}, radius ${sweptRadius}).`);
                    }
                }
                const outcome = await rotateB(`probe_program:${op.id}`, b, requireZ);
                currentB = outcome.to;
                results[op.id] = outcome;
                report.push({ id: op.id, kind: op.kind, b: currentB, status: 'completed', resolvedRefs: resolved, startedAt: opStarted, endedAt: Date.now(), result: outcome });
                announce(`op-${op.id}-done`, `B ${outcome.from === null ? '?' : outcome.from} -> ${outcome.to} deg (${outcome.verifiedBy}, ${outcome.elapsedMs} ms to reply, ~${outcome.expectedMs} ms needed, settled after ${outcome.settleWaitMs} ms)`);
                continue;
            }
            // Resolve references NOW against earlier results, re-plan at the
            // machine's current (raised) position, run the existing runner.
            const { args: liveArgs } = substituteRefs(op.args, (ref, path) => {
                const r = resolveRef(ref, results);
                resolved.push({ path, from: describeRef(ref), value: r.value });
                announce(`op-${op.id}-ref`, `${path} = ${r.source}`);
                return r.value;
            });
            const sub = buildSubPlan(op.kind, liveArgs, plan.keepOut);
            const outcome = await runSubPlan(sub);
            results[op.id] = outcome;
            report.push({ id: op.id, kind: op.kind, b: currentB, status: 'completed', resolvedRefs: resolved, startedAt: opStarted, endedAt: Date.now(), result: outcome });
            announce(`op-${op.id}-done`);
        } catch (err) {
            const message = (err as Error).message;
            const partial = (err as { partial?: object }).partial;
            report.push({ id: op.id, kind: op.kind, b: currentB, status: 'failed', resolvedRefs: resolved, startedAt: opStarted, endedAt: Date.now(), partial, error: message });
            announce(`op-${op.id}-failed`, message);
            const trip = probeFeedService.getTrip();
            // A requested stop (stop_gcode_job) ends the PROGRAM, whatever the
            // op's on_fail says.
            const stop = procedureStopRequested();
            const held = probeAbortHeld(partial) || probeFeedService.getReading('probe')?.triggered === true;
            if (trip || stop || held || op.on_fail === 'stop' || op.kind === 'rotate_b' || op.kind === 'home') {
                stoppedAt = op.id;
                const tail = await finishProgramAbort(held, !!trip, async () => abortRaiseToTop(
                    'probe_program',
                    (phase, z, note) => announce(phase, z === null ? note : `Z${z} - ${note}`),
                    { holdIfTriggered: 'probe' }
                ));
                for (const later of plan.ops.slice(index + 1)) {
                    report.push({
                        id: later.id,
                        kind: later.kind,
                        b: currentB,
                        status: 'skipped',
                        resolvedRefs: [],
                        startedAt: Date.now(),
                        endedAt: Date.now(),
                        error: `not run: program stopped at "${op.id}"`,
                    });
                }
                const completed = report.filter((r) => r.status === 'completed').length;
                const Ctor = stop || isProcedureStopped(err) ? ProcedureStopped : ProcedureAbort;
                throw new Ctor(`Program "${plan.name}" stopped at op "${op.id}" (${index + 1}/${plan.ops.length}): ${message} `
                    + `${completed} earlier op(s) completed; their results are on the job record under result.ops. ${tail}`,
                programResult(plan, report, op.id, startedAt, phases));
            }
            announce(`op-${op.id}-skipped`, 'on_fail: skip - continuing');
        }
    }

    return programResult(plan, report, stoppedAt, startedAt, phases);
}
