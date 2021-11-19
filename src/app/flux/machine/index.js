import isEmpty from 'lodash/isEmpty';
import _ from 'lodash';
import request from 'superagent';
import {
    ABSENT_OBJECT,
    CONNECTION_STATUS_CONNECTED,
    CONNECTION_STATUS_CONNECTING,
    CONNECTION_STATUS_IDLE,
    CONNECTION_TYPE_SERIAL, CONNECTION_TYPE_WIFI,
    DATA_PREFIX,
    LASER_MOCK_PLATE_HEIGHT,
    MACHINE_SERIES,
    HEAD_CNC,
    HEAD_LASER,
    WORKFLOW_STATE_IDLE,
    WORKFLOW_STATUS_IDLE,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATUS_UNKNOWN,
    MACHINE_TOOL_HEADS,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL,
    LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
    STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL
} from '../../constants';

import { valueOf } from '../../lib/contants-utils';
import { machineStore } from '../../store/local-storage';
import { actions as printingActions } from '../printing';
import { actions as editorActions } from '../editor';
import { actions as widgetActions } from '../widget';
import History from './History';
import FixedArray from './FixedArray';
import { controller } from '../../lib/controller';
import { actions as workspaceActions } from '../workspace';
import MachineSelectModal from '../../ui/modals/modal-machine-select';
import setting from '../../config/settings';


import baseActions, { ACTION_UPDATE_STATE } from './action-base';
import discoverActions from './action-discover';
import connectActions from './action-connect';

const INITIAL_STATE = {
    // region server discover
    // HTTP connection
    //  - servers: HTTP servers on Snapmaker 2.0
    //  - serverDiscovering: discover state
    servers: [],
    serverDiscovering: false,
    // endregion

    // region Connection
    // connection state
    //  - type: serial port or Wi-Fi
    //  - status: Idle / Connecting / Connected
    //  - timeout: connect timeout (for Wi-Fi connection)
    connectionType: CONNECTION_TYPE_WIFI,
    connectionStatus: CONNECTION_STATUS_IDLE,
    connectionTimeout: 3000,

    server: ABSENT_OBJECT,
    savedServerAddress: '',
    savedServerToken: '',
    manualIp: '',
    isOpen: false,
    isConnected: false,
    isSendedOnWifi: true,
    // for wifi connection ?
    workflowStatus: WORKFLOW_STATUS_UNKNOWN,

    // serial port related
    //  - ports: all serial ports available
    //  - port: serial port selected
    port: controller.port || '',
    ports: [],
    // endregion

    // region Machine Status

    // Machine Info
    series: MACHINE_SERIES.ORIGINAL.value,
    toolHead: {
        printingToolhead: MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].value,
        laserToolhead: MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].value,
        cncToolhead: MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].value
    },
    canReselectMachine: false,
    // currentMachine: INITIAL_MACHINE_SERIES_WITH_HEADTOOL,
    size: MACHINE_SERIES.ORIGINAL.setting.size,
    laserSize: MACHINE_SERIES.ORIGINAL.setting.laserSize,
    // endregion

    // Console
    terminalHistory: new FixedArray(1000),
    consoleHistory: new History(1000),
    consoleLogs: [],
    // Serial port

    // from workflowState: idle, running, paused/ for serial connection?
    workflowState: WORKFLOW_STATE_IDLE,
    isHomed: null,

    enclosureDoorDetection: false,
    enclosureLight: 0,
    enclosureFan: 0,
    enclosureOnline: false,

    airPurifier: false,
    airPurifierSwitch: false,
    airPurifierFanSpeed: 3,
    airPurifierFilterHealth: 2,
    airPurifierHasPower: false,
    emergencyStopOnline: false,

    zAxisModule: null,

    isEnclosureDoorOpen: false,
    doorSwitchCount: 0,

    // region Machine Status 2 TODO
    laserFocalLength: null,
    laserPower: null,
    headStatus: null,
    nozzleTemperature: 0,
    nozzleTargetTemperature: 0,
    heatedBedTemperature: 0,
    heatedBedTargetTemperature: 0,
    laserCamera: false,
    isFilamentOut: false,

    // 0 byte: state
    // 1 byte: temperature error
    // 2 byte: angel error
    laser10WErrorState: 0,

    workPosition: { // work position
        x: '0.000',
        y: '0.000',
        z: '0.000',
        b: '0.000',
        isFourAxis: false,
        a: '0.000'
    },

    originOffset: {
        x: 0,
        y: 0,
        z: 0
    },
    // endregion

    // laser print mode
    isLaserPrintAutoMode: true,
    materialThickness: 1.5,

    gcodePrintingInfo: {
        sent: 0,
        received: 0,
        total: 0,
        startTime: 0,
        finishTime: 0,
        elapsedTime: 0,
        remainingTime: 0
    },
    printingCustomConfigs: [
        'layer_height',
        'infill_sparse_density',
        'wall_thickness',
        'adhesion_type',
        'support_enable'
    ],

    // security warning
    shouldShowCncWarning: true,

    // region Auto Update
    autoupdateMessage: '',
    // Whether to check for available updates when the software is opened
    shouldCheckForUpdate: true,
    // Whether an update is being downloaded
    isDownloading: false,
    // endregion
    use4Axis: true,
    // use multiple engine
    multipleEngine: false,

    // connect info
    moduleStatusList: {}
};


export const actions = {
    // Initialize machine, get machine configurations via API
    init: () => (dispatch, getState) => {
        // Discover actions init
        dispatch(discoverActions.init());

        actions.__initConnection(dispatch);
        dispatch(connectActions.init());

        actions.__initMachineStatus(dispatch);
        actions.__initControllerEvents(dispatch, getState);

        actions.__initCNCSecurityWarning(dispatch);

        // actions.__init4Axis(dispatch);

        if (machineStore.get('shouldCheckForUpdate') === false) {
            const shouldCheckForUpdate = false;
            dispatch(baseActions.updateState({
                shouldCheckForUpdate: shouldCheckForUpdate
            }));
        }
        const printingCustomConfigs = machineStore.get('printingCustomConfigs');
        if (printingCustomConfigs && Object.prototype.toString.call(printingCustomConfigs) === '[object String]') {
            const customConfigsArray = printingCustomConfigs.split('-');
            dispatch(baseActions.updateState({
                printingCustomConfigs: customConfigsArray
            }));
        }
    },

    /**
     * Initialize connection related state.
     */
    __initConnection: (dispatch) => {
        // Wi-Fi server
        const serverAddress = machineStore.get('server.address') || '';
        const serverToken = machineStore.get('server.token') || '';
        const manualIp = machineStore.get('manualIp') || '';

        // serial port
        const machinePort = machineStore.get('port') || '';

        dispatch(baseActions.updateState({
            savedServerAddress: serverAddress,
            savedServerToken: serverToken,
            port: machinePort,
            manualIp: manualIp
        }));
    },

    /**
     * Initialize machine related attributes, series, machine size, etc.
     */
    __initMachineStatus: (dispatch) => {
        // Machine
        const { series = INITIAL_STATE.series, size = INITIAL_STATE.size, laserSize = INITIAL_STATE.laserSize, toolHead = INITIAL_STATE.toolHead } = machineStore.get('machine') || {};

        const seriesInfo = valueOf(MACHINE_SERIES, 'value', series);
        // const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
        if (seriesInfo === MACHINE_SERIES.CUSTOM) {
            seriesInfo.setting.size = size;
            seriesInfo.setting.laserSize = seriesInfo.setting.size;
        }

        dispatch(baseActions.updateState({
            series: series,
            size: seriesInfo ? seriesInfo.setting.size : size,
            laserSize: seriesInfo ? seriesInfo.setting.laserSize : laserSize,
            toolHead: toolHead
            // currentMachine
        }));

        dispatch(editorActions.onSizeUpdated('laser', seriesInfo ? seriesInfo.setting.size : size));
        dispatch(editorActions.onSizeUpdated('cnc', seriesInfo ? seriesInfo.setting.size : size));
    },

    __initControllerEvents: (dispatch, getState) => {
        // Register event listeners
        const controllerEvents = {
            // 'Marlin:state': (state) => {
            'Marlin:state': (options) => {
                // TODO: serialPort
                const { state } = options;
                const { headType, pos, originOffset, headStatus, headPower, temperature, zFocus, isHomed, zAxisModule, laser10WErrorState } = state;
                const machineState = getState().machine;

                if (pos.isFourAxis) {
                    if (machineState.workPosition.x !== pos.x
                        || machineState.workPosition.y !== pos.y
                        || machineState.workPosition.z !== pos.z
                        || machineState.workPosition.b !== pos.b) {
                        // TODO: Set `isRotate` only once.
                        if (headType === HEAD_LASER || headType === HEAD_CNC) {
                            dispatch(workspaceActions.updateMachineState({
                                isRotate: pos.isFourAxis
                            }));
                        }
                        dispatch(baseActions.updateState({
                            workPosition: {
                                ...machineState.workPosition,
                                ...pos
                            }
                        }));
                    }
                } else {
                    if (machineState.workPosition.x !== pos.x
                        || machineState.workPosition.y !== pos.y
                        || machineState.workPosition.z !== pos.z) {
                        // TODO: Set `isRotate` only once.
                        if (headType === HEAD_LASER || headType === HEAD_CNC) {
                            dispatch(workspaceActions.updateMachineState({
                                isRotate: pos.isFourAxis
                            }));
                        }
                        dispatch(baseActions.updateState({
                            workPosition: {
                                ...machineState.workPosition,
                                ...pos
                            }
                        }));
                    }
                }
                if (machineState.originOffset.x !== originOffset.x
                    || machineState.originOffset.y !== originOffset.y
                    || machineState.originOffset.z !== originOffset.z) {
                    dispatch(baseActions.updateState({
                        originOffset: {
                            ...machineState.originOffset,
                            ...originOffset
                        }
                    }));
                }
                dispatch(baseActions.updateState({
                    laser10WErrorState,
                    headStatus: headStatus,
                    laserPower: headPower,
                    laserFocalLength: zFocus + LASER_MOCK_PLATE_HEIGHT,
                    nozzleTemperature: parseFloat(temperature.t),
                    nozzleTargetTemperature: parseFloat(temperature.tTarget),
                    heatedBedTemperature: parseFloat(temperature.b),
                    heatedBedTargetTemperature: parseFloat(temperature.bTarget),
                    isHomed: isHomed,
                    zAxisModule: zAxisModule
                }));
            },
            'Marlin:settings': (options) => {
                const { enclosureDoorDetection, enclosureOnline, enclosureFan = 0, enclosureLight = 0,
                    airPurifierHasPower, airPurifier, airPurifierSwitch, airPurifierFanSpeed, airPurifierFilterHealth, emergencyStopOnline } = options.settings;
                dispatch(baseActions.updateState({
                    enclosureDoorDetection,
                    enclosureOnline,
                    enclosureFan,
                    enclosureLight,
                    airPurifier,
                    airPurifierSwitch,
                    airPurifierFanSpeed,
                    airPurifierFilterHealth,
                    airPurifierHasPower,
                    emergencyStopOnline
                }));
            },
            'serialport:open': (options) => {
                const { port, err } = options;
                if (err && err !== 'inuse') {
                    return;
                }
                const state = getState().machine;
                // For Warning Don't initialize
                const ports = [...state.ports];
                if (ports.indexOf(port) === -1) {
                    ports.push(port);
                }
                dispatch(baseActions.updateState({
                    port,
                    ports,
                    isOpen: true,
                    connectionStatus: CONNECTION_STATUS_CONNECTING,
                    connectionType: CONNECTION_TYPE_SERIAL,
                    isEmergencyStopped: false
                }));
                machineStore.set('port', port);
            },
            'serialport:connected': (data) => {
                const { err } = data;
                if (err) {
                    return;
                }
                dispatch(baseActions.updateState({
                    isConnected: true,
                    connectionStatus: CONNECTION_STATUS_CONNECTED
                }));
                dispatch(workspaceActions.loadGcode());
            },
            'serialport:close': (options) => {
                dispatch(actions.close(options));
            },
            'serialport:emergencyStop': (options) => {
                dispatch(actions.close(options, true));
            },
            'workflow:state': (options) => {
                const { workflowState } = options;
                dispatch(baseActions.updateState({
                    workflowState
                }));
            },
            'sender:status': (options) => {
                const { data } = options;
                const { total, sent, received, startTime, finishTime, elapsedTime, remainingTime } = data;
                dispatch(baseActions.updateState({
                    gcodePrintingInfo: {
                        total,
                        sent,
                        received,
                        startTime,
                        finishTime,
                        elapsedTime,
                        remainingTime
                    }
                }));
            }
        };

        Object.keys(controllerEvents).forEach(event => {
            controller.on(event, controllerEvents[event]);
        });
    },

    __initCNCSecurityWarning: (dispatch) => {
        // Load CNC security warning
        const savedData = machineStore.get('settings.shouldShowCncWarning');
        let shouldShowCncWarning = INITIAL_STATE.shouldShowCncWarning;
        if (savedData && typeof savedData === 'string') {
            const currentVersion = setting.version;

            // shouldShowCncWarning: '3.10.0|false'
            const [version, value] = savedData.split('|');
            if (version === currentVersion && value === 'false') {
                shouldShowCncWarning = false;
            }
        }

        dispatch(baseActions.updateState({
            shouldShowCncWarning
        }));
    },

    __init4Axis: (dispatch) => {
        const use4Axis = machineStore.get('settings.use4Axis');

        dispatch(baseActions.updateState({
            use4Axis: use4Axis === 'true' || use4Axis === true
        }));
    },

    // discover actions
    discover: discoverActions,

    // connect actions
    connect: connectActions,

    updateMachineState: (state) => (dispatch) => {
        const { series, headType, canReselectMachine } = state;
        headType && dispatch(baseActions.updateState({
            headType: headType
        }));
        if (canReselectMachine !== undefined && canReselectMachine !== null) {
            dispatch(baseActions.updateState({
                canReselectMachine
            }));
        }
        series && dispatch(actions.updateMachineSeries(series));
    },

    updateMachineSeries: (series) => async (dispatch, getState) => {
        machineStore.set('machine.series', series);

        const oldSeries = getState().machine.series;
        if (oldSeries !== series) {
            dispatch(workspaceActions.updateMachineState({ series }));
            // dispatch(baseActions.updateState({ series }));
            const seriesInfo = valueOf(MACHINE_SERIES, 'value', series);
            if (seriesInfo === MACHINE_SERIES.CUSTOM) {
                seriesInfo.setting.size = machineStore.get('machine.size') || seriesInfo.setting.size;
                seriesInfo.setting.laserSize = seriesInfo.setting.size;
            }
            //  Do not need to 'initSize' just use 'switchSize' function
            await dispatch(printingActions.switchSize());
            seriesInfo && dispatch(actions.updateMachineSize(seriesInfo.setting.size));
            seriesInfo && dispatch(actions.updateLaserSize(seriesInfo.setting.laserSize));
            dispatch(widgetActions.updateMachineSeries(series));
        }
    },

    updateMachineToolHead: (toolHead, series, headType = null) => (dispatch, getState) => {
        machineStore.set('machine.toolHead', toolHead);
        const oldToolHead = getState().machine.toolHead;
        const oldSeries = getState().machine.series;
        if (!_.isEqual(oldToolHead, toolHead) || oldSeries !== series || headType) {
            // const currentMachine = getMachineSeriesWithToolhead(series, toolHead, headType);
            // dispatch(baseActions.updateState({ currentMachine }));
            if (!_.isEqual(oldToolHead, toolHead)) {
                dispatch(baseActions.updateState({ toolHead }));
            }
        }
    },

    updateMachineSize: (size) => (dispatch, getState) => {
        const { series } = getState().machine;

        size.x = Math.min(size.x, 1000);
        size.y = Math.min(size.y, 1000);
        size.z = Math.min(size.z, 1000);

        if (series === MACHINE_SERIES.CUSTOM.value) {
            machineStore.set('machine.size', size);
        }

        dispatch(baseActions.updateState({ size: { ...size } }));

        dispatch(printingActions.updateActiveDefinitionMachineSize(size));

        dispatch(editorActions.onSizeUpdated('laser', size));
        dispatch(editorActions.onSizeUpdated('cnc', size));
    },

    updateLaserSize: (laserSize) => (dispatch) => {
        if (!laserSize) {
            return;
        }
        laserSize.x = Math.min(laserSize.x, 1000);
        laserSize.y = Math.min(laserSize.y, 1000);
        laserSize.z = Math.min(laserSize.z, 1000);

        machineStore.set('machine.laserSize', laserSize);

        dispatch(baseActions.updateState({ laserSize }));
    },

    updateIsLaserPrintAutoMode: (isLaserPrintAutoMode) => (dispatch) => {
        dispatch(baseActions.updateState({ isLaserPrintAutoMode }));
    },

    updateMaterialThickness: (materialThickness) => (dispatch) => {
        dispatch(baseActions.updateState({ materialThickness }));
    },

    /**
     * Open HTTP server.
     */
    openServer: (callback) => (dispatch, getState) => {
        const { server, isOpen, savedServerAddress, savedServerToken } = getState().machine;
        if (isOpen) {
            return;
        }

        dispatch(baseActions.updateState({
            isEmergencyStopped: false
        }));

        // Use saved token when connecting
        if (server.address === savedServerAddress) {
            server.setToken(savedServerToken);
        }

        server.open((err, data, text) => {
            if (err) {
                callback && callback(err, data, text);
                return;
            }

            dispatch(connectActions.setServerAddress(server.address));
            dispatch(connectActions.setServerToken(server.token));

            dispatch(baseActions.updateState({
                isOpen: true,
                connectionStatus: CONNECTION_STATUS_CONNECTING
            }));

            server.removeAllListeners('http:confirm');
            server.removeAllListeners('http:status');
            server.removeAllListeners('http:close');

            server.once('http:confirm', (result) => {
                const { toolHead, series, headType, status, isHomed, isEmergencyStopped, moduleStatusList } = result.data;
                // TODO: update orther data
                const _isRotate = moduleStatusList?.rotaryModule;

                // emergency stop event
                if (isEmergencyStopped) {
                    dispatch(baseActions.updateState({
                        isEmergencyStopped
                    }));
                    return;
                }

                // confirm connected
                dispatch(baseActions.updateState({
                    workflowStatus: status,
                    isConnected: true,
                    connectionStatus: CONNECTION_STATUS_CONNECTED,
                    isHomed: isHomed
                }));

                // get series & headType
                dispatch(workspaceActions.updateMachineState({
                    isRotate: _isRotate
                }));
                if (series && headType) {
                    // TODO: set isRotate here
                    dispatch(workspaceActions.updateMachineState({
                        series,
                        headType,
                        toolHead
                    }));
                    dispatch(actions.executeGcodeG54(series, headType));
                    if (_.includes([WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING], status)) {
                        server.getGcodeFile((msg, gcode) => {
                            if (msg) {
                                return;
                            }
                            dispatch(workspaceActions.clearGcode());
                            let suffix = 'gcode';
                            if (headType === HEAD_LASER) {
                                suffix = 'nc';
                            } else if (headType === HEAD_CNC) {
                                suffix = 'cnc';
                            }
                            dispatch(workspaceActions.clearGcode());
                            dispatch(workspaceActions.renderGcode(`print.${suffix}`, gcode, true, true));
                        });
                    }
                } else {
                    // TODO: Why is modal code here???
                    MachineSelectModal({
                        series: series,
                        headType: headType,

                        onConfirm: (seriesT, headTypeT, toolHeadT) => {
                            dispatch(workspaceActions.updateMachineState({
                                series: seriesT,
                                headType: headTypeT,
                                toolHead: toolHeadT,
                                canReselectMachine: true
                            }));
                            dispatch(actions.executeGcodeG54(seriesT, headTypeT));
                        }
                    });
                }
            });

            server.on('http:status', (result) => {
                const { workPosition, originOffset, gcodePrintingInfo } = getState().machine;
                const {
                    status, isHomed, x, y, z, b, offsetX, offsetY, offsetZ,
                    laserFocalLength,
                    laserPower,
                    nozzleTemperature,
                    nozzleTargetTemperature,
                    heatedBedTemperature,
                    doorSwitchCount,
                    isEnclosureDoorOpen,
                    headType,
                    heatedBedTargetTemperature,
                    airPurifier,
                    airPurifierSwitch,
                    airPurifierFanSpeed,
                    airPurifierFilterHealth,
                    isEmergencyStopped,
                    laser10WErrorState,
                    moduleStatusList,
                    laserCamera
                } = result.data;
                if (isEmergencyStopped) {
                    dispatch(baseActions.updateState({
                        isEmergencyStopped
                    }));
                    server.close(() => {
                        dispatch(actions.resetMachineState());
                    });
                    return;
                }
                dispatch(baseActions.updateState({
                    workflowStatus: status,
                    laserFocalLength: laserFocalLength,
                    laserPower: laserPower,
                    isHomed: isHomed,
                    nozzleTemperature: nozzleTemperature,
                    nozzleTargetTemperature: nozzleTargetTemperature,
                    heatedBedTemperature: heatedBedTemperature,
                    isEnclosureDoorOpen: isEnclosureDoorOpen,
                    doorSwitchCount: doorSwitchCount,
                    heatedBedTargetTemperature: heatedBedTargetTemperature,
                    isEmergencyStopped: isEmergencyStopped,
                    laser10WErrorState: laser10WErrorState,
                    airPurifier: airPurifier,
                    airPurifierSwitch: airPurifierSwitch,
                    airPurifierFanSpeed: airPurifierFanSpeed,
                    airPurifierFilterHealth: airPurifierFilterHealth,
                    moduleStatusList,
                    laserCamera
                }));
                // make 'workPosition' value as Number
                if (!(_.isUndefined(b))) {
                    if (Number(workPosition.x) !== x
                        || Number(workPosition.y) !== y
                        || Number(workPosition.z) !== z
                        || Number(workPosition.b) !== b) {
                        // TODO: Set `isRotate` only once.
                        if (headType === HEAD_LASER || headType === HEAD_CNC) {
                            dispatch(workspaceActions.updateMachineState({
                                isRotate: true
                            }));
                        }
                        dispatch(baseActions.updateState({
                            workPosition: {
                                x: `${x.toFixed(3)}`,
                                y: `${y.toFixed(3)}`,
                                z: `${z.toFixed(3)}`,
                                b: `${b.toFixed(3)}`,
                                isFourAxis: true,
                                a: '0.000'
                            }
                        }));
                    }
                } else {
                    if (Number(workPosition.x) !== x
                        || Number(workPosition.y) !== y
                        || Number(workPosition.z) !== z) {
                        // TODO: Set `isRotate` only once.
                        if (headType === HEAD_LASER || headType === HEAD_CNC) {
                            dispatch(workspaceActions.updateMachineState({
                                isRotate: false
                            }));
                        }
                        dispatch(baseActions.updateState({
                            workPosition: {
                                x: `${x.toFixed(3)}`,
                                y: `${y.toFixed(3)}`,
                                z: `${z.toFixed(3)}`,
                                isFourAxis: false,
                                a: '0.000'
                            }
                        }));
                    }
                }

                if (Number(originOffset.x) !== offsetX
                    || Number(originOffset.y) !== offsetY
                    || Number(originOffset.z) !== offsetZ) {
                    dispatch(baseActions.updateState({
                        originOffset: {
                            x: `${offsetX.toFixed(3)}`,
                            y: `${offsetY.toFixed(3)}`,
                            z: `${offsetZ.toFixed(3)}`,
                            a: '0.000'
                        }
                    }));
                }

                dispatch(baseActions.updateState({
                    gcodePrintingInfo: {
                        ...gcodePrintingInfo,
                        ...result.data.gcodePrintingInfo
                    }
                }));
            });
            server.once('http:close', () => {
                dispatch(actions.resetMachineState());
            });
            callback && callback(null, data);
        });
    },

    closeServer: () => (dispatch, getState) => {
        const { server } = getState().machine;
        server.close(() => {
            dispatch(actions.resetMachineState());
        });
    },

    close: (options, isEmergencyStopped) => (dispatch, getState) => {
        const state = getState().machine;
        const ports = [...state.ports];
        if (!isEmpty(ports)) {
            const { port } = options;
            const portIndex = ports.indexOf(port);
            if (portIndex !== -1) {
                ports.splice(portIndex, 1);
            }
            // this.port = ports[0];
            dispatch(baseActions.updateState({
                port: ports[0],
                ports,
                isOpen: false,
                isConnected: false,
                isEmergencyStopped: isEmergencyStopped ?? false,
                connectionStatus: CONNECTION_STATUS_IDLE
            }));
        } else {
            // this.port = '';
            dispatch(baseActions.updateState({
                port: '',
                ports,
                isOpen: false,
                isConnected: false,
                isEmergencyStopped: isEmergencyStopped ?? false,
                connectionStatus: CONNECTION_STATUS_IDLE
            }));
        }
        dispatch(workspaceActions.updateMachineState({
            headType: '',
            toolHead: ''
        }));
        dispatch(baseActions.updateState({
            workPosition: {
                x: '0.000',
                y: '0.000',
                z: '0.000',
                a: '0.000'
            },

            originOffset: {
                x: 0,
                y: 0,
                z: 0
            }
        }));
        dispatch(workspaceActions.unloadGcode());
    },

    resetMachineState: () => (dispatch) => {
        dispatch(baseActions.updateState({
            isOpen: false,
            isConnected: false,
            connectionStatus: CONNECTION_STATUS_IDLE,
            isHomed: null,
            workflowStatus: WORKFLOW_STATUS_UNKNOWN,
            laserFocalLength: null,
            workPosition: { // work position
                x: '0.000',
                y: '0.000',
                z: '0.000',
                b: '0.000',
                isFourAxis: false,
                a: '0.000'
            },

            originOffset: {
                x: 0,
                y: 0,
                z: 0
            }
        }));
    },

    // Execute G54 based on series and headType
    executeGcodeG54: (series, headType) => (dispatch) => {
        if (series !== MACHINE_SERIES.ORIGINAL.value
            && series !== MACHINE_SERIES.CUSTOM.value
            && (headType === HEAD_LASER
                || headType === HEAD_CNC)) {
            dispatch(actions.executeGcode('G54'));
        }
    },

    executeGcode: (gcode, context) => (dispatch, getState) => {
        const machine = getState().machine;

        const { isConnected, connectionType, server } = machine;
        if (!isConnected) {
            return;
        }
        // if (port && workflowState === WORKFLOW_STATE_IDLE) {
        if (connectionType === CONNECTION_TYPE_SERIAL) {
            // controller.command('gcode', gcode, context);
            controller.command('gcode', gcode, context);
            // } else if (server && workflowStatus === STATUS_IDLE) {
        } else {
            server.executeGcode(gcode, (result) => {
                if (result) {
                    dispatch(actions.addConsoleLogs(result));
                }
            });
        }
    },

    executeGcodeAutoHome: () => (dispatch, getState) => {
        const { series, headType } = getState().workspace;
        dispatch(actions.executeGcode('G53'));
        dispatch(actions.executeGcode('G28'));
        dispatch(actions.executeGcodeG54(series, headType));
    },

    startServerGcode: (callback) => (dispatch, getState) => {
        const { server, size, workflowStatus, isLaserPrintAutoMode, laserFocalLength, materialThickness } = getState().machine;
        const { gcodeFile, headType, series } = getState().workspace;
        const { background } = getState().laser;
        if (workflowStatus !== WORKFLOW_STATUS_IDLE || gcodeFile === null) {
            return;
        }
        dispatch(baseActions.updateState({
            isSendedOnWifi: false
        }));

        const gcodeFilePath = `${DATA_PREFIX}/${gcodeFile.uploadName}`;

        request.get(gcodeFilePath)
            .end((err, res) => {
                if (err) {
                    return;
                }
                const gcode = res.text;

                const blob = new Blob([gcode], { type: 'text/plain' });
                const file = new File([blob], gcodeFile.name);
                const promises = [];
                if (series !== MACHINE_SERIES.ORIGINAL.value && series !== MACHINE_SERIES.CUSTOM.value && headType === HEAD_LASER) {
                    if (laserFocalLength) {
                        const promise = new Promise((resolve) => {
                            server.executeGcode(`G53;\nG0 Z${laserFocalLength + (isLaserPrintAutoMode ? materialThickness : 0)} F1500;\nG54;`, () => {
                                resolve();
                            });
                        });
                        promises.push(promise);
                    }

                    // Camera Aid Background mode, force machine to work on machine coordinates (Origin = 0,0)
                    if (background.enabled) {
                        const { workPosition, originOffset } = getState().machine;
                        let x = parseFloat(workPosition.x) - parseFloat(originOffset.x);
                        let y = parseFloat(workPosition.y) - parseFloat(originOffset.y);

                        // Fix bug for x or y out of range
                        x = Math.max(0, Math.min(x, size.x - 20));
                        y = Math.max(0, Math.min(y, size.y - 20));

                        const promise = new Promise((resolve) => {
                            server.executeGcode(`G53;\nG0 X${x} Y${y};\nG54;\nG92 X${x} Y${y};`, () => {
                                resolve();
                            });
                        });
                        promises.push(promise);
                    }
                }
                Promise.all(promises)
                    .then(() => {
                        server.uploadGcodeFile(gcodeFile.name, file, headType, (msg) => {
                            if (msg) {
                                return;
                            }
                            server.startGcode((err2) => {
                                dispatch(baseActions.updateState({
                                    isSendedOnWifi: true
                                }));
                                if (err2) {
                                    callback && callback(err2);
                                    return;
                                }
                                dispatch(baseActions.updateState({
                                    workflowStatus: WORKFLOW_STATUS_RUNNING
                                }));
                            });
                        });
                    });
            });
    },

    resumeServerGcode: (callback) => (dispatch, getState) => {
        const { server } = getState().machine;
        server.resumeGcode((err) => {
            if (err) {
                callback && callback(err);
                return;
            }
            dispatch(baseActions.updateState({
                workflowStatus: WORKFLOW_STATUS_RUNNING
            }));
        });
    },

    pauseServerGcode: () => (dispatch, getState) => {
        const { server, workflowStatus } = getState().machine;
        if (workflowStatus !== WORKFLOW_STATUS_RUNNING) {
            return;
        }
        server.pauseGcode((msg) => {
            if (msg) {
                return;
            }
            dispatch(baseActions.updateState({
                workflowStatus: WORKFLOW_STATUS_PAUSED
            }));
        });
    },

    stopServerGcode: () => (dispatch, getState) => {
        const { server, workflowStatus } = getState().machine;
        if (workflowStatus === WORKFLOW_STATUS_IDLE || workflowStatus === WORKFLOW_STATUS_UNKNOWN) {
            return;
        }
        server.stopGcode((msg) => {
            if (msg) {
                return;
            }
            dispatch(baseActions.updateState({
                workflowStatus: WORKFLOW_STATUS_IDLE
            }));
        });
    },

    // region Enclosure
    getEnclosureState: () => () => {
        controller.writeln('M1010', { source: 'query' });
    },
    setEnclosureState: (doorDetection) => () => {
        controller.writeln(`M1010 S${(doorDetection ? '1' : '0')}`, { source: 'query' });
    },
    // endregion

    // region Z axis
    // for z-axis extension module
    getZAxisModuleState: () => () => {
        // TODO: waiting for query interface
        // controller.writeln('M503', { source: 'query' });
    },
    setZAxisModuleState: (moduleId) => () => {
        controller.writeln(`M1025 M${moduleId}`, { source: 'query' });
    },
    // endregion

    addConsoleLogs: (consoleLogs) => (dispatch) => {
        dispatch(baseActions.updateState({
            consoleLogs: consoleLogs
        }));
    },

    setShouldShowCncWarning: (value) => (dispatch) => {
        const version = setting.version;
        machineStore.set('settings.shouldShowCncWarning', `${version}|${value}`);
        dispatch(baseActions.updateState({
            shouldShowCncWarning: value
        }));
    },

    // region Auto Update (need refactor)
    // TODO: Move Auto-Update code somewhere else.
    updateAutoupdateMessage: (autoupdateMessage) => (dispatch) => {
        dispatch(baseActions.updateState({ autoupdateMessage: autoupdateMessage }));
    },
    updateIsDownloading: (isDownloading) => (dispatch) => {
        dispatch(baseActions.updateState({ isDownloading: isDownloading }));
    },
    updateShouldCheckForUpdate: (shouldCheckForUpdate) => (dispatch) => {
        dispatch(baseActions.updateState({ shouldCheckForUpdate: shouldCheckForUpdate }));
        machineStore.set('shouldCheckForUpdate', shouldCheckForUpdate);
    },
    updatePrintingCustomConfigs: (printingCustomConfigs) => (dispatch) => {
        dispatch(baseActions.updateState({ printingCustomConfigs }));
        const newConfig = printingCustomConfigs.join('-');
        machineStore.set('printingCustomConfigs', newConfig);
    },
    updateMultipleEngine: () => (dispatch, getState) => {
        const { multipleEngine } = getState().machine;
        dispatch(baseActions.updateState({ multipleEngine: !multipleEngine }));
    }
    // endregion
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        // action from action-base
        case ACTION_UPDATE_STATE:
            return Object.assign({}, state, action.state);
        default:
            return state;
    }
}
