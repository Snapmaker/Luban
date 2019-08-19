import classNames from 'classnames';
import _ from 'lodash';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import store from '../../store';
import Widget from '../../widgets';
import styles from './widgets.styl';

class DefaultWidgets extends Component {
    static propTypes = {
        className: PropTypes.string,
        widgets: PropTypes.array,
        toggleDefaultWidget: PropTypes.func
    };

    state = {
        defaultWidgets: store.get('workspace.container.default.widgets')
    };

    componentWillReceiveProps(nextProps) {
        if (this.props.widgets !== nextProps.widgets) {
            this.setState({
                defaultWidgets: store.get('workspace.container.default.widgets')
            });
        }
    }

    render() {
        const { className } = this.props;
        const defaultWidgets = _.slice(this.state.defaultWidgets);
        const widgets = _.map(defaultWidgets, (widgetId) => (
            <div data-widget-id={widgetId} key={widgetId}>
                <Widget
                    widgetId={widgetId}
                    onToggle={this.props.toggleDefaultWidget(widgetId)}
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
