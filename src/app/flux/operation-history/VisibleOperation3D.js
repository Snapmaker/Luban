import Operation from './Operation';

export default class VisibleOperation3D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            target: null,
            visible: true,
            ...state
        };
    }

    redo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        model.visible = this.state.visible;
        model.meshObject.visible = this.state.visible;
        modelGroup.models = [...modelGroup.models]; // trigger <ModelItem> component to show the unselected model
        modelGroup.modelChanged();
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        model.visible = !this.state.visible;
        model.meshObject.visible = !this.state.visible;
        modelGroup.models = [...modelGroup.models]; // trigger <ModelItem> component to show the unselected model
        modelGroup.modelChanged();
    }
}
