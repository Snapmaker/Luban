import { includes } from 'lodash';
import { MarlinController } from '../../../controllers';
import { PROTOCOL_TEXT, WRITE_SOURCE_CLIENT } from '../../../controllers/constants';
import type SocketServer from '../../../lib/SocketManager';
import logger from '../../../lib/logger';
import Channel, { CncChannelInterface, ExecuteGcodeResult, LaserChannelInterface } from './Channel';
import { ChannelEvent } from './ChannelEvent';
import { L20WLaserToolModule, L40WLaserToolModule } from '../../../../app/machines/snapmaker-2-toolheads';
import { HEAD_LASER } from '../../../constants';
import { gcodeLease } from '../gcodeLease';
import { TextSerialMachineState, TextSerialMachineStateTracker } from './textSerialMachineState';

const log = logger('machine:channels:TextSerialChannel');

const DEFAULT_BAUDRATE = 115200;

/** The events TextSerialChannel watches on lib/SerialConnection (an EventEmitter with an isOpen getter). */
interface SerialPortEvents {
    on(event: string, listener: (...args: unknown[]) => void): unknown;
    removeListener(event: string, listener: (...args: unknown[]) => void): unknown;
    readonly isOpen?: boolean;
}
class TextSerialChannel extends Channel implements
    LaserChannelInterface,
    CncChannelInterface {
    private port = '';

    private dataSource = '';

    private controller: MarlinController = null;

    // Bumped at every port open/close this channel performs. MarlinController
    // also closes the port on its own (serial 'close'), and every reopen
    // creates a new serial connection object, so a change in that object is
    // counted as well when the generation is read.
    private connectionGeneration = 0;

    private observedPort: unknown = null;

    // The serial connection object (MarlinController.serialport) watched for
    // an unplug: its 'close', or an 'error' that leaves it closed, is a lost
    // link the channel reports as Disconnected (#265). Detached on a clean close.
    private watchedPort: SerialPortEvents | null = null;

    // The M114 replies MarlinController already polls, kept per connection
    // generation (textSerialMachineState.ts). No query of its own.
    private readonly machineState = new TextSerialMachineStateTracker();

    /** Read-only: lets callers tell a reconnected session from the one they started on. */
    public getConnectionGeneration(): number {
        const port = (this.controller as unknown as { serialport?: unknown } | null)?.serialport ?? null;
        if (port !== this.observedPort) {
            this.observedPort = port;
            this.connectionGeneration++;
        }
        return this.connectionGeneration;
    }

    public getController(): MarlinController {
        return this.controller;
    }

    /**
     * The newest M114 position reply of this connection, in the LOGICAL frame
     * (positionFrame 'logical', no originOffset: see textSerialMachineState.ts),
     * stamped with the time it was parsed. Null before the first reply, after
     * close, and once the port has dropped or been reopened under the channel.
     */
    public getLatestMachineState(): TextSerialMachineState | null {
        const controller = this.controller as unknown as {
            isOpen?: () => boolean;
            controller?: { state?: { [key: string]: unknown } } | null;
            workflow?: { state?: unknown } | null;
        } | null;
        if (!controller || typeof controller.isOpen !== 'function' || !controller.isOpen()) {
            this.machineState.clear();
            return null;
        }
        const marlinState = controller.controller?.state || {};
        return this.machineState.get(this.getConnectionGeneration(), {
            workflowState: controller.workflow?.state,
            isHomed: marlinState.isHomed,
            headType: marlinState.headType,
            headStatus: marlinState.headStatus,
            headPower: marlinState.headPower,
        });
    }

    private watchPort(controller: MarlinController): void {
        const port = (controller as unknown as { serialport?: SerialPortEvents | null }).serialport || null;
        if (port === this.watchedPort) {
            return;
        }
        this.unwatchPort();
        if (!port || typeof port.on !== 'function' || typeof port.removeListener !== 'function') {
            return;
        }
        this.watchedPort = port;
        port.on('close', this.onPortClose);
        port.on('error', this.onPortError);
    }

    private unwatchPort(): void {
        const port = this.watchedPort;
        this.watchedPort = null;
        if (port) {
            port.removeListener('close', this.onPortClose);
            port.removeListener('error', this.onPortError);
        }
    }

    private onPortClose = () => {
        this.portLost('serial port closed');
    };

    private onPortError = () => {
        const port = this.watchedPort;
        if (port && !port.isOpen) {
            this.portLost('serial port error left the port closed');
        }
    };

    /**
     * The port went away under the channel (USB unplug, the controller's
     * reboot): MarlinController has closed and destroyed itself on 'close',
     * so drop it - a later connectionOpen builds a fresh one - and report the
     * same Disconnected the other channels use, which clears the connection
     * status and tells the UI ('connection:close').
     */
    private portLost(reason: string): void {
        const controller = this.controller;
        this.unwatchPort();
        if (!controller) {
            return;
        }
        log.warn(`Serial port "${this.port}" lost (${reason}), reporting disconnected.`);
        this.controller = null;
        this.connectionGeneration++;
        this.machineState.clear();
        if ((controller as unknown as { serialport?: unknown }).serialport) {
            // An 'error' with no 'close': release the port the controller still holds.
            controller.close();
        }
        this.emit(ChannelEvent.Disconnected);
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
        this.machineState.clear();

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
            controller.on('positionReport', (payload) => {
                this.machineState.notePosition(payload, this.getConnectionGeneration());
            });
            controller.on('originOffsetReport', (payload) => {
                this.machineState.noteOriginOffset(payload, this.getConnectionGeneration());
            });
            controller.on('originSelectionReport', (payload) => {
                this.machineState.noteOriginSelection(payload, this.getConnectionGeneration());
            });
            // Every line written to the port, whoever wrote it: the write-path
            // evidence of homes, position shifts and planner syncs
            // (textSerialMachineState.ts, WP4a).
            controller.on('lineWritten', (data) => {
                this.machineState.noteLineWritten(String(data), this.getConnectionGeneration());
            });
        }

        controller.addConnection(this.socket);

        if (controller.isOpen()) {
            log.debug('controller.isOpen() already');
            // Join the room, useless
            // socket.join(port);

            this.watchPort(controller);
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
                    this.connectionGeneration++;
                    this.watchPort(controller);

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

        // A clean close is not a lost link: stop watching before the port closes.
        this.unwatchPort();

        if (controller.state.headType === HEAD_LASER) {
            controller.writeln('M5');
        }

        this.connectionGeneration++;
        this.machineState.clear();

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
        const refusal = gcodeLease.refusal(gcode);
        if (refusal) { return { result: -1, text: refusal }; }
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
