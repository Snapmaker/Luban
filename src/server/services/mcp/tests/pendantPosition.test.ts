import assert from 'assert';
import { judgeBeat } from '../machinePosition';
import { pendantPosition } from '../pendantPosition';
import { PositionOfRecord } from '../positionOfRecord';
import type { PositionSnapshot } from '../tools/machine';

const offset = { x: -169.5, y: -129.800995, z: -212.001007 };
const record: PositionOfRecord = { source: 'echo',
    tool: 'usb_pendant',
    sequence: 4,
    at: 5000,
    machine: { x: 124.220, y: 203.329, z: 327.999 },
    previousMachine: { x: 124.120, y: 203.329, z: 327.999 } };
function snapshot(now = 5200): PositionSnapshot {
    const raw = { x: 124.119, y: 203.329, z: 327.999 };
    const judged = judgeBeat({ raw,
        offsetReported: offset,
        cachedOffset: offset,
        zeroStreak: 0,
        previousRaw: { x: -45.48, y: 73.528, z: 115.998 },
        lastAccepted: null,
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 350, y: 350, z: 325 } },
        reportedAt: 3500,
        now,
        staleMs: 10000,
        verified: record.machine,
        machineFrameStreak: 0 });
    return { convention: 'test',
        machine: judged.machine,
        work: raw,
        originOffset: judged.offset.offset,
        originOffsetSource: judged.offset.source,
        reliability: judged.reliability,
        frame: judged.frame,
        machineReportedAt: judged.machineReportedAt,
        reasons: judged.reasons,
        warnings: judged.reasons,
        judged: { accepted: judged.accepted, rejectedReason: judged.rejectedReason, derived: judged.derived },
        b: 0,
        isFourAxis: true,
        isHomed: true,
        machineStatus: 'idle',
        reportAgeMs: now - 3500,
        reportedAt: 3500 };
}
export const tests: Array<[string, () => void]> = [
    ['pendant uses the existing verified record across delayed G53-window heartbeats', () => {
        for (const now of [5200, 8500]) {
            const p = snapshot(now);
            assert.ok(p.warnings.length);
            const dro = pendantPosition(p, record, offset, now, 10000);
            assert.equal(dro.warnings.length, 0);
            assert.equal(dro.heartbeatWarnings.length, p.warnings.length);
            assert.equal(dro.source, 'pendant-controller-echo');
            assert.deepEqual(dro.machine, record.machine);
            assert.ok(Math.abs((dro.work?.x as number) - (-45.280)) < 0.001);
            assert.equal(dro.stale_after_ms, 10000);
        }
    }],
    ['a late-received report of the previous recorded position cannot disarm a verified jog', () => {
        const p = { ...snapshot(), reportedAt: 5100, reportAgeMs: 100 };
        const dro = pendantPosition(p, record, offset, 5200, 10000);
        assert.equal(dro.warnings.length, 0);
        assert.deepEqual(dro.machine, record.machine);
        assert.ok(dro.heartbeatWarnings.length);
    }],
    ['estimates, missing records, changed offsets, unrelated echoes and true staleness remain blocked', () => {
        for (const r of [null, { ...record, source: 'estimated' as const }, { ...record, tool: 'other' }]) {
            assert.ok(pendantPosition(snapshot(), r, offset, 5200, 10000).warnings.length);
        }
        assert.ok(pendantPosition(snapshot(), record, null, 5200, 10000).warnings.length);
        assert.ok(pendantPosition(snapshot(), record, { ...offset, x: 0 }, 5200, 10000).warnings.length);
        assert.ok(pendantPosition(snapshot(14000), record, offset, 14000, 10000).warnings.length);
        const newer = { ...snapshot(), reportedAt: 5100, work: { x: 50, y: 60, z: 70 } };
        assert.ok(pendantPosition(newer, record, offset, 5200, 10000).warnings.length);
    }],
];
