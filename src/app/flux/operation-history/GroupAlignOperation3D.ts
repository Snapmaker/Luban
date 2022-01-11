import Operation from './Operation';
import type Model from '../../models/ThreeBaseModel';
import type ThreeModel from '../../models/ThreeModel';
import ThreeGroup from '../../models/ThreeGroup';
import type ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';

type GroupState = {
    modelsbeforeGroup: Model[],
    modelsafterGroup: Model[],
    selectedModels: ThreeModel[] | ThreeGroup[],
    groupChildrenMap: Map<ThreeGroup, ThreeModel[]>
    selectedModelsPositionMap: Map<string, ModelTransformation>
    target: ThreeGroup,
    newPosition: ModelTransformation,
    modelGroup: ModelGroup,
    subModelPosition?: Map<string, ModelTransformation>
};

export default class GroupAlginOperation3D extends Operation<GroupState> {
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
            subModelPosition: new Map(),
            ...state
        };
    }

    redo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;
        const newPosition = this.state.newPosition;
        modelGroup.unselectAllModels();

        target.add(this.state.selectedModels);
        if (newPosition) {
            target.updateTransformation(newPosition);
        }
        target.children.forEach((subModel) => {
            const subModelTransform = this.state.subModelPosition.get(subModel.modelID);
            subModel.updateTransformation(subModelTransform);
            modelGroup.stickToPlateAndCheckOverstepped(subModel);
        });
        target.stickToPlate();
        modelGroup.object.add(target.meshObject);
        modelGroup.models = [...this.state.modelsafterGroup];
    }

    undo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();

        target.children.forEach((subModel) => {
            this.state.subModelPosition.set(subModel.modelID, subModel.transformation);
        });

        modelGroup.addModelToSelectedGroup(target);
        modelGroup.ungroup();

        modelGroup.unselectAllModels();
        // this.state.groupChildrenMap.forEach((subModels, group) => {
        //     group.add(subModels);
        //     modelGroup.object.add(group.meshObject);
        // });
        this.state.selectedModelsPositionMap.forEach((position: ModelTransformation, modelID: string) => {
            modelGroup.selectModelById(modelID);
            modelGroup.updateSelectedGroupTransformation(position);
            modelGroup.stickToPlateAndCheckOverstepped(modelGroup.selectedModelArray[0]);
            modelGroup.unselectAllModels();
        });
        modelGroup.models = [...this.state.modelsbeforeGroup];
    }
}
