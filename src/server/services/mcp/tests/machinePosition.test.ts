import { strict as assert } from 'assert';

import {
    BOUNDS_MARGIN_MM,
    SUSTAINED_MACHINE_FRAME_BEATS,
    JudgeContext,
    RawBeat,
    createMachinePositionState,
    isFrameFlip,
    judgeBeatStateful,
    noteDisconnected,
    outsideBounds,
    reliableForMotion,
} from '../machinePosition';
import {
    clearFrameLatch,
    frameLatchVerified,
    getFrameLatch,
    latchFrameUncertain,
    noteFrameRestored,
} from '../positionOfRecord';

// The A350 as the position of record sees it: travel 320 x 340 x 330, home at (-19, 342, 328).
const BOUNDS = { min: { x: 0, y: 0, z: 0 }, max: { x: 320, y: 340, z: 330 } };
// This rig's work origin on 2026-09-12: machine (51, 122, 328).
const OFFSET = { x: -51, y: -122, z: -328 };
const T0 = 1_000_000;

function ctx(now: number, over: Partial<JudgeContext> = {}): JudgeContext {
    return { now, staleMs: 10000, bounds: BOUNDS, verified: null, directGcodeQuiet: true, ...over };
}

/** A coherent work-frame beat for machine (170, 199, 240). */
function workBeat(at: number, machine = { x: 170, y: 199, z: 240 }): RawBeat {
    return {
        raw: { x: machine.x + OFFSET.x, y: machine.y + OFFSET.y, z: machine.z + OFFSET.z },
        offsetReported: { ...OFFSET },
        reportedAt: at,
    };
}

export const tests: Array<[string, () => void]> = [
    ['a coherent beat with its own offset is accepted as heartbeat', () => {
        const state = createMachinePositionState();
        const j = judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        assert.equal(j.reliability, 'heartbeat');
        assert.equal(j.accepted, true);
        assert.deepEqual(j.machine, { x: 170, y: 199, z: 240 });
        assert.equal(j.frame, 'work-frame');
        assert.ok(reliableForMotion(j.reliability));
    }],

    ['a G53-window beat carrying machine coords with the offset still populated is REJECTED and the last position held', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        // job 1db4902a4cd6: raw (170, 207.571, 227.7) machine-frame with the offset populated
        // -> the old code produced (221, 329.6, 555.7).
        const bad: RawBeat = { raw: { x: 170, y: 207.571, z: 227.7 }, offsetReported: { ...OFFSET }, reportedAt: T0 + 2000 };
        const j = judgeBeatStateful(state, bad, ctx(T0 + 2100));
        assert.equal(j.accepted, false);
        assert.equal(j.reliability, 'awaiting-resync');
        assert.ok(j.rejectedReason === 'out-of-bounds' || j.rejectedReason === 'frame-flip', j.rejectedReason || 'none');
        assert.deepEqual(j.machine, { x: 170, y: 199, z: 240 }, 'held at the last accepted position');
        assert.equal(j.machineReportedAt, T0);
        assert.equal(j.derived.z, 555.7, 'the artefact is exposed as derived, never as machine');
        assert.ok(!reliableForMotion(j.reliability));
    }],

    ['the next coherent beat rectifies it (resync counted)', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        judgeBeatStateful(state, { raw: { x: 170, y: 207.571, z: 227.7 }, offsetReported: { ...OFFSET }, reportedAt: T0 + 2000 }, ctx(T0 + 2100));
        const j = judgeBeatStateful(state, workBeat(T0 + 4000, { x: 170, y: 207.571, z: 227.7 }), ctx(T0 + 4100));
        assert.equal(j.reliability, 'heartbeat');
        assert.deepEqual(j.machine, { x: 170, y: 207.571, z: 227.7 });
        assert.equal(state.resyncs, 1);
        assert.equal(state.rejected.outOfBounds + state.rejected.frameFlip, 1);
    }],

    ['a beat more than 50 mm outside the travel is a bug, never a position (Z 656 after a bare G28)', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        const j = judgeBeatStateful(state, { raw: { x: 100, y: 200, z: 328 }, offsetReported: { ...OFFSET }, reportedAt: T0 + 2000 }, ctx(T0 + 2100));
        // derived z = 328 + 328 = 656
        assert.equal(j.rejectedReason, 'out-of-bounds');
        assert.deepEqual(j.outsideAxes, ['z']);
        assert.equal(j.machine.z, 240, 'held');
        assert.ok(j.reasons.some((r) => r.includes(`more than ${BOUNDS_MARGIN_MM} mm outside`)));
    }],

    ['within the 50 mm margin is accepted (home X-19, Y342 are real positions)', () => {
        const state = createMachinePositionState();
        const j = judgeBeatStateful(state, workBeat(T0, { x: -19, y: 342, z: 328 }), ctx(T0 + 100));
        assert.equal(j.accepted, true);
        assert.deepEqual(outsideBounds({ x: -19, y: 342, z: 328 }, BOUNDS), []);
        assert.deepEqual(outsideBounds({ x: -51, y: 0, z: 0 }, BOUNDS), ['x']);
    }],

    ['the frame-flip signature is recognised in both directions', () => {
        const prev = { x: 119, y: 77, z: -88 };
        assert.equal(isFrameFlip({ x: 170, y: 199, z: 240 }, prev, OFFSET), true);
        assert.equal(isFrameFlip(prev, { x: 170, y: 199, z: 240 }, OFFSET), true);
        assert.equal(isFrameFlip({ x: 120, y: 77, z: -88 }, prev, OFFSET), false, 'a 1 mm move is not a flip');
        assert.equal(isFrameFlip({ x: 170, y: 199, z: 240 }, prev, { x: 0, y: 0, z: 0 }), false, 'no offset, no flip');
    }],

    ['a zero-offset G53-window beat during direct gcode reuses the cached offset (cached-offset), and a real re-zero is believed after 3 quiet beats', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        // in flight: pos in machine coords, offset 0,0,0 (job 70b2b8c675a6)
        const busy = ctx(T0 + 2100, { directGcodeQuiet: false });
        const j1 = judgeBeatStateful(
            state, { raw: { x: 170, y: 199, z: 240 }, offsetReported: { x: 0, y: 0, z: 0 }, reportedAt: T0 + 2000 }, busy
        );
        assert.equal(j1.offset.transientZero, true);
        assert.equal(j1.offset.source, 'cached');
        // raw 170,199,240 minus the cached offset = 221, 321, 568 -> out of bounds -> rejected, not believed
        assert.equal(j1.accepted, false);
        assert.deepEqual(j1.machine, { x: 170, y: 199, z: 240 }, 'held');
        assert.equal(state.zeroStreak, 0, 'busy beats never count toward believing a zero');
        // machine idle, the operator zeroed the work origin at machine zero: three quiet beats
        let j = j1;
        for (let i = 1; i <= 3; i += 1) {
            const at = T0 + 2000 + i * 2000;
            j = judgeBeatStateful(state, { raw: { x: 100, y: 100, z: 300 }, offsetReported: { x: 0, y: 0, z: 0 }, reportedAt: at }, ctx(at + 100));
        }
        assert.equal(j.offset.source, 'heartbeat', 'zero believed after ZERO_OFFSET_ACCEPT_BEATS quiet beats');
        assert.deepEqual(j.machine, { x: 100, y: 100, z: 300 });
    }],

    ['no offset ever reported: nothing is assumed, motion refused', () => {
        const state = createMachinePositionState();
        const j = judgeBeatStateful(
            state, { raw: { x: 10, y: 10, z: 300 }, offsetReported: { x: null, y: null, z: null }, reportedAt: T0 }, ctx(T0 + 100)
        );
        assert.equal(j.rejectedReason, 'no-offset-yet');
        assert.equal(j.reliability, 'awaiting-resync');
        assert.deepEqual(j.machine, { x: null, y: null, z: null });
    }],

    ['a missing offset after a complete one reuses it (cached-offset)', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        const j = judgeBeatStateful(
            state, { raw: { x: 119, y: 77, z: -88 }, offsetReported: { x: null, y: null, z: null }, reportedAt: T0 + 2000 }, ctx(T0 + 2100)
        );
        assert.equal(j.reliability, 'cached-offset');
        assert.deepEqual(j.machine, { x: 170, y: 199, z: 240 });
    }],

    ['the controller echo (position of record) outranks a rejected beat', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        const j = judgeBeatStateful(
            state, { raw: { x: 100, y: 200, z: 328 }, offsetReported: { ...OFFSET }, reportedAt: T0 + 2000 },
            ctx(T0 + 2100, { verified: { x: 170, y: 199, z: 320 } })
        );
        assert.equal(j.reliability, 'verified');
        assert.deepEqual(j.machine, { x: 170, y: 199, z: 320 });
        assert.equal(j.frame, 'machine-frame');
        assert.equal(j.accepted, false, 'the beat itself is still recorded as rejected');
    }],

    ['stale wins over everything, including a verified record', () => {
        const state = createMachinePositionState();
        const j = judgeBeatStateful(state, workBeat(T0), ctx(T0 + 20000, { verified: { x: 1, y: 2, z: 3 } }));
        assert.equal(j.reliability, 'stale');
        assert.ok(!reliableForMotion('stale'));
    }],

    ['re-reading the same beat re-judges staleness without advancing state', () => {
        const state = createMachinePositionState();
        const a = judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        assert.equal(a.reliability, 'heartbeat');
        const b = judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        assert.equal(b.reliability, 'heartbeat');
        assert.equal(state.lastBeatAt, T0);
        const c = judgeBeatStateful(state, workBeat(T0), ctx(T0 + 15000));
        assert.equal(c.reliability, 'stale');
        assert.deepEqual(state.previousRaw, workBeat(T0).raw, 'previousRaw only advances on a distinct beat');
    }],

    ['a disconnect forgets the previous connection\'s offset and position', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        assert.ok(state.cachedOffset);
        noteDisconnected(state, T0 + 5000);
        assert.equal(state.cachedOffset, null);
        assert.equal(state.lastAccepted, null);
        assert.equal(state.disconnects, 1);
        // a new connection with a NEW work origin (machine reboot) starts clean
        const j = judgeBeatStateful(
            state, { raw: { x: 0, y: 0, z: 0 }, offsetReported: { x: -100, y: -100, z: -300 }, reportedAt: T0 + 9000 }, ctx(T0 + 9100)
        );
        assert.equal(j.reliability, 'heartbeat');
        assert.deepEqual(j.machine, { x: 100, y: 100, z: 300 });
    }],

    // A4: a controller left in the machine workspace. Live 2026-09-19 a job
    // declared G53 and never selected a work workspace again, so every beat
    // was rejected for ever and only a re-home cleared it.
    ['a run of machine-frame beats is believed AS machine coordinates, but not before the third', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        const stuck = (at: number, machine = { x: 170, y: 207.571, z: 227.7 }): RawBeat => ({
            raw: { ...machine }, offsetReported: { ...OFFSET }, reportedAt: at,
        });
        for (let beat = 1; beat < SUSTAINED_MACHINE_FRAME_BEATS; beat++) {
            const j = judgeBeatStateful(state, stuck(T0 + (2000 * beat)), ctx(T0 + (2000 * beat) + 100));
            assert.equal(j.reliability, 'awaiting-resync', `beat ${beat} is still a transient`);
            assert.equal(j.machineFrameSuspect, true);
            assert.deepEqual(j.machine, { x: 170, y: 199, z: 240 }, 'the last accepted position is held');
        }
        const j = judgeBeatStateful(
            state,
            stuck(T0 + (2000 * SUSTAINED_MACHINE_FRAME_BEATS)),
            ctx(T0 + (2000 * SUSTAINED_MACHINE_FRAME_BEATS) + 100)
        );
        assert.equal(j.reliability, 'heartbeat');
        assert.equal(j.frame, 'machine-frame');
        assert.ok(reliableForMotion(j.reliability), 'the position is usable again - the FRAME is what is broken');
        assert.deepEqual(j.machine, { x: 170, y: 207.571, z: 227.7 }, 'the raw fields ARE the machine position');
        assert.deepEqual(j.nextAccepted && j.nextAccepted.machine, { x: 170, y: 207.571, z: 227.7 },
            'the held position follows the machine, not where it was before the frame broke');
    }],

    ['the sustained judgement names the remedy and rules out a re-home', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        let j = null as ReturnType<typeof judgeBeatStateful> | null;
        for (let beat = 1; beat <= SUSTAINED_MACHINE_FRAME_BEATS; beat++) {
            j = judgeBeatStateful(
                state,
                { raw: { x: 170, y: 207.571, z: 227.7 }, offsetReported: { ...OFFSET }, reportedAt: T0 + (2000 * beat) },
                ctx(T0 + (2000 * beat) + 100)
            );
        }
        const reasons = (j as NonNullable<typeof j>).reasons.join(' ');
        assert.ok(/MACHINE workspace/.test(reasons));
        assert.ok(/restore_work_frame/.test(reasons), 'names the remedy');
        assert.ok(/re-home is not the remedy/.test(reasons));
    }],

    ['a position that is impossible in BOTH frames is never believed, however long it persists', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        for (let beat = 1; beat <= SUSTAINED_MACHINE_FRAME_BEATS + 2; beat++) {
            // raw Z 900 is off the machine read either way - a bug, not a frame.
            const j = judgeBeatStateful(
                state,
                { raw: { x: 170, y: 207.571, z: 900 }, offsetReported: { ...OFFSET }, reportedAt: T0 + (2000 * beat) },
                ctx(T0 + (2000 * beat) + 100)
            );
            assert.equal(j.machineFrameSuspect, false, `beat ${beat}`);
            assert.equal(j.reliability, 'awaiting-resync', `beat ${beat}`);
        }
    }],

    ['one coherent beat in the middle resets the streak - only an unbroken run counts', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        const stuck = (at: number): RawBeat => ({ raw: { x: 170, y: 207.571, z: 227.7 }, offsetReported: { ...OFFSET }, reportedAt: at });
        judgeBeatStateful(state, stuck(T0 + 2000), ctx(T0 + 2100));
        judgeBeatStateful(state, stuck(T0 + 4000), ctx(T0 + 4100));
        const good = judgeBeatStateful(state, workBeat(T0 + 6000), ctx(T0 + 6100));
        assert.equal(good.reliability, 'heartbeat');
        assert.equal(good.frame, 'work-frame');
        assert.equal(state.machineFrameStreak, 0);
        const j = judgeBeatStateful(state, stuck(T0 + 8000), ctx(T0 + 8100));
        assert.equal(j.reliability, 'awaiting-resync', 'the count starts again from this beat');
    }],

    ['restoring the frame hands the record back to work-frame beats', () => {
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        for (let beat = 1; beat <= SUSTAINED_MACHINE_FRAME_BEATS; beat++) {
            judgeBeatStateful(
                state,
                { raw: { x: 170, y: 207.571, z: 227.7 }, offsetReported: { ...OFFSET }, reportedAt: T0 + (2000 * beat) },
                ctx(T0 + (2000 * beat) + 100)
            );
        }
        // restore_work_frame runs; the controller answers in the work workspace again.
        const at = T0 + (2000 * (SUSTAINED_MACHINE_FRAME_BEATS + 1));
        let j = judgeBeatStateful(state, workBeat(at, { x: 170, y: 207.571, z: 227.7 }), ctx(at + 100));
        if (!reliableForMotion(j.reliability)) {
            // At most one beat is spent on the flip signature (the return from the window).
            j = judgeBeatStateful(state, workBeat(at + 2000, { x: 170, y: 207.571, z: 227.7 }), ctx(at + 2100));
        }
        assert.equal(j.reliability, 'heartbeat');
        assert.equal(j.frame, 'work-frame');
        assert.deepEqual(j.machine, { x: 170, y: 207.571, z: 227.7 });
    }],
    ['a declared machine-frame run judges G53 beats as machine coordinates, never as work coordinates', () => {
        const run = { envelope: { min: { x: 150, y: 180, z: 230 }, max: { x: 200, y: 220, z: 250 } }, marginMm: 1 };
        // Large offset: the raw fields read as machine (175, 199, 240) inside the envelope.
        const state = createMachinePositionState();
        judgeBeatStateful(state, workBeat(T0), ctx(T0 + 100));
        const g53 = { raw: { x: 175, y: 199, z: 240 }, offsetReported: { ...OFFSET }, reportedAt: T0 + 2000 };
        const j = judgeBeatStateful(state, g53, ctx(T0 + 2100, { declaredRun: run, directGcodeQuiet: false }));
        assert.equal(j.declaredRun, true); assert.equal(j.accepted, true);
        assert.equal(j.frame, 'machine-frame'); assert.equal(j.reliability, 'heartbeat');
        assert.deepEqual(j.machine, { x: 175, y: 199, z: 240 });
        // After the run, the next work-frame beat is NOT mistaken for a frame flip.
        const back = judgeBeatStateful(state, workBeat(T0 + 4000, { x: 175, y: 199, z: 240 }), ctx(T0 + 4100));
        assert.equal(back.accepted, true); assert.equal(back.rejectedReason, null);
        assert.deepEqual(back.machine, { x: 175, y: 199, z: 240 });
        // Small offset: undeclared, the same G53 beat would be ACCEPTED as work-frame, off by the offset.
        const small = { x: -5, y: -3, z: 0 };
        const plain = createMachinePositionState();
        judgeBeatStateful(plain, { raw: { x: 165, y: 196, z: 240 }, offsetReported: small, reportedAt: T0 }, ctx(T0 + 100));
        const wrong = judgeBeatStateful(plain, { raw: { x: 180, y: 205, z: 240 }, offsetReported: small, reportedAt: T0 + 2000 }, ctx(T0 + 2100));
        assert.equal(wrong.accepted, true);
        assert.deepEqual(wrong.machine, { x: 185, y: 208, z: 240 }, 'the defect the declaration removes');
        const declared = createMachinePositionState();
        judgeBeatStateful(declared, { raw: { x: 165, y: 196, z: 240 }, offsetReported: small, reportedAt: T0 }, ctx(T0 + 100));
        const held = judgeBeatStateful(declared, { raw: { x: 180, y: 205, z: 240 }, offsetReported: small, reportedAt: T0 + 2000 },
            ctx(T0 + 2100, { declaredRun: run }));
        // Both readings fall inside the envelope: it may predate the G53, so it is set aside, never misread.
        assert.equal(held.accepted, false); assert.equal(held.rejectedReason, 'declared-run-ambiguous');
        assert.equal(held.reliability, 'awaiting-resync');
        assert.deepEqual(held.machine, { x: 170, y: 199, z: 240 });
        // Outside the envelope as machine coordinates: set aside too.
        const far = judgeBeatStateful(state, { raw: { x: 10, y: 10, z: 10 }, offsetReported: { ...OFFSET }, reportedAt: T0 + 6000 },
            ctx(T0 + 6100, { declaredRun: run }));
        assert.equal(far.accepted, false); assert.equal(far.reliability, 'awaiting-resync');
    }],
    ['the frame latch clears only after a restore AND a verified fresh position', () => {
        clearFrameLatch();
        latchFrameUncertain('test run', T0);
        const latch = getFrameLatch();
        assert.ok(latch);
        if (!latch) { return; }
        const beat = { accepted: true, frame: 'work-frame', offsetSource: 'heartbeat', reportedAt: T0 + 5000, declaredRun: false };
        const echo = { machine: { x: 1, y: 2, z: 3 }, source: 'echo' as const, at: T0 + 3000, sequence: 1, tool: 't', previousMachine: null };
        assert.equal(frameLatchVerified(latch, echo, beat), false, 'no restore yet');
        noteFrameRestored(T0 + 2000);
        const restored = getFrameLatch();
        if (!restored) { throw new Error('latch lost'); }
        // The record must have been READ in the work frame: the pendant's settle writes a
        // machine-frame echo (taken inside the G53 window) after the G54 reply, and that
        // proves the arrival, not the workspace (2026-10-05 review).
        assert.equal(frameLatchVerified(restored, echo, { ...beat, accepted: false }), false, 'an echo with no frame never clears it');
        assert.equal(frameLatchVerified(restored, { ...echo, frame: 'machine-frame' }, { ...beat, accepted: false }), false,
            'a machine-frame echo after the restore does not clear it');
        assert.equal(frameLatchVerified(restored, { ...echo, frame: 'work-frame' }, { ...beat, accepted: false }), true, 'a work-frame echo after the restore');
        assert.equal(frameLatchVerified(restored, { ...echo, frame: 'work-frame', source: 'heartbeat' }, { ...beat, accepted: false }), true,
            'a settled work-frame heartbeat record');
        assert.equal(frameLatchVerified(restored, { ...echo, frame: 'machine-frame' }, beat), true,
            'a later work-frame heartbeat clears it even while the machine-frame echo record stands');
        assert.equal(frameLatchVerified(restored, { ...echo, frame: 'work-frame', at: T0 + 1000 }, { ...beat, accepted: false }), false, 'an echo from before it');
        assert.equal(frameLatchVerified(restored, { ...echo, frame: 'work-frame', source: 'estimated' }, { ...beat, accepted: false }), false, 'an estimate');
        assert.equal(frameLatchVerified(restored, null, beat), true, 'a work-frame beat well after the restore');
        assert.equal(frameLatchVerified(restored, null, { ...beat, reportedAt: T0 + 2500 }), false, 'a beat that may predate it');
        assert.equal(frameLatchVerified(restored, null, { ...beat, declaredRun: true }), false);
        assert.equal(frameLatchVerified(restored, null, { ...beat, offsetSource: 'cached' }), false);
        clearFrameLatch();
        assert.equal(getFrameLatch(), null);
    }],
];
