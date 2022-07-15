import { spawn, Worker, Pool, Thread } from 'threads';
import './Pool.worker';
// const { spawn, Worker, Pool } = require('threads');

export enum WorkerMethods {
    arrangeModels = 'arrangeModels',
    autoRotateModels = 'autoRotateModels',
    boxSelect = 'boxSelect',
    gcodeToArraybufferGeometry = 'gcodeToArraybufferGeometry',
    gcodeToBufferGeometry = 'gcodeToBufferGeometry',
    loadModel = 'loadModel',
    scaleToFitWithRotate = 'scaleToFitWithRotate',
    toolpathRenderer = 'toolpathRenderer',
    generatePlateAdhesion = 'generatePlateAdhesion',
}

type IWorkerManager = {
    [method in WorkerMethods]: <T>(
        data: unknown,
        onMessage: (data: T) => void,
        onComplete?: () => void
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


    public getPool() {
        if (!this.pool) {
            this.pool = Pool(async () => spawn(new Worker('./Pool.worker.js'))) as unknown as Pool<Thread>;
        }

        return this.pool;
    }
}

Object.entries(WorkerMethods).forEach(([, method]) => {
    // eslint-disable-next-line
    WorkerManager.prototype[method] = async function (data: any, onMessage?: (payload: unknown) => void | Promise<unknown>, onComplete?: () => void) {
        let task = this.getPool().queue(async (eachPool) => {
            return new Promise<void>((resolve) => {
                const subscribe = eachPool[method](data).subscribe({
                    next: (payload: PayloadData) => {
                        if (onMessage) {
                            onMessage(payload);
                        }
                    },
                    complete() {
                        resolve();
                        task = null;
                        subscribe.unsubscribe();
                        onComplete && onComplete();
                    }
                });
            });
        });
        return {
            terminate: () => {
                task && task.cancel();
            }
        };
    };
});

const manager = (new WorkerManager() as unknown) as IWorkerManager;

export default manager;
