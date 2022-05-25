// import { spawn, Worker, Pool } from 'threads';
import './Pool.worker';
import { spawn, Worker, Pool } from 'threads';

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
    toolpathRenderer = 'toolpathRenderer',
    sortUnorderedLine = 'sortUnorderedLine',
    translatePolygons = 'translatePolygons',
    calaClippingWall= 'calaClippingWall',
    calaClippingSkin = 'calaClippingSkin'
    // LUBAN worker methods END
}

type IWorkerManager = {
    [method in WorkerMethods]: <T>(
        data: unknown[],
        onmessage: (data: T) => void
    ) => {
        terminate(): void;
    };
};
type PayloadData = {
    status?: string;
    type?: string;
    value?: unknown;
};

class WorkerManager {
    public pool;
}

Object.entries(WorkerMethods).forEach(([, method]) => {
    // eslint-disable-next-line
    WorkerManager.prototype[method] = async function (data: any, onmessage?: (payload: unknown) => void | Promise<unknown>) {
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
