import { Vector3 } from '../math/Vector3';

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
}
