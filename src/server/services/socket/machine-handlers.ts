import type SocketServer from '../../lib/SocketManager';
import { connectionManager } from '../machine/ConnectionManager';
import ControllerEvent from '../../../app/connection/controller-events';


function register(socketServer: SocketServer): void {
    const connectionEventsObject = {
        'connection:open': connectionManager.connectionOpen,
        'connection:close': connectionManager.connectionClose,
        'connection:closeImproper': connectionManager.connectionCloseImproper,
        'connection:startGcode': connectionManager.startGcode,
        'connection:resumeGcode': connectionManager.resumeGcode,
        'connection:pauseGcode': connectionManager.pauseGcode,
        'connection:stopGcode': connectionManager.stopGcode,
        'connection:headBeginWork': connectionManager.startGcodeAction,
        'connection:executeGcode': connectionManager.executeGcode,
        'connection:startHeartbeat': connectionManager.startHeartbeat,
        'connection:getGcodeFile': connectionManager.getGcodeFile,
        'connection:uploadFile': connectionManager.uploadFile,
        'connection:updateNozzleTemperature': connectionManager.updateNozzleTemperature,
        'connection:updateBedTemperature': connectionManager.updateBedTemperature,
        'connection:updateZOffset': connectionManager.updateZOffset,
        'connection:loadFilament': connectionManager.loadFilament,
        'connection:unloadFilament': connectionManager.unloadFilament,
        'connection:updateWorkSpeedFactor': connectionManager.updateWorkSpeedFactor,
        // 'connection:getWorkSpeedFactor': connectionManager.getWorkSpeedFactor,
        'connection:updateLaserPower': connectionManager.updateLaserPower,
        'connection:switchLaserPower': connectionManager.switchLaserPower,
        'connection:materialThickness': connectionManager.getLaserMaterialThickness,
        'connection:setEnclosureLight': connectionManager.setEnclosureLight,
        'connection:setEnclosureFan': connectionManager.setEnclosureFan,
        'connection:setDoorDetection': connectionManager.setDoorDetection,
        'connection:setFilterSwitch': connectionManager.setFilterSwitch,
        'connection:setFilterWorkSpeed': connectionManager.setFilterWorkSpeed,
        'connection:materialThickness_abort': connectionManager.abortLaserMaterialThickness,
        'connection:goHome': connectionManager.goHome,
        'connection:coordinateMove': connectionManager.coordinateMove,
        'connection:setWorkOrigin': connectionManager.setWorkOrigin,
        'connection:updateToolHeadSpeed': connectionManager.updateToolHeadSpeed, // CNC, FOR NOW
        'connection:switchCNC': connectionManager.switchCNC, // CNC, FOR NOW
        'connection:updateWorkNozzle': connectionManager.switchExtruder,

        // machine network
        'connection:wifiStatusTest': connectionManager.wifiStatusTest,
        [ControllerEvent.GetMachineNetworkConfiguration]: connectionManager.getNetworkConfiguration,
        [ControllerEvent.GetMachineNetworkStationState]: connectionManager.getNetworkStationState,
        [ControllerEvent.SetMachineNetworkConfiguration]: connectionManager.configureNetwork,
    };

    Object.entries(connectionEventsObject).forEach(([key, value]) => {
        socketServer.registerEvent(key, value);
    });
}


export {
    register,
};
