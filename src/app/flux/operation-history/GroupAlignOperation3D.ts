import Operation from './Operation';
import type Model from '../../models/ThreeBaseModel';
import type ThreeModel from '../../models/ThreeModel';
import ThreeGroup from '../../models/ThreeGroup.ts';
import type ModelGroup from '../../models/ModelGroup';

type GroupState = {
    modelsbeforeGroup: Model[],
    modelsafterGroup: Model[],
    selectedModels: ThreeModel[] | ThreeGroup[],
    groupChildrenMap: Map<ThreeGroup, ThreeModel[]>
    selectedModelsPositionMap: Map<string, any>
    target: ThreeGroup,
    modelGroup: ModelGroup
};

export default class GroupAlginOperation3D extends Operation {
    state: GroupState;

    constructor(state) {
        super();
        this.state = {
            modelsbeforeGroup: [],
            modelsafterGroup: [],
            selectedModels: [],
            groupChildrenMap: new Map(),
            selectedModelsPositionMap: new Map(),
            target: null,
            modelGroup: null,
            ...state
        };
    }

    redo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;
        const selectedModels = this.state.selectedModels;

        modelGroup.unselectAllModels();
        modelGroup.updateModelsPositionBaseFirstModel(selectedModels);

        const modelsToGroup = [];
        this.state.selectedModels.forEach(model => {
            if (model instanceof ThreeGroup) {
                const children = model.destroy();
                modelsToGroup.push(...children);
            } else {
                modelsToGroup.push(model);
            }
        });
        console.log('redo align', target);
        target.add(modelsToGroup);
        target.stickToPlate();
        modelGroup.object.add(target.meshObject);
        modelGroup.models = [...this.state.modelsafterGroup];
    }

    undo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();
        modelGroup.addModelToSelectedGroup(target);
        modelGroup.ungroup();

        modelGroup.unselectAllModels();
        this.state.selectedModelsPositionMap.forEach((position, modelID) => {
            modelGroup.updateModelPositionByPosition(modelID, position);
        });
        console.log('this.state.modelsbeforeGroup', modelGroup, this.state.modelsbeforeGroup);
        modelGroup.models = [...this.state.modelsbeforeGroup];
    }
}
