import * as THREE from 'three';
import { find } from 'lodash';
import ModelGroup from '../../models/ModelGroup';
import { ModelTransformation } from '../../models/ThreeBaseModel';
import ThreeModel from '../../models/ThreeModel';
import Operation from './Operation';

type StateMap = {
    originModel: ThreeModel,
    target: ThreeModel, // model finish simplify
    modelGroup: ModelGroup,
    transformation: ModelTransformation
};

export default class SimplifyModelOperation extends Operation<StateMap> {
    public constructor(state: StateMap) {
        super();
        this.state = state;
    }

    public redo() {
        const { modelGroup, originModel: { modelID }, target, transformation: { positionX, positionY, positionZ } } = this.state;
        const simplifyModel = find(modelGroup.models, { modelID: modelID });
        modelGroup.removeModel(simplifyModel);
        const translatePosition = new THREE.Vector3(positionX, positionY, positionZ);
        modelGroup.models = modelGroup.models.concat(target);
        target.meshObject.position.copy(translatePosition);
        modelGroup.object.add(target.meshObject);
        modelGroup.modelChanged();
    }

    public undo() {
        const { modelGroup, originModel, target: { modelID }, transformation: { positionX, positionY, positionZ } } = this.state;
        const simplifyModel = find(modelGroup.models, { modelID: modelID });
        modelGroup.removeModel(simplifyModel);
        const translatePosition = new THREE.Vector3(positionX, positionY, positionZ);
        modelGroup.models = modelGroup.models.concat(originModel);
        originModel.meshObject.position.copy(translatePosition);
        modelGroup.object.add(originModel.meshObject);
        modelGroup.modelChanged();
    }
}
