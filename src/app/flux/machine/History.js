import FixedArray from './FixedArray';

class History {
    fixedArray = [];

    index = 0; // Current index of the history array

    isCurrent = false;

    constructor(maxLength) {
        this.fixedArray = new FixedArray(maxLength);
    }


    forward() {
        if (this.index >= this.fixedArray.getLength() - 1) {
            this.index = this.fixedArray.getLength();
            return null;
        }
        this.index++;
        return this.fixedArray.get(this.index);
    }

    back() {
        if (this.index < 1) {
            this.index = -1;
            return null;
        }
        this.index--;
        return this.fixedArray.get(this.index);
    }

    push(data) {
        this.fixedArray.push(data);
        this.index = this.fixedArray.getLength();
    }
}

export default History;
