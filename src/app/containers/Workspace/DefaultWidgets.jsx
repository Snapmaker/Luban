import classNames from 'classnames';
// import _ from 'lodash';
import React from 'react';
import PropTypes from 'prop-types';
// import store from '../../store';
import Widget from '../../widgets';
import styles from './widgets.styl';
import SecondaryToolbar from '../../widgets/CanvasToolbar/SecondaryToolbar';

const DefaultWidgets = (props) => {
    // const { className } = props;
    const { className, consoleExpanded } = props;
    /*
    const defaultWidgets = store.get('workspace.container.default.widgets');
    const widgets = _.map(defaultWidgets, (widgetId) => (
        <div data-widget-id={widgetId} key={widgetId}>
            <Widget
                widgetId={widgetId}
                sortable={{
                    handleClassName: 'sortable-handle',
                    filterClassName: 'sortable-filter'
                }}
            />
        </div>
    ));

    return (
        <div className={classNames(className, styles.widgets)}>
            {widgets}
        </div>
    );
    */

    const widgetVisualizer = 'visualizer';
    const widgetConsole = 'console';
    return (
        <div className={classNames(className, styles.widgets)}>
            <div
                data-widget-id={widgetConsole}
                key={widgetConsole}
                style={{
                    visibility: consoleExpanded ? 'visible' : 'hidden'
                }}
            >
                <Widget
                    widgetId={widgetConsole}
                    sortable={{
                        handleClassName: 'sortable-handle',
                        filterClassName: 'sortable-filter'
                    }}
                />
            </div>
            <div
                data-widget-id={widgetVisualizer}
                key={widgetVisualizer}
                style={{
                    visibility: consoleExpanded ? 'hidden' : 'visible'
                }}
            >
                <Widget
                    widgetId={widgetVisualizer}
                />
            </div>
            <div className={styles['canvas-footer']}>
                <SecondaryToolbar />
            </div>
        </div>
    );
};

DefaultWidgets.propTypes = {
    className: PropTypes.string,
    consoleExpanded: PropTypes.bool
};

export default DefaultWidgets;
