import type ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';
import type ThreeGroup from '../../models/ThreeGroup';
import ThreeModel from '../../models/ThreeModel';
import Operation from './Operation';

type ScaleOperationProp = {
    target: ThreeGroup | ThreeModel,
    from: ModelTransformation,
    to: ModelTransformation
}

type ScaleOperationState = ScaleOperationProp & {
    modelGroup: ModelGroup,
}

export default class ScaleOperation3D extends Operation<ScaleOperationState> {
    constructor(props: ScaleOperationProp) {
        super();
        this.state = {
            target: props.target,
            modelGroup: props.target.modelGroup,
            from: props.from,
            to: props.to
        };
    }

    public redo() {
        this.exec(this.state.to);
    }

    public undo() {
        this.exec(this.state.from);
    }

    private exec(transform: ModelTransformation) {
        const model = this.state.target;
        const modelGroup = this.state.modelGroup;
        modelGroup.unselectAllModels();

        if (model instanceof ThreeModel && model.supportTag) {
            modelGroup.addModelToSelectedGroup(model);
            modelGroup.updateSelectedGroupTransformation({ ...transform }, false);
            modelGroup.unselectAllModels();
            model.computeBoundingBox();
            model.target.stickToPlate();
            model.target.computeBoundingBox();
        } else {
            modelGroup.addModelToSelectedGroup(model);
            modelGroup.updateSelectedGroupTransformation({ ...transform }, false);
            modelGroup.unselectAllModels();

            model.stickToPlate();
            model.computeBoundingBox();
            modelGroup.updatePrimeTowerHeight();
        }
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }
}
