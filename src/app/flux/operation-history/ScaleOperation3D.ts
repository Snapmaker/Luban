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
    public constructor(props: ScaleOperationProp) {
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
        // Only set the scale, and then trigger the stickToPlate to restore the position of the same group of models
        modelGroup.updateSelectedGroupTransformation({
            scaleX: transform.scaleX,
            scaleY: transform.scaleY,
            scaleZ: transform.scaleZ
        }, false);
        modelGroup.unselectAllModels();
        model.onTransform();

        model.stickToPlate();
        model.computeBoundingBox();
        modelGroup.updatePrimeTowerHeight();
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
        modelGroup.calaClippingMap();
    }
}
