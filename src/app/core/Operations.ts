import Operation from './Operation';


type CallbackFunction = () => void;

export default class Operations<T> {
    private operations: Operation<T>[] = [];

    private redoCallback: CallbackFunction | null = null;

    private undoCallback: CallbackFunction | null = null;

    private callback: CallbackFunction | null = null;

    public push(...operations: Operation<T>[]) {
        this.operations.push(...(operations.filter(item => !!item)));
    }

    public getItem(i: number) {
        return this.operations[i];
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
