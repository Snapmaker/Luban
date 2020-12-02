import ToolPath from './index';
import { round } from '../../../shared/lib/utils';

class XToBToolPath extends ToolPath {
    constructor(options = {}) {
        super(options);

        this.circle = 0;
    }

    move0X(x, f) {
        if (this.isRotate) {
            super.move0B(this.toCircleB(x), f);
        } else {
            super.move0X(x, f);
        }
    }

    move0XY(x, y, f) {
        if (this.isRotate) {
            super.move0BY(this.toCircleB(x), y, f);
        } else {
            super.move0XY(x, y, f);
        }
    }

    move1X(x, f) {
        if (this.isRotate) {
            super.move1B(this.toCircleB(x), f);
        } else {
            super.move1X(x, f);
        }
    }

    move1XY(x, y, f) {
        if (this.isRotate) {
            super.move1BY(this.toCircleB(x), y, f);
        } else {
            super.move1XY(x, y, f);
        }
    }

    move1XZ(x, z, f) {
        if (this.isRotate) {
            super.move1BZ(this.toCircleB(x), z, f);
        } else {
            super.move1XZ(x, z, f);
        }
    }

    move1XYZ(x, y, z, f) {
        if (this.isRotate) {
            super.move1BYZ(this.toCircleB(x), y, z, f);
        } else {
            super.move1XYZ(x, y, z, f);
        }
    }

    setCircle(circle) {
        this.circle = circle;
    }

    toB(x) {
        return this.toCircleB(x, 0);
    }

    toCircleB(x, circle = this.circle) {
        const b = x / this.diameter / Math.PI * 360 + circle * 360;
        return round(b, 2);
    }

    safeStart(x, y, stopHeight, safetyHeight, jogSpeed) {
        this.commands.push({ G: 90 });
        this.commands.push({ G: 0, Z: stopHeight, F: jogSpeed });
        this.move0XY(x, y, jogSpeed);
        this.commands.push({ G: 0, Z: safetyHeight, F: jogSpeed });
    }
}

export default XToBToolPath;
