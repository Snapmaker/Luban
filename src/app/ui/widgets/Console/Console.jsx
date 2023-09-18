import { WorkflowStatus } from '@snapmaker/luban-platform';
import color from 'cli-color';
import { includes } from 'lodash';
import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState } from 'react';
// import classNames from 'classnames';
import pubsub from 'pubsub-js';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory, withRouter } from 'react-router-dom';

import settings from '../../../config/settings';
import {
    ABSENT_OBJECT,
    CONNECTION_TYPE_SERIAL,
} from '../../../constants';
import { actions as workspaceActions } from '../../../flux/workspace';
import { controller } from '../../../communication/socket-communication';
import usePrevious from '../../../lib/hooks/previous';
import i18n from '../../../lib/i18n';
import Terminal from './Terminal';

let pubsubTokens = [];
let unlisten = null;
function Console({ widgetId, widgetActions, minimized, isDefault, clearRenderStamp }) {
    const {
        connectionType,
        isConnected,

        port,
        server,
    } = useSelector(state => state.workspace, shallowEqual);

    const {
        workflowStatus,
    } = useSelector(state => state.workspace, shallowEqual);

    const {
        terminalHistory,
        consoleHistory,
        consoleLogs,
        shouldHideConsole
    } = useSelector(state => state.workspace, shallowEqual);

    const [shouldRenderFitaddon, setShouldRenderFitaddon] = useState(false);
    const history = useHistory();
    const dispatch = useDispatch();
    const terminalRef = useRef();
    const prevProps = usePrevious({
        isConnected, port, server, clearRenderStamp, consoleLogs, minimized, isDefault
    });
    const controllerEvents = {
        // 'serialport:write': (data, context, dataSource) => {
        'serialport:write': (options) => {
            const { context } = options;
            let data = options.data;
            if (context && (context.__sender__ === widgetId)) {
                // Do not write to the terminal console if the sender is the widget itself
                return;
            }
            if (data.endsWith('\n')) {
                data = data.slice(0, -1);
            }
            const terminal = terminalRef.current;
            terminal && terminal.writeln(data);
        },
        // 'serialport:read': (data, dataSource) => {
        'serialport:read': (options) => {
            const { data } = options;
            const terminal = terminalRef.current;
            terminal && terminal.writeln(data);
        },
        'connection:executeGcode': (gcodeArray) => {
            if (gcodeArray) {
                dispatch(workspaceActions.addConsoleLogs(gcodeArray));
            }
        }
    };

    const actions = {
        onTerminalData: (data) => {
            if (data === '') {
                // ignore
            } else if (data === 'help' || data === 'h' || data === 'H') {
                actions.getHelp();
            } else if (data === 'v' || data === 'V') {
                actions.queryVersion();
            } else if (data === 'g' || data === 'G') {
                actions.queryGCommands();
            } else if (data === 'm' || data === 'M') {
                actions.queryMCommands();
            } else if (data === 'clear') {
                actions.clearAll();
            } else {
                dispatch(workspaceActions.executeGcode(data));
            }
        },

        getHelp: () => {
            const terminal = terminalRef.current;
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
            const terminal = terminalRef.current;
            if (terminal) {
                const { name, version } = settings;
                terminal.writeln(`${name} ${version}`);
            }
        },

        // green: motion; cyan: mode; yellow: set; blue: get; red: emergent
        queryGCommands: () => {
            const terminal = terminalRef.current;
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
            const terminal = terminalRef.current;
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
            const terminal = terminalRef.current;
            if (isConnected && port) {
                const { name, version } = settings;

                if (terminal) {
                    terminal.writeln(`${name} ${version}`);
                    terminal.writeln(i18n._('key-Workspace/Console-Connected to {{-port}}', { port: port }));
                }
            }

            if (isConnected && server !== ABSENT_OBJECT) {
                const { name, version } = settings;

                if (terminal) {
                    terminal.writeln(`${name} ${version}`);
                    terminal.writeln(i18n._('key-Workspace/Console-Connected via Wi-Fi'));
                }
            }
        },

        clearAll: () => {
            const terminal = terminalRef.current;
            terminal && terminal.clear();
        },

        printConsoleLogs: (_consoleLogs) => {
            for (let consoleLog of _consoleLogs) {
                if (consoleLog.endsWith('\n')) {
                    consoleLog = consoleLog.slice(0, -1);
                }
                const terminal = terminalRef.current;
                const split = consoleLog.split('\n');
                for (const splitElement of split) {
                    terminal && terminal.writeln(splitElement);
                }
            }
        }
    };

    function addControllerEvents() {
        Object.keys(controllerEvents).forEach(eventName => {
            const callback = controllerEvents[eventName];
            controller.on(eventName, callback);
        });
    }

    function removeControllerEvents() {
        Object.keys(controllerEvents).forEach(eventName => {
            const callback = controllerEvents[eventName];
            controller.off(eventName, callback);
        });
    }

    function resizeTerminal() {
        const terminal = terminalRef.current;
        terminal && terminal.resize();
    }

    function subscribe() {
        const tokens = [
            pubsub.subscribe('resize', () => {
                resizeTerminal();
            })
        ];
        pubsubTokens = pubsubTokens.concat(tokens);
    }

    function unsubscribe() {
        pubsubTokens.forEach((token) => {
            pubsub.unsubscribe(token);
        });
        pubsubTokens = [];
    }


    useEffect(() => {
        widgetActions.setTitle(i18n._('key-Workspace/Console-Console'));
        widgetActions.setControlButtons([
            {
                title: 'Eliminate',
                name: 'Eliminate',
                onClick: actions.clearAll,
                type: ['static']
            },
            'SMMinimize'
        ]);
        unlisten = history.listen((location) => {
            if (location.pathname === '/workspace') {
                setShouldRenderFitaddon(true);
            } else {
                setShouldRenderFitaddon(false);
            }
        });

        if (terminalHistory.getLength() === 0) {
            terminalHistory.push('');
            actions.getHelp();
            actions.greetings();
        } else {
            const terminal = terminalRef.current;
            const data = [];
            for (let i = 1; i < terminalHistory.getLength(); i++) {
                data.push(`\r${terminalHistory.get(i)}\r\n`);
            }
            terminal.write(data.join(''));
        }
        addControllerEvents();
        resizeTerminal();
        subscribe();

        return () => {
            unlisten();
            removeControllerEvents();
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (prevProps) {
            if (isConnected && (isConnected !== prevProps.isConnected
                || prevProps.port !== port
                || prevProps.server !== server)) {
                const { name, version } = settings;
                const terminal = terminalRef.current;
                if (terminal) {
                    if (connectionType === CONNECTION_TYPE_SERIAL) {
                        terminal.writeln(`${name} ${version}`);
                        terminal.writeln(i18n._('key-Workspace/Console-Connected to {{-port}}', { port: port }));
                    } else {
                        terminal.writeln(`${name} ${version}`);
                        terminal.writeln(i18n._('key-Workspace/Console-Connected via Wi-Fi'));
                    }
                }
            }
        }
    }, [isConnected, port, server]);

    useEffect(() => {
        const isWorking = includes([WorkflowStatus.Running, WorkflowStatus.Pausing, WorkflowStatus.Paused], workflowStatus);
        if (!isConnected) {
            widgetActions.setDisplay(true);
        } else {
            if (isWorking && shouldHideConsole) {
                widgetActions.setDisplay(false);
            } else {
                widgetActions.setDisplay(true);
            }
        }
    }, [workflowStatus, connectionType, isConnected]);

    useEffect(() => {
        if (prevProps && prevProps.clearRenderStamp !== clearRenderStamp) {
            prevProps.clearRenderStamp = clearRenderStamp;
            actions.clearAll();
        }
    }, [clearRenderStamp]);

    useEffect(() => {
        if (prevProps && prevProps.consoleLogs !== consoleLogs) {
            prevProps.consoleLogs = consoleLogs;
            actions.printConsoleLogs(consoleLogs);
        }
    }, [consoleLogs]);

    useEffect(() => {
        if (prevProps && prevProps.minimized !== minimized) {
            prevProps.minimized = minimized;
            resizeTerminal();
        }
    }, [minimized]);

    useEffect(() => {
        if (prevProps && prevProps.isDefault !== isDefault) {
            prevProps.isDefault = isDefault;
            const terminal = terminalRef.current;
            if (terminal) {
                terminal.clear(false);
                const data = [];
                for (let i = 1; i < terminalHistory.getLength(); i++) {
                    data.push(`\r${terminalHistory.get(i)}\r\n`);
                }
                terminal.write(data.join(''));
            }
        }
    }, [isDefault]);

    const inputValue = terminalHistory.getLength() > 0 ? terminalHistory.get(0) : '';

    return (
        <div>
            <Terminal
                ref={terminalRef}
                onData={actions.onTerminalData}
                isDefault={isDefault}
                shouldRenderFitaddon={shouldRenderFitaddon}
                terminalHistory={terminalHistory}
                consoleHistory={consoleHistory}
                inputValue={inputValue}
            />
        </div>

    );
}
Console.propTypes = {
    ...withRouter.propTypes,
    clearRenderStamp: PropTypes.number,
    widgetId: PropTypes.string.isRequired,
    minimized: PropTypes.bool,
    isDefault: PropTypes.bool
};

export default withRouter(Console);
