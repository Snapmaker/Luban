import SVGActionsFactory from '../../models/SVGActionsFactory';
import SvgModel from '../../models/SvgModel';
import { setAttributes } from '../../ui/SVGEditor/element-utils';
import type DrawGroup from '../../ui/SVGEditor/svg-content/DrawGroup';
import Operation from './Operation';

type DrawTransformCompleteProp = {
    before: string,
    after: string,
    drawGroup: DrawGroup,
    svgModel: SvgModel,
    isText: boolean;
    SVGActions: SVGActionsFactory
}

export default class DrawTransformComplete extends Operation<DrawTransformCompleteProp> {
    public constructor(props: DrawTransformCompleteProp) {
        super();
        this.state = {
            svgModel: props.svgModel,
            before: props.before,
            after: props.after,
            drawGroup: props.drawGroup,
            isText: props.isText,
            SVGActions: props.SVGActions
        };
        if (this.state.isText) {
            this.setTextStyle(false);
        }
    }

    // There are two styles before and after text editing. The style before editing is consistent with the historical version
    private setTextStyle(fill: boolean) {
        setAttributes(this.state.svgModel.elem, {
            stroke: fill ? 'none' : '#000',
            fill: fill ? '#000' : '',
            'fill-opacity': fill ? 1 : 0
        });
    }

    public redo() {
        const svgModel = this.state.svgModel;
        if (this.state.isText) {
            // After text editing, changing styles is no longer supported
            svgModel.config.isText = false;
            this.state.SVGActions.clearSelection();
            this.setTextStyle(false);
        }
        if (svgModel.type === 'image') {
            svgModel.elemToPath({ d: this.state.after });
            svgModel.mode = 'vector';
        } else {
            svgModel.elem.setAttribute('d', this.state.after);
        }
        svgModel.updateSource();
        svgModel.onTransform();
        SvgModel.completeElementTransform(this.state.svgModel.elem);
        this.state.SVGActions.selectElements([this.state.svgModel.elem]);
    }

    public undo() {
        const svgModel = this.state.svgModel;
        if (this.state.isText) {
            // Restore the original editing function of the text
            svgModel.config.isText = true;
            this.state.SVGActions.clearSelection();
            this.setTextStyle(true);
        }
        if (svgModel.type === 'image') {
            svgModel.elemToPath({ d: this.state.before });
            svgModel.mode = 'vector';
        } else {
            svgModel.elem.setAttribute('d', this.state.before);
        }
        svgModel.updateSource();
        svgModel.onTransform();
        SvgModel.completeElementTransform(this.state.svgModel.elem);
        this.state.SVGActions.selectElements([this.state.svgModel.elem]);
    }
}
