export default class MoveOperation3D {
    state = {};

    description = 'MoveOperation3D';

    constructor(state) {
        this.state = {
            ...state
        };
    }

    mergePreviousOperation(prevOperation) {
        console.log('mergePreviousOperation', prevOperation);
    }

    redo() {

    }

    undo() {
        
    }
}
