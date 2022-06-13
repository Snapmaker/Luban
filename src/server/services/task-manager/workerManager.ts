import workerpool, { WorkerPool } from 'workerpool';
import DataStorage from '../../DataStorage';

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
    processImage = 'processImage'
    // LUBAN worker methods END
}

export type IWorkerManager = {
    [method in WorkerMethods]: (data: unknown[], onmessage: (data: unknown) => void) => {
        terminate(): void;
    };
}

class WorkerManager {
    private pool: WorkerPool

    public getPool() {
        if (!this.pool) {
            const config: workerpool.WorkerPoolOptions = {
                workerType: 'process',
                forkOpts: {
                    env: {
                        Tmpdir: DataStorage.tmpDir,
                    }
                }
            };
            // if (process.env.NODE_ENV === 'development') {
            //     config.maxWorkers = 2;
            //     config.forkOpts.execArgv = ['--inspect=8888'];
            // } else {
            config.minWorkers = 'max';
            // }
            this.pool = workerpool.pool('./Pool.worker.js', config);
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
        return {
            terminate: () => {
                handle.cancel();
            }
        };
    };
});

const manager = new WorkerManager() as unknown as IWorkerManager;

export default manager;
