import Operation from '../../core/Operation';

export default class MoveOperation2D extends Operation {
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
        svgActions.moveElementsImmediately([model.elem], {
            newX: this.state.to.positionX + this.state.machine.size.x,
            newY: -this.state.to.positionY + this.state.machine.size.y,
        });
        svgActions.clearSelection();
    }

    undo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        svgActions.moveElementsImmediately([model.elem], {
            newX: this.state.from.positionX + this.state.machine.size.x,
            newY: -this.state.from.positionY + this.state.machine.size.y,
        });
        svgActions.clearSelection();
    }
}
