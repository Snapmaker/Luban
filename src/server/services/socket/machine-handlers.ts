import type SocketServer from '../../lib/SocketManager';
import { connectionManager } from '../machine/ConnectionManager';
import SocketEvent from '../../../app/communication/socket-events';


function register(socketServer: SocketServer): void {
    const connectionEventsObject = {
        // connection
        [SocketEvent.ConnectionOpen]: connectionManager.connectionOpen,
        [SocketEvent.ConnectionClose]: connectionManager.connectionClose,

        // general functions
        [SocketEvent.ExecuteGCode]: connectionManager.executeGcode,
        [SocketEvent.ExecuteCmd]: connectionManager.executeCmd,

        // motion control services
        [SocketEvent.GoHome]: connectionManager.goHome,
        [SocketEvent.Move]: connectionManager.coordinateMove,
        [SocketEvent.SetOrigin]: connectionManager.setWorkOrigin,
        // 'connection:getWorkSpeedFactor': connectionManager.getWorkSpeedFactor,
        [SocketEvent.SetSpeedFactor]: connectionManager.updateWorkSpeedFactor,

        // 3d printing control services
        [SocketEvent.SwitchActiveExtruder]: connectionManager.switchExtruder,
        [SocketEvent.SetExtruderTemperature]: connectionManager.updateNozzleTemperature,
        [SocketEvent.LoadFilament]: connectionManager.loadFilament,
        [SocketEvent.UnloadFilamnet]: connectionManager.unloadFilament,
        [SocketEvent.SetBedTemperature]: connectionManager.updateBedTemperature,
        [SocketEvent.SetZOffset]: connectionManager.updateZOffset,

        // laser control services
        [SocketEvent.SetLaserPower]: connectionManager.updateLaserPower,
        [SocketEvent.SwitchLaserPower]: connectionManager.switchLaserPower,
        [SocketEvent.CalcMaterialThickness]: connectionManager.getLaserMaterialThickness,
        [SocketEvent.AbortMaterialThickness]: connectionManager.abortLaserMaterialThickness,
        [SocketEvent.GetCrosshairOffset]: connectionManager.getCrosshairOffset,
        [SocketEvent.SetCrosshairOffset]: connectionManager.setCrosshairOffset,
        [SocketEvent.GetFireSensorSensitivity]: connectionManager.getFireSensorSensitivity,
        [SocketEvent.SetFireSensorSensitivity]: connectionManager.setFireSensorSensitivity,

        // CNC control services
        [SocketEvent.SetSpindleSpeed]: connectionManager.setSpindleSpeed, // CNC, FOR NOW
        [SocketEvent.SwitchCNC]: connectionManager.switchCNC, // CNC, FOR NOW

        // modules services
        [SocketEvent.GetEnclosureInfo]: connectionManager.getEnclosureInfo,
        [SocketEvent.SetEnclosureLight]: connectionManager.setEnclosureLight,
        [SocketEvent.SetEnclosureFan]: connectionManager.setEnclosureFan,
        [SocketEvent.SetEnclosureDoorDetection]: connectionManager.setEnclosureDoorDetection,

        [SocketEvent.GetAirPurifierInfo]: connectionManager.getAirPurifierInfo,
        [SocketEvent.SetAirPurifierSwitch]: connectionManager.setFilterSwitch,
        [SocketEvent.SetAirPurifierStrength]: connectionManager.setAirPurifierFanStrength,

        // machine print job
        [SocketEvent.StartGCode]: connectionManager.startGcode,
        [SocketEvent.PauseGCode]: connectionManager.pauseGcode,
        [SocketEvent.ResumeGCode]: connectionManager.resumeGcode,
        [SocketEvent.StopGCode]: connectionManager.stopGcode,

        'connection:getGcodeFile': connectionManager.getGcodeFile,
        // Seems like it's an ugly solution to start job waiting for movement done
        // TODO: Do it in instance logic
        'connection:headBeginWork': connectionManager.startGcodeAction,

        // File service
        [SocketEvent.UploadFile]: connectionManager.uploadFile,
        [SocketEvent.CompressUploadFile]: connectionManager.compressUploadFile,

        // machine network
        'connection:wifiStatusTest': connectionManager.wifiStatusTest,
        [SocketEvent.GetMachineNetworkConfiguration]: connectionManager.getNetworkConfiguration,
        [SocketEvent.GetMachineNetworkStationState]: connectionManager.getNetworkStationState,
        [SocketEvent.SetMachineNetworkConfiguration]: connectionManager.configureMachineNetwork,

        // machine system
        [SocketEvent.ExportLogToExternalStorage]: connectionManager.exportLogToExternalStorage,
        [SocketEvent.GetFirmwareVersion]: connectionManager.getFirmwareVersion,
        [SocketEvent.UpgradeFirmware]: connectionManager.upgradeFirmwareFromFile,
    };

    Object.entries(connectionEventsObject).forEach(([key, value]) => {
        socketServer.registerEvent(key, value);
    });
}


export {
    register,
};
