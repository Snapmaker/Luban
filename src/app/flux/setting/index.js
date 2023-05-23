import api from '../../api';
import { HEAD_PRINTING, HEAD_CNC, HEAD_LASER } from '../../constants';
import log from '../../lib/log';
import storeManager from '../../store/local-storage';
import { actions as printingActions } from '../printing';
import { actions as projectActions } from '../project';
import UniApi from '../../lib/uni-api';
import i18n from '../../lib/i18n';

export const actions = {
    resetAllUserSettings: () => async (dispatch) => {
        // macros
        try {
            let res = await api.macros.fetch();
            const { records: macros } = res.body;
            for (const macro of macros) {
                res = await api.macros.delete(macro.id);
            }
        } catch (err) {
            // Ignore error
        }
        dispatch(printingActions.removeAllModels());

        // remove material setting config
        dispatch(printingActions.removeAllMaterialDefinitions());

        // remove quality setting config
        dispatch(printingActions.removeAllQualityDefinitions());


        // api.removeElectronData();
        dispatch(projectActions.cleanAllRecentFiles());
        // remove recovery modelState
        api.env.removeEnv({
            headType: HEAD_CNC
        });
        api.env.removeEnv({
            headType: HEAD_LASER
        });
        api.env.removeEnv({
            headType: HEAD_PRINTING
        });
        // reset basic store
        storeManager.clear();
    },

    resetUserConfig: () => (dispatch) => {
        api.resetUserConfig().then(() => {
            storeManager.clear();
            window.localStorage.clear();
            i18n.clearCookies();
            dispatch(projectActions.cleanAllRecentFiles());
            UniApi.Window.forceReload();
        }).catch((e) => {
            log.info(e);
        });
    },

    /**
     * Reset print configurations only.
     */
    resetPrintConfigurations: () => async () => {
        try {
            await api.resetPrintConfig();
            UniApi.Window.forceReload();
        } catch (e) {
            log.error(e);
        }
    },

    downloadLogs: () => async () => {
        UniApi.Event.emit('appbar-menu:download-log');
    },

    longTermBackupConfig: () => () => {
        api.longTermBackupConfig();
    }
};

export default function reducer(state) {
    return state;
}
