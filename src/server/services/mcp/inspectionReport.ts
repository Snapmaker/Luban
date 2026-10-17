// Pure renderers for the inspection report of a CAM probing program
// (mcp/49): the same measured points as JSON (always stored), as the Fusion
// 360 inspection results text, as CSV, and as Grbl-style [PRB:] lines.
//
// The Fusion format was verified (2026-09-07 review) against Autodesk's own
// "result generator probing.cps" (rev 44149) and haas_inspect_surface.cps:
//   START / RESULTSFILE <name>-RESULTS / DOCUMENTID / MODELVERSION /
//   TIMESTAMP yyMMdd HHmmss, then per toolpath TOOLPATHID <id> / TOOLPATH
//   <name> / G331 (CAD transform) / G330 (work plane transform), then per
//   point G800 (nominal: XYZ 4 dp, IJK normal 6 dp, O = inspectSurfaceOffset,
//   U upper tol, L lower tol SIGNED) and G801 (measured TIP-CENTRE XYZ, R =
//   stylus radius - Fusion subtracts R along the normal itself), then END.

import { LinkContactRecord } from './camLinks';
import { TipCalibrationSnapshot } from './toolDatum';
import { ProbeMeta, ProbeMode, ResultsMeta, Xyz } from './probeGcode';

export type { LinkContactRecord } from './camLinks';

export type ReportFormat = 'json' | 'fusion' | 'renishaw' | 'csv' | 'grbl';

export const REPORT_FORMATS: ReportFormat[] = ['json', 'fusion', 'renishaw', 'csv', 'grbl'];

export interface ProbeResultRecord {
    index: number;
    id: string;
    name: string | null;
    line: number;
    mode: ProbeMode;
    /** Rotary B angle the cycle ran at (3+2 station), null when unknown / not a 4-axis machine. */
    bDeg: number | null;
    /**
     * blocked: the cycle was never run because the LINK to its start touched
     * a wall or the descent at its start touched the top (issue #167) -
     * `blockedBy` is that link contact. A normal outcome, not a fault.
     */
    status: 'contact' | 'no_contact' | 'released' | 'not_released' | 'blocked';
    blockedBy?: LinkContactRecord;
    /** Where the cycle started and where it was programmed to stop (machine). */
    startMachine: Xyz;
    targetMachine: Xyz;
    /** Unit direction of the cycle. */
    direction: Xyz;
    /** Raw toolhead machine contact and unchanged WCS contact; null on a miss. */
    contactMachine: Xyz | null;
    contactWork: Xyz | null;
    /** Separate tip-bottom projection, retaining the datum applied when measured. */
    tipMachineZ?: number | null;
    tipCalibration?: TipCalibrationSnapshot;
    /** Distance travelled to the contact along the direction (mm); null on a miss. */
    travelMm: number | null;
    /** Programmed travel (start to target). */
    maxTravelMm: number;
    /** target - contact along the direction: positive = the surface was found BEFORE the target. */
    shortOfTargetMm: number | null;
    spreadMm: number | null;
    /**
     * Signed deviation of the measured SURFACE point (tip centre minus one tip
     * radius along the normal) from the nominal along the surface normal:
     * positive = material present beyond the nominal (surface toward the
     * probe), negative = material missing. null without a nominal, and null
     * without a stored tip diameter (a wrong number is worse than none).
     */
    deviationMm: number | null;
    withinTolerance: boolean | null;
    meta: ProbeMeta;
}

export interface InspectionReport {
    source: string;
    jobId: string | null;
    startedAt: number;
    endedAt: number;
    frame: { originOffset: Xyz; convention: string };
    tipDiameterMm: number | null;
    tipCalibration?: TipCalibrationSnapshot;
    /** TIP_CONVENTION, spelled out so a reader of the JSON knows what `contactWork` and the deviations mean. Absent on reports before #175. */
    tipConvention?: string;
    /** Program-level results metadata from a (RESULTS ...) comment, for the Fusion envelope. */
    results: ResultsMeta;
    probes: ProbeResultRecord[];
    /**
     * Touches made by LINKS between stations (a wall met by a stepped link, a
     * top met by a descent) - wall points in their own right, with the travel
     * direction; every one that blocked a station is also on that station's
     * record as `blockedBy`. Absent on reports written before issue #167.
     */
    linkContacts?: LinkContactRecord[];
    summary: {
        total: number;
        contacts: number;
        misses: number;
        /** Stations skipped because their link or descent met material (issue #167). */
        blocked?: number;
        outOfTolerance: number;
        maxAbsDeviationMm: number | null;
    };
    aborted?: string;
}

const f3 = (v: number) => v.toFixed(3);

/**
 * THE tip convention (issue #175, handoff 2026-09-21 §4 items 3-4). A recorded
 * contact is the tip REFERENCE point: the stylus ball's CENTRE in X and Y (the
 * toolhead XY) and its BOTTOM in Z - because probe_effective_length is
 * measured on the tool setter to the tip's bottom, so a -Z contact's Z already
 * IS the surface (physical = toolhead Z - probe length; in the work frame the
 * operator's Z0 was touched off the same way). The surface point a contact
 * measured is therefore the ball centre (reference + r up) pushed one radius
 * back along the outward normal:
 *
 *     surface = reference + (0, 0, r) - r * n
 *
 * -Z march (n = 0,0,1): surface = reference - no correction (the old code
 * subtracted r here and read every top 1.25 mm low). Side march (n
 * horizontal): the familiar one-radius push, at the ball-centre height.
 * Nominals from CAD are SURFACE points in the same frame.
 */
export const TIP_CONVENTION = 'contact = tip reference point (stylus-centre XY, stylus-BOTTOM Z: the effective length is measured to the tip bottom); '
    + 'surface = contact + (0,0,r) - r*normal; nominals are surface points';

export function surfaceFromContact(contact: Xyz, normal: Xyz, tipRadiusMm: number): Xyz {
    const len = Math.hypot(normal.x, normal.y, normal.z) || 1;
    const n = { x: normal.x / len, y: normal.y / len, z: normal.z / len };
    return {
        x: contact.x - n.x * tipRadiusMm,
        y: contact.y - n.y * tipRadiusMm,
        z: contact.z + tipRadiusMm - n.z * tipRadiusMm,
    };
}

function normalOf(p: ProbeResultRecord): Xyz {
    if (p.meta.normal) {
        const n = p.meta.normal;
        const len = Math.hypot(n.x, n.y, n.z) || 1;
        return { x: n.x / len, y: n.y / len, z: n.z / len };
    }
    // Without a stated normal the surface faces the approaching probe.
    return { x: -p.direction.x, y: -p.direction.y, z: -p.direction.z };
}

/** Nominal for the report: the stated nominal, else the programmed target (both in work frame). */
function nominalWorkOf(p: ProbeResultRecord, offset: Xyz): Xyz {
    if (p.meta.nominal) {
        if (p.meta.frame === 'machine') {
            return { x: p.meta.nominal.x + offset.x, y: p.meta.nominal.y + offset.y, z: p.meta.nominal.z + offset.z };
        }
        return p.meta.nominal;
    }
    return { x: p.targetMachine.x + offset.x, y: p.targetMachine.y + offset.y, z: p.targetMachine.z + offset.z };
}

const f4 = (v: number) => v.toFixed(4);
const f6 = (v: number) => v.toFixed(6);

function fusionTimestamp(ms: number): string {
    const d = new Date(ms);
    const two = (n: number) => String(n).padStart(2, '0');
    return `${String(d.getFullYear()).slice(-2)}${two(d.getMonth() + 1)}${two(d.getDate())} ${d.getHours()}${two(d.getMinutes())}${two(d.getSeconds())}`;
}

function resultsFileName(source: string): string {
    return `${source.replace(/:/g, '-').replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, '-') || 'RESULTS'}-RESULTS`;
}

/**
 * Fusion 360 inspection results (format verified from Autodesk's result
 * generator, see the file header). Work frame (the CAM's WCS). Points are
 * grouped per TOOLPATHID; a 3+2 station's B angle goes into G330's B word so
 * the import knows which rotated work plane a point belongs to. A miss emits
 * the nominal line only (Fusion's behaviour on an unpaired G800 is untested).
 */
export function renderFusion(report: InspectionReport): string {
    const offset = report.frame.originOffset;
    const r = report.tipDiameterMm === null ? 0 : report.tipDiameterMm / 2;
    const lines: string[] = [
        'START',
        `RESULTSFILE ${resultsFileName(report.source)}`,
        `DOCUMENTID ${report.results.documentId || ''}`,
        `MODELVERSION ${report.results.modelVersion || ''}`,
        `TIMESTAMP ${fusionTimestamp(report.endedAt || report.startedAt)}`,
        '',
    ];
    // One toolpath block per (toolpathId, B station) so G330 can carry the work plane.
    const groups = new Map<string, ProbeResultRecord[]>();
    for (const p of report.probes) {
        const key = `${report.results.toolpathId || '1.00001'}|${p.bDeg === null ? '' : p.bDeg}`;
        const list = groups.get(key) || [];
        list.push(p);
        groups.set(key, list);
    }
    for (const [key, list] of groups) {
        const [toolpathId] = key.split('|');
        lines.push(`TOOLPATHID ${toolpathId}`);
        lines.push(`TOOLPATH ${report.results.toolpath || report.source}`);
        for (const p of list) {
            const nom = nominalWorkOf(p, offset);
            const n = normalOf(p);
            const b = p.bDeg === null ? 0 : p.bDeg;
            lines.push(`G331 N${p.index} A0.0000 B0.0000 C0.0000 X0.0000 Y0.0000 Z0.0000`);
            lines.push(`G330 N${p.index} A0.0000 B${f4(b)} C0.0000 X0 Y0 Z0 I0 R0`);
            lines.push(`G800 N${p.index} X${f4(nom.x)} Y${f4(nom.y)} Z${f4(nom.z)} I${f6(n.x)} J${f6(n.y)} K${f6(n.z)} `
                + `O${f4(p.meta.surfaceOffsetMm ?? 0)} U${f4(p.meta.upperTolMm ?? 0)} L${f4(p.meta.lowerTolMm ?? 0)}`);
            if (p.contactWork) {
                // Fusion wants the stylus CENTRE and subtracts R along the normal
                // itself: the recorded Z is the tip bottom, so the centre is r up.
                lines.push(`G801 N${p.index} X${f4(p.contactWork.x)} Y${f4(p.contactWork.y)} Z${f4(p.contactWork.z + r)} R${f4(r)}`);
            }
        }
    }
    lines.push('END');
    return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------- Renishaw printout
//
// Fusion's importer reads Probe WCS / Probe Geometry results NOT as G800/G801
// but as the Renishaw Inspection Plus print-out (verified from Autodesk's
// "result generator probing.cps" and the Inspection Plus manual, appendix G):
//
//   -------------------------------------------------------------------
//      COMPONENT NO 1                   FEATURE NO 2
//   -------------------------------------------------------------------
//   SIZE D25.0000   ACTUAL 25.0412   TOL 0.1000   DEV 0.0412
//   POSN X10.0000   ACTUAL 10.0130   TOL TP 0.2000   DEV 0.0130
//   POSN Y20.0000   ACTUAL 19.9800   TOL TP 0.2000   DEV -0.0200
//             +++++OUT OF POS+++++ ERROR TP 0.0500 RADIAL
//
// inside the same START ... END envelope. Points are reduced to FEATURES by
// their (PROBE group= role=) metadata: roles x_minus/x_plus and
// y_minus/y_plus give a size along the axis and a centre; a lone point gives a
// POSN on the axis of its normal. Sizes and centres are of the SURFACE (tip
// centre minus one tip radius along each point's normal), so external and
// internal features come out right without a special case.

type Axis = 'x' | 'y' | 'z';

interface SurfacePoint {
    record: ProbeResultRecord;
    /** Work-frame surface point (tip centre corrected by one tip radius along the normal). */
    surface: Xyz;
    normal: Xyz;
    nominal: Xyz | null;
}

function surfacePointOf(p: ProbeResultRecord, offset: Xyz, tipRadius: number): SurfacePoint | null {
    if (!p.contactWork) {
        return null;
    }
    const n = normalOf(p);
    const nominal = p.meta.nominal ? nominalWorkOf(p, offset) : null;
    return {
        record: p,
        surface: surfaceFromContact(p.contactWork, n, tipRadius),
        normal: n,
        nominal,
    };
}

function dominantAxis(n: Xyz): Axis {
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    if (az >= ax && az >= ay) {
        return 'z';
    }
    return ax >= ay ? 'x' : 'y';
}

function firstDefined<T>(items: (T | undefined)[]): T | undefined {
    return items.find((v) => v !== undefined);
}

function sizeLine(nominal: number, actual: number, tol: number | undefined): string[] {
    const dev = actual - nominal;
    if (tol !== undefined && Math.abs(dev) > tol + 1e-9) {
        return [
            `SIZE D${f4(nominal)}   ACTUAL ${f4(actual)}   TOL ${f4(tol)}   DEV ${f4(dev)}`,
            '',
            `          +++++OUT OF TOL+++++ ERROR  ${f4(Math.abs(dev) - tol)}`,
            '',
        ];
    }
    return [`SIZE D${f4(nominal)}   ACTUAL ${f4(actual)}   DEV ${f4(dev)}`];
}

function positionLines(axes: { axis: Axis; nominal: number; actual: number }[], tol: number | undefined): string[] {
    const devs = axes.map((a) => a.actual - a.nominal);
    const out = tol !== undefined && devs.some((d) => Math.abs(d) > tol + 1e-9);
    const lines = axes.map((a, i) => `POSN ${a.axis.toUpperCase()}${f4(a.nominal)}   ACTUAL ${f4(a.actual)}`
        + `${tol !== undefined && out ? `   TOL TP ${f4(tol)}` : ''}   DEV ${f4(devs[i])}`);
    if (out && tol !== undefined) {
        const radial = Math.hypot(...devs.map((d) => Math.max(Math.abs(d) - tol, 0)));
        lines.push('', `          +++++OUT OF POS+++++ ERROR TP  ${f4(radial)} RADIAL`, '');
    }
    return lines;
}

/**
 * Renishaw Inspection Plus style printout of the FEATURES a program measured
 * (see the block comment above). Groups without enough points for a size
 * report their points individually; misses are listed as MISSED.
 */
export function renderRenishaw(report: InspectionReport): string {
    const offset = report.frame.originOffset;
    const r = report.tipDiameterMm === null ? 0 : report.tipDiameterMm / 2;
    const lines: string[] = [
        'START',
        `RESULTSFILE ${resultsFileName(report.source)}`,
        `DOCUMENTID ${report.results.documentId || ''}`,
        `MODELVERSION ${report.results.modelVersion || ''}`,
        `TIMESTAMP ${fusionTimestamp(report.endedAt || report.startedAt)}`,
        '',
        `TOOLPATHID ${report.results.toolpathId || '1.00001'}`,
        `TOOLPATH ${report.results.toolpath || report.source}`,
    ];
    if (report.tipDiameterMm === null) {
        lines.push('(no probe tip diameter stored: sizes and positions are of the tip CENTRE, not the surface)');
    }
    // Group by feature; ungrouped points are features of their own.
    const groups = new Map<string, ProbeResultRecord[]>();
    for (const p of report.probes) {
        const key = p.meta.group || `__point_${p.index}`;
        const list = groups.get(key) || [];
        list.push(p);
        groups.set(key, list);
    }
    let featureNo = 0;
    const rule = '-------------------------------------------------------------------';
    for (const [key, records] of groups) {
        featureNo += 1;
        lines.push(rule, `   COMPONENT NO 1                   FEATURE NO ${featureNo}`, rule);
        const name = key.startsWith('__point_') ? (records[0].name || records[0].id) : key;
        lines.push(`(FEATURE ${name}: ${records.map((p) => p.meta.role || p.name || p.id).join(', ')})`);
        const points = records.map((p) => surfacePointOf(p, offset, r)).filter((sp): sp is SurfacePoint => sp !== null);
        const missed = records.filter((p) => !p.contactWork);
        for (const m of missed) {
            if (m.status === 'blocked') {
                const at = m.blockedBy ? m.blockedBy.contactWork : null;
                lines.push(`(BLOCKED ${m.meta.role || m.name || m.id}: the link to this station met material`
                    + `${at ? ` at (${f4(at.x)}, ${f4(at.y)}, ${f4(at.z)})` : ''} - station skipped)`);
            } else {
                lines.push(`(MISSED ${m.meta.role || m.name || m.id}: no contact within ${f4(m.maxTravelMm)} mm)`);
            }
        }
        const byRole = (role: string) => points.find((sp) => sp.record.meta.role === role);
        const feature = firstDefined(records.map((p) => p.meta.feature));
        const nominalSize = firstDefined(records.map((p) => p.meta.nominalSizeMm));
        const nominalCenter = firstDefined(records.map((p) => p.meta.nominalCenter));
        const sizeTol = firstDefined(records.map((p) => p.meta.sizeTolMm));
        const posTol = firstDefined(records.map((p) => p.meta.positionTolMm));

        const spans: { axis: Axis; size: number; centre: number; nominalSize: number | null; nominalCentre: number | null }[] = [];
        for (const axis of ['x', 'y'] as Axis[]) {
            const lo = byRole(`${axis}_minus`);
            const hi = byRole(`${axis}_plus`);
            if (lo && hi) {
                const size = hi.surface[axis] - lo.surface[axis];
                spans.push({
                    axis,
                    size: Math.abs(size),
                    centre: (hi.surface[axis] + lo.surface[axis]) / 2,
                    nominalSize: lo.nominal && hi.nominal ? Math.abs(hi.nominal[axis] - lo.nominal[axis]) : null,
                    nominalCentre: lo.nominal && hi.nominal ? (hi.nominal[axis] + lo.nominal[axis]) / 2 : null,
                });
            }
        }
        if (spans.length) {
            // Circular features: one diameter from the mean of the spans; webs/pockets: one size per axis.
            const circular = feature === 'boss' || feature === 'hole' || (feature === undefined && spans.length === 2);
            if (circular) {
                const actual = spans.reduce((a, sp) => a + sp.size, 0) / spans.length;
                const nominalsKnown = spans.every((sp) => sp.nominalSize !== null);
                const nomFromPoints = nominalsKnown ? spans.reduce((a, sp) => a + (sp.nominalSize as number), 0) / spans.length : actual;
                const nom = nominalSize ?? nomFromPoints;
                lines.push(...sizeLine(nom, actual, sizeTol));
            } else {
                for (const sp of spans) {
                    lines.push(...sizeLine(nominalSize ?? sp.nominalSize ?? sp.size, sp.size, sizeTol));
                }
            }
            lines.push(...positionLines(spans.map((sp) => ({
                axis: sp.axis,
                nominal: nominalCenter ? nominalCenter[sp.axis as 'x' | 'y'] : (sp.nominalCentre ?? sp.centre),
                actual: sp.centre,
            })), posTol));
        }
        // Points that are not part of a span: report on the axis of their normal.
        const used = new Set<ProbeResultRecord>();
        for (const sp of spans) {
            const lo = byRole(`${sp.axis}_minus`);
            const hi = byRole(`${sp.axis}_plus`);
            if (lo) {
                used.add(lo.record);
            }
            if (hi) {
                used.add(hi.record);
            }
        }
        for (const sp of points) {
            if (used.has(sp.record)) {
                continue;
            }
            const axis = dominantAxis(sp.normal);
            const nominal = sp.nominal ? sp.nominal[axis] : sp.surface[axis];
            lines.push(...positionLines([{ axis, nominal, actual: sp.surface[axis] }],
                sp.record.meta.upperTolMm !== undefined ? Math.abs(sp.record.meta.upperTolMm) : posTol));
        }
    }
    lines.push('END');
    return `${lines.join('\n')}\n`;
}

export function renderCsv(report: InspectionReport): string {
    const head = ['index', 'id', 'name', 'group', 'role', 'b_deg', 'line', 'mode', 'status', 'contact_machine_x', 'contact_machine_y', 'contact_machine_z',
        'contact_work_x', 'contact_work_y', 'contact_work_z', 'travel_mm', 'max_travel_mm', 'short_of_target_mm', 'spread_mm',
        'nominal_x', 'nominal_y', 'nominal_z', 'deviation_mm', 'within_tolerance'];
    const rows = [head.join(',')];
    const offset = report.frame.originOffset;
    const cell = (v: number | null | undefined) => (v === null || v === undefined ? '' : f3(v));
    for (const p of report.probes) {
        const nom = p.meta.nominal ? nominalWorkOf(p, offset) : null;
        rows.push([
            p.index, p.id, p.name || '', p.meta.group || '', p.meta.role || '', p.bDeg === null ? '' : p.bDeg, p.line, p.mode, p.status,
            cell(p.contactMachine?.x), cell(p.contactMachine?.y), cell(p.contactMachine?.z),
            cell(p.contactWork?.x), cell(p.contactWork?.y), cell(p.contactWork?.z),
            cell(p.travelMm), f3(p.maxTravelMm), cell(p.shortOfTargetMm), cell(p.spreadMm),
            cell(nom?.x), cell(nom?.y), cell(nom?.z), cell(p.deviationMm),
            p.withinTolerance === null ? '' : String(p.withinTolerance),
        ].join(','));
    }
    // Link contacts follow as their own rows: wall points with the travel
    // direction, keyed by the line of the link and the station they were
    // heading for (issue #167 - until then they lived only in phase notes).
    for (const c of report.linkContacts || []) {
        rows.push([
            '', `link_L${c.line}`, `link_contact_${c.kind}`, '', c.outcome, c.bDeg === null ? '' : c.bDeg, c.line, `link:${c.kind}`, c.outcome,
            f3(c.contactMachine.x), f3(c.contactMachine.y), f3(c.contactMachine.z),
            f3(c.contactWork.x), f3(c.contactWork.y), f3(c.contactWork.z),
            '', '', '', '',
            f3(c.direction.x), f3(c.direction.y), f3(c.direction.z), '',
            c.towardStation ? `toward ${c.towardStation.name || c.towardStation.id}` : '',
        ].join(','));
    }
    return `${rows.join('\n')}\n`;
}

/** Grbl-style probe reports: [PRB:x,y,z:1] machine coordinates, 0 = no contact. */
export function renderGrbl(report: InspectionReport): string {
    return `${report.probes.map((p) => {
        const at = p.contactMachine || p.targetMachine;
        return `[PRB:${f3(at.x)},${f3(at.y)},${f3(at.z)}:${p.contactMachine ? 1 : 0}]`;
    }).join('\n')}\n`;
}

export function renderReport(report: InspectionReport, format: ReportFormat): string {
    if (format === 'fusion') {
        return renderFusion(report);
    }
    if (format === 'renishaw') {
        return renderRenishaw(report);
    }
    if (format === 'csv') {
        return renderCsv(report);
    }
    if (format === 'grbl') {
        return renderGrbl(report);
    }
    return `${JSON.stringify(report, null, 2)}\n`;
}

export function reportExtension(format: ReportFormat): string {
    if (format === 'json' || format === 'csv') {
        return format;
    }
    return 'txt';
}

/**
 * Deviation of the measured SURFACE from the nominal along the outward
 * surface normal, with the tolerance verdict. `contactWork` is the tip
 * REFERENCE point (TIP_CONVENTION: centre XY, bottom Z); the surface is
 * surfaceFromContact. The review of 2026-09-07 found the raw contact being
 * compared (a bias of one radius on side marches); the pass-1 report of
 * 2026-09-21 found the radius taken off -Z contacts too, which read every top
 * a radius low (issue #175). `lowerTol` is signed (<= 0) as Fusion configures it.
 */
export function deviationAlongNormal(
    contactWork: Xyz,
    nominalWork: Xyz,
    normal: Xyz,
    upperTol: number | undefined,
    lowerTol: number | undefined,
    tipRadiusMm: number
): { deviationMm: number; withinTolerance: boolean | null } {
    const len = Math.hypot(normal.x, normal.y, normal.z) || 1;
    const n = { x: normal.x / len, y: normal.y / len, z: normal.z / len };
    const surface = surfaceFromContact(contactWork, n, tipRadiusMm);
    const d = (surface.x - nominalWork.x) * n.x + (surface.y - nominalWork.y) * n.y + (surface.z - nominalWork.z) * n.z;
    const deviationMm = Number(d.toFixed(3));
    if (upperTol === undefined && lowerTol === undefined) {
        return { deviationMm, withinTolerance: null };
    }
    const up = Math.abs(upperTol ?? 0);
    const lo = -Math.abs(lowerTol ?? 0);
    return { deviationMm, withinTolerance: deviationMm <= up + 1e-9 && deviationMm >= lo - 1e-9 };
}
