

enum ControllerEvent {
    // G-code
    StartGCode = 'connection:startGcode',
    PauseGCode = 'connection:pauseGcode',
    ResumeGCode = 'connection:resumeGcode',
    StopGCode = 'connection:stopGcode',

    // network
    ListWiFiNetworks = 'os:list-wifi-networks',

    // machine network
    GetMachineNetworkConfiguration = 'machine:get-network-configuration',
    GetMachineNetworkStationState = 'machine:get-network-station-state',
    SetMachineNetworkConfiguration = 'machine:set-network-configuration',
}

export default ControllerEvent;
