// Planning a bed survey's motion against the stored landmarks (issue #141).
//
// survey_bed used to build its serpentine and hand it straight to the runner:
// it validated the Z levels against the motion floor and the bounds against
// the travel, and then planned columns and hops through whatever landmarks
// were stored. On 2026-09-20 a survey at Z 324 and 320 staged without
// complaint through the rotary keep-out (X140-200, clearance 328) - safe that
// day only because the motion floor happened to sit high relative to the
// bed's contents, not because anything checked.
//
// Law 4: landmarks are obstacles. A camera survey has no business low over a
// footprint - it is looking, and looking can be done from above - so every
// stored box is treated as a VOLUME here, exactly as the pose sweep does
// (bootstrapPlan.ts), even one stored as 'crossing' for the probing
// procedures that legitimately work inside it.
//
// What the planner does with a violation, in order of preference:
//
//   1. A WAYPOINT whose descent column into the level cannot clear an obstacle
//      is DROPPED and reported - a partial grid is still a useful grid, and the
//      operator sees exactly which frames are missing and why.
//   2. A LINK between two kept waypoints that would cross an obstacle at the
//      level's height is LIFTED: raise to the park height with XY stationary,
//      hop there, descend with XY stationary at the destination. Each leg is
//      its own gcode line on the confirm page; nothing is quietly adjusted.
//   3. A link that cannot even be made at the park height drops its
//      destination waypoint, with the reason.
//
// Pure: no server imports, unit-tested in tests/surveyPlan.test.ts.
import { MotionSegment, ObstacleBox, POSITION_EPSILON_MM, checkMotion, describeViolations } from './envelopeChecks';

export interface SurveyWaypoint {
    x: number;
    y: number;
}

export interface SurveyPlanInput {
    /** Machine Z of each pass, highest first (the caller has sorted and deduplicated). */
    levels: number[];
    /** The serpentine, in visiting order; the same grid is run at every level. */
    waypoints: SurveyWaypoint[];
    /** Where a lifted link travels: the safe traverse height. */
    parkZ: number;
    /** Where the toolhead is at staging, so the first link is checked like any other. */
    fromMachine: { x: number; y: number; z: number };
    obstacles: ObstacleBox[];
    toolProtrusionMm: number | null;
    clearanceMarginMm?: number;
}

export type SurveyLeg =
    /** XY stationary, Z up. */
    | { kind: 'raise'; x: number; y: number; z: number }
    /** XY stationary, Z down. */
    | { kind: 'descend'; x: number; y: number; z: number }
    /** XY move at a fixed Z; `lifted` marks the park-height detour of a link the level could not make. */
    | { kind: 'hop'; x: number; y: number; z: number; lifted: boolean }
    /** Capture a frame here; `index` is the waypoint's 1-based position in the serpentine (gaps = dropped). */
    | { kind: 'capture'; x: number; y: number; z: number; index: number };

export interface SurveyLevelPlan {
    z: number;
    legs: SurveyLeg[];
    captures: number;
    /** Links that had to detour via the park height. */
    liftedLinks: number;
}

export interface SurveyDrop {
    z: number;
    x: number;
    y: number;
    /** 1-based waypoint index in the serpentine. */
    index: number;
    reason: string;
}

export interface SurveyPlan {
    levels: SurveyLevelPlan[];
    dropped: SurveyDrop[];
    /** Every motion the plan implies, for the operator's confirm page and the tests. */
    segments: MotionSegment[];
    captureCount: number;
    liftedLinks: number;
}

const r3 = (v: number) => Number(v.toFixed(3));

export function planSurvey(input: SurveyPlanInput): SurveyPlan {
    const { parkZ } = input;
    const clearance = { toolProtrusionMm: input.toolProtrusionMm, clearanceMarginMm: input.clearanceMarginMm };
    // Every stored box forbids entry, even one stored as 'crossing' for the
    // probing procedures: see the header.
    const volumes = input.obstacles.map((o) => ({ ...o, mode: 'volume' as const }));

    const levels: SurveyLevelPlan[] = [];
    const dropped: SurveyDrop[] = [];
    const segments: MotionSegment[] = [];
    let cur = { ...input.fromMachine };

    for (const z of input.levels) {
        const legs: SurveyLeg[] = [];
        let liftedLinks = 0;
        let captures = 0;
        const at = (w: SurveyWaypoint) => `(${w.x}, ${w.y})`;

        // 1. Which waypoints can be stood on at this height at all: the
        //    descent column from the park height, XY stationary.
        const kept: Array<{ w: SurveyWaypoint; index: number }> = [];
        input.waypoints.forEach((w, i) => {
            const column: MotionSegment = {
                kind: 'column',
                what: `Z${z} waypoint ${i + 1} ${at(w)} column`,
                from: { x: w.x, y: w.y, z: Math.max(parkZ, z) },
                to: { x: w.x, y: w.y, z },
            };
            const violations = checkMotion([column], volumes, clearance);
            if (violations.length) {
                dropped.push({
                    z,
                    x: w.x,
                    y: w.y,
                    index: i + 1,
                    reason: `the toolhead cannot stand at ${at(w)} at Z ${z}: ${describeViolations(violations)}. `
                        + 'Dropped from this pass rather than adjusted - the camera may look into a keep-out, the toolhead does not enter one.',
                });
                return;
            }
            kept.push({ w, index: i + 1 });
        });

        // 2. Visit them in serpentine order, checking every link at the height
        //    it would be made at, and lifting the ones the level cannot make.
        for (const { w, index } of kept) {
            const sameXY = Math.abs(cur.x - w.x) < POSITION_EPSILON_MM && Math.abs(cur.y - w.y) < POSITION_EPSILON_MM;
            // The height the link travels at: the higher of where we are and
            // where we are going - a level is entered by hopping at the
            // previous (higher) height and descending at the destination, or
            // by raising first when the new level is higher.
            const linkZ = Math.max(cur.z, z);
            const link: MotionSegment = {
                kind: 'hop',
                what: `Z${z} link ${at(cur)} -> waypoint ${index} ${at(w)} at Z${r3(linkZ)}`,
                from: { x: cur.x, y: cur.y, z: linkZ },
                to: { x: w.x, y: w.y, z: linkZ },
            };
            let travelZ = linkZ;
            let lifted = false;
            if (!sameXY && checkMotion([link], volumes, clearance).length) {
                const viaPark: MotionSegment = {
                    ...link,
                    what: `Z${z} lifted link ${at(cur)} -> waypoint ${index} ${at(w)} at park Z${parkZ}`,
                    from: { ...link.from, z: parkZ },
                    to: { ...link.to, z: parkZ },
                };
                const parkViolations = checkMotion([viaPark], volumes, clearance);
                if (parkViolations.length) {
                    dropped.push({
                        z,
                        x: w.x,
                        y: w.y,
                        index,
                        reason: `no route from ${at(cur)} reaches ${at(w)}: at Z ${r3(linkZ)} and even at the park height Z ${parkZ} the link `
                            + `crosses a keep-out: ${describeViolations(parkViolations)}.`,
                    });
                    continue;
                }
                travelZ = parkZ;
                lifted = true;
                liftedLinks += 1;
            }

            // Emit the legs: raise if the link is above us, hop, descend if
            // the level is below the link height, then capture.
            if (travelZ > cur.z + POSITION_EPSILON_MM) {
                legs.push({ kind: 'raise', x: cur.x, y: cur.y, z: travelZ });
                segments.push({ kind: 'column', what: `Z${z} raise at ${at(cur)} to Z${travelZ}`, from: { ...cur }, to: { x: cur.x, y: cur.y, z: travelZ } });
            }
            if (!sameXY) {
                legs.push({ kind: 'hop', x: w.x, y: w.y, z: travelZ, lifted });
                segments.push({
                    kind: 'hop',
                    what: lifted ? `Z${z} lifted link to waypoint ${index} ${at(w)} at Z${travelZ}` : `Z${z} link to waypoint ${index} ${at(w)}`,
                    from: { x: cur.x, y: cur.y, z: travelZ },
                    to: { x: w.x, y: w.y, z: travelZ },
                });
            }
            if (z < travelZ - POSITION_EPSILON_MM) {
                legs.push({ kind: 'descend', x: w.x, y: w.y, z });
                segments.push({ kind: 'column', what: `Z${z} descend at waypoint ${index} ${at(w)}`, from: { x: w.x, y: w.y, z: travelZ }, to: { x: w.x, y: w.y, z } });
            }
            legs.push({ kind: 'capture', x: w.x, y: w.y, z, index });
            captures += 1;
            cur = { x: w.x, y: w.y, z };
        }

        levels.push({ z, legs, captures, liftedLinks });
    }

    return {
        levels,
        dropped,
        segments,
        captureCount: levels.reduce((n, l) => n + l.captures, 0),
        liftedLinks: levels.reduce((n, l) => n + l.liftedLinks, 0),
    };
}

/** One gcode line per leg, for the confirm page: what the runner will send, in order. */
export function describeSurveyLegs(level: SurveyLevelPlan): string[] {
    return level.legs.map((leg) => {
        switch (leg.kind) {
            case 'raise':
                return `G1 Z${leg.z.toFixed(3)}; raise with XY stationary at (${leg.x}, ${leg.y})`;
            case 'descend':
                return `G1 Z${leg.z.toFixed(3)}; descend with XY stationary at (${leg.x}, ${leg.y}) into the Z${level.z} pass`;
            case 'hop':
                return `G0 X${leg.x.toFixed(1)} Y${leg.y.toFixed(1)}; ${leg.lifted
                    ? `LIFTED link at park Z${leg.z} - the Z${level.z} route crosses a keep-out`
                    : `link at Z${leg.z}`}`;
            default:
                return `; capture waypoint ${leg.index} at (${leg.x}, ${leg.y}) Z${leg.z}`;
        }
    });
}
