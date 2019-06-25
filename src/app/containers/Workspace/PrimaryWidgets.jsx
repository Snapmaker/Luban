import classNames from 'classnames';
import _ from 'lodash';
import pubsub from 'pubsub-js';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Sortable from 'react-sortablejs';
import uuid from 'uuid';
import confirm from '../../lib/confirm';
import i18n from '../../lib/i18n';
import log from '../../lib/log';
import store from '../../store';
import Widget from '../../widgets';
import styles from './widgets.styl';


/**
 * Primary Widgets
 *
 * Widget container on the left of workspace.
 */
class PrimaryWidgets extends Component {
    static propTypes = {
        className: PropTypes.string,

        onForkWidget: PropTypes.func.isRequired,
        onRemoveWidget: PropTypes.func.isRequired,
        onDragStart: PropTypes.func.isRequired,
        onDragEnd: PropTypes.func.isRequired
    };

    state = {
        widgets: store.get('workspace.container.primary.widgets')
    };

    pubsubTokens = [];

    componentDidMount() {
        this.subscribe();
    }

    shouldComponentUpdate(nextProps, nextState) {
        // Do not compare props for performance considerations
        return !_.isEqual(nextState, this.state);
    }

    componentDidUpdate() {
        const { widgets } = this.state;

        // Calling store.set() will merge two different arrays into one.
        // Remove the property first to avoid duplication.
        store.replace('workspace.container.primary.widgets', widgets);
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    forkWidget = (widgetId) => () => {
        confirm({
            title: i18n._('Fork Widget'),
            body: i18n._('Are you sure you want to fork this widget?')
        }).then(() => {
            const name = widgetId.split(':')[0];
            if (!name) {
                log.error(`Failed to fork widget: widgetId=${widgetId}`);
                return;
            }

            // Use the same widget settings in a new widget
            const forkedWidgetId = `${name}:${uuid.v4()}`;
            const defaultSettings = store.get(`widgets["${name}"]`);
            const clonedSettings = store.get(`widgets["${widgetId}"]`, defaultSettings);
            store.set(`widgets["${forkedWidgetId}"]`, clonedSettings);

            const widgets = _.slice(this.state.widgets);
            widgets.push(forkedWidgetId);
            this.setState({ widgets: widgets });

            this.props.onForkWidget(widgetId);
        });
    };

    removeWidget = (widgetId) => () => {
        confirm({
            title: i18n._('Remove Widget'),
            body: i18n._('Are you sure you want to remove this widget?')
        }).then(() => {
            const widgets = _.slice(this.state.widgets);
            _.remove(widgets, (n) => (n === widgetId));
            this.setState({ widgets: widgets });

            if (widgetId.match(/\w+:[\w-]+/)) {
                // Remove forked widget settings
                store.unset(`widgets["${widgetId}"]`);
            }

            this.props.onRemoveWidget(widgetId);
        });
    };

    subscribe() {
        // updatePrimaryWidgets
        const token = pubsub.subscribe('updatePrimaryWidgets', (msg, widgets) => {
            this.setState({ widgets: widgets });
        });
        this.pubsubTokens.push(token);
    }

    unsubscribe() {
        this.pubsubTokens.forEach(token => {
            pubsub.unsubscribe(token);
        });
        this.pubsubTokens = [];
    }

    render() {
        const { className = '' } = this.props;

        const widgets = this.state.widgets
            .map(widgetId => (
                <div data-widget-id={widgetId} key={widgetId}>
                    <Widget
                        widgetId={widgetId}
                        onFork={this.forkWidget(widgetId)}
                        onRemove={this.removeWidget(widgetId)}
                        sortable={{
                            handleClassName: 'sortable-handle',
                            filterClassName: 'sortable-filter'
                        }}
                    />
                </div>
            ));

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
                    onStart: this.props.onDragStart,
                    onEnd: this.props.onDragEnd
                }}
                onChange={(order) => {
                    this.setState({ widgets: order });
                }}
            >
                {widgets}
            </Sortable>
        );
    }
}

export default PrimaryWidgets;
