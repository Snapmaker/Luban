import { strict as assert } from 'assert';

import { ObstacleBox } from '../envelopeChecks';
import { describeSurveyLegs, planSurvey } from '../surveyPlan';

// The rotary landmark as stored on the A350 (issue #141): X140-200 across the
// whole Y, clearance 328 at the TOOLHEAD - a placeholder for an unmeasured
// tailstock, stored as 'crossing' so the probing procedures may work inside.
const ROTARY: ObstacleBox = {
    name: 'rotary-axis',
    machine: { x0: 140, y0: 0, x1: 200, y1: 350 },
    clearanceZ: 328,
    mode: 'crossing',
};

// The 2026-09-20 survey: xs 100..260 by 40, two rows, three levels.
const XS = [100, 140, 180, 220, 260];
const YS = [100, 140];
const SERPENTINE = YS.flatMap((y, row) => (row % 2 === 0 ? XS : [...XS].reverse()).map((x) => ({ x, y })));

function survey(over: Partial<Parameters<typeof planSurvey>[0]> = {}) {
    return planSurvey({
        levels: [328, 324, 320],
        waypoints: SERPENTINE,
        parkZ: 328,
        fromMachine: { x: -19, y: 342, z: 328 },
        obstacles: [ROTARY],
        toolProtrusionMm: 71.3,
        ...over,
    });
}

export const tests: Array<[string, () => void]> = [
    ['with nothing stored the whole grid runs at every level: hop, then descend XY-stationary into each lower pass', () => {
        const plan = survey({ obstacles: [] });
        assert.equal(plan.captureCount, SERPENTINE.length * 3);
        assert.deepEqual(plan.dropped, []);
        assert.equal(plan.liftedLinks, 0);
        // The Z 324 pass is entered by hopping at 328 (the previous height) to
        // its first waypoint and descending there - never a diagonal.
        const entry = plan.levels[1].legs.slice(0, 3);
        assert.deepEqual(entry.map((l) => l.kind), ['hop', 'descend', 'capture']);
        assert.equal((entry[0] as { z: number }).z, 328);
        assert.equal((entry[1] as { z: number }).z, 324);
        for (const s of plan.segments) {
            if (s.kind === 'column') {
                assert.equal(s.from.x, s.to.x, 'a Z change never moves in XY');
                assert.equal(s.from.y, s.to.y);
            } else {
                assert.equal(s.from.z, s.to.z, 'a hop never changes Z');
            }
        }
    }],

    ['the #141 survey: the pass AT the clearance runs whole, the lower passes drop the columns inside the keep-out and say why', () => {
        const plan = survey();
        assert.equal(plan.levels[0].captures, SERPENTINE.length, 'Z 328 clears a 328 clearance');
        // X140 and X180 (inflated box X135..205) cannot be stood on at 324 or 320.
        const droppedAt = (z: number) => plan.dropped.filter((d) => d.z === z).map((d) => d.x).sort((a, b) => a - b);
        assert.deepEqual(droppedAt(324), [140, 140, 180, 180]);
        assert.deepEqual(droppedAt(320), [140, 140, 180, 180]);
        assert.equal(plan.levels[1].captures, 6);
        assert.equal(plan.levels[2].captures, 6);
        assert.ok(plan.dropped[0].reason.includes('rotary-axis'), plan.dropped[0].reason);
        assert.ok(plan.dropped[0].reason.includes('Dropped from this pass'), plan.dropped[0].reason);
        assert.equal(plan.dropped[0].index, 2, 'the serpentine index is reported, so the gap in the frames is explained');
    }],

    ['a link the level cannot make is lifted to the park height, leg by leg, and counted', () => {
        const plan = survey();
        // At Z 324 the row runs X100 -> X220 straight across the box: lifted.
        const level = plan.levels[1];
        assert.equal(level.liftedLinks, 2, 'one crossing per row');
        const lifted = level.legs.filter((l) => l.kind === 'hop' && l.lifted);
        assert.equal(lifted.length, 2);
        assert.equal((lifted[0] as { z: number }).z, 328, 'the detour travels at the park height');
        // Around a lifted hop: raise before, descend after, XY stationary each time.
        const i = level.legs.indexOf(lifted[0]);
        assert.equal(level.legs[i - 1].kind, 'raise');
        assert.equal(level.legs[i + 1].kind, 'descend');
        assert.equal((level.legs[i - 1] as { x: number }).x, 100);
        assert.equal((level.legs[i + 1] as { x: number }).x, 220);
        assert.equal(plan.liftedLinks, 4);
        // The confirm page names the detour for what it is.
        assert.ok(describeSurveyLegs(level).some((line) => line.includes('LIFTED link at park Z328')));
    }],

    ['a waypoint no route reaches, even at the park height, is dropped with the reason', () => {
        // A physically stated obstacle with no tool length known is impassable at any height.
        const unknownTool: ObstacleBox = {
            name: 'fixture',
            machine: { x0: 150, y0: 90, x1: 170, y1: 150 },
            clearanceZ: 300,
            clearanceBasis: 'physical',
            mode: 'volume',
        };
        const plan = survey({ obstacles: [unknownTool], toolProtrusionMm: null, levels: [328] });
        const reasons = plan.dropped.map((d) => d.reason);
        assert.ok(reasons.some((r) => r.includes('no route')), reasons.join('\n'));
        assert.ok(reasons.some((r) => r.includes('no tool length')), reasons.join('\n'));
        assert.ok(plan.captureCount > 0, 'the reachable part of the grid survives');
    }],

    ['a first level above the staging height is entered by raising first, then hopping', () => {
        const plan = survey({ obstacles: [], levels: [328], fromMachine: { x: 50, y: 50, z: 322 } });
        assert.deepEqual(plan.levels[0].legs.slice(0, 3).map((l) => l.kind), ['raise', 'hop', 'capture']);
        assert.equal((plan.levels[0].legs[0] as { z: number }).z, 328);
    }],

    ['the plan is honest about the heartbeat: a staging Z six microns off the level is the level', () => {
        const plan = survey({ obstacles: [], levels: [328], fromMachine: { x: 100, y: 100, z: 327.9989959716797 } });
        assert.equal(plan.levels[0].legs[0].kind, 'capture', 'already on the first waypoint at the level: no raise, no hop');
    }],
];
