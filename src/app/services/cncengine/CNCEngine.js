import noop from 'lodash/noop';
import rangeCheck from 'range_check';
import serialport from 'serialport';
import SocketIO from 'socket.io';
import socketioJwt from 'socketio-jwt';
import ensureArray from '../../lib/ensure-array';
import logger from '../../lib/logger';
import settings from '../../config/settings';
import store from '../../store';
import config from '../configstore';
import taskRunner from '../taskrunner';
import deviceManager from '../../lib/deviceManager';
import { MarlinController } from '../../controllers';
import { IP_WHITELIST } from '../../constants';
import { WRITE_SOURCE_CLIENT } from '../../controllers/Marlin/constants';
import slice from '../../slicer/slice';
import taskManager from '../TaskManager';

const log = logger('service:cncengine');


class CNCEngine {
    listener = {
        taskStart: (...args) => {
            this.io.sockets.emit('task:start', ...args);
        },
        taskFinish: (...args) => {
            this.io.sockets.emit('task:finish', ...args);
        },
        taskError: (...args) => {
            this.io.sockets.emit('task:error', ...args);
        },
        configChange: (...args) => {
            this.io.sockets.emit('config:change', ...args);
        }
    };

    server = null;

    io = null;

    sockets = [];

    // The only controller
    controller = null;

    // @param {object} server The HTTP server instance.
    start(server) {
        this.stop();

        taskRunner.on('start', this.listener.taskStart);
        taskRunner.on('finish', this.listener.taskFinish);
        taskRunner.on('error', this.listener.taskError);
        config.on('change', this.listener.configChange);

        this.server = server;
        this.io = SocketIO(this.server, {
            serveClient: true,
            path: '/socket.io'
        });

        this.io.use(socketioJwt.authorize({
            secret: settings.secret,
            pingTimeout: 60000, // 60s without pong to consider the connection closed
            handshake: true
        }));

        this.io.use((socket, next) => {
            const clientIp = socket.handshake.address;
            const allowedAccess = IP_WHITELIST.some(whitelist => {
                return rangeCheck.inRange(clientIp, whitelist);
            }) || (settings.allowRemoteAccess);

            if (!allowedAccess) {
                log.warn(`Forbidden: Deny connection from ${clientIp}`);
                next(new Error('You are not allowed on this server!'));
                return;
            }

            next();
        });

        this.io.on('connection', (socket) => {
            const address = socket.handshake.address;
            const token = socket.decoded_token || {};
            log.debug(`New connection from ${address}: id=${socket.id}, token.id=${token.id}, token.name=${token.name}`);

            // Add to the socket pool
            this.sockets.push(socket);

            socket.emit('startup', {
                ports: ensureArray(config.get('ports', [])),
                baudrates: ensureArray(config.get('baudrates', []))
            });

            socket.on('disconnect', () => {
                log.debug(`Disconnected from ${address}: id=${socket.id}, token.id=${token.id}, token.name=${token.name}`);

                const controllers = store.get('controllers', {});
                Object.keys(controllers).forEach((port) => {
                    const controller = controllers[port];
                    if (!controller) {
                        return;
                    }
                    controller.removeConnection(socket);
                });

                // Remove from socket pool
                this.sockets.splice(this.sockets.indexOf(socket), 1);
            });

            // List the available serial ports
            socket.on('list', () => {
                log.debug(`socket.list(): id=${socket.id}`);

                serialport.list((err, ports) => {
                    if (err) {
                        log.error(err);
                        return;
                    }

                    ports = ports.concat(ensureArray(config.get('ports', [])));

                    const controllers = store.get('controllers', {});
                    const portsInUse = Object.keys(controllers)
                        .filter(port => {
                            const controller = controllers[port];
                            return controller && controller.isOpen();
                        });

                    ports = ports.map(port => {
                        return {
                            port: port.comName,
                            manufacturer: port.manufacturer,
                            inuse: portsInUse.indexOf(port.comName) >= 0
                        };
                    });

                    socket.emit('serialport:list', ports);
                });
            });

            socket.on('slice', (params) => {
                slice(
                    params,
                    (progress) => {
                        socket.emit('print3D:gcode-slice-progress', progress);
                    },
                    (sliceResult) => {
                        const { gcodeFileName, printTime, filamentLength, filamentWeight, gcodeFilePath } = { ...sliceResult };
                        socket.emit('print3D:gcode-generated', {
                            gcodeFileName,
                            printTime,
                            filamentLength,
                            filamentWeight,
                            gcodeFilePath
                        });
                    },
                    (err) => {
                        socket.emit('print3D:gcode-slice-err', err);
                    }
                );
            });

            // Discover Wi-Fi enabled Snapmakers
            socket.on('discoverSnapmaker', () => {
                deviceManager.refreshDevices();
            });
            deviceManager.removeAllListeners('devices');
            deviceManager.on('devices', (devices) => {
                socket.emit('discoverSnapmaker:devices', devices);
            });

            // Task
            socket.on('task:commit', (task) => {
                const taskId = task.taskId;
                taskManager.addTask(task, taskId);
            });
            taskManager.removeAllListeners('taskCompleted');
            taskManager.on('taskCompleted', (task) => {
                socket.emit('task:completed', {
                    taskId: task.taskId,
                    status: task.taskStatus,
                    filename: task.filename
                });
            });

            // Open serial port
            socket.on('open', (port, options, callback = noop) => {
                if (typeof callback !== 'function') {
                    callback = noop;
                }

                log.debug(`socket.open("${port}", ${JSON.stringify(options)}): id=${socket.id}`);

                let controller = store.get(`controllers["${port}"]`);
                if (!controller) {
                    let { baudrate } = { ...options };

                    controller = new MarlinController(port, { baudrate: baudrate });
                    this.controller = controller;
                }

                controller.addConnection(socket);

                if (controller.isOpen()) {
                    socket.emit('serialport:open', {
                        port: port,
                        controllerType: controller.type,
                        inuse: true
                    });

                    // Join the room
                    socket.join(port);

                    callback(null);
                    return;
                }

                controller.open((err = null) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    if (store.get(`controllers["${port}"]`)) {
                        log.error(`Serial port "${port}" was not properly closed`);
                    }
                    store.set(`controllers["${port}"]`, controller);

                    // Join the room
                    socket.join(port);

                    callback(null);
                });
            });

            // Close serial port
            socket.on('close', (port, callback = noop) => {
                if (typeof callback !== 'function') {
                    callback = noop;
                }

                log.debug(`socket.close("${port}"): id=${socket.id}`);

                const controller = store.get(`controllers["${port}"]`);
                if (!controller) {
                    const err = `Serial port "${port}" not accessible`;
                    log.error(err);
                    callback(new Error(err));
                    return;
                }

                // Leave the room
                socket.leave(port);

                controller.close((err) => {
                    // Remove controller from store
                    store.unset(`controllers[${port}]`);

                    // Destroy controller
                    controller.destroy();

                    this.controller = null;

                    callback(null);
                });
            });

            socket.on('command', (port, cmd, ...args) => {
                log.debug(`socket.command("${port}", "${cmd}"): id=${socket.id}, args=${JSON.stringify(args)}`);

                const controller = store.get(`controllers["${port}"]`);
                if (!controller || !controller.isOpen()) {
                    log.error(`Serial port "${port}" not accessible`);
                    return;
                }

                controller.command.apply(controller, [socket, cmd].concat(args));
            });

            socket.on('writeln', (port, data, context = {}) => {
                log.debug(`socket.writeln("${port}", "${data}", ${JSON.stringify(context)}): id=${socket.id}`);

                const controller = store.get(`controllers["${port}"]`);
                if (!controller || !controller.isOpen()) {
                    log.error(`Serial port "${port}" not accessible`);
                    return;
                }

                if (!context.source) {
                    context.source = WRITE_SOURCE_CLIENT;
                }
                controller.writeln(data, context);
            });
        });
    }

    stop() {
        if (this.io) {
            this.io.close();
            this.io = null;
        }
        this.sockets = [];
        this.server = null;

        taskRunner.removeListener('start', this.listener.taskStart);
        taskRunner.removeListener('finish', this.listener.taskFinish);
        taskRunner.removeListener('error', this.listener.taskError);
        config.removeListener('change', this.listener.configChange);
    }

    /**
     * The only controller.
     */
    getController() {
        return this.controller;
    }
}

export default CNCEngine;
