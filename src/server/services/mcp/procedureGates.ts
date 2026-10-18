// Capability gates on the CNC procedures (#265 WP4b, plan 2.4 "procedures
// gate"). Every procedure below emits the Snapmaker 2.0 form - own-line
// `G53;` / `G54;` machine-frame windows, sensor-gated Z marches, `G92 Z` - and
// the rule is REFUSE RATHER THAN TRANSLATE: on a machine whose dialect row
// (gcodeDialect.ts) does not allow it the tool is refused at the tool
// boundary, before any planning reads position, with a reason naming the
// machine and its dialect. On a machine that passes, the tool runs exactly as
// before - the gate adds nothing to its G-code.
//
// This module is PURE (no server imports, unit-tested in
// tests/procedureGates.test.ts). index.ts binds it to the live connection via
// ToolRegistry.setProcedureGate, so a refusal is the first thing the agent
// sees; the USB pendant checks PENDANT_GATE when it arms.

import { DIALECTS } from './gcodeDialect';
import { CapabilityKey, MachineCapability, capabilityRefusal, deriveSupports } from './machineCapability';

export interface ProcedureGate {
    /** Every capability the procedure needs, in the order a refusal names them (the first missing one is reported). */
    needs: readonly CapabilityKey[];
    /** What it emits, for the refusal: "<action> needs <capability>, which ...". */
    action: string;
    /** Further needs that depend on the arguments (a rotate_b op adds the rotary axis). */
    needsFor?: (args: { [key: string]: unknown }) => CapabilityKey[];
    /**
     * Offline tools (file conversion that stages nothing) run with no machine
     * connected; they are refused only when a CONNECTED machine lacks a need.
     */
    offline?: boolean;
}

const PROBING = (what: string): ProcedureGate => ({
    needs: ['probing'],
    action: `${what} (sensor-gated probe marches in own-line G53 machine-frame windows)`,
});

/** True when a probe_program op list turns the rotary axis (a rotate_b op, or a group, which expands to rotate_b per angle). */
export function programTurnsB(ops: unknown): boolean {
    return Array.isArray(ops) && ops.some((op) => {
        const kind = op && typeof op === 'object' ? (op as { kind?: unknown }).kind : null;
        return kind === 'rotate_b' || kind === 'group';
    });
}

/** True when a probing program has a B word outside its comments (probeGcode.ts turns it into a rotation step). */
export function gcodeTurnsB(gcode: unknown): boolean {
    if (typeof gcode !== 'string') {
        return false;
    }
    return gcode.split(/\r?\n/).some((raw) => /(?:^|[^A-Z])B\s*[-+]?[.\d]/i.test(raw.replace(/\([^)]*\)/g, '').replace(/;.*$/, '')));
}

/**
 * The gated MCP tools. Tools left out on purpose (no G-code, generic motion
 * that WP4a dispatches per dialect, or files the validator judges) are listed
 * in the PR for #265 WP4b.
 */
export const PROCEDURE_GATES: { readonly [tool: string]: ProcedureGate } = {
    run_tool_setter: { needs: ['toolSetter'], action: 'run_tool_setter (a sensor-gated Z march onto the setter in own-line G53 moves)' },
    goto_tool_change_position: { needs: ['toolSetter'], action: 'goto_tool_change_position (own-line G53 Z then XY moves to the change position)' },
    apply_tool_length_offset: { needs: ['toolSetter'], action: 'apply_tool_length_offset (a G92 Z work-offset write from the setter measurement)' },

    probe_point: PROBING('probe_point'),
    probe_vector: PROBING('probe_vector'),
    probe_circle: PROBING('probe_circle'),
    probe_corner: PROBING('probe_corner'),
    probe_surface_grid: PROBING('probe_surface_grid'),
    probe_surface_path: PROBING('probe_surface_path'),
    probe_wall_follow: PROBING('probe_wall_follow'),
    probe_trace_perimeter: PROBING('probe_trace_perimeter'),
    probe_stock_outline: PROBING('probe_stock_outline'),
    probe_sequence: PROBING('probe_sequence'),
    probe_approach_and_hold: PROBING('probe_approach_and_hold'),
    probe_program: {
        ...PROBING('probe_program'),
        needsFor: (args) => (programTurnsB(args.ops) ? ['rotary'] : []),
    },
    run_probing_gcode: {
        ...PROBING('run_probing_gcode'),
        needsFor: (args) => (gcodeTurnsB(args.gcode) ? ['rotary'] : []),
    },

    survey_bed: { needs: ['zAxis', 'workspaces'], action: 'survey_bed (Z levels, hops and descents in own-line G53 machine-frame moves)' },

    set_workspace_origin: { needs: ['workspaces'], action: 'set_workspace_origin (G53; then G92 X Y Z into a named G54..G59.3 workspace)' },
    select_workspace: { needs: ['workspaces'], action: 'select_workspace (selects a named G54..G59.3 workspace and verifies it with M114)' },

    camera_bootstrap: { needs: ['zAxis', 'workspaces'], action: 'camera_bootstrap (G90 / G53; / G1 X Y Z / G54; capture moves)' },
    camera_program: { needs: ['zAxis', 'workspaces'], action: 'camera_program (G90 / G53; / G1 X Y Z / G54; capture moves)' },

    convert_thread_milling_gcode: {
        needs: ['spindle', 'workspaces'],
        action: 'convert_thread_milling_gcode (a Snapmaker 2.0 CNC file: G21 G90 G54 header, M3 spindle words)',
        offline: true,
    },
};

/** The USB pendant: continuous jogging in G53 windows, proved by M114 Count reports (pendantRuntime.ts, checked at arm). */
export const PENDANT_GATE: ProcedureGate = {
    needs: ['workspaces'],
    action: 'The USB pendant (continuous jogging in own-line G53 windows, proved by Snapmaker 2.0 M114 Count reports)',
};

/** Every capability `gate` needs for these arguments, in refusal order, without repeats. */
export function gateNeeds(gate: ProcedureGate, args: { [key: string]: unknown } = {}): CapabilityKey[] {
    const extra = gate.needsFor ? gate.needsFor(args) : [];
    return [...gate.needs, ...extra].filter((key, i, all) => all.indexOf(key) === i);
}

/** Labels of the dialect rows that allow every need (row facts alone, Z assumed): where this MCP runs the procedure. */
export function dialectsAllowing(needs: readonly CapabilityKey[]): string[] {
    return DIALECTS
        .filter((row) => row.id !== 'unknown')
        .filter((row) => {
            const supports = deriveSupports(row, true);
            return needs.every((key) => supports[key]);
        })
        .map((row) => row.label);
}

/**
 * The refusal for `gate` on `capability`, or null when it passes. The first
 * missing need is reported through capabilityRefusal (machine, missing fact,
 * table source), followed by why: the refusal is deliberate, which rows the
 * MCP runs it on, and that nothing was sent. It never suggests another way to
 * move the machine.
 */
export function gateRefusal(capability: MachineCapability, gate: ProcedureGate, args: { [key: string]: unknown } = {}): string | null {
    if (gate.offline && capability.identifier === null) {
        return null;
    }
    const needs = gateNeeds(gate, args);
    const missing = needs.find((key) => !capability.supports[key]);
    if (!missing) {
        return null;
    }
    const refusal = capabilityRefusal(capability, missing, gate.action);
    if (capability.identifier === null) {
        return `${refusal} Nothing was sent.`;
    }
    const allowed = dialectsAllowing(needs);
    const where = allowed.length ? `only on the ${allowed.join(' and ')} rows of its dialect table` : 'on no machine in its dialect table';
    return `${refusal} This refusal is deliberate: this MCP runs it ${where} (verified on hardware: the Snapmaker 2.0 A350), and `
        + `refuses rather than translates its Snapmaker 2.0 G-code for the ${capability.dialect.label}. Nothing was sent to the machine.`;
}

/** The refusal for MCP tool `tool` on `capability`, or null (it passes, or the tool is not gated). */
export function procedureRefusal(capability: MachineCapability, tool: string, args: { [key: string]: unknown } = {}): string | null {
    const gate = Object.prototype.hasOwnProperty.call(PROCEDURE_GATES, tool) ? PROCEDURE_GATES[tool] : null;
    return gate ? gateRefusal(capability, gate, args) : null;
}
