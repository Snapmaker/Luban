import * as THREE from 'three';
import {
    CONNECTION_STATUS_IDLE,
} from '../../constants';

export const WORKSPACE_STAGE = {
    EMPTY: 0,
    LOADING_GCODE: 1,
    LOAD_GCODE_SUCCEED: 2,
    LOAD_GCODE_FAILED: 3,
};

declare interface WorkspaceConnectionState {
    connectionType: string;
}

declare interface WorkspaceState extends WorkspaceConnectionState {
    headType: string;
}


/**
 * Connection Type
 */
export enum ConnectionType {
    Serial = 'serial',
    WiFi = 'wifi',
}


export const initialState: WorkspaceState = {
    headType: '',
    toolHead: '',

    isRotate: false,
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

    // Discover
    // HTTP connection
    //  - servers: HTTP servers on Snapmaker 2.0
    //  - serverDiscovering: discover state
    serverDiscovering: false,
    servers: [],

    // Connection
    //  - type: serial port or Wi-Fi
    //  - status: Idle / Connecting / Connected
    //  - timeout: connect timeout (for Wi-Fi connection)
    connectionType: ConnectionType.WiFi,
    connectionStatus: CONNECTION_STATUS_IDLE,
    connectionTimeout: 3000,
    connectLoading: false,

    // Connected Machine State
    machineIdentifier: '',
    machineSize: { x: 100, y: 100, z: 100 },
};
