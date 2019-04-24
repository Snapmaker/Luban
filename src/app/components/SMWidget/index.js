// SMWidget
// Snapmaker Widget, styled wrapper on top of Widget.
//

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import Widget from '../Widget';

import SMSortableHandle from './SMSortableHandle';
import SMDropdownButton from './SMDropdownButton';
import SMMinimizeButton from './SMMinimizeButton';
import store from '../../store';


/**
 * Call WidgetState.bind(this) in constructor to initialize widgetState.
 */
class WidgetState {
    static bind(component) {
        if (!component.state) {
            component.state = {};
        }

        component.state = {
            ...component.state,
            fullscreen: false,
            minimized: false,
        };

        if (!component.actions) {
            component.actions = {};
        }

        component.actions = {
            ...component.actions,
            onToggleFullscreen: () => {
                component.setState(state => {
                    const { fullscreen, minimized } = state;
                    return {
                        fullscreen: !fullscreen,
                        minimized: fullscreen ? minimized : false
                    };
                });
            },
            onToggleMinimized: () => {
                component.setState(state => ({
                    minimized: !state.minimized
                }));
            }
        };
    }
}


/**
 * Widget configuration store.
 */
class WidgetConfig {
    widgetId = '';

    constructor(widgetId) {
        if (!widgetId) {
            throw new Error('The widget ID cannot be an empty string.');
        }
        this.widgetId = widgetId;
    }

    translateKey(key) {
        const widgetId = this.widgetId;
        return `widgets["${widgetId}"].${key}`;
    }

    get(key, defaultValue) {
        key = this.translateKey(key);
        return store.get(key, defaultValue);
    }

    set(key, value) {
        key = this.translateKey(key);
        return store.set(key, value);
    }

    unset(key) {
        key = this.translateKey(key);
        return store.unset(key);
    }

    replace(key, value) {
        key = this.translateKey(key);
        return store.replace(key, value);
    }
}

// Create widget with default layout (minimize + fullscreen)
function createDefaultWidget(WrappedWidget) {
    return class extends PureComponent {
        static propTypes = {
            widgetId: PropTypes.string.isRequired,
            title: PropTypes.string.isRequired
        };

        config = new WidgetConfig(this.props.widgetId);

        constructor(props) {
            super(props);
            WidgetState.bind(this);
        }

        render() {
            const state = this.state;
            const actions = this.actions;

            return (
                <Widget fullscreen={state.fullscreen}>
                    <Widget.Header>
                        <Widget.Title>
                            <SMSortableHandle />
                            {this.props.title}
                        </Widget.Title>
                        <Widget.Controls className="sortable-filter">
                            <SMMinimizeButton state={state} actions={actions} />
                            <SMDropdownButton state={state} actions={actions} />
                        </Widget.Controls>
                    </Widget.Header>
                    <Widget.Content
                        style={{
                            position: 'relative',
                            padding: '18px 12px',
                            display: state.minimized ? 'none' : 'block'
                        }}
                    >
                        <WrappedWidget config={this.config} />
                    </Widget.Content>
                </Widget>
            );
        }
    };
}


export {
    createDefaultWidget,
    WidgetState,
    WidgetConfig,
    SMSortableHandle,
    SMMinimizeButton,
    SMDropdownButton
};
