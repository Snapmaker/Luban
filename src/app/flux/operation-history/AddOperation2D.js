import Operation from './Operation';

export default class AddOperation2D extends Operation {
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

        const id = model.elem.id;
        this.state.toolPaths.forEach((item) => {
            if (!toolPathGroup.toolPaths.includes(item)) {
                toolPathGroup.toolPaths.push(item);
                toolPathGroup.toolPathObjects.add(item.object);
            }
            item.modelIDs.push(id);
        });
        toolPathGroup._updated();
        this.state.toolPaths = [];

        model.setParent(svgActions.svgContentGroup.group);
        modelGroup.object.add(model.meshObject);
        model.meshObject.addEventListener('update', modelGroup.onModelUpdate);
        modelGroup.models.push(model);
        modelGroup.models = [...modelGroup.models];
        modelGroup.modelChanged();
        svgActions.clearSelection();
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;
        const svgActions = this.state.svgActions;
        const toolPathGroup = this.state.toolPathGroup;

        const id = model.elem.id;
        toolPathGroup.toolPaths.forEach((item) => {
            const index = item.modelIDs.indexOf(id);
            if (index > -1) {
                this.state.toolPaths.push(item);
                item.modelIDs.splice(index, 1);
            }
        });
        for (const toolPath of this.state.toolPaths) {
            if (toolPath.modelIDs.length === 0) {
                toolPathGroup.deleteToolPath(toolPath.id);
            }
        }
        svgActions.svgContentGroup.deleteElement(model.elem);
        modelGroup.removeModel(model);
        svgActions.clearSelection();
    }
}
