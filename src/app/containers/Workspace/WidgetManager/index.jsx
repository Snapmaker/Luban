import React from 'react';
import ReactDOM from 'react-dom';
import WidgetManager from './WidgetManager';

// export const getActiveWidgets = () => {
//     const defaultWidgets = store.get('workspace.default.widgets', [])
//         .map(widgetId => widgetId.split(':')[0]);
//     const primaryWidgets = store.get('workspace.primary.widgets', [])
//         .map(widgetId => widgetId.split(':')[0]);
//     const secondaryWidgets = store.get('workspace.secondary.widgets', [])
//         .map(widgetId => widgetId.split(':')[0]);
//     return _.union(defaultWidgets, primaryWidgets, secondaryWidgets);
// };
//
// export const getInactiveWidgets = () => {
//     const allWidgets = Object.keys(defaultState.widgets);
//     const defaultWidgets = store.get('workspace.default.widgets', [])
//         .map(widgetId => widgetId.split(':')[0]);
//     const primaryWidgets = store.get('workspace.primary.widgets', [])
//         .map(widgetId => widgetId.split(':')[0]);
//     const secondaryWidgets = store.get('workspace.secondary.widgets', [])
//         .map(widgetId => widgetId.split(':')[0]);
//     return _.difference(allWidgets, defaultWidgets, primaryWidgets, secondaryWidgets);
// };

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
