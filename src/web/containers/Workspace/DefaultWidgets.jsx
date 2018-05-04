import classNames from 'classnames';
import _ from 'lodash';
import React from 'react';
import store from '../../store';
import Widget from '../../widgets';
import styles from './widgets.styl';

const DefaultWidgets = (props) => {
    const { className } = props;
    const defaultWidgets = store.get('workspace.container.default.widgets');
    const widgets = _.map(defaultWidgets, (widgetId) => (
        <div data-widget-id={widgetId} key={widgetId}>
            <Widget
                widgetId={widgetId}
            />
        </div>
    ));

    return (
        <div className={classNames(className, styles.widgets)}>
            {widgets}
        </div>
    );
};

export default DefaultWidgets;
