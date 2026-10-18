// Latest machine state of a SACP channel (#260), in the SAME shape the MCP
// already reads from SstpHttpChannel.getLatestMachineState(): `status`,
// `pos` (work coordinates), `originOffset`, `isHomed`, `timestamp`, plus the
// toolhead fields the guards look at. The source is the heartbeat and
// coordinate-system subscriptions that SacpChannelBase.startHeartbeatLegacy
// already runs for the Luban UI (the `Marlin:state` payload) - until #260 the
// values were emitted to the renderer and never kept, so on a Ray over
// SACP-UDP ConnectionManager.getLatestMachineState() returned null forever
// and every heartbeat-gated tool refused with "No heartbeat received yet".
//
// Frame convention: identical to SSTP and to the renderer's DisplayPanel,
// machine = work - originOffset (machinePosition.ts derives exactly that).
//
// Pure module: no server imports, unit-tested in mcp/tests/sacpMachineState.test.ts.

/** One axis of a SACP CoordinateInfo: `key` is the Direction enum, `value` mm. */
export interface SacpAxisReading {
    key: number;
    value: number;
}

/** The fields of the SDK's CoordinateSystemInfo that the state is built from. */
export interface SacpCoordinateReport {
    /** 0 = homed, 1 = needs homing (the SDK's convention, inverted into isHomed). */
    homed: number;
    coordinates: SacpAxisReading[];
    originOffset: SacpAxisReading[];
}

/** CoordinateInfo.Direction values, kept local so this module stays free of SDK imports. */
export const SACP_AXIS_KEY = { x: 0, y: 1, z: 2, b: 4 } as const;

export type Axis = keyof typeof SACP_AXIS_KEY;

export interface SacpPosition {
    x: number | null;
    y: number | null;
    z: number | null;
    b: number | null;
    isFourAxis: boolean;
}

export interface SacpOriginOffset {
    x: number | null;
    y: number | null;
    z: number | null;
    b: number | null;
}

export interface SacpMachineState {
    [key: string]: unknown;
    /** When the newest heartbeat OR coordinate report arrived (the MCP's beat clock). */
    timestamp: number;
    status?: string;
    pos?: SacpPosition;
    originOffset?: SacpOriginOffset;
    isHomed?: boolean;
    /** Axes the controller's coordinate report actually carried; a missing axis reads as 0 (see mapCoordinateReport). */
    reportedAxes?: Axis[];
    headType?: string;
    /** Laser current power or CNC current spindle speed, so the toolhead-off guards read SACP like SSTP. */
    headPower?: number;
}

function axisValue(list: SacpAxisReading[], axis: Axis): number | null {
    const entry = list.find((item) => item && item.key === SACP_AXIS_KEY[axis]);
    if (!entry) {
        return null;
    }
    const n = Number(entry.value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Map one coordinate-system report to pos / originOffset / isHomed.
 *
 * Axes are looked up by their Direction key, not by array position: the
 * legacy UI mapping reads coordinates[2] as Z, which on a machine that
 * reports X, Y, B would hand B's value to Z.
 *
 * A machine without an axis (the Ray has no Z) reports no entry for it. The
 * position judge needs every one of x/y/z to accept a beat, so an axis the
 * controller does not have reads as 0 in both pos and originOffset, and
 * `reportedAxes` says which axes were real. An EMPTY offset list is a report
 * with no offset at all and stays null, so the judge rejects it as
 * no-offset-yet exactly as it does for the HTTP channel.
 */
export function mapCoordinateReport(report: SacpCoordinateReport, isFourAxis: boolean): {
    pos: SacpPosition;
    originOffset: SacpOriginOffset;
    isHomed: boolean;
    reportedAxes: Axis[];
} {
    const coordinates = Array.isArray(report.coordinates) ? report.coordinates : [];
    const offsets = Array.isArray(report.originOffset) ? report.originOffset : [];
    const reportedAxes = (Object.keys(SACP_AXIS_KEY) as Axis[]).filter((axis) => axisValue(coordinates, axis) !== null);
    const linear: Axis[] = ['x', 'y', 'z'];
    const pos: SacpPosition = { x: null, y: null, z: null, b: axisValue(coordinates, 'b'), isFourAxis };
    const originOffset: SacpOriginOffset = { x: null, y: null, z: null, b: axisValue(offsets, 'b') };
    for (const axis of linear) {
        const present = reportedAxes.includes(axis);
        const value = axisValue(coordinates, axis);
        pos[axis] = present ? value : 0;
        if (offsets.length === 0) {
            originOffset[axis] = null;
        } else {
            const offset = axisValue(offsets, axis);
            originOffset[axis] = offset === null ? 0 : offset;
        }
    }
    return {
        pos,
        originOffset,
        isHomed: !report.homed, // 0: homed, 1: need to home
        reportedAxes,
    };
}

/** Every heartbeat-payload field except the three the coordinate report owns. */
export function pickHeartbeatExtras(stateData: { [key: string]: unknown }): { [key: string]: unknown } {
    const extras: { [key: string]: unknown } = {};
    for (const key of Object.keys(stateData || {})) {
        if (key !== 'pos' && key !== 'originOffset' && key !== 'isHomed') {
            extras[key] = stateData[key];
        }
    }
    return extras;
}

/** headPower in the SSTP sense: laser current power for a laser head, current spindle speed for CNC. */
export function deriveHeadPower(state: { headType?: unknown; laserPower?: unknown; cncCurrentSpindleSpeed?: unknown }): number | undefined {
    const candidate = state.headType === 'laser' ? state.laserPower
        : state.headType === 'cnc' ? state.cncCurrentSpindleSpeed : undefined;
    const n = Number(candidate);
    return candidate === undefined || candidate === null || !Number.isFinite(n) ? undefined : n;
}

/**
 * Keeps the newest state. Status and extras come from the heartbeat
 * subscription, position from the coordinate subscription; each arrival
 * stamps `timestamp`, so the MCP sees a beat per report (about 2 Hz with
 * both subscriptions at 1 s). clear() on any session end makes the MCP read
 * null again and forget the connection's offsets, like the HTTP channel.
 */
export class SacpMachineStateTracker {
    private state: SacpMachineState | null = null;

    public constructor(private now: () => number = Date.now) {}

    public get(): SacpMachineState | null {
        return this.state;
    }

    public noteHeartbeat(status: string, extras: { [key: string]: unknown } = {}): SacpMachineState {
        const merged: SacpMachineState = { ...(this.state || { timestamp: 0 }), ...pickHeartbeatExtras(extras), status, timestamp: this.now() };
        const headPower = deriveHeadPower(merged);
        if (headPower !== undefined) {
            merged.headPower = headPower;
        }
        this.state = merged;
        return merged;
    }

    public noteCoordinates(report: SacpCoordinateReport, isFourAxis: boolean): SacpMachineState {
        const mapped = mapCoordinateReport(report, isFourAxis);
        this.state = { ...(this.state || {}), ...mapped, timestamp: this.now() };
        return this.state;
    }

    /** The 0x01/0x36 homed notification: a fact about the existing state, not a new report. */
    public noteHomed(isHomed: boolean): void {
        if (this.state) {
            this.state = { ...this.state, isHomed };
        }
    }

    public clear(): void {
        this.state = null;
    }
}
