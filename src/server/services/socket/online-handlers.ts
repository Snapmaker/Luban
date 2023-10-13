import path from 'path';
import request from 'superagent';

import SocketEvent from '../../../app/communication/socket-events';
import { SnapmakerRayMachine } from '../../../app/machines';
import DataStorage from '../../DataStorage';
import type SocketServer from '../../lib/SocketManager';
import downloadManager from '../../lib/downloadManager';
import logger from '../../lib/logger';

const log = logger('services:socket:online-handlers');

interface LatestFirmwareInfo {
    version: string;
    url: string;
    changeLog: {
        features: string[],
        improvements: string[];
        bugs: string[];
    }
}

async function getLatestFirmwareInfo(machineIdentifier: string): Promise<LatestFirmwareInfo> {
    switch (machineIdentifier) {
        case SnapmakerRayMachine.identifier: {
            const latestInfo = await new Promise<LatestFirmwareInfo>((resolve) => {
                request
                    .get('https://api.snapmaker.com/v1/ray/version')
                    .end((err, res) => {
                        if (err) {
                            log.error(err);
                            return;
                        }

                        const data = res.body.data?.new_version || {};
                        const info = {
                            version: data.version,
                            url: data.url,
                            changeLog: {
                                features: data.change_log?.new_feature || [],
                                improvements: data.change_log?.improvement || [],
                                bugs: data.change_log?.bug_fixed || [],
                            }
                        };
                        resolve(info);
                    });
            });
            return latestInfo;
        }
        default:
            return null;
    }
}

interface GetLatestFirmwareOptions {
    machineIdentifier: string;
}

async function getLatestFirmwareVersion(socket: SocketServer, options: GetLatestFirmwareOptions) {
    const { machineIdentifier } = options;

    const latestFirmwareInfo = await getLatestFirmwareInfo(machineIdentifier);

    if (latestFirmwareInfo) {
        socket.emit(SocketEvent.GetLatestFirmwareVersion, {
            err: 0,
            ...latestFirmwareInfo
        });
    } else {
        // not supported
        socket.emit(SocketEvent.GetLatestFirmwareVersion, { err: 1 });
    }
}

async function downloadLatestFirmware(socket: SocketServer, options: GetLatestFirmwareOptions) {
    const { machineIdentifier } = options;

    const latestFirmwareInfo = await getLatestFirmwareInfo(machineIdentifier);
    if (!latestFirmwareInfo) {
        return;
    }

    const url = latestFirmwareInfo.url;

    try {
        const targetPath = path.join(DataStorage.tmpDir, 'update.bin');
        await downloadManager.download(
            url,
            targetPath,
        );
        socket.emit(SocketEvent.DownloadLatestFirmware, { err: 0, filePath: targetPath });
    } catch (e) {
        log.error('Download firmware file failed.');
        socket.emit(SocketEvent.DownloadLatestFirmware, { err: 1 });
    }
}

function register(socketServer: SocketServer): void {
    const connectionEventsObject = {
        [SocketEvent.GetLatestFirmwareVersion]: getLatestFirmwareVersion,
        [SocketEvent.DownloadLatestFirmware]: downloadLatestFirmware,
    };

    Object.entries(connectionEventsObject).forEach(([key, value]) => {
        socketServer.registerEvent(key, value);
    });
}

export {
    register
};

