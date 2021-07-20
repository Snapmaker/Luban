// import ThreeUtils from '../../three-extensions/ThreeUtils';

import Operation from './Operation';

export default class RotateOperation3D extends Operation {
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
        model.meshObject.position.set(this.state.to.positionX, this.state.to.positionY, this.state.to.positionZ);
        model.meshObject.rotation.set(this.state.to.rotationX, this.state.to.rotationY, this.state.to.rotationZ);
        model.meshObject.scale.set(this.state.to.scaleX, this.state.to.scaleY, this.state.to.scaleZ);
        model.stickToPlate();
        model.computeBoundingBox();
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;
        modelGroup.unselectAllModels();
        model.meshObject.position.set(this.state.from.positionX, this.state.from.positionY, this.state.from.positionZ);
        model.meshObject.rotation.set(this.state.from.rotationX, this.state.from.rotationY, this.state.from.rotationZ);
        model.meshObject.scale.set(this.state.from.scaleX, this.state.from.scaleY, this.state.from.scaleZ);
        model.stickToPlate();
        model.computeBoundingBox();
        const overstepped = modelGroup._checkOverstepped(model);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }
}
