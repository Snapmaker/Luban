import BaseTagParser from './BaseTagParser';


class PathTagParser extends BaseTagParser {
    initialize(attributes = {}) {
        super.initialize(attributes);

        this.d = attributes.d || [];
        this.dIndex = 0;

        this.cpx = 0;
        this.cpy = 0;
        this.cpx2 = 0;
        this.cpy2 = 0;

        this.closed = false;
    }

    getNextItem() {
        if (this.dIndex < this.d.length) {
            return this.d[this.dIndex++];
        }
        return null;
    }

    checkNextIsNum(n = 1) {
        if (this.dIndex + n > this.d.length) {
            return false;
        }

        for (let i = 0; i < n; i++) {
            if (typeof this.d[this.dIndex + i] !== 'number') {
                return false;
            }
        }

        return true;
    }

    pathMoveTo(x, y, relative) {
        if (relative) {
            this.cpx += x;
            this.cpy += y;
        } else {
            this.cpx = x;
            this.cpy = y;
        }
        this.moveTo(this.cpx, this.cpy);
        this.cpx2 = this.cpx;
        this.cpy2 = this.cpy;
    }

    pathLineTo(x, y, relative) {
        if (relative) {
            this.cpx += x;
            this.cpy += y;
        } else {
            this.cpx = x;
            this.cpy = y;
        }
        this.lineTo(this.cpx, this.cpy);
        this.cpx2 = this.cpx;
        this.cpy2 = this.cpy;
    }

    pathHLineTo(x, relative) {
        if (relative) {
            this.cpx += x;
        } else {
            this.cpx = x;
        }
        this.lineTo(this.cpx, this.cpy);
        this.cpx2 = this.cpx;
        this.cpy2 = this.cpy;
    }

    pathVLineTo(y, relative) {
        if (relative) {
            this.cpy += y;
        } else {
            this.cpy = y;
        }
        this.lineTo(this.cpx, this.cpy);
        this.cpx2 = this.cpx;
        this.cpy2 = this.cpy;
    }

    pathCubicBezTo(x1, y1, x2, y2, x, y, relative) {
        if (relative) {
            x1 += this.cpx;
            y1 += this.cpy;
            x2 += this.cpx;
            y2 += this.cpy;
            x += this.cpx;
            y += this.cpy;
        }
        this.cubicBezTo(this.cpx, this.cpy, x1, y1, x2, y2, x, y, 0);
        this.lineTo(x, y);
        this.cpx = x;
        this.cpy = y;
        this.cpx2 = x2;
        this.cpy2 = y2;
    }

    pathCubicBezShortTo(x2, y2, x, y, relative) {
        if (relative) {
            x2 += this.cpx;
            y2 += this.cpy;
            x += this.cpx;
            y += this.cpy;
        }
        const x1 = this.cpx * 2 - this.cpx2;
        const y1 = this.cpy * 2 - this.cpy2;
        this.cubicBezTo(this.cpx, this.cpy, x1, y1, x2, y2, x, y, 0);
        this.lineTo(x, y);
        this.cpx = x;
        this.cpy = y;
        this.cpx2 = x2;
        this.cpy2 = y2;
    }

    // Quadratic Bézier Curve
    pathQuadBezTo(x1, y1, x, y, relative) {
        if (relative) {
            x1 += this.cpx;
            y1 += this.cpy;
            x += this.cpx;
            y += this.cpy;
        }
        this.quadBezTo(this.cpx, this.cpy, x1, y1, x, y, 0);
        this.lineTo(x, y);
        this.cpx = x;
        this.cpy = y;
        this.cpx2 = x1;
        this.cpy2 = y1;
    }

    // Quadratic Bézier Curve
    pathQuadBezShortTo(x, y, relative) {
        if (relative) {
            x += this.cpx;
            y += this.cpy;
        }
        const x1 = this.cpx * 2 - this.cpx2;
        const y1 = this.cpy * 2 - this.cpy2;
        this.quadBezTo(this.cpx, this.cpy, x1, y1, x, y, 0);
        this.lineTo(x, y);
        this.cpx = x;
        this.cpy = y;
        this.cpx2 = x1;
        this.cpy2 = y1;
    }

    /**
     * Elliptical Arc Curve
     *
     * @param rx
     * @param ry
     * @param angle
     * @param large
     * @param sweep
     * @param x
     * @param y
     * @param relative
     */
    pathArcTo(rx, ry, angle, large, sweep, x, y, relative) {
        if (relative) {
            x += this.cpx;
            y += this.cpy;
        }
        this.arcTo(this.cpx, this.cpy, rx, ry, angle, large, sweep, x, y);
        this.cpx = x;
        this.cpy = y;
        this.cpx2 = this.cpx;
        this.cpy2 = this.cpy;
    }

    parse(node, attributes) {
        this.initialize(attributes);

        while (true) {
            const cmd = this.getNextItem();
            if (!cmd) {
                break;
            }

            if (cmd === 'M' || cmd === 'm') {
                this.commitPath(this.closed);

                this.pathMoveTo(this.getNextItem(), this.getNextItem(), cmd === 'm');

                while (this.checkNextIsNum(2)) {
                    this.pathLineTo(this.getNextItem(), this.getNextItem(), cmd === 'm');
                }
            } else if (cmd === 'L' || cmd === 'l') {
                while (this.checkNextIsNum(2)) {
                    this.pathLineTo(this.getNextItem(), this.getNextItem(), cmd === 'l');
                }
            } else if (cmd === 'H' || cmd === 'h') {
                while (this.checkNextIsNum()) {
                    this.pathHLineTo(this.getNextItem(), cmd === 'h');
                }
            } else if (cmd === 'V' || cmd === 'v') {
                while (this.checkNextIsNum()) {
                    this.pathVLineTo(this.getNextItem(), cmd === 'v');
                }
            } else if (cmd === 'C' || cmd === 'c') {
                while (this.checkNextIsNum(6)) {
                    this.pathCubicBezTo(
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        cmd === 'c'
                    );
                }
            } else if (cmd === 'S' || cmd === 's') {
                while (this.checkNextIsNum(4)) {
                    this.pathCubicBezShortTo(
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        cmd === 's'
                    );
                }
            } else if (cmd === 'Q' || cmd === 'q') {
                while (this.checkNextIsNum(4)) {
                    this.pathQuadBezTo(
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        cmd === 'q'
                    );
                }
            } else if (cmd === 'T' || cmd === 't') {
                while (this.checkNextIsNum(2)) {
                    this.pathQuadBezShortTo(
                        this.getNextItem(),
                        this.getNextItem(),
                        cmd === 't'
                    );
                }
            } else if (cmd === 'A' || cmd === 'a') {
                while (this.checkNextIsNum(7)) {
                    this.pathArcTo(
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        this.getNextItem(),
                        cmd === 'a'
                    );
                }
            } else if (cmd === 'Z' || cmd === 'z') {
                this.closed = true;
                if (this.points.length > 0) {
                    this.cpx = this.points[0][0];
                    this.cpy = this.points[0][1];
                    this.commitPath(this.closed);

                    this.moveTo(this.cpx, this.cpy);
                }
            }
        }

        this.commitPath(this.closed);

        return this.createShape();
    }
}

export default PathTagParser;
