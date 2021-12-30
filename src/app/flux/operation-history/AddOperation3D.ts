import * as THREE from 'three';
import type ModelGroup from '../../models/ModelGroup';
import ThreeGroup from '../../models/ThreeGroup';
import ThreeModel from '../../models/ThreeModel';
import ThreeUtils from '../../three-extensions/ThreeUtils';
import Operation from './Operation';

type AddOperationProp = {
    target: ThreeGroup | ThreeModel,
}

type AddOperationState = {
    target: ThreeGroup | ThreeModel,
    modelGroup: ModelGroup
    transform: Map<string, {
        position: THREE.Vector3,
        scale: THREE.Vector3,
        rotation: THREE.Euler
    }>,
    childrens?: ThreeModel[]
}

export default class AddOperation3D extends Operation<AddOperationState> {
    constructor(props: AddOperationProp) {
        super();
        this.state = {
            target: props.target,
            transform: new Map(),
            modelGroup: props.target.modelGroup
        };
    }

    public redo() {
        const modelGroup = this.state.modelGroup;
        const model = this.state.target;

        if (model instanceof ThreeModel && model.supportTag) {
            if (!model.target) return;
            model.target.meshObject.add(model.meshObject); // restore the parent-child relationship
        } else {
            modelGroup.object.add(model.meshObject);
        }

        if (model instanceof ThreeGroup) {
            const children = this.state.childrens;
            model.children = [];

            children.forEach((subModel) => {
                modelGroup.recoveryGroup(model, subModel);
            });
            model.children.forEach((subModel) => {
                const transform = this.state.transform.get(subModel.modelID);
                subModel.meshObject.position.copy(transform.position);
                subModel.meshObject.scale.copy(transform.scale);
                subModel.meshObject.rotation.copy(transform.rotation);
            });
        }

        const transform = this.state.transform.get(model.modelID);
        model.meshObject.position.copy(transform.position);
        model.meshObject.scale.copy(transform.scale);
        model.meshObject.rotation.copy(transform.rotation);

        model.meshObject.addEventListener('update', modelGroup.onModelUpdate);
        modelGroup.models = modelGroup.models.concat(model); // trigger <ModelItem> component to show the unselected model
        modelGroup.updatePrimeTowerHeight();
        modelGroup.modelChanged();
    }

    public undo() {
        const modelGroup = this.state.modelGroup;
        const model = this.state.target;

        if (model.isSelected) {
            ThreeUtils.removeObjectParent(model.meshObject);
            if (model instanceof ThreeModel && model.supportTag) {
                ThreeUtils.setObjectParent(model.meshObject, model.target.meshObject);
            } else {
                ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
            }
        }

        if (model instanceof ThreeGroup) {
            this.state.childrens = [];
            model.children.forEach((subModel: ThreeModel) => {
                this.state.childrens.push(subModel);
                this.state.transform.set(subModel.modelID, {
                    position: subModel.meshObject.position.clone(),
                    scale: subModel.meshObject.scale.clone(),
                    rotation: subModel.meshObject.rotation.clone()
                });
            });
        }
        this.state.transform.set(model.modelID, {
            position: model.meshObject.position.clone(),
            scale: model.meshObject.scale.clone(),
            rotation: model.meshObject.rotation.clone()
        });

        modelGroup.removeModel(model);
        if (model.isSelected) {
            model.setSelected(false);
            // trigger <VisualizerLeftBar> component hidden
            modelGroup.unselectAllModels();
        }
        modelGroup.updatePrimeTowerHeight();
        modelGroup.modelChanged();
    }
}
