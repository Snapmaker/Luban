export default class AddOperation {
    state = [];

    description = 'Add';

    constructor(state) {
        this.state.push(state);
    }

    mergePreviousOperation(prevOperation) {
        console.log('mergePreviousOperation', prevOperation);
    }

    redo() {
        console.log('redo');
        console.log(this.state);
        for (const state of this.state) {
            state.modelGroup.models.push(state.target);
            // todo, use this to refresh obj list
            state.modelGroup.models = [...state.modelGroup.models];
            state.modelGroup.object.add(state.target.meshObject);
        }
    }

    undo() {
        console.log('undo');
        for (const state of this.state) {
            state.modelGroup.removeModel(state.target);
            // state.parent = state.target.meshObject.parent;
        }
    }
}
