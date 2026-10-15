import { strict as assert } from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

import * as cameraArtifacts from '../cameraArtifacts';
import { cameraArtifactPath } from '../cameraArtifacts';
import { isolatedModule } from './jobDashboard.test';

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['requested snapshots remain readable and trackable beyond 12 frames and after restart; raw stream frames stay transient', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luban-camera-snapshots-'));
        const dependencies = {
            child_process: {},
            'fs-extra': fs,
            http: {},
            https: {},
            '../../DataStorage': { userDataDir: dir },
            '../../lib/logger': () => ({ debug: () => undefined }),
            '../configstore': {},
            './cameraSelection': {},
            './registry': {},
            './cameraArtifacts': cameraArtifacts,
        };
        try {
            const camera = isolatedModule('camera.ts', dependencies);
            const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
            camera.setLiveFrameSource({
                isActive: () => true,
                awaitFrame: async () => ({ frameId: camera.cacheFrame(png, 'test-camera'),
                    imageBase64: png.toString('base64'),
                    mimeType: 'image/png',
                    device: 'test-camera',
                    capturedAt: 123,
                    source: 'stream' }),
            });
            const first = await camera.captureFrame();
            for (let i = 0; i < 24; i++) {
                // eslint-disable-next-line no-await-in-loop
                await camera.captureFrame();
            }
            assert.equal(camera.getCachedFrameIds().length, 12);
            assert.equal(camera.getCachedFrame(first.frameId), null);
            assert.deepEqual(camera.getCapturedFrame(first.frameId), png);
            assert.equal(cameraArtifacts.cameraImageMime(camera.getCapturedFrame(first.frameId)), 'image/png');
            const restarted = isolatedModule('camera.ts', dependencies);
            assert.deepEqual(restarted.getCapturedFrame(first.frameId), png);
            assert.equal(restarted.getCachedFrameDevice(first.frameId), 'test-camera');
            const transient = camera.cacheFrame(png);
            assert.equal(restarted.getCapturedFrame(transient), null);
            assert.equal(restarted.getCapturedFrame('../secret'), null);
            assert.equal(fs.readdirSync(path.join(dir, 'mcp-camera-captures')).length, 25);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }],
    ['remote artifact reads reject arbitrary files and symlink escapes', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luban-camera-artifacts-'));
        try {
            const root = path.join(dir, 'mcp-camera-bootstrap');
            fs.mkdirSync(root);
            const image = path.join(root, 'frame.jpg');
            const index = path.join(root, 'index.json');
            fs.writeFileSync(image, 'test image');
            fs.writeFileSync(index, '{}');
            assert.equal(cameraArtifactPath(dir, image, 'image'), image);
            assert.equal(cameraArtifactPath(dir, index, 'index'), index);
            assert.throws(() => cameraArtifactPath(dir, index, 'image'), /Only camera/);
            assert.throws(() => cameraArtifactPath(dir, root, 'image'), /inside/);
            const outside = path.join(dir, 'secret.jpg');
            fs.writeFileSync(outside, 'not a camera image');
            assert.throws(() => cameraArtifactPath(dir, path.join(root, '..', 'secret.jpg'), 'image'), /inside/);
            if (process.platform !== 'win32') {
                const link = path.join(root, 'escape.jpg');
                fs.symlinkSync(outside, link);
                assert.throws(() => cameraArtifactPath(dir, link, 'image'), /symlink/);
            }
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }],
];
