/* eslint-disable import/no-dynamic-require */
import { strict as assert } from 'assert';
import Module from 'module';

import { planProbeCapture } from '../probeCapture';
import { finishProgramAbort, probeAbortHeld } from '../programAbort';
import { ProcedureAbort } from '../procedureAbort';
import { summarizeJobTiming } from '../jobTiming';
import { TipCalibrationSnapshot, calibrationFromMeasurement, legacySetterDatum, unavailableTipCalibration } from '../toolDatum';

// Exercise the real runners with motion/camera IO replaced; never load the server.
function mocked(file: string, mocks: { [key: string]: unknown }): any {
    const target = require.resolve(file);
    const loader = Module as unknown as { _load: (id: string, parent: { filename: string }, main: boolean) => unknown };
    const old = loader._load;
    delete require.cache[target];
    loader._load = (id, parent, main) => (parent?.filename === target && Object.prototype.hasOwnProperty.call(mocks, id)
        ? mocks[id] : old(id, parent, main));
    try { return require(target); } finally { loader._load = old; delete require.cache[target]; }
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['probe capture rejects movement, invalid selections and excessive waits before motion', () => {
        assert.equal(planProbeCapture(undefined), null);
        assert.deepEqual(planProbeCapture({ label: 'rim' }), { settleMs: 500, label: 'rim' });
        for (const raw of [{ x: 5 }, { settle_ms: Infinity }, { settle_ms: -1 }, { settle_ms: 5001 }, false]) {
            assert.throws(() => planProbeCapture(raw));
        }
        for (const stations of [[], [0], [4], [1, 1], [1.5], ['1']]) {
            assert.throws(() => planProbeCapture({ stations }, 3));
        }
        assert.deepEqual(planProbeCapture({ stations: [1, 3], settle_ms: 0 }, 3)?.stations, [1, 3]);
    }],
    ['nested held abort stays held after sensor releases; outer recovery never raises', async () => {
        const held = probeAbortHeld({ phases: [{ phase: 'abort-held', note: 'probe triggered' }] });
        assert.ok(held);
        let moves = 0;
        const tail = await finishProgramAbort(held, false, async () => { moves++; return { action: 'raised', note: '' }; });
        assert.equal(moves, 0);
        assert.match(tail, /held/);
    }],
    ['outer abort reports failed, unknown or held recovery truthfully', async () => {
        assert.match(await finishProgramAbort(false, false, async () => { throw new Error('position unknown'); }), /not verified/);
        assert.match(await finishProgramAbort(false, false, async () => ({ action: 'held', note: 'probe triggered' })), /probe triggered/);
        let moves = 0;
        await finishProgramAbort(false, true, async () => { moves++; return { action: 'raised', note: '' }; });
        assert.equal(moves, 0);
    }],
    ['capture runtime waits for a fresh frame, saves actual pose and propagates stops', async () => {
        let frames = 0;
        let saved = 0;
        let stopped = false;
        const runtime = mocked('../probeCaptureRuntime', {
            './camera': { captureFrame: async () => ({ capturedAt: ++frames === 1 ? 0 : Date.now() + 1, imageBase64: 'eA==', frameId: 'f', source: 'stream' }) },
            fs: { writeFileSync: () => { saved++; } },
            './programFrames': { programFramePath: () => '/fake/spot.jpg' },
            './probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined } },
            './probing': { awaitMachineSettled: async () => undefined, sleep: async () => undefined, checkProcedureStop: () => { if (stopped) { throw new ProcedureAbort('stop'); } }, isProcedureAbort: (e: unknown) => e instanceof ProcedureAbort },
            './tools/machine': { getPositionSnapshot: () => ({ machine: { x: 1, y: 2, z: 3 }, b: 90, reliability: 'verified' }) },
        });
        const frame = await runtime.captureProbeSpot({ settleMs: 0, label: 'rim' }, 'scan', 's1');
        assert.equal(frames, 2);
        assert.equal(saved, 1);
        assert.deepEqual(frame.machine, { x: 1, y: 2, z: 3 });
        assert.equal(frame.b, 90);
        stopped = true;
        await assert.rejects(() => runtime.captureProbeSpot({ settleMs: 0 }, 'scan', 's2'), /stop/);
        assert.equal(saved, 1);
    }],
    ['capture runtime records camera failure for normal retraction', async () => {
        const runtime = mocked('../probeCaptureRuntime', {
            './camera': { captureFrame: async () => { throw new Error('camera unplugged'); } },
            './programFrames': {},
            './probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined } },
            './probing': { awaitMachineSettled: async () => undefined, sleep: async () => undefined, checkProcedureStop: () => undefined, isProcedureAbort: () => false },
            './tools/machine': {},
        });
        const outcome = await runtime.captureProbeSpot({ settleMs: 0 }, 'scan', 's1');
        assert.equal(outcome.status, 'failed');
        assert.match(outcome.error, /unplugged/);
    }],
];

for (const kind of ['sequence', 'surface']) {
    for (const cameraFailed of [false, true]) {
        tests.push([`${kind} runner captures contact before retract and still finishes after camera ${cameraFailed ? 'failure' : 'success'}`, async () => {
            let position = { x: 0, y: 0, z: 203 };
            const events: string[] = [];
            let expected = false;
            const contact = () => ({ contact: position.z <= 200 });
            const move = async (tag: string, words: object) => { events.push(tag); position = { ...position, ...words }; };
            const mocks = {
                './toolDatumState': { getProbeTipCalibration: () => unavailableTipCalibration('test fixture') },
                './index': { mcpBroadcast: () => undefined },
                './clearanceContext': {},
                './landmarks': {},
                './registry': { McpToolError: Error },
                './probeFeed': { probeFeedService: { setExpectedContact: () => { expected = true; }, clearExpectedContact: () => { expected = false; }, getTrip: () => null } },
                './probing': {
                    ProcedureAbort,
                    assertChannelReady: () => undefined,
                    assertMachineReadyForProcedure: () => undefined,
                    expectMachinePosition: async () => ({ note: null }),
                    knownMachinePosition: () => ({ position, source: 'test' }),
                    moveMachineSettled: move,
                    descendInSegments: async (tag: string, from: number, z: number) => move(tag, { z }),
                    marchInSegments: async (fn: (s: number) => Promise<void>, from: number, to: number) => {
                        await fn(to);
                        return { s: to, sensed: contact() };
                    },
                    senseAfter: async () => contact(),
                    senseReleaseAfter: async () => contact(),
                    isProcedureAbort: (e: unknown) => e instanceof ProcedureAbort,
                    isProcedureStopped: () => false,
                    abortRaiseToTop: async () => { throw new Error('unexpected abort'); },
                    MAX_RETREAT_MM: 5,
                    COARSE_FEED: 100,
                    FINE_FEED: 60,
                    TRAVEL_FEED: 600,
                    RECHECK_TOLERANCE_MM: 0.5,
                    DESCENT_SEGMENT_MM: 5,
                },
                './tools/machine': { getPositionSnapshot: () => ({ machine: position }) },
                './probeCaptureRuntime': { captureProbeSpot: async () => {
                    events.push('PHOTO');
                    assert.equal(position.z, 200, 'still at final contact, not raised');
                    assert.equal(expected, true, 'contact remains expected during stationary capture');
                    return { status: cameraFailed ? 'failed' : 'captured' };
                } },
                './march': {},
                './rotaryGeometry': { probeGeometry: () => null },
                ...(kind === 'surface' ? { './probeSequence': { DESCENT_GUARD_MM: 20 } } : {}),
            };
            const runner = mocked(kind === 'sequence' ? '../probeSequence' : '../probeSurface', mocks);
            const common = { staged: { ...position }, hopZ: 328, coarseStepMm: 1, fineStepMm: 0.1, backoffMm: 1, sensorDelayMs: 50, confirmPasses: 1 };
            let result: any;
            if (kind === 'sequence') {
                result = await runner.runProbeSequenceProcedure({ ...common, steps: [{ kind: 'probe', name: 'rim', start: { ...position }, unit: { x: 0, y: 0, z: -1 }, maxTravelMm: 5, onMiss: 'abort', capture: { settleMs: 0, label: null } }] });
                assert.equal(result.results[0].capture.status, cameraFailed ? 'failed' : 'captured');
            } else {
                result = await runner.runProbeSurfaceProcedure({ ...common, kind: 'path', path: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, unit: { x: 1, y: 0 }, lengthMm: 0, spacingMm: 0 }, tool: 'probe_surface_path', stations: [{ index: 1, label: 's1', x: 0, y: 0, s: 0, hopFromPreviousMm: 0 }], startZMachine: 203, absoluteFloorZ: 198, zSafeDeltaMm: 2, maxDropMm: 5, maxHopMm: 60, worstHopMm: 0, slowZoneMm: 1, expectedZMachine: 200, floorExplicit: true, profile: null, hopMode: 'stepped', hopLiftMm: 2, capture: { stations: [1], settleMs: 0 }, hopBackoffMm: 1.25 });
                assert.equal(result.stations[0].capture.status, cameraFailed ? 'failed' : 'captured');
            }
            assert.equal(position.z, 328);
            assert.equal(events.filter((e) => e === 'PHOTO').length, 1);
            assert.ok(events.slice(events.indexOf('PHOTO') + 1).some((e) => /retreat|retract/.test(e)));
        }]);
    }
}

tests.push(['machine adapter remembers a brief lift touch that released before the command reply', async () => {
    let position = { x: 0, y: 0, z: 10 };
    let triggers = 0;
    const moves: string[] = [];
    const march = mocked('../march', {
        './index': { mcpBroadcast: () => undefined },
        './probeFeed': { probeFeedService: { contactCount: () => triggers, setExpectedContact: () => undefined, clearExpectedContact: () => undefined } },
        './probing': {
            moveMachineSettled: async (tag: string, words: object) => {
                position = { ...position, ...words };
                moves.push(tag);
                if (tag.includes('hop-lift')) { triggers++; }
            },
            senseAfter: async () => ({ contact: position.x >= 0.5 && position.z < 12 }),
            senseReleaseAfter: async () => ({ contact: false }),
            TRAVEL_FEED: 600,
        },
    });
    await assert.rejects(() => march.steppedTraverseZ('scan', 's2', { x: 0, y: 0 }, { x: 0.5, y: 0 }, 10,
        { liftMm: 2, maxZ: 328, sensorDelayMs: 50 }, () => undefined), /contact during lift/);
    assert.ok(moves[moves.length - 1].includes('hop-lift'));
}]);

/** Entire surface runner with deterministic sensor/position IO, never server/device IO. */
export function surfaceFixture(options: {
    heights?: Array<number | null>; mode?: 'fixed' | 'adaptive'; stuckRetouch?: boolean;
    changedRetouch?: boolean; lostRetouch?: boolean; linkBump?: boolean; expected?: number | null;
    calibration?: () => TipCalibrationSnapshot; onMove?: () => void;
} = {}): { runner: any; plan: any; moves: Array<{ tag: string; z?: number; x?: number }>; run: () => Promise<any> } {
    const heights = options.heights || [200, 200, 200];
    let position = { x: 0, y: 0, z: 203 };
    let tagNow = '';
    const moves: Array<{ tag: string; z?: number; x?: number }> = [];
    const contact = () => {
        if (options.lostRetouch && tagNow.includes(':confirm')) { return { contact: false }; }
        const height = heights[Math.round(position.x)];
        const shifted = options.changedRetouch && tagNow.includes(':confirm') ? 0.3 : 0;
        return { contact: height !== null && position.z <= (height as number) + shifted + 1e-8 };
    };
    const move = async (tag: string, words: object) => {
        tagNow = tag; moves.push({ tag, ...words }); position = { ...position, ...words };
        options.onMove?.();
    };
    const runner = mocked('../probeSurface', {
        './toolDatumState': { getProbeTipCalibration: options.calibration || (() => unavailableTipCalibration('test fixture')) },
        './index': { mcpBroadcast: () => undefined },
        './clearanceContext': {},
        './landmarks': {},
        './registry': { McpToolError: Error },
        './rotaryGeometry': { probeGeometry: () => null },
        './probeFeed': { probeFeedService: { setExpectedContact: () => undefined, clearExpectedContact: () => undefined, getTrip: () => null } },
        './tools/machine': { getPositionSnapshot: () => ({ machine: position }) },
        './probeSequence': { DESCENT_GUARD_MM: 20 },
        './probeCaptureRuntime': {},
        './march': { steppedTraverseZ: async (_tool: string, name: string, _from: object, to: { x: number; y: number }, z: number) => {
            await move(`link:${name}`, { ...to, z });
            return { z, clearTailMm: 0, lifts: options.linkBump && to.x === 1 ? [{ x: to.x, y: to.y, z, liftMm: 0.5 }] : [] };
        } },
        './probing': {
            ProcedureAbort,
            assertChannelReady: () => undefined,
            assertMachineReadyForProcedure: () => undefined,
            expectMachinePosition: async () => ({ note: null }),
            knownMachinePosition: () => ({ position, source: 'test' }),
            moveMachineSettled: move,
            descendInSegments: async (tag: string, _from: number, z: number) => move(tag, { z }),
            marchInSegments: async (fn: (s: number) => Promise<void>, _from: number, to: number) => { await fn(to); return { s: to, sensed: contact() }; },
            senseAfter: async () => contact(),
            senseReleaseAfter: async () => {
                moves.push({ tag: 'release-check', z: position.z });
                return options.stuckRetouch && tagNow.includes(':backoff') ? { contact: true } : contact();
            },
            isProcedureAbort: (err: unknown) => err instanceof ProcedureAbort,
            isProcedureStopped: () => false,
            abortRaiseToTop: async () => { moves.push({ tag: 'abort-recovery' }); },
            MAX_RETREAT_MM: 5,
            COARSE_FEED: 100,
            FINE_FEED: 60,
            TRAVEL_FEED: 600,
            RECHECK_TOLERANCE_MM: 0.5,
            DESCENT_SEGMENT_MM: 5,
        },
    });
    const plan = {
        kind: 'path',
        tool: 'probe_surface_path',
        staged: { ...position },
        hopZ: 328,
        coarseStepMm: 1,
        fineStepMm: 0.1,
        backoffMm: 0.2,
        sensorDelayMs: 50,
        confirmPasses: 3,
        confirmationMode: options.mode || 'adaptive',
        confirmationToleranceMm: 0.1,
        stations: heights.map((_, i) => ({ index: i + 1, label: `s${i + 1}`, x: i, y: 0, s: i, hopFromPreviousMm: i ? 1 : 0 })),
        path: { start: { x: 0, y: 0 }, end: { x: heights.length - 1, y: 0 }, unit: { x: 1, y: 0 }, lengthMm: heights.length - 1, spacingMm: 1 },
        startZMachine: 203,
        absoluteFloorZ: 194,
        zSafeDeltaMm: 20,
        maxDropMm: 6,
        maxHopMm: 60,
        worstHopMm: 1,
        slowZoneMm: 1,
        expectedZMachine: options.expected === undefined ? 200 : options.expected,
        floorExplicit: true,
        profile: null,
        hopMode: 'stepped',
        hopLiftMm: 0.5,
        hopBackoffMm: 0,
        capture: null,
    };
    return { runner, plan, moves, run: () => runner.runProbeSurfaceProcedure(plan) };
}

tests.push(
    ['adaptive surface policy requires an explicit bounded threshold; fixed remains default', () => {
        const { runner } = surfaceFixture();
        assert.deepEqual(runner.resolveSurfaceConfirmation({}), { confirmationMode: 'fixed', confirmationToleranceMm: null });
        for (const threshold of [undefined, 0, -0.1, Infinity, NaN, 1.1, '0.1']) {
            assert.throws(() => runner.resolveSurfaceConfirmation({ confirmation_mode: 'adaptive', confirmation_tolerance_mm: threshold }));
        }
        assert.throws(() => runner.resolveSurfaceConfirmation({ confirmation_mode: 'unknown' }));
        assert.throws(() => runner.resolveSurfaceConfirmation({ confirmation_tolerance_mm: 0.1 }));
        assert.deepEqual(runner.resolveSurfaceConfirmation({ confirmation_mode: 'adaptive', confirmation_tolerance_mm: 0.1 }),
            { confirmationMode: 'adaptive', confirmationToleranceMm: 0.1 });
    }],
    ['adaptive surface uses one initial retouch then single fine contacts and 0.5 mm release-verified hops', async () => {
        const f = surfaceFixture(); const result = await f.run();
        assert.deepEqual(result.stations.map((s: any) => s.extraPassCount), [1, 0, 0]);
        assert.deepEqual(result.stations.map((s: any) => s.spreadMm), [0, null, null]);
        assert.deepEqual(result.stations[0].confirmationReasons, ['first-station']);
        assert.equal(result.stations[1].initialContactZ, 200);
        assert.equal(result.stations[1].finalContactZ, 200);
        assert.deepEqual(f.moves.filter((m) => m.tag.includes(':retract')).map((m) => m.z), [200.5, 200.5, 200.5]);
        assert.equal(f.moves.filter((m) => m.tag.includes(':backoff')).length, 1);
        assert.equal(f.moves.find((m) => m.tag.includes(':backoff'))?.z, 200.2);
        assert.equal(f.moves[f.moves.findIndex((m) => m.tag.includes(':backoff')) + 1].tag, 'release-check');
        assert.equal(result.envelope.hopLiftMm, 0.5);
        assert.equal(result.envelope.hopMode, 'stepped');
    }],
    ['fixed surface still executes the configured extra passes at every station', async () => {
        const f = surfaceFixture({ mode: 'fixed' }); f.plan.confirmPasses = 1;
        const result = await f.run();
        assert.deepEqual(result.stations.map((s: any) => s.extraPassCount), [1, 1, 1]);
        assert.equal(f.moves.filter((m) => m.tag.includes(':backoff')).length, 3);
    }],
    ['adaptive surface confirms changed heights, coarse contacts and bumped links', async () => {
        for (const [options, reason] of [
            [{ heights: [200, 199.7, 199.7] }, 'height-change'],
            [{ heights: [200, 196.5, 196.5] }, 'coarse-contact'],
            [{ linkBump: true }, 'link-contact'],
        ] as Array<[Parameters<typeof surfaceFixture>[0], string]>) {
            const f = surfaceFixture(options); const result = await f.run();
            assert.equal(result.stations[1].extraPassCount, 1);
            assert.ok(result.stations[1].confirmationReasons.includes(reason));
            assert.equal(result.stations[2].extraPassCount, 0);
        }
    }],
    ['adaptive surface confirms after a miss; a first-station miss still aborts', async () => {
        const f = surfaceFixture({ heights: [200, null, 200] }); const result = await f.run();
        assert.equal(result.stations[1].status, 'no_contact');
        assert.equal(result.stations[2].extraPassCount, 1);
        assert.ok(result.stations[2].confirmationReasons.includes('after-miss'));
        await assert.rejects(surfaceFixture({ heights: [null, 200] }).run(), /first.*found no surface/);
    }],
    ['adaptive surface will not retouch until a 0.2 mm backoff releases', async () => {
        const f = surfaceFixture({ stuckRetouch: true });
        await assert.rejects(f.run(), /hysteresis exceeds the backoff 0.2/);
        assert.equal(f.moves.filter((m) => m.tag.includes(':confirm')).length, 0);
        assert.equal(f.moves.filter((m) => m.tag.startsWith('link:')).length, 0);
    }],
    ['adaptive surface disagreement is retained as uncertain, excluded from geometry and stops before next station', async () => {
        const f = surfaceFixture({ changedRetouch: true });
        f.plan.confirmationToleranceMm = 0.05;
        await assert.rejects(f.run(), (err: any) => {
            assert.match(err.message, /uncertain and excluded/);
            assert.equal(err.partial.contactCount, 0);
            assert.deepEqual(err.partial.uncertainStations, ['s1']);
            assert.equal(err.partial.stations[0].z, null);
            assert.equal(err.partial.stations[0].initialContactZ, 200);
            assert.equal(err.partial.stations[0].finalContactZ, 200.1);
            assert.equal(err.partial.stations[0].extraPassCount, 1);
            return true;
        });
        assert.equal(f.moves.filter((m) => m.tag.startsWith('link:')).length, 0);
    }],
    ['stepped preview describes actual local lifts and adaptive retouch instead of guarded hops', () => {
        const f = surfaceFixture(); const preview = f.runner.describeProbeSurfacePlanAsGcode(f.plan);
        assert.match(preview, /LAST CONTACT \+ 0.5 mm/);
        assert.match(preview, /confirmation backoff 0.2 mm, release required/);
        assert.match(preview, /routine fine contact is single-touch/);
        assert.doesNotMatch(preview, /probe must NOT be in contact|LAST CONTACT \+ 20|roughly .* min/);
    }],
);


tests.push(['surface uncertain event retains station timing without counting it as an accepted contact', () => {
    const timing = summarizeJobTiming([
        { seq: 1, at: 1000, phase: 'started' },
        { seq: 2, at: 1100, phase: 'fine-contact-s1' },
        { seq: 3, at: 1200, phase: 'uncertain-s1' },
        { seq: 4, at: 1300, phase: 'failed' },
    ]);
    assert.equal(timing.stations[0].outcome, 'uncertain');
    assert.equal(timing.stations[0].label, 's1');
    assert.equal(timing.medianStationMs, null);
}]);


tests.push(['surface projections retain the initial fitting snapshot through state changes and partial aborts', async () => {
    for (const changedRetouch of [false, true]) {
        let reads = 0;
        let current = calibrationFromMeasurement({ id: 'original',
            measuredTriggerZ: 172,
            bitLengthMm: 75,
            spreadMm: 0.1,
            fineStepMm: 0.1,
            at: 100,
            datum: legacySetterDatum(175.5, 75) });
        const f = surfaceFixture({ changedRetouch,
            calibration: () => { reads++; return current; },
            onMove: () => { current = unavailableTipCalibration('fitting changed after start'); } });
        f.plan.confirmationToleranceMm = 0.05;
        let result: any;
        try { result = await f.run(); } catch (err) {
            assert.ok(changedRetouch && err instanceof ProcedureAbort);
            result = (err as ProcedureAbort).partial;
        }
        assert.equal(reads, 1);
        assert.equal(result.tipCalibration.measurementId, 'original');
        for (const station of result.stations) {
            assert.equal(station.tipCalibration.measurementId, 'original');
            assert.equal(station.tipMachineZ, station.z === null ? null : Number((station.z - 71.5).toFixed(6)));
        }
        if (changedRetouch) {
            assert.equal(result.aborted, true);
            assert.equal(result.stations[0].tipMachineZ, null, 'uncertain observations do not become accepted tip contacts');
        }
    }
}]);
