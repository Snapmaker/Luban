import { widgetStore } from '../../store/local-storage';
import WidgetState from './WidgetState';


const localWidgetStore = widgetStore || {};
const localWidgetState = new WidgetState(localWidgetStore.state);

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

    updateTabContainer: (tab, container, value) => (dispatch, getState) => {
        const { widgetState } = getState().widget;
        const state = widgetState.updateTabContainer(tab, container, value);
        state && dispatch(actions.updateState(state));
        widgetStore.setState(localWidgetState.widgetState);
    },

    updateWidgetState: (widgetId, key, value) => (dispatch, getState) => {
        const { widgetState } = getState().widget;
        const state = widgetState.setWidgetState(widgetId, key, value);
        state && dispatch(actions.updateState(state));
        widgetStore.setState(localWidgetState.widgetState);
    },

    updateMachineSeries: (series) => (dispatch, getState) => {
        const { widgetState } = getState().widget;
        const state = widgetState.updateSeries(series);
        state && dispatch(actions.updateState(state));
        widgetStore.setState(localWidgetState.widgetState);
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
