/* eslint-disable camelcase */
// Pure planning and execution contract for human-gated, NO-MOTION workspace updates.
// Firmware: Snapmaker2-Controller Marlin/src/gcode/geometry/{G53-G59,G92}.cpp.
// G92 updates the selected workspace; no generic G10 semantics are assumed.
import { POSITION_EPSILON_MM } from './envelopeChecks';
import { AXES, Xyz } from './positionOfRecord';

export const WORKSPACES = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59', 'G59.1', 'G59.2', 'G59.3'] as const;
export type Workspace = typeof WORKSPACES[number];
export const WORKSPACE_TOLERANCE_MM = 0.02;

export interface WorkspaceSnapshot {
    machine: { x: number | null; y: number | null; z: number | null };
    work: { x: number | null; y: number | null; z: number | null };
    originOffset: Xyz;
    originOffsetSource: string;
    reliability: string;
    frame: string;
    warnings: string[];
    machineStatus: string | null;
    isHomed: boolean | null;
    b: number | null;
    isFourAxis: boolean;
    reportedAt: number;
    reportAgeMs: number;
}

export interface WorkspacePlan {
    workspace: Workspace;
    index: number;
    machine: Xyz;
    b: number | null;
    originOffsetAtStaging: Xyz;
    originMachine: Xyz | null;
    workAtWrite: Xyz | null;
    reason: string;
    datumReference: string | null;
    review: string;
}

function finiteXyz(value: unknown, name: string): Xyz {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must contain numeric x, y and z.`);
    const raw = value as Record<string, unknown>;
    if (Object.keys(raw).some((key) => !AXES.includes(key as typeof AXES[number]))) throw new Error(`${name} accepts only x, y and z (no B or E origin writes).`);
    for (const axis of AXES) {
        if (typeof raw[axis] !== 'number' || !Number.isFinite(raw[axis]) || Math.abs(raw[axis] as number) > 100000) {
            throw new Error(`${name}.${axis} must be a finite number within +/-100000 mm.`);
        }
    }
    return Object.fromEntries(AXES.map((axis) => [axis, Number((raw[axis] as number).toFixed(3))])) as unknown as Xyz;
}

export function assertWorkspaceSnapshot(s: WorkspaceSnapshot): void {
    if (s.machineStatus !== 'idle' || s.isHomed !== true) throw new Error('Workspace changes require an idle, homed machine.');
    if (!['verified', 'heartbeat'].includes(s.reliability) || s.originOffsetSource !== 'heartbeat'
        || s.frame !== 'work-frame' || s.warnings.length || !Number.isFinite(s.reportedAt) || !Number.isFinite(s.reportAgeMs) || s.reportAgeMs < 0 || s.reportAgeMs > 10000) {
        throw new Error('Workspace changes require a fresh coherent work-frame heartbeat with its own offset; restore/recheck the work frame first.');
    }
    finiteXyz(s.machine, 'machine position');
    finiteXyz(s.work, 'work position');
    finiteXyz(s.originOffset, 'origin offset');
    if (s.isFourAxis && (s.b === null || !Number.isFinite(s.b))) throw new Error('Current B orientation is unknown.');
}

export function planWorkspace(
    args: { workspace?: unknown; origin_machine?: unknown; reason?: unknown; datum_reference?: unknown },
    s: WorkspaceSnapshot,
    write: boolean,
): WorkspacePlan {
    assertWorkspaceSnapshot(s);
    if (!WORKSPACES.includes(args.workspace as Workspace)) throw new Error(`workspace must explicitly be one of ${WORKSPACES.join(', ')}.`);
    if (typeof args.reason !== 'string' || !args.reason.trim()) throw new Error('reason is required.');
    if (write && (typeof args.datum_reference !== 'string' || !args.datum_reference.trim())) {
        throw new Error('datum_reference is required: identify measured references, tool and B context, not just a CAD origin.');
    }
    const workspace = args.workspace as Workspace;
    const machine = finiteXyz(s.machine, 'machine position');
    const originMachine = write ? finiteXyz(args.origin_machine, 'origin_machine') : null;
    const workAtWrite = originMachine ? Object.fromEntries(AXES.map((a) => [a, Number((machine[a] - originMachine[a]).toFixed(3))])) as unknown as Xyz : null;
    const reason = args.reason.trim();
    const datumReference = write ? String(args.datum_reference).trim() : null;
    const comment = (v: string) => v.replace(/[\r\n]/g, ' ');
    const words = (v: Xyz) => AXES.map((a) => `${a.toUpperCase()}${v[a].toFixed(3)}`).join(' ');
    const lines = [
        `; ${write ? 'SET ORIGIN' : 'SELECT WORKSPACE'} ${workspace} - NO AXIS MOTION`,
        `; reason: ${comment(reason)}`,
        `; toolhead remains at machine ${words(machine)}${s.b === null ? '' : ` B${s.b}`}`,
        '; One common WCS is preferred; additional workspaces are for existing jobs that require them.',
        '; Select via G53 then the named workspace; require firmware acknowledgement and fresh offset readback.',
        '; The selected workspace remains active. Other MCP procedures can reselect G54; recheck before a file job.',
        '; Existing staged jobs become stale when this job changes workspace state; restage them after verification.',
        'G21', 'G53;', `${workspace};`, 'M114',
    ];
    if (originMachine && workAtWrite) {
        lines.splice(3, 0, `; replace ALL XYZ of ${workspace}: work zero = machine TOOLHEAD ${words(originMachine)} for the fitted tool`,
            `; datum evidence: ${comment(datumReference || '')}`,
            '; Previous target-workspace offset is read after selection; no other workspace origin is rewritten.',
            '; Origin may be a derived reference: this command never travels to it and does not certify its access.');
        lines.push(`G92 ${words(workAtWrite)}`, 'M114');
    }
    return { workspace, index: WORKSPACES.indexOf(workspace), machine, b: s.b, originOffsetAtStaging: { ...s.originOffset }, originMachine, workAtWrite, reason, datumReference, review: lines.join('\n') };
}

function near(a: number | null, b: number | null): boolean {
    return a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= WORKSPACE_TOLERANCE_MM;
}

export function unchangedPose(plan: WorkspacePlan, s: WorkspaceSnapshot): boolean {
    return AXES.every((a) => near(s.machine[a], plan.machine[a])) && (plan.b === null ? s.b === null : near(s.b, plan.b));
}

export interface WorkspaceIo {
    snapshot: () => WorkspaceSnapshot;
    guard: () => void; // same connection, idle/homed/head off, no alarm/stop
    send: (gcode: string) => Promise<{ result: number; text?: string }>;
    invalidateApprovals: () => void;
    now: () => number;
    wait: (ms: number) => Promise<void>;
}

export class WorkspaceUpdateError extends Error {
    public partial: object;

    public constructor(message: string, partial: object) {
        super(message);
        this.partial = partial;
    }
}

/** Called only by an approved job runner. Never raises, moves, rolls back or retries a G92. */
export async function runWorkspace(plan: WorkspacePlan, io: WorkspaceIo): Promise<object> {
    let selectionAttempted = false;
    let selected = false;
    let writeAttempted = false;
    let before: WorkspaceSnapshot | null = null;
    const send = async (code: string) => {
        io.guard();
        const reply = await io.send(code);
        if (reply.result !== 0 || /(?:error|unknown command|unsupported|invalid command)/i.test(reply.text || '')) {
            throw new Error(`Controller refused workspace command: ${reply.text || reply.result}`);
        }
        return reply;
    };
    const readback = async (after: number, expectedOffset: Xyz | null): Promise<WorkspaceSnapshot> => {
        const deadline = io.now() + 15000;
        let lastAt = after;
        let agreeing = 0;
        let previousOffset: Xyz | null = null;
        while (io.now() < deadline) {
            io.guard();
            const s = io.snapshot();
            let coherent = false;
            try { assertWorkspaceSnapshot(s); coherent = true; } catch (err) { /* allow heartbeat frame transitions */ }
            if (coherent && s.reportedAt > lastAt) {
                lastAt = s.reportedAt;
                if (!unchangedPose(plan, s)) throw new Error('Machine pose or B changed during the no-motion workspace update.');
                const matches = !expectedOffset || AXES.every((a) => near(s.originOffset[a], expectedOffset[a])
                    && near(s.work[a], plan.machine[a] + expectedOffset[a]));
                const offset = previousOffset;
                const sameOffset = offset && AXES.every((a) => near(s.originOffset[a], offset[a]));
                if (!matches) agreeing = 0;
                else agreeing = sameOffset ? agreeing + 1 : 1;
                previousOffset = { ...s.originOffset };
                if (agreeing >= 2) return s;
            }
            await io.wait(100);
        }
        throw new Error('Timed out waiting for two fresh agreeing workspace readbacks; do not assume the origin was set.');
    };
    try {
        io.guard();
        const start = io.snapshot();
        assertWorkspaceSnapshot(start);
        if (!unchangedPose(plan, start) || !AXES.every((a) => near(start.originOffset[a], plan.originOffsetAtStaging[a]))) {
            throw new Error('Position, B or current offset changed since approval was staged; restage the workspace job.');
        }
        io.invalidateApprovals();
        selectionAttempted = true;
        await send('G21\nG53;');
        const selection = await send(`${plan.workspace};\nM114`);
        // G53 forces a change, so an actual supported selection must echo its index.
        const matches = [...String(selection.text || '').matchAll(/Select workspace\s+(\d+)/gi)];
        if (!matches.length || Number(matches[matches.length - 1][1]) !== plan.index) {
            throw new Error(`Firmware did not acknowledge ${plan.workspace} (workspace ${plan.index}); no origin write sent.`);
        }
        selected = true;
        before = await readback(io.now(), null);
        if (!plan.workAtWrite || !plan.originMachine) {
            return {
                workspace: plan.workspace,
                verified: true,
                origin_written: false,
                machine: before.machine,
                work: before.work,
                origin_offset: before.originOffset,
                motion: false,
            };
        }
        // Recheck immediately before the only write, after selection has settled.
        io.guard();
        if (!unchangedPose(plan, io.snapshot())) throw new Error('Machine pose changed before G92; no origin write sent.');
        const workAtWrite = plan.workAtWrite;
        const originMachine = plan.originMachine;
        const words = AXES.map((a) => `${a.toUpperCase()}${workAtWrite[a].toFixed(3)}`).join(' ');
        writeAttempted = true;
        await send(`G92 ${words}\nM114`);
        const expected = Object.fromEntries(AXES.map((a) => [a, -originMachine[a]])) as unknown as Xyz;
        const after = await readback(io.now(), expected);
        return {
            workspace: plan.workspace,
            verified: true,
            origin_written: true,
            origin_machine: plan.originMachine,
            origin_offset_before: before.originOffset,
            origin_offset_after: after.originOffset,
            machine: after.machine,
            work: after.work,
            b: after.b,
            datum_reference: plan.datumReference,
            motion: false,
        };
    } catch (err) {
        throw new WorkspaceUpdateError((err as Error).message, {
            workspace_requested: plan.workspace,
            selection_attempted: selectionAttempted,
            selection_acknowledged: selected,
            origin_write_attempted: writeAttempted,
            verified: false,
            motion: false,
            origin_offset_before: before?.originOffset || null,
            recovery: 'No recovery motion or automatic origin rollback was sent. Inspect/reselect the work frame and verify offsets before other jobs; restage after resolving the failure.',
        });
    } finally {
        // Jobs can be staged while a runner awaits readback. Their review may contain
        // an intermediate offset, so invalidate those as well, on success or failure.
        if (selectionAttempted) io.invalidateApprovals();
    }
}

export interface FileWorkspaceVerification {
    workspace: Workspace;
    verified: true;
    /** The selection changed the offset: another workspace was active before it. */
    selectionChanged: boolean;
    originOffset: Xyz;
    originOffsetZAtStaging: number;
    motion: false;
}

/**
 * Called by start_gcode_job, after approval and before streaming, for a file whose
 * machine Z extents were resolved assuming `workspace` (validator machineZResolvedFor).
 * The heartbeat names no workspace, so the staging offset is only proven to be that
 * workspace's offset once it is selected (acknowledged, two agreeing readbacks) and
 * its Z matches. No axis motion and no G92. A mismatch refuses the start; the named
 * workspace then stays selected, which is what the file would have selected anyway.
 */
export async function verifyWorkspaceForFile(workspace: Workspace, originOffsetZAtStaging: number, io: WorkspaceIo): Promise<FileWorkspaceVerification> {
    const before = io.snapshot();
    let plan: WorkspacePlan;
    try {
        plan = planWorkspace({ workspace, reason: `verify ${workspace} before streaming a file job` }, before, false);
    } catch (err) {
        throw new WorkspaceUpdateError(`Cannot verify ${workspace} before streaming: ${(err as Error).message}`, {
            workspace_requested: workspace, selection_attempted: false, verified: false, motion: false,
        });
    }
    const changedFrom = (offset: Xyz) => !AXES.every((a) => Math.abs(offset[a] - before.originOffset[a]) <= POSITION_EPSILON_MM);
    let result: { origin_offset: Xyz };
    try {
        // Invalidation is decided below: re-selecting the workspace that is already
        // active changes nothing another staged job depends on.
        result = await runWorkspace(plan, { ...io, invalidateApprovals: () => undefined }) as { origin_offset: Xyz };
    } catch (err) {
        const partial = (err as WorkspaceUpdateError).partial as { selection_attempted?: boolean } | undefined;
        if (partial?.selection_attempted) io.invalidateApprovals();
        throw err;
    }
    const selectionChanged = changedFrom(result.origin_offset);
    if (selectionChanged) io.invalidateApprovals();
    if (Math.abs(result.origin_offset.z - originOffsetZAtStaging) > POSITION_EPSILON_MM) {
        throw new WorkspaceUpdateError(`${workspace} origin offset Z ${result.origin_offset.z} does not match the offset Z ${originOffsetZAtStaging} `
            + `the confirm page resolved machine Z with, so its machine Z extents were not ${workspace}'s. Nothing was streamed; `
            + `${workspace} is now selected. Verify ${workspace}'s origin and tool reference, then restage for a fresh approval.`, {
            workspace_requested: workspace,
            selection_attempted: true,
            selection_acknowledged: true,
            selection_changed: selectionChanged,
            verified: false,
            origin_offset: result.origin_offset,
            origin_offset_z_at_staging: originOffsetZAtStaging,
            motion: false,
        });
    }
    return { workspace, verified: true, selectionChanged, originOffset: result.origin_offset, originOffsetZAtStaging, motion: false };
}
