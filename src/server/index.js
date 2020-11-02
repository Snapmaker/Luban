/* eslint no-unused-vars: 0 */
import dns from 'dns';
import fs from 'fs';
import os from 'os';
import path from 'path';
import _ from 'lodash';
import bcrypt from 'bcrypt-nodejs';
import chalk from 'chalk';
import webappengine from 'webappengine';
import Jimp from 'jimp';

import createApplication from './app';
import monitor from './services/monitor';
import config from './services/configstore';
import logger from './lib/logger';
import settings from './config/settings';
import { startServices } from './services';
import DataStorage from './DataStorage';


const log = logger('init');

const EPS = 1e-6;


const createServer = (options, callback) => {
    options = { ...options };

    { // verbosity
        const verbosity = options.verbosity;

        // https://github.com/winstonjs/winston#logging-levels
        if (verbosity === 1) {
            _.set(settings, 'verbosity', verbosity);
            logger.logger.level = 'verbose';
        }
        if (verbosity === 2) {
            _.set(settings, 'verbosity', verbosity);
            logger.logger.level = 'debug';
        }
        if (verbosity === 3) {
            _.set(settings, 'verbosity', verbosity);
            logger.logger.level = 'silly';
        }
    }

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
        _.set(settings, 'accessTokenLifetime', accessTokenLifetime);
    }

    // allowRemoteAccess
    const allowRemoteAccess = options.allowRemoteAccess || config.get('allowRemoteAccess', false);

    if (allowRemoteAccess) {
        if (_.size(config.get('users')) === 0) {
            log.warn('You\'ve enabled remote access to the server. It\'s recommended to create an user account to protect against malicious attacks.');
        }

        _.set(settings, 'allowRemoteAccess', allowRemoteAccess);
    }

    // Data storage initialize
    DataStorage.init();

    // // Bugfix on Jimp's greyscale. ...moved to server/lib/jimp

    const { port = 0, host, backlog } = options;
    const routes = [];
    if (typeof options.mount === 'object') {
        routes.push({
            type: 'static',
            route: options.mount.url,
            directory: options.mount.path
        });
    }

    routes.push({
        type: 'server',
        route: '/',
        server: () => createApplication()
    });

    webappengine({ port, host, backlog, routes })
        .on('ready', (server) => {
            // Start socket service
            startServices(server);

            // Deal with address bindings
            const realAddress = server.address().address;
            const realPort = server.address().port;

            callback && callback(null, {
                address: realAddress,
                port: realPort
            });

            log.info(`Starting the server at ${chalk.cyan(`http://${realAddress}:${realPort}`)}`);

            dns.lookup(os.hostname(), { family: 4, all: true }, (err, addresses) => {
                if (err) {
                    log.error('Can\'t resolve host name:', err);
                    return;
                }

                addresses.forEach(({ address }) => {
                    log.info(`Starting the server at ${chalk.cyan(`http://${address}:${realPort}`)}`);
                });
            });
        })
        .on('error', (err) => {
            callback && callback(err);
            log.error(err);
        });
};

export {
    createServer
};
