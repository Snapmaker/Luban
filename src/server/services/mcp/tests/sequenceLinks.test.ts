import { strict as assert } from 'assert';

import { ObstacleBox, checkMotion, sequenceMotion } from '../envelopeChecks';
import { LocalLinksError, hopHeight, isLocalHop, localHopRefusal, resolveLocalLinks } from '../sequenceLinks';

const HOP_Z = 328;

function refuses(fn: () => unknown, needle: string): void {
    try {
        fn();
    } catch (err) {
        assert.ok(err instanceof LocalLinksError, `expected LocalLinksError, got ${String(err)}`);
        assert.ok((err as Error).message.includes(needle), (err as Error).message);
        return;
    }
    assert.fail(`expected a refusal containing "${needle}"`);
}

export const tests: Array<[string, () => void]> = [
    ['no local_links: every hop is at the traverse height, as before', () => {
        assert.equal(resolveLocalLinks(undefined, HOP_Z), null);
        assert.equal(resolveLocalLinks(null, HOP_Z), null);
        assert.equal(hopHeight(null, 203, HOP_Z), HOP_Z);
        assert.equal(localHopRefusal(null, { z: HOP_Z, distanceMm: 300, index: 2 }, HOP_Z), null);
    }],

    ['the 2026-10-17 FR4 board: tops at ~204.4, clearance 208.4, default cap 60', () => {
        const links = resolveLocalLinks({ clearance_z: 208.4 }, HOP_Z);
        assert.deepEqual(links, { clearanceZ: 208.4, maxHopMm: 60 });
        // After a side march that started at Z203 (below the top), the next hop raises to the clearance.
        assert.equal(hopHeight(links, 203, HOP_Z), 208.4);
        // After a -Z march that started at Z210 (above the clearance), the hop stays at 210: never descend to link.
        assert.equal(hopHeight(links, 210, HOP_Z), 210);
        // From the staged position at the top, the first hop is a full law-2 hop.
        assert.equal(hopHeight(links, HOP_Z, HOP_Z), HOP_Z);
        assert.ok(isLocalHop(208.4, HOP_Z));
        assert.equal(isLocalHop(327.9989959716797, HOP_Z), false);
    }],

    ['a local hop longer than max_hop_mm is refused at staging with the fix named; a top hop is not', () => {
        const links = resolveLocalLinks({ clearance_z: 208.4, max_hop_mm: 40 }, HOP_Z);
        const refusal = localHopRefusal(links, { z: 208.4, distanceMm: 95.2, index: 5 }, HOP_Z);
        assert.ok(refusal && refusal.includes('steps[5]') && refusal.includes('95.2 mm') && refusal.includes('max_hop_mm 40'));
        assert.ok(refusal && refusal.includes('intermediate hop step'));
        assert.equal(localHopRefusal(links, { z: 208.4, distanceMm: 40, index: 5 }, HOP_Z), null);
        assert.equal(localHopRefusal(links, { z: HOP_Z, distanceMm: 300, index: 1 }, HOP_Z), null);
    }],

    ['bad local_links are refused: missing clearance, at/below the bed, not below the top, cap exceeded', () => {
        refuses(() => resolveLocalLinks({}, HOP_Z), 'clearance_z is required');
        refuses(() => resolveLocalLinks({ clearance_z: 'top' }, HOP_Z), 'clearance_z is required');
        refuses(() => resolveLocalLinks({ clearance_z: 0 }, HOP_Z), 'at or below the bed');
        refuses(() => resolveLocalLinks({ clearance_z: 328 }, HOP_Z), 'not below the traverse height');
        refuses(() => resolveLocalLinks({ clearance_z: 200, max_hop_mm: 61 }, HOP_Z), 'exceeds the operator-authorised maximum of 60');
        refuses(() => resolveLocalLinks({ clearance_z: 200, max_hop_mm: 0 }, HOP_Z), 'max_hop_mm must be');
        refuses(() => resolveLocalLinks([208], HOP_Z), 'must be an object');
    }],

    ['the envelope check sees a local hop at ITS height: a landmark above it refuses, one below it passes', () => {
        const steps = [
            { kind: 'hop' as const, x: 100, y: 100, z: HOP_Z },
            { kind: 'descend' as const, z: 203 },
            { kind: 'probe' as const, name: 'w', unit: { x: 1, y: 0, z: 0 }, maxTravelMm: 3, start: { x: 100, y: 100, z: 203 }, endZ: 203 },
            { kind: 'hop' as const, x: 130, y: 100, z: 208.4 },
            { kind: 'descend' as const, z: 203 },
            { kind: 'probe' as const, name: 'e', unit: { x: -1, y: 0, z: 0 }, maxTravelMm: 3, start: { x: 130, y: 100, z: 203 }, endZ: 203 },
        ];
        const segments = sequenceMotion({ hopZ: HOP_Z, staged: { x: 0, y: 0, z: HOP_Z }, steps });
        const localHop = segments.find((s) => s.what === 'steps[3] hop');
        assert.ok(localHop && localHop.from.z === 208.4 && localHop.to.z === 208.4);
        // The descend column after the local hop starts at the local height, not the top.
        const column = segments.find((s) => s.what === 'steps[4] descend column');
        assert.ok(column && column.from.z === 208.4 && column.to.z === 203);
        // A clamp on the route whose clearance is above the link height refuses the low hop ...
        const options = { traverseZ: HOP_Z, toolProtrusionMm: 0, clearanceMarginMm: 0 };
        const clampOverRoute: ObstacleBox = { name: 'clamp', machine: { x0: 110, y0: 90, x1: 120, y1: 110 }, clearanceZ: 215, mode: 'volume' };
        const violations = checkMotion(segments, [clampOverRoute], options);
        assert.ok(violations.some((v) => v.what === 'steps[3] hop' && v.obstacle === 'clamp'));
        // ... and the same box with a clearance below the link height is passable.
        const lowClamp: ObstacleBox = { name: 'tape', machine: { x0: 110, y0: 90, x1: 120, y1: 110 }, clearanceZ: 206, mode: 'volume' };
        assert.deepEqual(checkMotion(segments, [lowClamp], options), []);
    }],

    ['without per-step heights sequenceMotion behaves as before (every hop at the top, probes end raised)', () => {
        const segments = sequenceMotion({
            hopZ: HOP_Z,
            staged: { x: 0, y: 0, z: HOP_Z },
            steps: [
                { kind: 'hop', x: 100, y: 100 },
                { kind: 'probe', name: 'top', unit: { x: 0, y: 0, z: -1 }, maxTravelMm: 130, start: { x: 100, y: 100, z: HOP_Z } },
                { kind: 'hop', x: 150, y: 100 },
            ],
        });
        assert.equal(segments[0].from.z, HOP_Z);
        assert.equal(segments[2].from.z, HOP_Z);
        assert.equal(segments[2].to.z, HOP_Z);
    }],
];
