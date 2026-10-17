// Pure coordinate/evidence helpers. An approach estimate is never a calibration.
export interface SetterDatum {
    id: string;
    name: string;
    machineZ: number;
    basis: 'measured' | 'legacy_reference_convention';
    source: string;
    at: number | null;
    uncertaintyMm: number | null;
}

export interface ToolMeasurement {
    measuredTriggerZ: number;
    /** Legacy API name: used ONLY to plan the approach. */
    bitLengthMm: number;
    /** Deprecated alias for setterDerivedOffsetMm, not a caliper protrusion. */
    derivedBitLengthMm?: number;
    spreadMm: number | null;
    at: number;
    id?: string;
    toolIdentity?: string | null;
    fittingId?: string | null;
    jobId?: string | null;
    source?: 'tool_setter' | 'spindle_probe';
    datum?: SetterDatum | null;
    setterDerivedOffsetMm?: number | null;
    confirmPassContacts?: number[];
    contactChannels?: string[];
    fineStepMm?: number;
    referenceBasis?: 'unknown' | 'snapshot';
}

export interface TipCalibrationSnapshot {
    kind: 'setter' | 'legacy_effective_length' | 'unavailable';
    offsetMm: number | null;
    rawTriggerMachineZ: number | null;
    datum: SetterDatum | null;
    measurementId: string | null;
    measurementJobId: string | null;
    toolIdentity: string | null;
    fittingId: string | null;
    measuredAt: number | null;
    uncertaintyMm: number | null;
    applicability: 'current_fitting' | 'unknown';
    physicalReferenceVerified: boolean;
    note: string;
}

export function finiteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseSetterDatum(raw: unknown): SetterDatum | null {
    if (!raw || typeof raw !== 'object') return null;
    const d = raw as SetterDatum;
    if (!d.id || !d.name || !d.source || finiteNumber(d.machineZ) === null
        || !['measured', 'legacy_reference_convention'].includes(d.basis)) return null;
    const uncertaintyMm = finiteNumber(d.uncertaintyMm);
    return { id: String(d.id),
        name: String(d.name),
        machineZ: d.machineZ,
        basis: d.basis,
        source: String(d.source),
        at: finiteNumber(d.at),
        uncertaintyMm: uncertaintyMm !== null && uncertaintyMm >= 0 ? uncertaintyMm : null };
}

/** This describes today's legacy convention; it does NOT recover a historic calibration. */
export function legacySetterDatum(triggerZ: number, referenceLength: number): SetterDatum {
    return { id: `legacy-reference:${triggerZ}:${referenceLength}`,
        name: 'Legacy setter reference convention',
        machineZ: Number((triggerZ - referenceLength).toFixed(6)),
        basis: 'legacy_reference_convention',
        source: `Configured reference trigger ${triggerZ} minus nominal reference length ${referenceLength}; physical datum not independently established.`,
        at: null,
        uncertaintyMm: null };
}

export function unavailableTipCalibration(note: string): TipCalibrationSnapshot {
    return { kind: 'unavailable',
        offsetMm: null,
        rawTriggerMachineZ: null,
        datum: null,
        measurementId: null,
        measurementJobId: null,
        toolIdentity: null,
        fittingId: null,
        measuredAt: null,
        uncertaintyMm: null,
        applicability: 'unknown',
        physicalReferenceVerified: false,
        note };
}

export function calibrationFromMeasurement(m: ToolMeasurement): TipCalibrationSnapshot {
    const datum = parseSetterDatum(m.datum);
    if (!datum || finiteNumber(m.measuredTriggerZ) === null) {
        return unavailableTipCalibration('Historical measurement has no datum snapshot; today\'s reference must not be applied retrospectively.');
    }
    const step = finiteNumber(m.fineStepMm);
    const spread = finiteNumber(m.spreadMm);
    const uncertaintyMm = datum.uncertaintyMm !== null && step !== null && step > 0 && spread !== null && spread >= 0
        ? datum.uncertaintyMm + step + spread : null;
    return { kind: 'setter',
        offsetMm: Number((m.measuredTriggerZ - datum.machineZ).toFixed(6)),
        rawTriggerMachineZ: m.measuredTriggerZ,
        datum,
        measurementId: m.id || null,
        measurementJobId: m.jobId || null,
        toolIdentity: m.toolIdentity || null,
        fittingId: m.fittingId || null,
        measuredAt: m.at,
        uncertaintyMm,
        applicability: 'current_fitting',
        physicalReferenceVerified: datum.basis === 'measured' && uncertaintyMm !== null,
        note: datum.basis === 'measured'
            ? 'Tip-bottom machine Z from the recorded setter datum and this fitting; uncertainty includes datum, one fine step and confirm spread.'
            : 'Conventional tip-bottom projection only: the nominal reference length does not establish physical machine Z or a clearance bound.' };
}

/** Additive result fields. Raw toolhead and work coordinates must remain unchanged. */
export function projectToolTipZ(toolheadMachineZ: number | null, calibration: TipCalibrationSnapshot): {
    tipMachineZ: number | null; tipCalibration: TipCalibrationSnapshot;
} {
    return { tipMachineZ: finiteNumber(toolheadMachineZ) !== null && finiteNumber(calibration.offsetMm) !== null
        ? Number(((toolheadMachineZ as number) - (calibration.offsetMm as number)).toFixed(6)) : null,
    tipCalibration: calibration };
}
