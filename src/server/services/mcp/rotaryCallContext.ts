// A per-call adjustment of the landmark obstacle list (tyeth/Luban#265 WP8):
// while a tool call that stated `stock` runs, the rotary's legacy keep-out may
// be replaced by the computed one (rotaryClearance.ts), or raised above the
// fallback so a crossing is refused. Every planner reads its obstacles through
// landmarkStore.obstacleBoxes(), so applying the adjustment there reaches all
// of them - traverse, goto_work_origin, move_and_capture, every probe program -
// without threading an argument through each. Scoped with AsyncLocalStorage
// (as failureRecovery.ts scopes its ledger), so concurrent calls never see
// each other's stock. Kept free of server imports: landmarks.ts loads it.
import { AsyncLocalStorage } from 'async_hooks';

import { ObstacleBox } from './envelopeChecks';

export type ObstacleTransform = (boxes: ObstacleBox[]) => ObstacleBox[];

const storage = new AsyncLocalStorage<ObstacleTransform>();

/** Run `fn` with `transform` applied to every landmark obstacle list read inside it. */
export function runWithObstacleTransform<T>(transform: ObstacleTransform, fn: () => T): T {
    return storage.run(transform, fn);
}

/** The obstacle list as this call should see it; unchanged outside a stated-stock call. */
export function applyCallObstacleTransform(boxes: ObstacleBox[]): ObstacleBox[] {
    const transform = storage.getStore();
    return transform ? transform(boxes) : boxes;
}

/** The `stock` argument's schema, shared by every tool that can cross the rotary (rotaryWiring.ts reads it). */
export const STOCK_ARG_SCHEMA = {
    type: 'object',
    properties: {
        radius_mm: { type: 'number', description: 'Largest radius of the part in the rotary chuck about the rotary axis (mm).' },
        top_z: {
            type: 'number',
            description: 'PHYSICAL machine Z of the part\'s top, when measured directly (overrides axis Z + radius_mm).',
        },
    },
    additionalProperties: false,
    description: 'The part held in the rotary for THIS call (never stored). With the rotary geometry (set_probe_geometry '
        + 'rotary_axis_z_physical, rotary_chuck_face_y, rotary_tailstock_y, rotary_chuck_top_z, rotary_tailstock_top_z) and a '
        + 'trusted tool protrusion (run_tool_setter, or set_active_tool protrusion_reference toolhead), the rotary keep-out is '
        + 'computed (top + tool + margin) instead of the legacy ceiling; the result\'s rotary_clearance says which applied and '
        + 'what would lower it. A crossing that even the safe traverse Z cannot clear is refused.',
};
