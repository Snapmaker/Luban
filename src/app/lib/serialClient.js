import { controller } from './controller';

class SerialClient {
    map = new Map();

    constructor(options) {
        this.dataSource = options.dataSource || '';
    }

    getWorkflowState() {
        return controller.workflowState;
    }

    getPort() {
        return controller.port;
    }

    getContext() {
        return controller.context;
    }

    getType() {
        return controller.type;
    }

    getState() {
        return controller.state;
    }

    getSettings() {
        return controller.settings;
    }

    setContext(context) {
        controller.context = context;
    }

    connect(next) {
        controller.connect(next);
    }

    disconnect() {
        controller.disconnect();
    }

    on(eventName, callback) {
        controller.on(eventName, this._getCallback(callback));
        // controller.on(eventName, callback);
    }

    off(eventName, callback) {
        controller.off(eventName, this._removeCallback(callback));
        // controller.off(eventName, callback);
    }

    listPorts() {
        controller.listPorts();
    }

    openPort(port) {
        controller.openPort(port, this.dataSource);
    }

    closePort(port) {
        controller.closePort(port, this.dataSource);
    }

    listHTTPServers() {
        controller.listHTTPServers();
    }

    slice(params) {
        controller.slice(params);
    }

    commitTask(task) {
        controller.commitTask(task);
    }

    command(cmd, ...args) {
        controller.command(cmd, this.dataSource, ...args);
    }

    writeln(data, dataSource, context = {}) {
        controller.writeln(data, this.dataSource, context);
    }

    _getCallback(callback) {
        const newVar = this.map.get(callback);
        if (newVar) {
            return newVar;
        }
        const newCallback = (options) => {
            // some callback events have no dataSource
            if (options && options.dataSource && options.dataSource !== this.dataSource) {
                return;
            }
            callback(options);
        };
        this.map.set(callback, newCallback);
        return newCallback;
    }

    _removeCallback(callback) {
        const newVar = this.map.get(callback);
        if (newVar) {
            this.map.delete(callback);
        }
        return newVar;
    }
}

export default SerialClient;
