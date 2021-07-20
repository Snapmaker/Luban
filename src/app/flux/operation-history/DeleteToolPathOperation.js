import Operation from './Operation';

export default class DeleteToolPathOperation extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            target: null,
            toolPathGroup: null,
            ...state
        };
    }

    redo() {
        const toolPath = this.state.target;
        const toolPathGroup = this.state.toolPathGroup;
        toolPathGroup.deleteToolPath(toolPath.id);
    }

    undo() {
        const toolPath = this.state.target;
        const toolPathGroup = this.state.toolPathGroup;
        toolPathGroup.toolPaths.push(toolPath);
        toolPathGroup.toolPathObjects.add(toolPath.object);
    }
}
