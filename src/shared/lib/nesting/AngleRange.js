export default class AngleRange {
    start;

    end;

    constructor(start, end) {
        this.start = this.normalize(start);
        this.end = this.normalize(end);
    }

    normalize(angle) {
        while (angle < 0) {
            angle += 360;
        }
        while (angle >= 360) {
            angle -= 360;
        }
        return angle;
    }

    getRange() {
        return this.normalize(this.end - this.start);
    }

    between(angle) {
        if (this.getRange() >= 180) {
            return false;
        }
        angle = this.normalize(angle);
        if (this.start <= this.end) {
            return angle >= this.start && angle <= this.end;
        } else {
            return angle >= this.start || angle <= this.end;
        }
    }
}
