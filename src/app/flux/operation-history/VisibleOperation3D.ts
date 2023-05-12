import type ThreeGroup from '../../models/ThreeGroup';
import type ThreeModel from '../../models/ThreeModel';
import Operation from '../../core/Operation';

type VisibleState = {
    target: ThreeModel | ThreeGroup,
    visible: boolean
};

export default class VisibleOperation3D extends Operation<VisibleState> {
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

        modelGroup.toggleModelsVisible(this.state.visible, [model]);
        modelGroup.modelChanged();
    }

    public undo() {
        const model = this.state.target;
        const modelGroup = model.modelGroup;

        modelGroup.toggleModelsVisible(!this.state.visible, [model]);
        modelGroup.modelChanged();
    }
}
