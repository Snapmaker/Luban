import * as THREE from 'three';
import {
    CONNECTION_STATUS_IDLE,
    LEFT_EXTRUDER,
    WORKFLOW_STATUS_UNKNOWN
} from '../../constants';

import { controller } from '../../lib/controller';

export const WORKSPACE_STAGE = {
    EMPTY: 0,
    LOADING_GCODE: 1,
    LOAD_GCODE_SUCCEED: 2,
    LOAD_GCODE_FAILED: 3,
};

/**
 * Connection Type
 */
export enum ConnectionType {
    Serial = 'serial',
    WiFi = 'wifi',
}

export declare interface MachineState {
    machineIdentifier: string;
    machineSize: { x: number; y: number; z: number };
}

export declare interface MachineStateUpdateOptions {
    machineIdentifier?: string;
    machineSize?: { x: number; y: number; z: number };

    headType?: string;
    toolHead?: string;

    isRotate?: boolean;
}
declare interface WorkspaceConnectionState {
    connectionType: string;
}

// interface to put everything nowhere to put
declare interface WorkspaceOtherState {
    uploadState: string;
    renderState: string;
    previewRenderState: string;

    gcodeFile: object | null;
    activeGcodeFile: object | null;

    boundingBox: object;
    previewBoundingBox: object;
}

declare interface WorkspaceState extends WorkspaceConnectionState, WorkspaceOtherState, MachineState {
    headType: string;
}

export const initialState: WorkspaceState = {
    uploadState: 'idle', // uploading, uploaded
    renderState: 'idle',
    previewRenderState: 'idle',
    gcodeFile: null,
    activeGcodeFile: null,
    boundingBox: null,
    previewBoundingBox: null,
    gcodeFiles: [],
    modelGroup: new THREE.Group(),
    previewModelGroup: new THREE.Group(),
    renderingTimestamp: 0,
    stage: WORKSPACE_STAGE.EMPTY,
    previewStage: WORKSPACE_STAGE.EMPTY,
    progress: 0,

    //
    // Discover
    //
    // HTTP connection
    //  - servers: HTTP servers on Snapmaker 2.0
    //  - serverDiscovering: discover state
    serverDiscovering: false,
    servers: [],

    // serial port related
    //  - ports: all serial ports available
    //  - port: serial port selected
    port: controller.port || '',
    ports: [],

    //
    // Connection
    //
    //  - type: serial port or Wi-Fi
    //  - status: Idle / Connecting / Connected
    //  - timeout: connect timeout (for Wi-Fi connection)
    connectionType: ConnectionType.WiFi,
    connectionStatus: CONNECTION_STATUS_IDLE,
    connectionTimeout: 3000,
    connectLoading: false,

    manualIp: '',

    savedServerAddress: '',
    savedServerName: '',
    savedServerToken: '',

    server: null,
    isOpen: false,
    isConnected: false,
    isSendedOnWifi: true,

    //
    // Connected Machine State
    //
    machineIdentifier: '',
    machineSize: { x: 100, y: 100, z: 100 },
    headType: '',
    toolHead: '',

    //
    // Machine State
    //
    // from workflowState: idle, running, paused/ for serial connection?
    // workflowState: WORKFLOW_STATE_IDLE,
    isHomed: null,
    isMoving: false, // XYZ axes are moving

    // rotate module
    isRotate: false,

    // enclosure
    enclosureDoorDetection: false,
    enclosureLight: 0,
    enclosureFan: 0,
    enclosureOnline: false,

    // Air purifier
    airPurifier: false,
    airPurifierSwitch: false,
    airPurifierFanSpeed: 3,
    airPurifierFilterHealth: 2,
    airPurifierHasPower: false,

    // Emergency Stop module
    emergencyStopOnline: false,

    // modules status
    moduleStatusList: {},
    nozzleSizeList: [],

    // workflow, or machine status: unknown, idle, running, paused
    workflowStatus: WORKFLOW_STATUS_UNKNOWN,

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

    currentWorkNozzle: LEFT_EXTRUDER,
};
