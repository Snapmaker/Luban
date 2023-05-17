import type DrawGroup from '../../ui/SVGEditor/svg-content/DrawGroup';
import { TransformRecord } from '../../ui/SVGEditor/svg-content/DrawGroup/DrawGroup';
import Operation from '../../core/Operation';

type DrawTransformProp = {
    before: TransformRecord[],
    after: TransformRecord[],
    drawGroup: DrawGroup
}

export default class DrawTransform extends Operation<DrawTransformProp> {
    public constructor(props: DrawTransformProp) {
        super();
        this.state = {
            before: props.before,
            after: props.after,
            drawGroup: props.drawGroup
        };
    }

    public redo() {
        this.state.after.forEach((record) => {
            const line = this.state.drawGroup.getLine(record.fragmentID);
            line.updatePosition(record.points);
            line.updatePosition([], true);
        });
        this.state.drawGroup.resetOperationByselect();
    }

    public undo() {
        this.state.before.forEach((record) => {
            const line = this.state.drawGroup.getLine(record.fragmentID);
            line.updatePosition(record.points);
        });
        this.state.drawGroup.updateAllLinePosition();
        this.state.drawGroup.resetOperationByselect();
    }
}
