/* eslint-disable camelcase */
// Result keys are snake_case: they are serialised straight into tool results.
//
// The toolhead-on guards, and the MCP's own record of the laser words it sent
// (multi-machine overhaul tyeth/Luban#265; the Ray data map #315).
//
// Every motion path refuses while the toolhead reads ON (headPower > 0 or
// headStatus on). On the Snapmaker 2.0 and the Original those readings are
// real. On the Ray they never are: firmware V1.7.4 sets the laser power Luban
// reads (SACP 0x12 0xa1 / 0x12 0x01) to 0 at init and never writes it again,
// and nothing sets headStatus - so the guard always passed, whatever the laser
// was doing. The dialect row (gcodeDialect.ts ToolheadReadback) now says which
// machines report; where none is reported the reading is UNKNOWN, never "off",
// and the MCP leads its own motion with the laser-off line (gcodeForms.ts).
//
// The laser record is ADVISORY and covers only what THIS MCP sent on direct
// paths (sendGcodeVisible): a job started from Luban's UI or the phone app, a
// file job's own lines, and anything typed on the touchscreen are invisible
// to it. It never gates motion - a stale "on" would otherwise block the very
// M5-led step that clears it.
//
// Pure: no server imports, unit-tested in tests/toolheadState.test.ts.
import { GcodeDialect } from './gcodeDialect';

export type ToolheadReading = 'on' | 'off' | 'unknown';

export interface ToolheadAssessment {
    /** 'on': a reading says on. 'off': the machine reports, and nothing reads on. 'unknown': the machine never reports. */
    state: ToolheadReading;
    readback: 'reported' | 'unknown';
    head_power: number | null;
    head_status: boolean | string | null;
    basis: string;
    /** The line MCP motion leads with on this machine (the Ray's M5), or null. */
    laser_off_lead: string | null;
}

/** headPower / headStatus as the channel state carries them (SACP, SSTP, text serial). */
export interface HeadReadings {
    headPower?: unknown;
    headStatus?: unknown;
}

/**
 * Judge the toolhead from the connection state and the dialect row. The ON
 * test is the one every guard used before (a headPower above 0, or
 * headStatus true / 'on'), so a machine that reports refuses exactly as it
 * always has. Where the row says nothing is reported, a non-zero reading still
 * refuses (the firmware never writes it, so one would be a real signal); an
 * absent or zero reading is 'unknown'.
 */
export function assessToolhead(dialect: GcodeDialect, state: HeadReadings | null | undefined): ToolheadAssessment {
    const power = Number(state ? state.headPower : undefined);
    const status = state ? state.headStatus : undefined;
    // `power > 0` is false for NaN: the union of the old guards' tests (an infinite reading refuses).
    const on = power > 0 || status === true || status === 'on';
    const readback = dialect.toolhead.state;
    let reading: ToolheadReading = 'off';
    if (on) {
        reading = 'on';
    } else if (readback === 'unknown') {
        reading = 'unknown';
    }
    return {
        state: reading,
        readback,
        head_power: state && state.headPower !== undefined && state.headPower !== null && Number.isFinite(power) ? power : null,
        head_status: typeof status === 'boolean' || typeof status === 'string' ? status : null,
        basis: dialect.toolhead.basis,
        laser_off_lead: readback === 'unknown' ? dialect.toolhead.laserOff : null,
    };
}

/**
 * The refusal for `message` (each guard keeps its own wording) when the
 * toolhead reads on, else null. On a machine that does not report, the
 * refusal says the reading is not one the firmware is known to send.
 */
export function toolheadOnRefusal(assessment: ToolheadAssessment, message: string): string | null {
    if (assessment.state !== 'on') {
        return null;
    }
    if (assessment.readback === 'unknown') {
        return `${message} (headPower ${assessment.head_power}, headStatus ${JSON.stringify(assessment.head_status)} - on a machine whose `
            + `firmware is not known to report either: ${assessment.basis}. Check the laser before retrying.)`;
    }
    return message;
}

/** Strip `;` and `( )` comments, upper-case. */
function codeOf(line: string): string {
    return line.replace(/\(.*?\)/g, '').replace(/;.*$/, '').trim().toUpperCase();
}

/** The laser-off lead when `gcode`'s first executable line is it (the step led with M5), else null. */
export function laserOffSentIn(assessment: ToolheadAssessment, gcode: string): string | null {
    const lead = assessment.laser_off_lead;
    if (!lead) {
        return null;
    }
    const first = String(gcode).split(/\r?\n/).map(codeOf).find(Boolean);
    return first === lead.toUpperCase() ? lead : null;
}

// ---- The MCP's own laser words ----------------------------------------------

export type SendOutcome = 'pending' | 'accepted' | 'rejected' | 'indeterminate' | 'not-sent';

export interface McpLaserRecord {
    /**
     * From the MCP's own sends only. 'on': its last laser words left the laser
     * on (M3/M4 with S > 0, no M5 after). 'off': M5, S0 or a program end.
     * 'uncertain': a payload with laser words was not cleanly acknowledged, M3/M4
     * went out with no S the MCP knows, or the MCP started a file job.
     * 'none': nothing sent on this connection.
     */
    laser: 'on' | 'off' | 'uncertain' | 'none';
    /** The last mode word the MCP sent (M3, M4, M5, M2, M30), or null. */
    mode: string | null;
    /** The S the MCP last sent (GRBL S is modal), or null. */
    s: number | null;
    /** The payload line that last changed the record. */
    line: string | null;
    at: number | null;
    connection: string | null;
    note: string;
}

export const MCP_LASER_RECORD_SCOPE = 'MCP-sent only: the laser words THIS MCP sent on its direct paths, acknowledged by the controller '
    + '(on SACP an acknowledgement precedes execution). A job started from Luban\'s UI or the phone app, a file job\'s own lines and '
    + 'anything from the touchscreen are invisible to it. Advisory: it never gates motion, and every MCP motion step on this machine '
    + 'leads with the laser-off line regardless (the laser frame manages its own M5 / M3 / M5).';

interface LaserModal {
    mode: string | null;
    s: number | null;
    line: string | null;
}

let record: McpLaserRecord | null = null;

const LASER_WORD = /\b(M0*[345]|M0*2|M30|S-?\d+(?:\.\d+)?)\b/;

/** Whether a payload carries a laser word (M3/M4/M5, S, M2/M30). */
export function carriesLaserWords(gcode: string): boolean {
    return String(gcode).split(/\r?\n/).some((line) => LASER_WORD.test(codeOf(line)));
}

/** Apply a payload's laser words in order to a modal state (GRBL: S is modal; M2/M30 stop the spindle/laser). */
export function applyLaserWords(start: { mode: string | null; s: number | null }, gcode: string): LaserModal {
    let { mode, s } = start;
    let line: string | null = null;
    for (const raw of String(gcode).split(/\r?\n/)) {
        const code = codeOf(raw);
        if (!code || !LASER_WORD.test(code)) {
            continue;
        }
        const sWord = /\bS(-?\d+(?:\.\d+)?)\b/.exec(code);
        if (sWord) {
            s = Number(sWord[1]);
        }
        const m = /\bM0*(3|4|5|2|30)\b/.exec(code);
        if (m) {
            mode = `M${m[1]}`;
        }
        line = code;
    }
    return { mode, s, line };
}

function laserOf(mode: string | null, s: number | null): McpLaserRecord['laser'] {
    if (mode === 'M3' || mode === 'M4') {
        if (s === null) {
            return 'uncertain';
        }
        return s > 0 ? 'on' : 'off';
    }
    return mode === null ? 'none' : 'off';
}

/**
 * Called by the direct send path for each payload on a machine whose toolhead
 * state is unknown; returns the settle callback for the reply's outcome.
 * A payload without laser words changes nothing.
 */
export function noteLaserSend(connection: string, gcode: string, now: () => number = Date.now): (outcome: SendOutcome) => void {
    if (!carriesLaserWords(gcode)) {
        return () => undefined;
    }
    return (outcome: SendOutcome) => {
        const prior = record && record.connection === connection ? record : null;
        const start = { mode: prior ? prior.mode : null, s: prior ? prior.s : null };
        const next = applyLaserWords(start, gcode);
        if (outcome === 'accepted') {
            const laser = laserOf(next.mode, next.s);
            record = {
                laser,
                mode: next.mode,
                s: next.s,
                line: next.line,
                at: now(),
                connection,
                note: laser === 'uncertain'
                    ? `${next.mode} went out with no S this MCP sent; GRBL keeps the last S from any source, so the power is not known.`
                    : `acknowledged: ${next.line}`,
            };
        } else if (outcome === 'rejected' || outcome === 'indeterminate') {
            record = {
                laser: 'uncertain',
                mode: next.mode,
                s: next.s,
                line: next.line,
                at: now(),
                connection,
                note: `a payload carrying "${next.line}" was ${outcome}: part of it may have run.`,
            };
        }
    };
}

/** The MCP started a file job: its laser words run in the firmware, not through this record. */
export function noteMcpFileJob(connection: string, name: string, now: () => number = Date.now): void {
    record = {
        laser: 'uncertain',
        mode: null,
        s: null,
        line: null,
        at: now(),
        connection,
        note: `the MCP started file job "${name}"; its laser words run in the firmware and are not tracked line by line.`,
    };
}

/** The record for `connection`; a record from another connection reads 'none' (the controller was reset or replaced). */
export function getMcpLaserRecord(connection: string | null): McpLaserRecord {
    if (record && connection !== null && record.connection === connection) {
        return { ...record };
    }
    return {
        laser: 'none',
        mode: null,
        s: null,
        line: null,
        at: null,
        connection,
        note: record ? 'nothing sent on this connection (an earlier record belonged to a previous connection).' : 'nothing sent yet.',
    };
}

/** Tests only. */
export function clearMcpLaserRecord(): void {
    record = null;
}

/**
 * What results and get_position / get_machine_profile carry where the
 * toolhead state is unknown; null where the machine reports (the A350's and
 * the Original's results stay unchanged).
 */
export function toolheadNote(assessment: ToolheadAssessment, laser: McpLaserRecord, laserOffSent: string | null = null): {
    state: ToolheadReading;
    basis: string;
    laser_off_lead: string | null;
    laser_off_sent: string | null;
    mcp_sent_laser: McpLaserRecord & { scope: string };
} | null {
    if (assessment.readback !== 'unknown') {
        return null;
    }
    return {
        state: assessment.state,
        basis: assessment.basis,
        laser_off_lead: assessment.laser_off_lead,
        laser_off_sent: laserOffSent,
        mcp_sent_laser: { ...laser, scope: MCP_LASER_RECORD_SCOPE },
    };
}
