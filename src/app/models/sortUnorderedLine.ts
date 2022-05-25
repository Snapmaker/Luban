import { Map as ImmutableMap, List } from 'immutable';

type TPoint = { x: number, y: number, z?: number }

type ITraceLine = [TPoint, TPoint]

type ITraceLineItem = ImmutableMap<string, ITraceLine>

type IPoinsMap = ImmutableMap<string, ITraceLineItem>

const toPointHash = (point: TPoint) => {
    return `${point.x},${point.y};`;
};

const toPointMap = (data: TPoint[]): IPoinsMap => {
    let pointMap = ImmutableMap<string, ITraceLineItem>();
    for (let index = 0; index < data.length; index += 2) {
        if (!data[index + 1]) {
            break;
        }
        const key1 = toPointHash(data[index]);
        const key2 = toPointHash(data[index + 1]);

        if (pointMap.has(key1)) {
            pointMap = pointMap.updateIn([key1], (v) => {
                const value = v as ITraceLineItem;
                return value.set(`${key1}${key2}`, [
                    data[index], data[index + 1]
                ]);
            });
        } else {
            let m = ImmutableMap<string, ITraceLine>();
            m = m.set(`${key1}${key2}`, [
                data[index], data[index + 1]
            ]);
            pointMap = pointMap.set(key1, m);
        }
        if (pointMap.has(key2)) {
            pointMap = pointMap.updateIn([key2], (v) => {
                const value = v as ITraceLineItem;
                return value.set(`${key1}${key2}`, [
                    data[index], data[index + 1]
                ]);
            });
        } else {
            let m = ImmutableMap<string, ITraceLine>();
            m = m.set(`${key1}${key2}`, [
                data[index], data[index + 1]
            ]);
            pointMap = pointMap.set(key2, m);
        }
    }
    return pointMap;
};

const removePoint = (traceLine: ITraceLine, _pointsMap: IPoinsMap) => {
    const key1 = toPointHash(traceLine[0]);
    const key2 = toPointHash(traceLine[1]);

    let temp = _pointsMap;
    if (temp.has(key1)) {
        temp = temp.deleteIn([key1, `${key1}${key2}`]);
        temp = temp.deleteIn([key1, `${key2}${key1}`]);
        if (temp.get(key1).size === 0) {
            temp = temp.delete(key1);
        }
    }
    if (temp.has(key2)) {
        temp = temp.deleteIn([key2, `${key1}${key2}`]);
        temp = temp.deleteIn([key2, `${key2}${key1}`]);
        if (temp.get(key2).size === 0) {
            temp = temp.delete(key2);
        }
    }
    return temp;
};

const search = (latest: TPoint, currentConnectedPoints: List<TPoint>, currentConnectedKeys: List<string>, _pointsMap: IPoinsMap): [List<TPoint>, boolean] => {
    const pointKey = toPointHash(latest);
    // console.log(currentConnectedKeys.toString(), ' => ', pointKey);

    const linesMap = _pointsMap.get(pointKey);
    if (linesMap) {
        let max = List<TPoint>();
        let isCircle = false;

        linesMap.forEach((line) => {
            const epKey = toPointHash(line[1]);
            const spKey = toPointHash(line[0]);

            if (epKey === pointKey) {
                if (currentConnectedKeys.includes(spKey)) {
                    const index = currentConnectedKeys.findIndex(i => i === spKey);
                    if (max.size < currentConnectedKeys.size - index - 1) {
                        max = currentConnectedPoints.push(currentConnectedPoints.first());
                        isCircle = true;
                    }
                } else {
                    const [res, _isCircle] = search(
                        line[0],
                        currentConnectedPoints.push(line[0]),
                        currentConnectedKeys.push(spKey),
                        removePoint(line, _pointsMap)
                    );
                    if (res && max.size < res.size) {
                        max = res;
                        isCircle = _isCircle;
                    }
                }
            } else if (spKey === pointKey) {
                if (currentConnectedKeys.includes(epKey)) {
                    const index = currentConnectedKeys.findIndex(i => i === epKey);
                    if (max.size < currentConnectedKeys.size - index - 1) {
                        max = currentConnectedPoints.push(currentConnectedPoints.first());
                        isCircle = true;
                    }
                } else {
                    const [res, _isCircle] = search(
                        line[1],
                        currentConnectedPoints.push(line[1]),
                        currentConnectedKeys.push(spKey),
                        removePoint(line, _pointsMap)
                    );
                    if (res && max.size < res.size) {
                        max = res;
                        isCircle = _isCircle;
                    }
                }
            }
        });

        return [max, isCircle];
    } else {
        return [currentConnectedPoints, false];
    }
};

const sortUnorderedLine = (fragments: TPoint[]) => {
    // console.log('=========== ', fragments.length);

    // const m = new Date().getTime();
    let pointsMap = toPointMap(fragments);
    // console.log('-- 1', new Date().getTime() - m);

    let latest;
    const polygons = [];

    while (pointsMap.size) {
        const traceLines = pointsMap.first();
        const initial = traceLines.first();

        const connected = [
            initial[0], initial[1]
        ];
        const allConnectedPoints = [
            toPointHash(initial[0]),
            toPointHash(initial[1])
        ];
        latest = initial[1];
        // const m2 = new Date().getTime();
        const [polygon, isCircle] = search(latest, List(connected), List(allConnectedPoints), removePoint(initial, pointsMap));
        // console.log('-- 2', new Date().getTime() - m2);

        if (isCircle) {
            polygons.push(polygon.toJS());
        }

        for (let index = 0; index < polygon.size; index++) {
            const start = polygon.get(index);
            const end = polygon.get(index + 1);
            if (end) {
                pointsMap = removePoint([start, end], pointsMap);
            }
        }
    }

    return polygons;
};

export default sortUnorderedLine;
