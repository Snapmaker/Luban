import ThreeUtils from '../../three-extensions/ThreeUtils';

export default class AddOperation {
    state = [];

    description = 'Add';

    constructor(state) {
        this.state.push({
            target: null,
            parent: null,
            ...state
        });
    }

    mergePreviousOperation(prevOperation) {
        console.log('mergePreviousOperation', prevOperation);
    }

    redo() {
        console.log('redo');
        console.log(this.state);
        for (const state of this.state) {
            const model = state.target;
            const modelGroup = model.modelGroup;

            if (model.supportTag) {
                if (!model.target) continue;
                model.target.meshObject.add(model.meshObject); // restore the parent-child relationship
            } else {
                modelGroup.object.add(model.meshObject);
            }
            model.meshObject.addEventListener('update', modelGroup.onModelUpdate);
            modelGroup.models.push(model);
            modelGroup.models = [...modelGroup.models]; // trigger <ModelItem> component to show the unselected model
            // if (model.isSelected) {
            //     modelGroup.unselectAllModels();
            //     modelGroup.addModelToSelectedGroup(model);
            //     modelGroup.unselectAllModels();
            //     model.meshObject.parent.position.copy(state.parent.position);
            //     model.meshObject.parent.rotation.copy(state.parent.rotation);
            //     model.meshObject.parent.quaternion.copy(state.parent.quaternion);
            //     modelGroup.emit('select');
            // }
            modelGroup.modelChanged();
        }
    }

    undo() {
        console.log('undo');
        for (const state of this.state) {
            const model = state.target;
            const modelGroup = model.modelGroup;

            if (!model.supportTag) {
                if (model.isSelected) {
                    ThreeUtils.removeObjectParent(model.meshObject, model.meshObject.parent);
                    ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
                }
            }
            modelGroup.removeModel(model);
            if (model.isSelected) {
                // trigger <VisualizerLeftBar> component hidden
                modelGroup.unselectAllModels();
            }
            modelGroup.modelChanged();
        }
    }
}
