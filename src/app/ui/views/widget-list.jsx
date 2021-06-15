import classNames from 'classnames';
// import _ from 'lodash';
import React from 'react';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import Sortable from 'react-sortablejs';

import { actions as widgetActions } from '../../flux/widget';

// import { renderWidget } from '../utils';
import styles from './widgets.styl';

function WidgetList(props) {
    const { children, className = '', onDragStart, onDragEnd, tab, container } = props;

    const dispatch = useDispatch();
    const actions = {
        updateTabContainer: (value) => dispatch(widgetActions.updateTabContainer(tab, container, value))
    };

    return (
        <Sortable
            className={classNames(className, styles.widgets)}
            options={{
                animation: 150,
                delay: 0, // Touch and hold delay
                group: {
                    name: 'primary',
                    pull: true,
                    put: ['secondary']
                },
                handle: '.sortable-handle', // Drag handle selector within list items
                filter: '.sortable-filter', // Selectors that do not lead to dragging
                chosenClass: 'sortable-chosen', // Class name for the chosen item
                ghostClass: 'sortable-ghost', // Class name for the drop placeholder
                dataIdAttr: 'data-widget-id',
                onStart: onDragStart,
                onEnd: onDragEnd
            }}
            onChange={actions.updateTabContainer}
        >
            {children}
        </Sortable>
    );
}
WidgetList.propTypes = {
    tab: PropTypes.string.isRequired,
    container: PropTypes.string.isRequired,

    className: PropTypes.string,
    children: PropTypes.array.isRequired,

    // toggleToDefault: PropTypes.func.isRequired,
    onDragStart: PropTypes.func.isRequired,
    onDragEnd: PropTypes.func.isRequired
};


export default WidgetList;
