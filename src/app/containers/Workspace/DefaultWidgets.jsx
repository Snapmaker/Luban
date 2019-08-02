import classNames from 'classnames';
// import _ from 'lodash';
import React from 'react';
import PropTypes from 'prop-types';
// import store from '../../store';
import Widget from '../../widgets';
import styles from './widgets.styl';

const DefaultWidgets = (props) => {
    const { className } = props;
    /*
    const defaultWidgets = store.get('workspace.container.default.widgets');
    console.log('dd ', defaultWidgets);
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

    const { consoleExpanded } = props;
    let widgetId = 'visualizer';
    // const s1 = 'visualizer';
    // const s1 = 'console';
    // if (s1 === 'visualizer') {
    if (!consoleExpanded) {
        return (
            <div className={classNames(className, styles.widgets)}>
                <div data-widget-id={widgetId} key={widgetId}>
                    <Widget
                        widgetId={widgetId}
                    />
                </div>
            </div>
        );
    } else {
        widgetId = 'console';
        return (
            <div className={classNames(className, styles.widgets)}>
                <div data-widget-id={widgetId} key={widgetId}>
                    <Widget
                        widgetId={widgetId}
                        sortable={{
                            handleClassName: 'sortable-handle',
                            filterClassName: 'sortable-filter'
                        }}
                    />
                </div>
            </div>
        );
    }
};

DefaultWidgets.propTypes = {
    className: PropTypes.string
};

export default DefaultWidgets;
