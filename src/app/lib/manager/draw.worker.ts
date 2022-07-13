import { expose } from 'threads/worker';

import { cloneDeep } from 'lodash';
import svgPath from 'svgpath';
import { Transfer } from 'threads';
import { ATTACH_SPACE } from '../../ui/SVGEditor/svg-content/DrawGroup/constants';

type TCoordinate = [number, number];

type TData = {
    transform?: string;
    path: string;
    scale: number;
};

const generatePath = (points: TCoordinate[]) => {
    const length = points.length;
    switch (length) {
        case 2:
            return `M ${points[0].join(' ')} L ${points[1].join(' ')} Z`;
        case 3:
            return `M ${points[0].join(' ')} Q ${points[1].join(' ')}, ${points[2].join(' ')}`;
        case 4:
            return `M ${points[0].join(' ')} C ${points[1].join(' ')}, ${points[2].join(' ')}, ${points[3].join(' ')}`;
        default:
            return '';
    }
};

const manualEndOffset = 0.0000001;

const getCoordinatehash = (points: TCoordinate) => {
    return points[0] * 100000 + points[1] * 1000000;
};

const drawManager = () => {
    const pointsMap = new Map<number, {
        fragmentIDS: [id: string, index: number][],
        coordinate: TCoordinate
    }>();

    let allPoints = [];

    let startFlag = false;
    let stop = false;

    let scale = 0;
    let attachSpace = 0;


    const updateScale = (num) => {
        scale = num;
        attachSpace = ATTACH_SPACE / scale;
    };

    const initPath = (data: TData) => {
        updateScale(data.scale);
        pointsMap.clear();
        allPoints = [];

        let svgpath;
        let startPoint;

        let str = '';
        let pointsElemStr = '';
        let fragmentID = 0;

        if (data.transform) {
            svgpath = svgPath(data.path).transform(data.transform);
        } else {
            svgpath = svgPath(data.path);
        }
        svgpath.abs().unarc().unshort().round(5)
            .iterate((segment, _, x, y) => {
                let arr = cloneDeep(segment) as unknown as number[];
                const mark = arr.shift().toString();
                if (mark.toUpperCase() !== 'M') {
                    if (mark === 'H') {
                        arr.push(y);
                    } else if (mark === 'V') {
                        arr.unshift(x);
                    } else if (mark.toUpperCase() === 'Z') {
                        arr = startPoint;
                    }
                    const points: TCoordinate[] = [];
                    for (let index = 0; index < arr.length; index += 2) {
                        points.push([
                            Number(arr[index]),
                            Number(arr[index + 1])
                        ]);
                    }
                    const pathPoints = [
                        [x, y],
                        ...points
                    ] as TCoordinate[];
                    const start = pathPoints[0];
                    const last = pathPoints[pathPoints.length - 1];
                    const startHash = getCoordinatehash(start);
                    const lastHash = getCoordinatehash(last);
                    if (startHash === lastHash) {
                        return;
                    }
                    const id = `${fragmentID}`;
                    if (!pointsMap.has(startHash)) {
                        pointsMap.set(startHash, {
                            fragmentIDS: [
                                [id, 0]
                            ],
                            coordinate: start
                        });
                    } else {
                        pointsMap.get(startHash).fragmentIDS.push([
                            id, 0
                        ]);
                    }
                    if (!pointsMap.has(lastHash)) {
                        pointsMap.set(lastHash, {
                            fragmentIDS: [
                                [id, 1]
                            ],
                            coordinate: last
                        });
                    } else {
                        pointsMap.get(lastHash).fragmentIDS.push([
                            id, 1
                        ]);
                    }
                    allPoints.push(pathPoints);
                    str += `<g fragmentid="${fragmentID}">
                        <path vector-effect="non-scaling-stroke" stroke="black" stroke-width="1" d="${generatePath(pathPoints)}"></path>
                        <path vector-effect="non-scaling-stroke" stroke="transparent" stroke-width="5" d="${generatePath(pathPoints)}" data-preselect="1"></path>
                    </g>`;

                    fragmentID++;
                } else {
                    startPoint = arr;
                }
            });

        for (const [, item] of pointsMap.entries()) {
            const coordinate = item.coordinate;
            const fragmentAttr = item.fragmentIDS.reduce((p, c) => {
                p += ` data-${c[0]}="${c[1]}"`;
                return p;
            }, '');
            pointsElemStr += `<g class="end-point" ${fragmentAttr} type="end-point" cx="${coordinate[0]}" cy="${coordinate[1]}" pointer-events="all" stroke-opacity="1"><path d="M ${coordinate[0]} ${coordinate[1]} l 0.0001 0" stroke="#1890ff" stroke-linecap="round" stroke-width="12" vector-effect="non-scaling-stroke"/><path d="M ${coordinate[0]} ${coordinate[1]} l 0.0001 0" stroke="#fff" stroke-linecap="round" stroke-width="10" vector-effect="non-scaling-stroke"  /></g>`;
        }

        return {
            points: Transfer(allPoints as unknown as ArrayBuffer),
            d: str,
            pointsElemStr
        };
    };

    const findNearestPoint = (x: number, y: number) => {
        if (startFlag) {
            stop = true;
        }
        stop = false;
        startFlag = true;
        let nearest = attachSpace;

        const nearestPoint = {
            coordinate: [],
            fragmentIDS: []
        };
        for (const [, item] of pointsMap.entries()) {
            if (stop) {
                break;
            }
            const coordinate = item.coordinate;
            const space = Math.sqrt((coordinate[0] - x) ** 2 + (coordinate[1] - y) ** 2);

            if (space < nearest) {
                if (Math.abs(space - nearest) <= manualEndOffset * 2) {
                    if (nearestPoint.coordinate[0] - coordinate[0] > 0) {
                        nearestPoint.coordinate = coordinate;
                        nearestPoint.fragmentIDS = item.fragmentIDS;
                    }
                    nearest = space;
                } else {
                    nearest = space;
                    nearestPoint.coordinate = coordinate;
                    nearestPoint.fragmentIDS = item.fragmentIDS;
                }
            }
        }
        startFlag = false;
        return { nearestPoint, nearest };
    };

    const updateEndPoint = (
        origin: {
            fragmentIDS: [id: string, index: number][],
            coordinate: TCoordinate
        },
        x: number,
        y: number
    ) => {
        pointsMap.delete(getCoordinatehash(origin.coordinate));

        const key = getCoordinatehash([x, y]);
        if (pointsMap.has(key)) {
            const overlapPoint = pointsMap.get(key);
            const overlapFragmentId = overlapPoint.fragmentIDS.findIndex((id) => {
                return origin.fragmentIDS.includes(id);
            });
            let deletedPoint: [id: string, index: number][];
            if (overlapFragmentId !== -1) {
                deletedPoint = origin.fragmentIDS.splice(overlapFragmentId, 1);
            }
            if (!deletedPoint) {
                return;
            }
            const offsetX = x + manualEndOffset;
            const offsetY = y + manualEndOffset;
            pointsMap.set(
                getCoordinatehash([offsetX, offsetY]),
                {
                    coordinate: [offsetX, offsetY],
                    fragmentIDS: [
                        deletedPoint[0]
                    ]
                }
            );
        } else {
            pointsMap.set(key, {
                coordinate: [x, y],
                fragmentIDS: origin.fragmentIDS
            });
        }
    };

    return {
        findNearestPoint,
        updateEndPoint,
        initPath,
        updateScale
    };
};

expose(drawManager());
