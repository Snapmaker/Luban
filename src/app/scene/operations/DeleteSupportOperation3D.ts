import * as THREE from 'three';
import ThreeModel from '../../models/ThreeModel';
import Operation from '../../core/Operation';

type StateMap = {
    target: ThreeModel,
    support: THREE.Mesh,
    faceMarks: Array<number>
};

export default class DeleteSupportsOperation3D extends Operation<StateMap> {
    public constructor(state: StateMap) {
        super();
        this.state = state;
    }

    public redo() {
        this.state.target.meshObject.clear();
        this.state.target.supportFaceMarks = [];
        this.state.target.stickToPlate();
    }

    public undo() {
        this.state.target.meshObject.add(this.state.support);
        this.state.target.supportFaceMarks = this.state.faceMarks;
        this.state.target.stickToPlate();
    }
}
