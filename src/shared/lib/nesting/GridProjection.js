import { isEqual } from '../utils';
import { PolygonsUtils } from '../math/PolygonsUtils';
import { Vector2 } from '../math/Vector2';
import { polyOffset, recursivePolyUnion } from '../clipper/cLipper-adapter';
import * as ClipperLib from '../clipper/clipper';

class GridProjection {
    data = [];

    min;

    max;

    interval = 1;

    constructor(options) {
        const {
            interval,
            min = {
                x: 0,
                y: 0
            },
            max = {
                x: 0,
                y: 0
            }
        } = options;
        this.interval = interval;
        this.min = {
            x: Math.floor(min.x),
            y: Math.floor(min.y)
        };
        this.max = {
            x: Math.ceil(max.x),
            y: Math.ceil(max.y)
        };
    }

    isPointInPoints(x, y, points) {
        let inside = false;
        for (let i = 0; i < 3; i++) {
            const p = points[i];
            const q = points[(i + 1) % 3];

            if ((p.y > y) !== (q.y > y) && x < p.x + (q.x - p.x) * (y - p.y) / (q.y - p.y)) {
                inside = !inside;
            }
        }
        return inside;
    }

    setData(i, j, value) {
        if (i < 0 || j < 0) {
            return;
        }
        if (!this.data[i]) {
            this.data[i] = [];
        }
        this.data[i][j] = value;
    }

    getMax(v1, v2, v3) {
        return Math.max(Math.max(v1, v2), v3);
    }

    getMin(v1, v2, v3) {
        return Math.min(Math.min(v1, v2), v3);
    }

    getYByX(p1, p2, x) {
        if (isEqual(p1.x, p2.x)) {
            return null;
        }
        return (-(p2.x * p1.y - p1.x * p2.y) - (p2.y - p1.y) * x) / (p1.x - p2.x);
    }

    getXByY(p1, p2, y) {
        if (isEqual(p1.x, p2.x)) {
            return null;
        }
        return (-(p2.x * p1.y - p1.x * p2.y) - (p1.x - p2.x) * y) / (p2.y - p1.y);
    }

    addTriangle(points) {
        points = points.map(v => {
            return {
                x: (v.x - this.min.x) / this.interval,
                y: (v.y - this.min.y) / this.interval
            };
        });

        const startX = Math.floor(this.getMin(points[0].x, points[1].x, points[2].x));

        const yRangeByX = [];

        const setYRangeByX = (x, y) => {
            const xs = [Math.floor(x) - startX, Math.ceil(x) - startX];
            const fy = Math.floor(y);
            const cy = Math.ceil(y);

            for (const x1 of xs) {
                if (yRangeByX[x1] === undefined) {
                    yRangeByX[x1] = [fy, cy];
                }
                yRangeByX[x1][0] = Math.min(yRangeByX[x1][0], fy);
                yRangeByX[x1][1] = Math.max(yRangeByX[x1][1], cy);
            }
        };

        const setLineRangeWithPoint = (p1, p2) => {
            const dx = Math.abs(p1.x - p2.x);
            const dy = Math.abs(p1.y - p2.y);

            if (dx > dy) {
                const lStartX = Math.ceil(Math.min(p1.x, p2.x));
                const lEndX = Math.floor(Math.max(p1.x, p2.x));

                for (let i = lStartX; i <= lEndX; i++) {
                    const y = this.getYByX(p1, p2, i);
                    setYRangeByX(i, y);
                }
            } else {
                const lStartY = Math.ceil(Math.min(p1.y, p2.y));
                const lEndY = Math.floor(Math.max(p1.y, p2.y));

                for (let j = lStartY; j < lEndY; j++) {
                    const x = this.getXByY(p1, p2, j);
                    setYRangeByX(x, j);
                }
            }
        };

        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            setYRangeByX(p1.x, p1.y);
            setLineRangeWithPoint(p1, p2);
        }

        const direction = [[0, 0], [0, 1], [-1, 0], [1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

        for (let i = 0; i < yRangeByX.length; i++) {
            const x = i + startX;
            const startY = yRangeByX[i][0];
            const endY = yRangeByX[i][1];
            for (let j = startY; j <= endY; j++) {
                for (let k = 0; k < direction.length; k++) {
                    this.setData(x + direction[k][0], j + direction[k][1], 1);
                }
            }
        }
    }

    markOutlinePoint() {
        const direction = [[0, 1], [-1, 0], [1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

        for (let i = 0; i < this.data.length; i++) {
            if (!this.data[i]) {
                this.data[i] = [];
            }
            for (let j = 0; j < this.data[i].length; j++) {
                if (!this.data[i][j]) {
                    continue;
                }
                let isOutline = false;
                for (let k = 0; k < 8; k++) {
                    const i1 = i + direction[k][0];
                    const j1 = j + direction[k][1];
                    if (!this.data[i1] || !this.data[i1][j1]) {
                        isOutline = true;
                    }
                }
                if (isOutline) {
                    this.data[i][j] = 2;
                }
            }
        }
    }

    getOutlinePolygons() {
        this.markOutlinePoint();

        const outlinePolygons = [];
        while (true) {
            const outlinePolygon = this.getOutlinePolygon();
            if (outlinePolygon.length === 0) {
                break;
            }
            outlinePolygons.push(outlinePolygon);
        }

        if (outlinePolygons.length === 1) {
            return outlinePolygons;
        }

        const polyTree = PolygonsUtils.getPolygonssByPolyTree(outlinePolygons);

        return this.connectedPolyTree(polyTree);
    }

    getOutlinePolygon() {
        const direction = [[0, 1], [-1, 0], [1, 0], [0, -1]];
        const froms = [-1];
        const polygon = [];
        const polygonSet = new Set();
        const getKey = (a, b) => {
            return a * 1000000 + b;
        };
        let index = 0;
        for (let i = 0; i < this.data.length; i++) {
            for (let j = 0; j < this.data[i].length; j++) {
                if (this.data[i][j] === 2) {
                    polygon[index] = {
                        x: i,
                        y: j
                    };
                    froms[index] = -1;
                    index++;
                    break;
                }
            }
            if (polygon.length > 0) {
                break;
            }
        }
        if (polygon.length === 0) {
            return polygon;
        }
        while (true) {
            if (index === 0) {
                break;
            }

            let k = -1;
            let i1 = 0;
            let j1 = 0;
            for (let i = 0; i < 4; i++) {
                if (i === froms[index - 1]) {
                    continue;
                }
                i1 = polygon[index - 1].x + direction[i][0];
                j1 = polygon[index - 1].y + direction[i][1];
                if (!this.data[i1] || !this.data[i1][j1] || this.data[i1][j1] !== 2) {
                    continue;
                }
                if (polygonSet.has(getKey(i1, j1))) {
                    continue;
                }
                k = i;
                break;
            }
            if (k === -1) {
                this.data[polygon[index - 1].x][polygon[index - 1].y] = 0;
                polygonSet.delete(getKey(polygon[index - 1].x, polygon[index - 1].y));
                index--;
            } else {
                froms[index] = 3 - k;
                polygon[index] = {
                    x: i1,
                    y: j1
                };
                polygonSet.add(getKey(i1, j1));
                index++;

                if (polygon[index - 1].x === polygon[0].x && polygon[index - 1].y === polygon[0].y) {
                    break;
                }
            }
        }

        const resPolygon = [];
        for (let i = 0; i < index; i++) {
            this.data[polygon[i].x][polygon[i].y] = 0;
            if (froms[i] === froms[i - 1]) {
                resPolygon[resPolygon.length - 1] = polygon[i];
            } else {
                resPolygon.push(polygon[i]);
            }
        }

        return resPolygon
            .map(v => {
                return {
                    x: v.x * this.interval + this.min.x,
                    y: v.y * this.interval + this.min.y
                };
            });
    }

    connectedPolyTree(polyTree) {
        if (polyTree.length === 1) {
            return polyTree[0];
        }
        const res = [...polyTree];
        for (let i = 1; i < polyTree.length; i++) {
            const line = this.getPolygonsDistanceLine(polyTree[0], polyTree[i]);
            const linePolygons = polyOffset([line], this.interval / 2, ClipperLib.JoinType.jtSquare, ClipperLib.EndType.etOpenSquare);
            res.push(linePolygons);
        }
        return recursivePolyUnion(res);
        // let s = '[';
        // for (let i = 0; i < resUnion.length; i++) {
        //     s += '[';
        //     for (let j = 0; j < resUnion[i].length; j++) {
        //         s += `${resUnion[i][j].x},${resUnion[i][j].y}`;
        //         if (j !== resUnion[i].length - 1) {
        //             s += ',';
        //         }
        //     }
        //     s += '],';
        // }
        // s += '[]]';
        // console.log('recursivePolyUnion', s, res, resUnion);
    }

    getPolygonsDistanceLine(polygons1, polygons2) {
        const line = [polygons1[0][0], polygons2[0][0]];
        let len2 = Vector2.length2(polygons1[0][0], polygons2[0][0]);
        PolygonsUtils.forEachPoint(polygons1, (p1) => {
            PolygonsUtils.forEachPoint(polygons2, (p2) => {
                const nLen2 = Vector2.length2(p1, p2);
                if (nLen2 < len2) {
                    len2 = nLen2;
                    line[0] = p1;
                    line[1] = p2;
                }
            });
        });
        return line;
    }
}

export default GridProjection;
