class FixedArray {
    maxLength = Infinity;

    data = [];

    start = 0;

    index = -1;

    constructor(maxLength) {
        maxLength = Number(maxLength) || 0;
        if (maxLength > 0) {
            this.maxLength = maxLength;
        }
    }

    push(value) {
        this.index++;
        this.data[this.index % this.maxLength] = value;
        if (this.index >= this.maxLength) {
            this.start = this.index - this.maxLength + 1;
        }
    }

    get(index) {
        return this.data[(index + this.start) % this.maxLength];
    }

    set(index, value) {
        this.data[(index + this.start) % this.maxLength] = value;
    }

    clear() {
        this.data.splice(0);
        this.start = 0;
        this.index = -1;
    }

    getLength() {
        return this.index - this.start + 1;
    }
}

export default FixedArray;
