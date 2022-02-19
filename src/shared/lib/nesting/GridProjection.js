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

    addTriangle(points) {
        points = points.map(v => {
            return {
                x: (v.x - this.min.x) / this.interval,
                y: (v.y - this.min.y) / this.interval
            };
        });

        const startX = Math.floor(this.getMin(points[0].x, points[1].x, points[2].x));
        const endX = Math.ceil(this.getMax(points[0].x, points[1].x, points[2].x));

        const startY = Math.floor(this.getMin(points[0].y, points[1].y, points[2].y));
        const endY = Math.ceil(this.getMax(points[0].y, points[1].y, points[2].y));

        const direction = [[0, 0], [0, 1], [-1, 0], [1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

        for (let i = startX; i <= endX; i++) {
            for (let j = startY; j <= endY; j++) {
                if (this.isPointInPoints(i, j, points)) {
                    for (let k = 0; k < direction.length; k++) {
                        this.setData(i + direction[k][0], j + direction[k][1], 1);
                    }
                }
            }
        }
    }

    markOutlinePoint() {
        const direction = [[0, 1], [-1, 0], [1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

        for (let i = 0; i < this.data.length; i++) {
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
        return outlinePolygons;
    }

    getOutlinePolygon() {
        const direction = [[0, 1], [-1, 0], [1, 0], [0, -1]];
        const froms = [-1];
        const polygon = [];
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
                k = i;
                break;
            }
            if (k === -1) {
                this.data[polygon[index - 1].x][polygon[index - 1].y] = 0;
                index--;
            } else {
                froms[index] = 3 - k;
                polygon[index] = {
                    x: i1,
                    y: j1
                };
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
}

export default GridProjection;
