import { includes, isEqual, isNil } from 'lodash';
import request from 'superagent';

import SocketEvent from '../../../../app/communication/socket-events';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, } from '../../../../app/constants/machines';
import { L20WLaserToolModule, L2WLaserToolModule, L40WLaserToolModule, highPower200WCNCToolHead } from '../../../../app/machines/snapmaker-2-toolheads';
import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2,
    STANDARD_CNC_TOOLHEAD_FOR_SM2,
    findMachine
} from '../../../constants';
import logger from '../../../lib/logger';
import workerManager from '../../task-manager/workerManager';
import { ConnectionType, EventOptions } from '../types';
import Channel, { CncChannelInterface, ExecuteGcodeResult, FileChannelInterface, LaserChannelInterface, UploadFileOptions } from './Channel';
import { ChannelEvent } from './ChannelEvent';
import { connectionDiagnostics, diagnosticId } from '../connectionDiagnostics';
import { httpEvidence } from '../connectionDiagnosticState';
import { gcodeLease } from '../gcodeLease';

let waitConfirm: boolean;
const log = logger('machine:channels:SstpHttpChannel');


const isJSON = (str: string) => {
    if (typeof str === 'string') {
        try {
            const obj = JSON.parse(str);
            if (typeof obj === 'object' && obj) {
                return true;
            } else {
                return false;
            }
        } catch (e) {
            return false;
        }
    }
    return false;
};

interface Result {
    code: number;
    msg: string;
    text?: string;
    // Parsed JSON body; its fields depend on the endpoint.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>;
}
const _getResult = (err, res: request.Response): Result => {
    if (err) {
        if (res && isJSON(res.text) && JSON.parse(res.text).code === 202) {
            return {
                msg: err.message,
                code: 202,
                text: res && res.text,
                data: res && res.body
            };
        } else if (res && isJSON(res.text) && JSON.parse(res.text).code === 203) {
            return {
                msg: err.message,
                code: 203,
                text: res && res.text,
                data: res && res.body
            };
        } else {
            return {
                msg: err.message,
                code: (res && res.status) || (err && err.code),
                text: res && res.text,
                data: res && res.body
            };
        }
    }

    const code = res.status;
    if (code !== 200 && code !== 204 && code !== 203) {
        return {
            code,
            msg: res && res.text
        };
    }

    return {
        code,
        msg: '',
        data: res.body,
        text: res.text
    };
};
// let timeoutHandle = null;


export type StateOptions = {
    headType?: string,
    toolHead?: string,
    series?: string
};

export type GcodeResult = {
    text?: string;
    data?: string;
    msg?: string;
    code?: number;
};


interface GCodeQueueItemResponse {
    result: number;
    text: string;
}
interface GCodeQueueItem {
    gcodes: string[];
    callback: (res: GCodeQueueItemResponse) => void;
}

/**
 * A singleton to manage devices connection.
 */
class SstpHttpChannel extends Channel implements
    FileChannelInterface,
    LaserChannelInterface,
    CncChannelInterface {
    private isGcodeExecuting = false;

    private connectionGeneration = 0;

    private heartbeatGeneration = 0;

    private gcodeQueue: GCodeQueueItem[] = [];

    private host = '';

    private token = '';

    private state: StateOptions = {};

    // last heartbeat state, kept for status reporting (MCP); null until the
    // first heartbeat arrives, stamped so readers can judge freshness
    private latestMachineState: { [key: string]: unknown; timestamp: number } | null = null;

    private heartBeatWorker = null;

    private moduleSettings = null;

    private getLaserMaterialThicknessReq = null;

    private intervalRefMap = new Map();

    private clearAllInterval() {
        Array.from(this.intervalRefMap.values())
            .forEach(intervalRef => clearInterval(intervalRef));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onConnection = () => {
        // A renderer/client connection is not a machine connection.
        // Keep polling when another client opens or the renderer reloads.
    };

    public onDisconnection = () => {
        // empty
    };

    public init = () => {
        this.connectionGeneration++;
        for (const item of this.gcodeQueue.splice(0)) {
            item.callback({ result: -1, text: 'Machine connection ended before command execution.' });
        }
        this.isGcodeExecuting = false;
    };

    public async connectionOpen(options: { address: string; host: string; token: string; allowPairing?: boolean; attemptId?: string }): Promise<boolean> {
        const { host, token } = options;
        // Only an explicit operator pairing action may send an empty token.
        // Do this before changing the existing session or making any request.
        if (!token?.trim() && options.allowPairing !== true) {
            this.socket && this.socket.emit(SocketEvent.ConnectionOpen, {
                code: 401,
                msg: 'No saved machine token. Automatic pairing is disabled. Use Connect in Luban to pair explicitly.',
            });
            return false;
        }
        if (options.allowPairing !== true) {
            try {
                await this.verifySession(host, token, options.attemptId);
            } catch (error) {
                this.socket && this.socket.emit(SocketEvent.ConnectionOpen, { code: 401, msg: (error as Error).message });
                return false;
            }
        }
        connectionDiagnostics.capture('before_connection_open', diagnosticId());
        this.stopHeartBeat('connection_open');
        const sessionId = diagnosticId();
        connectionDiagnostics.beginSession(sessionId, options.attemptId);
        this.latestMachineState = null;
        this.host = host;
        this.token = token;
        this.init();

        this.emit(ChannelEvent.Connecting, { requireAuth: false });

        log.debug(`wifi host="${this.host}"`);
        return new Promise((resolve) => {
            const api = `${this.host}/api/v1/connect`;
            const startedAt = Date.now();
            request
                .post(api)
                .timeout(3000)
                .send(this.token ? `token=${this.token}` : '')
                .end((err, res) => {
                    connectionDiagnostics.record('connect_response', { ...httpEvidence(err, res),
                        sessionId,
                        attemptId: options.attemptId,
                        durationMs: Date.now() - startedAt,
                        tokenReturned: Boolean(res?.body?.token) });
                    if (res?.body?.token) {
                        this.token = res.body.token;
                    }

                    const result = _getResult(err, res);
                    if (err) {
                        log.debug('Machine connect request failed; see connection diagnostics for status.');
                        this.socket && this.socket.emit(SocketEvent.ConnectionOpen, result);
                        resolve(false);
                        return;
                    }

                    // wait for authentication
                    const { data } = result;
                    if (!data) {
                        /*
                        this.socket && this.socket.emit(ChannelEvent.Connecting, {
                            requireAuth: true,
                        });
                        */
                        resolve(false);
                        return;
                    }

                    const { series } = data;
                    const machine = findMachine(series);
                    this.state.series = machine ? machine.identifier : null;

                    let headType = data.headType;
                    let toolHead: string;
                    switch (data.headType) {
                        case 1:
                            headType = HEAD_PRINTING;
                            toolHead = SINGLE_EXTRUDER_TOOLHEAD_FOR_SM2;
                            break;
                        case 2:
                            headType = HEAD_CNC;
                            toolHead = STANDARD_CNC_TOOLHEAD_FOR_SM2;
                            break;
                        case 3:
                            headType = HEAD_LASER;
                            toolHead = LEVEL_ONE_POWER_LASER_FOR_SM2;
                            break;
                        case 4:
                            headType = HEAD_LASER;
                            toolHead = LEVEL_TWO_POWER_LASER_FOR_SM2;
                            break;
                        case 5:
                            headType = HEAD_PRINTING;
                            toolHead = DUAL_EXTRUDER_TOOLHEAD_FOR_SM2;
                            break;
                        case 6:
                            headType = HEAD_LASER;
                            toolHead = L20WLaserToolModule.identifier;
                            break;
                        case 7:
                            headType = HEAD_LASER;
                            toolHead = L40WLaserToolModule.identifier;
                            break;
                        case 8:
                            headType = HEAD_CNC;
                            toolHead = highPower200WCNCToolHead.identifier;
                            break;
                        case 9:
                            headType = HEAD_LASER;
                            toolHead = L2WLaserToolModule.identifier;
                            break;
                        default:
                            headType = HEAD_PRINTING;
                            toolHead = undefined;
                    }
                    this.state.headType = headType;
                    this.state.toolHead = toolHead;

                    if (!(this.state.series && headType && headType !== 'UNKNOWN')) {
                        this.socket && this.socket.emit('connection:open', {
                            msg: 'key-Workspace/Connection-The machine or toolhead cannot be correctly recognized. Make sure the firmware is up to date and the machine is wired correctly.',
                            code: 500,
                        });
                    } else {
                        this.socket && this.socket.emit('connection:open', result);
                    }

                    // Get module list(only status)
                    this.getModuleList();

                    // Get enclosure status (every 1000ms)
                    clearInterval(this.intervalRefMap.get('getEnclosureStatus'));
                    this.intervalRefMap.set('getEnclosureStatus', setInterval(this.getEnclosureStatus, 1000));

                    // Get module info(include data) every 1000ms
                    clearInterval(this.intervalRefMap.get('getModuleInfo'));
                    this.intervalRefMap.set('getModuleInfo', setInterval(this.getModuleInfo, 1000));

                    // Get Active extruder
                    this.getActiveExtruder({ eventName: 'connection:getActiveExtruder' });

                    this.emit(ChannelEvent.Connected);
                    this.emit(ChannelEvent.Ready, {
                        machineIdentifier: series,
                    });

                    resolve(true);
                });
        });
    }

    /**
     * Last heartbeat state, or null before the first heartbeat / after close.
     */
    public getLatestMachineState(): { [key: string]: unknown; timestamp: number } | null {
        return this.latestMachineState;
    }

    /**
     * One extra read of /api/v1/status for spindle telemetry during a file
     * job (mcp/spindleTelemetry.ts). Deliberately NOT routed through the
     * heartbeat: it neither updates latestMachineState nor the position of
     * record, so the 2 s cadence every safety judge assumes is untouched;
     * the caller only gets the controller's raw report and how long it took.
     */
    public async fetchStatus(): Promise<{ data: Record<string, unknown>; durationMs: number; bytes: number }> {
        if (!this.host || !this.token) {
            throw new Error('No HTTP machine session.');
        }
        const startedAt = Date.now();
        return new Promise((resolve, reject) => {
            request
                .get(`${this.host}/api/v1/status`)
                .query({ token: this.token, _: startedAt })
                .timeout(3000)
                .end((err: Error | null, res: request.Response) => {
                    const result = _getResult(err, res);
                    if (result.code !== 200 || !result.data || typeof (result.data as { status?: unknown }).status !== 'string') {
                        // Never surface the request error: it can carry the token in the URL.
                        reject(new Error(`status poll failed (${result.code || 'transport error'})`));
                        return;
                    }
                    resolve({ data: result.data, durationMs: Date.now() - startedAt, bytes: res && res.text ? res.text.length : 0 });
                });
        });
    }

    public async connectionClose(options: { force: boolean }): Promise<boolean> {
        // TODO: cancel intervals on instance
        this.clearAllInterval();
        this.stopHeartBeat('connection_close');
        this.latestMachineState = null;
        this.init();

        const force = options?.force || false;

        if (!force) {
            return new Promise((resolve) => {
                const api = `${this.host}/api/v1/disconnect`;
                request
                    .post(api)
                    .timeout(3000)
                    .send(`token=${this.token}`)
                    .end((err) => {
                        if (err) {
                            resolve(false);
                        } else {
                            resolve(true);
                        }
                    });

                this.host = '';
                this.token = '';
            });
        } else {
            return true;
        }
    }

    private async verifySession(host: string, token: string, attemptId?: string): Promise<void> {
        const startedAt = Date.now();
        const active = connectionDiagnostics.snapshot();
        const trace = {
            attemptId: attemptId || active.attemptId,
            sessionId: attemptId ? undefined : active.sessionId,
            requestId: diagnosticId(),
        };
        connectionDiagnostics.record('session_check_requested', trace);
        const result: Result = await new Promise(resolve => {
            request.get(`${host}/api/v1/status`)
                .query({ token })
                .timeout(3000)
                .end((err: Error | null, res: request.Response) => {
                    connectionDiagnostics.record('session_check_response', { ...trace, ...httpEvidence(err, res), durationMs: Date.now() - startedAt });
                    resolve(_getResult(err, res));
                });
        });
        if (result.code !== 200 || !result.data || typeof (result.data as { status?: unknown }).status !== 'string') {
            // Never print the request error: it can contain a token in the URL.
            throw new Error(`Existing machine session could not be verified (${result.code || 'transport error'}). No pairing was attempted. Reconnect through Luban using its saved token.`);
        }
    }

    /** Read-only session check: NEVER call /connect or fall back to pairing. */
    public async verifyExistingSession(): Promise<void> {
        if (!this.host || !this.token?.trim() || !this.state.series) {
            throw new Error('No existing HTTP machine session is available. Reconnect through Luban using its saved machine token; MCP cannot pair a machine.');
        }
        const generation = this.connectionGeneration;
        await this.verifySession(this.host, this.token);
        if (generation !== this.connectionGeneration) {
            throw new Error('Machine session changed during recovery. Nothing was restarted.');
        }
    }

    public resumeVerifiedSession(): void {
        this.emit(ChannelEvent.Connected);
        this.emit(ChannelEvent.Ready, { machineIdentifier: this.state.series });
    }

    public async startHeartbeat(): Promise<void> {
        this.stopHeartBeat('heartbeat_restart');

        waitConfirm = true;
        const generation = this.heartbeatGeneration;
        connectionDiagnostics.startWorker(generation);
        this.heartBeatWorker = workerManager.heartBeat([{
            host: this.host,
            token: this.token
        }], (result: { status?: string; msg?: string; res?: request.Response; errorCode?: string;
            timedOut?: boolean; durationMs?: number; httpStatus?: number; reason?: string }) => {
            if (generation !== this.heartbeatGeneration) {
                return;
            }
            if (result.status === 'poll-start') {
                connectionDiagnostics.pollStarted();
                return;
            }
            if (result.status === 'poll-error') {
                connectionDiagnostics.poll({ httpStatus: result.httpStatus,
                    errorCode: result.errorCode,
                    timedOut: result.timedOut,
                    durationMs: result.durationMs }, false);
                return;
            }
            if (result.status === 'offline' || result.status === 'worker-exit') {
                connectionDiagnostics.record(result.status === 'worker-exit' ? 'heartbeat_worker_exit' : 'heartbeat_offline', {
                    reason: result.reason, errorCode: result.errorCode,
                });
                log.info('[wifi connection offline]: see connection diagnostics');
                this.clearAllInterval();
                this.stopHeartBeat(result.status);
                this.latestMachineState = null;
                this.init();
                this.emit(ChannelEvent.Disconnected);
                return;
            }
            const { data, code } = _getResult(null, result.res);
            const accepted = code === 200 && typeof data?.status === 'string';
            connectionDiagnostics.poll({ ...httpEvidence(null, result.res), durationMs: result.durationMs }, accepted);

            // Only the controller's 204 response denotes authentication-wait. A malformed
            // or failed status must not be presented as evidence of a touchscreen prompt.
            if (!accepted) {
                this.emit(ChannelEvent.Connecting, {
                    requireAuth: code === 204,
                });
                return;
            }

            const state = {
                ...data,
                ...this.state,
                gcodePrintingInfo: this.getGcodePrintingInfo(data),
                isHomed: data?.homed,
                status: data.status.toLowerCase(),
                airPurifier: !isNil(data.airPurifierSwitch),
                pos: {
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    b: data.b,
                    isFourAxis: !isNil(data.b)
                },
                originOffset: {
                    x: data.offsetX,
                    y: data.offsetY,
                    z: data.offsetZ,
                }
            };
            this.latestMachineState = { ...state, timestamp: Date.now() };
            if (waitConfirm) {
                waitConfirm = false;

                this.socket && this.socket.emit('connection:connected', {
                    state,
                    err: data?.err,
                    type: ConnectionType.WiFi,
                });
            } else {
                // this.socket && this.socket.emit('sender:status', {
                //     data: this.getGcodePrintingInfo(state)
                // });
                this.socket && this.socket.emit('Marlin:state', {
                    state,
                    type: ConnectionType.WiFi,
                });
            }
        });

        return Promise.resolve();
    }

    private stopHeartBeat = (reason: string) => {
        if (this.heartBeatWorker) { connectionDiagnostics.stopWorker(reason); }
        this.heartbeatGeneration++;
        this.heartBeatWorker && this.heartBeatWorker.terminate();
        this.heartBeatWorker = null;
    };

    private _executeGcode = async (gcode: string) => {
        const api = `${this.host}/api/v1/execute_code`;
        const startedAt = Date.now();
        const { sessionId, attemptId } = connectionDiagnostics.snapshot();
        let phase = 'gcode';
        if (gcode.trim() === 'M114') { phase = 'M114'; }
        if (gcode.trim() === 'M503 S') { phase = 'M503_S'; }
        const requestId = diagnosticId();
        connectionDiagnostics.record('command_requested', { sessionId, attemptId, requestId, phase });
        return new Promise((resolve) => {
            const req = request.post(api);
            req.timeout(300000)
                .send(`token=${this.token}`)
                .send(`code=${gcode}`)
                // .send(formData)
                .end((err, res) => {
                    connectionDiagnostics.record('command_response', { ...httpEvidence(err, res),
                        requestId,
                        sessionId,
                        attemptId,
                        phase,
                        durationMs: Date.now() - startedAt });
                    // Request errors can embed credentials in their URL. Retain status/code, never the raw message.
                    const result = _getResult(err, res);
                    if (err) {
                        // Preserve the controller's refusal, not the HTTP client's
                        // generic "Bad Request". Never expose the session token or URLs.
                        let refusal = res?.text || httpEvidence(err, res).errorCode || 'transport_error';
                        if (this.token) { refusal = refusal.split(this.token).join('[redacted]'); }
                        result.msg = refusal.replace(/https?:\/\/[^\s"<>]+/g, '[controller URL]').slice(0, 500);
                        result.text = result.msg;
                    }
                    resolve(result);
                });
        });
    };

    private async consumeGCodeQueue() {
        if (this.isGcodeExecuting) {
            return;
        }
        this.isGcodeExecuting = true;

        const generation = this.connectionGeneration;
        try {
            while (this.gcodeQueue.length > 0 && generation === this.connectionGeneration) {
                const item = this.gcodeQueue.shift();
                if (!item) {
                    break;
                }
                const results = [];
                let result = 0;
                for (const command of item.gcodes) {
                    try {
                        const response = await this._executeGcode(command) as GcodeResult;
                        if (generation !== this.connectionGeneration) {
                            throw new Error('Machine connection changed during command execution.');
                        }
                        if (response.code !== 200 && response.code !== 204) {
                            throw new Error(`Controller request failed (${response.code || 'transport error'}): ${response.msg || response.text || 'No response'}`);
                        }
                        if (response.text) {
                            results.push(response.text);
                        }
                    } catch (err) {
                        result = -1;
                        results.push((err as Error).message);
                        break; // Never execute the rest of a failed batch.
                    }
                }
                item.callback({ result, text: results.join('\n') });
                if (result !== 0) {
                    // Already queued commands relied on the failed command completing.
                    // Do not cancel work belonging to a subsequent connection.
                    if (generation === this.connectionGeneration) {
                        for (const queued of this.gcodeQueue.splice(0)) {
                            queued.callback({ result: -1, text: 'Cancelled after an earlier command failed.' });
                        }
                    }
                    break;
                }
            }
        } finally {
            if (generation === this.connectionGeneration) {
                this.isGcodeExecuting = false;
            }
        }
    }

    /**
     * Generic execute G-code commands.
     */
    public async executeGcode(gcode: string): Promise<ExecuteGcodeResult> {
        const refusal = gcodeLease.refusal(gcode);
        if (refusal) { return { result: -1, text: refusal }; }
        return new Promise((resolve) => {
            // enqueue G-code execution
            const split = gcode.split('\n');
            this.gcodeQueue.push({
                gcodes: split,
                callback: ({ result, text }) => {
                    if (result === 0) {
                        resolve({
                            result: 0,
                            text,
                        });
                    } else {
                        resolve({
                            result: -1,
                            text,
                        });
                    }
                }
            });

            // consume
            this.consumeGCodeQueue();
        });
    }

    // interface: FileChannelInterface

    public async uploadFile(options: UploadFileOptions): Promise<boolean> {
        const { filePath, targetFilename } = options;
        log.info(`Upload file to controller... ${filePath}`);

        return new Promise((resolve) => {
            const api = `${this.host}/api/v1/upload`;
            request
                .post(api)
                .timeout(300000)
                .field('token', this.token)
                .attach('file', filePath, { filename: targetFilename })
                .end((err) => {
                    resolve(!err);
                });
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async compressUploadFile(options: UploadFileOptions): Promise<boolean> {
        return false;
    }

    // interface: LaserChannelInterface

    public async turnOnTestLaser(): Promise<boolean> {
        if (includes([L20WLaserToolModule.identifier, L40WLaserToolModule.identifier], this.state.toolHead)) {
            const executeResult = await this.executeGcode('M3 P0.2');
            return executeResult.result === 0;
        } else {
            const executeResult = await this.executeGcode('M3 P1 S2.55');
            return executeResult.result === 0;
        }
    }

    public async turnOnCrosshair(): Promise<boolean> {
        const executeResult = await this.executeGcode('M2002 T3 P1');
        return (executeResult.result === 0);
    }

    public async turnOffCrosshair(): Promise<boolean> {
        const executeResult = await this.executeGcode('M2002 T3 P0');
        return (executeResult.result === 0);
    }

    public async getCrosshairOffset(): Promise<{ x: number; y: number; }> {
        return { x: 0, y: 0 };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async setCrosshairOffset(x: number, y: number): Promise<boolean> {
        return false;
    }

    public async getFireSensorSensitivity(): Promise<number> {
        return 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async setFireSensorSensitivity(sensitivity: number): Promise<boolean> {
        return false;
    }

    // interface: CncChannelInterface

    public async setSpindleSpeed(speed: number): Promise<boolean> {
        // on and off to set speed
        let executeResult: ExecuteGcodeResult = null;

        executeResult = await this.executeGcode(`M3 S${speed} C`);
        if (executeResult.result !== 0) return false;

        // executeResult = await this.executeGcode('M5');
        // if (executeResult.result !== 0) return false;

        return true;
    }

    public async setSpindleSpeedPercentage(percent: number): Promise<boolean> {
        // on and off to set speed
        let executeResult: ExecuteGcodeResult = null;

        executeResult = await this.executeGcode(`M3 P${percent}`);
        if (executeResult.result !== 0) return false;

        executeResult = await this.executeGcode('M5');
        if (executeResult.result !== 0) return false;

        return true;
    }

    public async spindleOn(): Promise<boolean> {
        const executeResult = await this.executeGcode('M3');
        return executeResult.result === 0;
    }

    public async spindleOff(): Promise<boolean> {
        const executeResult = await this.executeGcode('M5');
        return executeResult.result === 0;
    }

    /**
     * Get module list.
     */
    public getModuleList = () => {
        log.info('Get Module List...');

        request
            .get(`${this.host}/api/v1/module_list?token=${this.token}`)
            .timeout(1000)
            .end((err, res) => {
                const result = _getResult(err, res);
                const data = result?.data;
                if (!err) {
                    this.socket && this.socket.emit('machine:module-list', {
                        moduleList: data.moduleList || [],
                    });
                }
            });
    };

    /**
     * Get module info.
     */
    public getModuleInfo = () => {
        request
            .get(`${this.host}/api/v1/module_info?token=${this.token}`)
            .timeout(1000)
            .end((err, res) => {
                const result = _getResult(err, res);
                const data = result?.data;
                if (!err) {
                    this.socket && this.socket.emit('machine:module-info', {
                        moduleInfo: data.moduleInfo || [],
                    });
                }
            });
    };

    public startGcode = (options: EventOptions) => {
        log.info('Starting print...');
        const { eventName } = options;
        const refusal = gcodeLease.refusal('start job');
        if (refusal) { this.socket && this.socket.emit(eventName, { msg: refusal, code: 409, text: refusal }); return; }
        const api = `${this.host}/api/v1/start_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                const result = _getResult(err, res) || {};
                log.info('Print job started.');
                this.socket && this.socket.emit(eventName, result);
            });
    };

    /**
     * Promise variants of startGcode/stopGcode for callers that need the
     * result rather than a socket emit (MCP job gate).
     */
    public async startGcodeJob(): Promise<{ ok: boolean; code?: number; text?: string }> {
        const refusal = gcodeLease.refusal('start job');
        if (refusal) { return { ok: false, code: 409, text: refusal }; }
        const api = `${this.host}/api/v1/start_print`;
        return new Promise((resolve) => {
            request
                .post(api)
                .timeout(120000)
                .send(`token=${this.token}`)
                .end((err, res) => {
                    const { code, text, msg } = _getResult(err, res) || {};
                    resolve({ ok: !err, code, text: text || msg });
                });
        });
    }

    public async stopGcodeJob(): Promise<{ ok: boolean; code?: number; text?: string }> {
        const api = `${this.host}/api/v1/stop_print`;
        return new Promise((resolve) => {
            request
                .post(api)
                .timeout(120000)
                .send(`token=${this.token}`)
                .end((err, res) => {
                    const { code, text, msg } = _getResult(err, res) || {};
                    resolve({ ok: !err, code, text: text || msg });
                });
        });
    }

    public resumeGcode = (options: EventOptions) => {
        const { eventName } = options;
        const refusal = gcodeLease.refusal('resume job');
        if (refusal) { this.socket && this.socket.emit(eventName, { msg: refusal, code: 409, text: refusal }); return; }
        const api = `${this.host}/api/v1/resume_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public pauseGcode = (options: EventOptions) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/pause_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public stopGcode = (options: EventOptions) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/stop_print`;
        request
            .post(api)
            .timeout(120000)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    private getGcodePrintingInfo(data) {
        if (!data) {
            return {};
        }
        const { currentLine, estimatedTime, totalLines, fileName = '', progress, elapsedTime, remainingTime, printStatus } = data;
        if (!currentLine || !estimatedTime || !totalLines) {
            return {};
        }
        const sent = currentLine || 0;
        const received = currentLine || 0;
        const total = totalLines || 0;
        let finishTime = 0;
        if (received > 0 && received >= totalLines) {
            finishTime = new Date().getTime();
        }
        return {
            sent,
            received,
            total,
            finishTime,
            estimatedTime: estimatedTime * 1000,
            elapsedTime: elapsedTime * 1000,
            remainingTime: remainingTime * 1000,
            name: fileName,
            progress,
            printStatus
        };
    }

    public uploadGcodeFile = (gcodeFilePath: string, type: string, renderName: string, callback) => {
        log.info('Preparing for a print job...');

        const api = `${this.host}/api/v1/prepare_print`;
        if (type === HEAD_PRINTING) {
            type = '3DP';
        } else if (type === HEAD_LASER) {
            type = 'Laser';
        } else if (type === HEAD_CNC) {
            type = 'CNC';
        }

        request
            .post(api)
            .field('token', this.token)
            .field('type', type)
            .attach('file', gcodeFilePath, { filename: renderName })
            .end((err, res) => {
                const { msg, data, text } = _getResult(err, res);

                log.info(`File upload: ${text}.`);
                if (callback) {
                    callback(msg, data);
                }
            });
    };

    public abortLaserMaterialThickness = () => {
        this.getLaserMaterialThicknessReq && this.getLaserMaterialThicknessReq.abort();
    };

    public getLaserMaterialThickness = (options: EventOptions) => {
        const { x, y, feedRate, eventName } = options;
        const refusal = gcodeLease.refusal('laser material thickness probe');
        if (refusal) { this.socket && this.socket.emit(eventName, { msg: refusal, code: 409, text: refusal }); return; }
        const api = `${this.host}/api/request_Laser_Material_Thickness?token=${this.token}&x=${x}&y=${y}&feedRate=${feedRate}`;
        const req = request.get(api);
        this.getLaserMaterialThicknessReq = req;
        req.end((err, res) => {
            this.socket && this.socket.emit(eventName, _getResult(err, res));
        });
    };

    public getGcodeFile = (options: EventOptions) => {
        const { eventName } = options;

        const api = `${this.host}/api/v1/print_file?token=${this.token}`;
        request
            .get(api)
            .end((err, res) => {
                if (err) {
                    this.socket && this.socket.emit(eventName, {
                        msg: err?.message,
                        text: res.text
                    });
                } else {
                    let gcodeStr = '';
                    res.on('data', (chunk) => {
                        gcodeStr += chunk;
                    });
                    res.once('end', () => {
                        this.socket && this.socket.emit(eventName, {
                            msg: err?.message,
                            text: gcodeStr
                        });
                    });
                    res.once('error', (error) => {
                        this.socket && this.socket.emit(eventName, {
                            msg: error?.message,
                            text: ''
                        });
                    });
                }
            });
    };

    public getActiveExtruder = (options) => {
        const { eventName } = options;
        const api = `${this.host}/api/v1/active_extruder?token=${this.token}`;
        request
            .get(api)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateActiveExtruder = ({ extruderIndex, eventName }) => {
        const api = `${this.host}/api/v1/switch_extruder`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`active=${extruderIndex}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateNozzleTemperature = (options: EventOptions) => {
        const { nozzleTemperatureValue, eventName } = options;
        const api = `${this.host}/api/v1/override_nozzle_temperature`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`nozzleTemp=${nozzleTemperatureValue}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateBedTemperature = (options: EventOptions) => {
        const { heatedBedTemperatureValue, eventName } = options;
        const api = `${this.host}/api/v1/override_bed_temperature`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`heatedBedTemp=${heatedBedTemperatureValue}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateZOffset = (options: EventOptions) => {
        const { zOffset, eventName } = options;
        const refusal = gcodeLease.refusal('override Z offset');
        if (refusal) { this.socket && this.socket.emit(eventName, { msg: refusal, code: 409, text: refusal }); return; }
        const api = `${this.host}/api/v1/override_z_offset`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`zOffset=${zOffset}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public loadFilament = (options: EventOptions, eventName: string) => {
        const refusal = gcodeLease.refusal('load filament');
        if (refusal) { this.socket && this.socket.emit(eventName, { msg: refusal, code: 409, text: refusal }); return; }
        const api = `${this.host}/api/v1/filament_load`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public unloadFilament = (options: EventOptions) => {
        const { eventName } = options;
        const refusal = gcodeLease.refusal('unload filament');
        if (refusal) { this.socket && this.socket.emit(eventName, { msg: refusal, code: 409, text: refusal }); return; }
        const api = `${this.host}/api/v1/filament_unload`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateWorkSpeedFactor = (options: EventOptions) => {
        const { eventName, workSpeedValue } = options;
        const refusal = gcodeLease.refusal('override work speed');
        if (refusal) { this.socket && this.socket.emit(eventName, { msg: refusal, code: 409, text: refusal }); return; }
        const api = `${this.host}/api/v1/override_work_speed`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`workSpeed=${workSpeedValue}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public updateLaserPower = (options: EventOptions) => {
        const { eventName, laserPower } = options;
        const refusal = gcodeLease.refusal('override laser power');
        if (refusal) { this.socket && this.socket.emit(eventName, { msg: refusal, code: 409, text: refusal }); return; }
        const api = `${this.host}/api/v1/override_laser_power`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`laserPower=${laserPower}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public getEnclosureStatus = () => {
        const api = `${this.host}/api/v1/enclosure?token=${this.token}`;
        request
            .get(api)
            .end((err, res) => {
                const currentModuleStatus = _getResult(err, res)?.data;
                if (!isEqual(this.moduleSettings, currentModuleStatus)) {
                    this.moduleSettings = currentModuleStatus;
                    this.socket && this.socket.emit('Marlin:settings', {
                        settings: {
                            enclosureDoorDetection: currentModuleStatus?.isDoorEnabled,
                            enclosureOnline: currentModuleStatus?.isReady,
                            enclosureFan: currentModuleStatus?.fan,
                            enclosureLight: currentModuleStatus?.led,
                        }
                    });
                }
            });
    };

    public setEnclosureLight = (options: EventOptions) => {
        const { eventName, value } = options;
        const api = `${this.host}/api/v1/enclosure`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`led=${value}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public setEnclosureFan = (options: EventOptions) => {
        const { eventName, value } = options;
        const api = `${this.host}/api/v1/enclosure`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`fan=${value}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public setDoorDetection = (options: EventOptions) => {
        const { eventName, enable } = options;
        const api = `${this.host}/api/v1/enclosure`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`isDoorEnabled=${enable}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public setFilterSwitch = (options: EventOptions) => {
        const { eventName, enable } = options;
        const api = `${this.host}/api/v1/air_purifier_switch`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`switch=${enable}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public setFilterWorkSpeed = (options: EventOptions) => {
        const { eventName, value } = options;
        const api = `${this.host}/api/v1/air_purifier_fan_speed`;
        request
            .post(api)
            .send(`token=${this.token}`)
            .send(`fan_speed=${value}`)
            .end((err, res) => {
                this.socket && this.socket.emit(eventName, _getResult(err, res));
            });
    };

    public wifiStatusTest = (options: EventOptions) => {
        const { host } = options;
        const api = `${host}/api/v1/status`;
        log.info(`the test api is: ${api}`);

        const apiTest = (count) => {
            if (count <= 0) {
                return;
            }
            setTimeout(() => {
                const time = new Date().getTime();
                request
                    .get(api)
                    .timeout(3000)
                    .end(() => {
                        const costTime = (new Date().getTime() - time);
                        log.info(`the test api time is: ${costTime} ms`);
                        apiTest(count - 1);
                    });
            }, 1000);
        };

        apiTest(5);
    }
}

const channel = new SstpHttpChannel();

export {
    channel as sstpHttpChannel
};

export default SstpHttpChannel;
