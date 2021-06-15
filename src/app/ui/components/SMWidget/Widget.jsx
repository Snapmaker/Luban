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
import { actions as widgetActions } from '../../../flux/widget';
import i18n from '../../../lib/i18n';


class WidgetContainer extends PureComponent {
    static propTypes = {
        children: PropTypes.object.isRequired,
        widgetId: PropTypes.string.isRequired,
        // headType: PropTypes.string,
        onRemove: PropTypes.func,
        // onToggle: PropTypes.func,
        // widgetActions: PropTypes.object,

        minimized: PropTypes.bool.isRequired,
        fullscreen: PropTypes.bool.isRequired,

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
        const { children, minimized, fullscreen } = this.props;
        // const { children, widgetId, headType, widgetActions, minimized, fullscreen, onToggle } = this.props;
        const state = {
            title: this.state.title,
            minimized: minimized,
            fullscreen: fullscreen,
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
                        {state.buttons && _.isArray(state.buttons) && state.buttons.map(v => {
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
                <Widget.Content style={{ display: state.minimized ? 'none' : 'block' }}>
                    {children}
                    {/* <WrappedWidget
                        widgetId={widgetId}
                        headType={headType}
                        pageActions={widgetActions}
                        minimized={minimized}
                        onToggle={onToggle}
                        setTitle={actions.setTitle}
                        setDisplay={actions.setDisplay}
                        setControlButtons={actions.setControlButtons}
                    /> */}
                </Widget.Content>
                {/* {WrappedFooter && (
                    <Widget.Footer>
                        <WrappedFooter
                            headType={headType}
                        />
                    </Widget.Footer>
                )} */}
            </Widget>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { widgets } = state.widget;
    const { widgetId } = ownProps;
    const { minimized = false, fullscreen = false } = widgets[widgetId] || {};
    return {
        minimized,
        fullscreen
    };
};

const mapDispatchToProps = (dispatch) => ({
    updateWidgetState: (widgetId, key, value) => dispatch(widgetActions.updateWidgetState(widgetId, key, value))
});


export default connect(mapStateToProps, mapDispatchToProps)(WidgetContainer);
