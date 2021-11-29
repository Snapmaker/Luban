import renderModal from './renderModal';
import maxZindex from './max-zindex';
import renderPopup from './renderPopup';
import renderWidgetList from './renderWidgetList';
import { useRecoveringProject, useRenderRecoveryModal } from './pluginHooksAutoRecovery';
import { useUnsavedTitle } from './pluginUnsaveTitle';
import renderRecoveryModal from './renderRecoveryModal';
import { logPageView } from './gaEvent';

export { renderModal, maxZindex, renderPopup, renderWidgetList, renderRecoveryModal,
    useUnsavedTitle, logPageView, useRecoveringProject, useRenderRecoveryModal };

export default {
    renderModal,
    maxZindex,
    renderPopup,
    renderWidgetList,
    renderRecoveryModal,
    useRenderRecoveryModal,
    useUnsavedTitle,
    useRecoveringProject,
    logPageView
};
