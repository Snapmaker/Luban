import workerpool, { WorkerPool } from 'workerpool';
import './Pool.worker';

export enum WorkerMethods {
    // LUBAN worker methods BEGIN
    arrangeModels = 'arrangeModels',
    autoRotateModels = 'autoRotateModels',
    evaluateSupportArea = 'evaluateSupportArea',
    gcodeToArraybufferGeometry = 'gcodeToArraybufferGeometry',
    gcodeToBufferGeometry = 'gcodeToBufferGeometry',
    heartBeat = 'heartBeat',
    loadModel = 'loadModel',
    toolpathRenderer = 'toolpathRenderer'
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
                this.pool = workerpool.pool('./Pool.worker.js', {
                    minWorkers: 'max',
                    workerType: 'web'
                })
            )
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
