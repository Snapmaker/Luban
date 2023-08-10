import type SocketServer from '../../lib/SocketManager';
import { connectionManager } from '../machine/ConnectionManager';
import ControllerEvent from '../../../app/connection/controller-events';


function register(socketServer: SocketServer): void {
    const connectionEventsObject = {
        // connection
        [ControllerEvent.ConnectionOpen]: connectionManager.connectionOpen,
        [ControllerEvent.ConnectionClose]: connectionManager.connectionClose,

        // general functions
        [ControllerEvent.ExecuteGCode]: connectionManager.executeGcode,
        [ControllerEvent.ExecuteCmd]: connectionManager.executeCmd,

        // motion control services
        [ControllerEvent.GoHome]: connectionManager.goHome,
        [ControllerEvent.Move]: connectionManager.coordinateMove,
        [ControllerEvent.SetOrigin]: connectionManager.setWorkOrigin,
        // 'connection:getWorkSpeedFactor': connectionManager.getWorkSpeedFactor,
        [ControllerEvent.SetSpeedFactor]: connectionManager.updateWorkSpeedFactor,

        // 3d printing control services
        [ControllerEvent.SwitchActiveExtruder]: connectionManager.switchExtruder,
        [ControllerEvent.SetExtruderTemperature]: connectionManager.updateNozzleTemperature,
        [ControllerEvent.LoadFilament]: connectionManager.loadFilament,
        [ControllerEvent.UnloadFilamnet]: connectionManager.unloadFilament,
        [ControllerEvent.SetBedTemperature]: connectionManager.updateBedTemperature,
        [ControllerEvent.SetZOffset]: connectionManager.updateZOffset,

        // laser control services
        [ControllerEvent.SetLaserPower]: connectionManager.updateLaserPower,
        [ControllerEvent.SwitchLaserPower]: connectionManager.switchLaserPower,
        [ControllerEvent.CalcMaterialThickness]: connectionManager.getLaserMaterialThickness,
        [ControllerEvent.AbortMaterialThickness]: connectionManager.abortLaserMaterialThickness,

        // CNC control services
        [ControllerEvent.SetSpindleSpeed]: connectionManager.updateToolHeadSpeed, // CNC, FOR NOW
        [ControllerEvent.SwitchCNC]: connectionManager.switchCNC, // CNC, FOR NOW

        // modules services
        'connection:setEnclosureLight': connectionManager.setEnclosureLight,
        'connection:setEnclosureFan': connectionManager.setEnclosureFan,
        'connection:setDoorDetection': connectionManager.setDoorDetection,
        'connection:setFilterSwitch': connectionManager.setFilterSwitch,
        'connection:setFilterWorkSpeed': connectionManager.setFilterWorkSpeed,

        // machine print G-code
        [ControllerEvent.StartGCode]: connectionManager.startGcode,
        [ControllerEvent.PauseGCode]: connectionManager.pauseGcode,
        [ControllerEvent.ResumeGCode]: connectionManager.resumeGcode,
        [ControllerEvent.StopGCode]: connectionManager.stopGcode,

        'connection:getGcodeFile': connectionManager.getGcodeFile,
        // Seems like it's an ugly solution to start job waiting for movement done
        // TODO: Do it in instance logic
        'connection:headBeginWork': connectionManager.startGcodeAction,

        // File service
        [ControllerEvent.UploadFile]: connectionManager.uploadFile,

        // machine network
        'connection:wifiStatusTest': connectionManager.wifiStatusTest,
        [ControllerEvent.GetMachineNetworkConfiguration]: connectionManager.getNetworkConfiguration,
        [ControllerEvent.GetMachineNetworkStationState]: connectionManager.getNetworkStationState,
        [ControllerEvent.SetMachineNetworkConfiguration]: connectionManager.configureMachineNetwork,

        // machine system
        [ControllerEvent.ExportLogToExternalStorage]: connectionManager.exportLogToExternalStorage,
        [ControllerEvent.GetFirmwareVersion]: connectionManager.getFirmwareVersion,
        [ControllerEvent.UpgradeFirmware]: connectionManager.upgradeFirmwareFromFile,
    };

    Object.entries(connectionEventsObject).forEach(([key, value]) => {
        socketServer.registerEvent(key, value);
    });
}


export {
    register,
};
