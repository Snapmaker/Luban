import { spawn, Worker, Pool, Thread } from 'threads';
import './Pool.worker';

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
    sortUnorderedLine2 = 'sortUnorderedLine2',
    translatePolygons = 'translatePolygons',
    calaClippingWall = 'calaClippingWall',
    calaClippingSkin = 'calaClippingSkin',
    generateSkirt = 'generateSkirt',
    generateBrim = 'generateBrim',
    generateRaft = 'generateRaft',
    calculateSectionPoints = 'calculateSectionPoints',
    mapClippingSkinArea = 'mapClippingSkinArea'
    // LUBAN worker methods END
}

type IWorkerManager = {
    [method in WorkerMethods]: <T>(
        data: unknown,
        onmessage: (data: T) => void
    ) => Promise<{
        terminate(): void;
    }>;
};
type PayloadData = {
    status?: string;
    type?: string;
    value?: unknown;
};

class WorkerManager {
    private pool: Pool<Thread>;
    // private singleTasks = new Map<string, unknown>()

    public getPool() {
        if (!this.pool) {
            this.pool = Pool(async () => spawn(new Worker('./Pool.worker.js'))) as unknown as Pool<Thread>;
        }
        return this.pool;
    }

    // public calculateSectionPoints() {

    // }
}

Object.entries(WorkerMethods).forEach(([, method]) => {
    // eslint-disable-next-line
    WorkerManager.prototype[method] = async function (data: any, onmessage?: (payload: unknown) => void | Promise<unknown>) {
        const task = this.getPool().queue(eachPool => {
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
