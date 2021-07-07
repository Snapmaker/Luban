export default class Operation {
    state = {}
    description = 'Noop'
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
