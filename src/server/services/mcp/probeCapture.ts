/* eslint-disable camelcase */
import { CAPTURE_SETTLE_MS } from './procedureLimits';

export interface ProbeCapturePlan {
    settleMs: number;
    label: string | null;
    /** Surface scans use 1-based station indices; a sequence probe has none. */
    stations?: number[];
}

/** No camera positioning is permitted inside a probe contact. */
export function planProbeCapture(raw: unknown, stationCount?: number): ProbeCapturePlan | null {
    if (raw === undefined) { return null; }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('capture must be an object with settle_ms, label and (for scans) stations.');
    }
    const a = raw as { [key: string]: unknown };
    const allowed = stationCount === undefined ? ['settle_ms', 'label'] : ['settle_ms', 'label', 'stations'];
    if (Object.keys(a).some((k) => !allowed.includes(k))) {
        throw new Error(`capture accepts only ${allowed.join(', ')}; it never moves the camera.`);
    }
    const settleMs = a.settle_ms === undefined ? CAPTURE_SETTLE_MS.default : a.settle_ms;
    if (typeof settleMs !== 'number' || !Number.isFinite(settleMs) || settleMs < 0 || settleMs > CAPTURE_SETTLE_MS.max) {
        throw new Error(`capture.settle_ms must be 0-${CAPTURE_SETTLE_MS.max}.`);
    }
    if (a.label !== undefined && typeof a.label !== 'string') {
        throw new Error('capture.label must be a string.');
    }
    const plan: ProbeCapturePlan = { settleMs, label: typeof a.label === 'string' ? a.label.slice(0, 120) : null };
    if (stationCount !== undefined) {
        if (!Array.isArray(a.stations) || !a.stations.length || a.stations.length > 60
            || a.stations.some((n) => typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > stationCount)
            || new Set(a.stations).size !== a.stations.length) {
            throw new Error(`capture.stations must contain 1-60 distinct station indices in 1-${stationCount}.`);
        }
        plan.stations = [...a.stations] as number[];
    }
    return plan;
}

export const probeCaptureSchema = {
    type: 'object',
    description: 'Optional stationary photograph after the final confirm contact, BEFORE retracting. No camera move. A camera failure is recorded and probing continues; stop/alarm still aborts.',
    properties: {
        settle_ms: { type: 'number', minimum: 0, maximum: CAPTURE_SETTLE_MS.max, description: 'Settling delay at the probe spot, default 500 ms.' },
        label: { type: 'string', description: 'Caption saved beside frame, measured contact and actual capture pose.' },
    },
    additionalProperties: false,
};

export const surfaceCaptureSchema = {
    ...probeCaptureSchema,
    properties: {
        ...probeCaptureSchema.properties,
        stations: { type: 'array', minItems: 1, maxItems: 60, uniqueItems: true, items: { type: 'integer', minimum: 1 }, description: '1-based scan station indices to photograph; missed stations capture at the search floor.' },
    },
    required: ['stations'],
};
