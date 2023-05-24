import type ModelGroup from '../../models/ModelGroup';
import type ThreeGroup from '../../models/ThreeGroup';
import type ThreeModel from '../../models/ThreeModel';
import type { ModelTransformation } from '../../models/ThreeBaseModel';
import Operation from '../../core/Operation';
import ThreeUtils from '../three-extensions/ThreeUtils';

type ModelState = {
    target: ThreeModel,
    transformation: ModelTransformation
};

type UngroupState = {
    modelsBeforeUngroup: Array<ThreeModel | ThreeGroup>,
    target: ThreeGroup,
    groupTransformation: ModelTransformation,
    subModelStates: ModelState[]
    modelGroup: ModelGroup
};
export default class UngroupOperation3D extends Operation<UngroupState> {
    public constructor(props: UngroupState) {
        super();
        this.state = {
            modelsBeforeUngroup: props.modelsBeforeUngroup || [],
            target: props.target || null,
            groupTransformation: props.groupTransformation || null,
            subModelStates: props.subModelStates || [],
            modelGroup: props.modelGroup || null,
        };
    }

    public redo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();
        modelGroup.addModelToSelectedGroup(target);
        modelGroup.ungroup();
        modelGroup.unselectAllModels();
        modelGroup.childrenChanged();
    }

    public undo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;
        const subModelStates = this.state.subModelStates;

        modelGroup.unselectAllModels();
        ThreeUtils.setObjectParent(target.meshObject, modelGroup.object);
        const subModels = [];
        subModelStates.forEach((item) => {
            subModels.push(item.target);
        });
        target.add(subModels);

        subModelStates.forEach((item) => {
            item.target.updateTransformation(item.transformation);
        });
        target.updateTransformation(this.state.groupTransformation);
        modelGroup.models = [...this.state.modelsBeforeUngroup];
        target.stickToPlate();
        modelGroup.childrenChanged();
        target.updateGroupExtruder();
    }
}
