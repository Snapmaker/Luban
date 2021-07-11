export default class MoveOperation3D {
    state = {};

    description = 'MoveOperation3D';

    constructor(state) {
        this.state = {
            ...state
        };
    }

    mergePreviousOperation(prevOperation) {
        console.log('mergePreviousOperation', prevOperation);
    }

    redo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        // modelGroup.unselectAllModels();
        modelGroup.updateSelectedGroupTransformation({
            ...model.transformation,
            ...this.state.to
        }, false);
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        // modelGroup.unselectAllModels();
        modelGroup.updateSelectedGroupTransformation({
            ...model.transformation,
            ...this.state.from
        }, false);
    }
}
