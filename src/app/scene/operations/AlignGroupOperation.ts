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

            const transformation = this.modelGroup.getSelectedModelTransformationForPrinting();
            this.selectedModelsPositionMap.set(model.modelID, transformation);

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

    private getIdentityTransformation(): ModelTransformation {
        return {
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
        };
    }

    public redo() {
        const modelGroup = this.modelGroup;

        // const newPosition = this.state.newPosition;
        // unselect everything
        modelGroup.unselectAllModels();

        // align models and group selected
        const targetModels = this.target;

        if (targetModels.length > 0) {
            const firstModel = targetModels[0];
            const otherModels = targetModels.slice(1);

            let transformation: ModelTransformation;

            transformation = this.getIdentityTransformation();
            transformation.positionX = firstModel.transformation.positionX;
            transformation.positionY = firstModel.transformation.positionY;
            transformation.positionZ = firstModel.originalPosition.z;

            modelGroup.selectModelById(firstModel.modelID);
            modelGroup.updateSelectedGroupTransformation(transformation);

            otherModels.forEach((model) => {
                transformation = this.getIdentityTransformation();
                transformation.positionX = model.originalPosition.x - firstModel.originalPosition.x + firstModel.transformation.positionX;
                transformation.positionY = model.originalPosition.y - firstModel.originalPosition.y + firstModel.transformation.positionY;
                transformation.positionZ = model.originalPosition.z;

                modelGroup.selectModelById(model.modelID);
                modelGroup.updateSelectedGroupTransformation(transformation);
            });

            modelGroup.unselectAllModels();
            for (const model of targetModels) {
                modelGroup.addModelToSelectedGroup(model);
            }
        }

        // modelGroup.updateModelsPositionBaseFirstModel(this.target);

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
