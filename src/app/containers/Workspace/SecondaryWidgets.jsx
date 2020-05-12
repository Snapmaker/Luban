import classNames from 'classnames';
import _ from 'lodash';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Sortable from 'react-sortablejs';
import confirm from '../../lib/confirm';
import i18n from '../../lib/i18n';
import Widget from '../../widgets';
import styles from './widgets.styl';


// Widget container on the right of workspace.
class SecondaryWidgets extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        defaultWidgets: PropTypes.array.isRequired,
        secondaryWidgets: PropTypes.array.isRequired,

        toggleToDefault: PropTypes.func.isRequired,
        onRemoveWidget: PropTypes.func.isRequired,
        onDragStart: PropTypes.func.isRequired,
        onDragEnd: PropTypes.func.isRequired,
        updateTabContainer: PropTypes.func.isRequired
    };

    removeWidget = (widgetId) => () => {
        confirm({
            title: i18n._('Remove Widget'),
            body: i18n._('Are you sure you want to remove this widget?')
        }).then(() => {
            const widgets = _.slice(this.props.secondaryWidgets);
            _.remove(widgets, (n) => (n === widgetId));
            this.onChangeWidgetOrder(widgets);

            if (widgetId.match(/\w+:[\w-]+/)) {
                // Remove forked widget settings
                this.onChangeWidgetOrder([]);
            }

            this.props.onRemoveWidget(widgetId);
        });
    };

    onChangeWidgetOrder = (widgets) => {
        this.props.updateTabContainer('secondary', { widgets: widgets });
    };

    render() {
        const { className = '', defaultWidgets } = this.props;
        const widgets = this.props.secondaryWidgets
            .map(widgetId => (
                <div
                    data-widget-id={widgetId}
                    key={widgetId}
                    style={{ display: _.includes(defaultWidgets, widgetId) ? 'none' : 'block' }}
                >
                    <Widget
                        widgetId={widgetId}
                        onRemove={this.removeWidget(widgetId)}
                        onToggle={this.props.toggleToDefault(widgetId)}
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
                        name: 'secondary',
                        pull: true,
                        put: ['primary']
                    },
                    handle: '.sortable-handle', // Drag handle selector within list items
                    filter: '.sortable-filter', // Selectors that do not lead to dragging
                    chosenClass: 'sortable-chosen', // Class name for the chosen item
                    ghostClass: 'sortable-ghost', // Class name for the drop placeholder
                    dataIdAttr: 'data-widget-id',
                    onStart: this.props.onDragStart,
                    onEnd: this.props.onDragEnd
                }}
                onChange={this.onChangeWidgetOrder}
            >
                {widgets}
            </Sortable>
        );
    }
}

export default SecondaryWidgets;
