// Pure camera planning invariants, shared by direct and composite tool paths.
export function cameraMinimumZ(floor: number, obstacleRequirements: Array<number | null>, operatorCleared = false): number {
    if (obstacleRequirements.some((z) => z === null || !Number.isFinite(z))) return Infinity;
    return Math.max(operatorCleared ? 0 : floor, ...obstacleRequirements as number[]);
}

export function belowCameraFloor(levels: number[], floor: number, tolerance: number, operatorCleared = false): number[] {
    return operatorCleared ? [] : levels.filter((z) => z < floor - tolerance);
}
