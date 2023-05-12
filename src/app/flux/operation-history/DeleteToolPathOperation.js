import Operation from '../../core/Operation';
import { PROCESS_MODES_EXCEPT_VECTOR, PROCESS_MODE_VECTOR } from '../../constants';

export default class DeleteToolPathOperation extends Operation {
    state = {};

    constructor(state) {
        super();
        this.state = {
            target: null,
            models: null,
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
        const models = this.state.models;
        const toolPathGroup = this.state.toolPathGroup;
        const modelMode = toolPath.modelMode;
        const shouldAddToolPath = models.every((item) => {
            if (toolPath.modelMap.has(item.modelID) && (item.mode === PROCESS_MODE_VECTOR && PROCESS_MODES_EXCEPT_VECTOR.includes(modelMode))
                || (PROCESS_MODES_EXCEPT_VECTOR.includes(item.mode) && modelMode === PROCESS_MODE_VECTOR)) {
                return false;
            }
            return true;
        });
        if (shouldAddToolPath) {
            toolPathGroup.toolPaths.push(toolPath);
            toolPathGroup.toolPathObjects.add(toolPath.object);
        }
    }
}
