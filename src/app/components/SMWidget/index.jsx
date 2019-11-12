// SMWidget
// Snapmaker Widget, styled wrapper on top of Widget.
//

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';

import { connect } from 'react-redux';
import Widget from '../Widget';

import SMSortableHandle from './SMSortableHandle';
import SMDropdownButton from './SMDropdownButton';
import SMMinimizeButton from './SMMinimizeButton';
import { actions as widgetActions } from '../../flux/widget';
import i18n from '../../lib/i18n';


/**
 * Call WidgetState.bind(this) in constructor to initialize widgetState.
 */
class WidgetState {
    static bind(component, config) {
        if (!component.state) {
            component.state = {};
        }

        component.state = {
            ...component.state,
            fullscreen: config && config.get('fullscreen', false),
            minimized: config && config.get('minimized', false)
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

// Create widget with default layout (minimize + fullscreen)
function createDefaultWidget(WrappedWidget) {
    const mapStateToProps = (state, ownProps) => {
        const { widgets } = state.widget;
        const { widgetId } = ownProps;
        const { minimized = false, fullscreen = false, needRemove = false } = widgets[widgetId] || {};
        return {
            minimized,
            fullscreen,
            needRemove
        };
    };

    const mapDispatchToProps = (dispatch) => ({
        updateWidgetState: (widgetId, key, value) => dispatch(widgetActions.updateWidgetState(widgetId, key, value))
    });


    return connect(mapStateToProps, mapDispatchToProps)(class extends PureComponent {
        static propTypes = {
            widgetId: PropTypes.string.isRequired,
            onRemove: PropTypes.func,
            onToggle: PropTypes.func,

            minimized: PropTypes.bool.isRequired,
            fullscreen: PropTypes.bool.isRequired,
            needRemove: PropTypes.bool,

            updateWidgetState: PropTypes.func.isRequired
        };

        state = {
            title: '',
            display: true,
            buttons: ['SMMinimize', 'SMDropdown']
        };

        actions = {
            onToggleFullscreen: () => {
                const fullscreen = !this.props.fullscreen;
                const minimized = fullscreen ? this.props.minimized : false;
                this.props.updateWidgetState(this.props.widgetId, 'fullscreen', fullscreen);
                this.props.updateWidgetState(this.props.widgetId, 'minimized', minimized);
            },
            onToggleMinimized: () => {
                const minimized = !this.props.minimized;
                this.props.updateWidgetState(this.props.widgetId, 'minimized', minimized);
            },
            setTitle: (title) => {
                this.setState({ title });
            },
            onRemove: () => {
                this.props.onRemove();
            },
            setControlButtons: (buttons) => {
                if (buttons && _.isArray(buttons)) {
                    this.setState({
                        buttons
                    });
                }
            },
            setDisplay: (display) => {
                this.setState({
                    display: display
                });
            }
        };

        render() {
            const { widgetId, minimized, fullscreen, needRemove, onToggle } = this.props;
            const state = {
                title: this.state.title,
                minimized: minimized,
                fullscreen: fullscreen,
                needRemove: needRemove,
                buttons: this.state.buttons
            };
            const actions = this.actions;

            return (
                <Widget style={{ display: this.state.display ? '' : 'none' }} fullscreen={state.fullscreen}>
                    <Widget.Header>
                        <Widget.Title>
                            <SMSortableHandle />
                            {this.state.title}
                        </Widget.Title>
                        <Widget.Controls className="sortable-filter">
                            { state.buttons && _.isArray(state.buttons) && state.buttons.map(v => {
                                if (typeof v === 'object') {
                                    const { disabled = false, title = '', onClick, className = 'fa' } = v;
                                    return (
                                        <Widget.Button
                                            key={title}
                                            disabled={disabled}
                                            title={i18n._(title)}
                                            onClick={onClick}
                                        >
                                            <i
                                                className={className}
                                            />
                                        </Widget.Button>
                                    );
                                } else if (v === 'SMMinimize') {
                                    return (
                                        <SMMinimizeButton
                                            key="SMMinimize"
                                            state={state}
                                            actions={actions}
                                        />
                                    );
                                } else if (v === 'SMDropdown') {
                                    return (
                                        <SMDropdownButton
                                            key="SMDropdown"
                                            state={state}
                                            actions={actions}
                                        />
                                    );
                                }
                                return null;
                            })}
                        </Widget.Controls>
                    </Widget.Header>
                    <Widget.Content
                        style={{
                            position: 'relative',
                            padding: '18px 12px',
                            display: state.minimized ? 'none' : 'block'
                        }}
                    >
                        <WrappedWidget
                            widgetId={widgetId}
                            minimized={minimized}
                            onToggle={onToggle}
                            setTitle={actions.setTitle}
                            setDisplay={actions.setDisplay}
                            setControlButtons={actions.setControlButtons}
                        />
                    </Widget.Content>
                </Widget>
            );
        }
    });
}


export {
    createDefaultWidget,
    WidgetState,
    SMSortableHandle,
    SMMinimizeButton,
    SMDropdownButton
};
