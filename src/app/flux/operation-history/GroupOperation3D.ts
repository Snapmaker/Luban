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
    target: ThreeGroup,
    modelGroup: ModelGroup
};

export default class GroupOperation3D extends Operation {
    state: GroupState;

    constructor(state) {
        super();
        this.state = {
            modelsbeforeGroup: [],
            modelsafterGroup: [],
            selectedModels: [],
            groupChildrenMap: new Map(),
            target: null,
            modelGroup: null,
            ...state
        };
    }

    redo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();
        const modelsToGroup = [];
        this.state.selectedModels.forEach(model => {
            if (model instanceof ThreeGroup) {
                const children = model.destroy();
                modelsToGroup.push(...children);
            } else {
                modelsToGroup.push(model);
            }
        });
        target.add(modelsToGroup);
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
        this.state.groupChildrenMap.forEach((subModels, group) => {
            group.add(subModels);
            modelGroup.object.add(group.meshObject);
        });
        modelGroup.models = [...this.state.modelsbeforeGroup];
    }
}
