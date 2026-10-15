// The live inputs an obstacle check needs beyond the geometry: how far the
// fitted tool hangs below the toolhead, and the margin above an obstacle.
//
// checkMotion stays pure and takes these as options; this is the one place
// that reads them out of the stored state, so every planner asks the same
// question and gets the same answer.
import { CLEARANCE_MARGIN_MM } from './landmarkClearance';
import { getActiveTool, getStoredActiveTool } from './activeTool';
import { geometryValue } from './rotaryGeometry';
import { ToolProtrusion, resolveToolProtrusion } from './toolProtrusion';
import { getMeasurements, getToolSetterConfig } from './toolSetter';

export function currentToolProtrusion(): ToolProtrusion {
    const active = getActiveTool();
    const cfg = getToolSetterConfig();
    const last = getMeasurements().last;
    return resolveToolProtrusion({
        active,
        staleToolMm: active ? null : getStoredActiveTool()?.protrusionMm,
        measured: last && last.derivedBitLengthMm !== undefined
            ? { protrusionMm: last.derivedBitLengthMm, at: last.at }
            : null,
        probeEffectiveLengthMm: geometryValue('probe_effective_length'),
        longestBitLengthMm: cfg ? cfg.longestBitLengthMm : null,
    });
}

/**
 * Spread into any checkMotion() options. A planner that forgets it still
 * enforces every legacy 'toolhead' clearance exactly as before, and treats a
 * physically stated obstacle as impassable rather than passable.
 */
export function clearanceOptions(): { toolProtrusionMm: number | null; clearanceMarginMm: number } {
    return { toolProtrusionMm: currentToolProtrusion().mm, clearanceMarginMm: CLEARANCE_MARGIN_MM };
}
