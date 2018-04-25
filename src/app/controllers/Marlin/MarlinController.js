import _ from 'lodash';
import find from 'lodash/find';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
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
import config from '../../services/configstore';
import monitor from '../../services/monitor';
import taskRunner from '../../services/taskrunner';
import store from '../../store';
import Marlin from './Marlin';
import {
    MARLIN,
    QUERY_TYPE_POSITION,
    QUERY_TYPE_TEMPERATURE,
    WRITE_SOURCE_CLIENT,
    WRITE_SOURCE_FEEDER,
    WRITE_SOURCE_SENDER,
    WRITE_SOURCE_QUERY,
    HEAD_TYPE_3DP
} from './constants';

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
        baudRate: 115200
    };
    serialport = null;
    serialportListener = {
        data: (data) => {
            log.silly(`< ${data}`);
            this.controller.parse('' + data);
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
    feedOverride = 100;
    spindleOverride = 100;

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
                this.serialport.write('M114\n', {
                    source: WRITE_SOURCE_QUERY
                });
                this.lastQueryTime = now;
            } else if (this.query.type === QUERY_TYPE_TEMPERATURE) {
                this.serialport.write('M105\n', {
                    source: WRITE_SOURCE_QUERY
                });
                this.lastQueryTime = now;
            } else {
                log.error('Unsupport query type:', this.query.type);
            }
            this.query.type = null;
        }
    };
    queryPosition = (() => {
        let lastQueryTime = 0;

        return _.throttle(() => {
            // Check the ready flag
            if (!this.ready) {
                return;
            }

            const now = new Date().getTime();

            if (!this.query.type) {
                this.query.type = QUERY_TYPE_POSITION;
                lastQueryTime = now;
            } else {
                const timespan = Math.abs(now - lastQueryTime);
                const toleranceTime = 5000; // 5 seconds

                if (timespan >= toleranceTime) {
                    log.silly(`Reschedule current position query: now=${now}ms, timespan=${timespan}ms`);
                    this.query.type = QUERY_TYPE_POSITION;
                    lastQueryTime = now;
                }
            }
        }, 500);
    })();

    queryTemperature = (() => {
        let lastQueryTime = 0;

        return _.throttle(() => {
          // Check the ready flag
            if (!this.ready) {
                return;
            }
            const now = new Date().getTime();
            if (!this.query.type) {
                this.query.type = QUERY_TYPE_TEMPERATURE;
                lastQueryTime = now;
            } else {
                const timespan = Math.abs(now - lastQueryTime);
                const toleranceTime = 10000; // 10 seconds

                if (timespan >= toleranceTime) {
                    log.silly(`Reschedule temperture report query: now=${now}ms, timespan=${timespan}ms`);
                    this.query.type = QUERY_TYPE_TEMPERATURE;
                    lastQueryTime = now;
                }
            }
        }, 1000);
    })();

    dataFilter = (line, context) => {
        // Current position
        const {
            x: posx,
            y: posy,
            z: posz,
            e: pose
        } = this.controller.getPosition();

        // The context contains the bounding box and current position
        Object.assign(context || {}, {
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

    constructor(port, options) {
        const { baudRate } = { ...options };

        this.options = {
            ...this.options,
            port: port,
            baudRate: baudRate
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
            if (this.isClose()) {
                log.error(`Serial port "${this.options.port}" is not accessible`);
                return;
            }

            line = String(line).trim();
            if (line.length === 0) {
                return;
            }

            this.emitAll('serialport:write', line, context);
            this.serialport.write(line + '\n', {
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
            }
        });
        this.sender.on('data', (line = '', context = {}) => {
            if (this.isClose()) {
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

            this.serialport.write(line + '\n', {
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
        });

        // Workflow
        this.workflow = new Workflow();
        this.workflow.on('start', () => {
            this.emitAll('workflow:state', this.workflow.state);
            this.sender.rewind();
        });
        this.workflow.on('stop', () => {
            this.emitAll('workflow:state', this.workflow.state);
            this.sender.rewind();
        });
        this.workflow.on('pause', () => {
            this.emitAll('workflow:state', this.workflow.state);
        });
        this.workflow.on('resume', () => {
            this.emitAll('workflow:state', this.workflow.state);
            this.sender.next();
        });

        // Marlin
        this.controller = new Marlin();

        this.controller.on('firmware', (res) => {
            if (!this.ready) {
                this.ready = true;

                const version = this.controller.state.version;
                if (semver.gte(version, '2.4.0')) {
                    // send M1006 to detect type of tool head
                    this.command(null, 'gcode', 'M1006');
                }
            }
            if (_.includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                this.emitAll('serialport:read', res.raw);
            }
        });
        this.controller.on('headType', (res) => {
            log.silly(`controller.on('headType'): source=${this.history.writeSource},` +
                ` line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (_.includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                this.emitAll('serialport:read', res.raw);
            }
        });
        this.controller.on('pos', (res) => {
            log.silly(`controller.on('pos'): source=${this.history.writeSource}, line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (_.includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                this.emitAll('serialport:read', res.raw);
            }
        });
        this.controller.on('temperature', (res) => {
            log.silly(`controller.on('temperature'): source=${this.history.writeSource}, `
                + `line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            if (_.includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER, WRITE_SOURCE_SENDER], this.history.writeSource)) {
                this.emitAll('serialport:read', res.raw);
            }
        });
        this.controller.on('ok', (res) => {
            log.silly(`controller.on('ok'): source=${this.history.writeSource}, line=${JSON.stringify(this.history.writeLine)}, res=${JSON.stringify(res)}`);
            // Display info to console, if this is from user-input
            if (res) {
                if (_.includes([WRITE_SOURCE_CLIENT, WRITE_SOURCE_FEEDER], this.history.writeSource)) {
                    this.emitAll('serialport:read', res.raw);
                } else if (!this.history.writeSource) {
                    this.emitAll('serialport:read', res.raw);
                    log.error('"history.writeSource" should NOT be empty');
                }
            }

            this.history.writeSource = null;
            this.history.writeLine = null;

            // Perform preemptive query to prevent starvation
            const now = new Date().getTime();
            const timespan = Math.abs(now - this.query.lastQueryTime);
            if (this.query.type && timespan > 2000) {
                this.query.issue();
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
                this.sender.next();
                return;
            }
            if (this.workflow.state === WORKFLOW_STATE_PAUSED) {
                const { sent, received } = this.sender.state;
                if (sent > received) {
                    this.sender.ack();
                    return;
                }
            }

            // Feeder
            if (this.feeder.next()) {
                return;
            }

            this.query.issue();
        });

        this.controller.on('echo', (res) => {
            this.emitAll('serialport:read', res.raw);
        });

        this.controller.on('error', (res) => {
            // Sender
            if (this.workflow.state === WORKFLOW_STATE_RUNNING) {
                const { lines, received } = this.sender.state;
                const line = lines[received] || '';

                this.emitAll('serialport:read', `> ${line.trim()} (line=${received + 1})`);
                this.emitAll('serialport:read', res.raw);

                this.sender.ack();
                this.sender.next();
                return;
            }

            this.emitAll('serialport:read', res.raw);

            // Feeder
            this.feeder.next();
        });

        this.controller.on('others', (res) => {
            this.emitAll('serialport:read', 'others < ' + res.raw);
            log.error('Can\'t parse result', res.raw);
        });

        this.queryTimer = setInterval(() => {
            if (this.isClose()) {
                // Serial port is closed
                return;
            }

            // Feeder
            if (this.feeder.peek()) {
                this.emitAll('feeder:status', this.feeder.toJSON());
            }

            // Sender
            if (this.sender.peek()) {
                this.emitAll('sender:status', this.sender.toJSON());
            }

            const zeroOffset = isEqual(
                this.controller.getPosition(this.state),
                this.controller.getPosition(this.controller.state)
            );

            // Marlin state
            if (this.state !== this.controller.state) {
                this.state = this.controller.state;
                this.emitAll('Marlin:state', this.state);
            }

            // Marlin settings
            if (this.settings !== this.controller.settings) {
                this.settings = this.controller.settings;
                this.emitAll('Marlin:settings', this.settings);
            }

            // Wait for the bootloader to complete before sending commands
            if (!(this.ready)) {
                // Not ready yet
                return;
            }

            // M114 - Get Current Position
            this.queryPosition();
            if (this.state.headType === HEAD_TYPE_3DP) {
                // M105 - Get Temperature Report
                this.queryTemperature();
            }

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
        }, 250);
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
    open(callback = noop, options) {
        const { port } = this.options;

        // Assertion check
        if (this.serialport && this.serialport.isOpen()) {
            log.error(`Cannot open serial port "${port}"`);
            return;
        }

        this.serialport = new SerialConnection({
            ...this.options,
            writeFilter: (data, context) => {
                const { source = null } = { ...context };
                const line = data.trim();

                // update write history
                this.history.writeSource = source;
                this.history.writeLine = line;

                if (!line) {
                    return data;
                }

                let { jogSpeed, workSpeed, headStatus, headPower } = { ...this.controller.state };

                interpret(line, (cmd, params) => {
                    if (cmd === 'G0' && params.F) {
                        jogSpeed = params.F;
                    }
                    if (cmd === 'G1' && params.F) {
                        workSpeed = params.F;
                    }
                    if (cmd === 'M3') {
                        headStatus = 'on';
                        if (params.P !== undefined) {
                            headPower = Math.round(params.P);
                            headPower = ensureRange(headPower, 0, 100);
                        } else if (params.S !== undefined) {
                            // round to get executed power, convert to percentage and round again
                            headPower = Math.round(Math.round(params.S) / 255.0 * 100.0);
                            headPower = ensureRange(headPower, 0, 100);
                        }
                    }
                    if (cmd === 'M5') {
                        headStatus = 'off';
                    }
                });

                const nextState = {
                    ...this.controller.state,
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
            if (err) {
                log.error(`Error opening serial port "${port}":`, err);
                this.emitAll('serialport:error', { err: err, port: port });
                callback(err); // notify error
                return;
            }

            this.emitAll('serialport:open', {
                port: port,
                controllerType: this.type,
                inuse: true
            });

            callback(); // register controller

            // Make sure machine is ready.
            this.handler = setInterval(() => {
                // Set ready flag to true when receiving a start message
                if (this.handler && this.ready) {
                    clearInterval(this.handler);
                    return;
                }

                // send M1005 to get firmware version (only support versions >= '2.2')
                this.writeln(null, 'M1005');

                // retrieve temperature to detect machineType (polyfill for versions < '2.2')
                this.writeln(null, 'M105');
            }, 1000);

            log.debug(`Connected to serial port "${port}"`);

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
        const { port } = this.options;

        if (this.handler) {
            clearInterval(this.handler);
        }

        // Assertion check
        if (!this.serialport) {
            log.error(`Serial port "${port}" is not available`);
            return;
        }

        // Stop status query
        this.ready = false;

        this.emitAll('serialport:close', {
            port: port,
            inuse: false
        });
        store.unset('controllers["' + port + '"]');

        if (this.isOpen()) {
            this.serialport.removeListener('close', this.serialportListener.close);
            this.serialport.removeListener('error', this.serialportListener.error);
            this.serialport.close((err) => {
                if (err) {
                    log.error(`Error closing serial port "${port}":`, err);
                }
            });
        }

        this.destroy();
    }
    isOpen() {
        return this.serialport && this.serialport.isOpen;
    }
    isClose() {
        return !(this.isOpen());
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
        if (!isEmpty(this.state)) {
            // controller state
            socket.emit('Marlin:state', this.state);
        }
        if (!isEmpty(this.settings)) {
            // controller settings
            socket.emit('Marlin:settings', this.settings);
        }
        if (this.workflow) {
            // workflow state
            socket.emit('workflow:state', this.workflow.state);
        }
        if (this.sender) {
            // sender status
            socket.emit('sender:status', this.sender.toJSON());
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
    emitAll(eventName, ...args) {
        Object.keys(this.connections).forEach(id => {
            const socket = this.connections[id];
            socket.emit.apply(socket, [eventName].concat(args));
        });
    }
    command(socket, cmd, ...args) {
        const handler = {
            'gcode:load': () => {
                let [name, gcode, context = {}, callback = noop] = args;
                if (typeof context === 'function') {
                    callback = context;
                    context = {};
                }

                // G4 P0 or P with a very small value will empty the planner queue and then
                // respond with an ok when the dwell is complete. At that instant, there will
                // be no queued motions, as long as no more commands were sent after the G4.
                // This is the fastest way to do it without having to check the status reports.
                const dwell = '%wait ; Wait for the planner queue to empty';
                gcode = gcode + '\n' + dwell;

                const ok = this.sender.load(name, gcode, context);
                if (!ok) {
                    callback(new Error(`Invalid G-code: name=${name}`));
                    return;
                }

                this.event.trigger('gcode:load');

                log.debug(`Load G-code: name="${this.sender.state.name}", size=${this.sender.state.gcode.length}, total=${this.sender.state.total}`);

                this.workflow.stop();

                callback(null, { name, gcode, context });
            },
            'gcode:unload': () => {
                this.workflow.stop();

                // Sender
                this.sender.unload();

                this.event.trigger('gcode:unload');
            },
            'start': () => {
                log.warn(`Warning: The "${cmd}" command is deprecated and will be removed in a future release.`);
                this.command(socket, 'gcode:start');
            },
            'gcode:start': () => {
                this.event.trigger('gcode:start');

                this.workflow.start();

                // Feeder
                this.feeder.clear();

                // Sender
                this.sender.next();
            },
            'stop': () => {
                log.warn(`Warning: The "${cmd}" command is deprecated and will be removed in a future release.`);
                this.command(socket, 'gcode:stop');
            },
            'gcode:stop': () => {
                this.event.trigger('gcode:stop');

                this.workflow.stop();
            },
            'pause': () => {
                log.warn(`Warning: The "${cmd}" command is deprecated and will be removed in a future release.`);
                this.command(socket, 'gcode:pause');
            },
            'gcode:pause': () => {
                this.event.trigger('gcode:pause');

                this.workflow.pause();
            },
            'resume': () => {
                log.warn(`Warning: The "${cmd}" command is deprecated and will be removed in a future release.`);
                this.command(socket, 'gcode:resume');
            },
            'gcode:resume': () => {
                this.event.trigger('gcode:resume');

                this.workflow.resume();
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
                this.writeln(socket, 'M114');
            },
            'homing': () => {
                this.event.trigger('homing');

                this.writeln(socket, 'G28.2 X Y Z');
            },
            'sleep': () => {
                this.event.trigger('sleep');

                // Unupported
            },
            'unlock': () => {
                this.writeln(socket, 'M112');
            },
            'reset': () => {
                this.workflow.stop();

                // Feeder
                this.feeder.clear();

                this.writeln(socket, 'M112');
            },
            'feedOverride': () => {
                const [value] = args;
                let feedOverride = this.controller.state.ovF;

                if (value === 0) {
                    feedOverride = 100;
                } else if ((feedOverride + value) > 500) {
                    feedOverride = 500;
                } else if ((feedOverride + value) < 10) {
                    feedOverride = 10;
                } else {
                    feedOverride += value;
                }
                this.command(socket, 'gcode', 'M220S' + feedOverride);

                // enforce state change
                this.controller.state = {
                    ...this.controller.state,
                    ovF: feedOverride
                };
            },
            'spindleOverride': () => {
                const [value] = args;
                let spindleOverride = this.controller.state.ovS;

                if (value === 0) {
                    spindleOverride = 100;
                } else if ((spindleOverride + value) > 500) {
                    spindleOverride = 500;
                } else if ((spindleOverride + value) < 10) {
                    spindleOverride = 10;
                } else {
                    spindleOverride += value;
                }
                this.command(socket, 'gcode', 'M221S' + spindleOverride);

                // enforce state change
                this.controller.state = {
                    ...this.controller.state,
                    ovS: spindleOverride
                };
            },
            'rapidOverride': () => {
                // Unsupported
            },

            'laser:on': () => {
                const [power = 0] = args;
                const commands = [
                    'M3 P' + ensureRange(power, 0, 100)
                ];

                this.command(socket, 'gcode', commands);
            },
            'lasertest:on': () => {
                const [power = 0, duration = 0] = args;
                const commands = [
                    'M3 P' + ensureRange(power, 0, 100)
                ];
                if (duration > 0) {
                    // G4 [P<time in ms>] [S<time in sec>]
                    // If both S and P are included, S takes precedence.
                    commands.push('G4 P' + ensurePositiveNumber(duration));
                    commands.push('M5');
                }
                this.command(socket, 'gcode', commands);
            },
            'lasertest:off': () => {
                this.writeln(socket, 'M5');
            },
            'gcode': () => {
                const [commands, context] = args;
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
            'macro:run': () => {
                let [id, context = {}, callback = noop] = args;
                if (typeof context === 'function') {
                    callback = context;
                    context = {};
                }

                const macros = config.get('macros');
                const macro = find(macros, { id: id });

                if (!macro) {
                    log.error(`Cannot find the macro: id=${id}`);
                    return;
                }

                this.event.trigger('macro:run');

                this.command(socket, 'gcode', macro.content, context);
                callback(null);
            },
            'macro:load': () => {
                let [id, context = {}, callback = noop] = args;
                if (typeof context === 'function') {
                    callback = context;
                    context = {};
                }

                const macros = config.get('macros');
                const macro = find(macros, { id: id });

                if (!macro) {
                    log.error(`Cannot find the macro: id=${id}`);
                    return;
                }

                this.event.trigger('macro:load');

                this.command(socket, 'gcode:load', macro.name, macro.content, context, callback);
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
            }
        }[cmd];

        if (!handler) {
            log.error(`Unknown command: ${cmd}`);
            return;
        }

        handler();
    }
    write(socket, data, context) {
        // Assertion check
        if (this.isClose()) {
            log.error(`Serial port "${this.options.port}" is not accessible`);
            return;
        }
        context = context || {};
        this.emitAll('serialport:write', data, context);
        this.serialport.write(data, {
            source: WRITE_SOURCE_CLIENT
        });
    }
    writeln(socket, data, context) {
        this.write(socket, data + '\n', context);
    }
}

export default MarlinController;
