import color from 'cli-color';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import pubsub from 'pubsub-js';
import settings from '../../config/settings';
import i18n from '../../lib/i18n';
import { actions as machineActions } from '../../flux/machine';
import { controller } from '../../lib/controller';
import Terminal from './Terminal';
import { ABSENT_OBJECT, CONNECTION_TYPE_SERIAL } from '../../constants';

class Console extends PureComponent {
    static propTypes = {
        clearRenderStamp: PropTypes.number,
        widgetId: PropTypes.string.isRequired,
        minimized: PropTypes.bool.isRequired,
        isDefault: PropTypes.bool.isRequired,
        terminalHistory: PropTypes.object.isRequired,
        history: PropTypes.object.isRequired,
        consoleLogs: PropTypes.array,

        // redux
        port: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,
        isConnected: PropTypes.bool.isRequired,
        connectionType: PropTypes.string.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    terminal = React.createRef();

    pubsubTokens = [];

    controllerEvents = {
        'serialport:close': () => {
            this.actions.clearAll();
        },
        // 'serialport:write': (data, context, dataSource) => {
        'serialport:write': (options) => {
            const { context } = options;
            let data = options.data;
            if (context && (context.__sender__ === this.props.widgetId)) {
                // Do not write to the terminal console if the sender is the widget itself
                return;
            }
            if (data.endsWith('\n')) {
                data = data.slice(0, -1);
            }
            const terminal = this.terminal.current;
            terminal && terminal.writeln(data);
        },
        // 'serialport:read': (data, dataSource) => {
        'serialport:read': (options) => {
            const { data } = options;
            const terminal = this.terminal.current;
            terminal && terminal.writeln(data);
        }
    };

    actions = {
        onTerminalData: (data) => {
            if (data === '') {
                // ignore
            } else if (data === 'help' || data === 'h' || data === 'H') {
                this.actions.getHelp();
            } else if (data === 'v' || data === 'V') {
                this.actions.queryVersion();
            } else if (data === 'g' || data === 'G') {
                this.actions.queryGCommands();
            } else if (data === 'm' || data === 'M') {
                this.actions.queryMCommands();
            } else if (data === 'clear') {
                this.actions.clearAll();
            } else {
                this.props.executeGcode(data);
            }
        },

        getHelp: () => {
            const terminal = this.terminal.current;
            if (terminal) {
                terminal.writeln(color.yellow('Welcome to the makers\' world!'));
                terminal.writeln(color.yellow('Supported commands: '));
                terminal.writeln(color.blue('------------------------------------'));
                terminal.writeln(color.cyan('  help | h | H : Help Information'));
                terminal.writeln(color.cyan('  clear: Clear Console'));
                terminal.writeln(color.cyan('  v | V : Version Information'));
                terminal.writeln(color.green('  g | G : G-Command List'));
                terminal.writeln(color.yellow('  m | M : M-Command List'));
                terminal.writeln(color.blue('------------------------------------'));
            }
        },

        queryVersion: () => {
            const terminal = this.terminal.current;
            if (terminal) {
                const { name, version } = settings;
                terminal.writeln(`${name} ${version}`);
            }
        },

        // green: motion; cyan: mode; yellow: set; blue: get; red: emergent
        queryGCommands: () => {
            const terminal = this.terminal.current;
            if (terminal) {
                terminal.writeln(color.green('Common G-Commands: '));
                terminal.writeln(color.blue('------------------------------------'));
                terminal.writeln(color.green('  G0: Rapid Move'));
                terminal.writeln(color.green('  G1: Linear Move'));
                terminal.writeln(color.green('  G4: Pause the Machine for Seconds or Milliseconds'));
                terminal.writeln(color.green('  G28: Move to Origin'));
                terminal.writeln(color.cyan('  G90: Use Absolute Positions'));
                terminal.writeln(color.cyan('  G91: Use Relative Positions'));
                terminal.writeln(color.cyan('  G92: Set Position'));
                terminal.writeln(color.cyan('  G93: Inverse Time Mode (CNC)'));
                terminal.writeln(color.cyan('  G94: Units per Minute (CNC)'));
                terminal.writeln(color.blue('------------------------------------'));
            }
        },

        queryMCommands: () => {
            const terminal = this.terminal.current;
            if (terminal) {
                terminal.writeln(color.yellow('Common M-Commands: '));
                terminal.writeln(color.blue('------------------------------------'));
                terminal.writeln(color.yellow('  M3: Tool Head On (Laser & CNC)'));
                terminal.writeln(color.yellow('  M5: Tool Head Off (Laser & CNC)'));
                terminal.writeln(color.yellow('  M20: List Files in SD Card'));
                terminal.writeln(color.blue('  M31: Get Print Time'));
                terminal.writeln(color.yellow('  M92: Set Axis Steps Per Unit'));
                terminal.writeln(color.yellow('  M104: Set Extruder Temperature'));
                terminal.writeln(color.blue('  M105: Get Extruder Temperature'));
                terminal.writeln(color.yellow('  M109: Set Extruder Temperature and Wait'));
                terminal.writeln(color.red('  M112: Emergency Stop'));
                terminal.writeln(color.blue('  M114: Get Current Position'));
                terminal.writeln(color.blue('  M119: Get EndStop Status'));
                terminal.writeln(color.yellow('  M140: Set Bed Temperature'));
                terminal.writeln(color.yellow('  M190: Set Bed Temperature and Wait'));
                terminal.writeln(color.yellow('  M200: Set Filament Diameter'));
                terminal.writeln(color.yellow('  M201: Set Max Printing Acceleration'));
                terminal.writeln(color.yellow('  M203: Set Max FeedRate'));
                terminal.writeln(color.yellow('  M220: Set Speed Factor override Percentage'));
                terminal.writeln(color.yellow('  M221: Set Extruder Factor override Percentage'));
                terminal.writeln(color.yellow('  M204: Set Default Acceleration'));
                terminal.writeln(color.yellow('  M205: DevelopTools Settings'));
                terminal.writeln(color.yellow('  M206: Set Control Offset'));
                terminal.writeln(color.yellow('  M301: Set PID Parameters'));
                terminal.writeln(color.yellow('  M420: Leveling On/Off/Fade'));
                terminal.writeln(color.yellow('  M421: Set a Mesh Bed Leveling Z coordinate'));
                terminal.writeln(color.blue('  M503: Get Current Settings'));
                terminal.writeln(color.blue('------------------------------------'));
            }
        },

        greetings: () => {
            const terminal = this.terminal.current;
            if (this.props.isConnected && this.props.port) {
                const { name, version } = settings;

                if (terminal) {
                    terminal.writeln(`${name} ${version}`);
                    terminal.writeln(i18n._('Connected to {{-port}}', { port: this.props.port }));
                }
            }

            if (this.props.isConnected && this.props.server !== ABSENT_OBJECT) {
                const { name, version } = settings;

                if (terminal) {
                    terminal.writeln(`${name} ${version}`);
                    terminal.writeln(i18n._('Connected via Wi-Fi'));
                }
            }
        },

        clearAll: () => {
            const terminal = this.terminal.current;
            terminal && terminal.clear();
        },

        printConsoleLogs: (consoleLogs) => {
            for (let consoleLog of consoleLogs) {
                if (consoleLog.endsWith('\n')) {
                    consoleLog = consoleLog.slice(0, -1);
                }
                const terminal = this.terminal.current;
                const split = consoleLog.split('\n');
                for (const splitElement of split) {
                    terminal && terminal.writeln(splitElement);
                }
            }
        }
    };

    componentDidMount() {
        if (this.props.terminalHistory.getLength() === 0) {
            this.props.terminalHistory.push('');
            this.actions.getHelp();
            this.actions.greetings();
        } else {
            const terminal = this.terminal.current;
            const data = [];
            for (let i = 1; i < this.props.terminalHistory.getLength(); i++) {
                data.push(`\r${this.props.terminalHistory.get(i)}\r\n`);
            }
            terminal.write(data.join(''));
        }
        this.addControllerEvents();
        this.subscribe();
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.isConnected && (this.props.isConnected !== nextProps.isConnected
            || nextProps.port !== this.props.port
            || nextProps.server !== this.props.server)) {
            const { name, version } = settings;

            const terminal = this.terminal.current;
            if (terminal) {
                if (nextProps.connectionType === CONNECTION_TYPE_SERIAL) {
                    terminal.writeln(`${name} ${version}`);
                    terminal.writeln(i18n._('Connected to {{-port}}', { port: nextProps.port }));
                } else {
                    terminal.writeln(`${name} ${version}`);
                    terminal.writeln(i18n._('Connected via Wi-Fi'));
                }
            }
        }

        if (nextProps.clearRenderStamp !== this.props.clearRenderStamp) {
            this.actions.clearAll();
        }

        if (nextProps.consoleLogs !== this.props.consoleLogs) {
            this.actions.printConsoleLogs(nextProps.consoleLogs);
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.minimized !== this.props.minimized) {
            this.resizeTerminal();
        }
        if (prevProps.isDefault !== this.props.isDefault) {
            const terminal = this.terminal.current;
            if (terminal) {
                terminal.clear(false);
                const data = [];
                for (let i = 1; i < this.props.terminalHistory.getLength(); i++) {
                    data.push(`\r${this.props.terminalHistory.get(i)}\r\n`);
                }
                terminal.write(data.join(''));
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
        const terminal = this.terminal.current;
        terminal && terminal.resize();
    }

    render() {
        const { isDefault, terminalHistory, history } = this.props;
        const inputValue = terminalHistory.get(0) || '';
        return (
            <Terminal
                ref={this.terminal}
                onData={this.actions.onTerminalData}
                isDefault={isDefault}
                terminalHistory={terminalHistory}
                history={history}
                inputValue={inputValue}
            />
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;
    const { port, server, isConnected, connectionType, terminalHistory, history, consoleLogs } = machine;

    return {
        port,
        server,
        isConnected,
        connectionType,
        terminalHistory,
        history,
        consoleLogs
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Console);
