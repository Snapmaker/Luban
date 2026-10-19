import { strict as assert } from 'assert';

import {
    InspectionReport,
    ProbeResultRecord,
    TIP_CONVENTION,
    deviationAlongNormal,
    renderCsv,
    renderFusion,
    renderRenishaw,
    surfaceFromContact,
} from '../inspectionReport';

// The rig's tip: 1.25 mm diameter (set_probe_geometry, 2026-09-21).
const R = 0.625;

function record(over: Partial<ProbeResultRecord> & { contactWork: { x: number; y: number; z: number } | null }): ProbeResultRecord {
    return {
        index: 1,
        id: '1',
        name: 'p',
        line: 5,
        mode: 'G38.2',
        bDeg: 180,
        status: over.contactWork ? 'contact' : 'no_contact',
        startMachine: { x: 0, y: 0, z: 210 },
        targetMachine: { x: 0, y: 0, z: 200 },
        direction: { x: 0, y: 0, z: -1 },
        contactMachine: over.contactWork,
        travelMm: 3.6,
        maxTravelMm: 10,
        shortOfTargetMm: 6.4,
        spreadMm: 0,
        deviationMm: null,
        withinTolerance: null,
        meta: {},
        ...over,
    };
}

function report(probes: ProbeResultRecord[], tip: number | null = 2 * R): InspectionReport {
    return {
        source: 'test',
        jobId: null,
        startedAt: 0,
        endedAt: 0,
        frame: { originOffset: { x: 0, y: 0, z: 0 }, convention: '' },
        tipDiameterMm: tip,
        tipConvention: TIP_CONVENTION,
        results: {},
        probes,
        summary: { total: probes.length, contacts: probes.length, misses: 0, outOfTolerance: 0, maxAbsDeviationMm: null },
    };
}

export const tests: Array<[string, () => void]> = [
    ['the surface of a -Z contact IS the contact (the effective length is to the tip bottom); a side contact is one radius on', () => {
        // A top probed at Z 206.4 (toolhead, = surface in this frame) with the surface normal up.
        assert.deepEqual(surfaceFromContact({ x: 170, y: 145, z: 206.4 }, { x: 0, y: 0, z: 1 }, R), { x: 170, y: 145, z: 206.4 });
        // A +X wall met at tip centre X 196.85, normal -X (free side): the wall is 0.625 further +X, at the ball-centre height.
        assert.deepEqual(surfaceFromContact({ x: 196.85, y: 160, z: 203.4 }, { x: -1, y: 0, z: 0 }, R), { x: 197.475, y: 160, z: 204.025 });
        // A 45 degree face: half of each.
        const s = surfaceFromContact({ x: 0, y: 0, z: 0 }, { x: 0, y: -Math.SQRT1_2, z: Math.SQRT1_2 }, 1);
        assert.ok(Math.abs(s.y - Math.SQRT1_2) < 1e-9 && Math.abs(s.z - (1 - Math.SQRT1_2)) < 1e-9);
        assert.ok(TIP_CONVENTION.includes('stylus-BOTTOM Z'));
    }],

    ['deviations: a top at its nominal reads 0 (was -1.25 with the radius taken off), a wall 0.5 mm proud reads +0.5', () => {
        const top = deviationAlongNormal({ x: 170, y: 145, z: 206.4 }, { x: 170, y: 145, z: 206.4 }, { x: 0, y: 0, z: 1 }, 0.2, -0.2, R);
        assert.equal(top.deviationMm, 0);
        assert.equal(top.withinTolerance, true);
        // Pass 1's px_fan_00: nominal x 197.25, contact 196.85 marching +X (normal -1,0,0): the surface is at 197.475,
        // 0.225 BEYOND the nominal along the march - the pocket is wider, material missing, so the deviation is negative.
        const wall = deviationAlongNormal({ x: 196.85, y: 154.05, z: 203.4 }, { x: 197.25, y: 154.05, z: 203.4 }, { x: -1, y: 0, z: 0 }, 1, -1, R);
        assert.equal(wall.deviationMm, -0.225, 'the pass-1 report said -0.85: the raw contact with another radius taken off');
        const proud = deviationAlongNormal({ x: 0, y: 0, z: 10.5 }, { x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 1 }, 0.2, -0.2, R);
        assert.equal(proud.deviationMm, 0.5);
        assert.equal(proud.withinTolerance, false);
    }],

    ['Fusion G801 carries the stylus CENTRE (Z + r) with R, since Fusion subtracts R along the normal itself', () => {
        const rec = record({ contactWork: { x: 10, y: 20, z: 5 }, meta: { nominal: { x: 10, y: 20, z: 5 }, normal: { x: 0, y: 0, z: 1 } } });
        const text = renderFusion(report([rec]));
        assert.ok(text.includes('G801 N1 X10.0000 Y20.0000 Z5.6250 R0.6250'), text);
        assert.ok(text.includes('G800 N1 X10.0000 Y20.0000 Z5.0000 I0.000000 J0.000000 K1.000000'));
        // Without a stored tip the centre cannot be known: R 0 and Z as recorded.
        assert.ok(renderFusion(report([rec], null)).includes('G801 N1 X10.0000 Y20.0000 Z5.0000 R0.0000'));
    }],

    ['Renishaw sizes come out physical: a boss probed from both sides is contacts apart MINUS one tip diameter', () => {
        const lo = record({ index: 1,
            id: '1',
            name: 'xm',
            contactWork: { x: 9, y: 0, z: 3 },
            direction: { x: 1, y: 0, z: 0 },
            meta: { group: 'boss1', role: 'x_minus', feature: 'boss', nominalSizeMm: 12, nominal: { x: 9.625, y: 0, z: 3 }, normal: { x: -1, y: 0, z: 0 } } });
        const hi = record({ index: 2,
            id: '2',
            name: 'xp',
            contactWork: { x: 21, y: 0, z: 3 },
            direction: { x: -1, y: 0, z: 0 },
            meta: { group: 'boss1', role: 'x_plus', feature: 'boss', nominalSizeMm: 12, nominal: { x: 20.375, y: 0, z: 3 }, normal: { x: 1, y: 0, z: 0 } } });
        const text = renderRenishaw(report([lo, hi]));
        // A BOSS: the stylus stops one radius outside each face, so the boss is the 12 mm between contacts minus 1.25 = 10.75.
        assert.ok(text.includes('SIZE D12.0000   ACTUAL 10.7500'), text);
        assert.ok(renderCsv(report([lo, hi])).split('\n').length >= 3);
    }],
];
