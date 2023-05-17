import type DrawGroup from '../../ui/SVGEditor/svg-content/DrawGroup';
import Operation from '../../core/Operation';

type DrawLineProp = {
    target: SVGPathElement;
    closedLoop: boolean;
    drawGroup: DrawGroup;
}

export default class DrawLine extends Operation<DrawLineProp> {
    public constructor(props: DrawLineProp) {
        super();
        this.state = {
            target: props.target,
            closedLoop: props.closedLoop,
            drawGroup: props.drawGroup
        };
    }

    public redo() {
        this.state.drawGroup.appendLine(this.state.target, this.state.closedLoop);
        this.state.drawGroup.resetOperation();
    }

    public undo() {
        this.state.drawGroup.deleteLine(this.state.target);
        this.state.drawGroup.resetOperation();
    }
}
