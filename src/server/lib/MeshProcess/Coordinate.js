class Coordinate {
    x = 'x';

    y = 'y';

    z = 'z';

    constructor(options = {}) {
        const { x = 'x', y = 'y', z = 'z' } = options;
        this.x = x;
        this.y = y;
        this.z = z;
    }

    _addKey(key, nCoordinate, oldCoordinate) {
        const value = nCoordinate[key];
        const vK = value.slice(value.length - 1);
        let nValue = value.replace(vK, oldCoordinate[vK]);
        if (nValue.length >= 3) {
            nValue = nValue.slice(nValue.length - 1);
        }
        nCoordinate[key] = nValue;
    }

    add(coordinate) {
        const nCoordinate = {
            ...{ x: 'x', y: 'y', z: 'z' },
            ...coordinate
        };

        this._addKey('x', nCoordinate, this);
        this._addKey('y', nCoordinate, this);
        this._addKey('z', nCoordinate, this);

        this.set(nCoordinate);

        return this;
    }

    set(coordinate) {
        const { x = this.x, y = this.y, z = this.z } = coordinate;

        this.x = x;
        this.y = y;
        this.z = z;

        return this;
    }

    isEqual(coordinate) {
        const { x, y, z } = coordinate;
        return this.x === x && this.y === y && this.z === z;
    }

    xK() {
        return this.x.slice(this.x.length - 1);
    }

    xS() {
        return this.x.indexOf('-') === -1 ? 1 : -1;
    }

    yK() {
        return this.y.slice(this.y.length - 1);
    }

    yS() {
        return this.y.indexOf('-') === -1 ? 1 : -1;
    }

    zK() {
        return this.z.slice(this.z.length - 1);
    }

    zS() {
        return this.z.indexOf('-') === -1 ? 1 : -1;
    }
}

export default Coordinate;
