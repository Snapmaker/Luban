import { ModelTransformation } from '../../models/BaseModel';
import SVGActionsFactory from '../../models/SVGActionsFactory';
import SvgModel from '../../models/SvgModel';
import Operation from './Operation';

type Transform = ModelTransformation & {
    refImage: string
}

type TState = {
    target: SvgModel,
    from: Transform, // original SvgModel.transformation
    to: Transform, // distination SvgModel.transformation
    machine: { // machine series info, the size may be changed
        size: { x: number, y: number }
    },
    svgActions: SVGActionsFactory, // SVGActionsFactory instance
}

export default class ScaleOperation2D extends Operation<TState> {
    public constructor(state) {
        super();
        this.state = {
            target: state.target, // SvgModel
            from: state.from, // original SvgModel.transformation
            to: state.to, // distination SvgModel.transformation
            machine: state.machine, // machine series info, the size may be changed
            svgActions: state.svgActions, // SVGActionsFactory instance
        };
        this.updateSvgPaths(this.state.from);
    }

    /**
     * When SVG is displayed as a picture, the path needs to be updated to change the location.
     * To ensure that the position is correct when switching to vector
     * @param preTransform Based on last location information
     */
    private updateSvgPaths(preTransform: ModelTransformation) {
        const svgModel = this.state.target;

        if (svgModel.config.editable && svgModel.type === 'image') {
            svgModel.updateSvgPaths(preTransform);
        }
    }

    public redo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        let isImageElement = model.elem.tagName.toLowerCase() === 'image';
        if (isImageElement && model.config.editable) {
            model.elemToPath();
            model.mode = 'vector';
            isImageElement = false;
        }
        const elements = [model.elem];
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
        this.updateSvgPaths(this.state.from);
    }

    public undo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;
        let isImageElement = model.elem.tagName.toLowerCase() === 'image';
        if (isImageElement && model.config.editable) {
            model.elemToPath();
            model.mode = 'vector';
            isImageElement = false;
        }
        const elements = [model.elem];
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
        this.updateSvgPaths(this.state.to);
    }
}
