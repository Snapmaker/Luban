import ThreeModel from '../../models/ThreeModel';
import Operation from './Operation';
/* eslint-disable import/no-cycle */
import { actions as printingActions } from '../printing';

type StateMap = {
    target: ThreeModel, // model finish simplify
    sourceSimplify: string,
    simplifyResultFimeName: string,
    dispatch: any,
    sourcePly: string;
    resultSourcePly: string;
};

export default class SimplifyModelOperation extends Operation<StateMap> {
    public constructor(state: StateMap) {
        super();
        this.state = state;
    }

    public async redo() {
        const { simplifyResultFimeName, target: { modelID }, dispatch } = this.state;

        this.state.target.sourcePly = this.state.resultSourcePly;

        await dispatch(printingActions.updateModelMesh([{
            modelID,
            uploadName: simplifyResultFimeName,
            reloadSimplifyModel: true
        }]));
    }

    public async undo() {
        const { sourceSimplify, target: { modelID }, dispatch } = this.state;

        this.state.target.sourcePly = this.state.sourcePly;

        await dispatch(printingActions.updateModelMesh([{
            modelID,
            uploadName: sourceSimplify,
            reloadSimplifyModel: true
        }]));
    }
}
