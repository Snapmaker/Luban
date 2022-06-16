import type DrawGroup from '../../ui/SVGEditor/svg-content/DrawGroup';
import Operation from './Operation';

export type TCoordinate = [number, number];

type DrawDeleteProp = {
    target: {
        points: TCoordinate[],
        closedLoop: boolean,
        fragmentID: string
    }[]
    drawGroup: DrawGroup,
}

export default class DrawDelete extends Operation<DrawDeleteProp> {
    public constructor(props: DrawDeleteProp) {
        super();
        this.state = {
            target: props.target,
            drawGroup: props.drawGroup
        };
    }

    public redo() {
        const drawGroup = this.state.drawGroup;
        this.state.target.forEach((item) => {
            const line = drawGroup.getLine(item.fragmentID);
            drawGroup.delLine(line);
        });
    }

    public undo() {
        this.state.target.forEach((line) => {
            this.state.drawGroup.appendLine({
                points: line.points, closedLoop: line.closedLoop, fragmentID: line.fragmentID
            });
        });
    }
}
