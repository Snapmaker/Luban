import Operation from './Operation';
import ThreeModel from '../../models/ThreeModel';
import ThreeGroup from '../../models/ThreeGroup';
import type ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';
import ThreeUtils from '../../three-extensions/ThreeUtils';

type Model = ThreeGroup | ThreeModel

type ModelSnapshot = {
    groupModelID: string,
    modelTransformation: ModelTransformation,
    children?: ThreeModel[]
}

type GroupState = {
    modelsBeforeGroup: Model[],
    modelsAfterGroup: Model[],
    selectedModels: Array<ThreeModel | ThreeGroup>,
    target: ThreeGroup,
    modelGroup: ModelGroup,
    modelsRelation: Map<string, ModelSnapshot>
};

// Scenario 1: one or more models outside the group are selected
// Scenario 2: one or more groups are selected
// Scenario 3: multiple models in a group are selected. If all models in the group are selected, it is scenario 2
// Scenario 4: both the model outside the group and the group are selected
export default class GroupOperation3D extends Operation<GroupState> {
    public constructor(state: GroupState) {
        super();
        this.state = {
            modelsBeforeGroup: state.modelsBeforeGroup || [],
            modelsAfterGroup: state.modelsAfterGroup || [],
            selectedModels: state.selectedModels || [],
            target: state.target,
            modelGroup: state.modelGroup,
            modelsRelation: state.modelsRelation || new Map()
        };
    }

    public redo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();
        const modelsToGroup = [];
        this.state.selectedModels.forEach((model) => {
            if (model instanceof ThreeGroup) {
                const children = (model as ThreeGroup).disassemble();
                modelsToGroup.push(...children);
            } else {
                modelsToGroup.push(model);
            }
            const modelSnapshot = this.state.modelsRelation.get(model.modelID);
            // If it is a sunModel, Remove it from the group
            // After removal, there are always other models in the group
            if (model.parent && model.parent instanceof ThreeGroup && modelSnapshot) {
                const index = model.parent.children.findIndex((subModel) => subModel.modelID === model.modelID);
                model.parent.children.splice(index, 1);
                ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject.parent);
                model.parent.updateGroupExtruder();
            }
        });
        target.add(modelsToGroup);
        modelGroup.object.add(target.meshObject);
        modelGroup.models = [...this.state.modelsAfterGroup];
        modelGroup.calaClippingMap();
        modelGroup.childrenChanged();
    }

    public undo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();
        modelGroup.addModelToSelectedGroup(target);
        modelGroup.ungroup({ autoStickToPlate: false });
        modelGroup.unselectAllModels();
        modelGroup.object.remove(target.meshObject);

        this.state.selectedModels.forEach((model) => {
            const modelSnapshot = this.state.modelsRelation.get(model.modelID);
            if (model instanceof ThreeModel && modelSnapshot) {
                if (modelSnapshot.groupModelID) {
                    // SubModel of the original group
                    const group = modelGroup.getModel(modelSnapshot.groupModelID) as ThreeGroup;
                    // The original group will always exist
                    modelGroup.recoveryGroup(group, model);
                    group.stickToPlate();
                } else {
                    // update models which is not inside group
                    model.updateTransformation(modelSnapshot.modelTransformation);
                }
            } else if (model instanceof ThreeGroup) {
                model.add(modelSnapshot.children);
                modelGroup.object.add(model.meshObject);
                model.updateTransformation(modelSnapshot.modelTransformation);
                model.updateGroupExtruder();
            }
        });

        modelGroup.models = [...this.state.modelsBeforeGroup];
        modelGroup.calaClippingMap();
        modelGroup.childrenChanged();
    }
}
