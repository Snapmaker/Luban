// Motion rules: the second approval-free rule on Settings -> MCP Server ->
// Motion rules (tyeth/Luban#265 R13, operator 2026-10-19): "allow safe
// traversal if tool distance/height known including toolhead unit and
// landmarks known (with extra 50mm clearance [configurable ideal distance and
// min distance])".
//
// This file holds what the rule NEEDS and whether a machine has it - the
// stored per-machine settings, their validation and the pure verdict
// computedHeightTraversePolicy(). Nothing here plans or runs a move: the
// planner that computes the height and the gate that uses this verdict are a
// later package. Until then the rule is displayed and stored only, and every
// move below top Z stages for the operator's click exactly as before.
//
// Pure: no server imports (procedureLimits.ts is pure too); unit-tested in
// tests/motionRules.test.ts.
import { Bounded, MOTION_RULE_CLEARANCE_IDEAL_MM, MOTION_RULE_CLEARANCE_MIN_MM, Range, TOOLHEAD_BODY_BELOW_REFERENCE_MM } from './procedureLimits';

/** The second per-machine toggle's name on the Motion rules pane. */
export const COMPUTED_HEIGHT_TOGGLE = 'Move without approval at a computed safe height (below top Z)';

/** A stored value with who stated it ('settings' = the operator's click on the pane) and when. */
export interface Stated<T> {
    value: T;
    source: string;
    setAt: number | null;
}

/** machineStore entry section `motionRules` (configstore key mcpMotionRules). */
export interface MotionRulesSection {
    computedHeight?: Stated<boolean>;
    clearanceIdealMm?: Stated<number>;
    clearanceMinMm?: Stated<number>;
    toolheadBodyBelowReferenceMm?: Stated<number>;
}

function stated<T>(raw: unknown, valid: (value: unknown) => value is T): Stated<T> | undefined {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const { value, source, setAt } = raw as { value?: unknown; source?: unknown; setAt?: unknown };
    if (!valid(value)) {
        return undefined;
    }
    return { value, source: typeof source === 'string' && source ? source : 'config', setAt: typeof setAt === 'number' ? setAt : null };
}

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const inRange = (range: Range) => (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
    && value >= range.min && value <= range.max;

/** The section of a store entry (or the section itself), with anything malformed or out of range dropped. */
export function motionRulesOf(machineEntry: { motionRules?: unknown } | null | undefined): MotionRulesSection {
    const raw = machineEntry && typeof machineEntry === 'object' ? machineEntry.motionRules : undefined;
    if (!raw || typeof raw !== 'object') {
        return {};
    }
    const section = raw as { [field: string]: unknown };
    const out: MotionRulesSection = {};
    const computedHeight = stated(section.computedHeight, isBoolean);
    const clearanceIdealMm = stated(section.clearanceIdealMm, inRange(MOTION_RULE_CLEARANCE_IDEAL_MM));
    const clearanceMinMm = stated(section.clearanceMinMm, inRange(MOTION_RULE_CLEARANCE_MIN_MM));
    const body = stated(section.toolheadBodyBelowReferenceMm, inRange(TOOLHEAD_BODY_BELOW_REFERENCE_MM));
    if (computedHeight) { out.computedHeight = computedHeight; }
    if (clearanceIdealMm) { out.clearanceIdealMm = clearanceIdealMm; }
    if (clearanceMinMm) { out.clearanceMinMm = clearanceMinMm; }
    if (body) { out.toolheadBodyBelowReferenceMm = body; }
    return out;
}

/** The clearances that apply: stated, else the named defaults. A stored pair with ideal < min reads as the defaults. */
export function clearancesOf(section: MotionRulesSection): { idealMm: number; minMm: number; source: { ideal: string; min: string } } {
    let ideal = section.clearanceIdealMm;
    let min = section.clearanceMinMm;
    const idealMm = ideal ? ideal.value : MOTION_RULE_CLEARANCE_IDEAL_MM.default;
    const minMm = min ? min.value : MOTION_RULE_CLEARANCE_MIN_MM.default;
    if (idealMm < minMm) {
        ideal = undefined;
        min = undefined;
    }
    return {
        idealMm: ideal ? ideal.value : MOTION_RULE_CLEARANCE_IDEAL_MM.default,
        minMm: min ? min.value : MOTION_RULE_CLEARANCE_MIN_MM.default,
        source: { ideal: ideal ? ideal.source : 'default', min: min ? min.source : 'default' },
    };
}

function settingNumber(name: string, raw: unknown, limit: Bounded): number {
    const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < limit.min || n > limit.max) {
        throw new Error(`${name} must be a number of mm in ${limit.min}..${limit.max} (default ${limit.default}); got ${JSON.stringify(raw)}.`);
    }
    return n;
}

/**
 * The Settings pane's clearance edit: each given value range-checked (null or
 * '' = back to the default), then ideal >= min on the RESULT, so changing one
 * of the pair cannot leave the stored pair inverted. Throws with the reason.
 */
export function validateClearanceSettings(
    input: { clearanceIdealMm?: unknown; clearanceMinMm?: unknown },
    section: MotionRulesSection
): { idealMm: number | null; minMm: number | null } {
    const pick = (raw: unknown, current: Stated<number> | undefined, name: string, limit: Bounded): number | null => {
        if (raw === undefined) {
            return current ? current.value : null;
        }
        if (raw === null || raw === '') {
            return null;
        }
        return settingNumber(name, raw, limit);
    };
    const idealMm = pick(input.clearanceIdealMm, section.clearanceIdealMm, 'clearanceIdealMm', MOTION_RULE_CLEARANCE_IDEAL_MM);
    const minMm = pick(input.clearanceMinMm, section.clearanceMinMm, 'clearanceMinMm', MOTION_RULE_CLEARANCE_MIN_MM);
    const effectiveIdeal = idealMm === null ? MOTION_RULE_CLEARANCE_IDEAL_MM.default : idealMm;
    const effectiveMin = minMm === null ? MOTION_RULE_CLEARANCE_MIN_MM.default : minMm;
    if (effectiveIdeal < effectiveMin) {
        throw new Error(`The ideal clearance (${effectiveIdeal} mm) cannot be below the minimum clearance (${effectiveMin} mm).`);
    }
    return { idealMm, minMm };
}

/** What the caller knows about the machine beyond its stored motion rules. */
export interface ComputedHeightFacts {
    /** The host-wide master switch (it stays the master OFF for every approval-free rule). */
    hostEnabled: boolean;
    /** Same eligibility as the top-Z toggle (tools/machine.ts motionRuleEligibility). */
    eligible: boolean;
    eligibilityReason: string | null;
    /** Trusted tool protrusion below the toolhead reference (clearanceContext.currentToolProtrusion), null when unknown. */
    toolProtrusionMm: number | null;
    /** Why the protrusion is unknown or not judged (e.g. not the connected machine). */
    toolProtrusionNote?: string | null;
    /** Measured PHYSICAL machine Z of the bed (rotaryGeometry bed_plane_z), null when not measured. */
    bedPlaneZ: number | null;
    /** The landmark review (#265 WP5): true confirmed and fresh, false unconfirmed or stale, null unknown (no review yet). */
    landmarksConfirmed: boolean | null;
    landmarksNote?: string | null;
}

export interface Requirement {
    id: 'operator' | 'host' | 'eligible' | 'tool-protrusion' | 'toolhead-body' | 'bed-plane' | 'landmarks';
    /** null = cannot be judged yet (counts as unmet). */
    met: boolean | null;
    detail: string;
}

export interface ComputedHeightVerdict {
    allowed: boolean;
    idealMm: number;
    minMm: number;
    /** The detail of every requirement not met, in order. */
    unmet: string[];
    requirements: Requirement[];
    /** How far the lowest point of toolhead + tool sits below the toolhead reference; null until both are known. */
    lowestPointBelowReferenceMm: number | null;
    /**
     * The toolhead machine Z at which that lowest point would touch the bed -
     * the "collision with bed" machine-coordinate equivalent; null until the
     * bed plane and the lowest point are known.
     */
    bedContactToolheadZ: number | null;
}

const mm = (n: number) => Number(n.toFixed(3));

/**
 * Whether a move at a computed safe height below top Z may run without the
 * operator's click on this machine: the operator's own toggle (Settings
 * only), the master switch, the top-Z eligibility, the lowest point of
 * toolhead + tool known as a machine-Z bed-contact equivalent, and the
 * landmarks confirmed. Any unknown is unmet - never a pass.
 */
export function computedHeightTraversePolicy(
    machineEntry: { motionRules?: unknown } | null | undefined,
    facts: ComputedHeightFacts
): ComputedHeightVerdict {
    const section = motionRulesOf(machineEntry);
    const { idealMm, minMm } = clearancesOf(section);
    const toggle = section.computedHeight;
    const operatorOn = !!toggle && toggle.value === true && toggle.source === 'settings';
    const body = section.toolheadBodyBelowReferenceMm;
    const protrusion = facts.toolProtrusionMm !== null && Number.isFinite(facts.toolProtrusionMm) ? facts.toolProtrusionMm : null;
    const lowest = protrusion !== null && body ? mm(Math.max(protrusion, body.value)) : null;
    const bed = facts.bedPlaneZ !== null && Number.isFinite(facts.bedPlaneZ) ? facts.bedPlaneZ : null;
    const bedContact = lowest !== null && bed !== null ? mm(bed + lowest) : null;

    const requirements: Requirement[] = [
        {
            id: 'operator',
            met: operatorOn,
            detail: operatorOn
                ? `'${COMPUTED_HEIGHT_TOGGLE}' is on (operator, Settings)`
                : `'${COMPUTED_HEIGHT_TOGGLE}' is off - only the operator turns it on, in Settings > MCP > Motion rules`,
        },
        {
            id: 'host',
            met: facts.hostEnabled,
            detail: facts.hostEnabled ? 'the master switch is on' : 'the master switch (approval-free moves) is off',
        },
        {
            id: 'eligible',
            met: facts.eligible,
            detail: facts.eligible ? 'machine eligible (Z axis, 2.0-family transport, Z policy stated)' : `not eligible: ${facts.eligibilityReason}`,
        },
        {
            id: 'tool-protrusion',
            met: protrusion !== null,
            detail: protrusion !== null
                ? `tool protrudes ${protrusion} mm below the toolhead reference (trusted)`
                : `tool protrusion unknown${facts.toolProtrusionNote ? ` (${facts.toolProtrusionNote})` : ''} - set_active_tool with `
                    + 'protrusion_reference toolhead, or set_tool_setter_config toolhead_clearance_bound',
        },
        {
            id: 'toolhead-body',
            met: !!body,
            detail: body
                ? `toolhead body reaches ${body.value} mm below the reference (${body.source})`
                : 'toolhead body below the reference not stated - set_machine_policy toolhead_body_below_reference_mm (measured)',
        },
        {
            id: 'bed-plane',
            met: bed !== null,
            detail: bed !== null
                ? `bed plane at machine Z${bed}${bedContact !== null ? `; the lowest point touches it at toolhead Z${bedContact}` : ''}`
                : 'bed plane not measured - set_probe_geometry bed_plane_z (measured physical machine Z)',
        },
        {
            id: 'landmarks',
            met: facts.landmarksConfirmed,
            detail: facts.landmarksNote || '',
        },
    ];
    const landmarks = requirements[requirements.length - 1];
    if (!facts.landmarksNote) {
        if (facts.landmarksConfirmed === null) {
            landmarks.detail = 'unknown until the landmark review lands (#265 WP5)';
        } else {
            landmarks.detail = facts.landmarksConfirmed ? 'landmarks confirmed' : 'landmarks not confirmed';
        }
    }
    const unmet = requirements.filter((r) => r.met !== true).map((r) => r.detail);
    return {
        allowed: unmet.length === 0,
        idealMm,
        minMm,
        unmet,
        requirements,
        lowestPointBelowReferenceMm: lowest,
        bedContactToolheadZ: bedContact,
    };
}
