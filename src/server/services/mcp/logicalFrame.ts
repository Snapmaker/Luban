// When the LOGICAL position a text-serial Marlin controller reports may be
// taken as the MACHINE position (WP4a, tyeth/Luban#265).
//
// Over USB text serial the position comes from M114, which reports Marlin's
// logical position: the machine position shifted by G92 (and on a Snapmaker
// 2.0 by the selected work origin). WPC made the judge refuse every such beat.
// On a machine with NO workspaces - the Original, whose dialect row lists none
// - logical equals machine exactly when no shift is in force, and that is
// decidable from what was WRITTEN to the port on this connection
// (machine/channels/textSerialMachineState.ts frameEvidence):
//   (a) a full G28 completed on this connection generation, observed - an M114
//       written after it was answered (MarlinController's own isHomed is set
//       when a G28 is SENT, and is never used for this);
//   (b) no G92 / G53 / G54-G59.x written since that G28, and no M206 / M428 /
//       M501 / M502 (home offsets, which homing does not clear) on this
//       connection at all;
//   (c) nothing written since that G28 after which the position may be lost
//       (M112, M410, a bare M18 / M84 - the steppers released), and the
//       steppers not idle past their inactivity timeout (below).
//
// The Snapmaker 2.0 (the A350) over USB (#265 follow-up): its M114 is in the
// selected workspace. Marlin: logical = native + home_offset + position_shift,
// and M1007 prints position_shift when "Selected == Current: YES"
// (Snapmaker2-Controller snapmaker/src/gcode/M1005_1007.cpp), so
//   machine = logical - M1007 offset
// - the same `work - originOffset` Luban's own A/B-position buttons compute
// from these two reports (ui/widgets/ConnectionControl/ABPositionButtonGroup)
// and the SSTP/SACP channels hand the judge. It is trusted only when:
//   (a) as above (the MCP home is Luban's G53;G28;G54);
//   (b) the M1007 reply AND the M114 reply both answer writes made after the
//       last G92 / G53 / G54-G59.x / G28 line, the reply says "Selected ==
//       Current: YES", and its workspace is the one last selected;
//   (c) the reply's stepper Count agrees: Count / steps-per-mm minus the
//       constant learnt at the first resting report after the home equals
//       logical - offset within POSITION_EPSILON_MM on X, Y and Z. That
//       constant is native - machine = -home_offset (A350: 19, 4, 0 mm,
//       measured 2026-10-05), so the check holds across every later shift and
//       catches what the write path cannot see: an origin set from the
//       touchscreen, and a report taken mid-move (M114 is the planner's queued
//       target, Count is the steppers).
// Every other dialect with workspaces (Ray, Artisan over USB) stays refused.
//
// Stepper idle (the Original, #265 follow-up): Marlin releases the steppers
// after DEFAULT_STEPPER_DEACTIVE_TIME without motion when DISABLE_INACTIVE_X/
// Y/Z are true (Marlin 1.1.x Configuration_adv.h: 120 s, all true;
// Marlin_main.cpp manage_inactivity restarts the clock while blocks are
// queued), and the gantry can then be pushed by hand. The Original's own
// firmware source is not published, so its value is unknown: the policy
// default is that upstream number, labelled as such (procedureLimits.ts
// STEPPER_IDLE_TIMEOUT_S). Snapmaker2-Controller sets DISABLE_INACTIVE_X/Y/Z
// false, so the A350 never releases on idle and is not judged here.
//
// Pure: no server imports, unit-tested in tests/logicalFrame.test.ts and
// tests/usbPosition.test.ts.
import { GcodeDialect } from './gcodeDialect';
import { POSITION_EPSILON_MM } from './envelopeChecks';
import { STEPPER_IDLE_EPSILON_MS } from '../machine/channels/textSerialMachineState';

export interface WrittenLineEvidence {
    line: string;
    at: number;
}

interface XyzNumbers {
    x: number;
    y: number;
    z: number;
}

export interface WorkOffsetEvidence extends XyzNumbers {
    selectedOrigin: number | null;
    selectedEqualsCurrent: boolean | null;
    at: number;
    writtenAt: number | null;
    staleBecause: WrittenLineEvidence | null;
}

export interface IdleEvidence {
    lastActivityAt: number | null;
    writtenTimeout: (WrittenLineEvidence & { seconds: number }) | null;
    longestUnwrittenGapMs: number;
    expired: WrittenLineEvidence | null;
}

/** Structural copy of TextSerialFrameEvidence (machine/channels/textSerialMachineState.ts). */
export interface LogicalFrameEvidence {
    homedAt: number | null;
    homeLine: string | null;
    homePending: WrittenLineEvidence | null;
    shift: WrittenLineEvidence | null;
    persistentShift: WrittenLineEvidence | null;
    lost: WrittenLineEvidence | null;
    workOffset: WorkOffsetEvidence | null;
    lastSelect: (WrittenLineEvidence & { origin: number }) | null;
    reportStaleBecause: WrittenLineEvidence | null;
    countAnchor: { counts: XyzNumbers; pos: XyzNumbers; offset: XyzNumbers; at: number } | null;
    idle: IdleEvidence | null;
}

/** The report being judged: M114 X/Y/Z and its Count tail (TextSerialMachineState pos / counts). */
export interface LogicalFrameReport {
    pos: { x: number | null; y: number | null; z: number | null } | null;
    counts: { x: number | null; y: number | null; z: number | null } | null;
}

export interface LogicalFrameContext {
    now: number;
    report?: LogicalFrameReport | null;
    /** The machine's stepper idle timeout from its policy (stated or default) - the Original only. */
    stepperIdleTimeout?: { seconds: number; source: string } | null;
}

export interface StepperIdleStatus {
    /** The timeout in force: written M18/M84 S on this connection, else the policy. Null = never (M84 S0). */
    timeoutS: number | null;
    source: string;
    /** Seconds since the last motion written or reported; null before a home. */
    idleS: number | null;
    /** Seconds until the home is treated as lost (STEPPER_IDLE_EPSILON_MS early); null = never, 0 = lost. */
    remainingS: number | null;
}

export interface LogicalFrameTrust {
    /**
     * The logical frame CAN be the machine frame on this machine: the
     * Original (no workspaces) or a Snapmaker 2.0 (through its M1007 work
     * offset). false on a Ray or an Artisan over USB text serial - nothing
     * reported there maps it, and the MCP does not home them over it either.
     */
    mappable: boolean;
    /** How: 'identity' (logical = machine, the Original), 'work-offset' (machine = logical - M1007 offset), null when not mappable. */
    mapping: 'identity' | 'work-offset' | null;
    /** The logical position maps to the machine position on this connection right now. */
    trusted: boolean;
    /** A full home was observed complete on this connection and nothing since may have lost it (isHomed for the MCP). */
    homed: boolean;
    /** What the judge subtracts (machine = logical - offset) when trusted; zero for 'identity'; null otherwise. */
    offset: XyzNumbers | null;
    /**
     * 'work-offset' only: the report's Count agrees with logical - offset, so
     * the steppers are AT the planner's target (motion has finished). Null
     * for 'identity', which uses the planner-sync evidence (reportAtRest).
     */
    atRest: boolean | null;
    /** The Original's stepper idle state; null on every other machine. */
    stepperIdle: StepperIdleStatus | null;
    /** Why, in the agent's and operator's terms; the refusal text when not trusted. */
    reason: string;
}

/**
 * Stepper counts per mm on the Count tail, per dialect. Snapmaker 2.0:
 * Snapmaker2-Controller Marlin/Configuration.h DEFAULT_AXIS_STEPS_PER_UNIT
 * {400, 400, 400}, measured on the A350 (Count / 400 = machine + (19, 4, 0),
 * 2026-10-05). The firmware re-reads it from the linear modules' lead at boot
 * (snapmaker/src/module/linear.cpp): 2.5-generation modules have a 20 mm lead
 * on X/Y, which would disagree after the first move and refuse - never a
 * wrong position, since (c) only ever refuses.
 */
export const COUNT_STEPS_PER_MM: { [dialectId: string]: XyzNumbers } = {
    'sm2-marlin': { x: 400, y: 400, z: 400 },
};

function when(at: number): string {
    return new Date(at).toISOString();
}

function n3(value: number): string {
    return String(Number(value.toFixed(3)));
}

function xyz(p: XyzNumbers): string {
    return `(${n3(p.x)}, ${n3(p.y)}, ${n3(p.z)})`;
}

function readXyz(value: unknown): XyzNumbers | null {
    const v = value as { x?: unknown; y?: unknown; z?: unknown } | null;
    if (!v || typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number') {
        return null;
    }
    return { x: v.x, y: v.y, z: v.z };
}

/** Read the channel's frameEvidence defensively (it is an untyped state field). */
export function readLogicalFrameEvidence(raw: unknown): LogicalFrameEvidence | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const source = raw as { [key: string]: unknown };
    const written = (value: unknown): WrittenLineEvidence | null => {
        const v = value as { line?: unknown; at?: unknown } | null;
        return v && typeof v.line === 'string' && typeof v.at === 'number' ? { line: v.line, at: v.at } : null;
    };
    const offsetRaw = source.workOffset as { [key: string]: unknown } | null | undefined;
    const offsetXyz = readXyz(offsetRaw);
    const workOffset: WorkOffsetEvidence | null = offsetRaw && offsetXyz && typeof offsetRaw.at === 'number' ? {
        ...offsetXyz,
        selectedOrigin: typeof offsetRaw.selectedOrigin === 'number' ? offsetRaw.selectedOrigin : null,
        selectedEqualsCurrent: typeof offsetRaw.selectedEqualsCurrent === 'boolean' ? offsetRaw.selectedEqualsCurrent : null,
        at: offsetRaw.at,
        writtenAt: typeof offsetRaw.writtenAt === 'number' ? offsetRaw.writtenAt : null,
        staleBecause: written(offsetRaw.staleBecause),
    } : null;
    const selectRaw = source.lastSelect as { origin?: unknown } | null | undefined;
    const selectLine = written(selectRaw);
    const lastSelect = selectLine && selectRaw && typeof selectRaw.origin === 'number' ? { ...selectLine, origin: selectRaw.origin } : null;
    const anchorRaw = source.countAnchor as { [key: string]: unknown } | null | undefined;
    const anchorParts = anchorRaw ? [readXyz(anchorRaw.counts), readXyz(anchorRaw.pos), readXyz(anchorRaw.offset)] : [];
    const countAnchor = anchorRaw && typeof anchorRaw.at === 'number' && anchorParts.every((part) => part !== null)
        ? { counts: anchorParts[0] as XyzNumbers, pos: anchorParts[1] as XyzNumbers, offset: anchorParts[2] as XyzNumbers, at: anchorRaw.at }
        : null;
    const idleRaw = source.idle as { [key: string]: unknown } | null | undefined;
    const timeoutRaw = idleRaw ? idleRaw.writtenTimeout as { seconds?: unknown } | null : null;
    const timeoutLine = written(timeoutRaw);
    const idle: IdleEvidence | null = idleRaw ? {
        lastActivityAt: typeof idleRaw.lastActivityAt === 'number' ? idleRaw.lastActivityAt : null,
        writtenTimeout: timeoutLine && timeoutRaw && typeof timeoutRaw.seconds === 'number' ? { ...timeoutLine, seconds: timeoutRaw.seconds } : null,
        longestUnwrittenGapMs: typeof idleRaw.longestUnwrittenGapMs === 'number' ? idleRaw.longestUnwrittenGapMs : 0,
        expired: written(idleRaw.expired),
    } : null;
    return {
        homedAt: typeof source.homedAt === 'number' ? source.homedAt : null,
        homeLine: typeof source.homeLine === 'string' ? source.homeLine : null,
        homePending: written(source.homePending),
        shift: written(source.shift),
        persistentShift: written(source.persistentShift),
        lost: written(source.lost),
        workOffset,
        lastSelect,
        reportStaleBecause: written(source.reportStaleBecause),
        countAnchor,
        idle,
    };
}

/**
 * The Original's stepper idle state, and the refusal when the home is lost
 * to it. Timeout in force: an M18/M84 S<n> written on this connection (the
 * firmware's own value from then on; S0 = never), else the policy. Gaps
 * closed while no timeout had been written are judged against the policy;
 * gaps under a written timeout were judged by the tracker (`expired`).
 */
export function judgeStepperIdle(evidence: LogicalFrameEvidence, context: LogicalFrameContext): { status: StepperIdleStatus; lost: string | null } {
    const policy = context.stepperIdleTimeout || null;
    const idle = evidence.idle;
    const written = idle ? idle.writtenTimeout : null;
    let timeoutS: number | null = policy ? policy.seconds : null;
    let source = policy ? policy.source : 'no timeout known';
    if (written) {
        timeoutS = written.seconds > 0 ? written.seconds : null;
        source = `${written.line} written at ${when(written.at)}${written.seconds === 0 ? ' (S0: never released)' : ''}`;
    }
    const idleMs = idle && idle.lastActivityAt !== null ? Math.max(0, context.now - idle.lastActivityAt) : null;
    const lostText = (seconds: number, idleS: number, detail: string) => 'The Original\'s steppers may have been released after '
        + `${seconds} s idle; home again. (${detail}; idle ${idleS} s - the gantry can be moved by hand once they are, so the home `
        + 'no longer holds. Home it with the MCP home tool; M84 S0 from the console keeps them powered.)';
    let lost: string | null = null;
    if (idle && idle.expired) {
        const seconds = /\bS\s*(\d+(?:\.\d+)?)/i.exec(idle.expired.line);
        lost = `The Original's steppers may have been released after ${seconds ? Number(seconds[1]) : '?'} s idle; home again. `
            + `(The timeout written on this connection ran out: ${idle.expired.line}. Home it with the MCP home tool; M84 S0 from the `
            + 'console keeps them powered.)';
    } else if (idle && policy && idle.longestUnwrittenGapMs >= policy.seconds * 1000 - STEPPER_IDLE_EPSILON_MS) {
        lost = lostText(policy.seconds, Math.round(idle.longestUnwrittenGapMs / 1000), `timeout ${policy.seconds} s from ${policy.source}`);
    } else if (idleMs !== null && timeoutS !== null && idleMs >= timeoutS * 1000 - STEPPER_IDLE_EPSILON_MS) {
        lost = lostText(timeoutS, Math.round(idleMs / 1000), `timeout ${timeoutS} s from ${source}`);
    }
    let remainingS: number | null = null;
    if (lost) {
        remainingS = 0;
    } else if (timeoutS !== null && idleMs !== null) {
        remainingS = Math.max(0, Math.floor((timeoutS * 1000 - STEPPER_IDLE_EPSILON_MS - idleMs) / 1000));
    }
    return {
        status: { timeoutS, source, idleS: idleMs === null ? null : Math.round(idleMs / 1000), remainingS },
        lost,
    };
}

function refused(mapping: LogicalFrameTrust['mapping'], homed: boolean, reason: string, stepperIdle: StepperIdleStatus | null = null,
    atRest: boolean | null = null): LogicalFrameTrust {
    return { mappable: mapping !== null, mapping, trusted: false, homed, offset: null, atRest, stepperIdle, reason };
}

/** The home part shared by both mappings: null when homed and nothing since lost it, else the refusal. */
function homeRefusal(mapping: 'identity' | 'work-offset', name: string, evidence: LogicalFrameEvidence | null,
    homeTool: string): LogicalFrameTrust | null {
    if (!evidence) {
        return refused(mapping, false, `No write-path evidence for ${name} on this connection yet; home it with the MCP home tool.`);
    }
    const homed = evidence.homedAt !== null;
    if (evidence.persistentShift) {
        return refused(mapping, homed, `A ${evidence.persistentShift.line} was written to ${name} at ${when(evidence.persistentShift.at)}: it `
            + 'changes the home offset, which homing does not clear, so the logical position cannot be taken as machine coordinates on '
            + 'this connection. Reconnect the machine (the controller resets), then home it with the MCP home tool.');
    }
    if (evidence.homedAt === null) {
        if (evidence.lost) {
            return refused(mapping, false, `Home ${name} first: the position may have been lost after ${evidence.lost.line} at `
                + `${when(evidence.lost.at)} (emergency stop, quick stop or steppers released). Home it with the MCP home tool.`);
        }
        if (evidence.homePending) {
            return refused(mapping, false, `Homing ${name} (${evidence.homePending.line} written at ${when(evidence.homePending.at)}); waiting `
                + 'for the first position report taken after it.');
        }
        return refused(mapping, false, `Home ${name} first: the position shift is unknown since connect${evidence.shift
            ? ` (and a ${evidence.shift.line} was written at ${when(evidence.shift.at)})` : ''}. Its M114 reports the logical position, `
            + `which ${homeTool}. Home it with the MCP home tool.`);
    }
    return null;
}

/** (a)-(c) for the Snapmaker 2.0 work-offset mapping (see the header). */
function judgeWorkOffset(dialect: GcodeDialect, evidence: LogicalFrameEvidence | null, context: LogicalFrameContext): LogicalFrameTrust {
    const name = `the ${dialect.label}`;
    const home = homeRefusal('work-offset', name, evidence, 'maps to machine coordinates only after an observed G53;G28;G54 home and a '
        + 'fresh M1007 work-offset report');
    if (home || !evidence) {
        return home as LogicalFrameTrust;
    }
    const wait = (why: string) => refused('work-offset', true, `${why} Luban polls M1007 and M114 every couple of seconds while `
        + 'it is idle; get_position again shortly. Until then no machine position is derived.');
    const offset = evidence.workOffset;
    if (!offset) {
        return wait(`Waiting for ${name}'s first M1007 work-offset report on this connection.`);
    }
    if (offset.writtenAt === null) {
        return wait('The last M1007 reply matched no outstanding write, so it cannot be placed after the last frame change.');
    }
    if (offset.staleBecause) {
        return wait(`Waiting for a fresh M1007 work-offset report: ${offset.staleBecause.line} was written at ${when(offset.staleBecause.at)} `
            + 'after the last one was requested, so it may describe another frame.');
    }
    if (offset.selectedEqualsCurrent !== true) {
        return refused('work-offset', true, `${name}'s M1007 says "Selected == Current: ${offset.selectedEqualsCurrent === false ? 'NO'
            : 'missing'}": the offset it prints is the stored workspace, not the shift in force, so the logical position cannot be mapped. `
            + 'Hand the work frame back (restore_work_frame: G90, G54) or home with the MCP home tool, then read get_position again.');
    }
    if (evidence.lastSelect && offset.selectedOrigin !== evidence.lastSelect.origin) {
        return refused('work-offset', true, `${name}'s M1007 reports workspace ${offset.selectedOrigin} selected, but ${evidence.lastSelect.line} `
            + `(workspace ${evidence.lastSelect.origin}) was the last select written at ${when(evidence.lastSelect.at)}: the two disagree, so `
            + 'nothing is mapped. Hand the work frame back (restore_work_frame) or home with the MCP home tool.');
    }
    if (evidence.reportStaleBecause) {
        return wait(`Waiting for a position report taken after ${evidence.reportStaleBecause.line}${evidence.reportStaleBecause.at
            ? ` (written at ${when(evidence.reportStaleBecause.at)})` : ''}: the last one is in the frame before it.`);
    }
    const spm = COUNT_STEPS_PER_MM[dialect.id];
    const report = context.report || null;
    const pos = report ? readXyz(report.pos) : null;
    const counts = report ? readXyz(report.counts) : null;
    if (!spm || !pos || !counts) {
        return refused('work-offset', true, `${name}'s M114 reply carries no complete X/Y/Z and Count tail${spm ? ''
            : ' (no steps-per-mm known for this dialect)'}, so the mapping cannot be cross-checked against the steppers; nothing is mapped.`);
    }
    const anchor = evidence.countAnchor;
    if (!anchor) {
        return wait('Waiting for the first resting position report after the home with a fresh work offset (the Count anchor of this home)'
            + ' - if motion was sent before it, home again with the MCP home tool.');
    }
    // native - machine: constant for the connection (-home_offset), learnt at the anchor.
    const k = {
        x: anchor.counts.x / spm.x - (anchor.pos.x - anchor.offset.x),
        y: anchor.counts.y / spm.y - (anchor.pos.y - anchor.offset.y),
        z: anchor.counts.z / spm.z - (anchor.pos.z - anchor.offset.z),
    };
    const fromOffset = { x: pos.x - offset.x, y: pos.y - offset.y, z: pos.z - offset.z };
    const fromCount = { x: counts.x / spm.x - k.x, y: counts.y / spm.y - k.y, z: counts.z / spm.z - k.z };
    const apart = (['x', 'y', 'z'] as const).filter((axis) => Math.abs(fromOffset[axis] - fromCount[axis]) > POSITION_EPSILON_MM);
    if (apart.length) {
        return refused('work-offset', true, `${name}: M114 minus the M1007 offset reads machine ${xyz(fromOffset)}, the stepper Count since `
            + `the post-home anchor reads ${xyz(fromCount)} - ${apart.join('/')} differ by more than ${POSITION_EPSILON_MM} mm. Either the head `
            + 'is still moving (M114 is the planner\'s queued target, Count is the steppers) or the work origin changed where the MCP cannot '
            + 'see it (touchscreen, another host). Waiting for a resting report; if it persists, hand the work frame back '
            + '(restore_work_frame) or home again.', null, false);
    }
    return {
        mappable: true,
        mapping: 'work-offset',
        trusted: true,
        homed: true,
        offset: { x: offset.x, y: offset.y, z: offset.z },
        atRest: true,
        stepperIdle: null,
        reason: `Machine = M114 - M1007 offset ${xyz(offset)} on ${name} (workspace ${offset.selectedOrigin}, Selected == Current: YES, `
            + `both read after the last frame change); the stepper Count agrees within ${POSITION_EPSILON_MM} mm. Homed `
            + `(${evidence.homeLine || 'G28'}) at ${when(evidence.homedAt as number)} on this connection.`,
    };
}

/** Decide (a)-(c) above for the connected dialect. */
export function judgeLogicalFrame(dialect: GcodeDialect, evidence: LogicalFrameEvidence | null,
    context: LogicalFrameContext = { now: Date.now() }): LogicalFrameTrust {
    const homed = !!evidence && evidence.homedAt !== null;
    if (COUNT_STEPS_PER_MM[dialect.id]) {
        return judgeWorkOffset(dialect, evidence, context);
    }
    if (dialect.id === 'unknown' || dialect.frames.workspaces.length > 0 || dialect.frames.g53 !== 'none') {
        return refused(null, homed, `The ${dialect.label} reports M114 in its selected work workspace over USB text serial, and nothing on `
            + 'this transport maps that to machine coordinates, so motion over it is not supported. Connect it over its network or SACP '
            + 'transport for MCP motion.');
    }
    const name = `the ${dialect.label}`;
    const home = homeRefusal('identity', name, evidence, 'equals machine coordinates only after a G28 with no G92 since');
    // The stepper idle timeout: the Original's firmware releases the steppers (see the header).
    const idle = dialect.id === 'original-marlin' && evidence && evidence.homedAt !== null ? judgeStepperIdle(evidence, context) : null;
    const stepperIdle = idle ? idle.status : null;
    if (home || !evidence) {
        return { ...(home as LogicalFrameTrust), stepperIdle };
    }
    if (idle && idle.lost) {
        return refused('identity', false, idle.lost, stepperIdle);
    }
    if (evidence.shift) {
        return refused('identity', true, `Home ${name} first: a ${evidence.shift.line} was written at ${when(evidence.shift.at)} after the `
            + 'home, so the logical position is shifted by an amount the MCP cannot read (Luban\'s set-work-origin sends G92; its Home '
            + 'button sends G53/G28/G54 - home with the MCP home tool, which sends G28 alone).', stepperIdle);
    }
    return {
        mappable: true,
        mapping: 'identity',
        trusted: true,
        homed: true,
        offset: { x: 0, y: 0, z: 0 },
        atRest: null,
        stepperIdle,
        reason: `Logical = machine on ${name}: homed (${evidence.homeLine || 'G28'}) at ${when(evidence.homedAt as number)} on this connection, `
            + 'no position shift written since; it has no workspaces.',
    };
}

/**
 * The MCP's idle/running notion from a channel state. SACP/SSTP states carry
 * `status` ('idle', 'running', ...). The USB text-serial state has none:
 * Marlin reports no motion state over M114, so its `workflowState` - Luban's
 * sender ('idle' | 'running' | 'paused': is a FILE streaming) - is mapped
 * explicitly, and anything else is unknown (null, which refuses).
 * `controllerHomed` and the like are never read as status.
 */
export function machineStatusOf(state: { [key: string]: unknown } | null): string | null {
    if (!state) {
        return null;
    }
    if (typeof state.status === 'string' && state.status) {
        return state.status;
    }
    if (state.positionFrame === 'logical') {
        const workflow = state.workflowState;
        if (workflow === 'idle' || workflow === 'running' || workflow === 'paused') {
            return workflow;
        }
    }
    return null;
}
