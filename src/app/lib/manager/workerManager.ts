import { spawn, Worker as ThreadsWorker, Pool, Thread } from 'threads';
import './Pool.worker';
import './clipperPool.worker';
import EventEmitter from 'events';
import { isUndefined } from 'lodash';
import CalculateSectionPoints, { IMessage as TCalculateSectionPointsMessage } from './ClippingPoolManager.worker';
import { machineStore } from '../../store/local-storage';

type TListener = [string, (res: unknown) => void]
class WorkerManager extends EventEmitter {
    private pool: Pool<Thread>;
    private clipperWorker: Worker;
    private listenerMap = new Map<string, TListener>()

    public clipperWorkerEnable = false;

    public constructor() {
        super();
        this.setClipperWorkerEnable();
    }

    public setClipperWorkerEnable(bool?: boolean): void;
    public setClipperWorkerEnable(bool: boolean) {
        if (isUndefined(bool)) {
            let enable3dpLivePreview = machineStore.get('enable3dpLivePreview');
            if (isUndefined(enable3dpLivePreview)) {
                enable3dpLivePreview = true;
            }
            this.clipperWorkerEnable = enable3dpLivePreview;
        } else {
            if (!bool && this.clipperWorkerEnable && this.clipperWorker) {
                this.clipperWorker.terminate();
                this.clipperWorker = null;
            }
            this.clipperWorkerEnable = bool;
        }
    }

    public getPool() {
        if (!this.pool) {
            this.pool = Pool(async () => spawn(new ThreadsWorker('./Pool.worker.js'), {
                timeout: 20000
            }), 2) as unknown as Pool<Thread>;
        }

        return this.pool;
    }

    public arrangeModels<T>(data: unknown, onMessage: (data: T) => void, onComplete?: () => void) {
        return this.exec('arrangeModels', data, onMessage, onComplete);
    }

    public autoRotateModels<T>(data: unknown, onMessage: (data: T) => void, onComplete?: () => void) {
        return this.exec('autoRotateModels', data, onMessage, onComplete);
    }

    public boxSelect<T>(data: unknown, onMessage: (data: T) => void, onComplete?: () => void) {
        return this.exec('boxSelect', data, onMessage, onComplete);
    }

    public gcodeToArraybufferGeometry<T>(data: unknown, onMessage: (data: T) => void, onComplete?: () => void) {
        return this.exec('gcodeToArraybufferGeometry', data, onMessage, onComplete);
    }

    public gcodeToBufferGeometry<T>(data: unknown, onMessage: (data: T) => void, onComplete?: () => void) {
        return this.exec('gcodeToBufferGeometry', data, onMessage, onComplete);
    }

    public loadModel<T>(data: unknown, onMessage: (data: T) => void, onComplete?: () => void) {
        return this.exec('loadModel', data, onMessage, onComplete);
    }

    public scaleToFitWithRotate<T>(data: unknown, onMessage: (data: T) => void, onComplete?: () => void) {
        return this.exec('scaleToFitWithRotate', data, onMessage, onComplete);
    }

    public toolpathRenderer<T>(data: unknown, onMessage: (data: T) => void, onComplete?: () => void) {
        return this.exec('toolpathRenderer', data, onMessage, onComplete);
    }

    public generatePlateAdhesion<T>(data: unknown, onMessage: (data: T) => void, onComplete?: () => void) {
        return this.exec('generatePlateAdhesion', data, onMessage, onComplete);
    }

    public async stopCalculateSectionPoints(modelID: string) {
        const preListener = this.listenerMap.get(modelID);
        if (preListener) {
            // remove the last listening in time
            this.removeListener(...preListener);
        }
    }

    public async calculateSectionPoints<T>(data: TCalculateSectionPointsMessage) {
        if (!this.clipperWorker) {
            this.clipperWorker = new CalculateSectionPoints();
            this.clipperWorker.onmessage = (res) => {
                // message pipeline
                const { jobID } = res.data;
                this.emit(`CLIPPER:${jobID}`, res.data);
            };
        }

        const jobID = Math.random();
        const modelID = data.modelID;
        return new Promise<T>((resolve, reject) => {
            const listener = (res) => {
                // get from worker, jobID=${jobID}, modelID=${modelID}, res.type=${res.type}
                if (res.type === 'CANCEL') {
                    reject();
                } else {
                    resolve(res);
                }
            };
            this.once(`CLIPPER:${jobID}`, listener);
            this.listenerMap.set(modelID, [
                `CLIPPER:${jobID}`, listener
            ]);
            // send to worker, jobID=${jobID}, modelID=${modelID}
            this.clipperWorker.postMessage([data, jobID]);
        });
    }

    private exec<T>(method: string, data: unknown, onMessage?: (payload: T) => void, onComplete?: () => void) {
        let task = this.getPool().queue(async (eachPool) => {
            return new Promise<void>((resolve) => {
                const subscribe = eachPool[method](data).subscribe({
                    next: (payload: T) => {
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
    }
}

const workerManager = new WorkerManager();
export default workerManager;
