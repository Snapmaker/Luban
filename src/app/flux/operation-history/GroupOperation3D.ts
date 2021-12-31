import * as THREE from 'three';
import Operation from './Operation';
import type Model from '../../models/ThreeBaseModel';
import ThreeModel from '../../models/ThreeModel';
import ThreeGroup from '../../models/ThreeGroup';
import type ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';
import ThreeUtils from '../../three-extensions/ThreeUtils';

type ModelSnapshot = {
    groupModel: ThreeGroup,
    groupMesh: THREE.Mesh,
    modelTransformation: ModelTransformation,
    groupTransformation: ModelTransformation
}

type GroupState = {
    modelsBeforeGroup: Model[],
    modelsAfterGroup: Model[],
    selectedModels: Array<ThreeModel | ThreeGroup>,
    groupChildrenMap: Map<ThreeGroup, ThreeModel[]>
    target: ThreeGroup,
    modelGroup: ModelGroup,
    modelsInGroup: Map<string, ModelSnapshot>
    targetTransformation: ModelTransformation,
    targetChildrenTransformation: Map<string, ModelTransformation>
};

export default class GroupOperation3D extends Operation<GroupState> {
    constructor(state: GroupState) {
        super();
        this.state = {
            modelsBeforeGroup: state.modelsBeforeGroup || [],
            modelsAfterGroup: state.modelsAfterGroup || [],
            selectedModels: state.selectedModels || [],
            groupChildrenMap: state.groupChildrenMap || new Map(),
            target: state.target,
            modelGroup: state.modelGroup,
            modelsInGroup: state.modelsInGroup || new Map(),
            targetTransformation: state.targetTransformation,
            targetChildrenTransformation: state.targetChildrenTransformation
        };
    }

    public redo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();
        const modelsToGroup = [];
        this.state.selectedModels.forEach(model => {
            if (model instanceof ThreeGroup) {
                const children = (model as ThreeGroup).disassemble();
                modelsToGroup.push(...children);
            } else {
                modelsToGroup.push(model);
            }
            const modelSnapshot = this.state.modelsInGroup.get(model.modelID);
            if (model.parent && model.parent instanceof ThreeGroup && modelSnapshot) {
                const index = model.parent.children.findIndex(subModel => subModel.modelID === model.modelID);
                model.parent.children.splice(index, 1);
                modelGroup.models.push(model);
                ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject.parent);
                if (model.parent.meshObject.children.length === 0) {
                    modelGroup.object.remove(model.parent.meshObject);
                    modelGroup.models = modelGroup.models.filter(m => m.modelID !== model.parent.modelID);
                }
            }
        });
        target.add(modelsToGroup);
        modelGroup.object.add(target.meshObject);

        target.updateTransformation(this.state.targetTransformation);
        target.children.forEach((subModel) => {
            const subModelTransformation = this.state.targetChildrenTransformation.get(subModel.modelID);
            subModelTransformation && subModel.updateTransformation(subModelTransformation);
        });

        modelGroup.models = [...this.state.modelsAfterGroup];
    }

    public undo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();
        modelGroup.addModelToSelectedGroup(target);
        modelGroup.ungroup();

        modelGroup.unselectAllModels();
        this.state.groupChildrenMap.forEach((subModels, group) => {
            group.add(subModels);
            modelGroup.object.add(group.meshObject);
        });

        this.state.selectedModels.forEach(model => {
            const modelSnapshot = this.state.modelsInGroup.get(model.modelID);
            if (model instanceof ThreeModel && modelSnapshot) {
                if (modelSnapshot.groupModel) {
                    // SubModel of the original group
                    const group = modelGroup.getModel(modelSnapshot.groupModel.modelID);
                    if (group) {
                        // The original group still exists
                        modelGroup.recoveryGroup(group, model);
                        model.updateTransformation(modelSnapshot.modelTransformation);
                        modelGroup.models = modelGroup.getModels().filter((m: ThreeModel) => {
                            return m.modelID !== model.modelID;
                        });
                        group.stickToPlate();
                    } else {
                        // The original group does not exist. To recovery group
                        modelGroup.models = modelGroup.models.concat(modelSnapshot.groupModel);
                        modelGroup.object.add(modelSnapshot.groupMesh);
                        modelSnapshot.groupModel.updateTransformation(modelSnapshot.groupTransformation);
                        // modelSnapshot.groupModel.updateTransformation(modelSnapshot.modelTransformation);
                    }
                } else {
                    // update models which is not inside group
                    model.updateTransformation(modelSnapshot.modelTransformation);
                }
            } else if (model instanceof ThreeGroup) {
                modelGroup.models = modelGroup.models.concat(model);
                modelGroup.object.add(model.meshObject);
                model.updateTransformation(modelSnapshot.modelTransformation);
                model.children.forEach((subModel) => {
                    subModel.updateTransformation(this.state.modelsInGroup.get(subModel.modelID).modelTransformation);
                });
            }
        });

        modelGroup.models = [...this.state.modelsBeforeGroup];
    }
}
