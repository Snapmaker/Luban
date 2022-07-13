import { spawn, Thread, Worker } from 'threads';

import './draw.worker';

type TCoordinate = [number, number];

const drawManager = () => {
    let workersHandle;
    spawn(new Worker('./draw.worker.js')).then((res) => {
        workersHandle = res;
    });

    const initPath = <T>(message: unknown, nextCallback: ((data: T) => void), completeCallback?: () => void) => {
        const subscribe = workersHandle.initPath(message).subscribe({
            next: nextCallback,
            complete() {
                subscribe.unsubscribe();
                completeCallback && completeCallback();
            }
        });
    };

    const findNearestPoint = (x: number, y: number, nextCallback: (data: {
        nearestPoint: {
            coordinate: [TCoordinate, TCoordinate];
            fragmentIDS: [id: string, index: number][];
        },
        nearest
    }) => void) => {
        workersHandle.findNearestPoint(x, y).subscribe({
            next: nextCallback,
        });
    };

    const updateEndPoint = (
        origin: {
            coordinate: [TCoordinate, TCoordinate];
            fragmentIDS: [id: string, index: number][];
        },
        x: number,
        y: number,
        nextCallback: (data: {
            nearestPoint: {
                coordinate: [TCoordinate, TCoordinate];
                fragmentIDS: [id: string, index: number][];
            },
            nearest
        }) => void
    ) => {
        workersHandle.updateEndPoint(origin, x, y).subscribe({
            next: nextCallback,
        });
    };

    const updateScale = (scale: number) => {
        workersHandle?.updateScale(scale);
    };

    const terminate = () => {
        Thread.terminate(workersHandle);
    };

    return {
        initPath,
        findNearestPoint,
        updateEndPoint,
        updateScale,
        terminate
    };
};

export default drawManager;
