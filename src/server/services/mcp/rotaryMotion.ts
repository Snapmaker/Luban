// Pure timing rules for a rotary (B) move, shared by probing.rotateB and its
// tests. Written after the first hardware run of a rotate_b op (2026-09-21):
// the controller answered "ok" + an M114 reading B:180 in 219 ms for a 180
// degree turn that takes 18 s at F600 - the buffered command's LOGICAL
// position, not the chuck's. The runner took it as verified, the next op
// captured a frame 1.3 s into the turn (the stock had moved ~5 degrees) and
// the following op homed the machine while B was still turning.
//
// So a rotation is verified only when (a) the controller has been asked to
// wait for the planner to drain (M400) and (b) the wall-clock time since the
// command was sent is at least what the motion physically needs. The
// heartbeat's b agreeing and the machine reading idle are then the
// confirmation, never the echo alone.

/** Rotary feed for program rotations (deg/min): 600 = 10 deg/s, a 180 deg turn in 18 s. */
export const ROTATE_FEED = 600;

/** How much of the physical rotation time must have elapsed before an "ok" is believed. */
export const ROTATION_PLAUSIBILITY_FRACTION = 0.8;

/** Below this angle the timing test is not applied (settle jitter exceeds the motion time). */
export const ROTATION_MIN_TESTED_DEG = 2;

/** Milliseconds a rotation of `deltaDeg` needs at `feedDegPerMin`. */
export function rotationDurationMs(deltaDeg: number, feedDegPerMin: number = ROTATE_FEED): number {
    if (!Number.isFinite(deltaDeg) || !Number.isFinite(feedDegPerMin) || feedDegPerMin <= 0) {
        return 0;
    }
    return Math.abs(deltaDeg) / feedDegPerMin * 60000;
}

export interface RotationPlausibility {
    plausible: boolean;
    expectedMs: number;
    /** How long the runner must still wait before the rotation can have finished (0 when plausible). */
    remainingMs: number;
    note: string;
}

/**
 * Can a rotation from `fromDeg` to `toDeg` have finished `elapsedMs` after it
 * was sent? Unknown start angle (null) is judged as the worst case, a 180
 * degree turn, so an unknown B never makes an instant "ok" believable.
 */
export function judgeRotation(fromDeg: number | null, toDeg: number, elapsedMs: number, feedDegPerMin: number = ROTATE_FEED): RotationPlausibility {
    const delta = fromDeg === null ? 180 : Math.abs(toDeg - fromDeg);
    const expectedMs = rotationDurationMs(delta, feedDegPerMin);
    if (delta < ROTATION_MIN_TESTED_DEG) {
        return { plausible: true, expectedMs, remainingMs: 0, note: `rotation of ${delta.toFixed(3)} deg is below the ${ROTATION_MIN_TESTED_DEG} deg timing test` };
    }
    const needed = expectedMs * ROTATION_PLAUSIBILITY_FRACTION;
    if (elapsedMs >= needed) {
        return { plausible: true, expectedMs, remainingMs: 0, note: `${elapsedMs} ms elapsed for a ${delta.toFixed(1)} deg turn (${Math.round(expectedMs)} ms at F${feedDegPerMin})` };
    }
    return {
        plausible: false,
        expectedMs,
        remainingMs: Math.ceil(needed - elapsedMs),
        note: `controller answered after ${elapsedMs} ms but a ${delta.toFixed(1)} deg turn needs ~${Math.round(expectedMs)} ms at F${feedDegPerMin}`
            + `${fromDeg === null ? ' (start angle unknown: judged as 180 deg)' : ''} - the echo is the buffered target, not the chuck`,
    };
}
