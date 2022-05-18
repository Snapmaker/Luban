/* eslint-disable import/no-cycle */
import _, { isEmpty, isNil } from 'lodash';
import {
    ABSENT_OBJECT,
    CONNECTION_STATUS_CONNECTED,
    CONNECTION_STATUS_IDLE,
    CONNECTION_TYPE_WIFI,
    LASER_MOCK_PLATE_HEIGHT,
    MACHINE_SERIES,
    HEAD_CNC,
    HEAD_LASER,
    WORKFLOW_STATE_IDLE,
    // WORKFLOW_STATUS_IDLE,
    WORKFLOW_STATUS_PAUSED,
    WORKFLOW_STATUS_RUNNING,
    WORKFLOW_STATUS_UNKNOWN,
    MACHINE_TOOL_HEADS,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL,
    LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
    STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL,
    CONNECTION_EXECUTE_GCODE,
    CONNECTION_GET_GCODEFILE,
    CONNECTION_COORDINATE_MOVE,
    CONNECTION_SET_WORK_ORIGIN,
    LEFT_EXTRUDER
} from '../../constants';

import i18n from '../../lib/i18n';
import { valueOf } from '../../lib/contants-utils';
import { machineStore, printingStore } from '../../store/local-storage';
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
/* eslint-disable import/no-cycle */
import discoverActions from './action-discover';
import connectActions from './action-connect';

const INITIAL_STATE = {
    // region server disover
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
    printingArrangeSettings: {
        angle: 30,
        offset: 5,
        padding: 5
    },

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
    currentWorkNozzle: LEFT_EXTRUDER,
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
    // for dual extruder -> right extruder
    nozzleRightTemperature: 0,
    nozzleRightTargetTemperature: 0,
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

    pause3dpStatus: {
        pausing: false,
        pos: null
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
    // Whether auto preview file when import G code to workspace
    shouldAutoPreviewGcode: true,

    // connect info
    moduleStatusList: {},
    // wifi connection, home button in control widget
    homingModal: false
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
        const printingArrangeSettings = printingStore.get('printingArrangeSettings');
        if (printingArrangeSettings) {
            try {
                const newArrangeSettings = JSON.parse(printingArrangeSettings);
                dispatch(baseActions.updateState({
                    printingArrangeSettings: newArrangeSettings
                }));
            } catch (e) {
                console.error(e);
            }
        }
        const printingCustomConfigs = machineStore.get('printingCustomConfigs');
        if (printingCustomConfigs && Object.prototype.toString.call(printingCustomConfigs) === '[object String]') {
            const customConfigsArray = printingCustomConfigs.split('-');
            dispatch(baseActions.updateState({
                printingCustomConfigs: customConfigsArray
            }));
        }

        if (machineStore.get('shouldAutoPreviewGcode') === false) {
            dispatch(baseActions.updateState({
                shouldAutoPreviewGcode: false
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
            'Marlin:state': (options) => {
                // Note: serialPort & Wifi -> for heartBeat
                const { state } = options;
                const { headType, pos, originOffset, headStatus, headPower, temperature, zFocus, isHomed, zAxisModule, laser10WErrorState } = state;
                const machineState = getState().machine;
                if ((machineState.isRotate !== pos?.isFourAxis) && (headType === HEAD_LASER || headType === HEAD_CNC)) {
                    dispatch(workspaceActions.updateMachineState({
                        isRotate: pos.isFourAxis
                    }));
                }
                if (pos && pos.isFourAxis) {
                    if (Number(machineState.workPosition.x) !== Number(pos.x)
                        || Number(machineState.workPosition.y) !== Number(pos.y)
                        || Number(machineState.workPosition.z) !== Number(pos.z)
                        || Number(machineState.workPosition.b) !== Number(pos.b)) {
                        dispatch(baseActions.updateState({
                            workPosition: {
                                x: `${Number(pos.x).toFixed(3)}`,
                                y: `${Number(pos.y).toFixed(3)}`,
                                z: `${Number(pos.z).toFixed(3)}`,
                                b: `${Number(pos.b).toFixed(3)}`,
                                isFourAxis: true,
                                a: '0.000'
                            }
                        }));
                    }
                } else {
                    if (Number(machineState.workPosition.x) !== Number(pos.x)
                        || Number(machineState.workPosition.y) !== Number(pos.y)
                        || Number(machineState.workPosition.z) !== Number(pos.z)) {
                        dispatch(baseActions.updateState({
                            workPosition: {
                                x: `${Number(pos.x).toFixed(3)}`,
                                y: `${Number(pos.y).toFixed(3)}`,
                                z: `${Number(pos.z).toFixed(3)}`,
                                isFourAxis: false,
                                a: '0.000'
                            }
                        }));
                    }
                }
                if (Number(machineState.originOffset.x) !== Number(originOffset.x)
                    || Number(machineState.originOffset.y) !== Number(originOffset.y)
                    || Number(machineState.originOffset.z) !== Number(originOffset.z)) {
                    dispatch(baseActions.updateState({
                        originOffset: {
                            x: `${Number(originOffset.x).toFixed(3)}`,
                            y: `${Number(originOffset.y).toFixed(3)}`,
                            z: `${Number(originOffset.z).toFixed(3)}`,
                            a: '0.000'
                        }
                    }));
                }
                const { status,
                    laserFocalLength,
                    laserPower,
                    nozzleTemperature,
                    nozzleTargetTemperature,
                    heatedBedTemperature,
                    doorSwitchCount,
                    isEnclosureDoorOpen,
                    heatedBedTargetTemperature,
                    airPurifier,
                    airPurifierSwitch,
                    airPurifierFanSpeed,
                    airPurifierFilterHealth,
                    isEmergencyStopped,
                    moduleList: moduleStatusList,
                    laserCamera,
                    nozzleRightTargetTemperature,
                    nozzleRightTemperature
                } = state;
                dispatch(baseActions.updateState({
                    laser10WErrorState,
                    workflowStatus: status,
                    isHomed
                }));
                if (!isNil(laserFocalLength)) {
                    dispatch(baseActions.updateState({
                        laserFocalLength
                    }));
                } else if (!isNil(zFocus)) {
                    dispatch(baseActions.updateState({
                        laserFocalLength: zFocus + LASER_MOCK_PLATE_HEIGHT
                    }));
                }
                if (!isNil(laserPower)) {
                    dispatch(baseActions.updateState({
                        laserPower
                    }));
                } else if (!isNil(headPower)) {
                    dispatch(baseActions.updateState({
                        laserPower: headPower
                    }));
                }
                if (!isNil(temperature)) {
                    dispatch(baseActions.updateState({
                        nozzleTemperature: parseFloat(temperature.t),
                        nozzleTargetTemperature: parseFloat(temperature.tTarget),
                        heatedBedTemperature: parseFloat(temperature.b),
                        heatedBedTargetTemperature: parseFloat(temperature.bTarget)
                        // TO DO: 2.0 Serial connection need to add right extruder temperature info
                    }));
                } else {
                    dispatch(baseActions.updateState({
                        nozzleTemperature: nozzleTemperature,
                        nozzleTargetTemperature: nozzleTargetTemperature,
                        nozzleRightTemperature: nozzleRightTemperature,
                        nozzleRightTargetTemperature: nozzleRightTargetTemperature,
                        heatedBedTemperature: heatedBedTemperature,
                        heatedBedTargetTemperature: heatedBedTargetTemperature
                    }));
                }
                if (!isNil(moduleStatusList)) {
                    dispatch(baseActions.updateState(moduleStatusList));
                }
                if (!isNil(doorSwitchCount)) {
                    dispatch(baseActions.updateState(doorSwitchCount));
                }
                !isNil(isEnclosureDoorOpen) && dispatch(baseActions.updateState(isEnclosureDoorOpen));
                !isNil(zAxisModule) && dispatch(baseActions.updateState(zAxisModule));
                !isNil(headStatus) && dispatch(baseActions.updateState(headStatus));
                !isNil(laserCamera) && dispatch(baseActions.updateState(laserCamera));
                if (!isNil(airPurifier)) {
                    dispatch(baseActions.updateState({
                        airPurifier: airPurifier,
                        airPurifierSwitch: airPurifierSwitch,
                        airPurifierFanSpeed: airPurifierFanSpeed,
                        airPurifierFilterHealth: airPurifierFilterHealth
                    }));
                    dispatch(baseActions.updateState({
                        gcodePrintingInfo: machineState.server.getGcodePrintingInfo(state)
                    }));
                }
                // TODO: wifi emergencyStop goes there
                if (isEmergencyStopped) {
                    dispatch(baseActions.updateState({
                        isEmergencyStopped
                    }));
                    machineState.server.closeServer();
                }
            },
            'Marlin:settings': (options) => {
                const { enclosureDoorDetection, enclosureOnline, enclosureFan = 0, enclosureLight = 0,
                    airPurifierHasPower, airPurifier, airPurifierSwitch, airPurifierFanSpeed, airPurifierFilterHealth, emergencyStopOnline } = options.settings;
                if (!isNil(airPurifier)) {
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
                } else {
                    dispatch(baseActions.updateState({
                        enclosureDoorDetection,
                        enclosureOnline,
                        enclosureFan,
                        enclosureLight
                    }));
                }
            },
            'connection:connected': ({ state, err: _err }) => {
                if (_err) {
                    return;
                }
                let machineSeries = '';
                console.log({ state });
                const { toolHead, series, headType, status, isHomed, moduleStatusList } = state;
                const { seriesSize } = state;
                console.log('connection', state);
                dispatch(baseActions.updateState({
                    isHomed: isHomed
                }));
                if (!isNil(seriesSize)) {
                    machineSeries = valueOf(MACHINE_SERIES, 'alias', `${series}-${seriesSize}`)
                        ? valueOf(MACHINE_SERIES, 'alias', `${series}-${seriesSize}`).value : null;
                    dispatch(workspaceActions.loadGcode());
                } else {
                    const _isRotate = moduleStatusList?.rotaryModule;
                    const emergency = moduleStatusList?.emergencyStopButton;
                    dispatch(baseActions.updateState({
                        workflowStatus: status,
                        emergencyStopOnline: emergency
                    }));
                    dispatch(workspaceActions.updateMachineState({
                        isRotate: _isRotate
                    }));
                    machineSeries = series;
                }
                if (machineSeries && headType && headType !== 'UNKNOWN') {
                    dispatch(workspaceActions.updateMachineState({
                        series: machineSeries,
                        headType,
                        toolHead,
                    }));
                    dispatch(actions.executeGcodeG54(series, headType));
                    if (_.includes([WORKFLOW_STATUS_PAUSED, WORKFLOW_STATUS_RUNNING], status)) {
                        controller.emitEvent(CONNECTION_GET_GCODEFILE)
                            .once(CONNECTION_GET_GCODEFILE, (res) => {
                                const { msg: error, text: gcode } = res;
                                if (error) {
                                    return;
                                }
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
                        series: machineSeries,
                        headType: headType,
                        toolHead: toolHead,
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
                dispatch(baseActions.updateState({
                    isConnected: true,
                    isOpen: true,
                    connectionStatus: CONNECTION_STATUS_CONNECTED
                }));
            },
            'connection:close': () => {
                dispatch(actions.resetMachineState());
            },
            // TODO: serialport emergencyStop goes there
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
    updatePause3dpStatus: (pause3dpStatus) => (dispatch) => {
        dispatch(baseActions.updateState({ pause3dpStatus }));
    },

    // TODO： change 'port' to 'server'
    close: (options, isEmergencyStopped) => (dispatch, getState) => {
        const state = getState().machine;
        const ports = [...state.ports];
        if (!isEmpty(ports)) {
            const { port } = options;
            const portIndex = ports.indexOf(port);
            if (portIndex !== -1) {
                ports.splice(portIndex, 1);
            }
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
            workflowState: WORKFLOW_STATE_IDLE,
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

    executeGcode: (gcode, context, cmd) => (dispatch, getState) => {
        const machine = getState().machine;
        const { homingModal, isConnected } = machine;
        if (!isConnected) {
            if (homingModal) {
                dispatch(baseActions.updateState({
                    homingModal: false
                }));
            }
            return;
        }
        controller
            .emitEvent(CONNECTION_EXECUTE_GCODE, { gcode, context, cmd }, (gcodeArray) => {
                if (gcodeArray) {
                    if (homingModal && gcode === 'G28') {
                        dispatch(baseActions.updateState({
                            homingModal: false
                        }));
                    }
                    dispatch(actions.addConsoleLogs(gcodeArray));
                }
            });
    },

    coordinateMove: (gcode, moveOrders, jogSpeed, context, cmd) => (dispatch, getState) => {
        const { homingModal } = getState().machine;
        const { headType } = getState().workspace;
        controller.emitEvent(CONNECTION_COORDINATE_MOVE, { moveOrders, gcode, jogSpeed, headType, context, cmd }, (gcodeArray) => {
            if (gcodeArray) {
                if (homingModal && gcode === 'G28') {
                    dispatch(baseActions.updateState({
                        homingModal: false
                    }));
                }
                dispatch(actions.addConsoleLogs(gcodeArray));
            }
        });
    },

    setWorkOrigin: (xPosition, yPosition, zPosition, bPosition) => (dispatch) => {
        controller.emitEvent(CONNECTION_SET_WORK_ORIGIN, { xPosition, yPosition, zPosition, bPosition }, (gcodeArray) => {
            if (gcodeArray) {
                dispatch(actions.addConsoleLogs(gcodeArray));
            }
        });
    },

    executeGcodeAutoHome: (homingModal = false) => (dispatch, getState) => {
        // const { series, headType } = getState().workspace;
        // const { connectionType, server } = getState().machine;
        const { server } = getState().machine;
        // dispatch(actions.executeGcode('G53'));
        // if (homingModal && connectionType === CONNECTION_TYPE_WIFI) {
        //     dispatch(baseActions.updateState({
        //         homingModal
        //     }));
        // }
        // dispatch(actions.executeGcode('G28'));
        // dispatch(actions.executeGcodeG54(series, headType));
        console.log(homingModal);
        server.goHome();
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
        if (Array.isArray(consoleLogs)) {
            dispatch(baseActions.updateState({
                consoleLogs: consoleLogs
            }));
        }
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
        dispatch(baseActions.updateState({ autoupdateMessage: i18n._(autoupdateMessage) }));
    },
    updateIsDownloading: (isDownloading) => (dispatch) => {
        dispatch(baseActions.updateState({ isDownloading: isDownloading }));
    },
    updateShouldCheckForUpdate: (shouldCheckForUpdate) => (dispatch) => {
        dispatch(baseActions.updateState({ shouldCheckForUpdate: shouldCheckForUpdate }));
        machineStore.set('shouldCheckForUpdate', shouldCheckForUpdate);
    },
    updateArrangeSettings: (printingArrangeSettings) => (dispatch) => {
        dispatch(baseActions.updateState({ printingArrangeSettings }));
        printingStore.set('printingArrangeSettings', JSON.stringify(printingArrangeSettings));
    },
    updatePrintingCustomConfigs: (printingCustomConfigs) => (dispatch) => {
        dispatch(baseActions.updateState({ printingCustomConfigs }));
        const newConfig = printingCustomConfigs.join('-');
        machineStore.set('printingCustomConfigs', newConfig);
    },
    updateMultipleEngine: () => (dispatch, getState) => {
        const { multipleEngine } = getState().machine;
        dispatch(baseActions.updateState({ multipleEngine: !multipleEngine }));
    },
    updateShouldAutoPreviewGcode: (shouldAutoPreviewGcode) => (dispatch) => {
        dispatch(baseActions.updateState({ shouldAutoPreviewGcode: shouldAutoPreviewGcode }));
        machineStore.set('shouldAutoPreviewGcode', shouldAutoPreviewGcode);
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
