import workerpool, { WorkerPool } from 'workerpool';
import DataStorage from '../../DataStorage';
import './Pool.worker';

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

type IWorkerManager = {
    [method in WorkerMethods]: (data: unknown[], onmessage: (data: unknown) => void) => {
        terminate(): void;
    };
}

class WorkerManager {
    public pool: WorkerPool
}

Object.entries(WorkerMethods).forEach(([, method]) => {
    // eslint-disable-next-line func-names
    WorkerManager.prototype[method] = function (data: any, onmessage?: (payload: unknown) => void) {
        const pool = (
            this.pool || (
                // https://github.com/josdejong/workerpool/blob/cba4d37ec3fcb9a7c49c4675e6607a77fe126876/test/Pool.test.js#L107
                this.pool = workerpool.pool('./Pool.worker.js', {
                    minWorkers: 'max',
                    workerType: 'process',
                    forkOpts: {
                        env: {
                            Tmpdir: DataStorage.tmpDir,
                        }
                    }
                }))
        ) as WorkerPool;

        const handle = pool.exec(method, data, {
            on: (payload) => {
                if (onmessage) {
                    onmessage(payload);
                } else {
                    WorkerManager.prototype[method].onmessage(payload);
                }
            },
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
