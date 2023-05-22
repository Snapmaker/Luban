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
        this.data[this.end] = value;
        this.end = (this.end + 1) % this.maxLength;

        if (this.end === this.start) {
            this.isFull = true;
        }

        if (this.isFull) {
            this.start = (this.start + 1) % this.maxLength;
        }
    }

    public get(index: number): T {
        if (index < 0 || index >= this.maxLength) {
            throw new Error('Index out of bounds');
        }

        if (!this.isFull && index >= this.end) {
            throw new Error('Index out of bounds');
        }

        return this.data[(this.start + index) % this.maxLength];
    }

    public set(index: number, value: T): void {
        if (index < 0 || index >= this.maxLength) {
            throw new Error('Index out of bounds');
        }

        if (!this.isFull && index >= this.end) {
            throw new Error('Index out of bounds');
        }

        this.data[(this.start + index) % this.maxLength] = value;
    }

    public getStart(): number {
        return this.start;
    }

    public getEnd(): number {
        return this.end;
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
