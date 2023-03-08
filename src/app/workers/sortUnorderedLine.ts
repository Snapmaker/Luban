import { Observable } from 'rxjs';
import { Transfer, TransferDescriptor } from 'threads';

import { polyOffset } from '../../shared/lib/clipper/cLipper-adapter';
import { Polygon, Polygons } from '../../shared/lib/clipper/Polygons';
import { PolygonsUtils } from '../../shared/lib/math/PolygonsUtils';
import { bufferToPoint, expandBuffer, pointToBuffer } from '../lib/buffer-utils';
import log from '../lib/log';

type TPoint = { x: number, y: number, z?: number }
export type TPolygon = ArrayBuffer[]

export type TMessage = {
    fragments: TransferDescriptor<ArrayBuffer>,
    layerHeight: number,
    innerWallCount: number,
    lineWidth: number
}

export type IResult = {
    outWall: TransferDescriptor<TPolygon[]>,
    innerWall: TransferDescriptor<TPolygon[][]>,
    time: number
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
    for (const [key, value] of pointsMap) {
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
};

const cleanStack = (stack: TPointValue[], ringIndex: number) => {
    return stack.filter((value) => {
        return !value.rings.includes(ringIndex);
    });
};

const sortUnorderedLine = ({ fragments, innerWallCount, lineWidth, layerHeight }: TMessage) => {
    const points = bufferToPoint(fragments.send);
    let pointsMap = toPointMap(points);
    fragments = null;
    const findChain: string[] = [];
    let stack: TPointValue[] = [];
    let rings: TPointValue[][] = [];
    let polygons = [];
    let res, ret, polygon, _polygons, tree;

    return new Observable<IResult>((observer) => {
        try {
            while (findStart(pointsMap) || stack.length) {
                if (stack.length === 0) {
                    const startKey = findStart(pointsMap);
                    const start = pointsMap.get(startKey);
                    stack.push(start);
                }

                const current = stack.pop();
                if (current.findingIndex !== null && findChain.length > 0
                    && current.key !== findChain[findChain.length - 1]) {
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
                observer.next();
                return;
            }

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
            res = PolygonsUtils.simplify(polygons, 0.2);
            ret = res.map((vectors) => {
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

            _polygons = new Polygons();
            ret.forEach((line) => {
                polygon = new Polygon();
                polygon.path = line;
                _polygons.add(polygon);
            });
            tree = _polygons.getUnDirectionPolygonssTree();
            let marged = tree.map((t) => {
                return t.data.map((item) => {
                    return item.path;
                });
            });

            let innerWall = Array(innerWallCount).fill('').map((_, index) => {
                return marged.map((item) => {
                    return polyOffset(item, -lineWidth * (index + 1)).map((k) => {
                        return pointToBuffer(k);
                    });
                });
            });

            marged = marged.map((t) => {
                return t.map((item) => {
                    return pointToBuffer(item);
                });
            });
            const n3 = new Date().getTime();

            observer.next({
                outWall: Transfer(marged, expandBuffer(marged)),
                innerWall: Transfer(innerWall, expandBuffer(innerWall)),
                time: n3
            });
            marged = null;
            innerWall = null;
        } catch (error) {
            log.error('layerHeight=', layerHeight, 'error=', error);
            observer.complete();
        } finally {
            pointsMap = null;
            rings = null;
            polygons = null;
            res = null;
            ret = null;
            _polygons = null;
            tree = null;
            observer.complete();
        }
    });
};

export default sortUnorderedLine;
