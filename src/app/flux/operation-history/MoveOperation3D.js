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
        model.meshObject.position.setX(this.state.to.x);
        model.meshObject.position.setY(this.state.to.y);
        model.stickToPlate();
        const overstepped = modelGroup._checkOverstepped(model);
        console.log('overstepped', overstepped);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }

    undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;
        modelGroup.unselectAllModels();
        model.meshObject.position.setX(this.state.from.x);
        model.meshObject.position.setY(this.state.from.y);
        model.stickToPlate();
        const overstepped = modelGroup._checkOverstepped(model);
        console.log('overstepped', overstepped);
        model.setOversteppedAndSelected(overstepped, model.isSelected);
    }
}
