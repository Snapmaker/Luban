export class CutAngle {
    constructor(start, end) {
        if (start === undefined || end === undefined) {
            return;
        }

        this._init(start, end);
    }

    _init(start, end) {
        this.start = start;
        this.end = end;
        this.lap = start <= end ? 0 : 1;
    }

    start = null;

    end = null;

    lap = 0;

    isRound = false;

    _checkIsRound() {
        this.isRound = this.angleLength() >= 360;
        if (this.isRound) {
            this.start = 0;
            this.end = 360;
            this.lap = 0;
        }
    }

    getNormal() {
        return ((this.end + this.lap * 360 + this.start) / 2) % 360;
    }

    angleLength() {
        return this.end + this.lap * 360 - this.start;
    }

    isOverlap(cutAngle) {
        if (this.lap === 1 && cutAngle.lap === 1) {
            return true;
        } else if (this.lap === 0 && cutAngle.lap === 0) {
            return (this.end - this.start) + (cutAngle.end - cutAngle.start)
                >= Math.max(this.end - cutAngle.start, cutAngle.end - this.start);
        } else if (this.lap === 1 && cutAngle.lap === 0) {
            return this.start <= cutAngle.end || this.end >= cutAngle.start;
        } else {
            return cutAngle.start <= this.end || cutAngle.end >= this.start;
        }
    }

    add(cutAngle) {
        if (this.isRound) {
            return;
        }

        if (this.start === null || this.end === null) {
            this._init(cutAngle.start, cutAngle.end);
            return;
        }


        if (this.lap === cutAngle.lap) {
            this.start = Math.min(this.start, cutAngle.start);
            this.end = Math.max(this.end, cutAngle.end);
        } else if (this.lap === 1 && cutAngle.lap === 0) {
            if (cutAngle.start <= this.end) {
                this.end = Math.max(cutAngle.end, this.end);
            } else if (cutAngle.end >= this.start) {
                this.start = Math.min(cutAngle.start, this.start);
            } else {
                throw new Error('this is not overlap');
            }
        } else if (this.lap === 0 && cutAngle.lap === 1) {
            if (this.start <= cutAngle.end) {
                this.start = cutAngle.start;
                this.end = Math.max(this.end, cutAngle.end);
            } else if (this.end >= cutAngle.start) {
                this.end = cutAngle.end;
                this.start = Math.min(this.start, cutAngle.start);
            } else {
                throw new Error('this is not overlap');
            }
            this.lap = 1;
        }
        this._checkIsRound();
    }

    offset(offset) {
        this.start += offset.left;
        this.end -= offset.right;

        if (this.end < 0) {
            this.end += 360;
            this.lap = 0;
        }
        if (this.start > 360) {
            this.start -= 360;
            this.lap = 0;
        }
    }
}

export class CutAngles {
    cutAngles = [];

    _sort() {
        this.cutAngles.sort((a, b) => {
            if (a.start > b.start) {
                return 1;
            } else if (a.start < b.start) {
                return -1;
            } else {
                if (a.end > b.end) {
                    return 1;
                } else if (a.end < b.end) {
                    return -1;
                } else {
                    return 0;
                }
            }
        });
    }

    _merge() {
        if (this.cutAngles.length <= 1) {
            return;
        }

        let isMerge = false;
        let count = 0;

        while (count === 0 || isMerge) {
            count++;
            isMerge = false;
            for (let i = 0; i < this.cutAngles.length; i++) {
                for (let j = i + 1; j < this.cutAngles.length; j++) {
                    const an1 = this.cutAngles[i];
                    const an2 = this.cutAngles[j];
                    if (an1.isOverlap(an2)) {
                        an1.add(an2);
                        this.cutAngles.splice(j, 1);
                        isMerge = true;
                    }
                }
            }
        }

        // let start = 0;
        // while (start < this.cutAngles.length - 1) {
        //     const an1 = this.cutAngles[start];
        //     const an2 = this.cutAngles[start + 1];
        //
        //     if (an1.isOverlap(an2)) {
        //         an1.add(an2);
        //         this.cutAngles.splice(start + 1, 1);
        //     } else {
        //         start++;
        //     }
        // }
    }

    size() {
        return this.cutAngles.length;
    }

    get(index) {
        return this.cutAngles[index];
    }

    add(cutAngle) {
        this.cutAngles.push(cutAngle);
        this._merge();
        this._sort();
    }

    not() {
        const res = new CutAngles();
        if (this.cutAngles.length === 0) {
            res.add(new CutAngle(0, 360));
        } else {
            for (let i = 0; i < this.cutAngles.length; i++) {
                const a1 = this.cutAngles[i];
                const a2 = this.cutAngles[(i + 1) % this.cutAngles.length];
                res.add(new CutAngle(a1.end, a2.start));
            }
        }

        this.cutAngles = res.cutAngles;
    }

    offset(offset) {
        for (const cutAngle of this.cutAngles) {
            cutAngle.offset(offset);
        }
    }

    removeLessThanAngle(angle) {
        let i = 0;
        while (i < this.cutAngles.length) {
            if (this.cutAngles[i].angleLength() < angle) {
                this.cutAngles.splice(i, 1);
            } else {
                i++;
            }
        }
    }
}
