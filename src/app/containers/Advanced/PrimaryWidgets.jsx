import classNames from 'classnames';
import includes from 'lodash/includes';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Sortable from 'react-sortablejs';
import Widget from '../../widgets';
import styles from './widgets.styl';

// Widget container on the left of workspace.
class PrimaryWidgets extends PureComponent {
    static propTypes = {
        className: PropTypes.string,
        defaultWidgets: PropTypes.array.isRequired,
        primaryWidgets: PropTypes.array.isRequired
    };

    // avoid using nested state or props in purecomponent
    state = {
        primaryWidgets: this.props.primaryWidgets
    };

    actions = {
        changeWidgetOrder: (primaryWidgets) => {
            this.setState({ primaryWidgets });
        }
    };

    render() {
        const { changeWidgetOrder } = this.actions;
        const { className = '', defaultWidgets } = this.props;
        const widgets = this.state.primaryWidgets
            .map(widgetId => (
                <div
                    data-widget-id={widgetId}
                    key={widgetId}
                    style={{ display: includes(defaultWidgets, widgetId) ? 'block' : 'block' }}
                >
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
                    dataIdAttr: 'data-widget-id'
                }}
                onChange={changeWidgetOrder}
            >
                {widgets}
            </Sortable>
        );
    }
}

export default PrimaryWidgets;
