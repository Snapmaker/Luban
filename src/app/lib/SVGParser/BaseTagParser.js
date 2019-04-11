import { dist2, vertexMiddle, xformPoint } from './Utils';


class BaseTagParser {
    constructor(tol) {
        this.tol = tol; // tolerance
    }

    initialize(attributes = {}) {
        this.attributes = attributes;

        this.points = [];

        this.paths = [];
    }

    moveTo(x, y) {
        if (this.points.length > 0) {
            this.points[this.points.length - 1] = [x, y];
        } else {
            this.points.push([x, y]);
        }
    }

    lineTo(x, y) {
        if (this.points.length > 0) {
            this.points.push([x, y]);
        }
    }

    cubicBezTo(x1, y1, x2, y2, x3, y3, x4, y4, level) {
        // for details see:
        // http://www.antigrain.com/research/adaptive_bezier/index.html
        // based on DeCasteljau Algorithm
        // The reason we use a subdivision algo over an incremental one
        // is we want to have control over the deviation to the curve.
        // This mean we subdivide more and have more curve points in
        // curvy areas and less in flatter areas of the curve.
        if (level > 18) {
            // protect from deep recursion cases
            // max 2**18 = 262144 segments
            return;
        }

        // Calculate all the mid-points of the line segments
        const x12 = (x1 + x2) / 2.0;
        const y12 = (y1 + y2) / 2.0;
        const x23 = (x2 + x3) / 2.0;
        const y23 = (y2 + y3) / 2.0;
        const x34 = (x3 + x4) / 2.0;
        const y34 = (y3 + y4) / 2.0;
        const x123 = (x12 + x23) / 2.0;
        const y123 = (y12 + y23) / 2.0;
        const x234 = (x23 + x34) / 2.0;
        const y234 = (y23 + y34) / 2.0;
        const x1234 = (x123 + x234) / 2.0;
        const y1234 = (y123 + y234) / 2.0;

        // Try to approximate the full cubic curve by a single straight line
        const dx = x4 - x1;
        const dy = y4 - y1;

        const d2 = Math.abs(((x2 - x4) * dy - (y2 - y4) * dx));
        const d3 = Math.abs(((x3 - x4) * dy - (y3 - y4) * dx));

        if (Math.pow(d2 + d3, 2) < 5.0 * this.tol * this.tol * (dx * dx + dy * dy)) {
            // added factor of 5.0 to match circle resolution
            this.lineTo(x1234, y1234);
            return;
        }

        // Continue subdivision
        this.cubicBezTo(x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1);
        this.cubicBezTo(x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1);
    }

    quadBezTo(x1, y1, x2, y2, x3, y3, level) {
        // https://github.com/tmpvar/svgmill/blob/master/SVGReader.js#L925
        if (level > 18) {
            // protect from deep recursion cases
            // max 2**18 = 262144 segments
            return;
        }

        // Calculate all the mid-points of the line segments
        let x12 = (x1 + x2) / 2.0;
        let y12 = (y1 + y2) / 2.0;
        let x23 = (x2 + x3) / 2.0;
        let y23 = (y2 + y3) / 2.0;
        let x123 = (x12 + x23) / 2.0;
        let y123 = (y12 + y23) / 2.0;

        let dx = x3 - x1;
        let dy = y3 - y1;
        let d = Math.abs(((x2 - x3) * dy - (y2 - y3) * dx));

        if (d * d <= 5.0 * this.tol * this.tol * (dx * dx + dy * dy)) {
            // added factor of 5.0 to match circle resolution
            this.lineTo(x123, y123);
            return;
        }

        // Continue subdivision
        this.quadBezTo(x1, y1, x12, y12, x123, y123, level + 1);
        this.quadBezTo(x123, y123, x23, y23, x3, y3, level + 1);
    }

    arcTo(x1, y1, rx, ry, phi, large, sweep, x2, y2) {
        // http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
        // https://github.com/tmpvar/svgmill/blob/master/SVGReader.js#L956
        const cosAngle = Math.cos(phi);
        const sinAngle = Math.sin(phi);

        const dx = x1 - x2;
        const dy = y1 - y2;

        // 1) compute x1', y1'
        const x1p = cosAngle * dx / 2 + sinAngle * dy / 2;
        const y1p = -sinAngle * dx / 2 + cosAngle * dy / 2;
        const d = Math.pow(x1p / rx, 2) + Math.pow(y1p / ry, 2);
        if (d > 1) {
            rx *= Math.sqrt(d);
            ry *= Math.sqrt(d);
        }

        // 2) compute cx', cy'
        let s = 0;
        const sa = (Math.pow(rx * ry, 2) - Math.pow(rx * y1p, 2) - Math.pow(ry * x1p, 2));
        const sb = (Math.pow(rx * y1p, 2) + Math.pow(ry * x1p, 2));
        if (sb > 0) {
            s = Math.sqrt(sa / sb);
        }
        if (large === sweep) {
            s = -s;
        }
        const cxp = s * rx * y1p / ry;
        const cyp = -s * ry * x1p / rx;

        // 3) compute cx, cy from cx', cy'
        const cx = cosAngle * cxp - sinAngle * cyp + 0.5 * (x1 + x2);
        const cy = sinAngle * cxp + cosAngle * cyp + 0.5 * (y1 + y2);

        // 4) calculate theta1, and delta theta
        function vecrat(ux, uy, vx, vy) {
            return (ux * vx + uy * vy) /
                Math.sqrt(Math.pow(ux, 2) + Math.pow(uy, 2)) *
                Math.sqrt(Math.pow(vx, 2) + Math.pow(vy, 2));
        }

        function vecang(ux, uy, vx, vy) {
            const a = Math.acos(vecrat(ux, uy, vx, vy));
            return (ux * vy > vx * uy ? 1 : -1) * a;
        }

        const ux = (x1p - cxp) / rx;
        const uy = (y1p - cyp) / ry;
        const vx = (-x1p - cxp) / rx;
        const vy = (-y1p - cyp) / ry;

        const a1 = vecang(1, 0, ux, uy); // initial angle
        let da = vecang(ux, uy, vx, vy); // delta angle

        if (sweep && da < 0) {
            da += Math.PI * 2;
        }
        if (!sweep && da > 0) {
            da -= Math.PI * 2;
        }

        // 5) recursive add vertices
        function getVertex(pct) {
            const theta = a1 + da * pct;
            const cosTheta = Math.cos(theta);
            const sinTheta = Math.sin(theta);
            return [
                cosAngle * rx * cosTheta - sinAngle * ry * sinTheta + cx,
                sinAngle * rx * cosTheta + cosAngle * ry * sinTheta + cy
            ];
        }

        // let the recursive fun begin
        const recursiveArc = (t1, t2, c1, c5, level) => {
            if (level > 18) {
                // protect from deep recursion cases
                // max 2**18 = 262144 segments
                return;
            }
            const tRange = t2 - t1;
            const tHalf = t1 + 0.5 * tRange;
            const c2 = getVertex(t1 + 0.25 * tRange);
            const c3 = getVertex(tHalf);
            const c4 = getVertex(t1 + 0.75 * tRange);

            if (dist2(c2, vertexMiddle(c1, c3)) > this.tol * this.tol) {
                recursiveArc(t1, tHalf, c1, c3, level + 1);
            }

            this.lineTo(c3[0], c3[1]);

            if (dist2(c4, vertexMiddle(c3, c5)) > this.tol * this.tol) {
                recursiveArc(tHalf, t2, c3, c5, level + 1);
            }
        };

        let t1Init = 0.0;
        let t2Init = 1.0;
        let c1Init = getVertex(t1Init);
        let c5Init = getVertex(t2Init);
        recursiveArc(t1Init, t2Init, c1Init, c5Init, 0);
        this.lineTo(c5Init[0], c5Init[1]);
    }

    commitPath(closed = false) {
        if (this.points.length > 0) {
            this.addPath(closed);
            this.points = [];
        }
        this.closed = false;
    }

    addPath(closed) {
        if (this.points.length < 2) {
            return;
        }

        const firstPoint = this.points[0];
        const lastPoint = this.points[this.points.length - 1];

        // Path correction
        if (closed && (lastPoint[0] !== firstPoint[0] || lastPoint[1] !== firstPoint[1])) {
          this.lineTo(firstPoint[0], firstPoint[1]);
        } else if (!closed && lastPoint[0] === firstPoint[0] && lastPoint[1] === firstPoint[1]) {
          closed = true;
        }

        const path = {
            closed: closed,
            points: this.points
        };

        // transform
        for (let i = 0, l = this.points.length; i < l; i++) {
            xformPoint(this.attributes.xform, path.points[i]);
        }

        this.paths.push(path);
    }

    createShape() {
        // calculate bounding box for shape
        const boundingBox = {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity
        };

        for (const path of this.paths) {
            for (const point of path.points) {
                boundingBox.minX = Math.min(boundingBox.minX, point[0]);
                boundingBox.maxX = Math.max(boundingBox.maxX, point[0]);
                boundingBox.minY = Math.min(boundingBox.minY, point[1]);
                boundingBox.maxY = Math.max(boundingBox.maxY, point[1]);
            }
        }

        return {
            fill: this.attributes.fill,
            stroke: this.attributes.stroke,
            strokeWidth: this.attributes.strokeWidth,
            visibility: this.attributes.visibility,
            boundingBox: boundingBox,
            paths: this.paths
        };
    }

    // interface
    parse(node, attributes) { }
}

export default BaseTagParser;
