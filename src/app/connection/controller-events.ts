

enum ControllerEvent {
    // network
    ListWiFiNetworks = 'os:list-wifi-networks',

    // machine network
    GetMachineNetworkConfiguration = 'machine:get-network-configuration',
    GetMachineNetworkStationState = 'machine:get-network-station-state',
    SetMachineNetworkConfiguration = 'machine:set-network-configuration',
}

export default ControllerEvent;
