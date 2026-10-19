/* eslint no-unused-vars: 0 */
import bcrypt from 'bcrypt-nodejs';
import chalk from 'chalk';
import dns from 'dns';
import fs from 'fs';
import _, { set, size } from 'lodash';
import os from 'os';
import path from 'path';
import http from 'http';

import DataStorage from './DataStorage';
import settings from './config/settings';
import logger from './lib/logger';
import config from './services/configstore';
import monitor from './services/monitor';
import { elapsed as startupElapsed, mark as startupMark } from '../startup-timeline';


const log = logger('init');

const createServer = (options, callback) => {
    startupMark('server: createServer entry');
    options = { ...options };

    const profile = path.resolve(settings.rcfile);

    // configstore service
    log.info(`Loading configuration from ${chalk.yellow(JSON.stringify(profile))}`);

    config.load(profile);

    settings.rcfile = profile;

    // secret
    if (!config.get('secret')) {
        // generate a secret key
        const secret = bcrypt.genSaltSync(); // TODO: use a strong secret
        config.set('secret', secret);
    }

    settings.secret = config.get('secret', settings.secret);

    // watchDirectory
    const watchDirectory = options.watchDirectory || config.get('watchDirectory');

    if (watchDirectory) {
        if (fs.existsSync(watchDirectory)) {
            log.info(`Watching ${chalk.yellow(JSON.stringify(watchDirectory))} for file changes.`);

            // monitor service
            monitor.start({ watchDirectory: watchDirectory });
        } else {
            log.error(`The directory ${chalk.yellow(JSON.stringify(watchDirectory))} does not exist.`);
        }
    }

    // accessTokenLifetime
    const accessTokenLifetime = options.accessTokenLifetime || config.get('accessTokenLifetime');

    if (accessTokenLifetime) {
        set(settings, 'accessTokenLifetime', accessTokenLifetime);
    }

    // allowRemoteAccess
    const allowRemoteAccess = options.allowRemoteAccess || config.get('allowRemoteAccess', false);

    if (allowRemoteAccess) {
        if (size(config.get('users')) === 0) {
            log.warn('You\'ve enabled remote access to the server. It\'s recommended to create an user account to protect against malicious attacks.');
        }

        set(settings, 'allowRemoteAccess', allowRemoteAccess);
    }

    process.env.Tmpdir = DataStorage.tmpDir;

    const { port = 0, host, backlog } = options;

    // Bind before loading the heavy half, so the port is known as early as
    // possible. Anything that arrives in the gap is parked, not refused.
    let app = null;
    const parked = [];
    const server = http.createServer((req, res) => {
        if (app) {
            app(req, res);
            return;
        }
        // socket.io handshakes must not be parked: on replay they would hit
        // Express (404) because socket.io only attaches its own request
        // interceptor once services start. A prompt 503 makes the client
        // retry with backoff into the working server instead (issue #38).
        if (req.url && req.url.startsWith('/socket.io/')) {
            res.writeHead(503, { 'Retry-After': '2' });
            res.end();
            return;
        }
        parked.push([req, res]);
    });

    server.listen(port, host, backlog, () => {
        startupMark('server: listening');

        // Deal with address bindings
        const realAddress = server.address().address;
        const realPort = server.address().port;
        callback && callback(null, {
            address: realAddress,
            port: realPort
        });

        log.info(`Starting the server at ${chalk.cyan(`http://${realAddress}:${realPort}`)}`);

        // Requiring these pulls in express, the machine channels, the slicer and
        // the task workers: ~1s warm and far worse cold, which is what the splash
        // used to wait on. Nothing above needs them.
        setImmediate(() => {
            try {
                // eslint-disable-next-line global-require
                app = require('./app').default();
            } catch (err) {
                // Without an application every request would stay parked and
                // the renderer would simply hang; answer them instead so the
                // failure is visible, then let the exception surface.
                log.error('Creating the application failed', err);
                app = (req, res) => {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(`The server failed to start: ${err.message}`);
                };
                for (const [req, res] of parked.splice(0)) {
                    app(req, res);
                }
                throw err;
            }
            startupMark('server: application created');

            // Deferred to here because app.js installs the process-wide
            // unhandledRejection handler, and this leaves floating promises.
            log.info('Initializing user data storage...');
            DataStorage.init();

            // eslint-disable-next-line global-require
            require('./services').startServices(server);
            startupMark('server: services started');

            // The startup table is printed at 'ready', which is now before this
            // point, so report the deferred phase separately.
            log.info(`Services ready ${startupElapsed()}ms after process start`);

            const waiting = parked.splice(0);
            for (const [req, res] of waiting) {
                app(req, res);
            }
            if (waiting.length) {
                log.info(`Replayed ${waiting.length} request(s) received before the app was ready`);
            }
        });

        dns.lookup(os.hostname(), { family: 4, all: true }, (err, addresses) => {
            if (err) {
                log.error(`Can't resolve host name: ${err}`);
                return;
            }

            addresses.forEach(({ address }) => {
                log.info(`Starting the server at ${chalk.cyan(`http://${address}:${realPort}`)}`);
            });
        });
    });
};

export {
    createServer
};
