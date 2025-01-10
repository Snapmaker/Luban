import Operation from '../../core/Operation';

export default class AddMaterialTestGenerate extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            svgActions: null, // SVGActionsFactory instance
            toolPathGroup: null, // keep a reference for undo & redo manipulate
            modelGroup: null,
            models: [],
            toolPaths: [], // save object related toolPaths, which may includes one or more object
            ...state
        };
    }

    redo() {
        const models = this.state.models;
        const modelGroup = this.state.modelGroup;
        const svgActions = this.state.svgActions;
        const toolPathGroup = this.state.toolPathGroup;
        models.forEach((model) => {
            console.log('');
            const id = model.modelID;
            this.state.toolPaths.forEach((item) => {
                if (!toolPathGroup.toolPaths.includes(item)) {
                    toolPathGroup.toolPaths.push(item);
                    toolPathGroup.toolPathObjects.add(item.object);
                }
                if (!item.modelMap.get(id)) {
                    item.modelMap.set(id, model);
                }
            });
            toolPathGroup._updated();
            this.state.toolPaths = [];
            model.setParent(svgActions.svgContentGroup.group);
            model.setPreSelection(svgActions.svgContentGroup.preSelectionGroup);
            modelGroup.object.add(model.meshObject);
            model.meshObject.addEventListener('update', modelGroup.onModelUpdate);
            modelGroup.models.push(model);
            modelGroup.models = [...modelGroup.models];
            modelGroup.updateModelNameMap(model.modelName, model.baseName, 'add');
            modelGroup.modelChanged();
            svgActions.clearSelection();
        });
    }

    undo() {
        const models = this.state.models;
        const modelGroup = this.state.modelGroup;
        const svgActions = this.state.svgActions;
        const toolPathGroup = this.state.toolPathGroup;
        models.forEach((model) => {
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
        });
    }
}