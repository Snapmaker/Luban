import Operation from '../../core/Operation';
import type ThreeModel from '../../models/ThreeModel';
import ThreeGroup from '../../models/ThreeGroup';
import type ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';

type State = {
    modelGroup: ModelGroup,
    target: Array<ThreeModel>;
};

export default class AlignGroupOperation extends Operation<State> {
    private modelGroup: ModelGroup;

    private target: Array<ThreeModel>;

    private newGroup: ThreeGroup | null;

    private selectedModelsPositionMap: Map<string, ModelTransformation>;

    public constructor(state: State) {
        super();

        this.modelGroup = state.modelGroup;
        this.target = state.target;
        this.newGroup = null;

        this.selectedModelsPositionMap = new Map();

        // save transformation of each model before operation
        this.target.forEach((model) => {
            // select only one target to copy transformation
            const { recovery } = this.modelGroup.unselectAllModels();

            this.modelGroup.selectModelById(model.modelID);
            this.selectedModelsPositionMap.set(model.modelID, {
                ...this.modelGroup.getSelectedModelTransformationForPrinting()
            });

            recovery();
        });

        // this.state = {
        //     // selectedModelsPositionMap: new Map(),
        //     modelGroup: state.modelGroup,
        //     target: state.target,
        // };
    }

    public getNewGroup(): ThreeGroup | null {
        return this.newGroup;
    }

    public redo() {
        const modelGroup = this.modelGroup;

        // const newPosition = this.state.newPosition;
        // unselect everything
        modelGroup.unselectAllModels();

        // re-select target
        modelGroup.addModelToSelectedGroup(...this.target);

        // align models and group selected
        modelGroup.updateModelsPositionBaseFirstModel(this.target as ThreeModel[]);
        const { newGroup } = modelGroup.group();

        // save new group
        this.newGroup = newGroup;
    }

    public undo() {
        const modelGroup = this.modelGroup;

        // select group
        modelGroup.unselectAllModels();
        modelGroup.addModelToSelectedGroup(this.newGroup);

        // ungroup the group
        modelGroup.ungroup();
        modelGroup.unselectAllModels();

        this.newGroup = null;

        // restore target models to previous positions
        this.selectedModelsPositionMap.forEach((position: ModelTransformation, modelID: string) => {
            modelGroup.selectModelById(modelID);
            modelGroup.updateSelectedGroupTransformation(position);

            // const model = modelGroup.selectedModelArray[0] as Model;
            // const overstepped = modelGroup._checkOverstepped(model);
            // model.setOversteppedAndSelected(overstepped, model.isSelected);

            modelGroup.unselectAllModels();
            // model.onTransform();
        });

        // Stay target models selected
        modelGroup.addModelToSelectedGroup(...this.target);

        // modelGroup.childrenChanged();
        // modelGroup.calaClippingMap();
    }
}
