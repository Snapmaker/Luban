import { EventEmitter } from 'events';
import { NetworkConfiguration, NetworkStationState, NetworkOptions } from '@snapmaker/snapmaker-sacp-sdk/dist/models';

import SocketServer from '../../../lib/SocketManager';

interface ConnectionOpenOptions {
    address?: string;
    host?: string;
    port?: string;
    token?: string;
}
interface ConnectionCloseOptions {
    force?: boolean;
}

/**
 * Defines basic Channel functions.
 */
export default class Channel extends EventEmitter {
    protected socket: SocketServer;

    public setSocket(socket: SocketServer): void {
        this.socket = socket;
    }

    /**
     * Connection open.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async connectionOpen(options?: ConnectionOpenOptions): Promise<boolean> {
        return false;
    }

    /**
     * Connection close.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async connectionClose(options?: ConnectionCloseOptions): Promise<boolean> {
        return false;
    }

    /**
     * Start heartbeat.
     */
    public async startHeartbeat(): Promise<void> {
        return Promise.resolve();
    }
}

// G-code

export interface GcodeChannelInterface extends Channel {
    executeGcode(gcode: string): Promise<boolean>;
}

// File

export interface UploadFileOptions {
    filePath: string;
    targetFilename?: string;
}
export interface FileChannelInterface extends Channel {
    uploadFile(options: UploadFileOptions): Promise<boolean>;

    compressUploadFile(options: UploadFileOptions): Promise<boolean>;
}

// System

export interface UpgradeFirmwareOptions {
    filename: string;
}

export interface SystemChannelInterface extends Channel {
    // log
    exportLogToExternalStorage(): Promise<boolean>;

    // firmware
    getFirmwareVersion(): Promise<string>;

    upgradeFirmwareFromFile(options: UpgradeFirmwareOptions): Promise<boolean>;
}

// Network

export interface NetworkServiceChannelInterface extends Channel {
    configureNetwork(networkOptions: NetworkOptions): Promise<boolean>;
    getNetworkConfiguration(): Promise<NetworkConfiguration>;
    getNetworkStationState(): Promise<NetworkStationState>;
}

// Print Job

export interface PrintJobChannelInterface extends Channel {
    // TODO: add callback
    subscribeGetPrintCurrentLineNumber(): Promise<boolean>;
    unsubscribeGetPrintCurrentLineNumber(): Promise<boolean>;
}

// Laser

export interface LaserChannelInterface extends Channel {
    getCrosshairOffset(): Promise<{x: number; y: number}>;
    setCrosshairOffset(x: number, y: number): Promise<boolean>;
    getFireSensorSensitivity(): Promise<number>;
    setFireSensorSensitivity(sensitivity: number): Promise<boolean>;
}

// CNC

export interface CncChannelInterface extends Channel {
    setSpindleSpeed(speed: number): Promise<boolean>;
    setSpindleSpeedPercentage(percent: number): Promise<boolean>;
    spindleOn(): Promise<boolean>;
    spindleOff(): Promise<boolean>;
}
