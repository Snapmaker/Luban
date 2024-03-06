import { includes } from 'lodash';
import { MarlinController } from '../../../controllers';
import { PROTOCOL_TEXT, WRITE_SOURCE_CLIENT } from '../../../controllers/constants';
import type SocketServer from '../../../lib/SocketManager';
import logger from '../../../lib/logger';
import Channel, { CncChannelInterface, ExecuteGcodeResult, LaserChannelInterface } from './Channel';
import { ChannelEvent } from './ChannelEvent';
import { L20WLaserToolModule, L40WLaserToolModule } from '../../../../app/machines/snapmaker-2-toolheads';

const log = logger('machine:channels:TextSerialChannel');

const DEFAULT_BAUDRATE = 115200;
class TextSerialChannel extends Channel implements
    LaserChannelInterface,
    CncChannelInterface {
    private port = '';

    private dataSource = '';

    private controller: MarlinController = null;

    public getController(): MarlinController {
        return this.controller;
    }

    public onDisconnection = (socket: SocketServer) => {
        const controller = this.controller;
        if (!controller) {
            return;
        }
        controller.removeConnection(socket);
    };

    public async connectionOpen(options): Promise<boolean> {
        const { port, baudRate = DEFAULT_BAUDRATE, connectionTimeout } = options;

        this.port = port;
        this.dataSource = PROTOCOL_TEXT;

        let controller = this.controller;
        if (!controller) {
            controller = new MarlinController({
                port,
                dataSource: this.dataSource,
                baudRate: baudRate,
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

                    this.controller = controller;

                    this.emit(ChannelEvent.Connected);

                    resolve(true);
                }, connectionTimeout);
            });
        }
    }

    public async connectionClose(): Promise<boolean> {
        const controller = this.controller;
        if (!controller) {
            return false;
        }

        return new Promise((resolve) => {
            controller.close();

            // Remove controller
            this.controller = null;

            // Destroy controller
            controller.destroy();

            resolve(true);
        });
    }

    public async executeGcode(gcode: string): Promise<ExecuteGcodeResult> {
        const gcodeLines = gcode.split('\n');

        const controller = this.controller;
        controller.command(null, 'gcode', gcodeLines);

        return {
            result: 0,
            text: 'ok',
        };
    }

    // interface: LaserChannelInterface

    public async turnOnTestLaser(): Promise<boolean> {
        const controller = this.getController();
        const state = controller.controller.state;

        const toolHead = state?.toolHead;
        if (toolHead && includes([L20WLaserToolModule.identifier, L40WLaserToolModule.identifier], toolHead)) {
            const executeResult = await this.executeGcode('M3 P0.2');
            return executeResult.result === 0;
        } else {
            // Can't detect tool head identifier by now, use 1% temporarily
            const executeResult = await this.executeGcode('M3 P1 S2.55');
            return executeResult.result === 0;
        }
    }

    public async turnOnCrosshair(): Promise<boolean> {
        return false;
    }

    public async turnOffCrosshair(): Promise<boolean> {
        return false;
    }

    public async getCrosshairOffset(): Promise<{ x: number; y: number; }> {
        return { x: 0, y: 0 };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async setCrosshairOffset(x: number, y: number): Promise<boolean> {
        return false;
    }

    public async getFireSensorSensitivity(): Promise<number> {
        return 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async setFireSensorSensitivity(sensitivity: number): Promise<boolean> {
        return false;
    }

    // interface: CncChannelInterface

    public async setSpindleSpeed(speed: number): Promise<boolean> {
        console.log('set speed', speed);
        // on and off to set speed
        const gcode = [
            `M3 S${speed} C`,
            // `M3 S${speed}`,
            // 'M5',
        ].join('\n');

        const { result } = await this.executeGcode(gcode);
        return result === 0;
    }

    public async setSpindleSpeedPercentage(percent: number): Promise<boolean> {
        // on and off to set speed
        const gcode = [
            `M3 P${percent}`,
            'M5',
        ].join('\n');

        const { result } = await this.executeGcode(gcode);
        return result === 0;
    }

    public async spindleOn(): Promise<boolean> {
        const { result } = await this.executeGcode('M3');
        return result === 0;
    }

    public async spindleOff(): Promise<boolean> {
        const { result } = await this.executeGcode('M5');
        return result === 0;
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
        log.debug(`socket.command("${port}", "${cmd}"): id=${socket.id}, args=${JSON.stringify(args)}`);

        const controller = this.controller;
        if (!controller || !controller.isOpen()) {
            log.error(`Serial port "${port}" not accessible`);
            return;
        }

        controller.command(socket, cmd, ...args);
    };

    public writeln = (socket: SocketServer, options) => {
        const port = this.port;
        const { data, context = {} } = options;

        log.debug(`socket.writeln("${port}", "${data}", ${JSON.stringify(context)}): id=${socket.id}`);

        const controller = this.controller;
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
