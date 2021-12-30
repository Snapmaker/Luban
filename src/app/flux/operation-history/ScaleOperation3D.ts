import type ModelGroup from '../../models/ModelGroup';
import type ThreeGroup from '../../models/ThreeGroup';
import ThreeModel from '../../models/ThreeModel';
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

type ScaleOperationProp = {
    target: ThreeGroup | ThreeModel,
    from: Positon,
    to: Positon
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

    private exec({ positionX, positionY, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ }) {
        const model = this.state.target;
        const modelGroup = this.state.modelGroup;
        modelGroup.unselectAllModels({ recursive: !!model.parent });

        if (model instanceof ThreeModel && model.supportTag) {
            modelGroup.addModelToSelectedGroup(model);
            model.meshObject.parent.position.set(positionX, positionY, 0);
            model.meshObject.parent.scale.set(scaleX, scaleY, scaleZ);
            model.meshObject.parent.updateMatrix();
            modelGroup.unselectAllModels();
            model.computeBoundingBox();
            model.target.stickToPlate();
            model.target.computeBoundingBox();
        } else {
            model.meshObject.position.set(positionX, positionY, positionZ);
            model.meshObject.rotation.set(rotationX, rotationY, rotationZ);
            model.meshObject.scale.set(scaleX, scaleY, scaleZ);
            model.stickToPlate();
            model.computeBoundingBox();
            modelGroup.updatePrimeTowerHeight();
        }
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }
}
