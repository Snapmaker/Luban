import Operation from '../../core/Operation';

export default class UpdateHrefOperation2D extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            target: null, // SvgModel
            svgActions: null, // SVGActionsFactory instance
            fromHref: null,
            toHref: null,
            ...state
        };
    }

    redo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;

        model.updateProcessImageName(this.state.toHref);
        svgActions.updateSvgModelImage(model, this.state.toHref);
    }

    undo() {
        const model = this.state.target;
        const svgActions = this.state.svgActions;

        model.updateProcessImageName(this.state.fromHref);
        svgActions.updateSvgModelImage(model, this.state.fromHref);
    }
}
