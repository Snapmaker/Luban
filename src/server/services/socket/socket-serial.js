import serialport from 'serialport';
import store from '../../store';
import logger from '../../lib/logger';
import { MarlinController } from '../../controllers';
import ensureArray from '../../lib/ensure-array';
import config from '../configstore';
import { PROTOCOL_TEXT, WRITE_SOURCE_CLIENT } from '../../controllers/constants';
import { CONNECTION_TYPE_SERIAL } from '../../constants';

const log = logger('service:socket-server');
let intervalHandle = null;

class SocketSerial {
    port = '';

    dataSource = '';

    socket = null;

    onConnection = (socket) => {
        intervalHandle = setInterval(() => {
            this.serialportList(socket);
        }, 1000);
    }

    onDisconnection = (socket) => {
        clearInterval(intervalHandle);
        const controllers = store.get('controllers', {});
        Object.keys(controllers).forEach((port) => {
            const controller = controllers[port];
            if (!controller) {
                return;
            }
            controller.removeConnection(socket);
        });
    };

    serialportList = (socket) => {
        // const { dataSource = 'text' } = options;

        serialport.list()
            .then(ports => {
                const allPorts = ports.concat(ensureArray(config.get('ports', [])));

                const controllers = store.get('controllers', {});
                const portsInUse = Object.keys(controllers)
                    .filter(port => {
                        const controller = controllers[port];
                        return controller && controller.isOpen();
                    });

                const availablePorts = allPorts.map(port => {
                    return {
                        port: port.path,
                        manufacturer: port.manufacturer,
                        inuse: portsInUse.indexOf(port.path) >= 0
                    };
                });
                socket.emit('machine:serial-discover', { devices: availablePorts, type: CONNECTION_TYPE_SERIAL });
            })
            .catch(err => {
                log.error(err);
            });
    };

    serialportOpen = (socket, options) => {
        const { port, dataSource = PROTOCOL_TEXT, connectionTimeout } = options;
        log.debug(`socket.open("${port}"): socket=${socket.id}`);
        this.port = port;
        this.dataSource = dataSource;
        this.socket = socket;
        let controller = store.get(`controllers["${port}/${dataSource}"]`);
        if (!controller) {
            if (dataSource === PROTOCOL_TEXT) {
                controller = new MarlinController({ port, dataSource, baudrate: 115200, connectionTimeout: connectionTimeout });
            }
        }

        controller.addConnection(socket);

        if (controller.isOpen()) {
            log.debug('controller.isOpen() already');
            // Join the room
            socket.join(port);

            socket.emit('connection:open', { port, dataSource });
            socket.emit('serialport:connected', { state: controller.controller.state, dataSource });
        } else {
            controller.open((err = null) => {
                if (err) {
                    socket.emit('connection:open', { port, err, dataSource });
                    return;
                }

                if (store.get(`controllers["${port}/${dataSource}"]`)) {
                    log.error(`Serial port "${port}" was not properly closed`);
                }
                store.set(`controllers["${port}/${dataSource}"]`, controller);

                // Join the room
                socket.join(port);

                socket.emit('connection:open', { port, dataSource });
            }, connectionTimeout);
        }
    };

    connectionClose = (socket) => {
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
        socket.leave(port);
        this.socket = null;
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

    command = (socket, options) => {
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

    writeln = (socket, options) => {
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
