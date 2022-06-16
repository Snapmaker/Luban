import type DrawGroup from '../../ui/SVGEditor/svg-content/DrawGroup';
import { TransformRecord } from '../../ui/SVGEditor/svg-content/DrawGroup/DrawGroup';
import Operation from './Operation';

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

    private updateRelationLinesPoints(records: TransformRecord[]) {
        records.forEach((record) => {
            const line = this.state.drawGroup.getLine(record.fragmentID);
            this.state.drawGroup.getSelectedRelationLines('line', line).forEach((item) => {
                item.updatePosition([], true);
            });
        });
    }

    public redo() {
        this.state.after.forEach((record) => {
            const line = this.state.drawGroup.getLine(record.fragmentID);
            line.updatePosition(record.points);
            line.updatePosition([], true);
        });
        this.updateRelationLinesPoints(this.state.after);
        this.state.drawGroup.resetOperationByselect();
    }

    public undo() {
        this.state.before.forEach((record) => {
            const line = this.state.drawGroup.getLine(record.fragmentID);
            line.updatePosition(record.points);
        });
        this.updateRelationLinesPoints(this.state.before);
        this.state.drawGroup.resetOperationByselect();
    }
}
