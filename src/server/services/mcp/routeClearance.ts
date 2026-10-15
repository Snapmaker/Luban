import { currentToolProtrusion } from './clearanceContext';
import { landmarkStore } from './landmarks';
import { motionFloorZ } from './tools/machine';
import { cameraMinimumZ } from './cameraSafety';

/**
 * A route-specific collision envelope. With an active fitted tool, known
 * physical landmarks determine the required toolhead Z for this XY corridor.
 * The motion floor ALSO applies: a fitted tool says nothing about unmapped stock.
 */
export interface RouteClearance {
    minimumZ: number;
    source: 'computed-landmarks' | 'legacy-unknown-scene';
    activeToolMm: number | null;
    obstacles: Array<{ name: string; requiredZ: number | null; topZ: number | null }>;
    note: string;
}

export function routeClearanceForPath(
    from: { x: number; y: number },
    to: { x: number; y: number },
    marginMm?: number,
    operatorConfirmedClearance = false,
): RouteClearance {
    const protrusion = currentToolProtrusion();
    const active = protrusion.source === 'active-tool';
    const obstacles = landmarkStore.obstaclesOnPath(
        from.x,
        from.y,
        to.x,
        to.y,
        0,
        marginMm,
        protrusion.mm,
    );
    const requirements = obstacles.map((obstacle) => obstacle.requiredZ);
    const unknown = requirements.some((required) => required === null);
    const minimumZ = cameraMinimumZ(motionFloorZ(), requirements, operatorConfirmedClearance);
    let note: string;
    if (unknown) {
        note = 'A physical obstacle lies on this route but its required Z cannot be computed until the active tool length is known.';
    } else if (obstacles.length) {
        note = `Computed from ${obstacles.length} intersected landmark(s) and active tool protrusion ${protrusion.mm} mm.`;
    } else {
        note = 'No stored obstacle intersects this route; this does not prove the unmapped scene is clear.';
    }
    note += operatorConfirmedClearance ? ' Operator explicitly cleared the sub-floor corridor; stored obstacles still apply.' : ` Motion floor Z${motionFloorZ()} still applies.`;
    return {
        minimumZ,
        source: active ? 'computed-landmarks' : 'legacy-unknown-scene',
        activeToolMm: protrusion.mm,
        obstacles: obstacles.map((obstacle) => ({
            name: obstacle.name,
            requiredZ: obstacle.requiredZ,
            topZ: obstacle.clearanceZ,
        })),
        note,
    };
}
