export default abstract class Operation<T> {
    public description: string = this.constructor.name;

    protected state: T;


    public mergePreviousOperation() {
        throw new Error('NotImplementedException');
    }

    public redo() {
        throw new Error('NotImplementedException');
    }

    public undo() {
        throw new Error('NotImplementedException');
    }
}
