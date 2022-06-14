// import { spawn, Worker, Pool } from 'threads';
import './Pool.worker';

const { spawn, Worker, Pool } = require('threads');

export enum WorkerMethods {
    // LUBAN worker methods BEGIN
    arrangeModels = 'arrangeModels',
    autoRotateModels = 'autoRotateModels',
    boxSelect = 'boxSelect',
    // evaluateSupportArea = 'evaluateSupportArea',
    gcodeToArraybufferGeometry = 'gcodeToArraybufferGeometry',
    gcodeToBufferGeometry = 'gcodeToBufferGeometry',
    loadModel = 'loadModel',
    scaleToFitWithRotate = 'scaleToFitWithRotate',
    toolpathRenderer = 'toolpathRenderer'
    // LUBAN worker methods END
}

type IWorkerManager = {
    [method in WorkerMethods]: (
        data: unknown[],
        onmessage: (data: unknown) => void
    ) => {
        terminate(): void;
    };
};
type PayloadData = {
    status?: String;
    type?: String;
    value?: any;
};

class WorkerManager {
    public pool;
}

Object.entries(WorkerMethods).forEach(([, method]) => {
    // eslint-disable-next-line
    WorkerManager.prototype[method] = async function(data: any, onmessage?: (payload: unknown) => void | Promise<unknown>) {
        this.pool || (this.pool = Pool(async () => spawn(new Worker('./Pool.worker.js'))));
        const task = this.pool.queue(eachPool => {
            eachPool[method](data).subscribe((payload: PayloadData) => {
                if (onmessage) {
                    onmessage(payload);
                }
            });
        });
        return {
            terminate: () => {
                task.cancel();
            }
        };
    };
});

const manager = (new WorkerManager() as unknown) as IWorkerManager;

export default manager;
