import Operation from '../../core/Operation';

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
        const isImageElement = model.elem.tagName.toLowerCase() === 'image';
        const restore = () => {
            svgActions.resizeElementsImmediately(elements, {
                newWidth: this.state.to.width,
                newHeight: this.state.to.height,
                imageWidth: isImageElement ? this.state.to.width : null,
                imageHeight: isImageElement ? this.state.to.height : null
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
            model.elem.onload = null;
        };
        if (isImageElement) {
            model.elem.onload = restore;
            model.elem.setAttribute('href', this.state.to.refImage);
        } else {
            restore();
        }
    }

    undo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        const elements = [model.elem];
        const isImageElement = model.elem.tagName.toLowerCase() === 'image';
        const restore = () => {
            svgActions.resizeElementsImmediately(elements, {
                newWidth: this.state.from.width,
                newHeight: this.state.from.height,
                imageWidth: isImageElement ? this.state.from.width : null,
                imageHeight: isImageElement ? this.state.from.height : null
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
            model.elem.onload = null;
        };
        if (isImageElement) {
            model.elem.onload = restore;
            model.elem.setAttribute('href', this.state.from.refImage);
        } else {
            restore();
        }
    }
}
