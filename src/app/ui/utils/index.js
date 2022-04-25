import renderModal from './renderModal';
import renderPopup from './renderPopup';
import renderWidgetList from './renderWidgetList';
import { useRecoveringProject, useRenderRecoveryModal } from './pluginHooksAutoRecovery';
import { useUnsavedTitle } from './pluginUnsaveTitle';
import renderRecoveryModal from './renderRecoveryModal';
import { logPageView } from '../../lib/gaEvent';

export {
    renderModal, renderPopup, renderWidgetList, renderRecoveryModal,
    useUnsavedTitle, logPageView, useRecoveringProject, useRenderRecoveryModal
};

export default {
    renderModal,
    renderPopup,
    renderWidgetList,
    renderRecoveryModal,
    useRenderRecoveryModal,
    useUnsavedTitle,
    useRecoveringProject,
    logPageView
};
