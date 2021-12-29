import Operation from './Operation';

export default class ScaleOperation3D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
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
            model.meshObject.parent.scale.set(this.state.to.scaleX, this.state.to.scaleY, this.state.to.scaleZ);
            model.meshObject.parent.updateMatrix();
            modelGroup.unselectAllModels();
            model.computeBoundingBox();
            model.target.stickToPlate();
            model.target.computeBoundingBox();
        } else {
            model.meshObject.position.set(this.state.to.positionX, this.state.to.positionY, this.state.to.positionZ);
            model.meshObject.rotation.set(this.state.to.rotationX, this.state.to.rotationY, this.state.to.rotationZ);
            model.meshObject.scale.set(this.state.to.scaleX, this.state.to.scaleY, this.state.to.scaleZ);
            model.stickToPlate();
            model.computeBoundingBox();
            modelGroup.updatePrimeTowerHeight();
        }
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
            model.meshObject.parent.scale.set(this.state.from.scaleX, this.state.from.scaleY, this.state.from.scaleZ);
            model.meshObject.parent.updateMatrix();
            modelGroup.unselectAllModels();
            model.computeBoundingBox();
            model.target.stickToPlate();
            model.target.computeBoundingBox();
        } else {
            model.meshObject.position.set(this.state.from.positionX, this.state.from.positionY, this.state.from.positionZ);
            model.meshObject.rotation.set(this.state.from.rotationX, this.state.from.rotationY, this.state.from.rotationZ);
            model.meshObject.scale.set(this.state.from.scaleX, this.state.from.scaleY, this.state.from.scaleZ);
            model.stickToPlate();
            model.computeBoundingBox();
            modelGroup.updatePrimeTowerHeight();
        }
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }
}
