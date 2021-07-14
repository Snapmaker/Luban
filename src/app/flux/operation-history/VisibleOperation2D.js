import Operation from './Operation';

export default class VisibleOperation2D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            svgTarget: null,
            modelTarget: null,
            visible: true,
            ...state
        };
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
