import Operation from './Operation';

export default class MoveOperation3D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            target: null,
            ...state
        };
    }

    redo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;
        modelGroup.unselectAllModels();
        if (model.supportTag) {
            modelGroup.addModelToSelectedGroup(model);
            model.meshObject.parent.position.set(this.state.to.positionX, this.state.to.positionY, 0);
            model.meshObject.parent.updateMatrix();
            modelGroup.unselectAllModels();
        } else {
            model.meshObject.position.set(this.state.to.positionX, this.state.to.positionY, this.state.to.positionZ);
        }
        model.computeBoundingBox();
        model.stickToPlate();
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;
        modelGroup.unselectAllModels();
        if (model.supportTag) {
            modelGroup.addModelToSelectedGroup(model);
            model.meshObject.parent.position.set(this.state.from.positionX, this.state.from.positionY, 0);
            model.meshObject.parent.updateMatrix();
            modelGroup.unselectAllModels();
        } else {
            model.meshObject.position.set(this.state.from.positionX, this.state.from.positionY, this.state.from.positionZ);
        }
        model.computeBoundingBox();
        model.stickToPlate();
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }
}
