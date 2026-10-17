/* eslint-disable camelcase */
import { strict as assert } from 'assert';

import { validateCameraOps } from '../cameraProgramSchema';
import { ToolRegistry } from '../registry';
import { belowCameraFloor, cameraMinimumZ } from '../cameraSafety';

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['known tools cannot remove the floor and operator exceptions cannot remove obstacles', () => {
        assert.equal(cameraMinimumZ(320, []), 320);
        assert.equal(cameraMinimumZ(320, [250]), 320);
        assert.equal(cameraMinimumZ(320, [328]), 328);
        assert.equal(cameraMinimumZ(320, [328], true), 328);
        assert.equal(cameraMinimumZ(320, [null], true), Infinity);
        assert.equal(cameraMinimumZ(320, [], true), 0);
        assert.deepEqual(belowCameraFloor([328, 319.96, 310], 320, 0.05), [310]);
        assert.deepEqual(belowCameraFloor([310], 320, 0.05, true), []);
    }],
    ['a complete camera sequence can be approved together', () => {
        validateCameraOps([
            { id: 'park', kind: 'move_z', machine_z: 328 },
            { id: 'before', kind: 'capture' },
            { id: 'x', kind: 'move_and_capture', x: 105, y: 100, machine_z: 328 },
            { id: 'tx', kind: 'track_feature', template_capture_id: 'before', search_capture_id: 'x', point: { u: 300, v: 200 } },
            { id: 'y', kind: 'move_and_capture', x: 100, y: 105, machine_z: 328 },
            { id: 'ty', kind: 'track_feature', template_capture_id: 'before', search_capture_id: 'y', point: { u: 300, v: 200 } },
            { id: 'fit', kind: 'fit_calibration', samples: [{ track_id: 'tx', dx_mm: 5, dy_mm: 0 }, { track_id: 'ty', dx_mm: 0, dy_mm: 5 }] },
            { id: 'check', kind: 'verify_calibration', fit_id: 'fit' },
            { id: 'survey', kind: 'survey_bed', z_levels: [328, 320], plane_z: 100, overlap_fraction: 0.4 },
        ]);
    }],
    ['invented fields and nonnumeric heights fail before staging', () => {
        for (const item of [
            { id: 'z', kind: 'move_z', z: 328 },
            { id: 'z', kind: 'move_z', machine_z: null },
            { id: 'z', kind: 'move_z', machine_z: '328' },
            { id: 'z', kind: 'move_z', machine_z: NaN },
            { id: 'z', kind: 'move_z', machine_z: 328, operator_confirmed_clearance: true },
            { id: 'z', kind: 'constructor' },
            { id: 'z', kind: 'capture', constructor: true },
        ]) assert.throws(() => validateCameraOps([item]));
    }],
    ['capture references must be earlier captures, never self, unknown or surveys', () => {
        for (const id of ['track', 'later', 'survey']) {
            assert.throws(() => validateCameraOps([
                { id: 'survey', kind: 'survey_bed', machine_z: 328 },
                { id: 'track', kind: 'track_feature', template_capture_id: id, search_capture_id: id, point: { u: 20, v: 20 } },
            ]), /EARLIER/);
        }
        assert.throws(() => validateCameraOps([{ id: 'a', kind: 'capture' }, { id: 'a', kind: 'capture' }]), /Duplicate/);
    }],
    ['survey height and physical-plane contracts reject ambiguous calls', () => {
        assert.throws(() => validateCameraOps([{ id: 's', kind: 'survey_bed', machine_z: 328, z_levels: [320] }]), /mutually exclusive/);
        assert.throws(() => validateCameraOps([{ id: 's', kind: 'survey_bed', overlap_fraction: 0.5 }]), /physical surface/);
        assert.throws(() => validateCameraOps([{ id: 's', kind: 'survey_bed', operator_confirmed_clearance: 'yes' }]), /boolean/);
        validateCameraOps([{ id: 's', kind: 'survey_bed', machine_z: 300, operator_confirmed_clearance: true }]);
    }],
    ['inverse verification cannot consume arbitrary results or malformed matrices', () => {
        assert.throws(() => validateCameraOps([{ id: 'c', kind: 'capture' }, { id: 'v', kind: 'verify_calibration', fit_id: 'c' }]), /EARLIER/);
        for (const matrix of [[], [[1, 0]], [[1, 0], [0, NaN]]]) {
            assert.throws(() => validateCameraOps([{ id: 'v', kind: 'verify_calibration', jacobian: [[1, 0], [0, 1]], matrix }]));
        }
        assert.throws(() => validateCameraOps([{ id: 'v', kind: 'verify_calibration' }]), /requires/);
    }],
    ['staging hands off one confirmation for an entire sequence', async () => {
        const registry = new ToolRegistry();
        registry.register({ name: 'sequence',
            description: 'test',
            inputSchema: {},
            handler: async () => ({
                operations: ['park', 'capture', 'survey'], confirm_url: 'http://localhost/confirm/example',
            }) });
        const result = await registry.call('sequence', {}) as { handoff?: { rule: string }; operations: string[] };
        assert.equal(result.operations.length, 3);
        assert.match(result.handoff?.rule || '', /END THE TURN/);
    }],
];
