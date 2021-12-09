import type ModelGroup from '../../models/ModelGroup';
import type ThreeGroup from '../../models/ThreeGroup';
import type ThreeModel from '../../models/ThreeModel';
import Operation from './Operation';


type UngroupState = {
    target: ThreeGroup
    subModels: ThreeModel[]
    modelGroup: ModelGroup
};
export default class UngroupOperation3D extends Operation {
    state: UngroupState;

    constructor(state) {
        super();
        this.state = {
            target: null,
            subModels: [],
            modelGroup: null,
            ...state
        };
    }

    redo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;

        modelGroup.unselectAllModels();
        modelGroup.addModelToSelectedGroup(target);
        modelGroup.ungroup();
        modelGroup.unselectAllModels();
    }

    undo() {
        const target = this.state.target;
        const modelGroup = this.state.modelGroup;
        const subModels = this.state.subModels;

        modelGroup.unselectAllModels();
        const children = [], others = [];
        modelGroup.getModels().forEach(model => {
            if (subModels.indexOf(model) > -1) {
                children.push(model);
            } else {
                others.push(model);
            }
        });
        if (children) {
            target.add(children);
            modelGroup.object.add(target.meshObject);
            modelGroup.models = [...others, target];
        }
    }
}
