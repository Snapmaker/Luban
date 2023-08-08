import { EventEmitter } from 'events';

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

export interface GcodeChannelInterface extends Channel {
    executeGcode(gcode: string): Promise<boolean>;
}


export interface UploadFileOptions {
    filePath: string;
    targetFilename?: string;
}
export interface FileChannelInterface extends Channel {
    uploadFile(options: UploadFileOptions): Promise<boolean>;
}


export interface UpgradeFirmwareOptions {
    filename: string;
}

export interface SystemChannelInterface extends Channel {
    exportLogToExternalStorage(): Promise<boolean>;

    upgradeFirmwareFromFile(options: UpgradeFirmwareOptions): Promise<boolean>;
}

export interface FirmwareUpgradeInterface extends Channel {
    upgradeFromFile(filePath: string): Promise<boolean>;
    watchUpgradeResult(): Promise<boolean>;
}
