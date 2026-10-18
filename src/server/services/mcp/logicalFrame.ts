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
//       (M112, M410, M18, M84 - the steppers released).
// Anything else refuses with the reason, so the agent can say what to do.
// A machine WITH workspaces (an A350 or a Ray on plain-text USB) is always
// refused: its M114 is in the selected work workspace and nothing reported
// over this transport maps it to machine coordinates.
//
// Pure: no server imports, unit-tested in tests/logicalFrame.test.ts.
import { GcodeDialect } from './gcodeDialect';

export interface WrittenLineEvidence {
    line: string;
    at: number;
}

/** Structural copy of TextSerialFrameEvidence (machine/channels/textSerialMachineState.ts). */
export interface LogicalFrameEvidence {
    homedAt: number | null;
    homeLine: string | null;
    homePending: WrittenLineEvidence | null;
    shift: WrittenLineEvidence | null;
    persistentShift: WrittenLineEvidence | null;
    lost: WrittenLineEvidence | null;
}

export interface LogicalFrameTrust {
    /** The logical position IS the machine position on this connection right now. */
    trusted: boolean;
    /** A full home was observed complete on this connection and nothing since may have lost it (isHomed for the MCP). */
    homed: boolean;
    /** Why, in the agent's and operator's terms; the refusal text when not trusted. */
    reason: string;
}

function when(at: number): string {
    return new Date(at).toISOString();
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
    return {
        homedAt: typeof source.homedAt === 'number' ? source.homedAt : null,
        homeLine: typeof source.homeLine === 'string' ? source.homeLine : null,
        homePending: written(source.homePending),
        shift: written(source.shift),
        persistentShift: written(source.persistentShift),
        lost: written(source.lost),
    };
}

/** Decide (a)-(c) above for the connected dialect. */
export function judgeLogicalFrame(dialect: GcodeDialect, evidence: LogicalFrameEvidence | null): LogicalFrameTrust {
    const homed = !!evidence && evidence.homedAt !== null;
    if (dialect.id === 'unknown' || dialect.frames.workspaces.length > 0 || dialect.frames.g53 !== 'none') {
        return {
            trusted: false,
            homed,
            reason: `The ${dialect.label} reports M114 in its selected work workspace over USB text serial, and nothing on this `
                + 'transport maps that to machine coordinates, so motion over it is not supported. Connect it over its network '
                + 'or SACP transport for MCP motion.',
        };
    }
    const name = `the ${dialect.label}`;
    if (!evidence) {
        return { trusted: false, homed: false, reason: `No write-path evidence for ${name} on this connection yet; home it with the MCP home tool.` };
    }
    if (evidence.persistentShift) {
        return {
            trusted: false,
            homed,
            reason: `A ${evidence.persistentShift.line} was written to ${name} at ${when(evidence.persistentShift.at)}: it changes the `
                + 'home offset, which homing does not clear, so the logical position cannot be taken as machine coordinates on this '
                + 'connection. Reconnect the machine (the controller resets), then home it with the MCP home tool.',
        };
    }
    if (evidence.homedAt === null) {
        if (evidence.lost) {
            return {
                trusted: false,
                homed: false,
                reason: `Home ${name} first: the position may have been lost after ${evidence.lost.line} at ${when(evidence.lost.at)} `
                    + '(emergency stop, quick stop or steppers released). Home it with the MCP home tool.',
            };
        }
        if (evidence.homePending) {
            return {
                trusted: false,
                homed: false,
                reason: `Homing ${name} (${evidence.homePending.line} written at ${when(evidence.homePending.at)}); waiting for the first `
                    + 'position report taken after it.',
            };
        }
        return {
            trusted: false,
            homed: false,
            reason: `Home ${name} first: the position shift is unknown since connect${evidence.shift
                ? ` (and a ${evidence.shift.line} was written at ${when(evidence.shift.at)})` : ''}. Its M114 reports the logical position, `
                + 'which equals machine coordinates only after a G28 with no G92 since. Home it with the MCP home tool.',
        };
    }
    if (evidence.shift) {
        return {
            trusted: false,
            homed: true,
            reason: `Home ${name} first: a ${evidence.shift.line} was written at ${when(evidence.shift.at)} after the home, so the logical `
                + 'position is shifted by an amount the MCP cannot read (Luban\'s set-work-origin sends G92; its Home button sends '
                + 'G53/G28/G54 - home with the MCP home tool, which sends G28 alone).',
        };
    }
    return {
        trusted: true,
        homed: true,
        reason: `Logical = machine on ${name}: homed (${evidence.homeLine || 'G28'}) at ${when(evidence.homedAt)} on this connection, `
            + 'no position shift written since; it has no workspaces.',
    };
}
