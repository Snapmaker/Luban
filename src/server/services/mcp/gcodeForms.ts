// The G-code FORMS the MCP's generic motion emits, per machine dialect
// (multi-machine overhaul tyeth/Luban#265, plan 2.4 and amendment R6).
//
// Until this module every generic motion tool wrote the Snapmaker 2.0 form -
// own-line `G53;` / `G54;` around an absolute move - and #264 bolted the Ray's
// relative jog beside it as a literal. The dialect row (gcodeDialect.ts)
// decides instead:
//   - transportForm 'sm2': absolute steps in the declared frame, byte-identical
//     to what the A350 has always received;
//   - transportForm 'relative-steps' (Ray, Original, J1): `G91 / G1 dX dY [dZ]
//     F / G90` with a `; mcp-settle machine` comment naming the absolute machine
//     endpoint, so the direct runner verifies arrival against the position of
//     record - frame-independent, the only form safe where G53 is unverified
//     or absent. NEVER a G53 or G54 on these machines;
//   - transportForm 'none' (a machine the table does not list): nothing.
//
// Generic motion DISPATCHES here; CNC procedures (probing, tool setter,
// workspaces) keep their SM2 descriptions and GATE instead (WP4b).
//
// Pure: no server imports, unit-tested in tests/gcodeForms.test.ts.
import { GcodeDialect } from './gcodeDialect';
import { HomeCommand, HomeCommandInput, homeCommandFor } from './machineCapability';

export type GcodeForm = 'sm2' | 'relative-steps';

export class GcodeFormError extends Error {
    public constructor(message: string) {
        super(message);
        // Checked by name at the tool boundary: instanceof is unreliable across the bundle.
        this.name = 'GcodeFormError';
    }
}

function notInTable(dialect: GcodeDialect): string {
    return `the ${dialect.label} is not in this MCP's G-code dialect table, so the MCP emits nothing on it `
        + `(source: ${dialect.sources.join('; ')})`;
}

/** The form generic motion takes on this dialect; throws on a machine the MCP emits nothing on. */
export function gcodeFormOf(dialect: GcodeDialect): GcodeForm {
    if (dialect.transportForm === 'none') {
        throw new GcodeFormError(notInTable(dialect));
    }
    return dialect.transportForm;
}

/**
 * A printer-only dialect: no laser and no spindle words (the J1). The MCP
 * drives no generic motion there - it has no toolhead to position for a
 * procedure - and homing is the one thing it does.
 */
export function isPrinterOnly(dialect: GcodeDialect): boolean {
    return dialect.id !== 'unknown' && dialect.laser === null && dialect.spindle === null;
}

/** Why generic motion is refused on this dialect, or null when it is allowed. Names the machine. */
export function genericMotionRefusal(dialect: GcodeDialect, action: string): string | null {
    if (dialect.transportForm === 'none') {
        return `Refusing ${action}: ${notInTable(dialect)}.`;
    }
    if (isPrinterOnly(dialect)) {
        return `Refusing ${action}: the ${dialect.label} is a printer (no laser or CNC words in its dialect), and this MCP drives `
            + 'no motion on it except home. Use Luban\'s own controls or a print file for it.';
    }
    return null;
}

export interface FrameMoveOptions {
    /** 'G1' (default) or 'G0' - the direct camera nudge has always used G0. */
    command?: 'G0' | 'G1';
    /** Lead with `G90` (default true). The direct camera nudge never has. */
    declareDistance?: boolean;
}

function requireSm2(dialect: GcodeDialect, what: string): void {
    if (gcodeFormOf(dialect) !== 'sm2') {
        throw new GcodeFormError(`${what} is the Snapmaker 2.0 form (own-line G53/G54); the ${dialect.label} takes relative steps `
            + 'and never receives a G53 or G54 from this MCP');
    }
}

/**
 * An absolute MACHINE-frame move: `G90 / G53; / G1 <words> F<feed>; / G54;` -
 * own-line G53 (the A350 ignored an inline one), and the work workspace handed
 * back on its own line. sm2 only: every other dialect takes relativeStep.
 */
export function machineFrameMove(dialect: GcodeDialect, words: string, feed: number, options: FrameMoveOptions = {}): string {
    requireSm2(dialect, 'A machine-frame (G53) move');
    const lead = options.declareDistance === false ? [] : ['G90'];
    return [...lead, 'G53;', `${options.command || 'G1'} ${words} F${feed};`, 'G54;'].join('\n');
}

/**
 * An absolute WORK-frame move with the workspace declared explicitly:
 * `G90 / G54; / G1 <words> F<feed>` (operator law 2026-09-14: every MCP motion
 * declares its frame). sm2 only.
 */
export function workFrameMove(dialect: GcodeDialect, words: string, feed: number, options: FrameMoveOptions = {}): string {
    requireSm2(dialect, 'A work-frame (G54) move');
    const lead = options.declareDistance === false ? [] : ['G90'];
    return [...lead, 'G54;', `${options.command || 'G1'} ${words} F${feed}`].join('\n');
}

// ---- Relative steps and their settle comment ---------------------------------

/** The comment a relative step carries so the settle check knows the absolute machine endpoint. Stripped before sending. */
export const SETTLE_COMMENT_PREFIX = '; mcp-settle machine';

/** `; mcp-settle machine X.. Y..` plus ` Z..` when the step moves Z (a machine with no Z never gets one). */
export function settleComment(to: { x: number; y: number; z?: number | null }): string {
    const z = to.z === undefined || to.z === null ? '' : ` Z${to.z.toFixed(3)}`;
    return `${SETTLE_COMMENT_PREFIX} X${to.x.toFixed(3)} Y${to.y.toFixed(3)}${z}`;
}

/** The absolute machine endpoint a relative step declared ({x, y} or {x, y, z}), or null when the text carries none. */
export function parseSettleComment(gcode: string): { x: number; y: number; z?: number } | null {
    const m = gcode.match(/^; mcp-settle machine X(-?\d+(?:\.\d+)?) Y(-?\d+(?:\.\d+)?)(?: Z(-?\d+(?:\.\d+)?))?\s*$/m);
    if (!m) {
        return null;
    }
    return m[3] === undefined ? { x: Number(m[1]), y: Number(m[2]) } : { x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) };
}

/**
 * The planner sync a Marlin text-serial machine needs after a relative step
 * (the Original). Its M114 reports the planner's QUEUED target, not where the
 * head is, so without a sync the next report shows the endpoint while the
 * head is still travelling. `G4 P0` waits for the planner to empty (Marlin
 * synchronises before any dwell) and is in the Original's code list; the
 * text-serial state marks an M114 written after it as a resting report
 * (textSerialMachineState.ts) and only such a report verifies the step.
 */
export const PLANNER_SYNC = 'G4 P0';

/** Whether this dialect's relative steps end with PLANNER_SYNC: Marlin machines reporting through M114 (not GRBL's realtime `?`). */
export function needsPlannerSync(dialect: GcodeDialect): boolean {
    return dialect.family === 'marlin' && dialect.status === 'M114' && dialect.transportForm === 'relative-steps';
}

export interface RelativeStepEnds {
    from: { x: number; y: number; z?: number | null };
    to: { x: number; y: number; z?: number | null };
}

export interface RelativeStepOptions {
    command?: 'G0' | 'G1';
    /** Lines written after the settle comment and before G91 (relativeStep's laser-off line). */
    lead?: readonly string[];
    /** Write the settle comment (default true). The direct camera nudge verifies against its own target instead. */
    settle?: boolean;
    /** Append PLANNER_SYNC (relativeStep defaults it from the dialect). */
    plannerSync?: boolean;
}

/**
 * The relative step itself, dialect-free (the Ray's #264 form is pinned byte
 * for byte): `<settle>\nG91\nG1 X.. Y.. [Z..] F..\nG90`. X and Y are always
 * written (the delta may be 0.000); Z only when both ends name one - a machine
 * with no Z axis never sees a Z word.
 */
export function relativeStepText(ends: RelativeStepEnds, feed: number, options: RelativeStepOptions = {}): string {
    const f3 = (n: number) => n.toFixed(3);
    const { from, to } = ends;
    const hasZ = from.z !== undefined && from.z !== null && to.z !== undefined && to.z !== null;
    const zWord = hasZ ? ` Z${f3((to.z as number) - (from.z as number))}` : '';
    const lines = [
        ...(options.settle === false ? [] : [settleComment(hasZ ? to : { x: to.x, y: to.y })]),
        ...(options.lead || []),
        'G91',
        `${options.command || 'G1'} X${f3(to.x - from.x)} Y${f3(to.y - from.y)}${zWord} F${feed}`,
        'G90',
        ...(options.plannerSync ? [PLANNER_SYNC] : []),
    ];
    return lines.join('\n');
}

/**
 * The laser-disable line(s) MCP motion leads with on this dialect: `M5` where
 * the toolhead state cannot be read back (the Ray, gcodeDialect.ts
 * ToolheadReadback), nothing elsewhere - the A350's and the Original's motion
 * stays byte-identical.
 */
export function laserOffLead(dialect: GcodeDialect): string[] {
    return dialect.toolhead.state === 'unknown' && dialect.toolhead.laserOff ? [dialect.toolhead.laserOff] : [];
}

/**
 * A relative step on a relative-steps dialect (Ray, Original): the delta from
 * the planned previous endpoint, the absolute machine endpoint in the settle
 * comment, G90 restored, and on a Marlin M114 machine the planner sync. On a
 * dialect whose toolhead state is unknown (the Ray) EVERY step leads with the
 * laser-off line: each approved step is its own send, and a laser started
 * from Luban's UI between two steps would otherwise ride the next one.
 * `laserOff: false` is for a body that manages its own M3/M5 (laserPlan.ts).
 * Refuses an sm2 dialect (it has its own absolute form) and a Z step on a
 * machine the caller says has no Z.
 */
export function relativeStep(dialect: GcodeDialect, ends: RelativeStepEnds, feed: number,
    options: RelativeStepOptions & { hasZ?: boolean; laserOff?: boolean } = {}): string {
    if (gcodeFormOf(dialect) !== 'relative-steps') {
        throw new GcodeFormError(`the ${dialect.label} takes absolute steps in its declared frame, not relative steps`);
    }
    const movesZ = ends.to.z !== undefined && ends.to.z !== null;
    if (movesZ && options.hasZ === false) {
        throw new GcodeFormError(`the connected ${dialect.label} machine has no Z axis: a relative step never carries a Z word there`);
    }
    return relativeStepText(ends, feed, {
        ...options,
        lead: [...(options.laserOff === false ? [] : laserOffLead(dialect)), ...(options.lead || [])],
        plannerSync: options.plannerSync === undefined ? needsPlannerSync(dialect) : options.plannerSync,
    });
}

// ---- Frame restore and home ------------------------------------------------

/**
 * The no-motion program that hands the work frame back. sm2: `G90` then `G54;`
 * on its own line (frameRecovery.ts WORK_FRAME_RESTORE_GCODE, unchanged).
 * Every other dialect: `G90` alone - Luban never selects a workspace on the
 * Ray (its jog and origin flows send no G54), and the Original and J1 have
 * none documented. Deliberately no axis word.
 */
export function workFrameRestore(dialect: GcodeDialect): string {
    return gcodeFormOf(dialect) === 'sm2' ? 'G90\nG54;' : 'G90';
}

/** workFrameRestore as separate commands, without the trailing `;` (failureRecovery.ts sends each on its own). */
export function workFrameRestoreCommands(dialect: GcodeDialect): string[] {
    return gcodeFormOf(dialect) === 'sm2' ? ['G90', 'G54'] : ['G90'];
}

/**
 * How the connected machine is homed. The Snapmaker 2.0, the Ray and the SACP
 * machines keep homeCommandFor's transport decision exactly (G53;G28;G54 /
 * $H / the SACP request). A Marlin dialect with no workspaces - the Original -
 * homes on its row's own `G28` ALONE: amendment R6, never G53/G54 there
 * (homeCommandFor used to send G53;G28;G54 to every non-SACP machine).
 */
export function homeSequence(dialect: GcodeDialect, input: HomeCommandInput): HomeCommand {
    gcodeFormOf(dialect);
    if (dialect.home.form === 'G28' && dialect.frames.g53 === 'none' && dialect.home.gcode && input.canExecuteGcode) {
        return {
            kind: 'g28-only',
            gcode: dialect.home.gcode,
            label: dialect.home.gcode,
            reason: `the ${dialect.label} has no workspaces: it homes on ${dialect.home.gcode} alone, never with G53/G54 around it`,
        };
    }
    const command = homeCommandFor(input);
    // G53;G28;G54 is the Snapmaker 2.0 form. Any other machine whose transport
    // offers neither its own home ($H, the SACP request) - a Ray or a J1 on
    // plain-text USB - is refused rather than sent it (on GRBL, G28 moves to a
    // stored position; it does not home).
    if (command.kind === 'g28-sequence' && gcodeFormOf(dialect) !== 'sm2') {
        throw new GcodeFormError(`the ${dialect.label} cannot be homed over this transport: its home is ${dialect.home.form}, and the `
            + 'Snapmaker 2.0 G53;G28;G54 sequence is never sent to it. Connect it over its own transport (SACP) to home it');
    }
    // Where the toolhead state is unknown (the Ray) the laser-off line goes
    // out as its OWN payload before the home: `$H` stays the exact string
    // observed homing the Ray (2026-10-18), never a second line of a payload.
    const lead = laserOffLead(dialect);
    return lead.length && input.canExecuteGcode ? { ...command, laserOff: lead.join('\n') } : command;
}
