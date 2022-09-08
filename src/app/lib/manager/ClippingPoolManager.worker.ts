import { Pool, spawn, Transfer, Worker } from 'threads';
import { PoolEventType } from 'threads/dist/master/pool-types';
import { Box3, BufferAttribute, BufferGeometry, Line3, Matrix4, Plane, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { expandBuffer, pointToBuffer } from '../buffer-utils';

type TPoint = { x: number, y: number, z?: number }

type TInfillPattern = 'lines' | 'grid' | 'triangles' | 'trihexagon' | 'cubic'

type TClippingConfig = {
    wallThickness: number;
    lineWidth: number;
    topLayers: number;
    bottomLayers: number;
    layerHeight: number;
    infillSparseDensity: number;
    infillPattern: TInfillPattern;
    magicSpiralize: boolean;
}

export type IMessage = {
    modelID: string;
    positionAttribute: {
        array: number[];
        itemSize: number;
        normalized: boolean;
    },
    modelMatrix: Matrix4,
    wallCount: number,
    layerHeight: number,
    modelName?: string,
    boundingBox: Box3,
    clippingConfig: TClippingConfig,
    modelBoundingBox: Box3
}

type TJobMessage = IMessage & {
    jobID: string;
}

export type IResult = {
    clippingMap,
    innerWallMap,
    skinMap,
    infillMap
}

type ClipperMessageType = 'set-job' | 'stop-job' | 'continue-job' | 'cancel-job'

const defaultPoolSize = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 4;

let pool;

const tempVector = new Vector3();
const tempLine = new Line3();
let positions: TPoint[] = [];
const plane = new Plane(new Vector3(0, 0, -1), 0);
const clippingMap = new Map();
const innerWallMap = new Map();
const skinMap = new Map();
const infillMap = new Map();
let transferList: Transferable[] = [];
let layerCount = 0,
    jobs: TJobMessage[] = [],
    runningJob: TJobMessage,
    poolTaskQueue = [],
    idleWorkerNum = defaultPoolSize,
    subscriber1,
    subscriber2;

const clearTaskTmp = () => {
    clippingMap.clear();
    innerWallMap.clear();
    skinMap.clear();
    infillMap.clear();
    layerCount = 0;

    poolTaskQueue = [];
    transferList = [];
};

let sleep = false;
const scheduleWork = () => {
    // There are no idle workers or the task queue is empty
    if (sleep || !idleWorkerNum || poolTaskQueue.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        runJob();
        return;
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    poolExecute();
};

function poolExecute() {
    idleWorkerNum--;

    const task = poolTaskQueue.shift();

    pool.queue(async (worker) => {
        return new Promise<void>((resolve) => {
            const subscribe = worker[task.workerName](task.message).subscribe({
                next: task.onMessage,
                complete() {
                    resolve();
                    subscribe.unsubscribe();
                    task.onComplete && task.onComplete();

                    idleWorkerNum++;
                    scheduleWork();
                }
            });
        });
    });
}

/**
 * The cancel task of threads has poor performance, so the predecessor task queue is set
 */
const setPoolTask = async (workerName: string, message: unknown, onMessage: ((data) => void), onComplete?: () => void) => {
    // Put into execution queue
    poolTaskQueue.push({ workerName, message, onMessage, onComplete });
    scheduleWork();
};

const sortUnorderedLine = (layerTop: number, wallCount: number, lineWidth: number, buffer?: ArrayBuffer) => {
    if (!buffer) {
        clippingMap.set(layerTop, [[new ArrayBuffer(0)]]);
        innerWallMap.set(layerTop, [[[new ArrayBuffer(0)]]]);
    } else {
        setPoolTask('sortUnorderedLine', {
            fragments: Transfer(buffer),
            layerHeight: layerTop,
            innerWallCount: wallCount,
            lineWidth
        }, (res) => {
            if (res) {
                clippingMap.set(layerTop, res.outWall.send);
                innerWallMap.set(layerTop, res.innerWall.send);
                transferList.push(res.outWall.send);
                transferList.push(res.innerWall.send);
            } else {
                clippingMap.set(layerTop, [[new ArrayBuffer(0)]]);
                innerWallMap.set(layerTop, [[[new ArrayBuffer(0)]]]);
            }
        });
    }
};

const mapClippingSkinArea = (wallCount: number, clippingConfig: TClippingConfig, modelBoundingBox: Box3, callback) => {
    pool.queue(async (worker) => {
        const subscribe = worker.mapClippingSkinArea({
            innerWallMap: Transfer(
                innerWallMap, expandBuffer(
                    Array.from(innerWallMap.values())
                )
            ),
            innerWallCount: wallCount,
            lineWidth: clippingConfig.lineWidth,
            bottomLayers: clippingConfig.bottomLayers,
            topLayers: clippingConfig.topLayers,
            modelBoundingBox,
            layerHeight: clippingConfig.layerHeight
        }).subscribe({
            next: callback,
            complete() {
                subscribe.unsubscribe();
            }
        });
    });
};

const calaClippingSkin = (clippingConfig, wallCount, { innerWall, otherLayers, layerTop }) => {
    setPoolTask('calaClippingSkin', {
        innerWall: Transfer(innerWall.send, expandBuffer(innerWall.send)),
        otherLayers: Transfer(otherLayers.send, expandBuffer(otherLayers.send)),
        lineWidth: clippingConfig.lineWidth,
        innerWallCount: wallCount,
    }, (res) => {
        innerWallMap.set(layerTop, res.innerWall.send);
        skinMap.set(layerTop, res.skin.send);
        infillMap.set(layerTop, res.infill.send);

        transferList.push(res.innerWall.send);
        transferList.push(res.skin.send);
        transferList.push(res.infill.send);
    });
};

/**
 * Check whether the job has been cancelled
 */
const checkWhetherJobCancelled = () => {
    // Cache the ID of the task being executed
    const runningJobID = runningJob.jobID;

    return () => {
        return runningJobID !== runningJob.jobID;
    };
};

async function calculateSectionPoints({
    positionAttribute, modelMatrix, layerHeight, boundingBox, wallCount, clippingConfig, modelBoundingBox, modelID, jobID
}: TJobMessage) {
    clearTaskTmp();

    const hasCancelled = checkWhetherJobCancelled();

    layerHeight = Number(layerHeight);

    let bvhGeometry = new BufferGeometry();
    const position = new BufferAttribute(
        positionAttribute.array,
        positionAttribute.itemSize,
        positionAttribute.normalized
    );
    const matrix = new Matrix4();
    matrix.fromArray(modelMatrix.elements);
    position.applyMatrix4(matrix);
    bvhGeometry.setAttribute('position', position);
    let colliderBvh = new MeshBVH(bvhGeometry, { maxLeafTris: 3 });

    if (hasCancelled()) {
        return;
    }
    for (let layerTop = layerHeight; layerTop < boundingBox.max.z; layerTop = Number((layerTop + layerHeight).toFixed(2))) {
        if (hasCancelled()) {
            break;
        }
        if (layerTop <= boundingBox.min.z) {
            continue;
        }
        plane.constant = layerTop;
        let index = 0;
        positions = [];
        colliderBvh.shapecast({
            intersectsBounds: (box) => {
                return plane.intersectsBox(box);
            },
            intersectsTriangle: (tri) => {
                // check each triangle edge to see if it intersects with the plane. If so then
                // add it to the list of segments.
                let count = 0;

                const intersectPoints = [[tri.a, tri.b], [tri.b, tri.c], [tri.c, tri.a]].reduce((p, [start, end]) => {
                    tempLine.start.copy(start);
                    tempLine.end.copy(end);
                    if (plane.intersectLine(tempLine, tempVector)) {
                        const x = Math.round(tempVector.x * 10000) / 10000;
                        const y = Math.round(tempVector.y * 10000) / 10000;
                        const z = Math.round(tempVector.z * 10000) / 10000;
                        positions[index] = { x, y, z };
                        p.push({ x, y, z });
                        count++;
                        index++;
                    }
                    return p;
                }, [] as TPoint[]);

                if (count === 3) {
                    if (
                        (intersectPoints[count - 1].x === intersectPoints[count - 2].x && intersectPoints[count - 1].y === intersectPoints[count - 2].y)
                        || (intersectPoints[count - 1].x === intersectPoints[count - 3].x && intersectPoints[count - 1].y === intersectPoints[count - 3].y)
                    ) {
                        count--;
                        index--;
                    } else if (intersectPoints[count - 2].x === intersectPoints[count - 3].x && intersectPoints[count - 2].y === intersectPoints[count - 3].y) {
                        positions[index - 2] = intersectPoints[count - 1];
                        count--;
                        index--;
                    }
                }
                // If we only intersected with one or three sides then just remove it. This could be handled
                // more gracefully.
                if (count !== 2) {
                    index -= count;
                }
            }
        });

        layerCount++;
        sortUnorderedLine(layerTop, wallCount, clippingConfig.lineWidth, pointToBuffer(positions));
    }
    bvhGeometry = null;
    colliderBvh = null;
    // const cost = new Date().getTime() - now;
    // console.log(`calculate section finish => layCount=${number},cost=${cost},average=${cost / number}`);
    if (subscriber1) {
        subscriber1.unsubscribe();
    }
    subscriber1 = pool.events()
        .filter(event => event.type === PoolEventType.taskCompleted)
        .subscribe(() => {
            if (layerCount && layerCount === innerWallMap.size) {
                mapClippingSkinArea(wallCount, clippingConfig, modelBoundingBox, ({ innerWall, otherLayers, layerTop }) => {
                    calaClippingSkin(clippingConfig, wallCount, { innerWall, otherLayers, layerTop });
                });
                subscriber1.unsubscribe();

                if (subscriber2) {
                    subscriber2.unsubscribe();
                }
                subscriber2 = pool.events()
                    .filter(event => event.type === PoolEventType.taskCompleted)
                    .subscribe(() => {
                        if (layerCount && layerCount === infillMap.size) {
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            postMessage({ type: 'FINISH', modelID, clippingMap, innerWallMap, skinMap, infillMap, jobID }, expandBuffer(transferList));
                            // finish execution job, runningJob=${runningJob.jobID}, modelID=${runningJob.modelID}

                            runningJob = null;
                            subscriber2.unsubscribe();

                            // eslint-disable-next-line @typescript-eslint/no-use-before-define
                            runJob();
                        }
                    });
            }
        });
}

let clearPoolhandle;
function runJob() {
    if (!pool) {
        postMessage({ WORKER_STATUS: 'clipperWorkerBusy' });
        pool = Pool(
            async () => spawn(new Worker('clipperPool.worker.js'), {
                timeout: 20000
            }),
            defaultPoolSize
        );
        const subscriber = pool.events()
            .filter(event => event.type === PoolEventType.initialized)
            .subscribe(() => {
                idleWorkerNum = defaultPoolSize;
                runJob();
                subscriber.unsubscribe();
            });
        return;
    }

    if (clearPoolhandle) {
        clearTimeout(clearPoolhandle);
        clearPoolhandle = null;
    }

    if (jobs.length && !runningJob && idleWorkerNum === defaultPoolSize) {
        runningJob = jobs.shift();
        postMessage({ WORKER_STATUS: 'clipperWorkerBusy' });
        // start execution job, runningJob=${runningJob.jobID}, modelID=${runningJob.modelID}
        calculateSectionPoints(runningJob);
    } else if (!runningJob) {
        postMessage({ WORKER_STATUS: 'clipperWorkerIdle' });

        clearPoolhandle = setTimeout(() => {
            pool.terminate();
            pool = null;
        }, 1000 * 10);
        clearTaskTmp();
    }
}

onmessage = async (e) => {
    const [type, job, jobID] = e.data as [ClipperMessageType, TJobMessage, string];
    if (type === 'stop-job') {
        sleep = true;
        postMessage({ WORKER_STATUS: 'clipperWorkerStop' });
        return;
    } else if (type === 'continue-job') {
        sleep = false;
        scheduleWork();
        return;
    }

    if (runningJob && runningJob.modelID === job.modelID) {
        poolTaskQueue = [];
        const runningJobID = runningJob.jobID;
        // emit to cancel worker, runningJob=${runningJob.jobID}, modelID=${runningJob.modelID}
        // emit to cancel worker
        postMessage({ type: 'CANCEL', modelID: runningJob.modelID, jobID: runningJobID });
        layerCount = 0;
        runningJob = null;
    }
    jobs = jobs.filter(t => t.modelID !== job.modelID);

    if (type !== 'cancel-job' && jobID) {
        job.jobID = jobID;
        jobs.push(job);
    }
    runJob();
};

export default null;
