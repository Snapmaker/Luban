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
import { PROTOCOL_TEXT, ABSENT_OBJECT } from '../../constants';

class Console extends PureComponent {
    static propTypes = {
        clearRenderStamp: PropTypes.number,
        widgetId: PropTypes.string.isRequired,
        defaultWidgets: PropTypes.array.isRequired,
        minimized: PropTypes.bool.isRequired,

        // redux
        port: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,
        isConnected: PropTypes.bool.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    terminal = React.createRef();

    pubsubTokens = [];

    controllerEvents = {
        'serialport:close': (options) => {
            const { dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            this.actions.clearAll();
        },
        // 'serialport:write': (data, context, dataSource) => {
        'serialport:write': (options) => {
            const { context, dataSource } = options;
            let data = options.data;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
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
            const { data, dataSource } = options;
            if (dataSource !== PROTOCOL_TEXT) {
                return;
            }
            const terminal = this.terminal.current;
            terminal && terminal.writeln(data);
        }
    };

    actions = {
        onTerminalData: (data) => {
            if (data === 'help' || data === 'h' || data === 'H') {
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
                terminal.writeln(color.yellow('  M205: Advanced Settings'));
                terminal.writeln(color.yellow('  M206: Set Axes Offset'));
                terminal.writeln(color.yellow('  M301: Set PID Parameters'));
                terminal.writeln(color.yellow('  M420: Leveling On/Off/Fade'));
                terminal.writeln(color.yellow('  M421: Set a Mesh Bed Leveling Z coordinate'));
                terminal.writeln(color.blue('  M503: Get Current Settings'));
                terminal.writeln(color.blue('------------------------------------'));
            }
        },

        greetings: () => {
            const terminal = this.terminal.current;
            if (this.props.port) {
                const { name, version } = settings;

                if (terminal) {
                    terminal.writeln(`${name} ${version}`);
                    terminal.writeln(i18n._('Connected to {{-port}}', { port: this.props.port }));
                }
            }

            if (this.props.server !== ABSENT_OBJECT) {
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
        }
    };

    componentDidMount() {
        this.actions.getHelp();
        this.actions.greetings();
        this.addControllerEvents();
        this.subscribe();
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.isConnected && (this.props.isConnected !== nextProps.isConnected || nextProps.port !== this.props.port)) {
            const { name, version } = settings;

            const terminal = this.terminal.current;
            if (terminal) {
                terminal.writeln(`${name} ${version}`);
                terminal.writeln(i18n._('Connected to {{-port}}', { port: nextProps.port }));
            }
        }

        if (nextProps.server !== ABSENT_OBJECT && nextProps.server !== this.props.server) {
            const { name, version } = settings;

            const terminal = this.terminal.current;
            if (terminal) {
                terminal.writeln(`${name} ${version}`);
                terminal.writeln(i18n._('Connected via Wi-Fi'));
            }
        }

        if (nextProps.clearRenderStamp !== this.props.clearRenderStamp) {
            this.actions.clearAll();
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.minimized !== this.props.minimized) {
            this.resizeTerminal();
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
        return (
            <Terminal
                ref={this.terminal}
                onData={this.actions.onTerminalData}
                defaultWidgets={this.props.defaultWidgets}
            />
        );
    }
}

const mapStateToProps = (state) => {
    const widget = state.widget;
    const defaultWidgets = widget.workspace.default.widgets;

    const machine = state.machine;
    const { port, server, isConnected } = machine;

    return {
        port,
        server,
        isConnected,
        defaultWidgets
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(PROTOCOL_TEXT, gcode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Console);
