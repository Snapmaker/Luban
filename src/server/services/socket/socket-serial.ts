import { SerialPort } from 'serialport';
import store from '../../store';
import logger from '../../lib/logger';
import type SocketServer from '../../lib/SocketManager';
import { MarlinController } from '../../controllers';
import ensureArray from '../../lib/ensure-array';
import config from '../configstore';
import { PROTOCOL_TEXT, WRITE_SOURCE_CLIENT } from '../../controllers/constants';
import { CONNECTION_TYPE_SERIAL } from '../../constants';

const log = logger('service:socket-server');
let intervalHandle = null;

class SocketSerial {
    private port = '';

    private dataSource = '';

    private machineSubscriber = [];

    public onDisconnection = (socket: SocketServer) => {
        this.onDisSubscribe(socket);

        const controllers = store.get('controllers', {});
        Object.keys(controllers).forEach((port) => {
            log.debug(`port, ${port}`);
            const controller = controllers[port];
            if (!controller) {
                return;
            }
            controller.removeConnection(socket);
        });
    };

    public onSubscribe = (socket: SocketServer) => {
        this.machineSubscriber.push(socket);
        this.serialportList();

        if (!intervalHandle) {
            intervalHandle = setInterval(() => {
                this.serialportList();
            }, 1000);
        }
    };

    public onDisSubscribe = (socket: SocketServer) => {
        this.machineSubscriber = this.machineSubscriber.filter(e => e !== socket);
        if (this.machineSubscriber.length === 0) {
            clearInterval(intervalHandle);
            intervalHandle = null;
        }
    };

    public serialportList = () => {
        if (this.machineSubscriber.length === 0) {
            return;
        }

        SerialPort.list()
            .then((ports) => {
                const allPorts = ports.concat(ensureArray(config.get('ports', [])));

                const controllers = store.get('controllers', {});
                const portsInUse = Object.keys(controllers)
                    .filter((port) => {
                        const controller = controllers[port];
                        return controller && controller.isOpen();
                    });
                const availablePorts = allPorts.filter((port) => {
                    return port.productId;
                }).map((port) => {
                    return {
                        port: port.path,
                        manufacturer: port.manufacturer,
                        inuse: portsInUse.indexOf(port.path) >= 0
                    };
                });

                for (const socket of this.machineSubscriber) {
                    socket.emit('machine:serial-discover', { devices: availablePorts, type: CONNECTION_TYPE_SERIAL });
                }
            })
            .catch((err) => {
                log.error(err);
            });
    };

    public serialportOpen = (socket: SocketServer, options) => {
        const { port, dataSource = PROTOCOL_TEXT, connectionTimeout } = options;
        log.debug(`socket.open("${port}"): socket=${socket.id}`);
        this.port = port;
        this.dataSource = dataSource;
        let controller = store.get(`controllers["${port}/${dataSource}"]`);
        if (!controller) {
            if (dataSource === PROTOCOL_TEXT) {
                controller = new MarlinController({ port, dataSource, baudrate: 115200, connectionTimeout: connectionTimeout });
            }
        }

        controller.addConnection(socket);

        if (controller.isOpen()) {
            log.debug('controller.isOpen() already');
            // Join the room, useless
            // socket.join(port);

            socket.emit('connection:open', { port, dataSource });
            socket.emit('connection:connected', { state: controller.controller.state, dataSource, connectionType: 'serial' });
        } else {
            controller.open((err = null) => {
                if (err) {
                    socket.emit('connection:open', { port, msg: err, dataSource });
                    return;
                }
                log.debug(`controller.isOpen() already ${socket}`);

                if (store.get(`controllers["${port}/${dataSource}"]`)) {
                    log.error(`Serial port "${port}" was not properly closed`);
                }
                store.set(`controllers["${port}/${dataSource}"]`, controller);

                // Join the room, useless
                // socket.join(port);

                socket.emit('connection:open', { port, dataSource });
            }, connectionTimeout);
        }
    };

    public connectionClose = (socket: SocketServer) => {
        const port = this.port;
        const dataSource = this.dataSource;
        log.debug(`socket.close("${port}"): id=${socket.id}`);

        const controller = store.get(`controllers["${port}/${dataSource}"]`);
        if (!controller) {
            const err = `Serial port "${port}" not accessible`;
            log.error(err);
            socket.emit('connection:close', { port: port, err: new Error(err), dataSource: dataSource });
            return;
        }

        // Leave the room
        // socket.leave(port);
        controller.close(() => {
            // Remove controller from store
            store.unset(`controllers["${port}/${dataSource}"]`);

            // Destroy controller
            controller.destroy();
        });
        socket.emit('connection:close', { port: port, dataSource: dataSource });
    };

    /**
     *
     * @param options
     *      {
     *          cmd='gcode:start',
     *          args=[gcode, context]
     *      }
     */

    public command = (socket: SocketServer, options) => {
        const { cmd = 'gcode', args = [] } = options;
        const port = this.port;
        const dataSource = this.dataSource;
        log.debug(`socket.command("${port}", "${cmd}"): id=${socket.id}, args=${JSON.stringify(args)}`);

        const controller = store.get(`controllers["${port}/${dataSource}"]`);
        if (!controller || !controller.isOpen()) {
            log.error(`Serial port "${port}" not accessible`);
            return;
        }

        controller.command(socket, cmd, ...args);
    };

    public writeln = (socket: SocketServer, options) => {
        const port = this.port;
        const dataSource = this.dataSource;
        const { data, context = {} } = options;

        log.debug(`socket.writeln("${port}", "${data}", ${JSON.stringify(context)}): id=${socket.id}`);

        const controller = store.get(`controllers["${port}/${dataSource}"]`);
        if (!controller || !controller.isOpen()) {
            log.error(`Serial port "${port}" not accessible`);
            return;
        }

        if (!context.source) {
            context.source = WRITE_SOURCE_CLIENT;
        }
        controller.writeln(data, context);
    };
}

const socketSerial = new SocketSerial();

export default socketSerial;
