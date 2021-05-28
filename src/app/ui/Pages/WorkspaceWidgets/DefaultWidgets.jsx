import classNames from 'classnames';
import _ from 'lodash';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Widget from '../../../widgets';
import styles from './widgets.styl';

class DefaultWidgets extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        defaultWidgets: PropTypes.array.isRequired,
        toggleFromDefault: PropTypes.func.isRequired
    };

    render() {
        const { className } = this.props;
        const defaultWidgets = _.slice(this.props.defaultWidgets);
        console.log('defaultWidgets', defaultWidgets);
        const widgets = _.map(defaultWidgets, (widgetId) => (
            <div data-widget-id={widgetId} key={widgetId}>
                <Widget
                    widgetId={widgetId}
                    onToggle={this.props.toggleFromDefault(widgetId)}
                    sortable={{
                        handleClassName: 'sortable-handle',
                        filterClassName: 'sortable-filter'
                    }}
                />
            </div>
        ));

        return (
            <div className={classNames(className, styles['default-widgets'])}>
                {widgets}
            </div>
        );
    }
}

export default DefaultWidgets;
