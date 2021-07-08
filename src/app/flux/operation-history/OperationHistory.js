class OperationHistory {
    history;

    canUndo;

    canRedo;

    index;

    MAX_LENGTH = 20;

    _updateUndoRedo() {
        this.canUndo = (this.index >= 0);
        this.canRedo = (this.index < this.history.length - 1);
    }

    clear() {
        this.history = [];
        this.index = -1;
        this.canUndo = false;
        this.canRedo = false;
    }

    undo() {
        if (this.index >= 0) {
            const operations = this.history[this.index];
            this.index--;
            for (const operation of operations.operations) {
                operation.undo();
            }
        }
        this._updateUndoRedo();
    }

    redo() {
        if (this.index < this.history.length - 1) {
            const operations = this.history[++this.index];
            for (const operation of operations.operations) {
                operation.redo();
            }
        }
        this._updateUndoRedo();
    }

    push(operations) {
        console.log(this.history);
        // don't use push, because the original history item can be override by different user opertation
        this.history[++this.index] = operations;
        this.history.length = this.index + 1;
        // keep the history less than or equal to the MAX_LENGTH, also need to correct the index
        this.history = this.history.slice(-this.MAX_LENGTH);
        this.index = this.history.length - 1;
        this._updateUndoRedo();
    }
}

let operationHistory;

function getOperationHistoryInstance() {
    if (!operationHistory) {
        operationHistory = new OperationHistory();
        operationHistory.clear();
    }
    return operationHistory;
}

export default getOperationHistoryInstance;
