import controller from './controller';

class Client {
    constructor(options) {
        this.dataSource = options.dataSource || '';
    }

    getPort() {
        return controller.port;
    }

    getContext() {
        return controller.context;
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
        controller.on(eventName, callback);
    }

    off(eventName, callback) {
        controller.off(eventName, callback);
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
}

export default Client;
