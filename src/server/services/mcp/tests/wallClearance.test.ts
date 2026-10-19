import { strict as assert } from 'assert';

import { classifyCamLinks, linkAt } from '../camLinks';
import { CamStep, parseProbingGcode } from '../probeGcode';
import {
    KnownWall,
    WallLine,
    WallSpecError,
    checkWallClearance,
    describeWallViolation,
    nominalWalls,
    normalizeKnownWalls,
    pointClearance,
    segmentClearance,
} from '../wallClearance';

const ORIGIN = { x: 0, y: 0, z: 0 };
const identity = (p: { x: number; y: number }) => p;
// The stored tip: 1.25 mm diameter on this rig (2026-09-21).
const TIP_R = 0.625;

// Pass 1 (job 031c3eb1fe38) measured the chuck-end wall with +Y marches whose
// tip centres stopped at Y 247.3, so the wall SURFACE is at 247.3 + 0.625 =
// 247.925 with the free side toward -Y. Declared as a known wall for pass 2.
const CHUCK_END_WALL = {
    name: 'chuck-end wall (pass 1)', kind: 'line', a: { x: 140, y: 247.925 }, b: { x: 200, y: 247.925 }, normal: { x: 0, y: -1 }, z_top: 206.4,
};

// The pass-2 tail (job f84f2a263333): station 68's start (192.17, 248.05) is INSIDE that wall.
const PASS2_TAIL = [
    'G90',
    'G0 X193.57 Y247.05',
    'G0 Z203.4',
    '(PROBE id=67 name=px_lw_8 group=chuck_px role=corner nominal=196.57,247.05,203.4 normal=-1,0,0 tol=1,1 frame=machine)',
    'G38.2 X201.57 Y247.05 Z203.4 F100',
    'G0 X192.17 Y248.05',
    'G0 Z203.4',
    '(PROBE id=68 name=px_lw_9 group=chuck_px role=corner nominal=195.17,248.05,203.4 normal=-1,0,0 tol=1,1 frame=machine)',
    'G38.2 X200.17 Y248.05 Z203.4 F100',
    'G0 X197.00 Y243.55',
    'G0 Z203.4',
    '(PROBE id=69 name=px_ew_1 group=chuck_ew role=corner nominal=197.00,246.55,203.4 normal=0,-1,0 tol=1,1 frame=machine)',
    'G38.2 X197.00 Y251.55 Z203.4 F100',
    'G0 X190.00 Y243.55',
    'G0 Z203.4',
    '(PROBE id=70 name=px_ew_2 group=chuck_ew role=corner nominal=190.00,246.55,203.4 normal=0,-1,0 tol=1,1 frame=machine)',
    'G38.2 X190.00 Y251.55 Z203.4 F100',
    'M30',
].join('\n');

function parse(text: string, start = { x: 193.57, y: 247.05, z: 203.4 }) {
    return parseProbingGcode(text, { startMachine: start, originOffset: ORIGIN, startB: 180 });
}

function inputsFor(steps: CamStep[], hopZ: number, linkMode: 'raise' | 'stepped') {
    const links = classifyCamLinks(steps, linkMode);
    const stationStarts: Parameters<typeof checkWallClearance>[0]['stationStarts'] = [];
    const linkPaths: Parameters<typeof checkWallClearance>[0]['linkPaths'] = [];
    steps.forEach((step, index) => {
        if (step.kind === 'probe') {
            stationStarts.push({ stepIndex: index, line: step.line, station: step.meta.name || null, at: { ...step.from } });
            return;
        }
        const link = linkAt(links, index);
        if (!link || step.kind !== 'move') {
            return;
        }
        const linkZ = link.style === 'raise' ? hopZ : Math.max(step.from.z, step.target.z);
        linkPaths.push({
            line: step.line, station: link.station ? link.station.name : null, from: { ...step.from, z: linkZ }, to: { ...step.target, z: linkZ },
        });
    });
    return { stationStarts, linkPaths };
}

export const tests: Array<[string, () => void]> = [
    ['known_walls are validated: line needs a, b and a normal; arc needs centre, radius, material; frames convert', () => {
        const walls = normalizeKnownWalls([CHUCK_END_WALL, { kind: 'arc', center: { x: 10, y: 20 }, radius: 5.9, material: 'outside', from_deg: 180, to_deg: 270 }],
            (p) => ({ x: p.x + 100, y: p.y + 50 }));
        assert.equal(walls.length, 2);
        assert.equal(walls[0].kind, 'line');
        assert.deepEqual((walls[0] as WallLine).a, { x: 240, y: 297.925 }, 'endpoints converted to machine');
        assert.deepEqual((walls[0] as WallLine).normal, { x: 0, y: -1 }, 'the normal is a direction: not shifted');
        assert.equal(walls[0].zTop, 206.4);
        assert.equal(walls[1].kind, 'arc');
        assert.deepEqual((walls[1] as { center: { x: number; y: number } }).center, { x: 110, y: 70 });
        assert.throws(() => normalizeKnownWalls([{ kind: 'line', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }], identity), WallSpecError);
        assert.throws(() => normalizeKnownWalls([{ kind: 'arc', center: { x: 0, y: 0 }, radius: 5 }], identity), /material/);
        assert.throws(() => normalizeKnownWalls([{ kind: 'arc', center: { x: 0, y: 0 }, radius: 5, material: 'outside', from_deg: 10 }], identity), /both from_deg and to_deg/);
        assert.throws(() => normalizeKnownWalls([{ kind: 'wall' }], identity), /kind must be/);
        assert.deepEqual(normalizeKnownWalls(undefined, identity), []);
    }],

    ['point and segment clearance: free side positive, inside negative, beyond a line\'s ends null; arcs by material side', () => {
        const [wall] = normalizeKnownWalls([CHUCK_END_WALL], identity);
        assert.equal(pointClearance(wall, { x: 170, y: 245.925 }), 2);
        assert.equal(pointClearance(wall, { x: 192.17, y: 248.05 }), -0.125, 'station 68\'s start is 0.125 mm INSIDE the pass-1 wall');
        assert.equal(pointClearance(wall, { x: 300, y: 240 }), null, 'not abreast of the wall');
        // A path that runs parallel 2 mm off, then one that crosses the wall.
        assert.equal(segmentClearance(wall, { x: 150, y: 245.925 }, { x: 190, y: 245.925 }), 2);
        assert.ok((segmentClearance(wall, { x: 150, y: 245 }, { x: 150, y: 250 }) as number) < 0);
        // A path that only enters the wall's lateral extent part-way is judged where it does.
        assert.equal(segmentClearance(wall, { x: 130, y: 240 }, { x: 150, y: 246.925 }), 1);

        const arc: KnownWall = { name: 'corner', kind: 'arc', center: { x: 0, y: 0 }, radius: 5, material: 'outside', fromDeg: null, toDeg: null, zTop: null, zBottom: null, source: 'declared' };
        assert.equal(pointClearance(arc, { x: 3, y: 0 }), 2, 'inside a pocket corner: free');
        assert.equal(pointClearance(arc, { x: 6, y: 0 }), -1, 'beyond the arc: material');
        const boss = { ...arc, material: 'inside' as const };
        assert.equal(pointClearance(boss, { x: 6, y: 0 }), 1);
        assert.equal(pointClearance(boss, { x: 3, y: 0 }), -2);
        // Segment past a boss: the closest point of the path to the centre governs.
        assert.equal(segmentClearance(boss, { x: -10, y: 6 }, { x: 10, y: 6 }), 1);
        const sector = { ...arc, fromDeg: 0, toDeg: 90 };
        assert.equal(pointClearance(sector, { x: -3, y: 0 }), null, 'outside the arc\'s sector');
        assert.equal(pointClearance(sector, { x: 3, y: 3 }), Number((5 - Math.hypot(3, 3)).toFixed(3)));
    }],

    ['the pass-2 program is REFUSED against the pass-1 wall: station 68\'s start cannot hold the tip (the defect of 2026-09-21)', () => {
        const parsed = parse(PASS2_TAIL);
        const declared = normalizeKnownWalls([CHUCK_END_WALL], identity);
        const { stationStarts, linkPaths } = inputsFor(parsed.steps, 328, 'stepped');
        const check = checkWallClearance({
            steps: parsed.steps, stationStarts, linkPaths, declared, nominal: [], tipRadiusMm: TIP_R, marginMm: 0.5, radialToleranceDeg: null, epsilonMm: 0.05,
        });
        const starts = check.violations.filter((v) => v.what === 'station-start');
        assert.ok(starts.length >= 1, JSON.stringify(check.violations));
        const s68 = starts.find((v) => v.station === 'px_lw_9');
        assert.ok(s68, 'station 68 named');
        assert.equal(s68!.clearanceMm, -0.125);
        assert.equal(s68!.requiredMm, 1.125);
        assert.equal(s68!.shortByMm, 1.25);
        assert.ok(describeWallViolation(s68!).includes('0.125 mm INSIDE'));
        // The stepped link into that start is too close as well (its far end IS the start).
        assert.ok(check.violations.some((v) => v.what === 'link-path' && v.station === 'px_lw_9'));
        // Station 67's start (193.57, 247.05) is 0.875 clear: fits the 0.625 tip but not the 0.5 margin.
        const s67 = starts.find((v) => v.station === 'px_lw_8');
        assert.ok(s67 && s67.clearanceMm === 0.875 && s67.shortByMm === 0.25);
        // With margin 0 station 67 passes, 68 still fails.
        const strict = checkWallClearance({
            steps: parsed.steps, stationStarts, linkPaths, declared, nominal: [], tipRadiusMm: TIP_R, marginMm: 0, radialToleranceDeg: null, epsilonMm: 0.05,
        });
        assert.ok(!strict.violations.some((v) => v.station === 'px_lw_8'));
        assert.ok(strict.violations.some((v) => v.station === 'px_lw_9'));
    }],

    ['raise-mode links run above the wall\'s z_top and are not judged; the station starts still are', () => {
        const parsed = parse(PASS2_TAIL);
        const declared = normalizeKnownWalls([CHUCK_END_WALL], identity);
        const { stationStarts, linkPaths } = inputsFor(parsed.steps, 328, 'raise');
        assert.ok(linkPaths.every((l) => l.from.z === 328));
        const check = checkWallClearance({
            steps: parsed.steps, stationStarts, linkPaths, declared, nominal: [], tipRadiusMm: TIP_R, marginMm: 0.5, radialToleranceDeg: null, epsilonMm: 0.05,
        });
        assert.ok(!check.violations.some((v) => v.what === 'link-path'));
        assert.ok(check.violations.some((v) => v.what === 'station-start' && v.station === 'px_lw_9'));
    }],

    ['the program\'s own nominals describe walls: the end-wall group spans its points and station 68\'s start is inside it - a WARNING, not a refusal', () => {
        const parsed = parse(PASS2_TAIL);
        const nominal = nominalWalls(parsed.steps, 206.4);
        // chuck_px (+X wall, normal -1,0) and chuck_ew (end wall, normal 0,-1).
        assert.equal(nominal.length, 2);
        const end = nominal.find((w) => w.normal.y === -1);
        assert.ok(end);
        assert.equal(end!.source, 'nominal');
        assert.equal(end!.zTop, 206.4);
        assert.equal(end!.zBottom, 203.4);
        // Spans x 190..197 at y 246.55.
        assert.deepEqual([end!.a, end!.b].map((p) => p.x).sort((p, q) => p - q), [190, 197]);
        assert.equal(end!.a.y, 246.55);
        const { stationStarts, linkPaths } = inputsFor(parsed.steps, 328, 'stepped');
        const check = checkWallClearance({
            steps: parsed.steps, stationStarts, linkPaths, declared: [], nominal, tipRadiusMm: TIP_R, marginMm: 0, radialToleranceDeg: null, epsilonMm: 0.05,
        });
        assert.equal(check.violations.length, 0, 'nominal walls never refuse');
        const w68 = check.warnings.find((w) => w.what === 'station-start' && w.station === 'px_lw_9');
        assert.ok(w68, JSON.stringify(check.warnings));
        assert.equal(w68!.clearanceMm, -1.5, '(248.05 - 246.55) into the nominal end wall');
        assert.ok(describeWallViolation(w68!).includes('nominal wall'));
        // Station 67's start at y 247.05 is also inside the nominal end wall plane (0.5 mm) but its x 193.57 IS abreast (190..197).
        assert.ok(check.warnings.some((w) => w.station === 'px_lw_8'));
        // The +X wall nominals (x 196.57 / 195.17) are 3-4 mm from the starts: no warning from them.
        assert.ok(!check.warnings.some((w) => w.wall.startsWith('nominal chuck_px')));
    }],

    ['corner arcs: a start inside the unmeasured radius is refused; marches report their angle off the radial and warn past the tolerance', () => {
        // Pass-2 fit of the chuck-end +X corner: r 3.86 about (-50.98, -24.24) model = machine (192.75+..): use round machine numbers.
        const center = { x: 190, y: 244 };
        const arc = normalizeKnownWalls([
            { name: 'chuck +X corner', kind: 'arc', center, radius: 3.86, material: 'outside', from_deg: 0, to_deg: 90 },
        ], identity);
        // A station whose start sits axis-parallel along the wall, 1 mm inside the corner's radius band, marching +X.
        const program = [
            'G90',
            'G0 X192.5 Y246.5',
            'G0 Z203.4',
            '(PROBE id=1 name=axis_parallel nominal=196,246.5,203.4 normal=-1,0,0 frame=machine)',
            'G38.2 X198 Y246.5 Z203.4 F100',
            'G0 X191 Y245',
            '(PROBE id=2 name=radial nominal=192.9,246.9,203.4 normal=-0.707,-0.707,0 frame=machine)',
            'G38.2 X194.5 Y248.5 Z203.4 F100',
            'M30',
        ].join('\n');
        const parsed = parseProbingGcode(program, { startMachine: { x: 190, y: 244, z: 203.4 }, originOffset: ORIGIN, startB: 180 });
        const { stationStarts, linkPaths } = inputsFor(parsed.steps, 328, 'stepped');
        const check = checkWallClearance({
            steps: parsed.steps,
            stationStarts,
            linkPaths,
            declared: arc,
            nominal: [],
            tipRadiusMm: TIP_R,
            marginMm: 0.25,
            radialToleranceDeg: 10,
            epsilonMm: 0.05,
        });
        // (192.5, 246.5) is 3.54 from the centre: 0.32 inside the arc but the tip needs 0.875.
        const start1 = check.violations.find((v) => v.what === 'station-start' && v.station === 'axis_parallel');
        assert.ok(start1, JSON.stringify(check.violations));
        assert.ok(start1!.clearanceMm < 0.875 && start1!.clearanceMm > 0);
        // (191, 245) is 1.41 from the centre: 2.45 clear - the start is fine; the LINK to it starts at the
        // offending point, so that leg is reported (attributed to the station it heads for).
        assert.ok(!check.violations.some((v) => v.what === 'station-start' && v.station === 'radial'));
        assert.ok(check.violations.some((v) => v.what === 'link-path' && v.station === 'radial'));
        // Both marches cross the arc inside its sector; the +X one meets the arc at (192.94, 246.5), whose radial
        // is 40 deg from +X - judged where the tip meets the surface, not at the target far beyond it.
        const byStation = Object.fromEntries(check.radial.map((r) => [r.station, r.offRadialDeg]));
        assert.ok(Math.abs(byStation.axis_parallel - 40.4) < 0.5, `axis-parallel march is ${byStation.axis_parallel} deg off radial`);
        assert.ok(byStation.radial < 1, `radial march is ${byStation.radial} deg off radial`);
        assert.deepEqual(check.radialWarnings.map((r) => r.station), ['axis_parallel']);
        // Without a tolerance nothing warns, the angles are still reported.
        const quiet = checkWallClearance({
            steps: parsed.steps,
            stationStarts,
            linkPaths,
            declared: arc,
            nominal: [],
            tipRadiusMm: TIP_R,
            marginMm: 0.25,
            radialToleranceDeg: null,
            epsilonMm: 0.05,
        });
        assert.equal(quiet.radialWarnings.length, 0);
        assert.equal(quiet.radial.length, 2);
    }],

    ['no tip diameter stored: the check runs with radius 0 (nominal warnings only make sense with the caller refusing declared walls upstream)', () => {
        const parsed = parse(PASS2_TAIL);
        const { stationStarts, linkPaths } = inputsFor(parsed.steps, 328, 'stepped');
        const check = checkWallClearance({
            steps: parsed.steps,
            stationStarts,
            linkPaths,
            declared: [],
            nominal: nominalWalls(parsed.steps, null),
            tipRadiusMm: null,
            marginMm: 0,
            radialToleranceDeg: null,
            epsilonMm: 0.05,
        });
        assert.equal(check.tipRadiusMm, null);
        assert.ok(check.warnings.every((w) => w.requiredMm === 0));
        assert.ok(check.warnings.some((w) => w.station === 'px_lw_9' && w.clearanceMm < 0), 'a start INSIDE a nominal wall is a warning even with no tip');
    }],
];
