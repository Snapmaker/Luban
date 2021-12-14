export default abstract class Operation<T> {
    protected state: T;

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
