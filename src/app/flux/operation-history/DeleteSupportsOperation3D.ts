import * as THREE from 'three';
import ThreeModel from '../../models/ThreeModel';
import Operation from './Operation';

type StateMap = {
    target: ThreeModel,
    support: THREE.Mesh,
    faceMarks: Array<number>
};

export default class DeleteSupportsOperation3D extends Operation<StateMap> {
    constructor(state: StateMap) {
        super();
        this.state = state;
    }

    redo() {
        this.state.target.meshObject.clear();
        this.state.target.supportFaceMarks = [];
        this.state.target.stickToPlate();
    }

    undo() {
        this.state.target.meshObject.add(this.state.support);
        this.state.target.supportFaceMarks = this.state.faceMarks;
        this.state.target.stickToPlate();
    }
}
