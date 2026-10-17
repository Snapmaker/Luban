/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
import * as fs from 'fs-extra';
import path from 'path';

import {
    CamLink,
    LINK_MODES,
    LinkContactRecord,
    LinkMode,
    blockedStationSpan,
    classifyCamLinks,
    describeLinkStyle,
    judgeLinkDescentContact,
    linkAt,
    linkDescentMayBlock,
    topLinkLiftCap,
} from './camLinks';
import { MotionSegment, checkMotion, describeViolations } from './envelopeChecks';
import {
    InspectionReport,
    ProbeResultRecord,
    ReportFormat,
    TIP_CONVENTION,
    deviationAlongNormal,
    renderReport,
    reportExtension,
} from './inspectionReport';
import { clearanceOptions } from './clearanceContext';
import { landmarkStore } from './landmarks';
import {
    MarchParams,
    SteppedBlock,
    Xyz,
    linkDescent,
    makeAnnounce,
    marchToContact,
    retreatAlong,
    steppedTraverseWall,
    steppedTraverseZ,
} from './march';
import { probeFeedService } from './probeFeed';
import { probeAbortHeld } from './programAbort';
import { ParsedProbeGcode, ProbeGcodeError, parseProbingGcode } from './probeGcode';
import { DESCENT_GUARD_MM } from './probeSequence';
import {
    COARSE_FEED,
    DESCENT_SEGMENT_MM,
    ProcedureAbort,
    ProcedureStopped,
    RECHECK_TOLERANCE_MM,
    TRAVEL_FEED,
    assertChannelReady,
    assertMachineReadyForProcedure,
    expectMachinePosition,
    knownMachinePosition,
    moveMachineSettled,
    rotateB,
    senseReleaseAfter,
    sleep,
    isProcedureAbort,
    isProcedureStopped,
    abortRaiseToTop,
} from './probing';
import {
    GPIO_SENSOR_DELAY_MS,
    HOP_LIFT_MM,
    RADIAL_TOLERANCE_DEG,
    WALL_MARGIN_MM,
    releaseTimeoutFor,
    resolveMarchParams,
    within,
} from './procedureLimits';
import { McpToolError } from './registry';
import { probeGeometry } from './rotaryGeometry';
import { projectToolTipZ } from './toolDatum';
import { getProbeTipCalibration } from './toolDatumState';
import { assertWithinTravel, getPositionSnapshot, requirePlanningTravel, safeTraverseZ } from './tools/machine';
import DataStorage from '../../DataStorage';
import { TRAVERSE_Z_TOLERANCE_MM } from './traversePlan';
import {
    KnownWall,
    WallCheck,
    WallSpecError,
    checkWallClearance,
    describeWallViolation,
    nominalWalls,
    normalizeKnownWalls,
} from './wallClearance';

// run_probing_gcode (mcp/49, operator request 2026-09-07): a probing program
// written by CAM (Fusion 360, FreeCAD, a Grbl/Marlin post, or by hand) is
// PARSED, never sent to the controller as-is - the Snapmaker firmware has no
// G38 probing cycle and a raw program would obey none of the motion laws.
// Every step is translated:
//
//   G38.2 / G38.3   -> a sensor-gated march (march.ts) from the current point
//                      toward the programmed target, the target being the
//                      travel limit; the probe retreats to the cycle start,
//                      as the parser assumes. G38.2 without contact aborts
//                      (Grbl semantics) unless on_miss: continue; G38.3 records.
//   G38.4 / G38.5   -> a probe-away: coarse steps along the vector until the
//                      probe RELEASES, then on to the target (G38.4 without a
//                      release aborts; G38.5 records).
//   G0 / G1 links   -> law 2: XY travel at the safe traverse height (raise,
//                      traverse, guarded segmented descent to the programmed
//                      Z) - link_mode "raise", the default - or a stepped
//                      touch-probing traverse at the programmed height
//                      (link_mode "stepped" / "wall", camLinks.ts): over a TOP
//                      a contact lifts +Z and retries; heading for a WALL
//                      station a contact retreats along the path just
//                      travelled, is recorded as a link_contact, and the
//                      station is BLOCKED - the run continues (issue #167).
//                      A pure Z drop is a guarded segmented descent whose
//                      contact at a stepped link's destination is likewise a
//                      blocked station; a pure Z rise a move.
//   G0 B<angle>     -> a 3+2 station: the head is raised to the safe traverse
//                      height first (inserted here, law 2, enumerated on the
//                      page), then rotate_b's absolute rotation on the direct
//                      path verified by M114 / the heartbeat's b. B together
//                      with X/Y/Z, incremental B, and A/C are refused.
//   G4              -> a dwell; comments -> notes on the record.
//
// Programmed feeds are ignored (the march's own coarse/fine feeds keep the
// press bounded); coordinates are the CAM's WCS (work frame, G54) unless
// frame: "machine" or a G53 line. The result is an inspection report the CAM
// can read back (Fusion G800/G801 text, CSV, Grbl [PRB:], JSON).

export type { LinkMode } from './camLinks';

export interface ProbeCamPlan {
    tool: 'run_probing_gcode';
    source: string;
    parsed: ParsedProbeGcode;
    linkMode: LinkMode;
    /** Per XY link: the behaviour it gets and the station it heads for (camLinks.ts). */
    links: CamLink[];
    hopLiftMm: number;
    /**
     * Operator-stated toolhead Z of the top surface the stations are cut into
     * (machine), or null. A top-style stepped lift never rises above it, and a
     * raise-mode descent contact AT it is a blocked station, not a collision.
     */
    topZMachine: number | null;
    /** Planning clearance of every station start and link path from the known walls (wallClearance.ts). */
    wallCheck: WallCheck;
    onMiss: 'abort' | 'continue';
    march: MarchParams;
    hopZ: number;
    staged: Xyz;
    originOffset: Xyz;
    frame: 'work' | 'machine';
    tipDiameterMm: number | null;
    reportFormat: ReportFormat;
    warnings: string[];
}

interface CamArgs {
    gcode?: unknown;
    source?: unknown;
    frame?: unknown;
    link_mode?: unknown;
    hop_lift_mm?: unknown;
    top_z_machine?: unknown;
    known_walls?: unknown;
    wall_margin_mm?: unknown;
    radial_tolerance_deg?: unknown;
    on_miss?: unknown;
    report_format?: unknown;
    coarse_step_mm?: unknown;
    fine_step_mm?: unknown;
    backoff_mm?: unknown;
    sensor_delay_ms?: unknown;
    confirm_passes?: unknown;
}

const r3 = (v: number) => Number(v.toFixed(3));
const MAX_PROBE_TRAVEL_MM = 150;
const MAX_STEPS = 400;

function unitOf(from: Xyz, to: Xyz): { unit: Xyz; length: number } {
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const length = Math.hypot(d.x, d.y, d.z);
    return { unit: { x: d.x / length, y: d.y / length, z: d.z / length }, length: r3(length) };
}

/** Motion list for the keep-out check, following the link policy. */
export function camMotion(plan: ProbeCamPlan): MotionSegment[] {
    const out: MotionSegment[] = [];
    plan.parsed.steps.forEach((step, index) => {
        if (step.kind === 'probe') {
            out.push({ kind: 'march', what: `line ${step.line} ${step.mode}`, from: step.from, to: step.target });
        } else if (step.kind === 'move') {
            const xyMoves = step.from.x !== step.target.x || step.from.y !== step.target.y;
            if (!xyMoves) {
                if (step.target.z < step.from.z) {
                    out.push({ kind: 'column', what: `line ${step.line} descent`, from: step.from, to: step.target });
                }
                return;
            }
            const link = linkAt(plan.links, index);
            if (!link || link.style === 'raise') {
                out.push({ kind: 'hop', what: `line ${step.line} traverse`, from: { ...step.from, z: plan.hopZ }, to: { ...step.target, z: plan.hopZ } });
                out.push({ kind: 'column', what: `line ${step.line} descent`, from: { ...step.target, z: plan.hopZ }, to: step.target });
            } else {
                const linkZ = Math.max(step.from.z, step.target.z);
                out.push({ kind: 'march', what: `line ${step.line} stepped link`, from: { ...step.from, z: linkZ }, to: { ...step.target, z: linkZ } });
                if (step.target.z < linkZ) {
                    out.push({ kind: 'column', what: `line ${step.line} descent`, from: { ...step.target, z: linkZ }, to: step.target });
                }
            }
        }
    });
    return out;
}

export function planProbeCam(args: CamArgs): ProbeCamPlan {
    const gcode = String(args.gcode || '');
    if (!gcode.trim()) {
        throw new McpToolError('gcode is required: the probing program text (Grbl / Marlin dialect, G38.x cycles).');
    }
    const source = String(args.source || 'probing program').trim().slice(0, 80);
    const frame = args.frame === 'machine' ? 'machine' : 'work';
    if (args.link_mode !== undefined && !LINK_MODES.includes(args.link_mode as LinkMode)) {
        throw new McpToolError('link_mode must be "raise" (XY at the traverse height, default), "stepped" (touch-probing traverse at the programmed '
            + 'height; wall-aware when the station ahead is a side march) or "wall" (every stepped link wall-aware).');
    }
    const linkMode: LinkMode = args.link_mode === undefined ? 'raise' : (args.link_mode as LinkMode);
    const onMiss = args.on_miss === 'continue' ? 'continue' : 'abort';
    const reportFormat = (args.report_format === undefined ? 'fusion' : String(args.report_format)) as ReportFormat;
    if (!['json', 'fusion', 'renishaw', 'csv', 'grbl'].includes(reportFormat)) {
        throw new McpToolError('report_format must be fusion, renishaw, csv, grbl or json.');
    }
    const hopLift = args.hop_lift_mm === undefined ? HOP_LIFT_MM.default : Number(args.hop_lift_mm);
    if (!within(hopLift, HOP_LIFT_MM)) {
        throw new McpToolError(`hop_lift_mm must be ${HOP_LIFT_MM.min}-${HOP_LIFT_MM.max}.`);
    }

    const snapshot = getPositionSnapshot();
    const { x, y, z } = snapshot.machine;
    if (x === null || y === null || z === null) {
        throw new McpToolError('Current machine position unknown; cannot anchor the program.');
    }
    if (frame === 'work' && snapshot.originOffsetSource === 'assumed-zero') {
        throw new McpToolError('The work origin offset is unknown (heartbeat reports none yet), so a work-frame program cannot be placed. '
            + 'Wait for a heartbeat with the offset, or pass frame: "machine" for a program already in machine coordinates.');
    }
    const originOffset = frame === 'machine' ? { x: 0, y: 0, z: 0 } : { ...snapshot.originOffset };
    const hopZ = safeTraverseZ();
    let topZMachine: number | null = null;
    if (args.top_z_machine !== undefined && args.top_z_machine !== null && args.top_z_machine !== '') {
        topZMachine = Number(args.top_z_machine);
        if (!within(topZMachine, { min: 0, max: hopZ })) {
            throw new McpToolError(`top_z_machine must be a MEASURED toolhead machine Z of the top surface, 0..${hopZ} (the traverse height).`);
        }
    }

    let parsed: ParsedProbeGcode;
    try {
        parsed = parseProbingGcode(gcode, { startMachine: { x, y, z }, originOffset, startB: snapshot.b });
    } catch (err) {
        if (err instanceof ProbeGcodeError) {
            throw new McpToolError(`Probing program refused: ${err.message}`);
        }
        throw err;
    }
    const motionSteps = parsed.steps.filter((s) => s.kind === 'move' || s.kind === 'probe' || s.kind === 'rotate');
    if (parsed.rotations.length && !snapshot.isFourAxis) {
        throw new McpToolError(`The program rotates B (${parsed.rotations.join(', ')} deg) but the heartbeat reports no B axis - is the rotary module installed and selected?`);
    }
    if (motionSteps.length > MAX_STEPS) {
        throw new McpToolError(`${motionSteps.length} motion steps exceeds the cap of ${MAX_STEPS} per program - split it.`);
    }
    const warnings = [...parsed.warnings];
    if (parsed.steps.some((s) => (s.kind === 'move' || s.kind === 'probe') && s.feed !== null)) {
        warnings.push('Programmed feeds are ignored: probe cycles run the sensor-gated march (coarse F100 / fine F60), links at the traverse feed.');
    }

    // Travel and per-step validity: every move and probe target inside the
    // toolhead's real travel (machineTravel.ts), not the -25..size+40 slop.
    const travel = requirePlanningTravel('a probing program');
    for (const step of parsed.steps) {
        if (step.kind !== 'move' && step.kind !== 'probe') {
            continue;
        }
        const t = step.target;
        assertWithinTravel([{ label: `line ${step.line}: target`, x: t.x, y: t.y }], travel);
        if (t.z < 0 || t.z > hopZ + 1e-9) {
            throw new McpToolError(`line ${step.line}: target Z${t.z} is outside 0..${hopZ} (the safe traverse height).`);
        }
        if (step.kind === 'probe') {
            const { unit, length } = unitOf(step.from, step.target);
            if (length > MAX_PROBE_TRAVEL_MM) {
                throw new McpToolError(`line ${step.line}: ${step.mode} travel ${length} mm exceeds ${MAX_PROBE_TRAVEL_MM} mm.`);
            }
            if ((step.mode === 'G38.2' || step.mode === 'G38.3') && unit.z > 1e-9) {
                throw new McpToolError(`line ${step.line}: upward probing (${step.mode} with +Z) is refused - the probe cannot measure the gantry.`);
            }
        }
    }
    const links = classifyCamLinks(parsed.steps, linkMode);
    if (topZMachine !== null) {
        const topZ = topZMachine;
        const lowestLink = links
            .filter((l) => l.style === 'top')
            .map((l) => { const st = parsed.steps[l.stepIndex]; return st.kind === 'move' ? Math.max(st.from.z, st.target.z) : hopZ; });
        if (lowestLink.some((lz) => lz > topZ + TRAVERSE_Z_TOLERANCE_MM)) {
            warnings.push(`top_z_machine ${topZMachine}: some stepped links run ABOVE the stated top - a contact on them has no lift room and marks the station blocked at once.`);
        }
    }

    // Wall clearance at planning time (handoff 2026-09-21 §4 0a): the tip
    // must fit at every station start and along every link path, judged
    // against the walls the agent declares (measured - refuse) and the ones
    // the program's own nominals describe (CAD intent - warn).
    const tipDiameterMm = (probeGeometry() || { tipDiameter: null }).tipDiameter;
    const toMachineXy = (p: { x: number; y: number }) => ({ x: r3(p.x - originOffset.x), y: r3(p.y - originOffset.y) });
    let declared: KnownWall[] = [];
    try {
        declared = normalizeKnownWalls(args.known_walls, toMachineXy);
    } catch (err) {
        if (err instanceof WallSpecError) {
            throw new McpToolError(err.message);
        }
        throw err;
    }
    let marginMm = 0;
    if (args.wall_margin_mm !== undefined && args.wall_margin_mm !== null && args.wall_margin_mm !== '') {
        marginMm = Number(args.wall_margin_mm);
        if (!within(marginMm, WALL_MARGIN_MM)) {
            throw new McpToolError(`wall_margin_mm must be ${WALL_MARGIN_MM.min}..${WALL_MARGIN_MM.max} mm (air beyond the tip radius a station start or link keeps from a known wall).`);
        }
    } else if (declared.length) {
        throw new McpToolError('wall_margin_mm is required with known_walls: how much air beyond the tip radius every station start and link path must '
            + 'keep from the declared walls (their measurement uncertainty - there is no default).');
    }
    if (declared.length && tipDiameterMm === null) {
        throw new McpToolError('known_walls given but no probe tip diameter is stored, so "does the tip fit" cannot be judged - '
            + 'set_probe_geometry probe_tip_diameter first (measured, e.g. from a post + hole pair).');
    }
    let radialToleranceDeg: number | null = null;
    if (args.radial_tolerance_deg !== undefined && args.radial_tolerance_deg !== null && args.radial_tolerance_deg !== '') {
        radialToleranceDeg = Number(args.radial_tolerance_deg);
        if (!within(radialToleranceDeg, RADIAL_TOLERANCE_DEG)) {
            throw new McpToolError(`radial_tolerance_deg must be ${RADIAL_TOLERANCE_DEG.min}..${RADIAL_TOLERANCE_DEG.max}.`);
        }
    }
    const stationStarts: Parameters<typeof checkWallClearance>[0]['stationStarts'] = [];
    const linkPaths: Parameters<typeof checkWallClearance>[0]['linkPaths'] = [];
    parsed.steps.forEach((step, index) => {
        if (step.kind === 'probe') {
            stationStarts.push({ stepIndex: index, line: step.line, station: step.meta.name || step.meta.id || String(step.index), at: { ...step.from } });
            return;
        }
        const link = linkAt(links, index);
        if (!link || step.kind !== 'move') {
            return;
        }
        const linkZ = link.style === 'raise' ? hopZ : Math.max(step.from.z, step.target.z);
        const station = link.station ? link.station.name || link.station.id : null;
        linkPaths.push({ line: step.line, station, from: { ...step.from, z: linkZ }, to: { ...step.target, z: linkZ } });
    });
    const wallCheck = checkWallClearance({
        steps: parsed.steps,
        stationStarts,
        linkPaths,
        declared,
        nominal: nominalWalls(parsed.steps, topZMachine),
        tipRadiusMm: tipDiameterMm === null ? null : r3(tipDiameterMm / 2),
        marginMm,
        radialToleranceDeg,
        epsilonMm: TRAVERSE_Z_TOLERANCE_MM,
    });
    if (wallCheck.violations.length) {
        throw new McpToolError(`Probing program refused (wall clearance, ${wallCheck.violations.length} violation(s) against the declared known_walls): `
            + `${wallCheck.violations.slice(0, 6).map(describeWallViolation).join('; ')}${wallCheck.violations.length > 6 ? '; ...' : ''}. `
            + 'Move the station starts (>= tip radius + margin clear of every wall, corner arcs approached radially from the fitted centre) and re-stage.');
    }
    for (const w of wallCheck.warnings) {
        warnings.push(`wall clearance (nominal, not refused): ${describeWallViolation(w)}${tipDiameterMm === null ? ' [tip diameter unknown: judged with tip radius 0]' : ''}`);
    }
    for (const r of wallCheck.radialWarnings) {
        warnings.push(`radial approach: line ${r.line} station "${r.station}" marches ${r.offRadialDeg} deg off the radial of arc "${r.wall}" (tolerance ${radialToleranceDeg}).`);
    }

    const plan: ProbeCamPlan = {
        tool: 'run_probing_gcode',
        source,
        parsed,
        linkMode,
        links,
        hopLiftMm: hopLift,
        topZMachine,
        wallCheck,
        onMiss,
        // Operator law 2026-09-05: never 2 mm; GPIO sensor floor (procedureLimits.ts).
        march: resolveMarchParams(args, { delay: GPIO_SENSOR_DELAY_MS }),
        hopZ,
        staged: { x, y, z },
        originOffset,
        frame,
        tipDiameterMm,
        reportFormat,
        warnings,
    };

    const violations = checkMotion(camMotion(plan), landmarkStore.obstacleBoxes(), { traverseZ: hopZ, ...clearanceOptions() });
    if (violations.length) {
        throw new McpToolError(`Probing program refused (law 4, landmarks are obstacles): ${describeViolations(violations)}.`);
    }
    return plan;
}

function stationLabel(link: CamLink | null): string {
    return link && link.station ? `"${link.station.name || link.station.id}"` : 'the next station';
}

export function describeProbeCamPlanAsGcode(plan: ProbeCamPlan): string {
    const wallLinks = plan.links.filter((l) => l.style === 'wall').length;
    const topLinks = plan.links.filter((l) => l.style === 'top').length;
    const linkPolicy = plan.linkMode === 'raise'
        ? `XY at the traverse height Z${plan.hopZ}, guarded segmented descents`
        : `stepped touch-probing traverses at the programmed height: ${topLinks} over a top (lift ${plan.hopLiftMm} mm +Z on contact and retry), `
            + `${wallLinks} heading for a wall station (a contact = a wall: back off 1 mm, retreat ${plan.hopLiftMm} mm along the path just travelled - never +Z - `
            + 'record it as link_contact, mark that station BLOCKED, continue). A contact during the guarded descent at a stepped link\'s destination is a '
            + 'BLOCKED station too: lift straight back to the link height, continue';
    const lines = [
        `; CAM PROBING PROGRAM "${plan.source}": ${plan.parsed.lineCount} lines, ${plan.parsed.probeCount} probe cycle(s), ${plan.frame} frame`
            + `${plan.frame === 'work' ? ` (work origin at machine ${-plan.originOffset.x}, ${-plan.originOffset.y}, ${-plan.originOffset.z})` : ''}`,
        '; The program is TRANSLATED, never sent raw: every G38.x becomes a sensor-gated march to its target (the travel limit),',
        `; links follow law 2 (link_mode ${plan.linkMode}: ${linkPolicy}),`,
        ...(plan.topZMachine !== null
            ? [`; top_z_machine Z${plan.topZMachine} (operator-stated top): a stepped +Z lift never rises above it (a lift that would = station BLOCKED); `
                + 'a raise-mode descent contact AT the top (within one 1 mm guarded step) = station BLOCKED, not a collision.']
            : []),
        `; programmed feeds are ignored (coarse ${plan.march.coarseStepMm} mm F${COARSE_FEED}, fine ${plan.march.fineStepMm}, ${plan.march.confirmPasses} confirm pass(es), sensor ${plan.march.sensorDelayMs} ms).`,
        `; G38.2 without contact: ${plan.onMiss === 'abort' ? 'ABORTS (Grbl semantics)' : 'records no_contact and continues'}; G38.3 always records. Report: ${plan.reportFormat}.`,
        '; A BLOCKED station is a normal outcome on the report (status blocked, blockedBy = the link contact); any ABORT raises straight to the traverse height (law 8).',
        `; WALL CLEARANCE (planning): ${plan.wallCheck.walls.filter((w) => w.source === 'declared').length} declared known_wall(s) + `
            + `${plan.wallCheck.walls.filter((w) => w.source === 'nominal').length} wall(s) read off the program's own nominals, against every station start and link path, `
            + `tip radius ${plan.wallCheck.tipRadiusMm === null ? 'UNKNOWN (0 used)' : plan.wallCheck.tipRadiusMm} + margin ${plan.wallCheck.marginMm} mm: `
            + `no violation against the declared walls, ${plan.wallCheck.warnings.length} nominal warning(s)`
            + `${plan.wallCheck.radial.length ? `; corner-arc approaches: ${plan.wallCheck.radial.map((r) => `"${r.station}" ${r.offRadialDeg} deg off radial of ${r.wall}`).join(', ')}` : ''}.`,
        ...(plan.parsed.rotations.length
            ? [`; THE STOCK WILL ROTATE: B schedule ${plan.parsed.rotations.map((b) => `${b} deg`).join(' -> ')} (absolute), each preceded by a raise to Z${plan.hopZ}.`]
            : []),
        ...plan.warnings.map((w) => `; WARNING ${w}`),
        `; anchored at machine (${plan.staged.x.toFixed(2)}, ${plan.staged.y.toFixed(2)}, ${plan.staged.z.toFixed(2)}) - re-verified before motion`,
        'G90',
        'G53;',
    ];
    plan.parsed.steps.forEach((step, index) => {
        if (step.kind === 'note') {
            lines.push(`; L${step.line} (${step.text})`);
        } else if (step.kind === 'dwell') {
            lines.push(`G4 S${step.seconds}; L${step.line} dwell`);
        } else if (step.kind === 'rotate') {
            lines.push(`; L${step.line} ${step.source}`);
            lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; raise to the traverse height before the stock turns (law 2)`);
            lines.push(`G0 B${step.bDeg.toFixed(3)}; rotate to B${step.bDeg} (absolute), verified by M114 / heartbeat b`);
        } else if (step.kind === 'move') {
            const xyMoves = step.from.x !== step.target.x || step.from.y !== step.target.y;
            lines.push(`; L${step.line} ${step.source}`);
            const link = linkAt(plan.links, index);
            const descentNote = (style: CamLink['style']) => {
                if (style === 'raise') {
                    return plan.topZMachine === null
                        ? 'contact aborts'
                        : `contact aborts, except AT the stated top Z${plan.topZMachine} = station ${stationLabel(link)} BLOCKED`;
                }
                return `a contact = station ${stationLabel(link)} BLOCKED: lift straight back to the link height, continue`;
            };
            if (!xyMoves) {
                if (step.target.z > step.from.z) {
                    lines.push(`G1 Z${step.target.z.toFixed(3)} F${TRAVEL_FEED}; rise`);
                } else if (step.target.z < step.from.z) {
                    const prev = plan.links.filter((l) => l.stepIndex < index).pop() || null;
                    lines.push(`G1 Z${step.target.z.toFixed(3)} F${COARSE_FEED}; descend in <= ${DESCENT_SEGMENT_MM.default} mm segments, last ${DESCENT_GUARD_MM} mm in guarded 1 mm steps `
                        + `(${descentNote(prev ? prev.style : 'raise')})`);
                }
            } else if (!link || link.style === 'raise') {
                lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; raise to the traverse height (law 2)`);
                lines.push(`G1 X${step.target.x.toFixed(3)} Y${step.target.y.toFixed(3)} F${TRAVEL_FEED}; traverse (crash guard armed)`);
                if (step.target.z < plan.hopZ) {
                    lines.push(`G1 Z${step.target.z.toFixed(3)} F${COARSE_FEED}; descend in segments, guarded last ${DESCENT_GUARD_MM} mm (${descentNote('raise')})`);
                }
            } else {
                const linkZ = Math.max(step.from.z, step.target.z);
                if (linkZ > step.from.z) {
                    lines.push(`G1 Z${linkZ.toFixed(3)} F${TRAVEL_FEED}; rise to the link height`);
                }
                lines.push(`G1 X${step.target.x.toFixed(3)} Y${step.target.y.toFixed(3)} F300; ${link.style.toUpperCase()} link toward station ${stationLabel(link)} at Z${linkZ}: `
                    + `${describeLinkStyle(link.style, plan.hopLiftMm, plan.hopZ, plan.topZMachine)} [${link.reason}]`);
                if (step.target.z < linkZ) {
                    lines.push(`G1 Z${step.target.z.toFixed(3)} F${COARSE_FEED}; descend in segments, guarded last ${DESCENT_GUARD_MM} mm (${descentNote(link.style)})`);
                }
            }
        } else {
            const { length } = unitOf(step.from, step.target);
            const label = step.meta.name || step.meta.id || `probe ${step.index}`;
            lines.push(`; L${step.line} ${step.source}  -> "${label}"`);
            lines.push(`G1 X${step.target.x.toFixed(3)} Y${step.target.y.toFixed(3)} Z${step.target.z.toFixed(3)} F${COARSE_FEED}; ${step.mode} march up to ${length} mm - `
                + `${step.mode === 'G38.4' || step.mode === 'G38.5' ? 'coarse steps until the probe RELEASES, then on to the target' : `${plan.march.coarseStepMm} mm steps to contact, release, fine, confirm; retreat to (${step.from.x}, ${step.from.y}, ${step.from.z})`}`);
        }
    });
    lines.push(`G1 Z${plan.hopZ.toFixed(3)} F${TRAVEL_FEED}; finish at the safe traverse height (also on any abort)`);
    lines.push('G54;');
    return lines.join('\n');
}

export interface ProbeCamResult {
    tool: 'run_probing_gcode';
    report: InspectionReport;
    reportFormat: ReportFormat;
    reportText: string;
    files: { [format: string]: string };
    phases: { phase: string; note?: string }[];
    note: string;
    aborted?: boolean;
}

function reportDir(): string {
    return path.join(DataStorage.userDataDir, 'mcp-inspection');
}

export function writeReportFiles(report: InspectionReport, formats: ReportFormat[], stem: string): { [format: string]: string } {
    const dir = reportDir();
    fs.ensureDirSync(dir);
    const files: { [format: string]: string } = {};
    for (const format of Array.from(new Set(formats))) {
        const file = path.join(dir, `${stem}.${reportExtension(format)}`);
        fs.writeFileSync(file, renderReport(report, format), 'utf8');
        files[format] = file;
    }
    return files;
}

type RecordBase = Omit<ProbeResultRecord, 'status' | 'contactMachine' | 'contactWork' | 'travelMm' | 'shortOfTargetMm' | 'spreadMm' | 'deviationMm' | 'withinTolerance'>;

function emptyRecord(base: RecordBase, status: ProbeResultRecord['status'], blockedBy?: LinkContactRecord): ProbeResultRecord {
    return {
        ...base,
        status,
        blockedBy,
        contactMachine: null,
        contactWork: null,
        travelMm: null,
        shortOfTargetMm: null,
        spreadMm: null,
        deviationMm: null,
        withinTolerance: null,
    };
}

export async function runProbeCamProcedure(plan: ProbeCamPlan, jobId: string | null): Promise<ProbeCamResult> {
    assertMachineReadyForProcedure();
    assertChannelReady('probe', 'CAM probing program');
    const tipCalibration = getProbeTipCalibration();
    const phases: { phase: string; note?: string }[] = [];
    const announce = makeAnnounce(plan.tool, phases);
    const tag = 'cam';
    const records: ProbeResultRecord[] = [];
    const linkContacts: LinkContactRecord[] = [];
    const startedAt = Date.now();
    const offset = plan.originOffset;
    const toWork = (p: Xyz): Xyz => ({ x: r3(p.x + offset.x), y: r3(p.y + offset.y), z: r3(p.z + offset.z) });

    const build = (aborted: string | null): ProbeCamResult => {
        const contacts = records.filter((r) => r.status === 'contact' || r.status === 'released').length;
        const misses = records.filter((r) => r.status === 'no_contact' || r.status === 'not_released').length;
        const blocked = records.filter((r) => r.status === 'blocked').length;
        const devs = records.map((r) => r.deviationMm).filter((d): d is number => d !== null);
        const report: InspectionReport = {
            source: plan.source,
            jobId,
            startedAt,
            endedAt: Date.now(),
            frame: { originOffset: offset, convention: 'contactMachine is raw toolhead XYZ; contactWork = contactMachine + originOffset (unchanged WCS touch-off); tipMachineZ is a separate datum-derived tip-bottom projection' },
            tipDiameterMm: plan.tipDiameterMm,
            tipConvention: TIP_CONVENTION,
            results: plan.parsed.results,
            tipCalibration,
            probes: records.map((record) => ({ ...record, ...projectToolTipZ(record.contactMachine?.z ?? null, tipCalibration) })),
            linkContacts: linkContacts.map((record) => ({ ...record, ...projectToolTipZ(record.contactMachine.z, tipCalibration) })),
            summary: {
                total: plan.parsed.probeCount,
                contacts,
                misses,
                blocked,
                outOfTolerance: records.filter((r) => r.withinTolerance === false).length,
                maxAbsDeviationMm: devs.length ? r3(Math.max(...devs.map((d) => Math.abs(d)))) : null,
            },
            aborted: aborted || undefined,
        };
        let files: { [format: string]: string } = {};
        try {
            files = writeReportFiles(report, ['json', plan.reportFormat], jobId || `unsaved-${startedAt}`);
        } catch (err) {
            announce('report-file-failed', (err as Error).message);
        }
        return {
            tool: plan.tool,
            report,
            reportFormat: plan.reportFormat,
            reportText: renderReport(report, plan.reportFormat),
            files,
            phases,
            note: `${aborted ? 'ABORTED. ' : ''}${contacts}/${plan.parsed.probeCount} probe cycle(s) made contact`
                + `${blocked ? `, ${blocked} station(s) BLOCKED by a link contact (${linkContacts.length} link contact(s) recorded as wall points)` : ''}`
                + `${report.summary.outOfTolerance ? `, ${report.summary.outOfTolerance} out of tolerance` : ''}`
                + `${report.summary.maxAbsDeviationMm !== null ? `, max |deviation| ${report.summary.maxAbsDeviationMm} mm` : ''}. `
                + `Report (${plan.reportFormat}) in reportText and on disk under mcp-inspection/.`,
            aborted: aborted ? true : undefined,
        };
    };

    /**
     * The descent to a programmed Z at the end of a link (or a pure Z drop):
     * fast segments, then 1 mm guarded steps (march.linkDescent). What a
     * contact means depends on the link that brought the head here
     * (camLinks.judgeLinkDescentContact). Returns the Z the head is at and
     * whether the station was blocked.
     */
    const guardedDescent = async (label: string, toZ: number, link: CamLink | null): Promise<{ z: number; blocked: boolean; contactZ: number | null }> => {
        const known = knownMachinePosition();
        const zNow = known.position.z;
        if (zNow === null) {
            throw new ProcedureAbort(`Machine Z unknown before the descent at ${label} - refusing to guess.`);
        }
        if (zNow < toZ - RECHECK_TOLERANCE_MM) {
            throw new ProcedureAbort(`${label}: the toolhead is at Z${zNow} (${known.source}), BELOW the descent target Z${toZ} - a descent never rises.`);
        }
        const style = link ? link.style : 'raise';
        return linkDescent(tag, label, zNow, toZ, {
            sensorDelayMs: plan.march.sensorDelayMs,
            guardMm: DESCENT_GUARD_MM,
            judge: (contactZ) => judgeLinkDescentContact(style, plan.topZMachine, contactZ),
            mayBlock: linkDescentMayBlock(style, plan.topZMachine),
        }, announce);
    };

    try {
        await expectMachinePosition(plan.staged, 'staged position', (message) => new McpToolError(
            `The machine is not at the position this program was staged from. ${message} Stage run_probing_gcode again.`
        ));
        let current: Xyz = { ...plan.staged };
        let currentB: number | null = getPositionSnapshot().b;
        // A blocked link: the step index of the station it was heading for
        // (its probe records `blocked` when reached), the steps skipped on
        // the way, and the contact that blocked it. Held in an object so the
        // closures below can set it without TypeScript narrowing it to null.
        const blockedState: { pending: { stationIndex: number | null; skip: Set<number>; by: LinkContactRecord } | null } = { pending: null };

        const recordLinkContact = (
            line: number,
            link: CamLink | null,
            kind: LinkContactRecord['kind'],
            outcome: LinkContactRecord['outcome'],
            contact: Xyz,
            direction: Xyz,
            retreat: { unit: Xyz; mm: number }
        ): LinkContactRecord => {
            const rec: LinkContactRecord = {
                line,
                kind,
                outcome,
                contactMachine: { ...contact },
                contactWork: toWork(contact),
                direction: { x: r3(direction.x), y: r3(direction.y), z: r3(direction.z) },
                retreat: { unit: { x: r3(retreat.unit.x), y: r3(retreat.unit.y), z: r3(retreat.unit.z) }, mm: r3(retreat.mm) },
                towardStation: link && link.station
                    ? { probeIndex: link.station.probeIndex, id: link.station.id, name: link.station.name, line: link.station.line }
                    : null,
                bDeg: currentB,
            };
            linkContacts.push(rec);
            announce(`L${line}-link-contact`, `${kind} contact at (${contact.x}, ${contact.y}, ${contact.z}) heading `
                + `${rec.towardStation ? `for station "${rec.towardStation.name || rec.towardStation.id}"` : 'on'} - ${outcome}`);
            return rec;
        };

        const blockStation = (stepIndex: number, link: CamLink | null, by: LinkContactRecord): void => {
            const span = blockedStationSpan(plan.parsed.steps, stepIndex);
            blockedState.pending = { stationIndex: span.stationIndex, skip: new Set(span.skip), by };
            announce(`L${plan.parsed.steps[stepIndex].line}-blocked`, span.stationIndex === null
                ? 'link blocked; no station follows before a rotation / the end - continuing from here'
                : `station ${stationLabel(link)} BLOCKED - ${span.skip.length} approach step(s) skipped, the run continues from (${current.x}, ${current.y}, ${current.z})`);
        };

        /** A link descent that met material: record the contact (straight down, lifted straight back) and block the station. */
        const blockOnDescent = (stepIndex: number, link: CamLink | null, descent: { z: number; blocked: boolean; contactZ: number | null }): void => {
            if (!descent.blocked || descent.contactZ === null) {
                return;
            }
            const contact = { x: current.x, y: current.y, z: descent.contactZ };
            const retreat = { unit: { x: 0, y: 0, z: 1 }, mm: r3(descent.z - descent.contactZ) };
            const by = recordLinkContact(plan.parsed.steps[stepIndex].line, link, 'descent', 'blocked', contact, { x: 0, y: 0, z: -1 }, retreat);
            blockStation(stepIndex, link, by);
        };

        for (let index = 0; index < plan.parsed.steps.length; index++) {
            const step = plan.parsed.steps[index];
            if (step.kind === 'note') {
                announce(`L${step.line}`, step.text);
                continue;
            }
            if (blockedState.pending && blockedState.pending.skip.has(index)) {
                announce(`L${step.line}-skipped`, 'approach to a blocked station');
                continue;
            }
            if (step.kind === 'dwell') {
                announce(`L${step.line}-dwell`, `${step.seconds} s`);
                await sleep(step.seconds * 1000);
                continue;
            }
            const label = `L${step.line}`;
            if (step.kind === 'rotate') {
                blockedState.pending = null;
                probeFeedService.clearExpectedContact();
                if (current.z < plan.hopZ - TRAVERSE_Z_TOLERANCE_MM) {
                    await moveMachineSettled(`${tag}:raise:${label}`, { z: plan.hopZ }, TRAVEL_FEED);
                    current = { ...current, z: plan.hopZ };
                }
                const outcome = await rotateB(`${tag}:${label}`, step.bDeg, plan.hopZ);
                currentB = outcome.to;
                announce(`${label}-rotated`, `B ${outcome.from === null ? '?' : outcome.from} -> ${outcome.to} deg (${outcome.verifiedBy})`);
                continue;
            }
            await expectMachinePosition(current, label, (m) => new ProcedureAbort(m));
            if (step.kind === 'move') {
                const xyMoves = step.from.x !== step.target.x || step.from.y !== step.target.y;
                const link = linkAt(plan.links, index);
                probeFeedService.clearExpectedContact();
                if (!xyMoves) {
                    if (step.target.z > current.z + 1e-9) {
                        await moveMachineSettled(`${tag}:rise:${label}`, { z: step.target.z }, TRAVEL_FEED);
                        current = { ...current, z: step.target.z };
                    } else if (step.target.z < current.z - 1e-9) {
                        const prev = plan.links.filter((l) => l.stepIndex < index).pop() || null;
                        const descent = await guardedDescent(label, step.target.z, prev);
                        current = { ...current, z: descent.z };
                        blockOnDescent(index, prev, descent);
                    }
                } else if (!link || link.style === 'raise') {
                    if (current.z < plan.hopZ - TRAVERSE_Z_TOLERANCE_MM) {
                        await moveMachineSettled(`${tag}:raise:${label}`, { z: plan.hopZ }, TRAVEL_FEED);
                    }
                    await moveMachineSettled(`${tag}:traverse:${label}`, { x: step.target.x, y: step.target.y }, TRAVEL_FEED);
                    current = { x: step.target.x, y: step.target.y, z: plan.hopZ };
                    if (step.target.z < plan.hopZ - 1e-9) {
                        const descent = await guardedDescent(label, step.target.z, link);
                        current = { ...current, z: descent.z };
                        blockOnDescent(index, link, descent);
                    }
                } else {
                    const linkZ = Math.max(current.z, step.target.z);
                    if (linkZ > current.z + 1e-9) {
                        await moveMachineSettled(`${tag}:rise:${label}`, { z: linkZ }, TRAVEL_FEED);
                        current = { ...current, z: linkZ };
                    }
                    let blocked: SteppedBlock | null = null;
                    const linkFrom: Xyz = { ...current };
                    if (link.style === 'wall') {
                        const traverse = await steppedTraverseWall(tag, label, linkFrom, step.target, linkZ, {
                            retreatMm: plan.hopLiftMm, sensorDelayMs: plan.march.sensorDelayMs,
                        }, announce);
                        current = { ...traverse.position };
                        blocked = traverse.blocked;
                    } else {
                        const cap = topLinkLiftCap(linkZ, plan.hopZ, plan.topZMachine);
                        const traverse = await steppedTraverseZ(tag, label, linkFrom, step.target, linkZ, {
                            liftMm: plan.hopLiftMm, maxZ: linkZ + cap.maxLiftTotalMm, sensorDelayMs: plan.march.sensorDelayMs, onMax: cap.onMax,
                        }, announce);
                        current = { ...traverse.position };
                        blocked = traverse.blocked;
                        // Every +Z lift that went on is data too: the surface rose there.
                        const { unit } = unitOf({ x: linkFrom.x, y: linkFrom.y, z: linkZ }, { x: step.target.x, y: step.target.y, z: linkZ });
                        for (const l of traverse.lifts) {
                            if (!blocked || l.x !== blocked.contact.x || l.y !== blocked.contact.y || l.z !== blocked.contact.z) {
                                recordLinkContact(step.line, link, 'top', 'lifted', { x: l.x, y: l.y, z: l.z }, unit, { unit: { x: 0, y: 0, z: 1 }, mm: l.liftMm });
                            }
                        }
                    }
                    if (blocked) {
                        const by = recordLinkContact(step.line, link, link.style, 'blocked', blocked.contact, blocked.travelUnit, { unit: blocked.retreatUnit, mm: blocked.retreatMm });
                        blockStation(index, link, by);
                    } else if (step.target.z < current.z - 1e-9) {
                        const descent = await guardedDescent(label, step.target.z, link);
                        current = { ...current, z: descent.z };
                        blockOnDescent(index, link, descent);
                    }
                }
                announce(`${label}-at`, `(${current.x}, ${current.y}, ${current.z})`);
                continue;
            }

            // ---- probe cycle
            const { unit, length } = unitOf(step.from, step.target);
            const id = step.meta.id || String(step.index);
            const name = step.meta.name || null;
            const base: RecordBase = {
                index: step.index,
                id,
                name,
                line: step.line,
                mode: step.mode,
                bDeg: currentB,
                startMachine: { ...step.from },
                targetMachine: { ...step.target },
                direction: { x: r3(unit.x), y: r3(unit.y), z: r3(unit.z) },
                maxTravelMm: length,
                meta: step.meta,
            };
            const pending = blockedState.pending;
            blockedState.pending = null;
            if (pending && pending.stationIndex === index) {
                // The link (or descent) to this station met material: the
                // station is blocked, not measured - a normal outcome.
                records.push(emptyRecord(base, 'blocked', pending.by));
                announce(`${label}-blocked`, `station "${name || id}" not probed: ${pending.by.kind} link contact at `
                    + `(${pending.by.contactMachine.x}, ${pending.by.contactMachine.y}, ${pending.by.contactMachine.z})`);
                continue;
            }
            if (step.mode === 'G38.2' || step.mode === 'G38.3') {
                probeFeedService.setExpectedContact(['probe']);
                const contact = await marchToContact(tag, `${label}-${id}`, current, unit, length, plan.march, announce);
                if (contact) {
                    const contactWork = toWork(contact.point);
                    let deviationMm: number | null = null;
                    let withinTolerance: boolean | null = null;
                    if (step.meta.nominal && plan.tipDiameterMm !== null) {
                        // Surface per TIP_CONVENTION (inspectionReport.ts): the
                        // contact is centre-XY / bottom-Z, pushed one radius back
                        // along the normal's horizontal part only. Without a
                        // stored tip diameter the deviation stays null rather
                        // than being off by a stylus radius on a side march.
                        const nominalWork = step.meta.frame === 'machine' ? toWork(step.meta.nominal) : step.meta.nominal;
                        const normal = step.meta.normal || { x: -unit.x, y: -unit.y, z: -unit.z };
                        ({ deviationMm, withinTolerance } = deviationAlongNormal(
                            contactWork, nominalWork, normal, step.meta.upperTolMm, step.meta.lowerTolMm, plan.tipDiameterMm / 2
                        ));
                    } else if (step.meta.nominal) {
                        announce(`${label}-no-tip`, 'nominal given but no probe tip diameter stored (set_probe_geometry): deviation not computed');
                    }
                    records.push({
                        ...base,
                        status: 'contact',
                        contactMachine: contact.point,
                        contactWork,
                        travelMm: contact.s,
                        shortOfTargetMm: r3(length - contact.s),
                        spreadMm: contact.spreadMm,
                        deviationMm,
                        withinTolerance,
                    });
                } else {
                    records.push(emptyRecord(base, 'no_contact'));
                    announce(`${label}-no-contact`, `${step.mode}: nothing within ${length} mm`);
                    if (step.mode === 'G38.2' && plan.onMiss === 'abort') {
                        await retreatAlong(tag, `${label}-${id}`, current, unit, 0);
                        probeFeedService.clearExpectedContact();
                        throw new ProcedureAbort(`${label}: G38.2 reached its target without contact (Grbl: probe fail). Pass on_miss: "continue" to record misses instead.`);
                    }
                }
                // Retreat to the cycle start (the parser's assumption); the
                // probe may still be in contact, so it stays expected.
                await retreatAlong(tag, `${label}-${id}`, current, unit, 0);
                probeFeedService.clearExpectedContact();
                continue;
            }

            // G38.4 / G38.5: probe away - coarse steps until the probe releases.
            probeFeedService.setExpectedContact(['probe']);
            const reading = probeFeedService.getReading('probe');
            if (!reading || !reading.triggered) {
                announce(`${label}-not-in-contact`, `${step.mode} starts without contact - treated as released at the start`);
            }
            let s = 0;
            let releasedAt: number | null = (!reading || !reading.triggered) ? 0 : null;
            while (releasedAt === null && length - s > 1e-9) {
                const t0 = Date.now();
                s = Math.min(s + plan.march.coarseStepMm, length);
                const p = { x: r3(current.x + unit.x * s), y: r3(current.y + unit.y * s), z: r3(current.z + unit.z * s) };
                await moveMachineSettled(`${tag}:away:${label}`, p, COARSE_FEED);
                const sensed = await senseReleaseAfter('probe', t0, releaseTimeoutFor(plan.march.sensorDelayMs));
                if (!sensed.contact) {
                    releasedAt = s;
                }
            }
            if (releasedAt === null) {
                records.push(emptyRecord(base, 'not_released'));
                probeFeedService.clearExpectedContact();
                if (step.mode === 'G38.4') {
                    throw new ProcedureAbort(`${label}: G38.4 reached its target without the probe releasing.`);
                }
            } else {
                const point = { x: r3(current.x + unit.x * releasedAt), y: r3(current.y + unit.y * releasedAt), z: r3(current.z + unit.z * releasedAt) };
                records.push({ ...base, status: 'released', contactMachine: point, contactWork: toWork(point), travelMm: releasedAt, shortOfTargetMm: r3(length - releasedAt), spreadMm: null, deviationMm: null, withinTolerance: null });
                announce(`${label}-released`, `at ${releasedAt} mm along`);
            }
            // Leaving the surface is safe: on to the programmed target.
            probeFeedService.clearExpectedContact();
            await moveMachineSettled(`${tag}:away-to-target:${label}`, { x: step.target.x, y: step.target.y, z: step.target.z }, TRAVEL_FEED);
            current = { ...step.target };
        }

        probeFeedService.clearExpectedContact();
        if (current.z < plan.hopZ - TRAVERSE_Z_TOLERANCE_MM) {
            await moveMachineSettled(`${tag}:final-raise`, { z: plan.hopZ }, TRAVEL_FEED);
        }
        const result = build(null);
        announce('program-complete', result.note);
        return result;
    } catch (err) {
        const isTrip = !!probeFeedService.getTrip();
        if (probeAbortHeld((err as { partial?: object }).partial)) {
            announce('abort-held', 'contact during lift - holding even if the sensor subsequently releases');
        } else if (!isTrip) {
            try {
                // Law 8: straight up to the traverse height. Held only while the
                // probe still reads contact (lifting would drag the tip).
                await abortRaiseToTop(tag, (phase, z, note) => announce(phase, z === null ? note : `Z${z} - ${note}`), { holdIfTriggered: 'probe' });
            } catch (retreatErr) {
                // Logged by the activity stream.
            }
        }
        if (isProcedureAbort(err)) {
            const Ctor = isProcedureStopped(err) ? ProcedureStopped : ProcedureAbort;
            throw new Ctor(`CAM probing program aborted: ${err.message} ${records.length} probe cycle(s) recorded so far are on the job record (partial report written).`,
                build(err.message));
        }
        throw err;
    } finally {
        probeFeedService.clearExpectedContact();
    }
}

/** Re-render a stored report (job.result.report) in another format and write it beside the others. */
export function renderStoredReport(report: InspectionReport, format: ReportFormat, stem: string): { text: string; file: string | null } {
    const text = renderReport(report, format);
    let file: string | null = null;
    try {
        file = writeReportFiles(report, [format], stem)[format];
    } catch (err) {
        file = null;
    }
    return { text, file };
}
