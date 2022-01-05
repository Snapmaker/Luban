import * as THREE from 'three';
import ThreeModel from '../../models/ThreeModel';
import Operation from './Operation';

type StateMap = {
    target: ThreeModel,
    previousFaceMarks: Array<number>,
    previousSupport: THREE.Mesh,
    currentSupport: THREE.Mesh,
    currentFaceMarks: Array<number>
};

export default class AddSupportsOpertation3D extends Operation<StateMap> {
    constructor(state: StateMap) {
        super();
        this.state = state;
    }

    redo() {
        this.state.target.meshObject.clear();
        this.state.target.meshObject.add(this.state.currentSupport);
        this.state.target.supportFaceMarks = this.state.currentFaceMarks;
    }

    undo() {
        this.state.target.meshObject.clear();
        this.state.target.meshObject.add(this.state.previousSupport);
        this.state.target.supportFaceMarks = this.state.previousFaceMarks;
    }
}
