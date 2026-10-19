import path from 'path';
import workerpool, { WorkerPool } from 'workerpool';
import DataStorage from '../../DataStorage';
import { SERVER_DIR, SERVER_DIR_ENV } from '../../lib/paths';

// Avoid TSC precompiling, at the same time, webpack can collect dependencies
if (process.env.NODE_ENV === 'production') {
    require('./Pool.worker');
}

export enum WorkerMethods {
    // LUBAN worker methods BEGIN
    cutModel = 'cutModel',
    generateGcode = 'generateGcode',
    generateToolPath = 'generateToolPath',
    generateViewPath = 'generateViewPath',
    heartBeat = 'heartBeat',
    loadSize = 'loadSize',
    processImage = 'processImage',
    imageRemap = 'imageRemap',
    svgClipping = 'svgClipping'
    // LUBAN worker methods END
}

export type IWorkerManager = {
    [method in WorkerMethods]: (data: unknown[], onmessage: (data: unknown) => void) => {
        terminate(): void;
    };
}

class WorkerManager {
    private pool: WorkerPool;

    public getPool() {
        if (!this.pool) {
            const config: workerpool.WorkerPoolOptions = {
                workerType: 'process',
                forkOpts: {
                    // This replaces the worker's environment rather than
                    // extending it: pass the server directory on, so the
                    // worker resolves files emitted beside the bundles
                    // (opencv.wasm) from the same place the server does.
                    env: {
                        Tmpdir: DataStorage.tmpDir,
                        fontDir: DataStorage.fontDir,
                        [SERVER_DIR_ENV]: SERVER_DIR,
                    }
                }
            };
            // if (process.env.NODE_ENV === 'development') {
            //     config.maxWorkers = 2;
            //     config.forkOpts.execArgv = ['--inspect=8888'];
            // } else {
            config.minWorkers = 1;
            // }
            // The worker is emitted beside the server bundle (worker-loader);
            // an absolute path keeps the fork independent of the working directory.
            this.pool = workerpool.pool(path.join(SERVER_DIR, 'Pool.worker.js'), config);
        }
        return this.pool;
    }
}

Object.entries(WorkerMethods).forEach(([, method]) => {
    // eslint-disable-next-line func-names
    WorkerManager.prototype[method] = function (data: unknown[], onmessage?: (payload: unknown) => void) {
        const pool = this.getPool() as WorkerPool;
        const handle = pool.exec(method, data, {
            on: (payload) => {
                if (onmessage) {
                    onmessage(payload);
                } else {
                    WorkerManager.prototype[method].onmessage(payload);
                }
            }
        });
        let cancelled = false;
        if (method === WorkerMethods.heartBeat) {
            // Polling should remain alive until explicitly cancelled. Observe rejection as well as
            // resolution: a crashed worker otherwise leaves a connected flag and an old position.
            handle.then(() => {
                if (!cancelled) { onmessage?.({ status: 'worker-exit', reason: 'worker_completed' }); }
            }, () => {
                if (!cancelled) { onmessage?.({ status: 'worker-exit', reason: 'worker_rejected' }); }
            });
        }
        return {
            terminate: () => {
                cancelled = true;
                handle.cancel();
            }
        };
    };
});

const workerManager = new WorkerManager() as unknown as IWorkerManager;

export default workerManager;
