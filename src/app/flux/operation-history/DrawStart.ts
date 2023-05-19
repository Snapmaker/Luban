import type ContentGroup from '../../ui/SVGEditor/svg-content/SVGContentGroup';
import Operation from '../../core/Operation';

type DrawStartProp = {
    elemID: string;
    contentGroup: ContentGroup;
}

export default class DrawStart extends Operation<DrawStartProp> {
    public constructor(props: DrawStartProp) {
        super();
        this.state = {
            elemID: props.elemID,
            contentGroup: props.contentGroup,
        };
    }

    public redo() {
        this.state.contentGroup.drawGroup.stopDraw(true);
        if (this.state.elemID) {
            const elem = document.querySelector(`#${this.state.elemID}`);
            this.state.contentGroup.onChangeMode('select', { elem });
        } else {
            this.state.contentGroup.onChangeMode('draw');
        }
    }

    public undo() {
        this.state.contentGroup.drawGroup.stopDraw(true);
        this.state.contentGroup.onChangeMode('select', {});
    }
}
