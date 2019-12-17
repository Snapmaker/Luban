import noop from 'lodash/noop';
import isEmpty from 'lodash/isEmpty';
import io from 'socket.io-client';
import { machineStore } from '../store/local-storage';
import log from './log';
import { PROTOCOL_SCREEN, MARLIN, WORKFLOW_STATE_IDLE } from '../constants';

class SocketController {
    socket = null;

    callbacks = {
        //
        // Socket.IO Events
        //
        // Fired upon a connection including a successful reconnection.
        'connect': [],
        // Fired upon a connection timeout.
        'connect_timeout': [],
        // Fired when an error occurs.
        'error': [],
        // Fired upon a disconnection.
        'disconnect': [],
        // Fired upon a successful reconnection.
        'reconnect': [],
        // Fired upon an attempt to reconnect.
        'reconnect_attempt': [],
        // Fired upon an attempt to reconnect.
        'reconnecting': [],
        // Fired when couldn't reconnect within reconnectionAttempts.
        'reconnect_failed': [],

        //
        // System Events
        //
        // 'startup': [],
        // 'config:change': [],
        // 'task:start': [],
        // 'task:finish': [],
        // 'task:error': [],

        // Serial Port events
        'serialport:list': [],
        'serialport:open': [],
        'serialport:ready': [],
        'serialport:close': [],
        'serialport:read': [],
        'serialport:write': [],

        // HTTP events
        'http:discover': [],

        // Controller events
        'feeder:status': [],
        'sender:status': [],
        'workflow:state': [],
        'Marlin:state': [],
        'Marlin:settings': [],
        'machine:settings': [],
        'transfer:hex': [],

        'slice:started': [],
        'slice:completed': [],
        'slice:progress': [],
        'slice:error': [],

        // Async tasks
        'task:progress': [],
        'task:completed': []
    };

    context = {
        xmin: 0,
        xmax: 0,
        ymin: 0,
        ymax: 0,
        zmin: 0,
        zmax: 0
    };

    // user-defined baud rates and ports  command
    port = '';

    ports = [];

    dataSources = [];

    workspacePort = '';

    panelPort = '';

    type = '';

    state = {};

    settings = {};

    workflowState = WORKFLOW_STATE_IDLE;

    get connected() {
        return !!(this.socket && this.socket.connected);
    }

    connect(next = noop) {
        if (typeof next !== 'function') {
            next = noop;
        }

        this.socket && this.socket.destroy();

        const token = machineStore.get('session.token');
        this.socket = io.connect('', {
            query: `token=${token}`
        });

        Object.keys(this.callbacks).forEach((eventName) => {
            if (!this.socket) {
                return;
            }

            // this.socket.on(eventName, (...args) => {
            this.socket.on(eventName, (options) => {
                // log.debug(`socket.on('${eventName}'):`, args);
                log.debug(`socket.on('${eventName}'):`, options);

                if (eventName === 'serialport:open') {
                    // const { controllerType, port, dataSource } = { ...args[0] };
                    const { controllerType = 'Marlin', port, dataSource } = options;
                    if (this.ports.indexOf(port) === -1) {
                        this.ports.push(port);
                        this.dataSources.push(dataSource);
                    }
                    this.port = port;
                    if (dataSource === PROTOCOL_SCREEN) {
                        this.panelPort = port;
                    } else {
                        this.workspacePort = port;
                    }

                    // this.dataSource = dataSource;
                    this.type = controllerType;
                }
                if (eventName === 'serialport:close') {
                    // const { port, dataSource } = { ...args[0] };
                    const { port, dataSource } = options;
                    const portIndex = this.ports.indexOf(port);
                    if (portIndex !== -1) {
                        this.ports.splice(portIndex, 1);
                        this.dataSources.splice(portIndex, 1);
                    }
                    if (!isEmpty(this.ports) && !isEmpty(this.dataSources)) {
                        this.port = this.ports[0];
                        if (this.dataSources[0] === PROTOCOL_SCREEN) {
                            this.panelPort = this.ports[0];
                        } else {
                            this.workspacePort = this.ports[0];
                        }
                    } else {
                        if (dataSource === PROTOCOL_SCREEN) {
                            this.panelPort = '';
                        } else {
                            this.workspacePort = '';
                        }
                        this.port = '';
                        this.type = '';
                        this.state = {};
                        this.settings = {};
                        this.workflowState = WORKFLOW_STATE_IDLE;
                    }
                }
                if (eventName === 'workflow:state') {
                    // this.workflowState = args[0];
                    this.workflowState = options.workflowState;
                }
                if (eventName === 'Marlin:state') {
                    this.type = MARLIN;
                    // this.state = { ...args[0] };
                    this.state = options.state;
                }
                if (eventName === 'Marlin:settings') {
                    this.type = MARLIN;
                    // this.settings = { ...args[0] };
                    this.settings = options.settings;
                }
                /*
                // outdated? @jt
                if (eventName === 'machine:settings') {
                    this.type = MARLIN;
                    // this.settings = { ...args[0] };
                    this.settings = options.settings;
                }
                */
                this.callbacks[eventName].forEach((callback) => {
                    // callback.apply(callback, args);
                    // callback.apply(callback, options);
                    callback.apply(callback, [options]);
                });
            });
        });

        this.socket.on('startup', () => {
            if (next) {
                next();
                next = null;
            }
        });
    }

    disconnect() {
        this.socket && this.socket.destroy();
        this.socket = null;
    }

    on(eventName, callback) {
        const callbacks = this.callbacks[eventName];
        if (!callbacks) {
            log.error('Undefined event name:', eventName);
            return;
        }
        if (typeof callback === 'function') {
            callbacks.push(callback);
        }
    }

    off(eventName, callback) {
        const callbacks = this.callbacks[eventName];
        if (!callbacks) {
            log.error('Undefined event name:', eventName);
            return;
        }
        if (typeof callback === 'function') {
            callbacks.splice(callbacks.indexOf(callback), 1);
        }
    }

    listPorts() {
        this.socket && this.socket.emit('serialport:list');
    }

    openPort(port, dataSource) {
        this.socket && this.socket.emit('serialport:open', port, dataSource);
    }

    closePort(port, dataSource) {
        this.socket && this.socket.emit('serialport:close', port, dataSource);
    }

    // Discover Wi-Fi enabled Snapmakers
    listHTTPServers() {
        this.socket && this.socket.emit('http:discover');
    }

    slice(params) {
        this.socket && this.socket.emit('slice', params);
    }

    commitTask(task) {
        this.socket && this.socket.emit('task:commit', task);
    }

    // @param {string} cmd The command string
    // @example Example Usage
    // - Load G-code
    //   controller.command('gcode:load', name, gcode, callback)
    // - Unload G-code
    //   controller.command('gcode:unload')
    // - Start sending G-code
    //   controller.command('gcode:start')
    // - Stop sending G-code
    //   controller.command('gcode:stop')
    // - Pause
    //   controller.command('gcode:pause')
    // - Resume
    //   controller.command('gcode:resume')
    // - Feed Hold
    //   controller.command('feedhold')
    // - Cycle Start
    //   controller.command('cyclestart')
    // - Status Report
    //   controller.command('statusreport')
    // - Homing
    //   controller.command('homing')
    // - Sleep
    //   controller.command('sleep')
    // - Unlock
    //   controller.command('unlock')
    // - Reset
    //   controller.command('reset')
    // - Feed Override
    //   controller.command('feedOverride')
    // - Spindle Override
    //   controller.command('spindleOverride')
    // - Rapid Override
    //   controller.command('rapidOverride')
    // - Energize Motors
    //   controller.command('energizeMotors:on')
    //   controller.command('energizeMotors:off')
    // - G-code
    //   controller.command('gcode', 'G0X0Y0', context /* optional */)
    // - Load file from a watch directory
    //   controller.command('watchdir:load', '/path/to/file', callback)

    // command(cmd, ...args) {
    command(cmd, dataSource, ...args) {
        // const { port } = this;
        const port = dataSource === PROTOCOL_SCREEN ? this.panelPort : this.workspacePort;
        if (!port) {
            return;
        }
        this.socket && this.socket.emit('command', port, dataSource, cmd, ...args);
    }

    // @param {string} data The data to write.
    // @param {object} [context] The associated context information.
    writeln(data, dataSource, context = {}) {
        // const { port } = this;
        const port = dataSource === PROTOCOL_SCREEN ? this.panelPort : this.workspacePort;
        if (!port) {
            return;
        }
        this.socket && this.socket.emit('writeln', port, dataSource, data, context);
    }
}

const controller = new SocketController();

export default controller;
