// How far the fitted tool sticks out below the toolhead, resolved from what
// the server actually knows - and deliberately erring long.
//
// A usable active-tool assertion identifies the fitted tool and takes precedence.
// Without one, nothing tells this server which tool is in the collet. The tool setter
// measures one when it is asked to; the operator declares the longest bit in
// use and the touch probe's effective length once. Any of the three could be
// what is fitted right now, so a clearance check that must not be wrong takes
// the LONGEST of them. The measured value therefore only ever lengthens the
// requirement - it never shortens it on the strength of a measurement that
// may predate a tool change nobody told us about.
//
// This is the "extra cautious rather than risky" half of stating obstacle
// heights physically: the obstacle's top is a fact about the bed, and this is
// the most pessimistic fact available about the tool above it.
//
// Pure: no server imports, unit-tested in tests/toolProtrusion.test.ts.

export interface ToolProtrusionInputs {
    /** A stale assertion may lengthen the fallback, never shorten it. */
    staleToolMm?: number | null;
    /** The operator's current-tool assertion, when one has been established. */
    active?: { protrusionMm: number; source: string; status: string; measuredAt?: number | null } | null;
    /** The last tool-setter measurement of the fitted tool, if there has been one. */
    measured: { protrusionMm: number; at: number } | null;
    /** set_probe_geometry probe_effective_length: the touch probe may be the fitted tool. */
    probeEffectiveLengthMm: number | null;
    /** set_tool_setter_config longest_bit_length_mm: the operator's stated worst case. */
    longestBitLengthMm: number | null;
}

export type ProtrusionSource = 'active-tool' | 'stale-tool' | 'measured' | 'probe' | 'longest-bit';

export interface ToolProtrusion {
    /** Millimetres below the toolhead reference, or null when nothing at all is known. */
    mm: number | null;
    /** Which candidate won, i.e. which is longest. */
    source: ProtrusionSource | null;
    /** Everything considered, longest first - the refusal and the report both quote this. */
    candidates: Array<{ source: ProtrusionSource; mm: number; at?: number }>;
    note: string;
}

const LABEL: Record<ProtrusionSource, string> = {
    'stale-tool': 'the last confirmed tool (stale, conservative fallback only)',
    'active-tool': 'the active fitted tool',
    measured: 'the last tool-setter measurement',
    probe: 'the touch probe\'s effective length',
    'longest-bit': 'the longest bit in use',
};

export const PROTRUSION_UNKNOWN_NOTE = 'Nothing is known about how far the fitted tool protrudes: no tool-setter '
    + 'measurement, no probe_effective_length (set_probe_geometry) and no longest_bit_length_mm '
    + '(set_tool_setter_config). State one of them - a clearance over an obstacle of a known height cannot be '
    + 'computed without it, and nothing is assumed.';

export function resolveToolProtrusion(inputs: ToolProtrusionInputs): ToolProtrusion {
    if (inputs.active && Number.isFinite(inputs.active.protrusionMm) && inputs.active.protrusionMm > 0) {
        return {
            mm: inputs.active.protrusionMm,
            source: 'active-tool',
            candidates: [{ source: 'active-tool', mm: inputs.active.protrusionMm, at: inputs.active.measuredAt ?? undefined }],
            note: `Active tool is ${inputs.active.protrusionMm} mm from ${inputs.active.source} (${inputs.active.status}); routine route clearance uses this fitted-tool value.`,
        };
    }
    const candidates: Array<{ source: ProtrusionSource; mm: number; at?: number }> = [];
    if (typeof inputs.staleToolMm === 'number' && Number.isFinite(inputs.staleToolMm) && inputs.staleToolMm > 0) {
        candidates.push({ source: 'stale-tool', mm: inputs.staleToolMm });
    }
    if (inputs.measured && Number.isFinite(inputs.measured.protrusionMm) && inputs.measured.protrusionMm > 0) {
        candidates.push({ source: 'measured', mm: inputs.measured.protrusionMm, at: inputs.measured.at });
    }
    if (inputs.probeEffectiveLengthMm !== null && Number.isFinite(inputs.probeEffectiveLengthMm) && inputs.probeEffectiveLengthMm > 0) {
        candidates.push({ source: 'probe', mm: inputs.probeEffectiveLengthMm });
    }
    if (inputs.longestBitLengthMm !== null && Number.isFinite(inputs.longestBitLengthMm) && inputs.longestBitLengthMm > 0) {
        candidates.push({ source: 'longest-bit', mm: inputs.longestBitLengthMm });
    }
    candidates.sort((a, b) => b.mm - a.mm);

    if (!candidates.length) {
        return { mm: null, source: null, candidates, note: PROTRUSION_UNKNOWN_NOTE };
    }
    const winner = candidates[0];
    const others = candidates.slice(1).map((c) => `${LABEL[c.source]} ${c.mm} mm`).join(', ');
    return {
        mm: winner.mm,
        source: winner.source,
        candidates,
        note: `${winner.mm} mm, from ${LABEL[winner.source]}${others ? ` (longer than ${others})` : ''}. `
            + 'Nothing reports which tool is actually fitted, so the longest candidate is used.',
    };
}
