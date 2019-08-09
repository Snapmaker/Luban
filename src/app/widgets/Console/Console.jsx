import color from 'cli-color';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import pubsub from 'pubsub-js';
import settings from '../../config/settings';
import i18n from '../../lib/i18n';
import { actions as machineActions } from '../../flux/machine';
import controller from '../../lib/controller';
import Terminal from './Terminal';
import styles from './index.styl';
import { ABSENT_OBJECT } from '../../constants';

class Console extends PureComponent {
    static propTypes = {
        clearCount: PropTypes.number,
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
            if (data === 'help\r' || data === '--help\r' || data === 'h\r' || data === 'H\r' || data === '-h\r' || data === '-H\r') {
                this.actions.getHelp();
            } else if (data === 'version\r' || data === '--version\r' || data === 'v\r' || data === 'V\r' || data === '-v\r' || data === '-V\r') {
                this.actions.queryVersion();
            } else if (data === 'gcode\r' || data === 'Gcode\r' || data === '--gcode\r' || data === '--Gcode\r'
                || data === 'g\r' || data === 'G\r' || data === '-g\r' || data === '-G\r') {
                this.actions.queryGCommands();
            } else if (data === 'm\r' || data === 'M\r' || data === '-m\r' || data === '-M\r') {
                this.actions.queryMCommands();
            } else {
                this.props.executeGcode(data);
            }
        },

        setTerminal: (terminal) => {
            this.terminal = terminal;

            if (terminal) {
                this.actions.greetings();
            }
        },

        getHelp: () => {
            if (this.terminal) {
                this.terminal.writeln(color.red('Welcome to the Snapmakers\' World!'));
                this.terminal.writeln(color.red('Supported Commands: '));
                this.terminal.writeln('------------------------------------');
                this.terminal.writeln(color.blue('  help | --help | h | H | -h | -H: Help Information'));
                this.terminal.writeln(color.cyan('  version | --verison | v | V | -v | -V: Version Information'));
                this.terminal.writeln(color.green('  gcode | Gcode | --gcode | --Gcode | g | G | -g | -G: G-Command Information'));
                this.terminal.writeln(color.yellow('  m | M | -m | -M: M-Command Information'));
                this.terminal.writeln('------------------------------------');
            }
        },

        queryVersion: () => {
            if (this.terminal) {
                const { name, version } = settings;
                this.terminal.writeln(`${name} ${version}`);
            }
        },

        // green: motion; cyan: mode; yellow: set; blue: get; red: emergent
        queryGCommands: () => {
            if (this.terminal) {
                this.terminal.writeln(color.green('Common G-Commands: '));
                this.terminal.writeln('------------------------------------');
                this.terminal.writeln(color.green('  G0: Rapid Move'));
                this.terminal.writeln(color.green('  G1: Linear Move'));
                this.terminal.writeln(color.green('  G4: Pause the Machine for Seconds or Milliseconds'));
                this.terminal.writeln(color.green('  G28: Move to Origin'));
                this.terminal.writeln(color.cyan('  G93: Inverse Time Mode (CNC)'));
                this.terminal.writeln(color.cyan('  G94: Units per Minute (CNC)'));
                this.terminal.writeln('------------------------------------');
            }
        },

        queryMCommands: () => {
            if (this.terminal) {
                this.terminal.writeln(color.yellow('Common M-Commands: '));
                this.terminal.writeln('------------------------------------');
                this.terminal.writeln(color.yellow('  M3: Tool Head On (Laser & CNC)'));
                this.terminal.writeln(color.yellow('  M5: Tool Head Off (Laser & CNC)'));
                this.terminal.writeln(color.blue('  M105: Get Extruder Temperature'));
                this.terminal.writeln(color.yellow('  M109: Set Extruder Temperature and Wait'));
                this.terminal.writeln(color.red('  M112: Emergency Stop'));
                this.terminal.writeln(color.blue('  M114: Get Current Position and Temperature'));
                this.terminal.writeln(color.blue('  M119: Get EndStop Status'));
                this.terminal.writeln(color.yellow('  M140: Set Bed Temperature'));
                this.terminal.writeln(color.yellow('  M201: Set Max Printing Accerlation'));
                this.terminal.writeln(color.yellow('  M220: Set Speed Factor override Percentage'));
                this.terminal.writeln(color.yellow('  M221: Set Extruder Factor override Percentage'));
                this.terminal.writeln(color.blue('  M503: Get Current Settings'));
                this.terminal.writeln(color.yellow('  M1001 L: Lock Screen (Firmware Verison ~2.4.0)'));
                this.terminal.writeln(color.yellow('  M1001 U: ULock Screen (Firmware Version ~2.4.0)'));
                this.terminal.writeln('------------------------------------');
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
        this.actions.getHelp();
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

        if (nextProps.clearCount !== this.props.clearCount) {
            this.actions.clearAll();
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
        // console.log('port, server', port, server);

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
