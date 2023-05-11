import Operation from '../../core/Operation';

export default class DeleteOperation2D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            target: null, // SvgModel
            svgActions: null, // SVGActionsFactory instance
            toolPathGroup: null, // keep a reference for undo & redo manipulate
            toolPaths: [], // save object related toolPaths, which may includes one or more object
            ...state
        };
    }

    redo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;
        const svgActions = this.state.svgActions;
        const toolPathGroup = this.state.toolPathGroup;

        const id = model.modelID;
        toolPathGroup.toolPaths.forEach((item) => {
            if (item.modelMap.get(id)) {
                this.state.toolPaths.push(item);
                item.modelMap.delete(id);
            }
        });
        for (const toolPath of this.state.toolPaths) {
            if (toolPath.modelMap.size === 0) {
                toolPathGroup.deleteToolPath(toolPath.id);
            }
        }
        svgActions.svgContentGroup.deleteElement(model.elem);
        modelGroup.removeModel(model);
        svgActions.clearSelection();
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;
        const svgActions = this.state.svgActions;
        const toolPathGroup = this.state.toolPathGroup;

        const id = model.modelID;
        this.state.toolPaths.forEach((item) => {
            if (!toolPathGroup.toolPaths.includes(item)) {
                toolPathGroup.toolPaths.push(item);
                toolPathGroup.toolPathObjects.add(item.object);
            }
            if (id) {
                item.modelMap.set(id, model);
            }
        });
        this.state.toolPaths = [];

        model.setParent(svgActions.svgContentGroup.group);
        model.setPreSelection(svgActions.svgContentGroup.preSelectionGroup);
        modelGroup.object.add(model.meshObject);
        model.meshObject.addEventListener('update', modelGroup.onModelUpdate);
        modelGroup.models.push(model);
        modelGroup.models = [...modelGroup.models]; // trigger <ModelItem> component to show the unselected model
        modelGroup.updateModelNameMap(model.modelName, model.baseName, 'add');
        modelGroup.modelChanged();
        svgActions.clearSelection();

        toolPathGroup.addSelectedToolpathColor();
        toolPathGroup._updated();
    }
}
