import { CircularArray } from '../lib/collections';

class History<T> {
    private fixedArray: CircularArray<T>;
    private index = 0; // Current index of the history array

    public constructor(maxLength: number) {
        this.fixedArray = new CircularArray<T>(maxLength);
    }

    public push(data: T): void {
        // trim items > index
        this.fixedArray.trim(this.index);

        // add new
        this.fixedArray.push(data);

        // points to newest index
        this.index = this.fixedArray.getLength();
    }

    public clear(): void {
        this.fixedArray.clear();

        this.index = 0;
    }

    public forward(): T | null {
        if (!this.fixedArray.getLength()) {
            return null;
        }

        if (this.index === this.fixedArray.getLength()) {
            return null;
        }

        const item = this.fixedArray.get(this.index);

        this.index++;

        return item;
    }

    public back(): T | null {
        if (!this.fixedArray.getLength()) {
            return null;
        }

        // No moving back any more
        if (this.index === 0) {
            return null;
        }

        this.index--;

        return this.fixedArray.get(this.index);
    }
}

export default History;
