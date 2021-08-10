import renderModal from './renderModal';
import renderPopup from './renderPopup';
import renderWidgetList from './renderWidgetList';
import { useRecoveringProject, useRenderRecoveryModal } from './pluginHooksAutoRecovery';
import { useUnsavedTitle } from './pluginUnsaveTitle';
import renderRecoveryModal from './renderRecoveryModal';

export { renderModal, renderPopup, renderWidgetList, renderRecoveryModal,
    useUnsavedTitle, useRecoveringProject, useRenderRecoveryModal };

export default {
    renderModal,
    renderPopup,
    renderWidgetList,
    renderRecoveryModal,
    useRenderRecoveryModal,
    useUnsavedTitle,
    useRecoveringProject
};
