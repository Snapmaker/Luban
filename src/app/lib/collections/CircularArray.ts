/**
 * Fixed Length Array implemented in circular buffer.
 */
export default class FixedCircularArray<T> {
    private maxLength: number = Infinity;
    private data: T[] = [];
    private start: number = 0;
    private end: number = 0;
    private isFull: boolean = false;

    public constructor(maxLength: number) {
        this.maxLength = maxLength && maxLength > 0 ? maxLength : 1000;
        this.data = new Array(this.maxLength);
    }

    public getMaxLength(): number {
        return this.maxLength;
    }

    public push(value: T): void {
        if (this.isFull && this.end === this.start) {
            this.start = (this.start + 1) % this.maxLength;
        }

        this.data[this.end] = value;
        this.end = (this.end + 1) % this.maxLength;

        if (this.end === this.start) {
            this.isFull = true;
        }
    }

    public get(index: number): T {
        if (index < 0 || index >= this.maxLength) {
            throw new Error(`Index out of bounds: ${index}`);
        }

        if (!this.isFull && index >= this.getLength()) {
            throw new Error(`Index out of bounds: ${index}`);
        }

        return this.data[(this.start + index) % this.maxLength];
    }

    public set(index: number, value: T): void {
        if (index < 0 || index >= this.maxLength) {
            throw new Error(`Index out of bounds: ${index}`);
        }

        if (!this.isFull && index >= this.getLength()) {
            throw new Error(`Index out of bounds: ${index}`);
        }

        this.data[(this.start + index) % this.maxLength] = value;
    }

    public getStart(): number {
        return this.start;
    }

    public getEnd(): number {
        return this.end;
    }

    public trim(index: number): void {
        this.isFull = (index === this.maxLength);
        this.end = (this.start + index) % this.maxLength;
    }

    public getLatestIndex(): number {
        let index = this.getEnd() - 1;
        if (index < 0) {
            index += this.getMaxLength();
        }
        return index;
    }

    public clear() {
        this.data = new Array(this.maxLength);
        this.start = 0;
        this.end = 0;
        this.isFull = false;
    }

    public getLength() {
        if (this.isFull) {
            return this.maxLength;
        } else if (this.end >= this.start) {
            return this.end - this.start;
        } else {
            return this.maxLength + this.end - this.start;
        }
    }
}
