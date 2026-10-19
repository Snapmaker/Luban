import { strict as assert } from 'assert';

import {
    SIDE_MARCH_MAX_Z_COMPONENT,
    blockedStationSpan,
    classifyCamLinks,
    describeLinkStyle,
    isSideMarch,
    judgeLinkDescentContact,
    linkDescentMayBlock,
    topLinkLiftCap,
} from '../camLinks';
import { parseProbingGcode } from '../probeGcode';

const ORIGIN = { x: 0, y: 0, z: 0 };

// The tail of pocket_pass2.nc (job f84f2a263333): stations 67 and 68 on the
// chuck-end +X wall, then the first end-wall station - side marches (+X and
// +Y) at Z 203.4 linked by G0 moves at the same height.
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
    '(PROBE id=69 name=px_ew_1 group=chuck_px role=corner nominal=197.00,246.55,203.4 normal=0,-1,0 tol=1,1 frame=machine)',
    'G38.2 X197.00 Y251.55 Z203.4 F100',
    'M30',
].join('\n');

// A top-surface program (the emitter's shape): links at a safe Z, descents, -Z cycles.
const TOP_PROGRAM = [
    'G90',
    'G0 Z230',
    'G0 X170 Y145',
    'G0 Z210',
    '(PROBE id=1 name=top_a nominal=170,145,206.4 normal=0,0,1 frame=machine)',
    'G38.2 Z200 F100',
    'G0 X170 Y160',
    '(PROBE id=2 name=top_b nominal=170,160,206.4 normal=0,0,1 frame=machine)',
    'G38.2 Z200 F100',
    'G0 B180',
    'G0 X170 Y175',
    'M30',
].join('\n');

function parse(text: string, start = { x: 193.57, y: 247.05, z: 203.4 }) {
    return parseProbingGcode(text, { startMachine: start, originOffset: ORIGIN, startB: 180 });
}

export const tests: Array<[string, () => void]> = [
    ['a horizontal G38.2 is a side march, a -Z one is not; the threshold is 30 degrees off horizontal', () => {
        const pocket = parse(PASS2_TAIL);
        const probes = pocket.steps.filter((s) => s.kind === 'probe');
        assert.equal(probes.length, 3);
        assert.ok(probes.every(isSideMarch));
        const top = parse(TOP_PROGRAM, { x: 170, y: 145, z: 328 });
        assert.ok(top.steps.filter((s) => s.kind === 'probe').every((s) => !isSideMarch(s)));
        assert.equal(SIDE_MARCH_MAX_Z_COMPONENT, 0.5);
    }],

    ['link_mode stepped: links toward side-march stations are WALL links, toward -Z stations TOP links, raise stays raise', () => {
        const pocket = parse(PASS2_TAIL);
        const links = classifyCamLinks(pocket.steps, 'stepped');
        assert.equal(links.length, 2, 'two XY links (the first G0 X Y starts where the head already is)');
        assert.ok(links.every((l) => l.style === 'wall'), JSON.stringify(links));
        assert.equal(links[0].station!.name, 'px_lw_9');
        assert.equal(links[0].station!.probeIndex, 2);
        assert.equal(links[1].station!.name, 'px_ew_1');
        assert.ok(links[0].reason.includes('side march'));

        const top = parse(TOP_PROGRAM, { x: 170, y: 145, z: 328 });
        const topLinks = classifyCamLinks(top.steps, 'stepped');
        assert.equal(topLinks.length, 2);
        assert.equal(topLinks[0].style, 'top');
        assert.equal(topLinks[0].station!.name, 'top_b');
        assert.equal(topLinks[1].style, 'top', 'a link after the last probe (before M30) has no station and stays a top link');
        assert.equal(topLinks[1].station, null);

        assert.ok(classifyCamLinks(pocket.steps, 'raise').every((l) => l.style === 'raise'));
        assert.ok(classifyCamLinks(top.steps, 'wall').every((l) => l.style === 'wall'));
    }],

    ['the destination station stops at a rotation: a link before G0 B has no station on the other side of it', () => {
        const text = ['G90', 'G0 X10 Y10', 'G0 B90', '(PROBE id=1 name=side)', 'G38.2 X20 Y10 Z100 F100', 'M30'].join('\n');
        const parsed = parseProbingGcode(text, { startMachine: { x: 0, y: 0, z: 100 }, originOffset: ORIGIN, startB: 0 });
        const links = classifyCamLinks(parsed.steps, 'stepped');
        assert.equal(links.length, 1);
        assert.equal(links[0].station, null);
        assert.equal(links[0].style, 'top', 'no side march ahead of the rotation -> top behaviour');
    }],

    ['a blocked link skips the approach moves up to its station and the station records blocked; the run continues after it', () => {
        const pocket = parse(PASS2_TAIL);
        const links = classifyCamLinks(pocket.steps, 'stepped');
        const l274 = links[0];
        const span = blockedStationSpan(pocket.steps, l274.stepIndex);
        assert.equal(span.stationIndex, l274.station!.stepIndex);
        // Skipped: the G0 Z203.4 between the link and the probe (a move), not the (PROBE) note.
        assert.equal(span.skip.length, 1);
        assert.equal(pocket.steps[span.skip[0]].kind, 'move');
        assert.ok(span.skip.every((i) => i > l274.stepIndex && i < span.stationIndex!));
        // The next link (toward px_ew_1) is untouched: the run continues from wherever the head is.
        assert.ok(links[1].stepIndex > span.stationIndex!);
        // No station ahead: nothing to skip.
        const top = parse(TOP_PROGRAM, { x: 170, y: 145, z: 328 });
        const last = classifyCamLinks(top.steps, 'stepped')[1];
        assert.deepEqual(blockedStationSpan(top.steps, last.stepIndex), { stationIndex: null, skip: [] });
    }],

    ['a descent contact at a stepped or wall link destination is BLOCKED; raise mode aborts unless the contact is AT the stated top', () => {
        assert.equal(judgeLinkDescentContact('wall', null, 206.4), 'block');
        assert.equal(judgeLinkDescentContact('top', null, 195), 'block');
        assert.equal(judgeLinkDescentContact('raise', null, 206.4), 'abort');
        // Pass 2: the descent met the top at exactly 206.400 with the top stated as 206.4.
        assert.equal(judgeLinkDescentContact('raise', 206.4, 206.4), 'block');
        // One guarded step below the top is still the top (the step is 1 mm); the heartbeat noise above it too.
        assert.equal(judgeLinkDescentContact('raise', 206.4, 205.45), 'block');
        assert.equal(judgeLinkDescentContact('raise', 206.4, 206.44), 'block');
        // Well below the top inside declared free space: a collision.
        assert.equal(judgeLinkDescentContact('raise', 206.4, 203.4), 'abort');
        assert.equal(judgeLinkDescentContact('raise', 206.4, 208), 'abort');
        assert.equal(linkDescentMayBlock('raise', null), false);
        assert.equal(linkDescentMayBlock('raise', 206.4), true);
        assert.equal(linkDescentMayBlock('wall', null), true);
    }],

    ['the +Z lift cap of a top link: to the traverse height, or no higher than the stated top (then a lift past it blocks)', () => {
        assert.deepEqual(topLinkLiftCap(203.4, 328, null), { maxLiftTotalMm: 124.6, onMax: 'plain-move' });
        assert.deepEqual(topLinkLiftCap(203.4, 328, 206.4), { maxLiftTotalMm: 3, onMax: 'block' });
        assert.deepEqual(topLinkLiftCap(207.4, 328, 206.4), { maxLiftTotalMm: 0, onMax: 'block' }, 'a link already above the top has no lift room');
    }],

    ['the confirm page names the retreat direction so a wall retreat is not read as an unexpected Z hop', () => {
        assert.ok(describeLinkStyle('wall', 2, 328, null).includes('never +Z'));
        assert.ok(describeLinkStyle('wall', 2, 328, null).includes('BLOCKED'));
        assert.ok(describeLinkStyle('top', 2, 328, null).includes('lifts 2 mm (+Z)'));
        assert.ok(describeLinkStyle('top', 2, 328, 206.4).includes('never above the stated top Z206.4'));
        assert.ok(describeLinkStyle('raise', 2, 328, null).includes('Z328'));
    }],
];
