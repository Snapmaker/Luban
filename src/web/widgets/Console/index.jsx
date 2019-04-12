import classNames from 'classnames';
import pubsub from 'pubsub-js';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import settings from '../../config/settings';
import Widget from '../../components/Widget';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import WidgetConfig from '../WidgetConfig';
import Console from './Console';
import styles from './index.styl';
import { ABSENT_OBJECT } from '../../constants';

class ConsoleWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        sortable: PropTypes.object,

        // redux
        port: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired
    };

    config = new WidgetConfig(this.props.widgetId);

    state = this.getInitialState();

    actions = {
        toggleFullscreen: () => {
            const { minimized, isFullscreen } = this.state;
            this.setState(state => ({
                minimized: isFullscreen ? minimized : false,
                isFullscreen: !isFullscreen
            }));

            setTimeout(() => {
                this.resizeTerminal();
            }, 0);
        },
        toggleMinimized: () => {
            const { minimized } = this.state;
            this.setState(state => ({
                minimized: !minimized
            }));

            setTimeout(() => {
                this.resizeTerminal();
            }, 0);
        },
        clearAll: () => {
            this.terminal && this.terminal.clear();
        }
    };

    controllerEvents = {
        'serialport:close': (options) => {
            this.actions.clearAll();

            const initialState = this.getInitialState();
            this.setState({ ...initialState });
        },
        'serialport:write': (data, context) => {
            if (context && (context.__sender__ === this.props.widgetId)) {
                // Do not write to the terminal console if the sender is the widget itself
                return;
            }
            if (data.endsWith('\n')) {
                data = data.slice(0, -1);
            }
            this.terminal && this.terminal.writeln(data);
        },
        'serialport:read': (data) => {
            this.terminal && this.terminal.writeln(data);
        }
    };

    terminal = null;

    pubsubTokens = [];

    componentDidMount() {
        this.addControllerEvents();
        this.subscribe();
    }

    componentWillUnmount() {
        this.removeControllerEvents();
        this.unsubscribe();
    }

    componentDidUpdate(prevProps, prevState) {
        const {
            minimized
        } = this.state;

        this.config.set('minimized', minimized);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.port !== this.props.port) {
            const { name, version } = settings;

            if (this.terminal) {
                this.terminal.writeln(`${name} ${version}`);
                this.terminal.writeln(i18n._('Connected to {{-port}}', { port: nextProps.port }));
            }
        }

        if (nextProps.server !== ABSENT_OBJECT && nextProps.server !== this.props.server) {
            const { name, version } = settings;

            if (this.terminal) {
                this.terminal.writeln(`${name} ${version}`);
                this.terminal.writeln(i18n._('Connected to machine via Wi-Fi'));
            }
        }
    }

    getInitialState() {
        return {
            minimized: this.config.get('minimized', false),
            isFullscreen: false,

            // Terminal
            terminal: {
                cursorBlink: true,
                scrollback: 1000,
                tabStopWidth: 4
            }
        };
    }

    subscribe() {
        const tokens = [
            pubsub.subscribe('resize', (msg) => {
                this.resizeTerminal();
            })
        ];
        this.pubsubTokens = this.pubsubTokens.concat(tokens);
    }

    unsubscribe() {
        this.pubsubTokens.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        this.pubsubTokens = [];
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    resizeTerminal() {
        this.terminal && this.terminal.resize();
    }

    render() {
        const { minimized, isFullscreen } = this.state;
        const state = {
            ...this.state
        };
        const actions = {
            ...this.actions
        };

        return (
            <Widget fullscreen={isFullscreen}>
                <Widget.Header>
                    <Widget.Title>
                        <Widget.Sortable className={this.props.sortable.handleClassName}>
                            <i className="fa fa-bars" />
                            <span className="space" />
                        </Widget.Sortable>
                        {i18n._('Console')}
                    </Widget.Title>
                    <Widget.Controls className={this.props.sortable.filterClassName}>
                        <Widget.Button
                            title={i18n._('Clear all')}
                            onClick={actions.clearAll}
                        >
                            <i className="fa fa-ban fa-flip-horizontal" />
                        </Widget.Button>
                        <Widget.Button
                            disabled={isFullscreen}
                            title={minimized ? i18n._('Expand') : i18n._('Collapse')}
                            onClick={actions.toggleMinimized}
                        >
                            <i
                                className={classNames(
                                    'fa',
                                    { 'fa-chevron-up': !minimized },
                                    { 'fa-chevron-down': minimized }
                                )}
                            />
                        </Widget.Button>
                        <Widget.DropdownButton
                            title={i18n._('More')}
                            toggle={<i className="fa fa-ellipsis-v" />}
                            onSelect={(eventKey) => {
                                if (eventKey === 'fullscreen') {
                                    actions.toggleFullscreen();
                                }
                            }}
                        >
                            <Widget.DropdownMenuItem eventKey="fullscreen">
                                <i
                                    className={classNames(
                                        'fa',
                                        'fa-fw',
                                        { 'fa-expand': !isFullscreen },
                                        { 'fa-compress': isFullscreen }
                                    )}
                                />
                                <span className="space space-sm" />
                                {!isFullscreen ? i18n._('Enter Full Screen') : i18n._('Exit Full Screen')}
                            </Widget.DropdownMenuItem>
                        </Widget.DropdownButton>
                    </Widget.Controls>
                </Widget.Header>
                <Widget.Content
                    className={classNames(
                        styles.widgetContent,
                        { [styles.hidden]: minimized },
                        { [styles.fullscreen]: isFullscreen }
                    )}
                >
                    <Console
                        ref={node => {
                            if (node) {
                                // FIXME: node is Connect object
                                this.terminal = node.terminal;

                                if (this.props.port) {
                                    const { name, version } = settings;

                                    if (this.terminal) {
                                        this.terminal.writeln(`${name} ${version}`);
                                        this.terminal.writeln(i18n._('Connected to {{-port}}', { port: this.props.port }));
                                    }
                                }

                                if (this.props.server !== ABSENT_OBJECT) {
                                    const { name, version } = settings;

                                    if (this.terminal) {
                                        this.terminal.writeln(`${name} ${version}`);
                                        this.terminal.writeln(i18n._('Connected to machine via Wi-Fi'));
                                    }
                                }
                            }
                        }}
                        state={state}
                    />
                </Widget.Content>
            </Widget>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { port, workState, workPosition, server, serverStatus } = machine;

    return {
        port,
        workState,
        workPosition,
        server,
        serverStatus
    };
};

export default connect(mapStateToProps)(ConsoleWidget);
