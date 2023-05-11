import type ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';
import type ThreeGroup from '../../models/ThreeGroup';
import type ThreeModel from '../../models/ThreeModel';
import Operation from '../../core/Operation';

type ScaleToFitWithRotateOperationProp = {
    target: ThreeGroup | ThreeModel,
    from: ModelTransformation,
    to: ModelTransformation
}

type ScaleToFitWithRotateOperationState = ScaleToFitWithRotateOperationProp & {
    modelGroup: ModelGroup
}

export default class ScaleToFitWithRotateOpeartion3D extends Operation<ScaleToFitWithRotateOperationState> {
    public constructor(props: ScaleToFitWithRotateOperationProp) {
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
        // NOTE: Had to add 'rotationX, rotationY' since 'scale to fit' is possible to change model's rotationX and rotationY
        const { scaleX, scaleY, scaleZ, rotationX, rotationY, rotationZ, positionX, positionY, positionZ } = transform;
        modelGroup.unselectAllModels();
        modelGroup.addModelToSelectedGroup(model);
        modelGroup.updateSelectedGroupTransformation({
            rotationX: rotationX,
            rotationY: rotationY,
            rotationZ: rotationZ,
            scaleX: scaleX,
            scaleY: scaleY,
            scaleZ: scaleZ,
        });
        modelGroup.updateSelectedGroupTransformation({
            positionX: positionX,
            positionY: positionY,
            positionZ: positionZ
        });
        modelGroup.unselectAllModels();
        model.onTransform();

        model.stickToPlate();
        model.computeBoundingBox();
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
        modelGroup.meshPositionChanged();
        modelGroup.calaClippingMap();
    }
}
