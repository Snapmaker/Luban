import { spawn, Worker, Pool, Thread } from 'threads';

import * as sortUnorderedLine from '../../workers/sortUnorderedLine';
import * as calculateSectionPoints from '../../workers/calculateSectionPoints';
import * as mapClippingSkinArea from '../../workers/mapClippingSkinArea';
import * as calaClippingSkin from '../../workers/calaClippingSkin';

import './clipperPool.worker';

class ClippingPoolManager {
    private pool: Pool<Thread>;

    public initPool() {
        this.getPool();
    }

    public sortUnorderedLine(message: sortUnorderedLine.TMessage, onMessage?: (data: sortUnorderedLine.IResult) => void, onComplete?: () => void) {
        return this.execTask<sortUnorderedLine.IResult>('sortUnorderedLine', message, onMessage, onComplete);
    }

    public calaClippingSkin(
        message: calaClippingSkin.TMessage, onMessage: (data: calaClippingSkin.TResult) => void, onComplete?: () => void
    ) {
        return this.execTask('calaClippingSkin', message, onMessage, onComplete);
    }

    public async calculateSectionPoints(
        message: calculateSectionPoints.IMessage, onMessage: (data: calculateSectionPoints.IResult) => void, onComplete?: () => void
    ) {
        const workersHandle = await spawn(new Worker('./clipperPool.worker.js'));
        this.getPool();
        const subscribe = workersHandle.calculateSectionPoints(message).subscribe({
            next: onMessage,
            complete() {
                Thread.terminate(workersHandle);
                subscribe.unsubscribe();
                onComplete && onComplete();
            }
        });

        return {
            terminate: async () => {
                return Thread.terminate(workersHandle);
            }
        };
    }

    public async mapClippingSkinArea(
        message: mapClippingSkinArea.TMessage, onMessage: (data: mapClippingSkinArea.TResult) => void, onComplete?: () => void
    ) {
        const workersHandle = await spawn(new Worker('./clipperPool.worker.js'));
        const subscribe = workersHandle.mapClippingSkinArea(message).subscribe({
            next: onMessage,
            complete() {
                Thread.terminate(workersHandle);
                subscribe.unsubscribe();
                onComplete && onComplete();
            }
        });

        return {
            terminate: async () => {
                return Thread.terminate(workersHandle);
            }
        };
    }

    private execTask<T>(workerName: string, message: unknown, onMessage: ((data: T) => void), onComplete?: () => void) {
        const workerPool = this.getPool();

        const task = workerPool.queue(async (worker) => {
            return new Promise<void>((resolve) => {
                const subscribe = worker[workerName](message).subscribe({
                    next: onMessage,
                    complete() {
                        resolve();
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

    public terminate() {
        if (this.pool) {
            this.pool.terminate(true);
            this.pool = null;
        }
    }

    private getPool() {
        if (!this.pool) {
            this.pool = Pool(async () => spawn(new Worker('./clipperPool.worker.js'))) as unknown as Pool<Thread>;
        }
        return this.pool;
    }
}

const clippingPoolManager = new ClippingPoolManager();

export default clippingPoolManager;


