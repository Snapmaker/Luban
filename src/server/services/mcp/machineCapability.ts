// What the CONNECTED MACHINE can do, derived from its Luban machine definition
// (src/app/machines), so the motion laws stop assuming every machine is an
// A350 (issue #260 follow-up, 2026-10-18).
//
// On the Snapmaker Ray (a 600 x 400 laser with NO Z axis, definition size.z
// 0) the PR #261 build refused a 5 mm traverse_xy with "the toolhead is at
// machine Z 0.000, below the motion floor 320 ... Raise Z with move_z first":
// law 2 (XY transport only at or above the motion floor) was written for a
// gantry CNC, and on a machine with one height it makes every XY move
// impossible and the advice wrong. The same build applied the A350's stored
// landmarks (the rotary keep-out at X140-200), its camera calibrations and
// its stated travel to Ray coordinates, because those records were global.
//
// This module is PURE (no server imports, unit-tested in
// tests/machineCapability.test.ts). connectedMachine.ts binds it to the live
// connection; the tools read the capability from there.

export interface MachineSize {
    x: number;
    y: number;
    z: number;
}

/** The slice of a Luban `Machine` definition the capability is derived from. */
export interface MachineDefinitionLike {
    identifier: string;
    machineType: string;
    metadata: { size: MachineSize };
}

export interface MachineCapability {
    /** machineIdentifier as the connection reports it, e.g. "Ray", "Snapmaker 2.0 A350"; null when nothing is connected. */
    identifier: string | null;
    /** Luban MachineType, e.g. "Laser", "Multi-function 3D Printer"; null when the machine is unknown. */
    type: string | null;
    /** The definition's build volume; null when the machine is unknown. */
    size: MachineSize | null;
    /**
     * Whether the machine has a Z axis at all. The Ray's definition says
     * size.z 0 and that is the whole truth of it: there is no height to raise
     * to, no motion floor, no traverse height. An UNKNOWN machine is assumed
     * to have Z - the Z laws stay in force until the profile says otherwise,
     * because the laws exist to stop a crash and an unknown machine is not a
     * reason to relax them.
     */
    hasZ: boolean;
    /** True when the identifier matched a machine definition. */
    known: boolean;
}

/** The three facts every motion result and refusal carries, so an agent cannot miss which machine it is driving. */
export interface MachineSummary {
    identifier: string | null;
    type: string | null;
    hasZ: boolean;
}

/** machineIdentifier of the Snapmaker Ray (src/app/machines/snapmaker-ray.ts). */
export const RAY_IDENTIFIER = 'Ray';

/**
 * The machine every record written before machine scoping existed was set
 * on. Landmarks, camera calibrations and the stated travel were global until
 * 2026-10-18, and the only machine the MCP had ever been used with - every
 * live session in the README and the issue log - is the operator's A350. So a
 * record with no machineIdentifier is the A350's: it keeps applying there
 * exactly as before, and stops applying to the Ray.
 */
export const LEGACY_MACHINE_IDENTIFIER = 'Snapmaker 2.0 A350';

export function deriveMachineCapability(definition: MachineDefinitionLike | null, identifier: string | null = null): MachineCapability {
    if (!definition) {
        return { identifier, type: null, size: null, hasZ: true, known: false };
    }
    const size = definition.metadata.size;
    const hasZ = Number.isFinite(size.z) && size.z > 0;
    return {
        identifier: definition.identifier,
        type: definition.machineType,
        size: { x: size.x, y: size.y, z: size.z },
        hasZ,
        known: true,
    };
}

export function summariseMachine(capability: MachineCapability): MachineSummary {
    return { identifier: capability.identifier, type: capability.type, hasZ: capability.hasZ };
}

/** One parenthetical for refusal text: "(connected machine: Ray, Laser, no Z axis)". */
export function machineTag(capability: MachineCapability): string {
    if (capability.identifier === null) {
        return '(no machine connected)';
    }
    const type = capability.type ? `, ${capability.type}` : '';
    return `(connected machine: ${capability.identifier}${type}, ${capability.hasZ ? 'has a Z axis' : 'no Z axis'})`;
}

/**
 * The machine a stored record belongs to. A record written before scoping
 * carries no identifier and is the A350's (LEGACY_MACHINE_IDENTIFIER above).
 */
export function recordMachineScope(raw: unknown): string {
    const text = typeof raw === 'string' ? raw.trim() : '';
    return text || LEGACY_MACHINE_IDENTIFIER;
}

/**
 * Whether a record scoped to `scope` applies to the machine currently
 * connected. With no machine connected nothing applies: there is no motion
 * to check, and listing is a separate question (the stores' list() is
 * unscoped so get_stored_state can show every record with its scope).
 */
export function appliesToMachine(scope: string, connected: string | null): boolean {
    return connected !== null && recordMachineScope(scope) === connected;
}

/**
 * Was this record written before machine scoping existed? For
 * get_stored_state, so the operator can see which records were tagged by the
 * legacy rule rather than by the machine they were set on.
 */
export function isLegacyScope(raw: unknown): boolean {
    return !(typeof raw === 'string' && raw.trim());
}

// ---- Homing -----------------------------------------------------------------

export type HomeCommandKind = 'grbl-home' | 'sacp-home-request' | 'g28-sequence';

export interface HomeCommand {
    kind: HomeCommandKind;
    /** The text sent over the gcode path, or null for the SACP home request (a channel call, not gcode). */
    gcode: string | null;
    /** What the result and the gcode log call it. */
    label: string;
    /** Why this path, for the log. */
    reason: string;
}

export interface HomeCommandInput {
    /** The connection is a SACP channel (Ray, Artisan, J1). */
    sacp: boolean;
    machineIdentifier: string | null;
    /** The channel exposes executeGcode. */
    canExecuteGcode: boolean;
    /** The channel exposes goHome (the SACP 0x01/0x35 request). */
    canGoHome: boolean;
}

/** Luban's own Home button for the Snapmaker 2.0: home in the machine workspace, then reselect workspace 0. */
export const G28_HOME_SEQUENCE = 'G53;\nG28;\nG54;';
/** GRBL homing cycle - what Luban's Home button sends for the Ray (ConnectionControl/ControlPanel.tsx goHome). */
export const GRBL_HOME = '$H';

/**
 * How the connected machine is homed. Decided from the transport and the
 * machine identity, never from a reply: Ray firmware V1.7.4 does not answer
 * the SACP home request at all (observed 2026-10-18 - no reply, no motion,
 * the call hung until the client timed out), so waiting to find out is not
 * an option.
 */
export function homeCommandFor(input: HomeCommandInput): HomeCommand {
    if (input.sacp && input.machineIdentifier === RAY_IDENTIFIER && input.canExecuteGcode) {
        return {
            kind: 'grbl-home',
            gcode: GRBL_HOME,
            label: GRBL_HOME,
            reason: 'the Ray homes on GRBL $H, as Luban\'s Home button does for it; its firmware never answers the SACP 0x01/0x35 home request',
        };
    }
    if (input.sacp && input.canGoHome) {
        return {
            kind: 'sacp-home-request',
            gcode: null,
            label: 'SACP home request',
            reason: 'a SACP controller (Artisan, J1) homes on its own 0x01/0x35 request - the same call as Luban\'s Home button on this transport',
        };
    }
    return {
        kind: 'g28-sequence',
        gcode: G28_HOME_SEQUENCE,
        label: 'G28',
        reason: 'Luban\'s own Home button sends G53; G28; G54 - home in the machine workspace, then reselect workspace 0',
    };
}
