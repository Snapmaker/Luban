/* eslint-disable */
import _ from 'lodash';

export const PathReader = function (_tolerance2) {
    let tolerance2 = _tolerance2;

    // TODO: refactor
    function vertexDistanceSquared(v1, v2) {
        return Math.pow(v2[0]-v1[0], 2) + Math.pow(v2[1]-v1[1], 2);
    }

    // TODO: refactor
    function vertexMiddle(v1, v2) {
        return [ (v2[0]+v1[0])/2.0, (v2[1]+v1[1])/2.0 ];
    }

    function addCubicBezier(subpath, x1, y1, x2, y2, x3, y3, x4, y4, level) {
        // http://www.antigrain.com/research/adaptive_bezier/index.html
        // https://github.com/tmpvar/svgmill/blob/master/SVGReader.js#L877

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
            return
        }

        // Calculate all the mid-points of the line segments
        let x12   = (x1 + x2) / 2.0;
        let y12   = (y1 + y2) / 2.0;
        let x23   = (x2 + x3) / 2.0;
        let y23   = (y2 + y3) / 2.0;
        let x34   = (x3 + x4) / 2.0;
        let y34   = (y3 + y4) / 2.0;
        let x123  = (x12 + x23) / 2.0;
        let y123  = (y12 + y23) / 2.0;
        let x234  = (x23 + x34) / 2.0;
        let y234  = (y23 + y34) / 2.0;
        let x1234 = (x123 + x234) / 2.0;
        let y1234 = (y123 + y234) / 2.0;

        // Try to approximate the full cubic curve by a single straight line
        let dx = x4 - x1;
        let dy = y4 - y1;

        let d2 = Math.abs(((x2 - x4) * dy - (y2 - y4) * dx));
        let d3 = Math.abs(((x3 - x4) * dy - (y3 - y4) * dx));

        if ( Math.pow(d2+d3, 2) < 5.0 * tolerance2 * (dx*dx + dy*dy) ) {
            // added factor of 5.0 to match circle resolution
            subpath.push([x1234, y1234]);
            return
        }

        // Continue subdivision
        addCubicBezier(subpath, x1, y1, x12, y12, x123, y123, x1234, y1234, level+1, tolerance2);
        addCubicBezier(subpath, x1234, y1234, x234, y234, x34, y34, x4, y4, level+1, tolerance2);
    }
    function addQuadraticBezier(subpath, x1, y1, x2, y2, x3, y3, level) {
        // https://github.com/tmpvar/svgmill/blob/master/SVGReader.js#L925
        if (level > 18) {
            // protect from deep recursion cases
            // max 2**18 = 262144 segments
            return
        }

        // Calculate all the mid-points of the line segments
        let x12   = (x1 + x2) / 2.0;
        let y12   = (y1 + y2) / 2.0;
        let x23   = (x2 + x3) / 2.0;
        let y23   = (y2 + y3) / 2.0;
        let x123  = (x12 + x23) / 2.0;
        let y123  = (y12 + y23) / 2.0;

        let dx = x3-x1;
        let dy = y3-y1;
        let d = Math.abs(((x2 - x3) * dy - (y2 - y3) * dx));

        if ( d * d <= 5.0 * tolerance2 * (dx * dx + dy * dy) ) {
            // added factor of 5.0 to match circle resolution
            subpath.push([x123, y123]);
            return
        }

        // Continue subdivision
        addQuadraticBezier(subpath, x1, y1, x12, y12, x123, y123, level + 1);
        addQuadraticBezier(subpath, x123, y123, x23, y23, x3, y3, level + 1);
    }
    function addArc(subpath, x1, y1, rx, ry, phi, large_arc, sweep, x2, y2) {
        // http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
        // https://github.com/tmpvar/svgmill/blob/master/SVGReader.js#L956
        // TODO: understand more about this code
        let cp = Math.cos(phi);
        let sp = Math.sin(phi);
        let dx = 0.5 * (x1 - x2);
        let dy = 0.5 * (y1 - y2);
        let x_ = cp * dx + sp * dy;
        let y_ = -sp * dx + cp * dy;
        let r2 = (Math.pow(rx * ry, 2) - Math.pow(rx * y_, 2) - Math.pow(ry * x_, 2)) /
            (Math.pow(rx * y_, 2) + Math.pow(ry * x_, 2));
        if (r2 < 0) {
            r2 = 0;
        }
        let r = Math.sqrt(r2);
        if (large_arc === sweep) { r = -r; }
        let cx_ = r * rx * y_ / ry;
        let cy_ = -r * ry * x_ / rx;
        let cx = cp * cx_ - sp * cy_ + 0.5 * (x1 + x2);
        let cy = sp * cx_ + cp * cy_ + 0.5 * (y1 + y2);

        function angle(u, v) {
            let a = Math.acos((u[0] * v[0] + u[1] * v[1]) /
                Math.sqrt((Math.pow(u[0], 2) + Math.pow(u[1], 2)) *
                    (Math.pow(v[0], 2) + Math.pow(v[1], 2))));
            let sgn = -1;
            if (u[0] * v[1] > u[1] * v[0]) { sgn = 1; }
            return sgn * a;
        }

        let psi = angle([1, 0], [(x_ - cx_)/rx, (y_ - cy_) / ry]);
        let delta = angle([(x_ - cx_) / rx, (y_ - cy_) / ry], [(-x_ - cx_) / rx, (-y_ - cy_) / ry]);
        if (sweep && delta < 0) { delta += Math.PI * 2; }
        if (!sweep && delta > 0) { delta -= Math.PI * 2; }

        function getVertex(pct) {
            let theta = psi + delta * pct;
            let ct = Math.cos(theta);
            let st = Math.sin(theta);
            return [cp * rx * ct - sp * ry * st + cx, sp * rx * ct + cp * ry * st + cy];
        }

        // let the recursive fun begin
        //
        function recursiveArc(t1, t2, c1, c5, level) {
            if (level > 18) {
                // protect from deep recursion cases
                // max 2**18 = 262144 segments
                return
            }
            let tRange = t2-t1;
            let tHalf = t1 + 0.5*tRange;
            let c2 = getVertex(t1 + 0.25*tRange);
            let c3 = getVertex(tHalf);
            let c4 = getVertex(t1 + 0.75*tRange);
            if (vertexDistanceSquared(c2, vertexMiddle(c1,c3)) > tolerance2) {
                recursiveArc(t1, tHalf, c1, c3, level+1);
            }
            subpath.push(c3);
            if (vertexDistanceSquared(c4, vertexMiddle(c3,c5)) > tolerance2) {
                recursiveArc(tHalf, t2, c3, c5, level+1);
            }
        }

        let t1Init = 0.0;
        let t2Init = 1.0;
        let c1Init = getVertex(t1Init);
        let c5Init = getVertex(t2Init);
        subpath.push(c1Init);
        recursiveArc(t1Init, t2Init, c1Init, c5Init, 0);
        subpath.push(c5Init);

    }
    function addPath(d, node) {
        // Convert svg path data to normalized polylines
        // d is the path data as a list of elements
        // http://www.w3.org/TR/SVG11/paths.html#PathData
        let idx = 0;
        let x = 0;
        let y = 0;
        let cmdPrev = '';
        let xPrevCp = 0;
        let yPrevCp = 0;
        let subpath = [];
        function getNext() {
            let i = idx;
            idx += 1;
            if (d && i < d.length) {
                return d[i];
            } else {
                return null;
            }
        }
        function nextIsNum(howmany) {
            for (let i = 0; i < howmany; ++i) {
                if (idx + i >= d.length || typeof d[idx +i] !== 'number') {
                    return false;
                }
            }
            return true;
        }

        while (true) {
            let cmd = getNext();
            if (!cmd) {
                break;
            }
            if (cmd === 'M') {
                // moveto absolute
                if (subpath.length > 0) {
                    node['paths'].push(subpath);
                    subpath = [];
                }
                while (nextIsNum(2)) {
                    x = getNext();
                    y = getNext();
                    subpath.push([x, y]);
                }
            } else if (cmd === 'm') {
                if (subpath.length > 0) {
                    node['paths'].push(subpath);
                    subpath = [];
                }
                if (cmdPrev === '') {
                    // first treated absolute
                    x = getNext();
                    y = getNext();
                    subpath.push([x, y]);
                }
                while (nextIsNum(2)) {
                    x += getNext();
                    y += getNext();
                    subpath.push([x, y]);
                }
            } else if (cmd === 'Z' || cmd === 'z') {
                if (subpath.length > 0) {
                    x = subpath[0][0];
                    y = subpath[0][1];
                    subpath.push([x, y]);

                    node['paths'].push(subpath);
                    subpath = [];
                }
            } else if (cmd === 'L') {
                while (nextIsNum(2)) {
                    x = getNext();
                    y = getNext();
                    subpath.push([x, y]);
                }
            } else if (cmd === 'l') {
                while (nextIsNum(2)) {
                    x += getNext();
                    y += getNext();
                    subpath.push([x, y]);
                }
            } else if (cmd === 'H') {
                while (nextIsNum(1)) {
                    x = getNext();
                    subpath.push([x, y]);
                }
            } else if (cmd === 'h') {
                while (nextIsNum(1)) {
                    x += getNext();
                    subpath.push([x, y]);
                }
            } else if (cmd === 'V') {
                while (nextIsNum(1)) {
                    y = getNext();
                    subpath.push([x, y]);
                }
            } else if (cmd === 'v') {
                while (nextIsNum(1)) {
                    y += getNext();
                    subpath.push([x, y]);
                }
            } else if (cmd === 'C') {
                while (nextIsNum(6)) {
                    let x2 = getNext();
                    let y2 = getNext();
                    let x3 = getNext();
                    let y3 = getNext();
                    let x4 = getNext();
                    let y4 = getNext();
                    subpath.push([x, y]);
                    addCubicBezier(subpath, x, y, x2, y2, x3, y3, x4, y4, 0);
                    subpath.push([x4, y4]);
                    x = x4;
                    y = y4;
                    xPrevCp = x3;
                    yPrevCp = y3;
                }
            } else if (cmd === 'c') {
                while (nextIsNum(6)) {
                    let x2 = x + getNext();
                    let y2 = y + getNext();
                    let x3 = x + getNext();
                    let y3 = y + getNext();
                    let x4 = x + getNext();
                    let y4 = y + getNext();

                    subpath.push([x, y]);
                    addCubicBezier(subpath, x, y, x2, y2, x3, y3, x4, y4, 0);
                    subpath.push([x4, y4]);
                    x = x4;
                    y = y4;
                    xPrevCp = x3;
                    yPrevCp = y3;
                }
            } else if (cmd === 'S') {
                while (nextIsNum(4)) {
                    let x2 = null;
                    let y2 = null;
                    if (_.includes('CcSs', cmdPrev)) {
                        x2 = x - (xPrevCp - x);
                        y2 = y - (yPrevCp - y);
                    } else {
                        x2 = x;
                        y2 = y;
                    }

                    let x3 = getNext();
                    let y3 = getNext();
                    let x4 = getNext();
                    let y4 = getNext();
                    subpath.push([x, y]);
                    addCubicBezier(subpath, x, y, x2, y2, x3, y3, x4, y4, 0);
                    subpath.push([x4, y4]);
                    x = x4;
                    y = y4;
                    xPrevCp = x3;
                    yPrevCp = y3;
                }
            } else if (cmd === 's') {
                while (nextIsNum(4)) {
                    let x2 = null;
                    let y2 = null;

                    if (_.includes('CsSs', cmdPrev)) {
                        x2 = x - (xPrevCp - x);
                        y2 = y - (yPrevCp - y);
                    } else {
                        x2 = x;
                        y2 = y;
                    }

                    let x3 = x + getNext();
                    let y3 = y + getNext();
                    let x4 = x + getNext();
                    let y4 = y + getNext();
                    subpath.push([x, y]);
                    addCubicBezier(subpath, x, y, x2, y2, x3, y3, x4, y4, 0);
                    subpath.push([x4, y4]);
                    x = x4;
                    y = y4;
                    xPrevCp = x3;
                    yPrevCp = y3;
                }
            } else if (cmd === 'Q') {
                while (nextIsNum(4)) {
                    let x2 = getNext();
                    let y2 = getNext();
                    let x3 = getNext();
                    let y3 = getNext();
                    subpath.push([x, y]);
                    addQuadraticBezier(subpath, x, y, x2, y2, x3, y3, 0);
                    subpath.push([x3, y3]);
                    x = x3;
                    y = y3;

                    // TODO: toconfirm
                    xPrevCp = x2;
                    yPrevCp = y2;
                }
            } else if (cmd === 'q') {
                while (nextIsNum(4)) {
                    let x2 = x + getNext();
                    let y2 = y + getNext();
                    let x3 = x + getNext();
                    let y3 = y + getNext();
                    subpath.push([x, y]);
                    addQuadraticBezier(subpath, x, y, x2, y2, x3, y3);
                    subpath.push([x3, y3]);
                    x = x3;
                    y = y3;

                    // TODO: toconfirm
                    xPrevCp = x2;
                    yPrevCp = y2;
                }
            } else if (cmd === 'T') {
                while (nextIsNum(2)) {
                    let x2 = null;
                    let y2 = null;
                    if (_.includes('QqTt', cmdPrev)) {
                        x2 = x - (xPrevCp - x);
                        y2 = y - (yPrevCp - y);
                    } else {
                        x2 = x;
                        y2 = y;
                    }
                    let x3 = getNext();
                    let y3 = getNext();

                    subpath.push([x, y]);
                    addQuadraticBezier(subpath, x, y, x2, y2, x3, y3, 0);
                    subpath.push([x3, y3]);
                    x = x3;
                    y = y3;
                    xPrevCp = x2;
                    yPrevCp = y2;
                }
            } else if (cmd === 't') {
                while (nextIsNum(2)) {
                    let x2 = null;
                    let y2 = null;
                    if (_.includes('QqTt', cmdPrev)) {
                        x2 = x - (xPrevCp - x);
                        y2 = y - (yPrevCp - y);
                    } else {
                        x2 = x;
                        y2 = y;
                    }

                    let x3 = x + getNext();
                    let y3 = y + getNext();
                    subpath.push([x, y]);
                    addQuadraticBezier(subpath, x, y, x2, y2, x3, y3, 0);
                    subpath.push([x3, y3]);
                    x = x3;
                    y = y3;
                    xPrevCp = x2;
                    yPrevCp = y2;
                }
            } else if (cmd === 'A') {
                while (nextIsNum(7)) {
                    let rx = getNext();
                    let ry = getNext();
                    let xrot = getNext();
                    let large = getNext();
                    let sweep = getNext();
                    let x2 = getNext();
                    let y2 = getNext();
                    addArc(subpath, x, y, rx, ry, xrot, large, sweep, x2, y2);
                    x = x2;
                    y = y2;
                }
            } else if (cmd === 'a') {
                while (nextIsNum(7)) {
                    let rx = getNext();
                    let ry = getNext();
                    let xrot = getNext();
                    let large = getNext();
                    let sweep = getNext();
                    let x2 = getNext();
                    let y2 = getNext();
                    addArc(subpath, x, y, rx, ry, xrot, large, sweep, x2, y2);
                    x = x2;
                    y = y2;
                }
            }

            cmdPrev = cmd;
        }

        if (subpath.length > 0) {
            node['paths'].push(subpath);
            subpath = [];
        }
    }
    return {
        addPath: addPath
    }
};