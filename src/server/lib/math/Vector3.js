export class Vector3 {
    static ZERO = {
        x: 0, y: 0, z: 0
    };

    constructor(v) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
    }

    static isZero(v) {
        return Vector3.isEqual(v, this.ZERO);
    }

    static isEqual(v1, v2) {
        return v1 && v2 && v1.x === v2.x && v1.y === v2.y && v1.z === v2.z;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;

        return this;
    }

    static add(v1, v2) {
        return {
            x: v1.x + v2.x,
            y: v1.y + v2.y,
            z: v1.z + v2.z
        };
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;

        return this;
    }

    static sub(v1, v2) {
        return {
            x: v1.x - v2.x,
            y: v1.y - v2.y,
            z: v1.z - v2.z
        };
    }

    length2() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    static length2(v) {
        return v.x * v.x + v.y * v.y + v.z * v.z;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    static length(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    testLength(len) {
        if (this.x > len || this.x < -len) return false;
        if (this.y > len || this.y < -len) return false;
        if (this.z > len || this.z < -len) return false;
        return this.length2() <= len * len;
    }

    static testLength(v, len) {
        if (v.x > len || v.x < -len) return false;
        if (v.y > len || v.y < -len) return false;
        if (v.z > len || v.z < -len) return false;
        return Vector3.length2(v) <= len * len;
    }

    static cross(v0, v1) {
        return {
            x: v0.y * v1.z - v0.z * v1.y,
            y: v0.z * v1.x - v0.x * v1.z,
            z: v0.x * v1.y - v0.y * v1.x
        };
    }
}
