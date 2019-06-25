import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import store, { defaultState } from '../../../store';
import WidgetManager from './WidgetManager';

export const getActiveWidgets = () => {
    const defaultWidgets = store.get('workspace.container.default.widgets', [])
        .map(widgetId => widgetId.split(':')[0]);
    const primaryWidgets = store.get('workspace.container.primary.widgets', [])
        .map(widgetId => widgetId.split(':')[0]);
    const secondaryWidgets = store.get('workspace.container.secondary.widgets', [])
        .map(widgetId => widgetId.split(':')[0]);
    return _.union(defaultWidgets, primaryWidgets, secondaryWidgets);
};

export const getInactiveWidgets = () => {
    const allWidgets = Object.keys(defaultState.widgets);
    const defaultWidgets = store.get('workspace.container.default.widgets', [])
        .map(widgetId => widgetId.split(':')[0]);
    const primaryWidgets = store.get('workspace.container.primary.widgets', [])
        .map(widgetId => widgetId.split(':')[0]);
    const secondaryWidgets = store.get('workspace.container.secondary.widgets', [])
        .map(widgetId => widgetId.split(':')[0]);
    return _.difference(allWidgets, defaultWidgets, primaryWidgets, secondaryWidgets);
};

// @param {string} targetContainer The target container: primary|secondary
export const show = (callback) => {
    const el = document.body.appendChild(document.createElement('div'));
    const handleClose = () => {
        ReactDOM.unmountComponentAtNode(el);
        setTimeout(() => {
            el.remove();
        }, 0);
    };

    ReactDOM.render(<WidgetManager onSave={callback} onClose={handleClose} />, el);
};
