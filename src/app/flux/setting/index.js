import api from '../../api';
import { HEAD_3DP, HEAD_CNC, HEAD_LASER } from '../../constants';
import storeManager from '../../store/local-storage';
import { actions as printingActions } from '../printing';
import { actions as projectActions } from '../project';

export const actions = {
    resetAllUserSettings: () => async (dispatch) => {
        // api.removeElectronData();
        dispatch(projectActions.cleanAllRecentFiles());
        // remove recovery modelState
        api.removeEnv({
            headType: HEAD_CNC
        });
        api.removeEnv({
            headType: HEAD_LASER
        });
        api.removeEnv({
            headType: HEAD_3DP
        });
        dispatch(printingActions.removeAllModels());

        // remove material setting config
        dispatch(printingActions.removeAllMaterialDefinition());

        // remove quality setting config
        dispatch(printingActions.removeAllQualityDefinition());

        // reset basic store
        storeManager.clear();
    }
};

export default function reducer(state) {
    return state;
}
