
enum SocketEvent {
    /**
     * Machine Discover
     */
    DiscoverMachine = 'discover:machine',
    DiscoverMachineStart = 'discover:start',
    DiscoverMachineEnd = 'discover:end',

    /**
     * Connection
     */
    ConnectionOpen = 'connection:open',
    ConnectionConnecting = 'connection:connecting',
    ConnectionClose = 'connection:close',

    /**
     * Global
     */
    ExecuteGCode = 'connection:executeGcode',
    ExecuteCmd = 'connection:executeCmd',

    /**
     * Motion
     */
    GoHome = 'connection:goHome',
    Move = 'connection:coordinateMove', // Linear Move
    SetOrigin = 'connection:setWorkOrigin',
    SetSpeedFactor = 'connection:updateWorkSpeedFactor',

    /**
     * 3D Printing
     */
    SwitchActiveExtruder = 'connection:updateWorkNozzle',
    SetExtruderTemperature = 'connection:updateNozzleTemperature',
    LoadFilament = 'connection:loadFilament',
    UnloadFilamnet = 'connection:unloadFilament',
    SetBedTemperature = 'connection:updateBedTemperature',
    SetZOffset = 'connection:updateZOffset',

    /**
     * Laser
     */
    SetLaserPower = 'connection:updateLaserPower',
    SwitchLaserPower = 'connection:switchLaserPower', // ?
    CalcMaterialThickness = 'connection:materialThickness',
    AbortMaterialThickness = 'connection:materialThickness_abort',
    GetCrosshairOffset = 'connection:get-crosshair-offset',
    SetCrosshairOffset = 'connection:set-crosshair-offset',
    GetFireSensorSensitivity = 'connection:get-fire-sensor-sensitivity',
    SetFireSensorSensitivity = 'connection:set-fire-sensor-sensitivity',

    /**
     * CNC
     */
    SwitchCNC = 'connection:switchCNC',
    SetSpindleSpeed = 'connection:set-spindle-speed',

    /**
     * Module: Enclosure
     */
    GetEnclosureInfo = 'connection:get-enclosure-info',
    SetEnclosureLight = 'connection:setEnclosureLight',
    SetEnclosureFan = 'connection:setEnclosureFan',
    SetEnclosureDoorDetection = 'connection:setDoorDetection',

    /**
     * Module: Air Purifier
     */
    GetAirPurifierInfo = 'connection:get-air-purifier-info',
    SetAirPurifierSwitch = 'connection:setFilterSwitch',
    SetAirPurifierStrength = 'connection:setFilterWorkSpeed',

    /**
     * File
     */
    UploadFileProgress = 'connection:upload-file:progress',
    UploadFile = 'connection:uploadFile',
    UploadFileCompressing = 'connection:upload-file:compressing', // file is compressing
    UploadFileDecompressing = 'connection:upload-file:decompressing', // file is decompressing
    CompressUploadFile = 'connection:compress-upload-file',

    /**
     * Machine Network (Wi-Fi)
     */
    GetMachineNetworkConfiguration = 'machine:get-network-configuration',
    GetMachineNetworkStationState = 'machine:get-network-station-state',
    SetMachineNetworkConfiguration = 'machine:set-network-configuration',

    /**
     * Machine System
     */
    ExportLogToExternalStorage = 'machine:export-log-to-external-storage',
    GetFirmwareVersion = 'machine:get-firmware-version',
    UpgradeFirmware = 'machine:upgrade-firmware',

    /**
     * G-code control.
     */
    StartGCode = 'connection:startGcode',
    PauseGCode = 'connection:pauseGcode',
    ResumeGCode = 'connection:resumeGcode',
    StopGCode = 'connection:stopGcode',

    /**
     * Operating System
     */
    ListWiFiNetworks = 'os:list-wifi-networks',
}

export default SocketEvent;

export interface ConnectionConnectingOptions {
    requireAuth?: boolean;
}
