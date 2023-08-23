import type CompoundOperation from './CompoundOperation';

const MAX_CAPACITY = 20;

class OperationHistory {
    private operations: CompoundOperation[];
    private index: number = -1;

    public canUndo: boolean = false;
    public canRedo: boolean = false;


    public constructor() {
        this.clear();
    }

    public size() {
        return this.operations.length;
    }

    private _updateUndoRedo() {
        this.canUndo = (this.index >= 0);
        this.canRedo = (this.index + 1 < this.operations.length);
    }

    public get(index: number = this.index): CompoundOperation | null {
        if (index < 0 || index > this.operations.length) {
            return null;
        }

        return this.operations[index];
    }

    public push(compoundOperation: CompoundOperation) {
        // Set length of array to trim operations beyond
        this.operations[++this.index] = compoundOperation;
        this.operations.length = this.index + 1;

        // Keep the history less than or equal to the MAX_LENGTH
        if (this.operations.length > MAX_CAPACITY) {
            this.operations = this.operations.slice(-MAX_CAPACITY);
            this.index = this.operations.length - 1;
        }

        this._updateUndoRedo();
    }

    public pop() {
        const pop = this.operations[this.index--];
        this.operations.length = this.index + 1;

        this._updateUndoRedo();
        return pop;
    }

    public clear() {
        this.operations = [];
        this.index = -1;
        this._updateUndoRedo();
    }

    public undo() {
        if (this.index < 0) {
            return;
        }

        const compoundOperation = this.operations[this.index--];
        compoundOperation.undo();

        // for (const operation of compoundOperation.operations) {
        //     operation.undo();
        // }
        // compoundOperation.runUndoCallback();

        this._updateUndoRedo();
    }

    public redo() {
        if (this.index + 1 >= this.operations.length) {
            return;
        }

        const compoundOperation = this.operations[++this.index];
        compoundOperation.redo();

        // for (const operation of compoundOperation.operations) {
        //     operation.redo();
        // }
        // compoundOperation.runRedoCallback();

        this._updateUndoRedo();
    }

    public filter(fn: (operations: CompoundOperation) => boolean) {
        this.operations = this.operations.filter(fn);
        this.index = this.operations.length - 1; // point to tail
    }
}

export default OperationHistory;
