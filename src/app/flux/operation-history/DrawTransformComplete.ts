import SvgModel from '../../models/SvgModel';
import type DrawGroup from '../../ui/SVGEditor/svg-content/DrawGroup';
import Operation from './Operation';

type DrawTransformCompleteProp = {
    before: string,
    after: string,
    drawGroup: DrawGroup,
    svgModel: SvgModel
}

export default class DrawTransformComplete extends Operation<DrawTransformCompleteProp> {
    constructor(props: DrawTransformCompleteProp) {
        super();
        this.state = {
            svgModel: props.svgModel,
            before: props.before,
            after: props.after,
            drawGroup: props.drawGroup
        };
    }

    public redo() {
        this.state.svgModel.elem.setAttribute('d', this.state.after);
        this.state.svgModel.updateSource();
        SvgModel.completeElementTransform(this.state.svgModel.elem);
    }

    public undo() {
        this.state.svgModel.elem.setAttribute('d', this.state.before);
        this.state.svgModel.updateSource();
        SvgModel.completeElementTransform(this.state.svgModel.elem);
    }
}
