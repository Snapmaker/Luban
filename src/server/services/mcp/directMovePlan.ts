/**
 * Plans and gates for the two direct XY tools, ruled on by the operator on
 * 2026-09-21 ("goto work origin is a risk, but move_and_capture should be z
 * gated first, and home is safe"):
 *
 * - gateDirectXy: the Z precondition of `move_and_capture`, decided BEFORE
 *   any XY is commanded, from the position of record. Until that day the
 *   check compared against the motion floor and was skipped outright when
 *   machine Z was unknown.
 * - planGotoWorkOrigin: `goto_work_origin` as a STAGED job. Work (0, 0) is
 *   resolved through the heartbeat's origin offset, planned like a traverse
 *   (floor, travel, landmarks) and emitted in MACHINE coordinates, so the
 *   confirm page shows where the head will actually go - a work origin is
 *   operator-set and dies on a machine reboot, so "work zero" can be anywhere
 *   on the bed.
 *
 * Pure: no server imports (unit-tested under ts-node).
 */

import { ObstacleBox } from './envelopeChecks';
import {
    STEP_SEPARATOR,
    TRAVERSE_Z_TOLERANCE_MM,
    TraversePlan,
    TraverseMachine,
    TraversePlanError,
    TraversePlanInput,
    Xyz,
    planTraverseXy,
} from './traversePlan';

const f3 = (n: number) => n.toFixed(3);

/**
 * What must happen before a direct XY move is sent. One shape with nullable
 * fields (TypeScript 4.4 here does not narrow a discriminant reliably):
 * `action` says which fields are meaningful.
 */
export interface DirectXyGate {
    /** refuse = do not send anything; raise = Z-only move to `toZ` first, then XY at `planZ`; proceed = XY at `planZ` now. */
    action: 'refuse' | 'raise' | 'proceed';
    /** Why, in the operator's terms. */
    reason: string;
    /** The Z the head is at (null when unknown). */
    fromZ: number | null;
    /** The Z a raise goes to (raise only). */
    toZ: number | null;
    /** The Z the XY move will run at - the Z every path check must use (null on refuse). */
    planZ: number | null;
}

/**
 * The Z gate of move_and_capture. `machineZ` is the position of record's
 * machine Z (the caller has already required a fresh, reliable record);
 * `floorZ` is the motion floor - the lowest Z a direct XY may run at, and the
 * height a raise goes to. `operatorConfirmedClearance` is the one
 * escape hatch: the operator's explicit word for a corridor at the CURRENT Z,
 * so no raise - but an unknown Z is refused even then, because nobody can
 * have confirmed a height the record does not hold.
 */
export function gateDirectXy(machineZ: number | null, floorZ: number, operatorConfirmedClearance: boolean, hasZ: boolean = true): DirectXyGate {
    if (!hasZ) {
        // A machine with no Z axis (the Ray) has no floor to be below and no
        // height to raise to: the XY runs at its only height. The travel cap,
        // the pacing guard, the idle/toolhead-off checks and the route checks
        // all still apply - only the Z precondition is moot.
        const z = machineZ !== null && Number.isFinite(machineZ) ? machineZ : 0;
        return {
            action: 'proceed',
            reason: 'this machine has no Z axis: no motion floor or traverse height applies, the XY runs at its only height',
            fromZ: z,
            toZ: null,
            planZ: z,
        };
    }
    if (machineZ === null || !Number.isFinite(machineZ)) {
        return {
            action: 'refuse',
            reason: 'machine Z is unknown - the position of record carries no Z, so the motion-floor precondition '
                + 'cannot be established and no XY is sent. Re-read get_position (reliability verified / heartbeat / '
                + 'cached-offset, warnings empty) and retry.',
            fromZ: null,
            toZ: null,
            planZ: null,
        };
    }
    if (operatorConfirmedClearance) {
        return {
            action: 'proceed',
            reason: `operator_confirmed_clearance: the operator confirmed this corridor at the current machine Z ${f3(machineZ)}; no raise`,
            fromZ: machineZ,
            toZ: null,
            planZ: machineZ,
        };
    }
    if (machineZ >= floorZ - TRAVERSE_Z_TOLERANCE_MM) {
        return {
            action: 'proceed',
            reason: `at or above the motion floor already (machine Z ${f3(machineZ)} >= ${floorZ})`,
            fromZ: machineZ,
            toZ: null,
            planZ: machineZ,
        };
    }
    return {
        action: 'raise',
        reason: `machine Z ${f3(machineZ)} is below the motion floor ${floorZ}: raise straight up first (law 2 - retreat Z, `
            + 'then traverse), the XY runs only once the raise has settled',
        fromZ: machineZ,
        toZ: floorZ,
        planZ: floorZ,
    };
}

export interface GotoWorkOriginInput {
    /** The judged machine position (position of record). */
    currentMachine: Xyz;
    /** machine = work - originOffset, as the heartbeat reported it. */
    originOffset: Xyz;
    /** Where the offset came from (tools/machine PositionSnapshot.originOffsetSource). Only the heartbeat's own reading is trusted. */
    offsetSource: 'heartbeat' | 'cached' | 'assumed-zero';
    /** The position of record's warnings; any warning refuses. */
    positionWarnings: string[];
    travel: TraversePlanInput['travel'];
    traverseZ: number;
    motionFloorZ?: number;
    feedRate: number;
    obstacles: ObstacleBox[];
    toolProtrusionMm?: number | null;
    clearanceMarginMm?: number;
    /** The connected machine's transport traits; omitted = the A350 (Z axis, own-line G53/G54). */
    machine?: TraverseMachine;
    reason: string;
}

export interface GotoWorkOriginPlan extends TraversePlan {
    /** Work (0, 0) in MACHINE coordinates - what the page shows and where the move goes. */
    destinationMachine: { x: number; y: number };
}

/**
 * Stage the move to the work origin. Refuses (TraversePlanError) when the
 * offset is not the heartbeat's own or the record carries warnings, and
 * otherwise inherits every traverse check against the RESOLVED machine
 * destination: motion floor, toolhead travel, landmark crossings.
 */
export function planGotoWorkOrigin(input: GotoWorkOriginInput): GotoWorkOriginPlan {
    if (input.offsetSource !== 'heartbeat') {
        throw new TraversePlanError(`Refused: the work-origin offset is not the heartbeat's own reading (source "${input.offsetSource}"). `
            + 'Work (0, 0) resolved through a cached or assumed offset can be anywhere on the bed - the origin is operator-set '
            + 'and dies on a machine reboot. Re-read get_position until originOffsetSource is "heartbeat" with no warnings, then retry.');
    }
    if (input.positionWarnings.length) {
        throw new TraversePlanError(`Refused: the position of record carries warnings (${input.positionWarnings.join(' | ')}), so the `
            + 'work origin cannot be resolved to a trusted machine destination. Clear them (re-read get_position) before staging this move.');
    }
    const destination = { x: 0 - input.originOffset.x, y: 0 - input.originOffset.y };
    const base = planTraverseXy({
        targets: [destination],
        frame: 'machine',
        currentMachine: input.currentMachine,
        originOffset: input.originOffset,
        travel: input.travel,
        traverseZ: input.traverseZ,
        motionFloorZ: input.motionFloorZ,
        feedRate: input.feedRate,
        obstacles: input.obstacles,
        toolProtrusionMm: input.toolProtrusionMm,
        clearanceMarginMm: input.clearanceMarginMm,
        machine: input.machine,
        reason: input.reason,
    });
    const originLines = [
        `; GOTO WORK ORIGIN: work (0, 0) = MACHINE (${f3(destination.x)}, ${f3(destination.y)}) - resolved through the work-origin offset `
            + `(${f3(input.originOffset.x)}, ${f3(input.originOffset.y)}) the heartbeat reported at staging`,
        '; emitted in MACHINE coordinates: the numbers on this page are where the head goes, even if the origin is re-zeroed before start',
        '; work origins are operator-set and die on a machine reboot - "work zero" can be anywhere on the bed; approve the MACHINE numbers, not the words',
    ];
    const header = [...originLines, base.header].join('\n');
    const reviewText = `${header}\n${base.steps.map((s) => s.gcode).join(STEP_SEPARATOR)}`;
    const name = `goto-work-origin -> machine (${destination.x.toFixed(1)}, ${destination.y.toFixed(1)}) ${base.totalDistanceMm.toFixed(0)}mm - ${input.reason.slice(0, 40)}`;
    return { ...base, header, reviewText, name, destinationMachine: destination };
}
