import type ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';
import type ThreeGroup from '../../models/ThreeGroup';
import type ThreeModel from '../../models/ThreeModel';
import Operation from './Operation';


type RotateOperationProp = {
    target: ThreeGroup | ThreeModel,
    from: ModelTransformation,
    to: ModelTransformation
}

type RotateOperationState = RotateOperationProp & {
    modelGroup: ModelGroup,
}

export default class RotateOperation3D extends Operation<RotateOperationState> {
    constructor(props: RotateOperationProp) {
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

        modelGroup.addModelToSelectedGroup(model);
        modelGroup.updateSelectedGroupTransformation({
            ...transform
        });
        modelGroup.unselectAllModels();

        model.stickToPlate();
        model.computeBoundingBox();
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }
}
