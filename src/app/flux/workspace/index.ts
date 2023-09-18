import { WorkflowStatus } from '@snapmaker/luban-platform';
import { includes, isEmpty, isNil, isUndefined } from 'lodash';
import * as THREE from 'three';
import { Box3, Vector3 } from 'three';
import { v4 as uuid } from 'uuid';

import { generateRandomPathName } from '../../../shared/lib/random-utils';
import api from '../../api';
import SocketEvent from '../../communication/socket-events';
import {
    CONNECTION_GET_GCODEFILE,
    CONNECTION_HEAD_BEGIN_WORK,
    CONNECTION_STATUS_CONNECTED,
    CONNECTION_STATUS_IDLE,
    CONNECTION_STATUS_REQUIRE_AUTH,
    EPSILON,
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    LASER_MOCK_PLATE_HEIGHT,
    LEFT_EXTRUDER,
    PROTOCOL_TEXT,
    RIGHT_EXTRUDER,
} from '../../constants';
import {
    EMERGENCY_STOP_BUTTON,
    MACHINE_SERIES,
    findMachineByName,
    findToolHead,
} from '../../constants/machines';
import { valueOf } from '../../lib/contants-utils';
import { controller } from '../../communication/socket-communication';
import { logGcodeExport } from '../../lib/gaEvent';
import log from '../../lib/log';
import workerManager from '../../lib/manager/workerManager';
import { SnapmakerOriginalMachine } from '../../machines';
import ThreeUtils from '../../scene/three-extensions/ThreeUtils';
import { machineStore } from '../../store/local-storage';
import gcodeBufferGeometryToObj3d from '../../workers/GcodeToBufferGeometry/gcodeBufferGeometryToObj3d';
import { MachineAgent } from './MachineAgent';
import baseActions, { ACTION_UPDATE_STATE } from './actions-base';
import connectActions from './actions-connect';
import discoverActions from './actions-discover';
import { GCodeFileObject } from './actions-gcode';
import type { MachineStateUpdateOptions } from './state';
import { ConnectionType, WORKSPACE_STAGE, initialState } from './state';


export { WORKSPACE_STAGE } from './state';


// Actions
const ACTION_SET_STATE = 'WORKSPACE/ACTION_SET_STATE';

export const actions = {
    init: () => (dispatch) => {
        // Discover actions init
        dispatch(discoverActions.init());

        dispatch(actions.__initConnection());
        dispatch(connectActions.init());

        dispatch(actions.__initRemoteEvents());
    },

    // discover actions
    discover: discoverActions,

    connect: connectActions,

    /**
     * Initialize connection related state.
     */
    __initConnection: () => (dispatch) => {
        // Wi-Fi server
        const serverAddress = machineStore.get('server.address') || '';
        const serverName = machineStore.get('server.name') || '';
        const serverToken = machineStore.get('server.token') || '';
        const manualIp = machineStore.get('manualIp') || '';

        // serial port
        const machinePort = machineStore.get('port') || '';

        dispatch(
            baseActions.updateState({
                savedServerAddress: serverAddress,
                savedServerToken: serverToken,
                savedServerName: serverName,
                port: machinePort,
                manualIp: manualIp
            })
        );
    },

    /**
     * Handing of remote events.
     */
    __initRemoteEvents: () => (dispatch, getState) => {
        const controllerEvents = {
            // connecting state from remote
            [SocketEvent.ConnectionConnecting]: (options: { requireAuth?: boolean }) => {
                const { requireAuth = false } = options;

                if (requireAuth) {
                    // from connecting to require auth
                    dispatch(baseActions.updateState({
                        connectionStatus: CONNECTION_STATUS_REQUIRE_AUTH,
                    }));
                }
            },

            'connection:connected': ({ state, err: _err, connectionType }) => {
                if (_err) {
                    log.warn('connection:connected, failed to connect to networked printer');
                    log.warn(_err);
                    return;
                }
                log.info(`machine connected via ${connectionType}.`);

                let machineSeries = '';
                const {
                    toolHead,
                    series,
                    headType,
                    status,
                    moduleStatusList,
                    isHomed = false,
                    isMoving,
                } = state;
                const { seriesSize } = state;

                dispatch(baseActions.updateState({
                    isHomed: isHomed,
                    isMoving,
                }));

                if (!isNil(seriesSize)) {
                    machineSeries = valueOf(MACHINE_SERIES, 'alias', `${series}-${seriesSize}`)
                        ? valueOf(MACHINE_SERIES, 'alias', `${series}-${seriesSize}`).value
                        : null;
                    dispatch(actions.loadGcode());
                } else {
                    const _isRotate = moduleStatusList?.rotaryModule || false;
                    const emergency = moduleStatusList?.emergencyStopButton;
                    if (!isNil(status)) {
                        dispatch(baseActions.updateState({
                            workflowStatus: status
                        }));
                    }
                    dispatch(baseActions.updateState({
                        // workflowStatus: status,
                        emergencyStopOnline: emergency
                    }));
                    dispatch(actions.updateMachineState({
                        isRotate: _isRotate
                    }));
                    machineSeries = series;
                }

                log.info(`machine = ${machineSeries}`);
                log.info(`tool = ${toolHead}`);

                if (machineSeries && headType && headType !== 'UNKNOWN') {
                    dispatch(
                        actions.updateMachineState({
                            machineIdentifier: machineSeries,
                            headType,
                            toolHead,
                        })
                    );
                    dispatch(actions.executeGcodeG54(series, headType));
                    if (includes([WorkflowStatus.Running, WorkflowStatus.Paused], status)) {
                        controller
                            .emitEvent(CONNECTION_GET_GCODEFILE)
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
                                dispatch(actions.clearGcode());
                                dispatch(
                                    actions.renderGcode(
                                        `print.${suffix}`,
                                        gcode,
                                        true,
                                        true
                                    )
                                );
                            });
                    }
                } else {
                    dispatch(
                        actions.updateMachineState({
                            machineIdentifier: '',
                            headType: HEAD_PRINTING,
                            toolHead: '',
                        })
                    );
                }
                dispatch(
                    baseActions.updateState({
                        isConnected: true,
                        isOpen: true,
                        connectionStatus: CONNECTION_STATUS_CONNECTED,
                        isSendedOnWifi: true
                    })
                );
            },
            'connection:close': () => {
                dispatch(connectActions.resetMachineState());
            },

            'Marlin:settings': (options) => {
                log.warn('REFACTOR Marlin:settings', options);
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

            'Marlin:state': (options) => {
                // Note: serialPort & Wifi -> for heartBeat
                const { state } = options;
                const { headType, pos, originOffset, headStatus, headPower, temperature, zFocus, isHomed, zAxisModule, laser10WErrorState } = state;

                const compareAndSet = (obj: object, compareObj: object, key: string, value: boolean | number | string) => {
                    if (isNil(value)) {
                        return;
                    }
                    if (value !== compareObj[key]) {
                        obj[key] = value;
                    }
                };

                const data = {};

                const currentState = getState().workspace;
                if (pos && (currentState.isRotate !== pos.isFourAxis) && (headType === HEAD_LASER || headType === HEAD_CNC)) {
                    dispatch(actions.updateMachineState({
                        isRotate: pos.isFourAxis || false
                    }));
                }

                if (pos) {
                    if (pos.isFourAxis) {
                        if (
                            Number(currentState.workPosition.x) !== Number(pos.x)
                            || Number(currentState.workPosition.y) !== Number(pos.y)
                            || Number(currentState.workPosition.z) !== Number(pos.z)
                            || Number(currentState.workPosition.b) !== Number(pos.b)
                            || currentState.workPosition.isFourAxis !== pos.isFourAxis
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
                            Number(currentState.workPosition.x) !== Number(pos.x)
                            || Number(currentState.workPosition.y) !== Number(pos.y)
                            || Number(currentState.workPosition.z) !== Number(pos.z)
                            || currentState.workPosition.isFourAxis !== pos.isFourAxis
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
                        Number(currentState.originOffset.x)
                        !== Number(originOffset.x)
                        || Number(currentState.originOffset.y)
                        !== Number(originOffset.y)
                        || Number(currentState.originOffset.z)
                        !== Number(originOffset.z)
                        || Number(currentState.originOffset.b) !== Number(originOffset.b)
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

                compareAndSet(data, currentState, 'laser10WErrorState', laser10WErrorState);
                compareAndSet(data, currentState, 'isEmergencyStopped', isEmergencyStopped);
                if (!isNil(currentWorkNozzle)) {
                    // SACP only, SSTP missing currentWorkNozzle
                    compareAndSet(data, currentState, 'currentWorkNozzle', !currentWorkNozzle ? LEFT_EXTRUDER : RIGHT_EXTRUDER);
                }
                compareAndSet(data, currentState, 'cncTargetSpindleSpeed', cncTargetSpindleSpeed);
                compareAndSet(data, currentState, 'cncCurrentSpindleSpeed', cncCurrentSpindleSpeed);
                compareAndSet(data, currentState, 'enclosureLight', ledValue);
                compareAndSet(data, currentState, 'enclosureFan', fanLevel);


                compareAndSet(data, currentState, 'isDoorEnabled', isDoorEnable);
                compareAndSet(data, currentState, 'gcodeFileName', fileName);
                compareAndSet(data, currentState, 'workflowStatus', status);
                compareAndSet(data, currentState, 'gcodePrintingInfo', gcodePrintingInfo);
                compareAndSet(data, currentState, 'isHomed', isHomed);
                compareAndSet(data, currentState, 'nozzleSizeList', nozzleSizeList);

                if (!isNil(laserFocalLength)) {
                    compareAndSet(data, currentState, 'laserFocalLength', laserFocalLength);
                } else if (!isNil(zFocus)) {
                    compareAndSet(data, currentState, 'laserFocalLength', zFocus + LASER_MOCK_PLATE_HEIGHT);
                }
                if (!isNil(laserPower)) {
                    compareAndSet(data, currentState, 'laserPower', laserPower);
                } else if (!isNil(headPower)) {
                    dispatch(baseActions.updateState({
                        laserPower: headPower
                    }));
                    compareAndSet(data, currentState, 'headPower', headPower);
                }
                if (!isNil(temperature)) {
                    compareAndSet(data, currentState, 'nozzleTemperature', parseFloat(temperature.t));
                    compareAndSet(data, currentState, 'nozzleTargetTemperature', parseFloat(temperature.tTarget));
                    compareAndSet(data, currentState, 'heatedBedTemperature', parseFloat(temperature.b));
                    compareAndSet(data, currentState, 'heatedBedTargetTemperature', parseFloat(temperature.bTarget));
                } else {
                    compareAndSet(data, currentState, 'nozzleTemperature', nozzleTemperature);
                    compareAndSet(data, currentState, 'nozzleTargetTemperature', nozzleTargetTemperature);

                    compareAndSet(data, currentState, 'nozzleTemperature1', nozzleTemperature1);
                    compareAndSet(data, currentState, 'nozzleTemperature2', nozzleTemperature2);

                    compareAndSet(data, currentState, 'nozzleTargetTemperature1', nozzleTargetTemperature1);
                    compareAndSet(data, currentState, 'nozzleTargetTemperature2', nozzleTargetTemperature2);

                    compareAndSet(data, currentState, 'nozzleRightTemperature', nozzleRightTemperature);
                    compareAndSet(data, currentState, 'nozzleRightTargetTemperature', nozzleRightTargetTemperature);

                    compareAndSet(data, currentState, 'heatedBedTemperature', heatedBedTemperature);
                    compareAndSet(data, currentState, 'heatedBedTargetTemperature', heatedBedTargetTemperature);
                }

                if (!isNil(moduleStatusList)) {
                    const enclosureOnline = moduleStatusList.enclosure;
                    const rotateModuleOnline = moduleStatusList.rotateModuleOnline;

                    compareAndSet(data, currentState, 'moduleStatusList', moduleStatusList);
                    compareAndSet(data, currentState, 'enclosureOnline', enclosureOnline);
                    compareAndSet(data, currentState, 'rotateModuleOnline', rotateModuleOnline);
                }

                if (!isNil(doorSwitchCount)) {
                    compareAndSet(data, currentState, 'doorSwitchCount', doorSwitchCount);
                }

                compareAndSet(data, currentState, 'isEnclosureDoorOpen', isEnclosureDoorOpen);
                compareAndSet(data, currentState, 'zAxisModule', zAxisModule);
                compareAndSet(data, currentState, 'headStatus', !!headStatus);
                compareAndSet(data, currentState, 'laserCamera', laserCamera);

                if (!isNil(airPurifier)) {
                    compareAndSet(data, currentState, 'airPurifier', airPurifier);
                    compareAndSet(data, currentState, 'airPurifierHasPower', airPurifierHasPower);
                    compareAndSet(data, currentState, 'airPurifierSwitch', airPurifierSwitch);
                    compareAndSet(data, currentState, 'airPurifierFanSpeed', airPurifierFanSpeed);
                    compareAndSet(data, currentState, 'airPurifierFilterHealth', airPurifierFilterHealth);
                }

                dispatch(baseActions.updateState(data));

                // TODO: wifi emergencyStop goes there
                if (isEmergencyStopped) {
                    dispatch(
                        baseActions.updateState({
                            isEmergencyStopped
                        })
                    );
                    dispatch(connectActions.disconnect(currentState.server));
                }
            },

            /**
             * moduleList: [
             *   { key: 1, moduleId: 14, status: true },
             *   { key: 7, moduleId: 1500, status: true },
             * ]
             */
            'machine:module-list': (options) => {
                const moduleList = options.moduleList;

                dispatch(actions.updateState({
                    moduleList,
                }));
            },

            /**
             * @param options: {
             *     isLocked?: boolean;
             * }
             */
            'machine:laser-status': (options) => {
                const isLocked = options?.isLocked || false;

                dispatch(baseActions.updateState({
                    laserIsLocked: isLocked,
                }));
            },

            'connection:getActiveExtruder': (options) => {
                const activeExtruderIndex = options?.data?.active || 0;

                const newActiveExtruder = activeExtruderIndex === 0 ? LEFT_EXTRUDER : RIGHT_EXTRUDER;
                dispatch(baseActions.updateState({
                    currentWorkNozzle: newActiveExtruder,
                }));
            },

            'connection:updateWorkNozzle': () => {
                const currentWorkNozzle = getState().workspace.currentWorkNozzle;
                const newActiveExtruder = currentWorkNozzle === LEFT_EXTRUDER ? RIGHT_EXTRUDER : LEFT_EXTRUDER;
                dispatch(baseActions.updateState({
                    currentWorkNozzle: newActiveExtruder,
                }));
            },

            // TODO: serialport emergencyStop goes there
            'serialport:emergencyStop': (options) => {
                log.warn('REFACTOR serialport:emergencyStop');
                dispatch(actions.close(options, true));
            },
            'workflow:state': (options) => {
                const { workflowState } = options;
                log.warn('REFACTOR workflow:state =', workflowState);
                dispatch(baseActions.updateState({
                    workflowStatus: workflowState
                }));
            },
            'sender:status': (options) => {
                log.warn('REFACTOR sender:status');
                const { data } = options;
                const { filename, total, sent, received, startTime, finishTime, elapsedTime, remainingTime, printStatus } = data;

                if (filename) {
                    dispatch(baseActions.updateState({
                        gcodeFileName: filename,
                    }));
                }

                dispatch(baseActions.updateState({
                    gcodePrintingInfo: {
                        total,
                        sent,
                        received,
                        startTime,
                        finishTime,
                        elapsedTime,
                        estimatedTime: remainingTime,
                        remainingTime,
                        printStatus
                    }
                }));
            },
            'move:status': (options) => {
                log.warn('REFACTOR move:status');
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
                log.warn('REFACTOR manager:error');
                const { owner, errorCode } = options;
                if (includes(EMERGENCY_STOP_BUTTON, owner)) {
                    if (errorCode === 1) {
                        // TODO
                        controller.emitEvent(SocketEvent.ConnectionClose, () => {
                            dispatch(connectActions.resetMachineState());
                            dispatch(actions.updateMachineState({
                                headType: '',
                                toolHead: ''
                            }));
                        });
                    }
                }
            },
            'connection:headBeginWork': (options) => {
                log.warn('REFACTOR connection:headBeginWork');
                const { gcodeFile } = getState().workspace;
                controller.emitEvent(CONNECTION_HEAD_BEGIN_WORK, {
                    headType: options.headType,
                    uploadName: gcodeFile.uploadName,
                    renderName: gcodeFile?.renderGcodeFileName || gcodeFile.uploadName
                });
            }
        };

        for (const eventName of Object.keys(controllerEvents)) {
            const handler = controllerEvents[eventName];
            controller.on(eventName, handler);
        }
    },

    gcodeToArraybufferGeometryCallback: (data) => (dispatch, getState) => {
        const {
            status,
            value,
            renderMethod,
            isDone,
            gcodeFilename,
            isPreview = false,
        } = data;
        switch (status) {
            case 'succeed': {
                const { modelGroup, previewModelGroup } = getState().workspace;
                const boundingBox: Box3 = getState().workspace.boundingBox;
                const { positions, colors, index, indexColors } = value;
                const bufferGeometry = new THREE.BufferGeometry();
                const positionAttribute = new THREE.Float32BufferAttribute(
                    positions.send,
                    3
                );
                const indexAttribute = new THREE.Float32BufferAttribute(
                    index.send,
                    1
                );
                const colorAttribute = new THREE.Uint8BufferAttribute(
                    colors.send,
                    3
                );
                const indexColorAttribute = new THREE.Uint8BufferAttribute(
                    indexColors.send,
                    3
                );
                // this will map the buffer values to 0.0f - +1.0f in the shader
                colorAttribute.normalized = true;
                indexColorAttribute.normalized = true;

                bufferGeometry.setAttribute('position', positionAttribute);
                bufferGeometry.setAttribute('a_color', colorAttribute);
                bufferGeometry.setAttribute('a_index', indexAttribute);
                bufferGeometry.setAttribute(
                    'a_index_color',
                    indexColorAttribute
                );

                const object3D = gcodeBufferGeometryToObj3d(
                    'WORKSPACE',
                    bufferGeometry,
                    renderMethod
                );
                // object3D.material.uniforms.u_visible_index_count.value = 20000;
                object3D.name = `${gcodeFilename}-${uuid()}`;

                // Add object3D to one of group
                if (isPreview) {
                    previewModelGroup.add(object3D);
                } else {
                    modelGroup.add(object3D);
                }
                object3D.position.copy(new THREE.Vector3());

                // calculate bounding box of G-code objects
                const objectBBox = ThreeUtils.computeBoundingBox(object3D);

                const newBoundingBox = new Box3();
                if (boundingBox) {
                    newBoundingBox.copy(boundingBox);
                }
                newBoundingBox.expandByPoint(objectBBox.min);
                newBoundingBox.expandByPoint(objectBBox.max);

                if (isPreview) {
                    dispatch(
                        actions.updateState({
                            previewBoundingBox: newBoundingBox,
                        })
                    );
                } else {
                    dispatch(
                        actions.updateState({
                            boundingBox: newBoundingBox,
                        })
                    );
                }

                if (isDone) {
                    if (isPreview) {
                        dispatch(
                            actions.updateState({
                                previewRenderState: 'rendered',
                                previewStage: WORKSPACE_STAGE.LOAD_GCODE_SUCCEED,
                            })
                        );
                    } else {
                        dispatch(
                            actions.updateState({
                                renderState: 'rendered',
                                stage: WORKSPACE_STAGE.LOAD_GCODE_SUCCEED,
                            })
                        );
                    }
                }

                dispatch(actions.render());
                break;
            }
            case 'progress': {
                const state = getState().printing;
                if (value - state.progress > 0.01 || value > 1 - EPSILON) {
                    !isPreview
                        && dispatch(actions.updateState({ progress: value }));
                }
                break;
            }
            case 'err': {
                dispatch(
                    actions.updateState({
                        renderState: 'idle',
                        stage: WORKSPACE_STAGE.LOAD_GCODE_FAILED,
                        progress: 1,
                    })
                );
                break;
            }
            default:
                break;
        }
    },

    setGcodePrintingIndex: (index) => (dispatch, getState) => {
        const { modelGroup } = getState().workspace;
        for (const children of modelGroup.children) {
            children.material.uniforms.u_visible_index_count.value = index;
        }
    },

    updateState: (state) => {
        return {
            type: ACTION_SET_STATE,
            state,
        };
    },

    render: () => (dispatch) => {
        dispatch(
            actions.updateState({
                renderingTimestamp: +new Date(),
            })
        );
    },

    /**
     * Upload file to backend.
     * (and add to file transfer)
     *
     * @param file
     * @returns {Function}
     */
    uploadGcodeFileToList: (file) => (dispatch, getState) => {
        const { shouldAutoPreviewGcode } = getState().machine;

        const formData = new FormData();
        formData.append('file', file);

        api.uploadGcodeFile(formData)
            .then((res) => {
                const response = res.body;
                const header = response.gcodeHeader;
                const gcodeFile: GCodeFileObject = {
                    name: file.name,
                    uploadName: response.uploadName,
                    size: file.size,
                    lastModified: file.lastModified,
                    thumbnail: header[';thumbnail'] || '',
                    renderGcodeFileName: file.renderGcodeFileName || file.name,
                    boundingBox: new Box3(
                        new Vector3(
                            header[';min_x(mm)'],
                            header[';min_y(mm)'],
                            header[';min_z(mm)'],
                            // b: header[';min_b(mm)']
                        ),
                        new Vector3(
                            header[';max_x(mm)'],
                            header[';max_y(mm)'],
                            header[';max_z(mm)'],
                            // b: header[';max_b(mm)'],
                        ),
                    ),
                    type: header[';header_type'],
                    tool_head: header[';tool_head'],
                    nozzle_temperature: header[';nozzle_temperature(°C)'],
                    build_plate_temperature: header[';build_plate_temperature(°C)'],
                    work_speed: header[';work_speed(mm/minute)'],
                    estimated_time: header[';estimated_time(s)'],
                    matierial_weight: header[';matierial_weight'],
                    nozzle_1_temperature: header[';nozzle_1_temperature(°C)'],
                    jog_speed: header[';jog_speed(mm/minute)'],
                    power: header[';power(%)'],
                };
                dispatch(actions.addGcodeFiles(gcodeFile));
                shouldAutoPreviewGcode
                    && dispatch(actions.renderPreviewGcodeFile(gcodeFile));
            })
            .catch(() => {
                // Ignore error
            });
    },

    /**
     * Upload file to backend.
     * (and add to file transfer)
     * (and render it)
     *
     * @param file
     * @returns {Function}
     */
    uploadGcodeFile: (file) => (dispatch) => {
        const formData = new FormData();
        formData.append(
            'file',
            file instanceof File ? file : JSON.stringify(file)
        );
        const uploadName = generateRandomPathName(file.name);
        formData.append('uploadName', uploadName);

        api.uploadGcodeFile(formData)
            .then((res) => {
                const response = res.body;
                const header = response.gcodeHeader;
                const gcodeFile = {
                    name: file.name,
                    uploadName: response.uploadName,
                    size: file.size,
                    lastModified: +file.lastModified,
                    thumbnail: header[';thumbnail'] || '',
                    renderGcodeFileName: file.renderGcodeFileName || file.name,
                };
                dispatch(actions.renderGcodeFile(gcodeFile));
            })
            .catch(() => {
                // Ignore error
            });
    },

    clearGcode: (isPreview = false) => (dispatch, getState) => {
        const { modelGroup, previewModelGroup } = getState().workspace;
        if (isPreview) {
            previewModelGroup.remove(...previewModelGroup.children);
        } else {
            modelGroup.remove(...modelGroup.children);
        }
        dispatch(
            actions.updateState({
                renderState: 'idle',
                gcodeFile: null,
                boundingBox: new Box3(),
                stage: WORKSPACE_STAGE.EMPTY,
                progress: 0,
            })
        );
        dispatch(actions.render());
    },

    // updateGcodeFilename: (name, x = 0, y = 0, z = 0) => (dispatch, getState) => {
    //     const { modelGroup, gcodeFilenameObject } = getState().workspace;
    //     gcodeFilenameObject && modelGroup.remove(gcodeFilenameObject);
    //     const textSize = 5;
    //     const gcodeFilenameObjectTmp = new TextSprite({
    //         x: x,
    //         y: y,
    //         z: z,
    //         size: textSize,
    //         text: `G-code: ${name}`,
    //         color: colornames('gray 44'), // grid color
    //         opacity: 0.5
    //     });
    //     modelGroup.add(gcodeFilenameObjectTmp);
    //     dispatch(actions.updateState({
    //         gcodeFilenameObject: gcodeFilenameObjectTmp
    //     }));
    // },

    renderGcode: (name, gcode, shouldRenderGcode = false, isRepeat = false) => (
        dispatch
    ) => {
        dispatch(actions.clearGcode());
        const blob = new Blob([gcode], { type: 'text/plain' });
        const file = new File([blob], name);

        const formData = new FormData();
        formData.append('file', file);
        api.uploadFile(formData).then((res) => {
            const response = res.body;
            const gcodeFile = {
                name: file.name,
                uploadName: response.uploadName,
                size: file.size,
                lastModified: +file.lastModified,
                thumbnail: '',
            };
            dispatch(
                actions.renderGcodeFile(gcodeFile, !isRepeat, shouldRenderGcode)
            );
        });
    },

    renderGcodeFile: (
        gcodeFile: GCodeFileObject,
        needToList = true,
        shouldRenderGcode = false
    ) => async (dispatch, getState) => {
        const { shouldAutoPreviewGcode } = getState().machine;
        const { headType, isRotate } = getState().workspace;

        // const oldGcodeFile = getState().workspace.gcodeFile;
        if (needToList) {
            dispatch(actions.addGcodeFiles(gcodeFile));
        }
        // if (oldGcodeFile !== null && oldGcodeFile.uploadName === gcodeFile.uploadName) {
        //     return;
        // }
        if (shouldRenderGcode) {
            await dispatch(actions.clearGcode());
            await dispatch(
                actions.updateState({
                    gcodeFile,
                    stage: WORKSPACE_STAGE.LOADING_GCODE,
                    renderState: 'rendering',
                    progress: 0,
                })
            );
            // TODO:  used for serialport
            await dispatch(actions.loadGcode(gcodeFile));
            logGcodeExport(headType, 'workspace', isRotate);

            workerManager.gcodeToArraybufferGeometry(
                {
                    func: 'WORKSPACE',
                    gcodeFilename: gcodeFile.uploadName
                },
                (data) => {
                    // Note this callback can be called multiple times.
                    dispatch(actions.gcodeToArraybufferGeometryCallback(data));
                }
            );
        } else {
            if (shouldAutoPreviewGcode) {
                dispatch(actions.renderPreviewGcodeFile(gcodeFile));
            }

            if (gcodeFile.boundingBox) {
                await dispatch(
                    actions.updateState({
                        boundingBox: new Box3(
                            new Vector3().copy(gcodeFile.boundingBox.min),
                            new Vector3().copy(gcodeFile.boundingBox.max),
                        ),
                    })
                );
            }
        }
    },

    renderPreviewGcodeFile: (gcodeFile) => async (dispatch) => {
        await dispatch(actions.clearGcode(true));
        dispatch(
            actions.updateState({
                previewStage: WORKSPACE_STAGE.LOADING_GCODE,
                previewRenderState: 'rendering',
                progress: 0,
            })
        );
        workerManager.gcodeToArraybufferGeometry(
            {
                func: 'WORKSPACE',
                gcodeFilename: gcodeFile.uploadName,
                isPreview: true,
            },
            (data) => {
                dispatch(actions.gcodeToArraybufferGeometryCallback(data));
            }
        );
    },

    addGcodeFiles: (fileInfo) => (dispatch, getState) => {
        const { gcodeFiles } = getState().workspace;
        const files = [];
        fileInfo.isRenaming = false;
        fileInfo.newName = fileInfo.name;
        files.push(fileInfo);

        let added = 1,
            i = 0;
        while (added < 5 && i < gcodeFiles.length) {
            const gcodeFile = gcodeFiles[i];
            // G-code file with the same uploadName will be replaced with current one
            if (gcodeFile.uploadName !== fileInfo.uploadName) {
                files.push(gcodeFile);
                added++;
            }
            i++;
        }

        dispatch(
            actions.updateState({
                gcodeFiles: files,
            })
        );

        if (fileInfo.boundingBox) {
            dispatch(
                actions.updateState({
                    boundingBox: new Box3(
                        new Vector3().fromArray(fileInfo.boundingBox.min),
                        new Vector3().fromArray(fileInfo.boundingBox.max),
                    ),
                    gcodeFiles: files,
                })
            );
        }
    },

    renameGcodeFile: (uploadName, newName = null, isRenaming = null) => (
        dispatch,
        getState
    ) => {
        const { gcodeFiles } = getState().workspace;
        const find = gcodeFiles.find((e) => e.uploadName === uploadName);
        if (!find) {
            return;
        }
        if (newName !== null) {
            find.newName = newName;
            find.name = newName;
            find.renderGcodeFileName = newName;
        }
        if (isRenaming !== null) {
            find.isRenaming = isRenaming;
        }
        const files = gcodeFiles.map((e) => e);

        dispatch(
            actions.updateState({
                gcodeFiles: files,
            })
        );
    },

    removeGcodeFile: (fileInfo) => (dispatch, getState) => {
        const { gcodeFiles } = getState().workspace;

        const files = gcodeFiles.filter((item) => {
            return item.uploadName !== fileInfo.uploadName;
        });

        dispatch(
            actions.updateState({
                gcodeFiles: files,
            })
        );
    },

    /**
     * Tell controller to load G-code.
     *
     * @param gcodeFile An object that contains information of G-code file.
     * @returns {Promise}
     */
    loadGcode: (gcodeFile = null) => async (dispatch, getState) => {
        const { connectionStatus } = getState().workspace;
        const connectionType: ConnectionType = getState().workspace.connectionType;

        gcodeFile = gcodeFile || getState().workspace.gcodeFile;

        if (connectionType === ConnectionType.WiFi) {
            // Actually only with serial port plaintext protocol need to load G-code
            return;
        }

        if (connectionStatus !== CONNECTION_STATUS_CONNECTED || gcodeFile === null) {
            return;
        }

        const machineAgent: MachineAgent = getState().workspace.server;

        dispatch(actions.updateState({ uploadState: 'uploading' }));
        try {
            await api.loadGCode({
                port: machineAgent?.port,
                dataSource: PROTOCOL_TEXT,
                uploadName: gcodeFile.uploadName,
            });

            dispatch(actions.updateState({ uploadState: 'uploaded' }));
        } catch (e) {
            dispatch(actions.updateState({ uploadState: 'idle' }));

            log.error('Failed to upload G-code to controller');
        }
    },

    unloadGcode: () => (dispatch) => {
        // dispatch(actions.executeCmd('gcode:unload'));
        dispatch(actions.updateState({ uploadState: 'idle' }));
    },

    updateMachineState: (options: MachineStateUpdateOptions) => (dispatch) => {
        if (!isUndefined(options.machineIdentifier) && !isUndefined(options.toolHead)) {
            const activeMachine = findMachineByName(options.machineIdentifier);
            const activeTool = findToolHead(options.toolHead);
            let activeMachineToolOptions = null;
            if (activeMachine && activeTool) {
                for (const toolOptions of activeMachine.metadata.toolHeads) {
                    if (toolOptions.identifier === activeTool.identifier) {
                        activeMachineToolOptions = toolOptions;
                        break;
                    }
                }
            }

            if (activeMachine) {
                options.machineSize = {
                    x: activeMachine.metadata.size.x,
                    y: activeMachine.metadata.size.y,
                    z: activeMachine.metadata.size.z,
                };
            }

            options.activeMachine = activeMachine;
            options.activeTool = activeTool;
            options.activeMachineToolOptions = activeMachineToolOptions;
        }

        dispatch(actions.updateState(options));
    },

    executeCmd: (cmd: string) => {
        console.log('execute cmd', cmd);
        controller.emitEvent(SocketEvent.ExecuteCmd, { cmd });
    },

    /**
     * Execute G-code.
     */
    executeGcode: (gcode: string, context = null, cmd = undefined) => (dispatch, getState) => {
        const { homingModal, isConnected } = getState().workspace;
        if (!isConnected) {
            if (homingModal) {
                dispatch(
                    baseActions.updateState({
                        homingModal: false
                    })
                );
            }
            return;
        }
        controller.emitEvent(
            SocketEvent.ExecuteGCode,
            { gcode, context, cmd },
            () => {
                if (homingModal && gcode === 'G28') {
                    dispatch(
                        baseActions.updateState({
                            homingModal: false
                        })
                    );
                }
            }
        );
    },

    executeGcodeAutoHome: (hasHomingModel = false) => (dispatch, getState) => {
        const { homingModal, isConnected } = getState().workspace;
        const machineAgent: MachineAgent = getState().workspace.server;
        const { headType } = getState().workspace;
        if (!isConnected) {
            if (homingModal) {
                dispatch(
                    baseActions.updateState({
                        homingModal: false
                    })
                );
            }
            return;
        }
        machineAgent.goHome({ hasHomingModel, headType }, () => {
            dispatch(
                baseActions.updateState({
                    homingModal: false
                })
            );
        });
    },

    // Execute G54 based on series and headType
    executeGcodeG54: (series, headType) => (dispatch) => {
        if (
            series !== SnapmakerOriginalMachine.identifier
            && (headType === HEAD_LASER || headType === HEAD_CNC)
        ) {
            dispatch(actions.executeGcode('G54'));
        }
    },

    // TODO： change 'port' to 'server'
    close: (options, isEmergencyStopped) => (dispatch, getState) => {
        const state = getState().workspace;
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
            actions.updateMachineState({
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
        dispatch(actions.unloadGcode());
    },

    updateStateGcodeFileName: (name: string) => (dispatch) => {
        dispatch(baseActions.updateState({
            gcodeFileName: name
        }));
    },

    // 3DP
    updatePause3dpStatus: (pause3dpStatus) => (dispatch) => {
        dispatch(baseActions.updateState({ pause3dpStatus }));
    },

    // Laser
    updateIsLaserPrintAutoMode: (isLaserPrintAutoMode: boolean) => (dispatch) => {
        dispatch(baseActions.updateState({ isLaserPrintAutoMode }));
    },

    updateMaterialThickness: (materialThickness: number) => (dispatch) => {
        dispatch(baseActions.updateState({ materialThickness }));
    },
    updateMaterialThicknessSource: (source: string) => (dispatch) => {
        dispatch(baseActions.updateState({ materialThicknessSource: source }));
    },

    // Console widget
    addConsoleLogs: (consoleLogs: string[]) => (dispatch) => {
        if (Array.isArray(consoleLogs)) {
            dispatch(
                baseActions.updateState({
                    consoleLogs: consoleLogs
                })
            );
        }
    },
};

export default function reducer(state = initialState, action) {
    switch (action.type) {
        case ACTION_SET_STATE: {
            return Object.assign({}, state, { ...action.state });
        }

        case ACTION_UPDATE_STATE:
            return Object.assign({}, state, action.state);

        default:
            return state;
    }
}
