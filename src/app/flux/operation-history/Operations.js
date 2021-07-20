export default class Operations {
    operations = [];

    redoCallback = null;

    undoCallback = null;

    callback = null;

    push(...operations) {
        this.operations.push(...(operations.filter(item => !!item)));
    }

    getItem(i) {
        return this.operations[i];
    }

    removeItem(i) {
        this.operations.splice(i, 1);
    }

    length() {
        return this.operations.length;
    }

    isEmpty() {
        return this.operations.length === 0;
    }

    /**
     * regist callback that runs after redo or undo, this method can be used to restore flux state
     * @param {function} callback this function will run after redo and undo callback finished
     * @param {function} redoCallback
     * @param {function} undoCallback
     */
    registCallbackAfterAll(callback, redoCallback, undoCallback) {
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

    runRedoCallback() {
        this.redoCallback && this.redoCallback();
        this.callback && this.callback();
    }

    runUndoCallback() {
        this.undoCallback && this.undoCallback();
        this.callback && this.callback();
    }

    mergePreviousOperation() {
        throw new Error('NotImplementedException');
    }
}
