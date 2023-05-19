import type ModelGroup from '../../models/ModelGroup';
import ThreeGroup from '../../models/ThreeGroup';
import Operation from '../../core/Operation';
import ThreeModel from '../../models/ThreeModel';

type Positon = {
    positionX: number,
    positionY: number,
    positionZ: number
}

type MoveOperationProp = {
    target: ThreeGroup | ThreeModel,
    from: Positon,
    to: Positon,
}

type MoveOperationState = MoveOperationProp & {
    modelGroup: ModelGroup,
}

export default class MoveOperation3D extends Operation<MoveOperationState> {
    public constructor(state: MoveOperationProp) {
        super();
        this.state = {
            target: state.target,
            modelGroup: state.target.modelGroup,
            from: state.from,
            to: state.to,
        };
    }

    public redo() {
        const model = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();
        modelGroup.addModelToSelectedGroup(model);
        this.exec(this.state.to);
    }

    public undo() {
        const model = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();
        modelGroup.addModelToSelectedGroup(model);

        const modelHeight = model.boundingBox.max.z - model.boundingBox.min.z;

        const current = modelGroup.getSelectedModelTransformationForPrinting();
        if (this.state.to.positionZ > 0 && this.state.to.positionZ - current.positionZ > 10e-5) {
            this.exec({
                ...this.state.from,
                positionZ: current.positionZ - this.state.to.positionZ + modelHeight / 2
            });
        } else if (this.state.to.positionZ < 0 && current.positionZ - this.state.to.positionZ > 10e-5) {
            this.exec({
                ...this.state.from,
                positionZ: -this.state.to.positionZ + current.positionZ + this.state.from.positionZ
            });
        } else {
            this.exec(this.state.from);
        }
    }

    private exec({ positionX, positionY, positionZ }: Positon) {
        const model = this.state.target;
        const modelGroup = this.state.modelGroup;
        modelGroup.unselectAllModels();

        modelGroup.addModelToSelectedGroup(model);
        modelGroup.updateSelectedGroupTransformation({
            positionX, positionY, positionZ
        });

        modelGroup.unselectAllModels();
        model.onTransform();
        if (model instanceof ThreeGroup) {
            modelGroup.stickToPlateAndCheckOverstepped(model);
        }
        if (model.parent && model.parent instanceof ThreeGroup) {
            modelGroup.stickToPlateAndCheckOverstepped(model.parent);
            model.parent.computeBoundingBox();
        }
        if (!model.parent && model instanceof ThreeModel) {
            modelGroup.stickToPlateAndCheckOverstepped(model);
        }
        modelGroup.meshPositionChanged();
        modelGroup.calaClippingMap();
    }
}
