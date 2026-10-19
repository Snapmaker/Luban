/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (rim_z_machine /
// surface_z_machine are read verbatim).
//
// Stylus reach: will the probe BODY land on the rim before the tip reaches
// the floor? (issue #187: an agent staged a floor probe of an internal pocket
// deeper than the stylus, and only the march's abort at its no-contact limit
// kept the body - ~10 mm across - off the workpiece.)
//
// The probe's tool length (its calibrated contact offset) says nothing about
// how far the TIP sticks out below the BODY: `probe_stylus_exposed_mm` is
// that number - tip bottom to the first body shoulder, measured or
// operator-stated for the fitted probe (set_probe_geometry). A -Z march
// staged inside a known pocket, i.e. with a stated rim (`rim_z_machine` or
// its alias `surface_z_machine`: the toolhead Z at which the tip touches the
// highest surface under the body), is refused at staging when the planned
// contact depth below that rim exceeds the reach minus the ball minus a
// margin. Without a stored reach the check cannot run, and every result and
// confirm page says so in these words rather than staying silent.
//
// Pure: no server imports (unit-tested in tests/stylusReach.test.ts). The
// geometry-store glue is rotaryGeometry.stylusReachForPlan.

import { MAX_STATED_MACHINE_Z_MM, STYLUS_REACH_MARGIN_MM, clampTo } from './procedureLimits';

export const STYLUS_REACH_UNKNOWN_TEXT = 'stylus reach unknown: body collision not checked';

export interface StylusReachInput {
    /** probe_stylus_exposed_mm: tip bottom to the first body shoulder; null = not stored. */
    reachMm: number | null;
    /** probe_tip_diameter: subtracted from the reach (the probing skill's convention); null = unknown, taken as 0 and said so. */
    tipDiameterMm: number | null;
    /** Toolhead Z at which the tip touches the rim / surrounding surface; null = not stated. */
    rimZMachine: number | null;
    /** The deepest toolhead Z the plan can command on its way down. */
    deepestZMachine: number;
    /** Air kept between the body shoulder and the rim (STYLUS_REACH_MARGIN_MM). */
    marginMm: number;
}

export interface StylusReachJudged {
    status: 'ok' | 'refused';
    /** How far below the rim the deepest planned contact lies. */
    depthBelowRimMm: number;
    /** reach - tip diameter - margin: the deepest contact the body clears. */
    allowedDepthMm: number;
    reachMm: number;
    tipDiameterMm: number | null;
    marginMm: number;
    rimZMachine: number;
    deepestZMachine: number;
    /** Toolhead Z below which the body would land on the rim. */
    bodyFloorZMachine: number;
    note: string;
}

export interface StylusReachUnknown {
    /** No reach stored: the collision cannot be judged; said in the result and on the page. */
    status: 'reach-unknown';
    depthBelowRimMm: number | null;
    rimZMachine: number | null;
    deepestZMachine: number;
    note: string;
}

export interface StylusRimUnknown {
    /** Reach stored, no rim stated: nothing to measure the depth from. */
    status: 'rim-unknown';
    reachMm: number;
    deepestZMachine: number;
    note: string;
}

export type StylusReachVerdict = StylusReachJudged | StylusReachUnknown | StylusRimUnknown;

const r3 = (v: number) => Number(v.toFixed(3));

/**
 * Judge the deepest planned contact against the stylus reach. Pure: the
 * caller supplies the stored geometry and the stated rim.
 */
export function checkStylusReach(input: StylusReachInput): StylusReachVerdict {
    const { reachMm, tipDiameterMm, rimZMachine, deepestZMachine, marginMm } = input;
    if (reachMm === null || !Number.isFinite(reachMm)) {
        const depth = rimZMachine === null ? null : r3(rimZMachine - deepestZMachine);
        return {
            status: 'reach-unknown',
            depthBelowRimMm: depth,
            rimZMachine: rimZMachine === null ? null : r3(rimZMachine),
            deepestZMachine: r3(deepestZMachine),
            note: `${STYLUS_REACH_UNKNOWN_TEXT}${depth === null
                ? ' (no probe_stylus_exposed_mm stored and no rim_z_machine stated)'
                : ` (deepest planned contact ${depth} mm below the stated rim Z${r3(rimZMachine as number)}; no probe_stylus_exposed_mm stored)`}`
                + ' - store the fitted probe\'s exposed stylus length (tip bottom to the first body shoulder) with set_probe_geometry probe_stylus_exposed_mm.',
        };
    }
    if (rimZMachine === null) {
        return {
            status: 'rim-unknown',
            reachMm,
            deepestZMachine: r3(deepestZMachine),
            note: `stylus reach ${reachMm} mm stored, no rim_z_machine stated: the depth below the surrounding surface is not checked `
                + '(state rim_z_machine / surface_z_machine - the toolhead Z at which the tip touches the rim - when probing inside a pocket or below a rim).',
        };
    }
    const tip = tipDiameterMm === null || !Number.isFinite(tipDiameterMm) ? 0 : tipDiameterMm;
    const allowed = r3(reachMm - tip - marginMm);
    const depth = r3(rimZMachine - deepestZMachine);
    const bodyFloor = r3(rimZMachine - allowed);
    const formula = `allowed depth = reach ${reachMm} - ball ${tipDiameterMm === null ? '0 (tip diameter unknown)' : tip} - margin ${marginMm} = ${allowed} mm`;
    const common = {
        depthBelowRimMm: depth,
        allowedDepthMm: allowed,
        reachMm,
        tipDiameterMm,
        marginMm,
        rimZMachine: r3(rimZMachine),
        deepestZMachine: r3(deepestZMachine),
        bodyFloorZMachine: bodyFloor,
    };
    if (depth > allowed + 1e-9) {
        return {
            status: 'refused',
            ...common,
            note: `REFUSED - the deepest planned contact (toolhead Z${common.deepestZMachine}) lies ${depth} mm below the stated rim `
                + `Z${common.rimZMachine}, but the probe body clears the rim only to ${allowed} mm (${formula}); below toolhead `
                + `Z${bodyFloor} the body lands on the rim. Shorten the march (max_travel_mm / the floor) so nothing is commanded below `
                + `Z${bodyFloor}, probe from a lower rim, or fit a longer stylus and re-state probe_stylus_exposed_mm.`,
        };
    }
    return {
        status: 'ok',
        ...common,
        note: `stylus reach checked: deepest planned contact ${depth} mm below the rim Z${common.rimZMachine}, within the ${allowed} mm the body clears (${formula}).`,
    };
}

export interface RimArgs {
    rim_z_machine?: unknown;
    surface_z_machine?: unknown;
    reach_margin_mm?: unknown;
}

export class RimArgError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'RimArgError';
    }
}

/**
 * The stated rim, from `rim_z_machine` or its alias `surface_z_machine`
 * (both are the toolhead Z at which the tip touches the highest surface
 * under the body). null when neither is given; both given and different is
 * a contradiction, refused. Pure: the caller maps RimArgError.
 */
export function parseRimZ(args: RimArgs): number | null {
    const given = (['rim_z_machine', 'surface_z_machine'] as const)
        .filter((key) => args[key] !== undefined && args[key] !== null && args[key] !== '')
        .map((key) => ({ key, value: Number(args[key]) }));
    if (!given.length) {
        return null;
    }
    for (const g of given) {
        if (!Number.isFinite(g.value) || g.value < 0 || g.value > MAX_STATED_MACHINE_Z_MM) {
            throw new RimArgError(`${g.key} must be a toolhead machine Z in 0..${MAX_STATED_MACHINE_Z_MM} (the Z at which the tip touches the rim / surrounding surface).`);
        }
    }
    if (given.length === 2 && Math.abs(given[0].value - given[1].value) > 1e-9) {
        throw new RimArgError(`rim_z_machine ${given[0].value} and surface_z_machine ${given[1].value} disagree - they are the same quantity; state one.`);
    }
    return given[0].value;
}

/** reach_margin_mm, clamped to STYLUS_REACH_MARGIN_MM; an explicit 0 is honoured (clampTo would read it as "absent"). */
export function parseReachMargin(args: RimArgs): number {
    if (args.reach_margin_mm === 0 || args.reach_margin_mm === '0') {
        return 0;
    }
    return clampTo(args.reach_margin_mm, STYLUS_REACH_MARGIN_MM);
}

/** One comment line for the confirm page. */
export function describeStylusReach(verdict: StylusReachVerdict): string {
    return `; STYLUS REACH: ${verdict.note}`;
}
