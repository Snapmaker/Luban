import SocketIO from 'socket.io';
import socketioJwt from 'socketio-jwt';
import rangeCheck from 'range_check';
import isArray from 'lodash/isArray';
import settings from '../../config/settings';
import { IP_WHITELIST } from '../../constants';
import logger from '../logger';

const log = logger('service:socket-server');


class SocketServer {
    server = null;

    io = null;

    sockets = [];

    events = [];

    disconnectEvents = [];

    start(server) {
        this.stop();

        this.server = server;
        this.io = SocketIO(this.server, {
            serveClient: true,
            pingTimeout: 60000, // 60s without pong to consider the connection closed
            path: '/socket.io'
        });

        // JWT (JSON Web Tokens) support
        this.io.use(socketioJwt.authorize({
            secret: settings.secret,
            handshake: true
        }));

        // Register middleware that checks for client IP address and blocks connections
        // which are not in white list.
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

        this.onConnection();
    }

    stop() {
        if (this.io) {
            this.io.close();
            this.io = null;
        }
        this.sockets = [];
        this.server = null;
    }

    onConnection() {
        this.io.on('connection', (socket) => {
            const address = socket.handshake.address;
            const token = socket.decoded_token || {};
            log.debug(`New connection from ${address}: id=${socket.id}, token.id=${token.id}, token.name=${token.name}`);

            // Add to the socket pool
            this.sockets.push(socket);

            // connection startup
            socket.emit('startup');

            // Disconnect from socket

            if (this.events && this.events.length > 0) {
                for (const event of this.events) {
                    if (isArray(event) && event.length === 2 && typeof event[1] === 'function') {
                        const socketEventFn = (...params) => {
                            return event[1](socket, ...params);
                        };
                        socket.on(event[0], socketEventFn);
                    } else if (typeof event === 'function') {
                        event(socket);
                    }
                }
            }

            socket.on('disconnect', () => {
                log.debug(`Disconnected from ${address}: id=${socket.id}, token.id=${token.id}, token.name=${token.name}`);

                if (this.disconnectEvents && this.disconnectEvents.length > 0) {
                    for (const disconnectEvent of this.disconnectEvents) {
                        disconnectEvent(socket);
                    }
                }
                // Remove from socket pool
                this.sockets.splice(this.sockets.indexOf(socket), 1);
            });
        });
    }

    registerConnectionEvent(event) {
        this.events.push(event);
    }

    registerDisconnectEvent(event) {
        this.disconnectEvents.push(event);
    }
}

export default SocketServer;
