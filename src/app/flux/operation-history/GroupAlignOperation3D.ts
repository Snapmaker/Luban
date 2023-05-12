import Operation from '../../core/Operation';
import type ThreeModel from '../../models/ThreeModel';
import ThreeGroup from '../../models/ThreeGroup';
import type ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';

type Model = ThreeGroup | ThreeModel;

type GroupState = {
    modelsbeforeGroup: Model[],
    modelsafterGroup: Model[],
    selectedModels: Model[],
    groupChildrenMap: Map<ThreeGroup, ThreeModel[]>
    selectedModelsPositionMap: Map<string, ModelTransformation>
    target: ThreeGroup,
    newPosition: ModelTransformation,
    modelGroup: ModelGroup,
    subModelPosition?: Map<string, ModelTransformation>
};

export default class GroupAlginOperation3D extends Operation<GroupState> {
    public constructor(state: GroupState) {
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

    public redo() {
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
            const overstepped = modelGroup._checkOverstepped(subModel);
            subModel.setOversteppedAndSelected(overstepped, subModel.isSelected);
        });
        target.stickToPlate();
        modelGroup.object.add(target.meshObject);
        modelGroup.models = [...this.state.modelsafterGroup];
        modelGroup.childrenChanged();
        target.updateGroupExtruder();
        modelGroup.calaClippingMap();
    }

    public undo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();

        target.children.forEach((subModel) => {
            this.state.subModelPosition.set(subModel.modelID, {
                ...subModel.transformation
            });
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
            const model = modelGroup.selectedModelArray[0] as Model;
            const overstepped = modelGroup._checkOverstepped(model);
            model.setOversteppedAndSelected(overstepped, model.isSelected);

            modelGroup.unselectAllModels();
            model.onTransform();
        });
        modelGroup.models = [...this.state.modelsbeforeGroup];
        modelGroup.childrenChanged();
        modelGroup.calaClippingMap();
    }
}
