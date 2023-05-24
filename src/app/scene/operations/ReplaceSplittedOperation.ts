import Operation from '../../core/Operation';
import type ModelGroup from '../../models/ModelGroup';
import ThreeGroup from '../../models/ThreeGroup';
import type ThreeModel from '../../models/ThreeModel';
import ThreeUtils from '../three-extensions/ThreeUtils';

interface OperationInput {
    modelGroup: ModelGroup,
    model: ThreeModel;
    splittedGroup: ThreeGroup;
}

type State = {};

/**
 * Replace Splitted Operation.
 *
 * We implemented undo/redo for mesh split, by replacing model with splitted group.
 */
export default class ReplaceSplittedOperation extends Operation<State> {
    private input: OperationInput;

    public constructor(input: OperationInput) {
        super();

        this.input = input;
    }

    public redo() {
        const { modelGroup, model, splittedGroup } = this.input;

        modelGroup.unselectAllModels();
        modelGroup.selectModelById(model.modelID);

        const transformation = modelGroup.getSelectedModelTransformation();
        modelGroup.unselectAllModels();

        // replace model
        const index = modelGroup.models.findIndex((child) => child.modelID === model.modelID);
        if (index === -1) {
            return;
        }
        ThreeUtils.removeObjectParent(model.meshObject);
        ThreeUtils.setObjectParent(splittedGroup.meshObject, modelGroup.object);
        modelGroup.models.splice(index, 1, splittedGroup);

        splittedGroup.updateTransformation(transformation);

        // select splitted group
        modelGroup.addModelToSelectedGroup(splittedGroup);
    }

    public undo() {
        const { modelGroup, model, splittedGroup } = this.input;

        modelGroup.unselectAllModels();

        // replace model
        const index = modelGroup.models.findIndex((child) => child.modelID === splittedGroup.modelID);
        if (index === -1) {
            return;
        }
        ThreeUtils.removeObjectParent(splittedGroup.meshObject);
        ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
        modelGroup.models.splice(index, 1, model);

        // select original model
        modelGroup.addModelToSelectedGroup(model);
    }
}
