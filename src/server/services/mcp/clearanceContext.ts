// The live inputs an obstacle check needs beyond the geometry: how far the
// fitted tool hangs below the toolhead, and the margin above an obstacle.
//
// checkMotion stays pure and takes these as options; this is the one place
// that reads them out of the stored state, so every planner asks the same
// question and gets the same answer.
import { CLEARANCE_MARGIN_MM } from './landmarkClearance';
import { getActiveTool } from './activeTool';
import { ToolProtrusion, resolveToolProtrusion } from './toolProtrusion';
import { getToolSetterConfig } from './toolSetter';

export function currentToolProtrusion(): ToolProtrusion {
    const active = getActiveTool();
    const cfg = getToolSetterConfig();
    return resolveToolProtrusion({
        active: active?.clearanceBasis === 'toolhead_reference' ? active : null,
        // A past fitting cannot bound an unknown replacement, even if it was measured.
        staleToolMm: null,
        measured: null,
        // Neither a legacy contact-conversion offset nor an approach estimate
        // establishes a physical toolhead-reference clearance bound.
        probeEffectiveLengthMm: null,
        longestBitLengthMm: cfg?.toolheadClearanceBound?.mm ?? null,
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
