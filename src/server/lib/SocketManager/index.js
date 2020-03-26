import SocketIO from 'socket.io';
import socketioJwt from 'socketio-jwt';
import rangeCheck from 'range_check';
import EventEmitter from 'events';

import settings from '../../config/settings';
import { IP_WHITELIST } from '../../constants';
import logger from '../logger';

const log = logger('service:socket-server');


class SocketServer extends EventEmitter {
    server = null;

    io = null;

    sockets = [];

    events = [];

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

        this.io.on('connection', this.onConnection);
    }

    stop() {
        if (this.io) {
            this.io.close();
            this.io = null;
        }
        this.sockets = [];
        this.server = null;
        // this.events = [];
    }

    // established a new socket connection
    onConnection = (socket) => {
        const address = socket.handshake.address;
        const token = socket.decoded_token || {};
        log.debug(`New connection from ${address}: id=${socket.id}, token.id=${token.id}, token.name=${token.name}`);

        // Add to the socket pool
        this.sockets.push(socket);

        // connection startup
        socket.emit('startup');

        this.emit('connection', socket);

        if (this.events && this.events.length > 0) {
            for (const [event, callback] of this.events) {
                const socketEventFn = (...params) => {
                    return callback(socket, ...params);
                };
                socket.on(event, socketEventFn);
            }
        }

        // Disconnect from socket
        socket.on('disconnect', () => {
            log.debug(`Disconnected from ${address}: id=${socket.id}, token.id=${token.id}, token.name=${token.name}`);

            this.emit('disconnection', socket);

            this.sockets.splice(this.sockets.indexOf(socket), 1);
        });
    };

    registerEvent(event, callback) {
        this.events.push([event, callback]);
    }
}

export default SocketServer;
