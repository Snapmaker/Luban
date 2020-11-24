import isEmpty from 'lodash/isEmpty';
import {
    WORKFLOW_STATE_IDLE,
    CONNECTION_TYPE_SERIAL,
    PROTOCOL_SCREEN
} from '../../constants';
import { screenController } from '../../lib/controller';


const INITIAL_STATE = {
    // Serial port
    port: screenController.port || '',
    ports: [],
    dataSource: PROTOCOL_SCREEN,
    // from workflowState: idle, running, paused
    workflowState: WORKFLOW_STATE_IDLE,

    workPosition: { // work position
        x: '0.000',
        y: '0.000',
        z: '0.000',
        a: '0.000'
    },

    originOffset: {
        x: 0,
        y: 0,
        z: 0
    },

    isOpen: false,
    isConnected: false,
    connectionType: ''
};

const ACTION_UPDATE_STATE = 'machine/ACTION_UPDATE_STATE';

export const actions = {
    // Update state directly
    updateState: (state) => {
        return {
            type: ACTION_UPDATE_STATE,
            state
        };
    },

    // Initialize machine, get machine configurations via API
    init: () => (dispatch, getState) => {
        const controllerEvents = {
            'Marlin:state': (options) => {
                const { state } = options;
                const { pos } = state;

                const developToolsState = getState().developTools;

                if (developToolsState.workPosition.x !== pos.x
                    || developToolsState.workPosition.y !== pos.y
                    || developToolsState.workPosition.z !== pos.z) {
                    dispatch(actions.updateState({
                        workPosition: {
                            ...developToolsState.workPosition,
                            ...pos
                        }
                    }));
                }
            },
            'Marlin:settings': (options) => {
                const { settings } = options;
                const state = getState().machine;

                // enclosure is changed
                if (state.enclosure !== settings.enclosure) {
                    dispatch(actions.updateState({ enclosure: settings.enclosure }));
                }
            },
            'serialport:open': (options) => {
                const { port, dataSource, err } = options;
                if (err && err !== 'inuse') {
                    return;
                }
                const state = getState().machine;
                // For Warning Don't initialize
                const ports = [...state.ports];
                const dataSources = [...state.dataSources];
                if (ports.indexOf(port) === -1) {
                    ports.push(port);
                    dataSources.push(dataSource);
                }
                dispatch(actions.updateState({
                    port,
                    ports,
                    dataSource,
                    dataSources,
                    isOpen: true,
                    connectionType: CONNECTION_TYPE_SERIAL
                }));
            },
            'serialport:connected': (data) => {
                const { err } = data;
                if (err) {
                    return;
                }
                dispatch(actions.updateState({
                    isConnected: true
                }));
            },
            'serialport:close': (options) => {
                const { port } = options;
                const state = getState().machine;
                const ports = [...state.ports];
                const dataSources = [...state.dataSources];
                const portIndex = ports.indexOf(port);
                if (portIndex !== -1) {
                    ports.splice(portIndex, 1);
                    dataSources.splice(portIndex, 1);
                }
                if (!isEmpty(ports)) {
                    // this.port = ports[0];
                    dispatch(actions.updateState({
                        port: ports[0],
                        ports,
                        dataSource: dataSources[0],
                        dataSources,
                        isOpen: false,
                        isConnected: false,
                        connectionType: ''
                    }));
                } else {
                    // this.port = '';
                    dispatch(actions.updateState({
                        port: '',
                        ports,
                        dataSource: '',
                        dataSources,
                        isOpen: false,
                        isConnected: false,
                        connectionType: ''
                    }));
                }
            },
            // 'workflow:state': (workflowState, dataSource) => {
            'workflow:state': (options) => {
                const { workflowState, dataSource } = options;
                dispatch(actions.updateState({ workflowState, dataSource }));
            }
        };

        Object.keys(controllerEvents).forEach(event => {
            screenController.on(event, controllerEvents[event]);
        });
    },

    // executeGcode: (gcode, context) => (dispatch, getState) => {
    executeGcode: (gcode, context) => (dispatch, getState) => {
        const machine = getState().machine;

        const { port, server } = machine;
        // if (port && workflowState === WORKFLOW_STATE_IDLE) {
        if (port) {
            // controller.command('gcode', gcode, context);
            screenController.command('gcode', gcode, context);
            // } else if (server && workflowStatus === STATUS_IDLE) {
        } else if (server) {
            server.executeGcode(gcode);
        }
    },

    // takePhoto: (index, position) => (dispatch, getState) => {
    //     const machine = getState().machine;
    //
    //     const { server, workflowStatus } = machine;
    //
    //     if (server && workflowStatus === STATUS_IDLE) {
    //         server.takePhoto(index, position);
    //     } else {
    //         console.error('please connect through wifi');
    //     }
    // },
    //
    // getPhoto: (index, callback) => (dispatch, getState) => {
    //     const machine = getState().machine;
    //
    //     const { server, workflowStatus } = machine;
    //
    //     if (server && workflowStatus === STATUS_IDLE) {
    //         server.getPhoto(index, callback);
    //     } else {
    //         console.error('please connect through wifi');
    //     }
    // },

    // Enclosure
    getEnclosureState: () => () => {
        // controller.writeln('M1010', dataSource, { source: 'query' });
        screenController.writeln('M1010', { source: 'query' });
    },
    setEnclosureState: (doorDetection) => () => {
        // controller.writeln(`M1010 S${(doorDetection ? '1' : '0')}`, dataSource, { source: 'query' });
        screenController.writeln(`M1010 S${(doorDetection ? '1' : '0')}`, { source: 'query' });
    },
    // for z-axis extension module
    getZAxisModuleState: () => () => {
        screenController.writeln('M503', { source: 'query' });
    },
    setZAxisModuleState: (moduleId) => () => {
        screenController.writeln(`M1025 M${moduleId}`, { source: 'query' });
    }
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        case ACTION_UPDATE_STATE:
            return Object.assign({}, state, action.state);

        default:
            return state;
    }
}
