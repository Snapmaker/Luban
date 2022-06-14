import { Observable } from 'rxjs';
import { Box3 } from 'three';
import { polyOffset } from '../../shared/lib/clipper/cLipper-adapter';
import { Polygon, Polygons } from '../../shared/lib/clipper/Polygons';
import { PolygonsUtils } from '../../shared/lib/math/PolygonsUtils';
// import { PolygonsUtils } from '../../shared/lib/math/PolygonsUtils';

type TPoint = { x: number, y: number, z?: number }

type TMessage = {
    fragments: TPoint[],
    layerHeight: number,
    innerWallCount: number,
    lineWidth: number,
    bottomLayers: number,
    topLayers: number,
    modelBoundingBox: Box3
}

type TPointValue = {
    key: string;
    pt: TPoint,
    children: string[]
    visited?: boolean;
    rings: number[],
    findingIndex: number
}

type IPointsMap = Map<string, TPointValue>

const toPointHash = (point: TPoint) => {
    return `${point.x},${point.y};`;
};

const toPointMap = (data: TPoint[]): IPointsMap => {
    const pointMap = new Map<string, TPointValue>();
    for (let index = 0; index < data.length; index += 2) {
        if (!data[index + 1]) {
            break;
        }
        const key1 = toPointHash(data[index]);
        const key2 = toPointHash(data[index + 1]);

        if (pointMap.has(key1)) {
            pointMap.get(key1).children.push(key2);
        } else {
            pointMap.set(key1, {
                children: [key2], rings: [], key: key1, findingIndex: null, pt: data[index]
            });
        }
        if (pointMap.has(key2)) {
            pointMap.get(key2).children.push(key1);
        } else {
            pointMap.set(key2, {
                children: [key1], rings: [], key: key2, findingIndex: null, pt: data[index + 1]
            });
        }
    }
    return pointMap;
};

const findStart = (pointsMap: IPointsMap) => {
    let start: string;
    for (const [key, value] of pointsMap.entries()) {
        if (value.rings.length === 0) {
            start = key;
            break;
        }
    }
    return start;
};

const findChildren = (pointsMap: IPointsMap, current: TPointValue, findChain: string[]): TPointValue[] => {
    const childrenKeys = current.children;
    const arr = [];
    for (let i = 0; i < childrenKeys.length; i++) {
        const key = childrenKeys[i];
        const item = pointsMap.get(key);
        if (item && item.key !== current.key && item.key !== findChain[findChain.length - 2] && (
            item.rings.length === 0
            || item.children.find((child) => {
                return pointsMap.get(child) && pointsMap.get(child)?.rings.length === 0;
            })
        )) {
            arr.push(item);
        }
    }
    return arr;
    // return childrenKeys.map((key) => {
    //     return pointsMap.get(key);
    // }).filter((item) => item && item.key !== current.key && item.key !== findChain[findChain.length - 2]);
};

const cleanStack = (stack: TPointValue[], ringIndex: number) => {
    return stack.filter((value) => {
        return !value.rings.includes(ringIndex);
    });
};

const sortUnorderedLine = ({ fragments, layerHeight, innerWallCount, lineWidth, }: TMessage) => {
    return new Observable((observer) => {
        // console.log(`[${actionID}] worker exec 2, cost=`, m3 - m);
        try {
            const pointsMap = toPointMap(fragments);
            const findChain: string[] = [];
            let stack: TPointValue[] = [];
            const rings: TPointValue[][] = [];

            while (findStart(pointsMap) || stack.length) {
                if (stack.length === 0) {
                    const startKey = findStart(pointsMap);
                    const start = pointsMap.get(startKey);
                    // start.findingIndex = 0
                    // findChain.push(startKey)
                    stack.push(start);
                }
                // console.log(findChain);

                const current = stack.pop();
                // console.log(current.key);

                if (current.findingIndex !== null && findChain.length > 0 && current.key !== findChain[findChain.length - 1]) {
                    const ringIndex = rings.length;
                    let ringLength = findChain.length - current.findingIndex;
                    if (ringLength > 2) {
                        const arr = [];
                        while (ringLength--) {
                            const _key = findChain.pop();
                            const pt = pointsMap.get(_key);
                            if (pt) {
                                pt.findingIndex = null;
                                pt.rings.push(ringIndex);
                                arr.push(pt);
                            }
                        }
                        arr.push(arr[0]);
                        rings.push(arr);
                        stack = cleanStack(stack, ringIndex);
                    }
                    continue;
                } else {
                    current.findingIndex = findChain.length;
                    findChain.push(current.key);
                }


                const children = findChildren(pointsMap, current, findChain);
                if (children.length) {
                    stack.push(current, ...children);
                } else {
                    findChain.pop();
                    pointsMap.delete(current.key);
                }
            }
            if (rings.length === 0) {
                observer.next([]);
                return;
            }
            const polygons = [];
            for (let j = 0; j < rings.length; j++) {
                const arr = [];
                for (let i = 0; i < rings[j].length; i++) {
                    const start = rings[j][i];
                    const end = rings[j][i + 1];
                    if (end) {
                        arr.push(start.pt);
                        arr.push(end.pt);
                    }
                }
                polygons.push(arr);
            }

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

            const innerWall = Array(innerWallCount).fill('').map((_, index) => {
                return marged.map((polygon) => {
                    return polyOffset(polygon, -lineWidth * (index + 1));
                });
            });

            observer.next({
                outWall: marged,
                innerWall
            });
            // console.log(JSON.stringify(paths));
        } catch (error) {
            console.error('layerHeight=', layerHeight, 'error=', error);
            observer.next([]);
            // observer.error(error);
        } finally {
            observer.complete();
        }
    });
};

export default sortUnorderedLine;
