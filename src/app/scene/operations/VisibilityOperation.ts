import Operation from '../../core/Operation';
import type ThreeGroup from '../../models/ThreeGroup';
import type ThreeModel from '../../models/ThreeModel';

type VisibleState = {
    target: ThreeModel | ThreeGroup,
    visible: boolean,
};

export default class VisibilityOperation extends Operation<VisibleState> {
    public constructor(state: VisibleState) {
        super();
        this.state = {
            target: state.target,
            visible: state.visible,
        };
    }

    public redo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        modelGroup.setModelVisibility([model], this.state.visible);
        modelGroup.modelChanged();
    }

    public undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        modelGroup.setModelVisibility([model], !this.state.visible);
        modelGroup.modelChanged();
    }
}
