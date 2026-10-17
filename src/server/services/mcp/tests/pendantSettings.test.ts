import assert from 'assert';
import type { ActiveTool } from '../activeTool';
import type { Landmark } from '../landmarks';
import { requiredToolheadZ } from '../landmarkClearance';
import { isolatedModule } from './jobDashboard.test';

function fixture(initialTool: Partial<ActiveTool> | null = null) {
    let items: Landmark[] = [];
    let nextId = 0;
    let tool = initialTool;
    const messages: string[] = [];
    const module = isolatedModule('pendantSettings.ts', {
        '../../lib/logger': () => ({ info: (message: string) => messages.push(message) }),
        './activeTool': { getActiveTool: () => tool,
            describeActiveTool: () => ({ active: tool }),
            clearActiveTool: () => { tool = null; },
            setActiveTool: (input: Partial<ActiveTool>) => { tool = input; return tool; } },
        './clearanceContext': { currentToolProtrusion: () => ({ mm: tool?.protrusionMm || null }) },
        './landmarkClearance': { CLEARANCE_MARGIN_MM: 5 },
        './landmarks': { landmarkStore: {
            list: () => items,
            add: (input: Omit<Landmark, 'id' | 'createdAt'>) => {
                const item = { ...input, id: String(++nextId), createdAt: 123 };
                items = items.filter((old) => old.name !== item.name).concat(item);
                return item;
            },
            remove: (id: string) => { items = items.filter((item) => item.id !== id); return true; },
        } },
    });
    return { update: module.updatePendantSettings, read: module.pendantSettings, messages };
}

const obstacle = { kind: 'obstacle',
    name: 'fixture',
    description: 'Operator setup',
    enabled: true,
    x0: 1,
    x1: 10,
    y0: 2,
    y1: 20,
    clearanceBasis: 'physical',
    clearanceZ: 250 };

export const tests: Array<[string, () => void]> = [
    ['operator tool confirmation changes effective clearance without pretending to be a measurement', () => {
        const f = fixture();
        f.update(obstacle);
        f.update({ kind: 'tool', protrusionReference: 'toolhead', protrusionMm: 12, source: 'tool_setter', measurementJobId: 'invented' });
        const saved = f.read();
        assert.equal(saved.activeTool.active.source, 'operator');
        assert.equal(saved.activeTool.active.clearanceBasis, 'toolhead_reference');
        assert.equal(saved.toolProtrusion.mm, 12);
        assert.equal(saved.landmarks[0].clearanceZ, 250);
        assert.equal(requiredToolheadZ(250, 'physical', saved.toolProtrusion.mm, saved.clearanceMarginMm), 267);
        f.update({ kind: 'clear-tool' });
        assert.equal(f.read().activeTool.active, null);
        assert.ok(f.messages.some((message) => message.includes('confirmed fitted tool')));
    }],
    ['pendant requires a named physical reference and only retains an unchanged current measurement', () => {
        const measured = { protrusionMm: 75.3,
            source: 'spindle_probe' as const,
            measurementId: 'current',
            clearanceBasis: 'toolhead_reference' as const,
            toolIdentity: 'probe-A' };
        const f = fixture(measured);
        assert.throws(() => f.update({ kind: 'tool', protrusionMm: 45 }), /toolhead reference/);
        assert.throws(() => f.update({ kind: 'tool', protrusionReference: 'collet', protrusionMm: 45 }), /toolhead reference/);
        const same = { kind: 'tool', protrusionReference: 'toolhead', sameFitting: true, protrusionMm: 75.3, toolIdentity: 'probe-A' };
        f.update(same);
        assert.equal(f.read().activeTool.active.measurementId, 'current');
        assert.throws(() => f.update({ ...same, protrusionMm: 45 }), /no longer matches/);
        assert.throws(() => f.update({ ...same, toolIdentity: 'new tool' }), /no longer matches/);
        assert.throws(() => fixture().update(same), /no longer matches/);
        f.update({ ...same, sameFitting: false });
        assert.equal(f.read().activeTool.active.source, 'operator');
        assert.equal(f.read().activeTool.active.measurementId, undefined);
    }],
    ['malformed lengths, footprints, height bases and heights cannot change saved settings', () => {
        const f = fixture();
        for (const value of [0, -1, null, '12', Infinity]) {
            assert.throws(() => f.update({ kind: 'tool', protrusionMm: value }));
        }
        for (const changed of [{ x1: 0 }, { y0: '1' }, { x0: NaN }, { name: '' },
            { description: '' }, { clearanceBasis: 'guessed' }, { clearanceZ: null }, { enabled: 'yes' }]) {
            assert.throws(() => f.update({ ...obstacle, ...changed }));
        }
        assert.equal(f.read().landmarks.length, 0);
        assert.equal(f.read().activeTool.active, null);
    }],
    ['operator can edit, rename, disable and remove a saved obstruction with old values logged', () => {
        const f = fixture(); f.update(obstacle);
        let item = f.read().landmarks[0];
        f.update({ ...obstacle, id: item.id, name: 'moved fixture', x0: 20, x1: 30, clearanceBasis: 'toolhead', clearanceZ: 280 });
        item = f.read().landmarks[0];
        assert.equal(f.read().landmarks.length, 1);
        assert.equal(item.name, 'moved fixture');
        assert.equal(item.machine.x0, 20);
        assert.equal(item.clearanceZ, 280);
        assert.equal(item.clearanceBasis, 'toolhead');
        f.update({ ...obstacle, id: item.id, enabled: false });
        item = f.read().landmarks[0];
        assert.equal(item.clearanceZ, null);
        f.update({ kind: 'remove-obstacle', id: item.id });
        assert.equal(f.read().landmarks.length, 0);
        assert.ok(f.messages.some((message) => message.includes('"before":') && message.includes('"after":')));
    }],
    ['stale editors and duplicate new names cannot silently overwrite another saved obstacle', () => {
        const f = fixture(); f.update(obstacle);
        const oldId = f.read().landmarks[0].id;
        assert.throws(() => f.update(obstacle), /already exists/);
        f.update({ ...obstacle, id: oldId, clearanceZ: 240 });
        assert.throws(() => f.update({ ...obstacle, id: oldId }), /changed/);
        assert.throws(() => f.update({ kind: 'remove-obstacle', id: oldId }), /reload/);
        assert.equal(f.read().landmarks[0].clearanceZ, 240);
    }],
];
