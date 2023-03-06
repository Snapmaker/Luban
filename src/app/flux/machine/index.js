/* eslint-disable import/no-cycle */
import _, { cloneDeep, includes, isEmpty, isNil, uniq } from 'lodash';
import {
    ABSENT_OBJECT,
    CONNECTION_CLOSE,
    CONNECTION_HEAD_BEGIN_WORK,
    CONNECTION_STATUS_IDLE,
    EMERGENCY_STOP_BUTTON,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    LASER_MOCK_PLATE_HEIGHT,
    LEFT_EXTRUDER,
    RIGHT_EXTRUDER,
    WORKFLOW_STATUS_UNKNOWN
} from '../../constants';

import {
    findMachineByName,
    getMachineSeriesWithToolhead,
    LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
    MACHINE_SERIES,
    MACHINE_TOOL_HEADS,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL,
    STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL,
} from '../../constants/machines';

import i18n from '../../lib/i18n';
import { valueOf } from '../../lib/contants-utils';
import { machineStore, printingStore } from '../../store/local-storage';
import PresetDefinitionModel from '../manager/PresetDefinitionModel';
import { actions as printingActions } from '../printing';
import { actions as editorActions } from '../editor';
import { actions as widgetActions } from '../widget';
import History from './History';
import FixedArray from './FixedArray';
import { controller } from '../../lib/controller';
import { actions as workspaceActions } from '../workspace';
import setting from '../../config/settings';

import baseActions, { ACTION_UPDATE_STATE } from './action-base';
/* eslint-disable import/no-cycle */
import definitionManager from '../manager/DefinitionManager';

const INITIAL_STATE = {
    printingArrangeSettings: {
        angle: 30,
        offset: 5,
        padding: 5
    },

    server: ABSENT_OBJECT,
    savedServerAddress: '',
    savedServerName: '',
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

    // region Machine Status

    // Machine Info
    series: MACHINE_SERIES.ORIGINAL.identifier,
    toolHead: {
        printingToolhead:
        MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].value,
        laserToolhead:
        MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].value,
        cncToolhead:
        MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].value
    },

    /**
     * Active machine object.
     */
    activeMachine: null,

    // currentMachine: INITIAL_MACHINE_SERIES_WITH_HEADTOOL,
    size: MACHINE_SERIES.ORIGINAL.metadata.size,
    laserSize: MACHINE_SERIES.ORIGINAL.metadata.size, // TODO: replace laserSize
    currentWorkNozzle: LEFT_EXTRUDER,
    // endregion

    // Console
    terminalHistory: new FixedArray(1000),
    consoleHistory: new History(1000),
    consoleLogs: [],
    // Serial port

    // from workflowState: idle, running, paused/ for serial connection?
    // workflowState: WORKFLOW_STATE_IDLE,
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

    nozzleTemperature1: 0,
    nozzleTemperature2: 0,

    nozzleTargetTemperature1: 0,
    nozzleTargetTemperature2: 0,

    heatedBedTemperature: 0,
    heatedBedTargetTemperature: 0,
    laserCamera: false,
    isFilamentOut: false,

    // 0 byte: state
    // 1 byte: temperature error
    // 2 byte: angel error
    laser10WErrorState: 0,

    workPosition: {
        // work position
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
    materialThicknessSource: 'user',

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

    printingCustomConfigsWithCategory: {
        quality: ['layer_height'],
        model_structure: ['infill_sparse_density', 'wall_thickness'],
        platform_adhesion: ['adhesion_type']
    },

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
    // Whether hide console when machine is working
    shouldHideConsole: true,
    promptDamageModel: true,
    enable3dpLivePreview: false,
    // connect info
    moduleStatusList: {},
    nozzleSizeList: [],
    // wifi connection, home button in control widget
    homingModal: false,
    // if XYZ axis move finished, value is false, else moving, value is true
    isMoving: false
};

export const actions = {
    // Initialize machine, get machine configurations via API
    init: () => (dispatch, getState) => {
        actions.__initMachineStatus(dispatch);
        actions.__initControllerEvents(dispatch, getState);

        actions.__initCNCSecurityWarning(dispatch);

        // actions.__init4Axis(dispatch);

        if (machineStore.get('shouldCheckForUpdate') === false) {
            const shouldCheckForUpdate = false;
            dispatch(
                baseActions.updateState({
                    shouldCheckForUpdate: shouldCheckForUpdate
                })
            );
        }
        const printingArrangeSettings = printingStore.get(
            'printingArrangeSettings'
        );
        if (printingArrangeSettings) {
            try {
                const newArrangeSettings = JSON.parse(printingArrangeSettings);
                dispatch(
                    baseActions.updateState({
                        printingArrangeSettings: newArrangeSettings
                    })
                );
            } catch (e) {
                console.error(e);
            }
        }
        const printingCustomConfigs = machineStore.get('printingCustomConfigs');
        const printingCustomConfigsWithCategory = machineStore.get('printingCustomConfigsWithCategory');
        if (
            printingCustomConfigs
            && Object.prototype.toString.call(printingCustomConfigs)
            === '[object String]'
        ) {
            const customConfigsArray = printingCustomConfigs.split('-');
            dispatch(
                baseActions.updateState({
                    printingCustomConfigs: customConfigsArray
                })
            );
        }

        if (printingCustomConfigsWithCategory) {
            const tempConfigs = {};
            Object.keys(printingCustomConfigsWithCategory).forEach(category => {
                tempConfigs[category] = uniq(printingCustomConfigsWithCategory[category]);
            });
            dispatch(baseActions.updateState({
                printingCustomConfigsWithCategory: tempConfigs
            }));
        }

        if (machineStore.get('shouldAutoPreviewGcode') === false) {
            dispatch(
                baseActions.updateState({
                    shouldAutoPreviewGcode: false
                })
            );
        }
        if (machineStore.get('shouldHideConsole') === false) {
            dispatch(baseActions.updateState({
                shouldHideConsole: false
            }));
        }
        if (machineStore.get('promptDamageModel') === false) {
            dispatch(
                baseActions.updateState({
                    promptDamageModel: false
                })
            );
        }
        if (machineStore.get('enable3dpLivePreview') === false) {
            const { modelGroup } = getState().printing;
            modelGroup.setClipperEnable(false);
            dispatch(
                baseActions.updateState({
                    enable3dpLivePreview: false
                })
            );
        }
    },

    /**
     * Initialize machine related attributes, series, machine size, etc.
     */
    __initMachineStatus: (dispatch) => {
        // Machine
        const {
            series = INITIAL_STATE.series,
            laserSize = INITIAL_STATE.laserSize,
            toolHead = INITIAL_STATE.toolHead
        } = machineStore.get('machine') || {};

        const machine = findMachineByName(series);
        if (!machine) {
            // warning?
            return;
        }

        dispatch(
            baseActions.updateState({
                series: series,
                size: machine.metadata.size,
                laserSize: machine.setting ? machine.setting.laserSize : laserSize,
                toolHead: toolHead,
                activeMachine: machine,
            })
        );

        dispatch(editorActions.onSizeUpdated('laser', machine.metadata.size));
        dispatch(editorActions.onSizeUpdated('cnc', machine.metadata.size));
    },

    __initControllerEvents: (dispatch, getState) => {
        // Register event listeners
        const controllerEvents = {
            'Marlin:state': (options) => {
                console.log('REFACTOR Marlin:state');
                // Note: serialPort & Wifi -> for heartBeat
                const { state } = options;
                const { headType, pos, originOffset, headStatus, headPower, temperature, zFocus, isHomed, zAxisModule, laser10WErrorState } = state;

                const compareAndSet = (obj, compareObj, key, value) => {
                    if (isNil(value)) {
                        return;
                    }
                    if (value !== compareObj[key]) {
                        obj[key] = value;
                    }
                };

                const data = {};

                const machineState = getState().machine;
                if ((machineState.isRotate !== pos?.isFourAxis) && (headType === HEAD_LASER || headType === HEAD_CNC)) {
                    dispatch(workspaceActions.updateMachineState({
                        isRotate: pos.isFourAxis || false
                    }));
                }

                if (pos) {
                    if (pos.isFourAxis) {
                        if (
                            Number(machineState.workPosition.x) !== Number(pos.x)
                            || Number(machineState.workPosition.y) !== Number(pos.y)
                            || Number(machineState.workPosition.z) !== Number(pos.z)
                            || Number(machineState.workPosition.b) !== Number(pos.b)
                            || machineState.workPosition.isFourAxis !== pos.isFourAxis
                        ) {
                            dispatch(
                                baseActions.updateState({
                                    workPosition: {
                                        x: `${Number(pos.x).toFixed(3)}`,
                                        y: `${Number(pos.y).toFixed(3)}`,
                                        z: `${Number(pos.z).toFixed(3)}`,
                                        b: `${Number(pos.b).toFixed(3)}`,
                                        isFourAxis: true,
                                        a: '0.000'
                                    }
                                })
                            );
                        }
                    } else {
                        if (
                            Number(machineState.workPosition.x) !== Number(pos.x)
                            || Number(machineState.workPosition.y) !== Number(pos.y)
                            || Number(machineState.workPosition.z) !== Number(pos.z)
                            || machineState.workPosition.isFourAxis !== pos.isFourAxis
                        ) {
                            dispatch(
                                baseActions.updateState({
                                    workPosition: {
                                        x: `${Number(pos.x).toFixed(3)}`,
                                        y: `${Number(pos.y).toFixed(3)}`,
                                        z: `${Number(pos.z).toFixed(3)}`,
                                        isFourAxis: false,
                                        a: '0.000'
                                    }
                                })
                            );
                        }
                    }
                }

                if (originOffset) {
                    if (
                        Number(machineState.originOffset.x)
                        !== Number(originOffset.x)
                        || Number(machineState.originOffset.y)
                        !== Number(originOffset.y)
                        || Number(machineState.originOffset.z)
                        !== Number(originOffset.z)
                        || Number(machineState.originOffset.b) !== Number(originOffset.b)
                    ) {
                        dispatch(
                            baseActions.updateState({
                                originOffset: {
                                    x: `${Number(originOffset.x).toFixed(3)}`,
                                    y: `${Number(originOffset.y).toFixed(3)}`,
                                    z: `${Number(originOffset.z).toFixed(3)}`,
                                    b: `${Number(originOffset.b).toFixed(3)}`,
                                    a: '0.000'
                                }
                            })
                        );
                    }
                }

                const {
                    status,
                    laserFocalLength,
                    laserPower,

                    // extruder nozzle temp
                    nozzleTemperature,
                    nozzleRightTemperature,

                    nozzleTargetTemperature,
                    nozzleRightTargetTemperature,

                    nozzleTemperature1,
                    nozzleTemperature2,

                    nozzleTargetTemperature1,
                    nozzleTargetTemperature2,

                    // bed temp
                    heatedBedTemperature,
                    heatedBedTargetTemperature,

                    doorSwitchCount,
                    isEnclosureDoorOpen,
                    airPurifier,
                    airPurifierSwitch,
                    airPurifierFanSpeed,
                    airPurifierFilterHealth,
                    airPurifierHasPower,
                    isEmergencyStopped,
                    moduleList: moduleStatusList,
                    nozzleSizeList,
                    laserCamera,
                    gcodePrintingInfo,
                    currentWorkNozzle,
                    cncTargetSpindleSpeed,
                    cncCurrentSpindleSpeed,
                    fileName,
                    ledValue,
                    fanLevel,
                    isDoorEnable
                } = state;

                compareAndSet(data, machineState, 'laser10WErrorState', laser10WErrorState);
                compareAndSet(data, machineState, 'isEmergencyStopped', isEmergencyStopped);
                compareAndSet(data, machineState, 'currentWorkNozzle', !currentWorkNozzle ? LEFT_EXTRUDER : RIGHT_EXTRUDER);
                compareAndSet(data, machineState, 'cncTargetSpindleSpeed', cncTargetSpindleSpeed);
                compareAndSet(data, machineState, 'cncCurrentSpindleSpeed', cncCurrentSpindleSpeed);
                compareAndSet(data, machineState, 'enclosureLight', ledValue);
                compareAndSet(data, machineState, 'enclosureFan', fanLevel);


                compareAndSet(data, machineState, 'isDoorEnabled', isDoorEnable);
                compareAndSet(data, machineState, 'gcodeFileName', fileName);
                compareAndSet(data, machineState, 'workflowStatus', status);
                compareAndSet(data, machineState, 'gcodePrintingInfo', gcodePrintingInfo);
                compareAndSet(data, machineState, 'isHomed', isHomed);
                compareAndSet(data, machineState, 'nozzleSizeList', nozzleSizeList);

                // if (!isNil(isDoorEnable)) {
                //     dispatch(baseActions.updateState({
                //         isDoorEnabled: isDoorEnable
                //     }));
                // }
                // if (!isNil(fileName)) {
                //     dispatch(baseActions.updateState({
                //         gcodeFileName: fileName
                //     }));
                // }
                // if (!isNil(status)) {
                //     dispatch(baseActions.updateState({
                //         workflowStatus: status
                //     }));
                // }
                // if (!isNil(gcodePrintingInfo)) {
                //     dispatch(baseActions.updateState({
                //         gcodePrintingInfo
                //     }));
                // }
                // if (!isNil(isHomed)) {
                //     dispatch(baseActions.updateState({
                //         isHomed
                //     }));
                // }
                // if (!isNil(nozzleSizeList)) {
                //     dispatch(baseActions.updateState({
                //         nozzleSizeList
                //     }));
                // }
                if (!isNil(laserFocalLength)) {
                    compareAndSet(data, machineState, 'laserFocalLength', laserFocalLength);
                    // dispatch(baseActions.updateState({
                    //     laserFocalLength
                    // }));
                } else if (!isNil(zFocus)) {
                    compareAndSet(data, machineState, 'laserFocalLength', zFocus + LASER_MOCK_PLATE_HEIGHT);
                    // dispatch(baseActions.updateState({
                    //     laserFocalLength: zFocus + LASER_MOCK_PLATE_HEIGHT
                    // }));
                }
                if (!isNil(laserPower)) {
                    // dispatch(baseActions.updateState({
                    //     laserPower
                    // }));
                    compareAndSet(data, machineState, 'laserPower', laserPower);
                } else if (!isNil(headPower)) {
                    dispatch(baseActions.updateState({
                        laserPower: headPower
                    }));
                    compareAndSet(data, machineState, 'headPower', headPower);
                }
                if (!isNil(temperature)) {
                    compareAndSet(data, machineState, 'nozzleTemperature', parseFloat(temperature.t));
                    compareAndSet(data, machineState, 'nozzleTargetTemperature', parseFloat(temperature.tTarget));
                    compareAndSet(data, machineState, 'heatedBedTemperature', parseFloat(temperature.b));
                    compareAndSet(data, machineState, 'heatedBedTargetTemperature', parseFloat(temperature.bTarget));
                    // dispatch(baseActions.updateState({
                    //     nozzleTemperature: parseFloat(temperature.t),
                    //     nozzleTargetTemperature: parseFloat(temperature.tTarget),
                    //     heatedBedTemperature: parseFloat(temperature.b),
                    //     heatedBedTargetTemperature: parseFloat(temperature.bTarget)
                    //     // TO DO: 2.0 Serial connection need to add right extruder temperature info
                    // }));
                } else {
                    compareAndSet(data, machineState, 'nozzleTemperature', nozzleTemperature);
                    compareAndSet(data, machineState, 'nozzleTargetTemperature', nozzleTargetTemperature);

                    compareAndSet(data, machineState, 'nozzleTemperature1', nozzleTemperature1);
                    compareAndSet(data, machineState, 'nozzleTemperature2', nozzleTemperature2);

                    compareAndSet(data, machineState, 'nozzleTargetTemperature1', nozzleTargetTemperature1);
                    compareAndSet(data, machineState, 'nozzleTargetTemperature2', nozzleTargetTemperature2);

                    compareAndSet(data, machineState, 'nozzleRightTemperature', nozzleRightTemperature);
                    compareAndSet(data, machineState, 'nozzleRightTargetTemperature', nozzleRightTargetTemperature);

                    compareAndSet(data, machineState, 'heatedBedTemperature', heatedBedTemperature);
                    compareAndSet(data, machineState, 'heatedBedTargetTemperature', heatedBedTargetTemperature);

                    // dispatch(baseActions.updateState({
                    //     nozzleTemperature: nozzleTemperature,
                    //     nozzleTargetTemperature: nozzleTargetTemperature,
                    //     nozzleRightTemperature: nozzleRightTemperature,
                    //     nozzleRightTargetTemperature: nozzleRightTargetTemperature,
                    //     heatedBedTemperature: heatedBedTemperature,
                    //     heatedBedTargetTemperature: heatedBedTargetTemperature
                    // }));
                }

                if (!isNil(moduleStatusList)) {
                    const enclosureOnline = moduleStatusList.enclosure;
                    const rotateModuleOnline = moduleStatusList.rotateModuleOnline;

                    compareAndSet(data, machineState, 'moduleStatusList', moduleStatusList);
                    compareAndSet(data, machineState, 'enclosureOnline', enclosureOnline);
                    compareAndSet(data, machineState, 'rotateModuleOnline', rotateModuleOnline);
                    // dispatch(baseActions.updateState({ moduleStatusList, enclosureOnline, rotateModuleOnline }));
                }
                if (!isNil(doorSwitchCount)) {
                    compareAndSet(data, machineState, 'doorSwitchCount', doorSwitchCount);
                    // dispatch(baseActions.updateState({ doorSwitchCount }));
                }

                compareAndSet(data, machineState, 'isEnclosureDoorOpen', isEnclosureDoorOpen);
                compareAndSet(data, machineState, 'zAxisModule', zAxisModule);
                compareAndSet(data, machineState, 'headStatus', !!headStatus);
                compareAndSet(data, machineState, 'laserCamera', laserCamera);

                // !isNil(isEnclosureDoorOpen) && dispatch(baseActions.updateState({ isEnclosureDoorOpen }));
                // !isNil(zAxisModule) && dispatch(baseActions.updateState({ zAxisModule }));
                // !isNil(headStatus) && dispatch(baseActions.updateState({ headStatus: !!headStatus }));
                // !isNil(laserCamera) && dispatch(baseActions.updateState({ laserCamera }));

                if (!isNil(airPurifier)) {
                    compareAndSet(data, machineState, 'airPurifier', airPurifier);
                    compareAndSet(data, machineState, 'airPurifierHasPower', airPurifierHasPower);
                    compareAndSet(data, machineState, 'airPurifierSwitch', airPurifierSwitch);
                    compareAndSet(data, machineState, 'airPurifierFanSpeed', airPurifierFanSpeed);
                    compareAndSet(data, machineState, 'airPurifierFilterHealth', airPurifierFilterHealth);
                    // dispatch(baseActions.updateState({
                    //     airPurifier: airPurifier,
                    //     airPurifierHasPower: airPurifierHasPower,
                    //     airPurifierSwitch: airPurifierSwitch,
                    //     airPurifierFanSpeed: airPurifierFanSpeed,
                    //     airPurifierFilterHealth: airPurifierFilterHealth
                    // }));
                }

                dispatch(baseActions.updateState(data));

                // TODO: wifi emergencyStop goes there
                if (isEmergencyStopped) {
                    dispatch(
                        baseActions.updateState({
                            isEmergencyStopped
                        })
                    );
                    machineState.server.closeServer();
                }
            },
            'Marlin:settings': (options) => {
                console.log('REFACTOR Marlin:settings');
                const {
                    enclosureDoorDetection,
                    enclosureOnline,
                    enclosureFan = 0,
                    enclosureLight = 0,
                    airPurifierHasPower,
                    airPurifier,
                    airPurifierSwitch,
                    airPurifierFanSpeed,
                    airPurifierFilterHealth,
                    emergencyStopOnline
                } = options.settings;
                if (!isNil(airPurifier)) {
                    dispatch(
                        baseActions.updateState({
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
                        })
                    );
                } else {
                    // Note: Wifi indiviual
                    dispatch(baseActions.updateState({
                        enclosureDoorDetection,
                        enclosureOnline,
                        enclosureFan,
                        enclosureLight
                    }));
                }
            },
            // TODO: serialport emergencyStop goes there
            'serialport:emergencyStop': (options) => {
                dispatch(actions.close(options, true));
            },
            'workflow:state': (options) => {
                const { workflowState } = options;
                dispatch(baseActions.updateState({
                    workflowStatus: workflowState
                }));
            },
            'sender:status': (options) => {
                const { data } = options;
                const { total, sent, received, startTime, finishTime, elapsedTime, remainingTime, printStatus } = data;
                dispatch(baseActions.updateState({
                    gcodePrintingInfo: {
                        total,
                        sent,
                        received,
                        startTime,
                        finishTime,
                        elapsedTime,
                        estimatedTime: remainingTime,
                        printStatus
                    }
                }));
            },
            'move:status': (options) => {
                const { isMoving, isHoming } = options;
                if (!isNil(isMoving)) {
                    dispatch(baseActions.updateState({
                        isMoving
                    }));
                }
                if (!isNil(isHoming)) {
                    dispatch(baseActions.updateState({
                        homingModal: isHoming
                    }));
                }
            },
            'manager:error': (options) => {
                const { owner, errorCode } = options;
                if (includes(EMERGENCY_STOP_BUTTON, owner)) {
                    if (errorCode === 1) {
                        controller.emitEvent(CONNECTION_CLOSE, () => {
                            dispatch(baseActions.resetMachineState());
                            dispatch(workspaceActions.updateMachineState({
                                headType: '',
                                toolHead: ''
                            }));
                        });
                    }
                }
            },
            'connection:headBeginWork': (options) => {
                const { gcodeFile } = getState().workspace;
                controller.emitEvent(CONNECTION_HEAD_BEGIN_WORK, {
                    headType: options.headType,
                    uploadName: gcodeFile.uploadName,
                    renderName: gcodeFile?.renderGcodeFileName || gcodeFile.uploadName
                });
            }
        };

        Object.keys(controllerEvents).forEach((event) => {
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

        dispatch(
            baseActions.updateState({
                shouldShowCncWarning
            })
        );
    },

    __init4Axis: (dispatch) => {
        const use4Axis = machineStore.get('settings.use4Axis');

        dispatch(
            baseActions.updateState({
                use4Axis: use4Axis === 'true' || use4Axis === true
            })
        );
    },

    updateMachineState: (state) => (dispatch) => {
        const { series, headType } = state;
        headType
        && dispatch(
            baseActions.updateState({
                headType: headType
            })
        );

        series && dispatch(actions.updateMachineSeries(series));
    },

    updateStateGcodeFileName: (name) => (dispatch) => {
        dispatch(baseActions.updateState({
            gcodeFileName: name
        }));
    },

    onChangeMachineSeries: (toolHead, series) => async (
        dispatch,
        getState
    ) => {
        machineStore.set('machine.series', series);
        machineStore.set('machine.toolHead', toolHead);

        function chooseMaterial(materialDefinitions, materialId) {
            const material = materialDefinitions.find((item) => materialId === item.definitionId);
            if (material) {
                return materialId;
            }

            return materialDefinitions[0].definitionId;
        }

        const oldToolHead = getState().machine.toolHead;
        const oldSeries = getState().machine.series;
        if (oldSeries !== series || !_.isEqual(oldToolHead, toolHead)) {
            dispatch(baseActions.updateState({ series, toolHead }));

            const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
            await definitionManager.init(HEAD_PRINTING, currentMachine.configPathname[HEAD_PRINTING]);

            const allMaterialDefinitions = await definitionManager.getDefinitionsByPrefixName(
                'material'
            );

            let { defaultMaterialId, defaultMaterialIdRight } = getState().printing;

            defaultMaterialId = chooseMaterial(allMaterialDefinitions, defaultMaterialId);
            defaultMaterialIdRight = chooseMaterial(allMaterialDefinitions, defaultMaterialIdRight);

            const materialPresetModels = allMaterialDefinitions.map(definition => new PresetDefinitionModel(definition));

            dispatch(printingActions.updateState({
                materialDefinitions: materialPresetModels,
                defaultMaterialId,
                defaultMaterialIdRight
            }));
            dispatch(printingActions.updateDefaultMaterialId(
                defaultMaterialId,
                LEFT_EXTRUDER
            ));
            dispatch(printingActions.updateDefaultMaterialId(
                defaultMaterialIdRight,
                RIGHT_EXTRUDER
            ));
        }
    },

    updateMachineSeries: (series) => async (dispatch, getState) => {
        machineStore.set('machine.series', series);

        const oldSeries = getState().machine.series;
        if (oldSeries === series) {
            return;
        }

        // Update machine as well
        const machine = findMachineByName(series);
        dispatch(baseActions.updateState({
            machine: machine
        }));

        // dispatch(baseActions.updateState({ series }));
        const seriesInfo = valueOf(MACHINE_SERIES, 'value', series);

        //  Do not need to 'initSize' just use 'switchSize' function
        await dispatch(printingActions.switchSize());
        seriesInfo && dispatch(actions.updateMachineSize(seriesInfo.size));
        seriesInfo && dispatch(actions.updateLaserSize(seriesInfo.setting.laserSize));
        dispatch(widgetActions.updateMachineSeries(series));


        // TODO: machine hard-coded here, refactor later.
        if (series === MACHINE_SERIES.ORIGINAL.identifier) {
            dispatch(actions.setZAxisModuleState(0));
        }
        if (series === MACHINE_SERIES.ORIGINAL_LZ.identifier) {
            dispatch(actions.setZAxisModuleState(1));
        }
    },

    updateMachineToolHead: (toolHead, series, headType = null) => (
        dispatch,
        getState
    ) => {
        machineStore.set('machine.toolHead', toolHead);
        const oldToolHead = getState().machine.toolHead;
        const oldSeries = getState().machine.series;
        if (
            !_.isEqual(oldToolHead, toolHead)
            || oldSeries !== series
            || headType
        ) {
            // const currentMachine = getMachineSeriesWithToolhead(series, toolHead, headType);
            // dispatch(baseActions.updateState({ currentMachine }));
            if (!_.isEqual(oldToolHead, toolHead)) {
                dispatch(baseActions.updateState({ toolHead }));
            }
        }
    },

    updateMachineSize: (size) => (dispatch) => {
        size.x = Math.min(size.x, 1000);
        size.y = Math.min(size.y, 1000);
        size.z = Math.min(size.z, 1000);

        dispatch(baseActions.updateState({ size: { ...size } }));

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
    updateMaterialThicknessSource: (source) => (dispatch) => {
        dispatch(baseActions.updateState({ materialThicknessSource: source }));
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
            dispatch(
                baseActions.updateState({
                    port: ports[0],
                    ports,
                    isOpen: false,
                    isConnected: false,
                    isEmergencyStopped: isEmergencyStopped ?? false,
                    connectionStatus: CONNECTION_STATUS_IDLE
                })
            );
        } else {
            // this.port = '';
            dispatch(
                baseActions.updateState({
                    port: '',
                    ports,
                    isOpen: false,
                    isConnected: false,
                    isEmergencyStopped: isEmergencyStopped ?? false,
                    connectionStatus: CONNECTION_STATUS_IDLE
                })
            );
        }
        dispatch(
            workspaceActions.updateMachineState({
                headType: '',
                toolHead: ''
            })
        );
        dispatch(
            baseActions.updateState({
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
            })
        );
        dispatch(workspaceActions.unloadGcode());
    },

    // region Enclosure
    getEnclosureState: () => () => {
        controller.writeln('M1010', { source: 'query' });
    },
    setEnclosureState: (doorDetection) => () => {
        controller.writeln(`M1010 S${doorDetection ? '1' : '0'}`, {
            source: 'query'
        });
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
            dispatch(
                baseActions.updateState({
                    consoleLogs: consoleLogs
                })
            );
        }
    },

    setShouldShowCncWarning: (value) => (dispatch) => {
        const version = setting.version;
        machineStore.set(
            'settings.shouldShowCncWarning',
            `${version}|${value}`
        );
        dispatch(
            baseActions.updateState({
                shouldShowCncWarning: value
            })
        );
    },

    // region Auto Update (need refactor)
    // TODO: Move Auto-Update code somewhere else.
    updateAutoupdateMessage: (autoupdateMessage) => (dispatch) => {
        dispatch(
            baseActions.updateState({
                autoupdateMessage: i18n._(autoupdateMessage)
            })
        );
    },
    updateIsDownloading: (isDownloading) => (dispatch) => {
        dispatch(baseActions.updateState({ isDownloading: isDownloading }));
    },
    updateShouldCheckForUpdate: (shouldCheckForUpdate) => (dispatch) => {
        dispatch(
            baseActions.updateState({
                shouldCheckForUpdate: shouldCheckForUpdate
            })
        );
        machineStore.set('shouldCheckForUpdate', shouldCheckForUpdate);
    },
    updateArrangeSettings: (printingArrangeSettings) => (dispatch) => {
        dispatch(baseActions.updateState({ printingArrangeSettings }));
        printingStore.set(
            'printingArrangeSettings',
            JSON.stringify(printingArrangeSettings)
        );
    },
    updatePrintingCustomConfigs: (printingCustomConfigs) => (dispatch) => {
        dispatch(baseActions.updateState({ printingCustomConfigs }));
        const newConfig = printingCustomConfigs.join('-');
        machineStore.set('printingCustomConfigs', newConfig);
    },
    updatePrintingCustomConfigsWithCategory: (printingCustomConfigs, category) => async (dispatch, getState) => {
        const { printingCustomConfigsWithCategory } = getState().machine;
        const newConfig = cloneDeep(printingCustomConfigsWithCategory);
        newConfig[category] = printingCustomConfigs;
        await dispatch(baseActions.updateState({
            printingCustomConfigsWithCategory: newConfig
        }));
        machineStore.set('printingCustomConfigsWithCategory', newConfig);
    },
    updateMultipleEngine: () => (dispatch, getState) => {
        const { multipleEngine } = getState().machine;
        dispatch(baseActions.updateState({ multipleEngine: !multipleEngine }));
    },
    updateShouldAutoPreviewGcode: (shouldAutoPreviewGcode) => (dispatch) => {
        dispatch(
            baseActions.updateState({
                shouldAutoPreviewGcode: shouldAutoPreviewGcode
            })
        );
        machineStore.set('shouldAutoPreviewGcode', shouldAutoPreviewGcode);
    },
    updateShouldHideConsole: (shouldHideConsole) => (dispatch) => {
        dispatch(baseActions.updateState({ shouldHideConsole: shouldHideConsole }));
        machineStore.set('shouldHideConsole', shouldHideConsole);
    },
    updatePromptDamageModel: (bool) => (dispatch) => {
        dispatch(baseActions.updateState({ promptDamageModel: bool }));
        machineStore.set('promptDamageModel', bool);
    },
    updateEnable3dpLivePreview: (bool) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        machineStore.set('enable3dpLivePreview', bool);
        dispatch(baseActions.updateState({ enable3dpLivePreview: bool }));
        modelGroup.setClipperEnable(bool);
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
