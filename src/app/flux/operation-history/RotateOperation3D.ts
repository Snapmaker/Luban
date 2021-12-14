import type ModelGroup from '../../models/ModelGroup';
import type ThreeGroup from '../../models/ThreeGroup';
import type ThreeModel from '../../models/ThreeModel';
import ThreeUtils from '../../three-extensions/ThreeUtils';
import Operation from './Operation';

type Positon = {
    positionX: number,
    positionY: number,
    positionZ: number,
    rotationX: number,
    rotationY: number,
    rotationZ: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number
}

type RotateOperationProp = {
    target: ThreeGroup | ThreeModel,
    from: Positon,
    to: Positon
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

    private exec({ positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ }) {
        const model = this.state.target;
        const modelGroup = this.state.modelGroup;
        modelGroup.unselectAllModels();
        if (model.parent) {
            ThreeUtils.setObjectParent(model.meshObject, model.parent.meshObject);
        } else {
            ThreeUtils.setObjectParent(model.meshObject, modelGroup.object);
        }
        model.meshObject.position.set(positionX, positionY, positionZ);
        model.meshObject.rotation.set(rotationX, rotationY, rotationZ);
        model.meshObject.scale.set(scaleX, scaleY, scaleZ);

        model.stickToPlate();
        model.computeBoundingBox();
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }
}
