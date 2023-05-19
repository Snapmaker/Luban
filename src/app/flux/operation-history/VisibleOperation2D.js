import Operation from '../../core/Operation';

export default class VisibleOperation2D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            svgActions: null,
            svgTarget: null,
            target: null,
            visible: true,
            ...state
        };
    }

    redo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;
        const selectedElement = this.state.svgTarget;
        const visible = this.state.visible;
        const svgActions = this.state.svgActions;

        model.visible = visible;
        model.meshObject.visible = visible;
        modelGroup.models = [...modelGroup.models]; // trigger <ModelItem> component to show the unselected model
        modelGroup.modelChanged();
        svgActions.clearSelection();

        selectedElement.visible = visible;
        if (visible) {
            selectedElement.setAttribute('display', 'inherit');
        } else {
            selectedElement.setAttribute('display', 'none');
        }
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;
        const selectedElement = this.state.svgTarget;
        const visible = !this.state.visible;
        const svgActions = this.state.svgActions;

        model.visible = visible;
        model.meshObject.visible = visible;
        modelGroup.models = [...modelGroup.models]; // trigger <ModelItem> component to show the unselected model
        modelGroup.modelChanged();
        svgActions.clearSelection();

        selectedElement.visible = visible;
        if (visible) {
            selectedElement.setAttribute('display', 'inherit');
        } else {
            selectedElement.setAttribute('display', 'none');
        }
    }
}
