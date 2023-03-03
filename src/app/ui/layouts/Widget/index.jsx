// Widget Layout: display a view as SMWidget

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Widget from '../../components/Widget';
import SvgIcon from '../../components/SvgIcon';
// import Anchor from '../../components/Anchor';

// import SMSortableHandle from './SMSortableHandle';
// import SMDropdownButton from './SMDropdownButton';
import SMMinimizeButton from './SMMinimizeButton';
import { actions as widgetActions } from '../../../flux/widget';
import i18n from '../../../lib/i18n';


class WidgetContainer extends PureComponent {
    static propTypes = {
        // function|object, some component is wraped with connect/withRouter
        component: PropTypes.any.isRequired,
        widgetId: PropTypes.string.isRequired,
        widgetProps: PropTypes.object.isRequired,
        onRemove: PropTypes.func,
        onToggle: PropTypes.func,
        // widgetActions: PropTypes.object,
        controlActions: PropTypes.object,

        minimized: PropTypes.bool.isRequired,
        fullscreen: PropTypes.bool.isRequired,

        updateWidgetState: PropTypes.func.isRequired
    };

    state = {
        title: '',
        display: true,
        buttons: ['SMMinimize']
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
        // const { component: Component, minimized, fullscreen } = this.props;
        const { widgetId, component: Component, minimized, fullscreen, widgetProps, controlActions } = this.props;

        const state = {
            title: this.state.title,
            minimized: minimized,
            fullscreen: fullscreen,
            buttons: this.state.buttons
        };
        const actions = this.actions;
        return (
            <Widget
                className={classNames(
                    'padding-bottom-16',
                    {
                        'border-bottom-normal': !['toolpath-list', 'laser-params'].includes(widgetId),
                    }
                )}
                style={{
                    display: this.state.display ? 'block' : 'none',
                    margin: '16px',
                }}
                fullscreen={state.fullscreen}
            >
                {state.title && (
                    <div className="sm-flex height-32 justify-space-between">
                        <span className="sm-flex-width heading-3">{i18n._(state.title)}</span>
                        <div>
                            {state.buttons && _.isArray(state.buttons) && state.buttons.map(v => {
                                if (typeof v === 'object') {
                                    const { disabled = false, title = '', onClick, className = '', name = 'CopyNomral', type = ['hoverNormal', 'pressNormal'] } = v;
                                    return (
                                        <SvgIcon
                                            key={title}
                                            disabled={disabled}
                                            name={name}
                                            className={className}
                                            title={i18n._(title)}
                                            onClick={onClick}
                                            type={type}
                                        />
                                    );
                                } else if (v === 'SMMinimize') {
                                    return (
                                        <SMMinimizeButton
                                            key="SMMinimize"
                                            className="margin-left-4"
                                            state={state}
                                            actions={actions}
                                        />
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                )}
                <Widget.Content style={{ display: state.minimized ? 'none' : 'block', padding: '0', border: 'none' }}>
                    <Component
                        isWidget
                        widgetActions={this.actions}
                        controlActions={controlActions}
                        {...widgetProps}
                        widgetId={widgetId}
                        // minimized={minimized}
                        // onToggle={onToggle}
                        // setTitle={actions.setTitle}
                        // setDisplay={actions.setDisplay}
                        // setControlButtons={actions.setControlButtons}

                    />
                </Widget.Content>
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
