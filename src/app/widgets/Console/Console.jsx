import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import pubsub from 'pubsub-js';
import settings from '../../config/settings';
import i18n from '../../lib/i18n';
import { actions as machineActions } from '../../flux/machine';
import controller from '../../lib/controller';
import Terminal from './Terminal';
// import styles from './index.styl';
import { ABSENT_OBJECT } from '../../constants';

class Console extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,

        // redux
        port: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    terminal = null;

    pubsubTokens = [];

    controllerEvents = {
        'serialport:close': () => {
            this.actions.clearAll();
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

    state = {
        terminal: {
            cursorBlink: true,
            scrollback: 1024,
            tabStopWidth: 4
        }
    };

    actions = {
        onTerminalData: (data) => {
            this.props.executeGcode(data);
        },

        setTerminal: (terminal) => {
            this.terminal = terminal;

            if (terminal) {
                this.actions.greetings();
            }
        },

        greetings: () => {
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
                    this.terminal.writeln(i18n._('Connected via Wi-Fi'));
                }
            }
        },

        clearAll: () => {
            this.terminal && this.terminal.clear();
        }
    };

    componentDidMount() {
        this.actions.setTerminal(this.terminal);
        this.addControllerEvents();
        this.subscribe();
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
                this.terminal.writeln(i18n._('Connected via Wi-Fi'));
            }
        }
    }

    componentWillUnmount() {
        this.removeControllerEvents();
        this.unsubscribe();
    }

    subscribe() {
        const tokens = [
            pubsub.subscribe('resize', () => {
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
        const { port, server } = this.props;
        console.log('port, server', port, server);

        /*
        if (!port && server === ABSENT_OBJECT) {
            this.terminal = null;
            this.actions.setTerminal(null);

            return (
                <div className={styles.noSerialConnection}>
                    {i18n._('No connection')}
                </div>
            );
        }

        return (
            <Terminal
                ref={node => {
                    if (node && !this.terminal) {
                        this.terminal = node;
                        this.actions.setTerminal(node);
                    }
                }}
                cursorBlink={this.state.terminal.cursorBlink}
                scrollback={this.state.terminal.scrollback}
                tabStopWidth={this.state.terminal.tabStopWidth}
                onData={this.actions.onTerminalData}
            />
        );
        */
        return (
            <Terminal
                cursorBlink={this.state.terminal.cursorBlink}
                scrollback={this.state.terminal.scrollback}
                tabStopWidth={this.state.terminal.tabStopWidth}
                onData={this.actions.onTerminalData}
            />
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { port, server } = machine;

    return {
        port,
        server
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Console);
