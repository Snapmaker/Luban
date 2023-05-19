import Operation from '../../core/Operation';
import type ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';
import ThreeGroup from '../../models/ThreeGroup';
import ThreeModel from '../../models/ThreeModel';


type ModelSnapshot = {
    groupModelID: string | null;
    children: ThreeModel[] | null;
    modelTransformation: ModelTransformation;
};

type State = {
    modelGroup: ModelGroup;
    target: Array<ThreeModel | ThreeGroup>;
};

// Scenario 1: one or more models outside the group are selected
// Scenario 2: one or more groups are selected
// Scenario 3: multiple models in a group are selected. If all models in the group are selected, it is scenario 2
// Scenario 4: both the model outside the group and the group are selected
export default class GroupOperation extends Operation<State> {
    private modelGroup: ModelGroup;

    private target: Array<ThreeModel | ThreeGroup>;

    private newGroup: ThreeGroup;

    private modelsRelation: Map<string, ModelSnapshot>;

    public constructor(state: State) {
        super();

        this.target = state.target;
        this.modelGroup = state.modelGroup;
        this.newGroup = null;

        this.modelsRelation = new Map();

        // construct model relations
        const { recovery } = this.modelGroup.unselectAllModels();
        this.target.forEach((model) => {
            this.modelsRelation.set(
                model.modelID,
                {
                    groupModelID: model.parent?.modelID,
                    children:
                        model instanceof ThreeGroup
                            ? model.children.slice(0) as ThreeModel[]
                            : null,
                    modelTransformation: { ...model.transformation }
                }
            );
        });
        recovery();

        // this.state = {
        //     modelGroup: state.modelGroup,
        //     target: state.target,
        // };
    }

    public redo() {
        const modelGroup = this.modelGroup;

        // unselect everything
        modelGroup.unselectAllModels();

        // re-select target
        modelGroup.addModelToSelectedGroup(...this.target);

        // group selected
        const { newGroup } = modelGroup.group();

        // save new group
        this.newGroup = newGroup;
    }

    public undo() {
        const modelGroup = this.modelGroup;

        // select group
        modelGroup.unselectAllModels();
        modelGroup.addModelToSelectedGroup(this.newGroup);

        // ungroup the group
        modelGroup.ungroup({ autoStickToPlate: false });
        modelGroup.unselectAllModels();

        // remove the group from modelGroup
        modelGroup.object.remove(this.newGroup.meshObject);
        this.newGroup = null;

        // restore target models
        this.target.forEach((model) => {
            const modelSnapshot = this.modelsRelation.get(model.modelID);
            if (!modelSnapshot) {
                return;
            }

            if (model instanceof ThreeModel) {
                if (modelSnapshot.groupModelID) {
                    // model is a child of some group, then add the model to its original parent
                    const group = modelGroup.getModel(modelSnapshot.groupModelID) as ThreeGroup;
                    modelGroup.recoveryGroup(group, model);
                    group.stickToPlate();
                } else {
                    // Use previous transformation
                    model.updateTransformation(modelSnapshot.modelTransformation);
                }
            } else if (model instanceof ThreeGroup) {
                model.add(modelSnapshot.children);
                modelGroup.object.add(model.meshObject);

                model.updateTransformation(modelSnapshot.modelTransformation);
            }
        });

        // modelGroup.calaClippingMap();
        // modelGroup.childrenChanged();
    }
}
