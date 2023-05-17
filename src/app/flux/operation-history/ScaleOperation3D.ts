import type ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';
import ThreeGroup from '../../models/ThreeGroup';
import ThreeModel from '../../models/ThreeModel';
import Operation from '../../core/Operation';

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
        // when we set the mirrorY of the model, we expect the result to be equal to scale(1, -1, 1)
        // But the result of threejs processing is scale(-1, 1, 1) and rotation(0, 0, -3.14)
        modelGroup.updateSelectedGroupTransformation({ ...transform }, false);
        modelGroup.unselectAllModels();
        model.onTransform();

        model.stickToPlate();
        model.computeBoundingBox();
        modelGroup.meshPositionChanged();
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
        modelGroup.calaClippingMap();
    }
}
