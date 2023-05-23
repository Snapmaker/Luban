import * as THREE from 'three';
import ThreeModel from '../../models/ThreeModel';
import Operation from '../../core/Operation';

type StateMap = {
    target: ThreeModel,
    previousFaceMarks: Array<number>,
    previousSupport: THREE.Mesh,
    currentSupport: THREE.Mesh,
    currentFaceMarks: Array<number>
};

export default class AddSupportsOpertation3D extends Operation<StateMap> {
    public constructor(state: StateMap) {
        super();
        this.state = state;
    }

    public redo() {
        this.state.target.meshObject.clear();
        this.state.target.meshObject.add(this.state.currentSupport);
        this.state.target.supportFaceMarks = this.state.currentFaceMarks;
    }

    public undo() {
        this.state.target.meshObject.clear();
        this.state.target.meshObject.add(this.state.previousSupport);
        this.state.target.supportFaceMarks = this.state.previousFaceMarks;
    }
}
