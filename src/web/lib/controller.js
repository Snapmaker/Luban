import noop from 'lodash/noop';
import io from 'socket.io-client';
import store from '../store';
import log from './log';
import { MARLIN, WORKFLOW_STATE_IDLE } from '../constants';

class CNCController {
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

        'slice:started': [],
        'slice:completed': [],
        'slice:progress': [],
        'slice:error': [],

        // Async tasks
        'task:state': [],
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

    // user-defined baud rates and ports
    port = '';

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

        const token = store.get('session.token');
        this.socket = io.connect('', {
            query: 'token=' + token
        });

        Object.keys(this.callbacks).forEach((eventName) => {
            if (!this.socket) {
                return;
            }

            this.socket.on(eventName, (...args) => {
                log.debug(`socket.on('${eventName}'):`, args);

                if (eventName === 'serialport:open') {
                    const { controllerType, port } = { ...args[0] };
                    this.port = port;
                    this.type = controllerType;
                }
                if (eventName === 'serialport:close') {
                    this.port = '';
                    this.type = '';
                    this.state = {};
                    this.settings = {};
                    this.workflowState = WORKFLOW_STATE_IDLE;
                }
                if (eventName === 'workflow:state') {
                    this.workflowState = args[0];
                }
                if (eventName === 'Marlin:state') {
                    this.type = MARLIN;
                    this.state = { ...args[0] };
                }
                if (eventName === 'Marlin:settings') {
                    this.type = MARLIN;
                    this.settings = { ...args[0] };
                }

                this.callbacks[eventName].forEach((callback) => {
                    callback.apply(callback, args);
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
        let callbacks = this.callbacks[eventName];
        if (!callbacks) {
            log.error('Undefined event name:', eventName);
            return;
        }
        if (typeof callback === 'function') {
            callbacks.push(callback);
        }
    }

    off(eventName, callback) {
        let callbacks = this.callbacks[eventName];
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

    openPort(port) {
        this.socket && this.socket.emit('serialport:open', port);
    }

    closePort(port) {
        this.socket && this.socket.emit('serialport:close', port);
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
    command(cmd, ...args) {
        const { port } = this;
        if (!port) {
            return;
        }
        this.socket && this.socket.emit.apply(this.socket, ['command', port, cmd].concat(args));
    }

    // @param {string} data The data to write.
    // @param {object} [context] The associated context information.
    writeln(data, context = {}) {
        const { port } = this;
        if (!port) {
            return;
        }
        this.socket && this.socket.emit('writeln', port, data, context);
    }
}

const controller = new CNCController();

export default controller;
