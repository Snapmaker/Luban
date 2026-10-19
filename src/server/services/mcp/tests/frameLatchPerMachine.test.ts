// The frame latch per machine (tyeth/Luban#265 WP8, plan 1.4): G53 left
// selected on the A350 says nothing about the Original's controller, so an
// A350 latch must not lock the Original out (the gcode lease admitted only
// Luban's 3-line home and the MCP home refused under it). A latch belongs to
// the machine it was raised on; an untagged (pre-WP8) file migrates as the
// A350's; a latch raised with no machine known still applies to every machine.
import { strict as assert } from 'assert';

import {
    allFrameLatches,
    clearFrameLatch,
    getFrameLatch,
    latchFrameUncertain,
    noteFrameRestored,
    otherMachineFrameLatches,
    resetFrameLatchesForTest,
    setFrameLatchMachineSource,
} from '../positionOfRecord';
import { machineToolsFixture } from './machineStore.test';

const A350 = 'Snapmaker 2.0 A350';
const ORIGINAL = 'Original';
const RAY = 'Ray';

function withMachine(run: (connect: (id: string | null) => void) => void): void {
    let connected: string | null = null;
    resetFrameLatchesForTest();
    setFrameLatchMachineSource(() => connected);
    try {
        run((id) => { connected = id; });
    } finally {
        setFrameLatchMachineSource(null);
        resetFrameLatchesForTest();
    }
}

export const tests: Array<[string, () => void]> = [
    ['an A350 latch does not apply to the Original (same process, no restart) and is reported as another machine\'s', () => {
        withMachine((connect) => {
            connect(A350);
            latchFrameUncertain('queued pendant run on the A350', 1000);
            assert.equal(getFrameLatch()?.machineIdentifier, A350);
            connect(ORIGINAL);
            assert.equal(getFrameLatch(), null, 'the Original is not latched by the A350');
            assert.deepEqual(otherMachineFrameLatches().map((l) => l.machineIdentifier), [A350]);
            clearFrameLatch();
            assert.equal(allFrameLatches().length, 1, 'clearing on the Original leaves the A350 latch');
            connect(A350);
            assert.equal(getFrameLatch()?.reason, 'queued pendant run on the A350', 'back on the A350 it still applies');
        });
    }],
    ['restore and clear act on the connected machine\'s latch only', () => {
        withMachine((connect) => {
            connect(A350);
            latchFrameUncertain('A350 cleanup', 1000);
            connect(RAY);
            latchFrameUncertain('Ray cleanup', 2000);
            noteFrameRestored(3000);
            clearFrameLatch();
            assert.equal(getFrameLatch(), null);
            connect(A350);
            const a350 = getFrameLatch();
            assert.equal(a350?.reason, 'A350 cleanup');
            assert.equal(a350?.restoredAt, null, 'the Ray restore did not touch the A350 latch');
        });
    }],
    ['a latch raised with no machine known applies to every machine (as cautious as before)', () => {
        withMachine((connect) => {
            connect(null);
            latchFrameUncertain('unknown machine', 1000);
            connect(ORIGINAL);
            assert.equal(getFrameLatch()?.reason, 'unknown machine');
            connect(A350);
            assert.equal(getFrameLatch()?.reason, 'unknown machine');
        });
        // No resolver at all (the existing suites): one global latch, exactly as before.
        resetFrameLatchesForTest();
        latchFrameUncertain('no resolver', 1000);
        assert.equal(getFrameLatch()?.machineIdentifier, null);
        clearFrameLatch();
        assert.equal(getFrameLatch(), null);
    }],
    ['persisted latches: a pre-WP8 untagged file migrates as the A350\'s; v2 keeps each machine; unreadable binds the A350 only', () => {
        const { tools } = machineToolsFixture({});
        const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
        const legacy = plain(tools.persistedFrameLatches({ reason: 'A queued pendant run.', since: 5, restoredAt: null }));
        assert.deepEqual(legacy.map((l: { machineIdentifier: string }) => l.machineIdentifier), [A350]);
        assert.match(legacy[0].reason, /A queued pendant run/);
        const v2 = plain(tools.persistedFrameLatches({ version: 2,
            latches: [
                { reason: 'a', since: 1, restoredAt: null, machineIdentifier: A350 },
                { reason: 'b', since: 2, restoredAt: null, machineIdentifier: null },
            ] }));
        assert.deepEqual(v2.map((l: { machineIdentifier: string | null }) => l.machineIdentifier), [A350, null]);
        const unreadable = plain(tools.persistedFrameLatches('unreadable'));
        assert.deepEqual(unreadable.map((l: { machineIdentifier: string }) => l.machineIdentifier), [A350]);
        assert.match(unreadable[0].reason, /unreadable latch file/);
        assert.deepEqual(plain(tools.persistedFrameLatches(null)), []);
    }],
];
