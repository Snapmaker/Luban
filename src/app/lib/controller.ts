import isEmpty from 'lodash/isEmpty';
import noop from 'lodash/noop';

import { MARLIN, PROTOCOL_TEXT, WORKFLOW_STATE_IDLE } from '../constants';
import { machineStore } from '../store/local-storage';
import { lubanVisit } from './gaEvent';
import log from './log';
import socketController from './socket-controller';

class SerialPortClient {
    private callbacks = {
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
        'connection:connected': [],
        'connection:connecting': [],
        'connection:executeGcode': [],
        'serialport:emergencyStop': [],
        'serialport:read': [],
        'serialport:write': [],

        // HTTP events
        'machine:serial-discover': [],
        'machine:discover': [],
        'connection:open': [],
        'connection:close': [],
        // Controller events
        'feeder:status': [],
        'sender:status': [],
        'workflow:state': [],
        'Marlin:state': [],
        'Marlin:settings': [],
        'transfer:hex': [],
        'move:status': [],
        'connection:headBeginWork': [],
        'manager:error': [],

        // machine related
        'machine:module-list': [],
        'machine:laser-status': [],

        'slice:started': [],
        'slice:completed': [],
        'slice:progress': [],
        'slice:error': [],

        // Async tasks
        'taskProgress:generateToolPath': [],
        'taskProgress:generateGcode': [],
        'taskProgress:processImage': [],
        'taskCompleted:generateToolPath': [],
        'taskCompleted:generateGcode': [],
        'taskCompleted:processImage': [],
        'taskProgress:generateViewPath': [],
        'taskCompleted:generateViewPath': [],
        'taskProgress:cutModel': [],
        'taskCompleted:cutModel': [],
        'generate-support:started': [],
        'generate-support:completed': [],
        'generate-support:progress': [],
        'generate-support:error': [],
        // for simplify model
        'simplify-model:started': [],
        'simplify-model:completed': [],
        'simplify-model:progress': [],
        'simplify-model:error': [],

        'daily:heartbeat': []
    };

    private dataSource = '';

    /*
    private context = {
        xmin: 0,
        xmax: 0,
        ymin: 0,
        ymax: 0,
        zmin: 0,
        zmax: 0
    };
    */

    public port = '';

    public ports = [];

    public workspacePort = '';

    public type = '';

    public state = {};

    public settings = {};

    public workflowState = WORKFLOW_STATE_IDLE;

    private static map = new Map();

    public static getController(dataSource) {
        const v = this.map.get(dataSource);
        if (v) {
            return v;
        } else {
            const controller = new SerialPortClient(dataSource);
            this.map.set(dataSource, controller);
            return controller;
        }
    }

    public constructor(dataSource) {
        this.dataSource = dataSource;
    }

    public get connected() {
        return socketController.connected;
    }

    public connect(next = noop) {
        if (typeof next !== 'function') {
            next = noop;
        }

        const token = machineStore.get('session.token');
        socketController.connect(token, next);

        Object.keys(this.callbacks).forEach((eventName) => {
            socketController.on(eventName, (options = {}) => {
                log.debug(`socket.on('${eventName}'):`, options);

                if (eventName === 'connection:open') {
                    const { controllerType = 'Marlin', port } = options;
                    if (port) {
                        if (this.ports.indexOf(port) === -1) {
                            this.ports.push(port);
                        }
                        this.port = port;
                        this.workspacePort = port;

                        this.type = controllerType;
                    }
                }
                if (eventName === 'connection:close') {
                    const { port } = options;
                    if (port) {
                        const portIndex = this.ports.indexOf(port);
                        if (portIndex !== -1) {
                            this.ports.splice(portIndex, 1);
                        }
                        if (!isEmpty(this.ports)) {
                            this.port = this.ports[0];
                            this.workspacePort = this.ports[0];
                        } else {
                            this.workspacePort = '';
                            this.port = '';
                            this.type = '';
                            this.state = {};
                            this.settings = {};
                            this.workflowState = WORKFLOW_STATE_IDLE;
                        }
                    }
                }
                if (eventName === 'daily:heartbeat') {
                    lubanVisit();
                    return;
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

                this.callbacks[eventName].forEach((callback) => {
                    callback.apply(callback, [options]);
                });
            });
        });
    }

    public disconnect() {
        socketController.disconnect();
    }

    // Note: 'on' and 'off' function must be registered during initialization
    public on(eventName, callback) {
        const callbacks = this.callbacks[eventName];
        if (!callbacks) {
            log.error('Undefined event name:', eventName);
            return;
        }
        if (typeof callback === 'function') {
            callbacks.push(callback);
        }
    }

    public off(eventName, callback) {
        const callbacks = this.callbacks[eventName];
        if (!callbacks) {
            log.error('Undefined event name:', eventName);
            return;
        }
        if (typeof callback === 'function') {
            callbacks.splice(callbacks.indexOf(callback), 1);
        }
    }

    public listPorts() {
        socketController.emit('machine:discover', { dataSource: this.dataSource, connectionType: 'serial' });
    }

    public emitEvent(eventName: string, options = {}, callback = null) {
        socketController.emit(eventName, { ...options, eventName }, callback);
        return socketController;
    }

    // Discover Wi-Fi enabled Snapmakers
    public listHTTPServers() {
        socketController.emit('machine:discover', { connectionType: 'wifi' });
    }

    public slice(params) {
        socketController.emit('slice', params);
    }

    public commitToolPathTaskArray(taskArray) {
        socketController.emit('taskCommit:generateToolPath', taskArray);
    }

    public generateSupport(params) {
        socketController.emit('generate-support', params);
    }

    public simplifyModel(params) {
        socketController.emit('simplify-model', params);
    }

    public async repairModel(params, onMessage) {
        return socketController.channel('repair-model', params, onMessage);
    }

    public async checkModel(params, onMessage) {
        return socketController.channel('check-model', params, onMessage);
    }

    /**
     * Try split mesh.
     */
    public async splitMesh(options, onMessage) {
        return socketController.channel('mesh:split', options, onMessage);
    }

    public async getFreeMemory() {
        await socketController.channel('get-free-memory', null, noop);
    }

    public commitViewPathTask(task) {
        socketController.emit('taskCommit:generateViewPath', task);
    }

    public commitGcodeTask(task) {
        socketController.emit('taskCommit:generateGcode', task);
    }

    public commitProcessImage(task) {
        socketController.emit('taskCommit:processImage', task);
    }

    public commitCutModelTask(task) {
        socketController.emit('taskCommit:cutModel', task);
    }

    public cancelCutModelTask(taskId) {
        socketController.emit('taskCancel:cutModel', taskId);
    }

    public subscribeDiscover(bool) {
        socketController.emit('subscribe:discover', bool);
    }

    // command(cmd, ...args) {
    public command(cmd, ...args) {
        // const { port } = this;
        if (!this.workspacePort) {
            return;
        }
        socketController.emit('command', {
            port: this.workspacePort,
            dataSource: this.dataSource,
            cmd: cmd,
            args: [...args]
        });
    }

    // @param {object} [context] The associated context information.
    public writeln(data, context = {}) {
        // const { port } = this;
        if (!this.workspacePort) {
            return;
        }
        socketController.emit('writeln', {
            port: this.workspacePort,
            dataSource: this.dataSource,
            data,
            context
        });
    }
}

export const controller: SerialPortClient = SerialPortClient.getController(PROTOCOL_TEXT);

export default controller;
