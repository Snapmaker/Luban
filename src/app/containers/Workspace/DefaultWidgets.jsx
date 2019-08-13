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
        renderStamp: PropTypes.number,
        onToggleWidget: PropTypes.func.isRequired
    };

    state = {
        widgets: store.get('workspace.container.primary.widgets'),
        defaultWidgets: store.get('workspace.container.default.widgets')
    };

    componentWillReceiveProps(nextProps) {
        if (this.props.renderStamp !== nextProps.renderStamp) {
            this.setState({
                defaultWidgets: store.get('workspace.container.default.widgets')
            });
        }
    }

    componentDidUpdate() {
        this.state.widgets = store.get('workspace.container.primary.widgets');
        this.state.defaultWidgets = store.get('workspace.container.default.widgets');
    }

    toggleWidget = (widgetId) => () => {
        const defaultWidgets = _.slice(this.state.defaultWidgets);
        _.remove(defaultWidgets, (n) => (n === widgetId));
        this.setState({ defaultWidgets: defaultWidgets });
        store.replace('workspace.container.default.widgets', defaultWidgets);

        const widgets = _.slice(this.state.widgets);
        _.remove(widgets, (n) => (n === widgetId));
        widgets.push(widgetId);
        this.setState({ widgets: widgets });
        store.replace('workspace.container.primary.widgets', widgets);
        this.props.onToggleWidget(widgetId);
    };

    render() {
        const { className } = this.props;
        const defaultWidgets = _.slice(this.state.defaultWidgets);
        const widgets = _.map(defaultWidgets, (widgetId) => (
            <div data-widget-id={widgetId} key={widgetId}>
                <Widget
                    widgetId={widgetId}
                    onToggle={this.toggleWidget(widgetId)}
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
    }
}

export default DefaultWidgets;
