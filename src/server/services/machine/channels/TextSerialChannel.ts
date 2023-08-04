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

    public async connectionOpen(options): Promise<boolean> {
        const { port, connectionTimeout } = options;

        this.port = port;
        this.dataSource = PROTOCOL_TEXT;

        let controller = store.get(`controllers["${port}/${this.dataSource}"]`);
        if (!controller) {
            controller = new MarlinController({
                port,
                dataSource: this.dataSource,
                baudrate: 115200,
                connectionTimeout: connectionTimeout
            });

            controller.on('Ready', (data) => {
                this.emit(ChannelEvent.Ready, data);
            });
        }

        controller.addConnection(this.socket);

        if (controller.isOpen()) {
            log.debug('controller.isOpen() already');
            // Join the room, useless
            // socket.join(port);

            this.emit(ChannelEvent.Connecting);
            this.emit(ChannelEvent.Connected);

            // TODO: need instance implementations to support emit Ready
            this.socket.emit('connection:connected', {
                state: controller.controller.state,
                connectionType: 'serial',
            });

            return true;
        } else {
            this.emit(ChannelEvent.Connecting);

            return new Promise<boolean>((resolve) => {
                controller.open((err = null) => {
                    if (err) {
                        // socket.emit('connection:open', { port, msg: err, dataSource });
                        resolve(false);
                        return;
                    }

                    store.set(`controllers["${port}/${this.dataSource}"]`, controller);

                    this.emit(ChannelEvent.Connected);

                    resolve(true);
                }, connectionTimeout);
            });
        }
    }

    public async connectionClose(): Promise<boolean> {
        const port = this.port;
        const dataSource = this.dataSource;

        const controller = store.get(`controllers["${port}/${dataSource}"]`);
        if (!controller) {
            return false;
        }

        return new Promise((resolve) => {
            controller.close(() => {
                // Remove controller from store
                store.unset(`controllers["${port}/${dataSource}"]`);

                // Destroy controller
                controller.destroy();

                resolve(true);
            });
        });
    }

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
