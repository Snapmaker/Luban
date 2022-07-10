import { Box3 } from 'three';
import { Line } from '../../shared/lib/math/Line';
import { Vector2 } from '../../shared/lib/math/Vector2';

type TPoint = { x: number, y: number, z?: number }

type TEdgeItem = {
    yMax: number,
    yMin: number,
    points: [TPoint, TPoint]
}

const generateEdgeTable = (points: TPoint[], angle: number, center: TPoint) => {
    const edgeTable: TEdgeItem[] = [];
    const boundingBox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    for (let index = 0; index < points.length; index += 2) {
        if (!points[index + 1]) {
            continue;
        }

        if (angle !== 0) {
            points[index] = Vector2.rotate(points[index], angle, center);
            points[index + 1] = Vector2.rotate(points[index + 1], angle, center);
        }

        const yMax = Math.max(points[index].y, points[index + 1].y);
        const yMin = Math.min(points[index].y, points[index + 1].y);

        if (yMax === yMin) {
            continue;
        }

        edgeTable.push({
            yMax,
            yMin,
            points: [
                points[index],
                points[index + 1]
            ]
        });
        boundingBox.maxY = Math.max(boundingBox.maxY, yMax);
        boundingBox.minY = Math.min(boundingBox.minY, yMin);
        boundingBox.maxX = Math.max(boundingBox.maxX, points[index].x, points[index + 1].x);
        boundingBox.minX = Math.min(boundingBox.minX, points[index].x, points[index + 1].x);
    }
    return { edgeTable, boundingBox };
};

const generateLine = (points: TPoint[], step: number, angle: number, boundingBox: Box3, clippingHeight: number, offset = 0) => {
    if (points.length === 0) {
        return [];
    }
    const centerX = (boundingBox.max.x + boundingBox.min.x) / 2;
    const centerY = (boundingBox.max.y + boundingBox.min.y) / 2;

    const { edgeTable, boundingBox: newBoundingBox } = generateEdgeTable(points, angle, {
        x: centerX, y: centerY
    });


    let startMin = centerY;
    if (offset) {
        startMin -= clippingHeight * offset;
    }
    while (startMin - step >= newBoundingBox.minY) {
        startMin -= step;
    }

    const rays: { y: number, points: [TPoint, TPoint] }[] = [];
    while (startMin <= newBoundingBox.maxY) {
        rays.push({
            y: startMin + 0.001,
            points: [
                { x: newBoundingBox.minX - 10, y: startMin + 0.001 },
                { x: newBoundingBox.maxX + 10, y: startMin + 0.001 }
            ]
        });
        startMin += step;
    }

    const intersectionMap = new Map<number, TPoint[]>();
    for (let i = 0; i < edgeTable.length; i++) {
        const item = edgeTable[i];
        for (let j = 0; j < rays.length; j++) {
            const ray = rays[j];
            if (item.yMax >= ray.y && item.yMin <= ray.y) {
                const intersectionPoint = Line.intersectionPoint(...ray.points, ...item.points);
                if (intersectionPoint) {
                    const value = intersectionMap.get(ray.y);
                    if (value) {
                        value.push(intersectionPoint);
                    } else {
                        intersectionMap.set(ray.y, [intersectionPoint]);
                    }
                }
            }
        }
    }

    const ret: TPoint[][] = [];
    intersectionMap.forEach((item) => {
        ret.push(item.map((point) => {
            if (angle === 0) {
                return point;
            }
            return Vector2.rotate(point, -angle, { x: centerX, y: centerY });
        }));
    });

    return ret.map((item) => {
        return item.sort((a, b) => {
            return a.x - b.x;
        });
    }).reduce((p, c) => {
        p.push(...c);
        return p;
    }, []);
};

export default generateLine;
