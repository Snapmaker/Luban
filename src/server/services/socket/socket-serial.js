import serialport from 'serialport';
import store from '../../store';
import logger from '../../lib/logger';
import { WRITE_SOURCE_CLIENT } from '../../controllers/Marlin/constants';
import { MarlinController } from '../../controllers';
import ensureArray from '../../lib/ensure-array';
import config from '../configstore';

const log = logger('service:socket-server');

export const serialportList = (socket) => {
    log.debug(`serialport:list(): id=${socket.id}`);

    serialport.list((err, ports) => {
        if (err) {
            log.error(err);
            return;
        }

        const allPorts = ports.concat(ensureArray(config.get('ports', [])));

        const controllers = store.get('controllers', {});
        const portsInUse = Object.keys(controllers)
            .filter(port => {
                const controller = controllers[port];
                return controller && controller.isOpen();
            });

        const availablePorts = allPorts.map(port => {
            return {
                port: port.comName,
                manufacturer: port.manufacturer,
                inuse: portsInUse.indexOf(port.comName) >= 0
            };
        });

        socket.emit('serialport:list', availablePorts);
    });
};

export const serialportOpen = (socket, port) => {
    log.debug(`socket.open("${port}"): socket=${socket.id}`);

    let controller = store.get(`controllers["${port}"]`);
    if (!controller) {
        controller = new MarlinController(port, { baudrate: 115200 });
    }

    controller.addConnection(socket);

    if (controller.isOpen()) {
        log.debug('controller.isOpen() already');
        // Join the room
        socket.join(port);

        socket.emit('serialport:open', { port });
    } else {
        controller.open((err = null) => {
            if (err) {
                socket.emit('serialport:open', { port, err });
                return;
            }

            if (store.get(`controllers["${port}"]`)) {
                log.error(`Serial port "${port}" was not properly closed`);
            }
            store.set(`controllers["${port}"]`, controller);

            // Join the room
            socket.join(port);

            socket.emit('serialport:open', { port });
        });
    }
};

export const serialportClose = (socket, port) => {
    log.debug(`socket.close("${port}"): id=${socket.id}`);

    const controller = store.get(`controllers["${port}"]`);
    if (!controller) {
        const err = `Serial port "${port}" not accessible`;
        log.error(err);
        socket.emit('serialport:close', { port: port, err: new Error(err) });
        return;
    }

    // Leave the room
    socket.leave(port);

    controller.close(() => {
        // Remove controller from store
        store.unset(`controllers[${port}]`);

        // Destroy controller
        controller.destroy();
    });
};

export const command = (socket, port, cmd, ...args) => {
    log.debug(`socket.command("${port}", "${cmd}"): id=${socket.id}, args=${JSON.stringify(args)}`);

    const controller = store.get(`controllers["${port}"]`);
    if (!controller || !controller.isOpen()) {
        log.error(`Serial port "${port}" not accessible`);
        return;
    }

    controller.command(socket, cmd, ...args);
};

export const writeln = (socket, port, data, context = {}) => {
    log.debug(`socket.writeln("${port}", "${data}", ${JSON.stringify(context)}): id=${socket.id}`);

    const controller = store.get(`controllers["${port}"]`);
    if (!controller || !controller.isOpen()) {
        log.error(`Serial port "${port}" not accessible`);
        return;
    }

    if (!context.source) {
        context.source = WRITE_SOURCE_CLIENT;
    }
    controller.writeln(data, context);
};

export const disconnect = (socket) => {
    const controllers = store.get('controllers', {});
    Object.keys(controllers).forEach((port) => {
        const controller = controllers[port];
        if (!controller) {
            return;
        }
        controller.removeConnection(socket);
    });
};
