// Pure comparison of clearance candidates supplied by the caller. Production
// clearanceContext supplies only an applicable toolhead-reference active bound
// or an explicitly configured maximum for all allowable tools. Legacy comparison
// inputs remain for compatibility; raw setter offsets, collet lengths and approach
// estimates must not be supplied as physical bounds.
// No server imports; unit-tested in tests/toolProtrusion.test.ts.

export interface ToolProtrusionInputs {
    /** A stale assertion may lengthen the fallback, never shorten it. */
    staleToolMm?: number | null;
    /** The operator's current-tool assertion, when one has been established. */
    active?: { protrusionMm: number; source: string; status: string; measuredAt?: number | null } | null;
    /** The last tool-setter measurement of the fitted tool, if there has been one. */
    measured: { protrusionMm: number; at: number } | null;
    /** set_probe_geometry probe_effective_length: the touch probe may be the fitted tool. */
    probeEffectiveLengthMm: number | null;
    /** A separately established toolhead-reference worst-case bound, never an approach estimate. */
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
    'longest-bit': 'the configured toolhead-reference clearance bound',
};

export const PROTRUSION_UNKNOWN_NOTE = 'No toolhead-reference clearance bound is established. '
    + 'Use set_active_tool with protrusion_reference toolhead, a verified measured setter datum, or '
    + 'set_tool_setter_config toolhead_clearance_bound with its source. Legacy probe_effective_length '
    + '(set_probe_geometry), collet protrusion and approach lengths do not establish that physical bound; '
    + 'physical obstacles are refused while it is unknown.';

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
