import { Vector3 } from '../../../shared/lib/math/Vector3';

export class AABB3D {
    min;

    max;

    length;

    include(p) {
        if (!this.min) {
            this.min = {
                x: p.x,
                y: p.y,
                z: p.z
            };
        }
        if (!this.max) {
            this.max = {
                x: p.x,
                y: p.y,
                z: p.z
            };
        }
        this.min.x = Math.min(this.min.x, p.x);
        this.min.y = Math.min(this.min.y, p.y);
        this.min.z = Math.min(this.min.z, p.z);

        this.max.x = Math.max(this.max.x, p.x);
        this.max.y = Math.max(this.max.y, p.y);
        this.max.z = Math.max(this.max.z, p.z);

        this.length = this.length || {};
        this.length.x = this.max.x - this.min.x;
        this.length.y = this.max.y - this.min.y;
        this.length.z = this.max.z - this.min.z;
    }

    offset(offset) {
        this.min = Vector3.add(this.min, offset);
        this.max = Vector3.add(this.max, offset);
    }

    resize(offset) {
        this.min = Vector3.mul(this.min, offset);
        this.max = Vector3.mul(this.max, offset);
        this.length = Vector3.mul(this.length, offset);
    }

    rotate(angle) {
        const min = Vector3.rotateY(this.min, angle);
        const max = Vector3.rotateY(this.max, angle);
        this.min.x = Math.min(min.x, max.x);
        this.min.y = Math.min(min.y, max.y);
        this.min.z = Math.min(min.z, max.z);

        this.max.x = Math.max(min.x, max.x);
        this.max.y = Math.max(min.y, max.y);
        this.max.z = Math.max(min.z, max.z);

        this.length.x = this.max.x - this.min.x;
        this.length.y = this.max.y - this.min.y;
        this.length.z = this.max.z - this.min.z;
    }

    alterCoordinateSystem() {
        if (this.min.x > this.max.x) {
            const x = this.min.x;
            this.min.x = this.max.x;
            this.max.x = x;
        }
        if (this.min.y > this.max.y) {
            const y = this.min.y;
            this.min.y = this.max.y;
            this.max.y = y;
        }
        if (this.min.z > this.max.z) {
            const z = this.min.z;
            this.min.z = this.max.z;
            this.max.z = z;
        }
        this.length.x = Math.abs(this.length.x);
        this.length.y = Math.abs(this.length.y);
        this.length.z = Math.abs(this.length.z);
    }
}
