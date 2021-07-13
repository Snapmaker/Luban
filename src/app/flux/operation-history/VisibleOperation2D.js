export default class VisibleOperation2D {
    state = {};

    description = 'Visible';

    constructor(state) {
        this.state = {
            svgTarget: null,
            modelTarget: null,
            visible: true,
            ...state
        };
    }

    mergePreviousOperation(prevOperation) {
        console.log('mergePreviousOperation', prevOperation);
    }

    redo() {
        const model = this.state.modelTarget;
        const modelGroup = model.modelGroup;
        const selectedElement = this.state.svgTarget;
        const visible = this.state.visible;

        model.visible = visible;
        model.meshObject.visible = visible;
        modelGroup.models = [...modelGroup.models]; // trigger <ModelItem> component to show the unselected model
        modelGroup.modelChanged();

        selectedElement.visible = visible;
        if (visible) {
            selectedElement.setAttribute('display', 'inherit');
        } else {
            selectedElement.setAttribute('display', 'none');
        }
    }

    undo() {
        const model = this.state.modelTarget;
        const modelGroup = model.modelGroup;
        const selectedElement = this.state.svgTarget;
        const visible = !this.state.visible;

        model.visible = visible;
        model.meshObject.visible = visible;
        modelGroup.models = [...modelGroup.models]; // trigger <ModelItem> component to show the unselected model
        modelGroup.modelChanged();

        selectedElement.visible = visible;
        if (visible) {
            selectedElement.setAttribute('display', 'inherit');
        } else {
            selectedElement.setAttribute('display', 'none');
        }
    }
}
