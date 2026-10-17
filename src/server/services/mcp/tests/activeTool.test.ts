import { strict as assert } from 'assert';
import { isolatedModule } from './jobDashboard.test';
import { resolveToolProtrusion } from '../toolProtrusion';

export const tests: Array<[string, () => void]> = [
    ['tool evidence survives invalidation and restart without retaining authority to shorten clearance', () => {
        const store = new Map<string, unknown>();
        const config = { get: (key: string) => store.get(key),
            set: (key: string, value: unknown) => store.set(key, value),
            unset: (key: string) => store.delete(key) };
        const tool = isolatedModule('activeTool.ts', { '../configstore': config });
        const first = tool.setActiveTool({ protrusionMm: 75, source: 'operator', at: 100 });
        assert.equal(first.measuredAt, null);
        assert.equal(tool.getActiveTool().confirmedAt, 100);
        tool.invalidateActiveTool('manual swap');
        assert.equal(tool.getActiveTool(), null);
        assert.equal(tool.describeActiveTool().stored.protrusionMm, 75);
        assert.equal(tool.describeActiveTool().staleReason, 'manual swap');
        tool.setActiveTool({ protrusionMm: 20, source: 'tool_setter', measurementJobId: 'measurement', at: 200 });
        assert.equal(tool.getActiveTool().confirmedAt, null);
        assert.equal(tool.getActiveTool().protrusionMm, 20);
        const restarted = isolatedModule('activeTool.ts', { '../configstore': config });
        assert.equal(restarted.getActiveTool(), null);
        assert.equal(restarted.getStoredActiveTool().measurementJobId, 'measurement');
    }],
    ['a stale long tool can lengthen the worst-case fallback but a stale short tool cannot shorten it', () => {
        const inputs = { active: null, measured: null, probeEffectiveLengthMm: 70.9, longestBitLengthMm: 75 };
        assert.equal(resolveToolProtrusion({ ...inputs, staleToolMm: 100 }).mm, 100);
        assert.equal(resolveToolProtrusion({ ...inputs, staleToolMm: 20 }).mm, 75);
        assert.equal(resolveToolProtrusion({ ...inputs,
            staleToolMm: 100,
            active: {
                protrusionMm: 20, source: 'operator', status: 'operator_confirmed',
            } }).mm, 20);
    }],
];
