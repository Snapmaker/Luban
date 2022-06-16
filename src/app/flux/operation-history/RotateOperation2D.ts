import { ModelTransformation } from '../../models/BaseModel';
import SVGActionsFactory from '../../models/SVGActionsFactory';
import SvgModel from '../../models/SvgModel';
import Operation from './Operation';

type TState = {
    target: SvgModel,
    from: ModelTransformation,
    to: ModelTransformation,
    machine: {
        size: { x: number, y: number }
    },
    svgActions: SVGActionsFactory,
    oldPaths?: string[];
    newPaths?: string[];
}

export default class RotateOperation2D extends Operation<TState> {
    public constructor(state) {
        super();
        this.state = {
            target: null, // SvgModel
            from: null, // original SvgModel.transformation
            to: null, // distination SvgModel.transformation
            machine: null, // machine series info, the size may be changed
            svgActions: null, // SVGActionsFactory instance
            ...state
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
        svgActions.rotateElementsImmediately([model.elem], {
            newAngle: -this.state.to.rotationZ / Math.PI * 180
        });
        svgActions.moveElementsImmediately([model.elem], {
            newX: this.state.to.positionX + this.state.machine.size.x,
            newY: -this.state.to.positionY + this.state.machine.size.y
        });
        svgActions.clearSelection();
        this.updateSvgPaths(this.state.from);
    }

    public undo() {
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
        this.updateSvgPaths(this.state.to);
    }
}
