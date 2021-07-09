export default class VisibleOperation {
    state = {}

    description = 'Visible';

    constructor(state) {
        this.state = {
            target: null,
            visible: true,
            ...state
        };
    }

    mergePreviousOperation(prevOperation) {
        console.log('mergePreviousOperation', prevOperation);
    }

    redo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        model.visible = this.state.visible;
        model.meshObject.visible = this.state.visible;
        modelGroup.models = [...modelGroup.models]; // trigger <ModelItem> component to show the unselected model
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        model.visible = !this.state.visible;
        model.meshObject.visible = !this.state.visible;
        modelGroup.models = [...modelGroup.models]; // trigger <ModelItem> component to show the unselected model
    }
}
