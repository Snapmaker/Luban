import { Server, Socket } from 'socket.io';
import socketioJwt from 'socketio-jwt';
import rangeCheck from 'range_check';
import EventEmitter from 'events';

import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import settings from '../../config/settings';
import { IP_WHITELIST } from '../../constants';
import logger from '../logger';

const log = logger('service:socket-server');

type TMessage = {
    type: string,
    [key: string]: unknown
}

class SocketServer extends EventEmitter {
    private server = null;

    private io: Server<DefaultEventsMap, DefaultEventsMap> = null;

    private sockets: Socket[] = [];

    public id = '';

    private events = [];

    public start(server) {
        this.stop();

        this.server = server;
        this.io = new Server(this.server, {
            serveClient: true,
            allowEIO3: true,
            pingTimeout: 180000, // 60s without pong to consider the connection closed
            path: '/socket.io',
            maxHttpBufferSize: 1e8
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

    public stop() {
        if (this.io) {
            this.io.close();
            this.io = null;
        }
        this.sockets = [];
        this.server = null;
        // this.events = [];
    }

    // established a new socket connection
    public onConnection = (socket) => {
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
        socket.on('disconnect', (err) => {
            log.debug(`Disconnected from err=${err}`);
            log.debug(`Disconnected from ${address}: id=${socket.id}, token.id=${token.id}, token.name=${token.name}`);

            this.emit('disconnection', socket);

            this.sockets.splice(this.sockets.indexOf(socket), 1);
        });
    };

    public registerEvent(event: string, callback) {
        this.events.push([event, callback]);
    }

    private channelMiddleware = (socket: Socket, topic: string, invoke, actionid, params) => {
        const actions = {
            next: (res) => {
                socket.emit(topic, actionid, 'next', res);
            },
            error: (res) => {
                socket.emit(topic, actionid, 'error', res);
            },
            complete: (res) => {
                socket.emit(topic, actionid, 'complete', res);
            }
        };
        return invoke(actions, params);
    };

    public registerChannel(
        topic: string, callback: (subscriber: {
            next: (msg: TMessage) => void;
            complete: (msg: TMessage) => void;
        }, ...data: unknown[]) => void
    ) {
        this.events.push([
            topic, (socket, actionid, params) => {
                return this.channelMiddleware(socket, topic, callback, actionid, params);
            }
        ]);
    }
}

export default SocketServer;
