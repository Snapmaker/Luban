import ThreeUtils from '../../three-extensions/ThreeUtils';
import Operation from './Operation';

export default class AddOperation3D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            target: null,
            parent: null,
            ...state
        };
    }

    redo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        if (model.supportTag) {
            if (!model.target) return;
            model.target.meshObject.add(model.meshObject); // restore the parent-child relationship
        } else {
            modelGroup.object.add(model.meshObject);
        }
        model.meshObject.addEventListener('update', modelGroup.onModelUpdate);
        modelGroup.models.push(model);
        modelGroup.models = [...modelGroup.models]; // trigger <ModelItem> component to show the unselected model
        modelGroup.modelChanged();
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        if (model.isSelected) {
            ThreeUtils.removeObjectParent(model.meshObject);
            if (!model.supportTag) {
                ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
            } else {
                ThreeUtils.setObjectParent(model.meshObject, model.target.meshObject);
            }
        }
        modelGroup.removeModel(model);
        if (model.isSelected) {
            model.setSelected(false);
            // trigger <VisualizerLeftBar> component hidden
            modelGroup.unselectAllModels();
        }
        modelGroup.modelChanged();
    }
}
