import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import includes from 'lodash/includes';
import noop from 'lodash/noop';
import semver from 'semver';
import SerialConnection from '../../lib/SerialConnection';
import interpret from '../../lib/interpret';
import EventTrigger from '../../lib/EventTrigger';
import Feeder from '../../lib/Feeder';
import Sender, { SP_TYPE_SEND_RESPONSE } from '../../lib/Sender';
import Workflow, {
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_RUNNING
} from '../../lib/Workflow';
import { ensureRange } from '../../lib/numeric-utils';
import ensureArray from '../../lib/ensure-array';
import ensurePositiveNumber from '../../lib/ensure-positive-number';
import evaluateExpression from '../../lib/evaluateExpression';
import logger from '../../lib/logger';
import translateWithContext from '../../lib/translateWithContext';
import monitor from '../../services/monitor';
import taskRunner from '../../services/taskrunner';
import store from '../../store';
import Marlin from './Marlin';
import {
    MARLIN,
    QUERY_TYPE_POSITION,
    QUERY_TYPE_ORIGIN_OFFSET,
    QUERY_TYPE_TEMPERATURE,
    WRITE_SOURCE_CLIENT,
    WRITE_SOURCE_FEEDER,
    WRITE_SOURCE_SENDER,
    WRITE_SOURCE_QUERY,
    WRITE_SOURCE_UNKNOWN,
    HEAD_TYPE_3DP, QUERY_TYPE_ENCLOSURE
} from '../constants';

// % commands
const WAIT = '%wait';

const log = logger('controller:Marlin');

class MarlinController {
    type = MARLIN;

    // Connections
    connections = {};

    // SerialPort
    options = {
        port: '',
        baudRate: 115200,
        connectionTimeout: 3000
    };

    serialport = null;

    serialportListener = {
        data: (data) => {
            if (this.controller.state.hexModeEnabled) {
                this.emitAll('transfer:hex', { data: Buffer.from(data, 'utf-8') });
            }
            log.silly(`< ${data}`);
            this.controller.parse(String(data));
        },
        close: (err) => {
            this.ready = false;
            if (err) {
                log.warn(`Disconnected from serial port "${this.options.port}":`, err);
            }

            this.close();
        },
        error: (err) => {
            this.ready = false;
            if (err) {
                log.error(`Unexpected error while reading/writing serial port "${this.options.port}":`, err);
            }
        }
    };

    // Marlin
    controller = null;

    ready = false;

    state = {};

    settings = {};

    queryTimer = null;

    history = {
        // This write source is one of the following
        // * WRITE_SOURCE_CLIENT
        // * WRITE_SOURCE_FEEDER
        // * WRITE_SOURCE_SENDER
        // * WRITE_SOURCE_QUERY
        writeSource: null,
        writeLine: ''
    };

    // Event Trigger
    event = null;

    // Feeder
    feeder = null;

    // Sender
    sender = null;

    senderFinishTime = 0;

    // Workflow
    workflow = null;

    // start handler(timer)
    handler = null;

    query = {
        // state
        type: null,
        lastQueryTime: 0,

        issue: () => {
            if (!this.query.type) {
                return;
            }

            const now = new Date().getTime();
            if (this.query.type === QUERY_TYPE_POSITION) {
                this.writeln('M114');
                this.lastQueryTime = now;
            } else if (this.query.type === QUERY_TYPE_TEMPERATURE) {
                this.writeln('M105');
                this.lastQueryTime = now;
            } else if (this.query.type === QUERY_TYPE_ENCLOSURE) {
                this.writeln('M1010');
            } else if (this.query.type === QUERY_TYPE_ORIGIN_OFFSET) {
                this.writeln('M1007');
            } else {
                log.error('Unsupported query type: ', this.query.type);
            }
            this.query.type = null;
        }
    };


    queryState = (() => {
        let index = 0;
        const typeOf3dp = [QUERY_TYPE_POSITION, QUERY_TYPE_TEMPERATURE, QUERY_TYPE_ENCLOSURE];
        const type = [QUERY_TYPE_POSITION, QUERY_TYPE_ORIGIN_OFFSET, QUERY_TYPE_ENCLOSURE];

        return () => {
            if (!this.ready) {
                return;
            }
            if (!this.query.type) {
                if (this.state.headType === HEAD_TYPE_3DP) {
                    this.query.type = typeOf3dp[index++ % typeOf3dp.length];
                } else {
                    this.query.type = type[index++ % type.length];
                }
            }
        };
    })();


    dataFilter = (line, context) => {
        // Current position
        const {
            x: posx,
            y: posy,
            z: posz,
            e: pose
        } = this.controller.getPosition();
        // modal
        const modal = this.controller.getModal();

        // The context contains the bounding box and current position
        Object.assign(context || {}, {
            // modal
            modal: {
                motion: modal.motion,
                units: modal.units,
                distance: modal.distance,
                feedrate: modal.feedrate,
                spindle: modal.spindle
            },
            // Bounding box
            xmin: Number(context.xmin) || 0,
            xmax: Number(context.xmax) || 0,
            ymin: Number(context.ymin) || 0,
            ymax: Number(context.ymax) || 0,
            zmin: Number(context.zmin) || 0,
            zmax: Number(context.zmax) || 0,
            // Current position
            posx: Number(posx) || 0,
            posy: Number(posy) || 0,
            posz: Number(posz) || 0,
            pose: Number(pose) || 0
        });

        // Evaluate expression
        if (line[0] === '%') {
            // line="%_x=posx,_y=posy,_z=posz"
            evaluateExpression(line.slice(1), context);
            return '';
        }

        // line="G0 X[posx - 8] Y[ymax]"
        // > "G0 X2 Y50"
        return translateWithContext(line, context);
    };

    constructor(options) {
        const { port, dataSource, baudRate, connectionTimeout = 3000 } = options;

        this.options = {
            ...this.options,
            port,
            dataSource,
            baudRate,
            connectionTimeout
        };
        // Event Trigger
        this.event = new EventTrigger((event, trigger, commands) => {
            log.debug(`EventTrigger: event="${event}", trigger="${trigger}", commands="${commands}"`);
            if (trigger === 'system') {
                taskRunner.run(commands);
            } else {
                this.command(null, 'gcode', commands);
            }
        });

        // Feeder
        this.feeder = new Feeder({
            dataFilter: (line, context) => {
                if (line === WAIT) {
                    // G4 [P<time in ms>] [S<time in sec>]
                    // If both S and P are included, S takes precedence.
                    return `G4 P500 (${WAIT})`; // dwell
                }
                return this.dataFilter(line, context);
            }
        });
        this.feeder.on('data', (line = '', context = {}) => {
            if (!this.isOpen()) {
                log.error(`Serial port "${this.options.port}" is not accessible`);
                return;
            }

            line = String(line).trim();
            if (line.length === 0) {
                return;
            }

            // this.emitAll('serialport:write', line, context);
            this.emitAll('serialport:write', { data: line, context });
            this.writeln(line, {
                ...context,
                source: WRITE_SOURCE_FEEDER
            });
            log.silly(`> ${line}`);
        });

        // Sender
        this.sender = new Sender(SP_TYPE_SEND_RESPONSE, {
            dataFilter: (line, context) => {
                if (line === WAIT) {
                    const { sent, received } = this.sender.state;
                    log.debug(`Wait for the planner queue to empty: line=${sent + 1}, sent=${sent}, received=${received}`);

                    this.sender.hold();

                    // G4 [P<time in ms>] [S<time in sec>]
                    // If both S and P are included, S takes precedence.
                    return `G4 P500 (${WAIT})`; // dwell
                }

                return this.dataFilter(line, context);
            },
            queueSize: 1
        });
        this.sender.on('data', (line = '') => {
            if (!this.isOpen()) {
                log.error(`Serial port "${this.options.port}" is not accessible`);
                return;
            }

            if (this.workflow.state !== WORKFLOW_STATE_RUNNING) {
                log.error(`Unexpected workflow state: ${this.workflow.state}`);
                return;
            }

            line = String(line).trim();
            if (line.length === 0) {
                log.warn(`Expected non-empty line: N=${this.sender.state.sent}`);
                return;
            }

            this.writeln(line, {
                // ...context,
                source: WRITE_SOURCE_SENDER
            });
            log.silly(`> ${line}`);
        });
        this.sender.on('hold', noop);
        this.sender.on('unhold', noop);
        this.sender.on('start', () => {
            this.senderFinishTime = 0;
        });
        this.sender.on('end', (finishTime) => {
            this.senderFinishTime = finishTime;

            // Received all response, manually call stop
            this.command(null, 'gcode:stop');
        });

        // Workflow
        this.workflow = new Workflow();
        this.workflow.on('start', () => {
            // this.emitAll('workflow:state', this.workflow.state);
            this.emitAll('workflow:state', { workflowState: this.workflow.state });
            this.sender.rewind();
        });
        this.workflow.on('stop', () => {
            // this.emitAll('workflow:state', this.workflow.state);
            this.emitAll('workflow:state', { workflowState: this.workflow.state });
            this.sender.rewind();
        });
        this.workflow.on('pause', () => {
            // this.emitAll('workflow:state', this.workflow.state);
            this.emitAll('workflow:state', { workflowState: this.workflow.state });
        });
        this.workflow.on('resume', () => {
            // this.emitAll('workflow:state', this.workflow.state);
            this.emitAll('workflow:state', { workflowState: this.workflow.state });
            this.sender.next();
        });

        // Marlin
        this.controller = new Marlin();

        this.controller.on('firmware', (res) => {
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('series', (res) => {
            log.silly(`controller.on('series'): source=${this.history.writeSource},
                 line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('home', (res) => {
            log.silly(`controller.on('home'): source=${this.history.writeSource},
                 line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('originOffset', (res) => {
            // log.silly(`controller.on('originOffset'): source=${this.history.writeSource},
            //      line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('headStatus', (res) => {
            // log.silly(`controller.on('originOffset'): source=${this.history.writeSource},
            //      line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('focusHeight', (res) => {
            // log.silly(`controller.on('originOffset'): source=${this.history.writeSource},
            //      line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('headPower', (res) => {
            // log.silly(`controller.on('originOffset'): source=${this.history.writeSource},
            //      line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('headType', (res) => {
            log.silly(`controller.on('headType'): source=${this.history.writeSource},
                 line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('pos', (res) => {
            log.silly(`controller.on('pos'): source=${this.history.writeSource}, line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('temperature', (res) => {
            if (!this.ready) {
                this.ready = true;
                this.emitAll('serialport:connected', { state: this.controller.state });
            }
            log.silly(`controller.on('temperature'): source=${this.history.writeSource},
                line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER, WRITE_SOURCE_SENDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('enclosure', (res) => {
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('selected', (res) => {
            if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });
            }
        });
        this.controller.on('cnc:stop', (res) => {
            log.warn(`controller.on('cnc:stop'): source=${this.history.writeSource}, res=${JSON.stringify(res)}`);

            // The enclosure door opened when CNC printing;
            this.command(null, 'gcode:stop');

            setTimeout(() => {
                this.writeln('M1010 S2');
            }, 1000);
        });
        this.controller.on('ok', (res) => {
            log.silly(`controller.on('ok'): source=${this.history.writeSource}, line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            // Display info to console, if this is from user-input
            if (res) {
                if (includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                    // this.emitAll('serialport:read', res.raw);
                    this.emitAll('serialport:read', { data: res.raw });
                } else if (!this.history.writeSource) {
                    // this.emitAll('serialport:read', res.raw);
                    // this.emitAll('serialport:read', { data: res.raw });
                    // log.error('"history.writeSource" should NOT be empty');
                }
            }

            // FIXME: writeSource should not set to null when sending multiple queries at once while not receive all 'ok'
            this.history.writeSource = null;
            this.history.writeLine = null;

            // Perform preemptive query to prevent starvation
            const now = new Date().getTime();
            const timespan = Math.abs(now - this.query.lastQueryTime);
            if (this.query.type && timespan > 2000) {
                this.query.issue();
                return;
            }

            // Feeder
            if (this.feeder.next()) {
                return;
            }

            // Sender
            if (this.workflow.state === WORKFLOW_STATE_RUNNING) {
                // Check hold state
                if (this.sender.state.hold) {
                    const { sent, received } = this.sender.state;
                    if (received + 1 >= sent) {
                        log.debug(`Continue sending G-code: sent=${sent}, received=${received}`);
                        this.sender.unhold();
                    }
                }
                this.sender.ack();
                this.sender.multipleNext();
                return;
            }
            if (this.workflow.state === WORKFLOW_STATE_PAUSED) {
                const { sent, received } = this.sender.state;
                if (sent > received) {
                    this.sender.ack();
                    return;
                }
            }
            this.query.issue();
        });

        this.controller.on('echo', (res) => {
            // this.emitAll('serialport:read', res.raw);
            this.emitAll('serialport:read', { data: res.raw });
        });

        this.controller.on('error', (res) => {
            // Feeder
            this.feeder.next();

            // Sender
            if (this.workflow.state === WORKFLOW_STATE_RUNNING) {
                const { lines, received } = this.sender.state;
                const line = lines[received] || '';

                // this.emitAll('serialport:read', `> ${line.trim()} (line=${received + 1})`);
                this.emitAll('serialport:read', { data: `> ${line.trim()} (line=${received + 1})` });
                // this.emitAll('serialport:read', res.raw);
                this.emitAll('serialport:read', { data: res.raw });

                this.sender.ack();
                this.sender.next();
                return;
            }

            // this.emitAll('serialport:read', res.raw);
            this.emitAll('serialport:read', { data: res.raw });
        });

        this.controller.on('others', (res) => {
            if (res.raw !== 'wait') {
                // this.emitAll('serialport:read', `others < ${res.raw}`);
                this.emitAll('serialport:read', { data: `others < ${res.raw}` });
                log.error('Can\'t parse result', res.raw);
            }
        });

        this.queryTimer = setInterval(() => {
            if (!this.isOpen()) {
                // Serial port is closed
                return;
            }

            // Feeder
            if (this.feeder.peek()) {
                // this.emitAll('feeder:status', this.feeder.toJSON());
                this.emitAll('feeder:status', { data: this.feeder.toJSON() });
            }

            // Sender
            if (this.sender.peek()) {
                // this.emitAll('sender:status', this.sender.toJSON());
                this.emitAll('sender:status', { data: this.sender.toJSON() });
            }

            const zeroOffset = isEqual(
                this.controller.getPosition(this.state),
                this.controller.getPosition(this.controller.state)
            );

            // Marlin state
            if (this.controller.state) {
                this.state = this.controller.state;
                // this.emitAll('Marlin:state', this.state);
                this.emitAll('Marlin:state', { state: this.state });
            }

            // Marlin settings

            if (this.settings !== this.controller.settings) {
                this.settings = this.controller.settings;
                this.emitAll('Marlin:settings', { settings: this.settings });
            }

            // Wait for the bootloader to complete before sending commands
            if (!(this.ready)) {
                // Not ready yet
                return;
            }

            // this.queryPosition();
            // // M114 - Get Current Position
            // if (this.state.headType === HEAD_TYPE_3DP) {
            //     this.queryTemperature();
            // }
            this.queryState();

            {
                // The following criteria must be met to issue a query(kickoff)
                const notBusy = !(this.history.writeSource);
                const senderIdle = (this.sender.state.sent === this.sender.state.received);
                const feederEmpty = (this.feeder.size() === 0);

                if (notBusy && senderIdle && feederEmpty) {
                    this.query.issue();
                }
            }
            // Check if the machine has stopped movement after completion
            if (this.senderFinishTime > 0) {
                const machineIdle = zeroOffset;
                const now = new Date().getTime();
                const timespan = Math.abs(now - this.senderFinishTime);
                const toleranceTime = 500; // in milliseconds
                if (!machineIdle) {
                    // Extend the sender finish time
                    this.senderFinishTime = now;
                } else if (timespan > toleranceTime) {
                    log.silly(`Finished sending G-code: timespan=${timespan}`);
                    this.senderFinishTime = 0;
                    // Stop workflow
                    this.command(null, 'gcode:stop');
                }
            }
        }, 1000);
    }

    destroy() {
        this.connections = {};

        if (this.serialport) {
            this.serialport = null;
        }

        if (this.event) {
            this.event = null;
        }

        if (this.feeder) {
            this.feeder = null;
        }

        if (this.sender) {
            this.sender = null;
        }

        if (this.workflow) {
            this.workflow = null;
        }

        if (this.queryTimer) {
            clearInterval(this.queryTimer);
            this.queryTimer = null;
        }

        if (this.controller) {
            this.controller.removeAllListeners();
            this.controller = null;
        }
    }

    get status() {
        return {
            port: this.options.port,
            baudrate: this.options.baudRate,
            connections: Object.keys(this.connections),
            ready: this.ready,
            controller: {
                type: this.type,
                state: this.state,
                settings: this.settings
            },
            workflowState: this.workflow.state,
            feeder: this.feeder.toJSON(),
            sender: this.sender.toJSON()
        };
    }

    open(callback = noop, connectionTimeout = this.options.connectionTimeout) {
        const { port, dataSource } = this.options;

        // Assertion check
        if (this.serialport && this.serialport.isOpen()) {
            log.error(`Cannot open serial port "${port}/${dataSource}"`);
            return;
        }
        this.serialport = new SerialConnection({
            ...this.options,
            isScreenProtocol: false,
            writeFilter: (data, context) => {
                const { source = null } = { ...context };
                const line = data.trim();


                // TODO source
                // update write history
                // this.history.writeSource = source;
                if (source) {
                    this.history.writeSource = source;
                } else {
                    this.history.writeSource = WRITE_SOURCE_UNKNOWN;
                }
                this.history.writeLine = line;

                if (!line) {
                    return data;
                }

                let { jogSpeed, workSpeed, headStatus, headPower } = { ...this.controller.state };
                const modal = { ...this.controller.state.modal };
                let spindle = 0;

                interpret(line, (cmd, params) => {
                    // motion
                    if (includes(['G0', 'G1'], cmd)) {
                        modal.motion = cmd;
                    }
                    // units
                    if (includes(['G20', 'G21'], cmd)) {
                        // G20: Inches, G21: Millimeters
                        modal.units = cmd;
                    }
                    // distance
                    if (includes(['G90', 'G91'], cmd)) {
                        // G90: Absolute, G91: Relative
                        modal.distance = cmd;
                    }
                    // feedrate mode
                    if (includes(['G93', 'G94'], cmd)) {
                        // G93: Inverse time mode, G94: Units per minute
                        modal.feedrate = cmd;
                    }
                    // spindle or head
                    if (includes(['M3', 'M4', 'M5'], cmd)) {
                        // M3: Spindle (cw), M4: Spindle (ccw), M5: Spindle off
                        modal.spindle = cmd;

                        if (cmd === 'M3' || cmd === 'M4') {
                            if (params.S !== undefined) {
                                spindle = params.S;
                            }
                        }
                    }
                    if (cmd === 'G0' && params.F) {
                        jogSpeed = params.F;
                    }
                    if (cmd === 'G1' && params.F) {
                        workSpeed = params.F;
                    }
                    if (cmd === 'M3') {
                        headStatus = true;
                        if (params.P !== undefined) {
                            headPower = params.P;
                            headPower = ensureRange(headPower, 0, 100);
                        } else if (params.S !== undefined) {
                            // round to get executed power, convert to percentage and round again
                            headPower = Math.round(params.S) / 255.0 * 100.0;
                            headPower = ensureRange(headPower, 0, 100);
                        }
                    }
                    if (cmd === 'M5') {
                        headStatus = false;
                        // headPower = 0;
                    }
                });
                const nextState = {
                    ...this.controller.state,
                    modal,
                    spindle,
                    jogSpeed,
                    workSpeed,
                    headStatus,
                    headPower
                };
                if (!isEqual(this.controller.state, nextState)) {
                    this.controller.state = nextState; // enforce change
                }
                return data;
            }
        });

        this.serialport.on('close', this.serialportListener.close);
        this.serialport.on('error', this.serialportListener.error);
        this.serialport.on('data', this.serialportListener.data);
        this.serialport.open((err) => {
            if (err || !this.serialport.isOpen) {
                log.error(`Error opening serial port "${port}/${dataSource}":`, err);
                this.emitAll('serialport:open', { port, err });
                callback(err); // notify error
                return;
            }

            this.emitAll('serialport:open', { port });

            callback(); // register controller

            // Make sure machine is ready.
            setTimeout(() => this.writeln('M1005'));
            setTimeout(() => this.writeln('M1006'), 100);
            setTimeout(() => this.writeln('M1007'), 150);
            setTimeout(() => this.writeln('M105'), 200);

            this.handler = setInterval(() => {
                // Set ready flag to true when receiving a start message
                if (this.handler && this.ready) {
                    clearInterval(this.handler);
                    return;
                }

                // send M1005 to get firmware version (only support versions >= '2.2')
                setTimeout(() => this.writeln('M1005'));
                setTimeout(() => this.writeln('M1006'), 100);
                setTimeout(() => this.writeln('M1007'), 150);
                setTimeout(() => this.writeln('M105'), 200);

                setTimeout(() => {
                    if (this.handler && !this.ready) {
                        log.error('this machine is not ready');
                        clearInterval(this.handler);
                        this.emitAll('serialport:connected', { err: 'this machine is not ready' });
                        this.close();
                    }
                }, connectionTimeout - 1000);
            }, 1000);

            log.debug(`Connected to serial port "${port}/${dataSource}"`);

            this.workflow.stop();

            // Clear action values
            this.senderFinishTime = 0;

            if (this.sender.state.gcode) {
                // Unload G-code
                this.command(null, 'unload');
            }
        });
    }

    close() {
        const { port, dataSource } = this.options;

        if (this.handler) {
            clearInterval(this.handler);
        }

        // Assertion check
        if (!this.serialport) {
            log.error(`Serial port "${port}/${dataSource}" is not available`);
            return;
        }

        // Stop status query
        this.ready = false;

        // this.emitAll('serialport:close', { port });
        // store.unset(`controllers["${port}"]`);
        this.emitAll('serialport:close', { port });
        store.unset(`controllers["${port}/${dataSource}"]`);

        if (this.isOpen()) {
            this.serialport.removeListener('close', this.serialportListener.close);
            this.serialport.removeListener('error', this.serialportListener.error);
            this.serialport.close((err) => {
                if (err) {
                    log.error(`Error closing serial port "${port}/${dataSource}":`, err);
                }
            });
        }

        this.destroy();
    }

    isOpen() {
        return this.serialport && this.serialport.isOpen;
    }

    addConnection(socket) {
        if (!socket) {
            log.error('The socket parameter is not specified');
            return;
        }

        log.debug(`Add socket connection: id=${socket.id}`);
        this.connections[socket.id] = socket;

        //
        // Send data to newly connected client
        //
        const { dataSource } = this.options;
        if (!isEmpty(this.state)) {
            socket.emit('Marlin:state', { state: this.state, dataSource });
        }
        if (!isEmpty(this.settings)) {
            socket.emit('Marlin:settings', { settings: this.settings, dataSource });
        }
        if (this.workflow) {
            socket.emit('workflow:state', { workflowState: this.workflow.state, dataSource });
        }
        if (this.sender) {
            socket.emit('sender:status', { data: this.sender.toJSON(), dataSource });
        }
    }

    removeConnection(socket) {
        if (!socket) {
            log.error('The socket parameter is not specified');
            return;
        }

        log.debug(`Remove socket connection: id=${socket.id}`);
        this.connections[socket.id] = undefined;
        delete this.connections[socket.id];
    }

    refresh(options) {
        const { isScreenProtocol } = options;
        this.serialport.refresh(options);
        const nextState = {
            ...this.controller.state,
            isScreenProtocol
        };
        setTimeout(() => {
            // need to activate after refresh
            if (!isEqual(this.controller.state, nextState)) {
                this.controller.state = nextState;
            }
            this.writeln('M114');
        }, 500);
    }

    emitAll(eventName, options) {
        Object.keys(this.connections).forEach(id => {
            const socket = this.connections[id];
            socket.emit(eventName, { ...options, dataSource: this.options.dataSource });
        });
    }

    command(socket, cmd, ...args) {
        const handler = {
            'gcode:load': () => {
                const [name, originalGcode, callback = noop] = args;

                // G4 P0 or P with a very small value will empty the planner queue and then
                // respond with an ok when the dwell is complete. At that instant, there will
                // be no queued motions, as long as no more commands were sent after the G4.
                // This is the fastest way to do it without having to check the status reports.
                const dwell = '%wait ; Wait for the planner queue to empty';
                const gcode = `${originalGcode}\n${dwell}`;

                const ok = this.sender.load(name, gcode);
                if (!ok) {
                    callback(new Error(`Invalid G-code: name=${name}`));
                    return;
                }

                this.event.trigger('gcode:load');

                log.debug(`Load G-code: name="${this.sender.state.name}", size=${this.sender.state.gcode.length}, total=${this.sender.state.total}`);

                this.workflow.stop();

                callback(null, { name, gcode });
            },
            'gcode:unload': () => {
                this.workflow.stop();

                // Sender
                this.sender.unload();

                this.event.trigger('gcode:unload');
            },
            'gcode:loadfile': () => {
                const [filename, callback = noop] = args;
                this.controller.gcodeFile = filename;
                callback(null, { filename });
            },
            'updatefile': () => {
                const [filename, callback = noop] = args;
                this.controller.updateFile = filename;
                callback(null, { filename });
            },
            'gcode:start': () => {
                this.event.trigger('gcode:start');

                // lock screen when running G-code (safety concern)
                if (semver.gte(this.controller.state.version, '2.4.0')) {
                    this.writeln('M1001 L');
                }

                this.workflow.start();

                // Feeder
                this.feeder.clear();

                // Sender
                this.sender.next();
            },
            'gcode:resume': () => {
                this.event.trigger('gcode:resume');

                // lock screen when running G-code (safety concern)
                if (semver.gte(this.controller.state.version, '2.4.0')) {
                    this.writeln('M1001 L');
                }

                this.workflow.resume();
            },
            'gcode:pause': () => {
                this.event.trigger('gcode:pause');

                // unlock screen
                if (semver.gte(this.controller.state.version, '2.4.0')) {
                    this.writeln('M1001 U');
                }

                this.workflow.pause();
            },
            'gcode:stop': () => {
                this.event.trigger('gcode:stop');

                this.workflow.stop();
            },
            'feedhold': () => {
                this.event.trigger('feedhold');

                this.workflow.pause();
            },
            'cyclestart': () => {
                this.event.trigger('cyclestart');

                this.workflow.resume();
            },
            'statusreport': () => {
                this.writeln('M114', { emit: true });
            },
            'homing': () => {
                this.event.trigger('homing');

                this.writeln('G28.2 X Y Z', { emit: true });
            },
            'sleep': () => {
                this.event.trigger('sleep');

                // Unupported
            },
            'unlock': () => {
                this.writeln('M112', { emit: true });
            },
            'reset': () => {
                this.workflow.stop();

                // Feeder
                this.feeder.clear();

                this.writeln('M112', { emit: true });
            },
            'factor:speed': () => {
                const [value] = args;
                const speedFactor = Math.max(Math.min(value, 500), 0);
                this.command(socket, 'gcode', `M220 S${speedFactor}`);

                // enforce state change
                this.controller.state = {
                    ...this.controller.state,
                    speedFactor
                };
            },
            'factor:extruder': () => {
                const [value] = args;
                const extruderFactor = Math.max(Math.min(value, 500), 0);
                this.command(socket, 'gcode', `M221 S${extruderFactor}`);

                // enforce state change
                this.controller.state = {
                    ...this.controller.state,
                    extruderFactor
                };
            },
            'laser:on': () => {
                const [power = 0] = args;
                const powerPercent = Number(ensureRange(power, 0, 100).toFixed(1));
                const powerStrength = Math.floor(powerPercent * 255 / 100);

                this.command(socket, 'gcode', `M3 P${powerPercent} S${powerStrength}`);
            },
            'lasertest:on': () => {
                const [power = 0, duration = 0] = args;
                const powerPercent = Number(ensureRange(power, 0, 100).toFixed(1));
                const powerStrength = Math.floor(powerPercent * 255 / 100);

                const commands = [`M3 P${powerPercent} S${powerStrength}`];
                if (duration > 0) {
                    // G4 [P<time in ms>] [S<time in sec>]
                    // If both S and P are included, S takes precedence.
                    commands.push(`G4 P${ensurePositiveNumber(duration)}`);
                    commands.push('M5');
                }
                this.command(socket, 'gcode', commands);
            },
            'lasertest:off': () => {
                this.writeln('M5', { emit: true });
            },
            'gcode': () => {
                let [commands, context] = args;
                if (!context) {
                    context = {};
                }
                if (!commands) {
                    commands = [];
                }
                const data = ensureArray(commands)
                    .join('\n')
                    .split('\n')
                    .filter(line => {
                        if (typeof line !== 'string') {
                            return false;
                        }

                        return line.trim().length > 0;
                    });

                this.feeder.feed(data, context);

                { // The following criteria must be met to trigger the feeder
                    const notBusy = !(this.history.writeSource);
                    const senderIdle = (this.sender.state.sent === this.sender.state.received);
                    const feederIdle = !(this.feeder.isPending());
                    if (notBusy && senderIdle && feederIdle) {
                        this.feeder.next();
                    }
                }
                // No executing command && sender is not sending.
                if (!this.lastCmdType && this.sender.size() === 0 && !this.feeder.isPending()) {
                    this.feeder.next();
                }
            },
            'watchdir:load': () => {
                const [file, callback = noop] = args;
                const context = {}; // empty context

                monitor.readFile(file, (err, data) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    this.command(socket, 'gcode:load', file, data, context, callback);
                });
            },
            'switch hex mode': () => {
                this.controller.state.hexModeEnabled = !this.controller.state.hexModeEnabled;
            },
            'force switch': () => {
                const { isScreenProtocol } = this.controller.state;
                this.refresh({ isScreenProtocol: !isScreenProtocol });
            },
            'clear feeder': () => {
                this.feeder.clear();
            }
        }[cmd];

        if (!handler) {
            log.error(`Unknown command: ${cmd}`);
            return;
        }

        handler();
    }

    writeln(data, context = {}) {
        if (!this.isOpen()) {
            log.error(`Serial port "${this.options.port}" is not accessible`);
            return;
        }

        if (!data.endsWith('\n')) {
            data += '\n';
        }

        context = context || {};
        // `WRITE_SOURCE_QUERY` is considered triggered by code and should be quiet
        context.source = context.source || WRITE_SOURCE_QUERY;
        // context.emit && this.emitAll('serialport:write', data, context);
        context.emit && this.emitAll('serialport:write', { data, context });

        this.serialport.write(data, context);
    }
}

export default MarlinController;
