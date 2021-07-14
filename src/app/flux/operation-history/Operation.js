export default class Operation {
    state = {};

    description = this.constructor.name;

    mergePreviousOperation(operation) {
        console.log('mergePreviousOperation', operation);
    }

    redo() {
        console.log('redo');
    }

    undo() {
        console.log('undo');
    }
}
