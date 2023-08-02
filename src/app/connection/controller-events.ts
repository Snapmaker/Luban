

enum ControllerEvent {
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
    ConnectionClose = 'connection:close',

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

export default ControllerEvent;
