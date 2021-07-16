export default class Operation {
    state = {};

    description = this.constructor.name;

    mergePreviousOperation() {
        throw new Error('NotImplementedException');
    }

    redo() {
        throw new Error('NotImplementedException');
    }

    undo() {
        throw new Error('NotImplementedException');
    }
}
