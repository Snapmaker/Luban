import { simplifyPolygons } from '../../shared/lib/clipper/cLipper-adapter';
import sendMessage from './utils/sendMessage';

type TPoint = { x: number, y: number, z?: number }

type ITraceLine = [TPoint, TPoint]

type ITraceLineItem = {
    visited: boolean;
    value: Map<string, ITraceLine>
}

type IPointsMap = Map<string, ITraceLineItem>

const toPointHash = (point: TPoint) => {
    return `${point.x},${point.y};`;
};

const toPointMap = (data: TPoint[]): IPointsMap => {
    let pointMap = new Map<string, ITraceLineItem>();
    for (let index = 0; index < data.length; index += 2) {
        if (!data[index + 1]) {
            break;
        }
        const key1 = toPointHash(data[index]);
        const key2 = toPointHash(data[index + 1]);

        if (pointMap.has(key1)) {
            pointMap.get(key1).value.set(`${key1}${key2}`, [
                data[index], data[index + 1]
            ]);
        } else {
            const m = new Map<string, ITraceLine>();
            m.set(`${key1}${key2}`, [
                data[index], data[index + 1]
            ]);
            pointMap = pointMap.set(key1, {
                visited: false,
                value: m
            });
        }
        if (pointMap.has(key2)) {
            pointMap.get(key2).value.set(`${key1}${key2}`, [
                data[index], data[index + 1]
            ]);
        } else {
            const m = new Map<string, ITraceLine>();
            m.set(`${key1}${key2}`, [
                data[index], data[index + 1]
            ]);
            pointMap = pointMap.set(key2, {
                visited: false,
                value: m
            });
        }
    }
    return pointMap;
};

const removePoint = (traceLine: ITraceLine, pointsMap: IPointsMap) => {
    const key1 = toPointHash(traceLine[0]);
    const key2 = toPointHash(traceLine[1]);

    if (pointsMap.has(key1)) {
        pointsMap.get(key1).value.delete(`${key1}${key2}`);
        pointsMap.get(key1).value.delete(`${key2}${key1}`);
        if (pointsMap.get(key1).value.size === 0) {
            pointsMap.delete(key1);
        }
    }
    if (pointsMap.has(key2)) {
        pointsMap.get(key2).value.delete(`${key1}${key2}`);
        pointsMap.get(key2).value.delete(`${key2}${key1}`);
        if (pointsMap.get(key2).value.size === 0) {
            pointsMap.delete(key2);
        }
    }
    return pointsMap;
};

const search = (latest: TPoint, currentConnectedPoints: TPoint[], currentConnectedKeys: Set<string>, pointsMap: IPointsMap): [TPoint[], boolean] => {
    const pointKey = toPointHash(latest);
    // console.log(currentConnectedKeys.toString(), ' => ', pointKey);

    const linesMap = pointsMap.get(pointKey);
    if (linesMap && !linesMap.visited) {
        let max: TPoint[] = [];
        let isCircle = false;
        linesMap.visited = true;
        for (const [, line] of linesMap.value.entries()) {
            // linesMap.value.forEach((line) => {
            const spKey = toPointHash(line[0]);

            const next = pointKey === spKey ? line[1] : line[0];
            const nextHash = toPointHash(next);

            if (currentConnectedKeys.has(toPointHash(next))) {
                const index = currentConnectedPoints.findIndex(i => toPointHash(i) === nextHash);
                if (max.length < currentConnectedKeys.size - index - 1) {
                    max = currentConnectedPoints;
                    isCircle = true;
                }
            } else {
                currentConnectedPoints.push(next);
                currentConnectedKeys.add(nextHash);
                const [res, _isCircle] = search(
                    next,
                    currentConnectedPoints,
                    currentConnectedKeys,
                    pointsMap
                );
                if (res && max.length < res.length) {
                    max = res;
                    isCircle = _isCircle;
                }
            }
            // });
        }


        return [max, isCircle];
    } else {
        return [currentConnectedPoints, false];
    }
};

const sortUnorderedLine = (fragments: TPoint[], actionID: string) => {
    const m3 = new Date().getTime();
    // console.log(`[${actionID}] worker exec 2, cost=`, m3 - m);

    return new Promise((resolve) => {
        try {
            // console.log('=========== ', fragments.length);

            let pointsMap = toPointMap(fragments);

            let latest;
            const polygons = [];

            // let num = 0;

            while (pointsMap.size) {
                let traceLines: ITraceLineItem;
                for (const iterator of pointsMap.entries()) {
                    traceLines = iterator[1];
                    break;
                }

                let initial;
                for (const iterator of traceLines.value.entries()) {
                    initial = iterator[1];
                    break;
                }

                const connected = [
                    initial[0], initial[1]
                ];
                const allConnectedPoints = new Set([
                    toPointHash(initial[0]),
                    toPointHash(initial[1])
                ]);
                latest = initial[1];
                // const m2 = new Date().getTime();
                const [arr, isCircle] = search(latest, connected, allConnectedPoints, removePoint(initial, pointsMap));
                // console.log(`=>> ${num++}: ${arr.length}, isCircle=${isCircle} ,cost=`, new Date().getTime() - m2);

                if (isCircle) {
                    const leng = arr.length;
                    const polygon = [];
                    for (let index = 0; index < leng; index++) {
                        const next = arr[index + 1] || arr[0];
                        polygon.push(arr[index], next);
                    }
                    polygons.push(polygon);
                }

                for (let index = 0; index < arr.length; index++) {
                    const start = arr[index];
                    const end = arr[index + 1];
                    if (end) {
                        pointsMap = removePoint([start, end], pointsMap);
                    }
                }
            }
            // const m4 = new Date().getTime();
            // console.log(`[${actionID}] worker complete, cost=`, m4 - m3);

            const res = simplifyPolygons(polygons);
            const ret = res.map((vectors) => {
                const arr = [];
                for (let k = 0; k < vectors.length; k++) {
                    const begin = vectors[k];
                    const end = vectors[k + 1];
                    if (end) {
                        arr.push(begin, end);
                    }
                }
                return arr;
            });

            sendMessage(ret);
            resolve(true);
        } catch (error) {
            const m4 = new Date().getTime();
            console.error(`[${actionID}] worker error, time=`, m4 - m3, error);
            resolve(error);
        }
        // return polygons;
    });
};

export default sortUnorderedLine;
