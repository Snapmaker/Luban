// The SACP channel's latest-machine-state mapping (#260): a coordinate-system
// report and a heartbeat become the state shape the MCP reads from
// SstpHttpChannel, and the position judge accepts a homed Ray from it.
import assert from 'assert';
import {
    SACP_AXIS_KEY,
    SacpMachineStateTracker,
    deriveHeadPower,
    mapCoordinateReport,
    pickHeartbeatExtras,
} from '../../machine/channels/sacpMachineState';
import { judgeBeat } from '../machinePosition';

const { x: X, y: Y, z: Z, b: B } = SACP_AXIS_KEY;

/** A report as the SDK's CoordinateSystemInfo.fromBuffer hands it over. */
function report(coordinates: Array<[number, number]>, originOffset: Array<[number, number]>, homed = 0) {
    return {
        homed,
        coordinates: coordinates.map(([key, value]) => ({ key, value })),
        originOffset: originOffset.map(([key, value]) => ({ key, value })),
    };
}

/** machineBounds() for the Ray definition (600 x 400 x 0). */
const RAY_BOUNDS = { min: { x: 0, y: 0, z: 0 }, max: { x: 600, y: 400, z: 0 } };

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['a full XYZB report maps by axis key into pos / originOffset / isHomed, machine = work - originOffset', () => {
        // Keys deliberately out of array order: the legacy UI mapping indexed by position.
        const mapped = mapCoordinateReport(report([[B, 45], [Z, 151.246], [Y, 24.399], [X, 38.399]],
            [[X, -139.91], [Y, -188.721], [Z, -176.754], [B, 0]]), true);
        assert.deepStrictEqual(mapped.pos, { x: 38.399, y: 24.399, z: 151.246, b: 45, isFourAxis: true });
        assert.deepStrictEqual(mapped.originOffset, { x: -139.91, y: -188.721, z: -176.754, b: 0 });
        assert.strictEqual(mapped.isHomed, true, 'homed 0 means homed');
        assert.deepStrictEqual(mapped.reportedAxes, ['x', 'y', 'z', 'b']);
        assert.strictEqual(mapCoordinateReport(report([[X, 0], [Y, 0], [Z, 0]], [[X, 0], [Y, 0], [Z, 0]], 1), false).isHomed, false);
        // The judge derives machine = work - originOffset (the renderer's DisplayPanel does the same).
        assert.ok(Math.abs(((mapped.pos.x as number) - (mapped.originOffset.x as number)) - 178.309) < 1e-9);
    }],

    ['a two-axis machine (Ray: no Z) reads Z as 0 in pos and offset, and says which axes were real', () => {
        const mapped = mapCoordinateReport(report([[X, -1], [Y, 399]], [[X, 0], [Y, 0]]), false);
        assert.deepStrictEqual(mapped.pos, { x: -1, y: 399, z: 0, b: null, isFourAxis: false });
        assert.deepStrictEqual(mapped.originOffset, { x: 0, y: 0, z: 0, b: null });
        assert.deepStrictEqual(mapped.reportedAxes, ['x', 'y']);
    }],

    ['an empty offset list is a report with no offset: nulls, so the judge rejects it as no-offset-yet', () => {
        const mapped = mapCoordinateReport(report([[X, 10], [Y, 20], [Z, 30]], []), false);
        assert.deepStrictEqual(mapped.originOffset, { x: null, y: null, z: null, b: null });
        const judged = judgeBeat({
            raw: { x: 10, y: 20, z: 30 },
            offsetReported: mapped.originOffset,
            cachedOffset: null,
            zeroStreak: 0,
            previousRaw: null,
            bounds: RAY_BOUNDS,
            reportedAt: 1000,
            now: 1000,
            staleMs: 10000,
            lastAccepted: null,
            verified: null,
            machineFrameStreak: 0,
        });
        assert.strictEqual(judged.accepted, false);
        assert.strictEqual(judged.rejectedReason, 'no-offset-yet');
    }],

    ['a homed Ray at X-1 Y399 with a zero work offset is accepted against the Ray travel (not the A350 values)', () => {
        const mapped = mapCoordinateReport(report([[X, -1], [Y, 399]], [[X, 0], [Y, 0]]), false);
        const judged = judgeBeat({
            raw: { x: mapped.pos.x, y: mapped.pos.y, z: mapped.pos.z },
            offsetReported: { x: mapped.originOffset.x, y: mapped.originOffset.y, z: mapped.originOffset.z },
            cachedOffset: null,
            zeroStreak: 0,
            previousRaw: null,
            bounds: RAY_BOUNDS,
            reportedAt: 5000,
            now: 5100,
            staleMs: 10000,
            lastAccepted: null,
            verified: null,
            machineFrameStreak: 0,
        });
        assert.strictEqual(judged.accepted, true, judged.reasons.join(' '));
        assert.deepStrictEqual(judged.machine, { x: -1, y: 399, z: 0 });
        assert.strictEqual(judged.reliability, 'heartbeat');
        assert.strictEqual(judged.frame, 'work-frame');
        // Y399 sits inside even the A350 box's 50 mm margin (350 + 50), but the Ray's far end does not: a report from
        // X590 judged against the A350 box (320 x 350) is "out of bounds", so the bounds must be the connected machine's.
        const far = judgeBeat({
            raw: { x: 590, y: 399, z: 0 },
            offsetReported: { x: 0, y: 0, z: 0 },
            cachedOffset: null,
            zeroStreak: 0,
            previousRaw: null,
            bounds: RAY_BOUNDS,
            reportedAt: 5000,
            now: 5100,
            staleMs: 10000,
            lastAccepted: null,
            verified: null,
            machineFrameStreak: 0,
        });
        assert.strictEqual(far.accepted, true, far.reasons.join(' '));
        const a350 = judgeBeat({
            raw: { x: 590, y: 399, z: 0 },
            offsetReported: { x: 0, y: 0, z: 0 },
            cachedOffset: null,
            zeroStreak: 0,
            previousRaw: null,
            bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 320, y: 350, z: 330 } },
            reportedAt: 5000,
            now: 5100,
            staleMs: 10000,
            lastAccepted: null,
            verified: null,
            machineFrameStreak: 0,
        });
        assert.strictEqual(a350.rejectedReason, 'out-of-bounds');
    }],

    ['the Ray after -Y steps and +X: a work origin away from machine zero still derives the machine position', () => {
        // Operator sets the work origin at machine (90, 80); the head sits at work (0, 0) -> machine (90, 80).
        const mapped = mapCoordinateReport(report([[X, 0], [Y, 0]], [[X, -90], [Y, -80]]), false);
        const judged = judgeBeat({
            raw: { x: mapped.pos.x, y: mapped.pos.y, z: mapped.pos.z },
            offsetReported: { x: mapped.originOffset.x, y: mapped.originOffset.y, z: mapped.originOffset.z },
            cachedOffset: null,
            zeroStreak: 0,
            previousRaw: null,
            bounds: RAY_BOUNDS,
            reportedAt: 5000,
            now: 5100,
            staleMs: 10000,
            lastAccepted: null,
            verified: null,
            machineFrameStreak: 0,
        });
        assert.strictEqual(judged.accepted, true, judged.reasons.join(' '));
        assert.deepStrictEqual(judged.machine, { x: 90, y: 80, z: 0 });
    }],

    ['the tracker merges heartbeat and coordinates, stamps each arrival, and clears to null', () => {
        let at = 1000;
        const tracker = new SacpMachineStateTracker(() => at);
        assert.strictEqual(tracker.get(), null);
        const beat = tracker.noteHeartbeat('idle', { headType: 'laser', laserPower: 0, pos: { x: 'stale-ui-copy' }, isHomed: 'no' });
        assert.strictEqual(beat.status, 'idle');
        assert.strictEqual(beat.timestamp, 1000);
        assert.strictEqual(beat.headType, 'laser');
        assert.strictEqual(beat.headPower, 0, 'laser current power is headPower for the toolhead-off guard');
        assert.strictEqual(beat.pos, undefined, 'the heartbeat payload never overrides the coordinate report');
        assert.strictEqual(beat.isHomed, undefined);
        at = 1600;
        const position = tracker.noteCoordinates(report([[X, -1], [Y, 399]], [[X, 0], [Y, 0]]), false);
        assert.strictEqual(position.timestamp, 1600, 'a coordinate report is a beat of its own');
        assert.strictEqual(position.status, 'idle', 'status survives the coordinate merge');
        assert.deepStrictEqual(position.pos, { x: -1, y: 399, z: 0, b: null, isFourAxis: false });
        assert.strictEqual(position.isHomed, true);
        at = 2000;
        const next = tracker.noteHeartbeat('running', { headType: 'laser', laserPower: 55 });
        assert.deepStrictEqual(next.pos, position.pos, 'position survives the heartbeat merge');
        assert.strictEqual(next.status, 'running');
        assert.strictEqual(next.headPower, 55);
        assert.strictEqual(next.timestamp, 2000);
        tracker.noteHomed(false);
        assert.strictEqual(tracker.get()?.isHomed, false, 'the 0x36 notification updates isHomed');
        assert.strictEqual(tracker.get()?.timestamp, 2000, 'but is not a new report');
        tracker.clear();
        assert.strictEqual(tracker.get(), null);
        tracker.noteHomed(true);
        assert.strictEqual(tracker.get(), null, 'a homed notification alone does not resurrect a cleared state');
    }],

    ['pickHeartbeatExtras drops the coordinate-owned fields; deriveHeadPower follows the head type', () => {
        assert.deepStrictEqual(pickHeartbeatExtras({ pos: 1, originOffset: 2, isHomed: 3, headType: 'cnc', toolHead: 'x' }),
            { headType: 'cnc', toolHead: 'x' });
        assert.deepStrictEqual(pickHeartbeatExtras(undefined as unknown as { [key: string]: unknown }), {});
        assert.strictEqual(deriveHeadPower({ headType: 'laser', laserPower: 12.5, cncCurrentSpindleSpeed: 9000 }), 12.5);
        assert.strictEqual(deriveHeadPower({ headType: 'cnc', laserPower: 12.5, cncCurrentSpindleSpeed: 9000 }), 9000);
        assert.strictEqual(deriveHeadPower({ headType: 'printing', laserPower: 12.5 }), undefined);
        assert.strictEqual(deriveHeadPower({ headType: 'laser' }), undefined);
        assert.strictEqual(deriveHeadPower({ headType: 'laser', laserPower: 'n/a' }), undefined);
    }],
];
