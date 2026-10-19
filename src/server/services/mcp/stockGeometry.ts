/* eslint-disable camelcase */
// Pure derivation of the stock section from a probe_program's results
// (mcp/48 W4): the numbers the 2026-09-05 four-face report worked out by hand.
// INFERENCE FOR PLANNING, never a clearance: every value is labelled with
// the ops it came from and the assumptions (probe names, axis settings).
//
// Conventions the derivation relies on (documented in the cnc-probing skill):
//   - sequence probes named `top` (a -Z probe on the face), `west` / `east`
//     (+X / -X marches at the sides), `end` (a +Y march onto the free end);
//   - surface_path ops carry `summary` and `lineFit` (slopeMmPer100Mm);
//   - every op result is tagged with the B angle it ran at (`b`).

export interface AxisLike {
    x: number;
    z_contact: number;
    tip_radius: number | null;
}

export interface OpResultForDerivation {
    id: string;
    kind: string;
    b: number | null;
    result: unknown;
}

export interface DerivedSection {
    note: string;
    assumptions: string[];
    /** Face height above the axis per B angle (toolhead contact Z - axis.z_contact). */
    faceHeights: { b: number; op: string; topZ: number; aboveAxisMm: number }[];
    /** Opposite-face pairs: thickness across the axis and the centring offset toward the first face. */
    pairs: { b: [number, number]; thicknessMm: number; offsetTowardFirstMm: number }[];
    /** Side contacts: centre-to-centre width and stock centre X per Y station; physical width = minus the tip diameter (external faces). */
    widths: { op: string; b: number | null; y: number; westX: number; eastX: number; centreX: number; widthMm: number; widthPhysicalMm: number | null }[];
    /** Yaw of the side pair: stock centre X change per 100 mm of Y (+ = toward +X as Y decreases, i.e. toward the free end). */
    yawXPer100Mm: number | null;
    /** End face Y per X station and its slope (mm per 100 mm of X). */
    endFace: { op: string; b: number | null; x: number; y: number }[];
    endSlopeYPer100Mm: number | null;
    /** Top-face slopes along the path ops, per B. */
    faceSlopes: { op: string; b: number | null; slopeMmPer100Mm: number; flatnessMm: number | null }[];
}

interface ProbeEntry { name: string; contactMachine: { x: number; y: number; z: number } }

function probes(result: unknown): ProbeEntry[] {
    const r = result as { results?: unknown } | null;
    if (!r || !Array.isArray(r.results)) {
        return [];
    }
    return r.results.filter((p): p is ProbeEntry => !!p && typeof p === 'object'
        && typeof (p as ProbeEntry).name === 'string' && !!(p as ProbeEntry).contactMachine);
}

function round3(v: number): number {
    return Number(v.toFixed(3));
}

function slopePer100(points: { s: number; v: number }[]): number | null {
    if (points.length < 2) {
        return null;
    }
    const n = points.length;
    const ms = points.reduce((a, p) => a + p.s, 0) / n;
    const mv = points.reduce((a, p) => a + p.v, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of points) {
        num += (p.s - ms) * (p.v - mv);
        den += (p.s - ms) * (p.s - ms);
    }
    return den < 1e-12 ? null : round3((num / den) * 100);
}

export function deriveStockSection(ops: OpResultForDerivation[], axis: AxisLike | null): DerivedSection {
    const assumptions: string[] = [
        'Probe names carry meaning: "top" = -Z probe on the face, "west"/"east" = side marches (+X / -X), "end" = +Y march onto the free end.',
        'Every contact is a TOOLHEAD machine Z / tip-centre XY; physical surface = Z - probe length; each external face lies one tip radius INSIDE its contact, so physical width = centre-to-centre minus the tip diameter.',
    ];
    const faceHeights: DerivedSection['faceHeights'] = [];
    const widths: DerivedSection['widths'] = [];
    const endFace: DerivedSection['endFace'] = [];
    const faceSlopes: DerivedSection['faceSlopes'] = [];
    const tipD = axis && axis.tip_radius !== null ? axis.tip_radius * 2 : null;

    for (const op of ops) {
        if (op.kind === 'sequence') {
            const list = probes(op.result);
            for (const p of list.filter((q) => q.name === 'top' || q.name.startsWith('top_'))) {
                if (axis && op.b !== null) {
                    faceHeights.push({ b: op.b, op: op.id, topZ: p.contactMachine.z, aboveAxisMm: round3(p.contactMachine.z - axis.z_contact) });
                }
            }
            const wests = list.filter((q) => q.name === 'west' || q.name.startsWith('west_'));
            const easts = list.filter((q) => q.name === 'east' || q.name.startsWith('east_'));
            for (const w of wests) {
                const e = easts.find((q) => Math.abs(q.contactMachine.y - w.contactMachine.y) < 1);
                if (e) {
                    const width = round3(e.contactMachine.x - w.contactMachine.x);
                    widths.push({
                        op: op.id,
                        b: op.b,
                        y: w.contactMachine.y,
                        westX: w.contactMachine.x,
                        eastX: e.contactMachine.x,
                        centreX: round3((w.contactMachine.x + e.contactMachine.x) / 2),
                        widthMm: width,
                        widthPhysicalMm: tipD === null ? null : round3(width - tipD),
                    });
                }
            }
            for (const p of list.filter((q) => q.name === 'end' || q.name.startsWith('end_'))) {
                endFace.push({ op: op.id, b: op.b, x: p.contactMachine.x, y: p.contactMachine.y });
            }
        } else if (op.kind === 'surface_path') {
            const r = op.result as { lineFit?: { slopeMmPer100Mm?: number; flatnessMm?: number } | null } | null;
            if (r && r.lineFit && typeof r.lineFit.slopeMmPer100Mm === 'number') {
                faceSlopes.push({ op: op.id, b: op.b, slopeMmPer100Mm: r.lineFit.slopeMmPer100Mm, flatnessMm: r.lineFit.flatnessMm ?? null });
            }
        }
    }

    const pairs: DerivedSection['pairs'] = [];
    const seen = new Set<string>();
    for (const a of faceHeights) {
        const opposite = ((a.b + 180) % 360 + 360) % 360;
        const partner = faceHeights.find((f) => (((f.b % 360) + 360) % 360) === opposite);
        const key = [a.b, opposite].sort((p, q) => p - q).join('/');
        if (partner && !seen.has(key)) {
            seen.add(key);
            pairs.push({
                b: [a.b, partner.b],
                thicknessMm: round3(a.aboveAxisMm + partner.aboveAxisMm),
                offsetTowardFirstMm: round3((a.aboveAxisMm - partner.aboveAxisMm) / 2),
            });
        }
    }
    if (axis) {
        assumptions.push(`Face heights use axis.z_contact ${axis.z_contact} (rotary axis Z + probe length from the settings).`);
    } else {
        assumptions.push('Rotary axis not configured: face heights and thicknesses are not derived.');
    }

    // Yaw: centre X vs Y across the side pairs (Y decreasing toward the free end).
    const yaw = slopePer100(widths.map((w) => ({ s: -w.y, v: w.centreX })));
    const endSlope = slopePer100(endFace.map((e) => ({ s: e.x, v: e.y })));

    const parts: string[] = [];
    for (const p of pairs) {
        parts.push(`B${p.b[0]}/B${p.b[1]} thickness ${p.thicknessMm} mm (offset ${p.offsetTowardFirstMm} toward B${p.b[0]})`);
    }
    if (widths.length) {
        const w0 = widths[0];
        parts.push(`width ${w0.widthMm} mm centre-to-centre${w0.widthPhysicalMm === null ? '' : ` (${w0.widthPhysicalMm} physical, minus the tip)`}, centre X ${w0.centreX}`);
    }
    if (yaw !== null) {
        parts.push(`yaw ${yaw} mm/100 mm in X toward the free end`);
    }
    if (endSlope !== null) {
        parts.push(`end face ${endSlope} mm/100 mm in Y across X`);
    }
    return {
        note: parts.length ? `Derived section (planning inference, NOT clearance): ${parts.join('; ')}.` : 'Derived section: not enough named probes to derive anything.',
        assumptions,
        faceHeights,
        pairs,
        widths,
        yawXPer100Mm: yaw,
        endFace,
        endSlopeYPer100Mm: endSlope,
        faceSlopes,
    };
}
