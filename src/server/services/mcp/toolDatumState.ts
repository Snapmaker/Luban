import config from '../configstore';
import { getActiveTool, getStoredActiveTool } from './activeTool';
import { geometrySettings } from './rotaryGeometry';
import {
    ToolMeasurement, TipCalibrationSnapshot, calibrationFromMeasurement, finiteNumber,
    legacySetterDatum, parseSetterDatum, unavailableTipCalibration,
} from './toolDatum';

const CONFIG_KEY = 'mcpToolSetter';

export function rawSetterState(): { [key: string]: unknown } {
    const raw = config.get(CONFIG_KEY);
    return raw && typeof raw === 'object' ? raw as { [key: string]: unknown } : {};
}

export function parseToolMeasurement(raw: unknown): ToolMeasurement | null {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as ToolMeasurement;
    if (finiteNumber(m.measuredTriggerZ) === null || finiteNumber(m.at) === null) return null;
    const datum = parseSetterDatum(m.datum);
    return {
        measuredTriggerZ: m.measuredTriggerZ,
        bitLengthMm: m.bitLengthMm,
        derivedBitLengthMm: finiteNumber(m.derivedBitLengthMm) ?? undefined,
        spreadMm: finiteNumber(m.spreadMm),
        at: m.at,
        id: m.id ? String(m.id) : undefined,
        toolIdentity: m.toolIdentity ? String(m.toolIdentity) : null,
        fittingId: m.fittingId ? String(m.fittingId) : null,
        jobId: m.jobId ? String(m.jobId) : null,
        source: m.source === 'spindle_probe' || m.source === 'tool_setter' ? m.source : undefined,
        datum,
        setterDerivedOffsetMm: datum ? Number((m.measuredTriggerZ - datum.machineZ).toFixed(6)) : null,
        confirmPassContacts: Array.isArray(m.confirmPassContacts) ? m.confirmPassContacts.filter((v) => finiteNumber(v) !== null) : undefined,
        contactChannels: Array.isArray(m.contactChannels) ? m.contactChannels.map(String) : undefined,
        fineStepMm: finiteNumber(m.fineStepMm) ?? undefined,
        referenceBasis: datum ? 'snapshot' : 'unknown',
    };
}

export function getToolMeasurements(): { last: ToolMeasurement | null; previous: ToolMeasurement | null; history: ToolMeasurement[] } {
    const cfg = rawSetterState();
    return {
        last: parseToolMeasurement(cfg.lastMeasurement),
        previous: parseToolMeasurement(cfg.previousMeasurement),
        history: Array.isArray(cfg.measurements) ? cfg.measurements.map(parseToolMeasurement).filter((m): m is ToolMeasurement => m !== null) : [],
    };
}

/** Append immutable snapshots; legacy slots retain unknown tool and datum identity. */
export function recordToolMeasurement(measurement: ToolMeasurement): void {
    const cfg = rawSetterState();
    const history = Array.isArray(cfg.measurements) ? [...cfg.measurements] : [cfg.previousMeasurement, cfg.lastMeasurement].filter(Boolean);
    const saved = JSON.parse(JSON.stringify(measurement)) as ToolMeasurement;
    config.set(CONFIG_KEY, { ...cfg,
        previousMeasurement: cfg.lastMeasurement || null,
        lastMeasurement: saved,
        measurements: [...history, saved] });
}

export function currentSetterDatum() {
    const cfg = rawSetterState();
    if (cfg.datum !== undefined && cfg.datum !== null) return parseSetterDatum(cfg.datum);
    const trigger = finiteNumber(cfg.triggerZ);
    const length = finiteNumber(cfg.referenceBitLengthMm);
    return trigger !== null && length !== null ? legacySetterDatum(trigger, length) : null;
}

/** Capture ONCE before a procedure. Never select an arbitrary latest cutter measurement. */
export function getProbeTipCalibration(): TipCalibrationSnapshot {
    const active = getActiveTool();
    if (active) {
        if (active.source !== 'spindle_probe' || !active.measurementId) {
            return unavailableTipCalibration('The current tool has no associated spindle-probe setter measurement.');
        }
        const measurements = getToolMeasurements();
        const m = [...measurements.history, measurements.last].find((candidate) => candidate?.id === active.measurementId);
        if (!m || m.source !== 'spindle_probe') return unavailableTipCalibration('The current spindle-probe measurement record is unavailable.');
        return calibrationFromMeasurement(m);
    }
    if (getStoredActiveTool()?.measurementId) {
        return unavailableTipCalibration('The measured fitting is stale after restart, disconnect or tool change; historical evidence remains saved.');
    }
    const entry = geometrySettings().fields.probe_effective_length;
    if (entry?.value !== null && finiteNumber(entry?.value) !== null) {
        return { ...unavailableTipCalibration('Legacy probe_effective_length projection; original datum and current fitting applicability are unknown. No raw setter trigger has been inferred.'),
            kind: 'legacy_effective_length',
            offsetMm: entry.value,
            measuredAt: entry.setAt,
            note: `Legacy probe_effective_length projection (${entry.source}; ${entry.note || 'no provenance note'}); datum and fitting applicability unknown. Not a caliper protrusion or verified physical clearance bound.` };
    }
    return unavailableTipCalibration('No probe calibration is stored. Raw toolhead contact remains valid.');
}
