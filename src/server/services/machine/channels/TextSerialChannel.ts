import { MarlinController } from '../../../controllers';
import { PROTOCOL_TEXT, WRITE_SOURCE_CLIENT } from '../../../controllers/constants';
import type SocketServer from '../../../lib/SocketManager';
import logger from '../../../lib/logger';
import store from '../../../store';
import Channel from './Channel';
import { ChannelEvent } from './ChannelEvent';

const log = logger('machine:channel:TextSerialChannel');

class TextSerialChannel extends Channel {
    private port = '';

    private dataSource = '';


    public onDisconnection = (socket: SocketServer) => {
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

    public connectionOpen = (socket: SocketServer, options) => {
        const { port, dataSource = PROTOCOL_TEXT, connectionTimeout } = options;
        log.debug(`socket.open("${port}"): socket=${socket.id}`);
        this.port = port;
        this.dataSource = dataSource;
        let controller = store.get(`controllers["${port}/${dataSource}"]`);
        if (!controller) {
            if (dataSource === PROTOCOL_TEXT) {
                controller = new MarlinController({ port, dataSource, baudrate: 115200, connectionTimeout: connectionTimeout });

                controller.on('Ready', (data) => {
                    this.emit(ChannelEvent.Ready, data);
                });
            }
        }

        controller.addConnection(socket);

        if (controller.isOpen()) {
            log.debug('controller.isOpen() already');
            // Join the room, useless
            // socket.join(port);

            socket.emit('connection:open', { port, dataSource });
            socket.emit('connection:connected', { state: controller.controller.state, dataSource, connectionType: 'serial' });

            this.emit('Connected');
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

                this.emit('Connected');
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
const channel = new TextSerialChannel();

export {
    channel as textSerialChannel
};

export default TextSerialChannel;
