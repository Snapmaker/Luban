import { Observable } from 'rxjs';
// import { polyDiff } from '../../shared/lib/clipper/cLipper-adapter';
import { Polygon, Polygons } from '../../shared/lib/clipper/Polygons';
import { PolygonsUtils } from '../../shared/lib/math/PolygonsUtils';

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

type TStackItem = {
    depth: number;
    latest: TPoint;
    connectedKeys: Set<string>;
    connectedPoints: TPoint[]
}

const search = (stack: TStackItem[], pointsMap: IPointsMap): [TPoint[], boolean] => {
    let max: TPoint[] = [];
    let isCircle = false;

    while (stack.length) {
        const current = stack.pop();
        const currentHash = toPointHash(current.latest);

        if (current.connectedKeys.has(currentHash)) {
            const index = current.connectedPoints.findIndex(i => toPointHash(i) === currentHash);
            if (max.length < current.connectedKeys.size - index - 1) {
                max = current.connectedPoints;
                isCircle = true;
            }
        } else {
            current.connectedPoints.push(current.latest);
            current.connectedKeys.add(currentHash);

            const linesMap = pointsMap.get(currentHash);
            if (linesMap && !linesMap.visited) {
                linesMap.visited = true;

                for (const [, line] of linesMap.value.entries()) {
                    const spKey = toPointHash(line[0]);
                    const next = currentHash === spKey ? line[1] : line[0];
                    stack.push({
                        depth: current.depth + 1,
                        latest: next,
                        connectedPoints: current.connectedPoints,
                        connectedKeys: current.connectedKeys
                    });
                }
            } else {
            // return [connectedPoints, false];
            }
        }
    }
    return [max, isCircle];
};

type TMessage = {
    fragments: TPoint[],
    actionID: string
}

const sortUnorderedLine = ({ fragments, actionID }: TMessage) => {
    return new Observable((observer) => {
        const m3 = new Date().getTime();
        // console.log(`[${actionID}] worker exec 2, cost=`, m3 - m);
        try {
            // console.log('=========== ', fragments.length);

            let pointsMap = toPointMap(fragments);

            let latest;
            const polygons = [];
            // const stack = [];
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

                const connected:TPoint[] = [];
                const allConnectedPoints = new Set<string>();
                latest = initial[1];

                const stack: TStackItem[] = [{
                    depth: 0,
                    latest: latest,
                    connectedKeys: allConnectedPoints,
                    connectedPoints: connected
                }];

                // const m2 = new Date().getTime();
                const [arr, isCircle] = search(stack, removePoint(initial, pointsMap));
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

            const res = PolygonsUtils.simplify(polygons, 0.2);
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
            }) as TPoint[][];

            const _polygons = new Polygons();
            ret.forEach((line) => {
                const polygon = new Polygon();
                polygon.path = line;
                _polygons.add(polygon);
            });
            const tree = _polygons.getPolygonssByPolyTree2();
            const marged = tree.map((t) => {
                return t.data.map((polygon) => {
                    return polygon.path;
                });
            });
            observer.next(marged);
        } catch (error) {
            const m4 = new Date().getTime();
            console.error(`[${actionID}] worker error, time=`, m4 - m3, error);
            observer.error(error);
        } finally {
            observer.complete();
        }
        // return polygons;
    });
};

export default sortUnorderedLine;
