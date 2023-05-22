import ThreeModel from '../../models/ThreeModel';
import Operation from '../../core/Operation';
/* eslint-disable import/no-cycle */
import type { DispatchType } from '../../flux/index.def';
import { actions as printingActions } from '../../flux/printing';

type StateMap = {
    target: ThreeModel, // model finish simplify
    sourceSimplify: string,
    simplifyResultFimeName: string,
    dispatch: DispatchType,
};

export default class SimplifyModelOperation extends Operation<StateMap> {
    public constructor(state: StateMap) {
        super();
        this.state = state;
    }

    public async redo() {
        const { simplifyResultFimeName, target: { modelID }, dispatch } = this.state;

        await dispatch(printingActions.updateModelMesh([{
            modelID,
            uploadName: simplifyResultFimeName,
            reloadSimplifyModel: true
        }]));
    }

    public async undo() {
        const { sourceSimplify, target: { modelID }, dispatch } = this.state;

        await dispatch(printingActions.updateModelMesh([{
            modelID,
            uploadName: sourceSimplify,
            reloadSimplifyModel: true
        }]));
    }
}
