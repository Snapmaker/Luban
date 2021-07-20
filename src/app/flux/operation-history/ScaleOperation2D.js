import Operation from './Operation';

export default class ScaleOperation2D extends Operation {
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
        const elements = [model.elem];
        svgActions.resizeElementsImmediately(elements, {
            newWidth: this.state.to.width,
            newHeight: this.state.to.height
        });
        svgActions.moveElementsImmediately(elements, {
            newX: this.state.to.positionX + this.state.machine.size.x,
            newY: -this.state.to.positionY + this.state.machine.size.y
        });
        svgActions.resetFlipElements(elements, {
            x: this.state.to.scaleX,
            y: this.state.to.scaleY
        });
        svgActions.clearSelection();
    }

    undo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        const elements = [model.elem];
        svgActions.resizeElementsImmediately(elements, {
            newWidth: this.state.from.width,
            newHeight: this.state.from.height
        });
        svgActions.moveElementsImmediately(elements, {
            newX: this.state.from.positionX + this.state.machine.size.x,
            newY: -this.state.from.positionY + this.state.machine.size.y
        });
        svgActions.resetFlipElements(elements, {
            x: this.state.from.scaleX,
            y: this.state.from.scaleY
        });
        svgActions.clearSelection();
    }
}
