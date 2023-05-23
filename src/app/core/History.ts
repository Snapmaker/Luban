import { CircularArray } from '../lib/collections';

class History<T> {
    private fixedArray: CircularArray<T>;
    private index = 0; // Current index of the history array

    public constructor(maxLength: number) {
        this.fixedArray = new CircularArray<T>(maxLength);
    }

    public push(data: T): void {
        this.fixedArray.push(data);

        // points to newest index
        this.index = this.fixedArray.getEnd() - 1;
        if (this.index < 0) {
            this.index += this.fixedArray.getMaxLength();
        }
    }

    public forward(): T | null {
        if (!this.fixedArray.getLength()) {
            return null;
        }

        const index = this.index;

        this.index = (this.index + 1) % this.fixedArray.getMaxLength();
        if (this.index === this.fixedArray.getEnd()) {
            this.index = index; // restore index
            return null;
        }

        return this.fixedArray.get(this.index);
    }

    public back(): T | null {
        if (!this.fixedArray.getLength()) {
            return null;
        }

        // No moving back any more
        if (this.index === this.fixedArray.getStart()) {
            return this.fixedArray.get(this.index);
        }

        this.index = (this.index - 1 + this.fixedArray.getMaxLength()) % this.fixedArray.getMaxLength();
        return this.fixedArray.get(this.index);
    }
}

export default History;
