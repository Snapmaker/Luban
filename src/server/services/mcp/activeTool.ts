import { machineConfig } from './machineStore';

/** The source of the operator's current-tool assertion. */
export type ActiveToolSource = 'operator' | 'tool_setter' | 'spindle_probe';
export type ActiveToolStatus = 'operator_confirmed' | 'measured';

/**
 * The tool that is actually fitted, distinct from the configured worst-case
 * bit length. Persist the evidence, but only a current-session confirmation
 * may shorten clearances. Reconnect, restart and tool-change parking invalidate
 * that authority without erasing the historical value.
 */
export interface ActiveTool {
    protrusionMm: number;
    /** Only a toolhead-reference upper bound may shorten physical-obstacle clearance. */
    clearanceBasis: 'toolhead_reference' | 'unknown';
    measurementId: string | null;
    source: ActiveToolSource;
    status: ActiveToolStatus;
    measuredAt: number | null;
    confirmedAt: number | null;
    measurementJobId: string | null;
    toolIdentity: string | null;
    note: string | null;
}

const CONFIG_KEY = 'mcpActiveTool';
// A persisted assertion must be re-established after a server restart or disconnect.
let sessionConfirmed = false;
let staleReason = 'Server restarted; confirm the currently fitted tool or measure it again.';

function raw(): { [key: string]: unknown } {
    const value = machineConfig.get(CONFIG_KEY);
    return value && typeof value === 'object' ? value as { [key: string]: unknown } : {};
}

function parse(value: unknown): ActiveTool | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const item = value as { [key: string]: unknown };
    const protrusionMm = Number(item.protrusionMm);
    const source = item.source;
    const status = item.status;
    if (!Number.isFinite(protrusionMm) || protrusionMm <= 0
        || !['operator', 'tool_setter', 'spindle_probe'].includes(String(source))
        || !['operator_confirmed', 'measured'].includes(String(status))) {
        return null;
    }
    return {
        protrusionMm,
        clearanceBasis: item.clearanceBasis === 'toolhead_reference' ? 'toolhead_reference' : 'unknown',
        measurementId: item.measurementId ? String(item.measurementId) : null,
        source: source as ActiveToolSource,
        status: status as ActiveToolStatus,
        measuredAt: typeof item.measuredAt === 'number' && Number.isFinite(item.measuredAt) ? item.measuredAt : null,
        confirmedAt: typeof item.confirmedAt === 'number' && Number.isFinite(item.confirmedAt) ? item.confirmedAt : null,
        measurementJobId: item.measurementJobId ? String(item.measurementJobId) : null,
        toolIdentity: item.toolIdentity ? String(item.toolIdentity) : null,
        note: item.note ? String(item.note) : null,
    };
}

export function getActiveTool(): ActiveTool | null {
    return sessionConfirmed ? parse(raw()) : null;
}

export function getStoredActiveTool(): ActiveTool | null {
    return parse(raw());
}

export function invalidateActiveTool(reason: string): void {
    sessionConfirmed = false;
    staleReason = reason;
}

export function setActiveTool(input: {
    protrusionMm: number;
    clearanceBasis?: 'toolhead_reference' | 'unknown';
    measurementId?: string | null;
    source: ActiveToolSource;
    note?: string | null;
    measurementJobId?: string | null;
    toolIdentity?: string | null;
    at?: number;
}): ActiveTool {
    if (!Number.isFinite(input.protrusionMm) || input.protrusionMm <= 0) {
        throw new Error('Active tool protrusion must be a positive finite number.');
    }
    const at = Number.isFinite(Number(input.at)) ? Number(input.at) : Date.now();
    const measured = input.source !== 'operator';
    const value: ActiveTool = {
        protrusionMm: input.protrusionMm,
        clearanceBasis: input.clearanceBasis || 'unknown',
        measurementId: input.measurementId || null,
        source: input.source,
        status: measured ? 'measured' : 'operator_confirmed',
        measuredAt: measured ? at : null,
        confirmedAt: measured ? null : at,
        measurementJobId: input.measurementJobId ? String(input.measurementJobId) : null,
        toolIdentity: input.toolIdentity ? String(input.toolIdentity) : null,
        note: input.note ? String(input.note).trim() : null,
    };
    machineConfig.set(CONFIG_KEY, value);
    sessionConfirmed = true;
    return value;
}

export function clearActiveTool(): void {
    machineConfig.unset(CONFIG_KEY);
    sessionConfirmed = false;
}

export function describeActiveTool(tool: ActiveTool | null = getActiveTool()): object {
    if (!tool) {
        return {
            active: null,
            stored: parse(raw()),
            staleReason: parse(raw()) ? staleReason : null,
            note: 'No active tool is confirmed. Route planners use an explicitly configured toolhead-reference maximum where available and refuse physical obstacles they cannot bound.',
        };
    }
    return {
        active: tool,
        ageMs: Date.now() - (tool.measuredAt || tool.confirmedAt || Date.now()),
        clearanceNote: tool.clearanceBasis === 'toolhead_reference'
            ? `Routine route clearance uses the active ${tool.source} tool at ${tool.protrusionMm} mm toolhead-reference bound (${tool.status}).`
            : 'This fitting is recorded, but its length basis is unverified. It cannot shorten physical-obstacle clearance; a collet length or conventional setter offset is not a toolhead-reference bound.',
    };
}
