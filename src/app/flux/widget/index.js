import { widgetStore } from '../../store/local-storage';
import WidgetState from './WidgetState';

const localWidgetState = new WidgetState(widgetStore);

const INITIAL_STATE = {
    widgetState: localWidgetState,
    ...localWidgetState.getState()
};

const ACTION_UPDATE_STATE = 'widget/ACTION_UPDATE_STATE';

export const actions = {
    // Update state directly
    updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },

    /**
     * Update widget array of tab's container.
     *
     * @param tab One of workspace, 3dp, laser, cnc
     * @param container One of default, primary, secondary
     * @param value
     * @returns {Function}
     */
    updateTabContainer: (tab, container, value) => (dispatch, getState) => {
        const { widgetState } = getState().widget;
        const state = widgetState.updateTabContainer(tab, container, value);
        state && dispatch(actions.updateState(state));
    },

    updateWidgetState: (widgetId, key, value) => (dispatch, getState) => {
        const { widgetState } = getState().widget;
        const state = widgetState.setWidgetState(widgetId, key, value);
        state && dispatch(actions.updateState(state));
    },

    updateMachineSeries: (series) => (dispatch, getState) => {
        const { widgetState } = getState().widget;
        const state = widgetState.updateSeries(series);
        state && dispatch(actions.updateState(state));
    },

    toggleWorkspaceWidgetToDefault: (widgetId) => (dispatch, getState) => {
        const { widgetState } = getState().widget;
        const state = widgetState.toggleWorkspaceWidgetToDefault(widgetId);
        state && dispatch(actions.updateState(state));
    }

};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE:
            return Object.assign({}, state, action.state);

        default:
            return state;
    }
}
