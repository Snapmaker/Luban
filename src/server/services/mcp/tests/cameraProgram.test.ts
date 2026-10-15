/* eslint-disable camelcase */
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';

import { isolatedModule } from './jobDashboard.test';
import { ToolRegistry } from '../registry';
import { cameraMinimumZ } from '../cameraSafety';

function fixture() {
    const machine = { x: 100, y: 100, z: 328 };
    const moves: object[] = [];
    const submitted: Array<{ runner?: () => Promise<object>; id: string }> = [];
    const dependencies: Record<string, unknown> = {};
    const source = fs.readFileSync(path.join(__dirname, '../cameraProgram.ts'), 'utf8');
    for (const match of source.matchAll(/from '([^']+)'/g)) dependencies[match[1]] = {};
    Object.assign(dependencies, {
        'fs-extra': { writeFileSync: () => undefined },
        './cameraProgramSchema': require('../cameraProgramSchema'),
        './cameraSafety': require('../cameraSafety'),
        './registry': require('../registry'),
        './envelopeChecks': require('../envelopeChecks'),
        './surveyPlan': require('../surveyPlan'),
        './surveyMosaic': require('../surveyMosaic'),
        './procedureLimits': require('../procedureLimits'),
        './landmarks': { landmarkStore: { obstacleBoxes: () => [] } },
        './clearanceContext': { clearanceOptions: () => ({ toolProtrusionMm: 75 }) },
        './probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined } },
        './index': { mcpBroadcast: () => undefined },
        './cameraModelStore': { cameraModelStore: { current: () => ({ id: 'model' }) } },
        './cameraModel': { judgeCameraModel: () => ({ usable: true }) },
        './tools/cameraModel': { modelContext: () => ({}) },
        './cameraGeometry': { fovAt: (_model: object, pose: { z: number }) => ({ widthMm: pose.z / 4, heightMm: pose.z / 4 }) },
        './routeClearance': { routeClearanceForPath: (_from: object, _to: object, _margin: unknown, cleared: boolean) => ({
            minimumZ: cameraMinimumZ(320, [], cleared), note: 'test floor',
        }) },
        '../machine/ConnectionManager': { connectionManager: { getConnectionStatus: () => ({ machineIdentifier: 'test' }) } },
        './tools/machine': {
            getPositionSnapshot: () => ({ machine: { ...machine }, reliability: 'verified' }),
            requireReliableMachine: () => undefined,
            requirePlanningTravel: () => ({ limits: { xMin: 0, xMax: 320, yMin: 0, yMax: 350 } }),
            safeTraverseZ: () => 328,
            motionFloorZ: () => 320,
            getMachineSizeByIdentifier: () => ({ z: 328 }),
        },
        './probing': {
            assertMachineReadyForProcedure: () => undefined,
            checkProcedureStop: () => undefined,
            moveMachineSettled: async (_tag: string, target: object) => { moves.push(target); Object.assign(machine, target); },
            abortRaiseToTop: async () => ({ action: 'skipped' }),
        },
        './camera': { captureFrame: async () => ({ frameId: 'frame', imageBase64: '', capturedAt: 1 }) },
        './programFrames': { programFramePath: (_at: number, _name: string, id: string) => `/fake/${id}.jpg` },
        './tools/staging': { validateStagedEnvelope: () => ({}) },
        './jobs': { jobManager: {
            submit: () => { const job = { id: 'camera-test' }; submitted.push(job); return job; },
            describe: (job: object) => job,
        } },
    });
    const loaded = isolatedModule('cameraProgram.ts', dependencies);
    return { planCameraProgram: loaded.planCameraProgram,
        runCameraProgramProcedure: loaded.runCameraProgramProcedure,
        registerCameraProgramTool: loaded.registerCameraProgramTool,
        machine,
        moves,
        submitted };
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['bootstrap establishes the approved park height before any XY or position-stamped capture', async () => {
        const machine = { x: 100, y: 100, z: 320 };
        const moves: Array<{ x?: number; y?: number; z?: number }> = [];
        const dependencies: Record<string, unknown> = {};
        const source = fs.readFileSync(path.join(__dirname, '../cameraBootstrap.ts'), 'utf8');
        for (const match of source.matchAll(/from '([^']+)'/g)) dependencies[match[1]] = {};
        Object.assign(dependencies, {
            crypto: require('crypto'),
            path,
            'fs-extra': { ensureDirSync: () => undefined, writeFileSync: () => undefined, writeJsonSync: () => undefined },
            '../../DataStorage': { userDataDir: '/fake' },
            './rotaryGeometry': { rotaryAxisPoints: () => [] },
            './toolSetter': { getToolSetterConfig: () => null },
            './envelopeChecks': require('../envelopeChecks'),
            './landmarks': { landmarkStore: { obstacleBoxes: () => [] } },
            './clearanceContext': { clearanceOptions: () => ({ toolProtrusionMm: 75 }) },
            './probing': {
                assertMachineReadyForProcedure: () => undefined,
                moveMachineSettled: async (_tag: string, target: object) => { moves.push(target); Object.assign(machine, target); },
            },
            './tools/machine': { getPositionSnapshot: () => ({ machine }), requireReliableMachine: () => undefined },
            './camera': { captureFrame: async () => {
                assert.equal(machine.z, 328);
                return { device: 'test', imageBase64: '', capturedAt: 1 };
            } },
        });
        const bootstrap = isolatedModule('cameraBootstrap.ts', dependencies);
        await bootstrap.runSearchStage({ parkZ: 328, waypoints: [{ x: 120, y: 110 }] }, () => undefined);
        assert.equal(moves[0].z, 328);
        assert.equal(moves[1].x, 120);
        moves.length = 0;
        machine.z = 320;
        await bootstrap.runPoseStage({ parkZ: 328,
            floorZ: 320,
            plan: { poses: [{ x: 120, y: 110, label: 'view', stops: [{ z: 328 }] }], dropped: [] } }, () => undefined);
        assert.equal(moves[0].z, 328);
        assert.equal(moves[1].x, 120);
    }],
    ['one inert staging call covers an entire safe camera sequence including a long reviewed leg', async () => {
        const f = fixture();
        const registry = new ToolRegistry();
        f.registerCameraProgramTool(registry, () => 'http://localhost');
        const result = await registry.call('camera_program', { name: 'look',
            reason: 'test',
            ops: [
                { id: 'park', kind: 'move_z', machine_z: 328 },
                { id: 'view', kind: 'move_and_capture', x: 260, y: 100, machine_z: 328 },
                { id: 'photo', kind: 'capture' },
            ] }) as { confirm_url: string; handoff: object };
        assert.equal(f.submitted.length, 1);
        assert.equal(f.moves.length, 0, 'staging never executes motion');
        assert.equal(result.confirm_url, 'http://localhost/confirm/camera-test');
        assert.ok(result.handoff);
        await f.submitted[0].runner?.(); // Inert stub runner, never connected to hardware.
        assert.equal(f.machine.x, 260);
        assert.equal(f.moves.length, 2);
    }],
    ['composite overlap actually reduces spacing at the lowest requested height', () => {
        const f = fixture();
        const plan = f.planCameraProgram({ name: 'overlap',
            reason: 'test',
            ops: [
                { id: 's', kind: 'survey_bed', z_levels: [328, 320], pitch_mm: 80, plane_z: 100, overlap_fraction: 0.5 },
            ] });
        assert.equal(plan.surveys.s.pitch, 40);
        assert.ok(plan.surveys.s.plan.captureCount > 50);
    }],
    ['known protrusion does not grant sub-floor surveys; only the named cleared op can use them', () => {
        const f = fixture();
        const survey = { id: 's', kind: 'survey_bed', machine_z: 300 };
        assert.throws(() => f.planCameraProgram({ name: 'low', reason: 'test', ops: [survey] }), /motion floor/);
        assert.throws(() => f.planCameraProgram({ name: 'low', reason: 'test', operator_confirmed_clearance: true, ops: [survey] }), /Program-wide/);
        f.planCameraProgram({ name: 'low', reason: 'test', ops: [{ ...survey, operator_confirmed_clearance: true }] });
    }],
    ['a changed starting anchor refuses before any program motion', async () => {
        const f = fixture();
        const plan = f.planCameraProgram({ name: 'anchor', reason: 'test', ops: [{ id: 'z', kind: 'move_z', machine_z: 328 }] });
        f.machine.x += 10;
        await assert.rejects(() => f.runCameraProgramProcedure(plan), /anchor changed/);
        assert.equal(f.moves.length, 0);
    }],
];
