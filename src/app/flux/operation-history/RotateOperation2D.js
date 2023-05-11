import Operation from '../../core/Operation';

export default class RotateOperation2D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            target: null, // SvgModel
            from: null, // original SvgModel.transformation
            to: null, // distination SvgModel.transformation
            machine: null, // machine series info, the size may be changed
            svgActions: null, // SVGActionsFactory instance
            ...state
        };
    }

    redo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        svgActions.rotateElementsImmediately([model.elem], {
            newAngle: -this.state.to.rotationZ / Math.PI * 180
        });
        svgActions.moveElementsImmediately([model.elem], {
            newX: this.state.to.positionX + this.state.machine.size.x,
            newY: -this.state.to.positionY + this.state.machine.size.y
        });
        svgActions.clearSelection();
    }

    undo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        svgActions.rotateElementsImmediately([model.elem], {
            newAngle: -this.state.from.rotationZ / Math.PI * 180
        });
        svgActions.moveElementsImmediately([model.elem], {
            newX: this.state.from.positionX + this.state.machine.size.x,
            newY: -this.state.from.positionY + this.state.machine.size.y
        });
        svgActions.clearSelection();
    }
}
