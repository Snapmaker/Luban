import { isEqualWith } from 'lodash';

import { LaserMachineMetadata, Machine, MachineType } from '@snapmaker/luban-platform';
import { CUSTOM_SERVER_NAME } from '../../constants';
import { DEFAULT_BAUDRATE } from '../../constants/machines';
import { controller } from '../../communication/socket-communication';
import { MachineAgent } from './MachineAgent';
import { NetworkedMachineInfo } from './NetworkedMachine';
import baseActions from './actions-base';
import { ConnectionType } from './state';
// import { CUSTOM_SERVER_NAME } from '../../constants/index';


const checkIfEqual = (objArray, othArray) => {
    if (objArray.length !== othArray.length) {
        return false;
    }
    return objArray.every((server) => {
        const l = othArray.find(v => {
            return v.address === server.address && v.name === server.name;
        });
        return !!l;
    });
};

const init = () => (dispatch, getState) => {
    const controllerEvents = {
        // Receive when new machines discovered
        'machine:discover': (data: { machines: NetworkedMachineInfo[] }) => {
            // Skip
            const connectionType = getState().workspace.connectionType;
            if (connectionType !== ConnectionType.WiFi) {
                return;
            }

            const machineInfoList = data.machines as NetworkedMachineInfo[];

            // Note that we may receive this event many times.
            const machineAgents = getState().workspace.machineAgents as MachineAgent[];

            const newAgents = [];
            for (const machineInfo of machineInfoList) {
                const find = machineAgents.find(agent => {
                    return agent.address === machineInfo.address && agent.name === machineInfo.name;
                });

                if (find) {
                    newAgents.push(find);
                } else {
                    const agent = MachineAgent.createAgent({
                        name: machineInfo.name,
                        address: machineInfo.address,
                        protocol: machineInfo.protocol,
                    });
                    newAgents.push(agent);
                }
            }

            // keep manual added machine agents
            for (const agent of machineAgents) {
                if (agent.name === CUSTOM_SERVER_NAME) {
                    newAgents.push(agent);
                }
            }

            const same = isEqualWith(newAgents, machineAgents, checkIfEqual);
            if (!same) {
                dispatch(baseActions.updateState({ machineAgents: newAgents }));
            }
        },
        'machine:serial-discover': ({ machines }) => {
            // Note that we may receive this event many times.
            const activeMachine: Machine = getState().machine.activeMachine;

            let baudRate = DEFAULT_BAUDRATE;
            if (activeMachine?.machineType === MachineType.Laser) {
                baudRate = (activeMachine?.metadata as LaserMachineMetadata).serialPortBaudRate || DEFAULT_BAUDRATE;
            }

            const { connectionType } = getState().workspace;

            const machineAgents = getState().workspace.machineAgents as MachineAgent[];

            // Update serial ports only when connenctionType is active
            if (connectionType === ConnectionType.Serial) {
                const resultServers = [];
                for (const object of machines) {
                    const find = resultServers.find(v => {
                        return v.port === object.port;
                    });
                    if (!find) {
                        const agent = MachineAgent.createAgent({
                            name: object.port,
                            address: '',
                            port: object.port,
                            baudRate,
                            protocol: object.protocol,
                        });
                        resultServers.unshift(agent);
                    }
                }
                if (!isEqualWith(resultServers, machineAgents)) {
                    dispatch(baseActions.updateState({ machineAgents: resultServers }));
                }
            }
        }
    };

    Object.keys(controllerEvents).forEach(event => {
        controller.on(event, controllerEvents[event]);
    });
};

/**
 * Discover networked machines.
 */
const discoverNetworkedMachines = () => {
    return (dispatch, getState) => {
        dispatch(baseActions.updateState({ machineDiscovering: true }));

        // reset discover state whatever search is done or not
        setTimeout(() => {
            const machineDiscovering = getState().workspace.machineDiscovering;
            if (machineDiscovering) {
                dispatch(baseActions.updateState({ machineDiscovering: false }));
            }
        }, 3000);

        controller.discoverNetworkedMachines();
    };
};

/**
 * Add a new machine agent manually.
 */
const addAgent = (agent: MachineAgent) => {
    return (dispatch, getState): MachineAgent => {
        const machineAgents = getState().workspace.machineAgents as MachineAgent[];

        const find = machineAgents.find(s => s.address === agent.address);

        // Check if agent with the same address already exists
        if (find) {
            return find;
        }

        // Update agent list
        const newAgents = machineAgents.slice(0);
        newAgents.push(agent);

        dispatch(baseActions.updateState({
            machineAgents: newAgents,
        }));

        return agent;
    };
};

const addAgentByAddress = (address: string) => {
    return (dispatch): MachineAgent => {
        const agent = MachineAgent.createManualAgent({
            name: CUSTOM_SERVER_NAME,
            address,
        });

        return dispatch(addAgent(agent));
    };
};

export default {
    init,

    // discover
    discoverNetworkedMachines,

    // add manually
    addAgent,
    addAgentByAddress,
};
