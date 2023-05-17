import Operation from './Operation';

type CallbackFunction = () => void;

/**
 * Compound Operation.
 *
 * A group of operations that need to execute together.
 */
class CompoundOperation {
    public operations: Operation<object>[] = [];

    private redoCallback: CallbackFunction | null = null;

    private undoCallback: CallbackFunction | null = null;

    private callback: CallbackFunction | null = null;

    public push(...operations: Operation<T>[]) {
        this.operations.push(...operations);
    }

    public getItem<O>(i: number): O | null {
        if (this.operations[i]) {
            return this.operations[i] as O;
        } else {
            return null;
        }
    }

    public removeItem(i: number) {
        this.operations.splice(i, 1);
    }

    public length() {
        return this.operations.length;
    }

    public isEmpty() {
        return this.operations.length === 0;
    }

    public redo(): void {
        for (const operation of this.operations) {
            operation.redo();
        }

        this.runRedoCallback();
    }

    public undo(): void {
        for (const operation of this.operations) {
            operation.undo();
        }
        this.runUndoCallback();
    }

    /**
     * regist callback that runs after redo or undo, this method can be used to restore flux state
     * @param {function} callback this function will run after redo and undo callback finished
     * @param {function} redoCallback
     * @param {function} undoCallback
     */
    public registerCallbackAll(callback: CallbackFunction,
        redoCallback: CallbackFunction = null,
        undoCallback: CallbackFunction = null) {
        if (typeof redoCallback === 'function') {
            this.redoCallback = redoCallback;
        }
        if (typeof undoCallback === 'function') {
            this.undoCallback = undoCallback;
        }
        if (typeof callback === 'function') {
            this.callback = callback;
        }
    }

    public runRedoCallback() {
        this.redoCallback && this.redoCallback();
        this.callback && this.callback();
    }

    public runUndoCallback() {
        this.undoCallback && this.undoCallback();
        this.callback && this.callback();
    }
}

export default CompoundOperation;
