/* eslint callback-return: 0 */
import bodyParser from 'body-parser';
import compress from 'compression';
import multiparty from 'connect-multiparty';
import connectRestreamer from 'connect-restreamer';
import engines from 'consolidate';
import cookieParser from 'cookie-parser';
import errorhandler from 'errorhandler';
import express from 'express';
import expressJwt from 'express-jwt';
import session from 'express-session';
import * as fs from 'fs-extra';
import 'hogan.js'; // required by consolidate
import i18next from 'i18next';
import i18nextHttpMiddleware from 'i18next-http-middleware';
import i18nextBackend from 'i18next-node-fs-backend';
import jwt from 'jsonwebtoken';
import _ from 'lodash';
import methodOverride from 'method-override';
import morgan from 'morgan';
import path from 'path';
import rangeCheck from 'range_check';
import favicon from 'serve-favicon';
import sessionFileStore from 'session-file-store';
import settings from './config/settings';
import { ERR_FORBIDDEN, ERR_UNAUTHORIZED, IP_WHITELIST } from './constants';
import DataStorage from './DataStorage';
import logger from './lib/logger';
import urljoin from './lib/urljoin';
import { registerApis } from './services';
import config from './services/configstore';


const log = logger('app');

const renderPage = (view = 'index', cb = _.noop) => (req, res) => {
    // Override IE's Compatibility View Settings
    // http://stackoverflow.com/questions/6156639/x-ua-compatible-is-set-to-ie-edge-but-it-still-doesnt-stop-compatibility-mode
    res.set({ 'X-UA-Compatible': 'IE=edge' });

    const locals = { ...cb(req, res) };
    res.render(view, locals);
};

const verifyToken = (token) => {
    // https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
    try {
        jwt.verify(token, settings.secret);
    } catch (err) {
        return false;
    }
    return true;
};
const DEFAULT_FILE = 'index.html';

const createApplication = () => {
    const app = express();

    // Settings
    if (process.env.NODE_ENV === 'development') {
        // Error handler - https://github.com/expressjs/errorhandler
        // Development error handler, providing stack traces and error message responses
        // for requests accepting text, html, or json.
        app.use(errorhandler());

        // a custom "verbose errors" setting which can be used in the templates via settings['verbose errors']
        app.enable('verbose errors'); // Enables verbose errors in development
        app.disable('view cache'); // Disables view template compilation caching in development
    } else {
        // a custom "verbose errors" setting which can be used in the templates via settings['verbose errors']
        app.disable('verbose errors'); // Disables verbose errors in production
        app.enable('view cache'); // Enables view template compilation caching in production
    }

    app.enable('trust proxy'); // Enables reverse proxy support, disabled by default
    app.enable('case sensitive routing'); // Enable case sensitivity, disabled by default, treating "/Foo" and "/foo" as the same
    app.disable('strict routing'); // Enable strict routing, by default "/foo" and "/foo/" are treated the same by the router
    app.disable('x-powered-by'); // Enables the X-Powered-By: Express HTTP header, enabled by default

    for (let i = 0; i < settings.view.engines.length; ++i) {
        const extension = settings.view.engines[i].extension;
        const template = settings.view.engines[i].template;
        app.engine(extension, engines[template]);
    }
    app.set('view engine', settings.view.defaultExtension); // The default engine extension to use when omitted
    app.set('views', [
        path.resolve(__dirname, '../app'),
        path.resolve(__dirname, 'views')
    ]); // The view directory path

    log.debug('app.settings: %j', app.settings);

    // Check if client's IP address is in the whitelist
    app.use((req, res, next) => {
        const ipaddr = req.ip || req.connection.remoteAddress;
        const allowedAccess = _.some(IP_WHITELIST, (whitelist) => {
            return rangeCheck.inRange(ipaddr, whitelist);
        }) || (settings.allowRemoteAccess);
        const forbiddenAccess = !allowedAccess;

        if (forbiddenAccess) {
            const text = 'Access to the requested directory is only available from the local network.';
            res.status(ERR_FORBIDDEN).end(text);
            log.warn(`ERR_FORBIDDEN: ipaddr=${ipaddr}, message=${text}`);
            return;
        }

        next();
    });


    // Removes the 'X-Powered-By' header in earlier versions of Express
    app.use((req, res, next) => {
        res.removeHeader('X-Powered-By');
        next();
    });

    // Middleware
    // https://github.com/senchalabs/connect
    // https://github.com/valery-barysok/session-file-store
    const sessionPath = DataStorage.sessionDir;
    if (fs.existsSync(sessionPath)) {
        const files = fs.readdirSync(sessionPath);
        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const filePath = `${sessionPath}/${files[i]}`;
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                }
            }
        }
    }
    fs.ensureDir(sessionPath);
    const FileStore = sessionFileStore(session);
    app.use(session({
        ...settings.middleware.session,
        // https://github.com/expressjs/session#secret
        secret: settings.secret,
        store: new FileStore({
            path: sessionPath,
            logFn: (...args) => {
                log.debug(...args);
            }
        })
    }));

    app.use(favicon(path.join(settings.assets.app.path, 'favicon.ico')));
    app.use(cookieParser());

    // Connect's body parsing middleware. This only handles urlencoded and json bodies.
    // https://github.com/expressjs/body-parser
    app.use(bodyParser.json(settings.middleware['body-parser'].json));
    app.use(bodyParser.urlencoded(settings.middleware['body-parser'].urlencoded));

    // For multipart bodies, please use the following modules:
    // - [busboy](https://github.com/mscdex/busboy) and [connect-busboy](https://github.com/mscdex/connect-busboy)
    // - [multiparty](https://github.com/andrewrk/node-multiparty) and [connect-multiparty](https://github.com/andrewrk/connect-multiparty)
    app.use(multiparty(settings.middleware.multiparty));

    // https://github.com/dominictarr/connect-restreamer
    // connect's bodyParser has a problem when using it with a proxy.
    // It gobbles up all the body events, so that the proxy doesn't see anything!
    app.use(connectRestreamer());

    // https://github.com/expressjs/method-override
    app.use(methodOverride());
    if (settings.verbosity > 0) {
        // https://github.com/expressjs/morgan#use-custom-token-formats
        // Add an ID to all requests and displays it using the :id token
        // morgan.token('id', (req) => {
        //     return req.session.id;
        // });
        app.use(morgan(settings.middleware.morgan.format));
    }
    app.use(compress(settings.middleware.compression));

    Object.keys(settings.assets).forEach((name) => {
        const asset = settings.assets[name];

        log.debug('assets: name=%s, asset=%s', name, JSON.stringify(asset));
        if (!(asset.path)) {
            log.error('asset path is not defined');
            return;
        }

        asset.routes.forEach((assetRoute) => {
            const route = urljoin(settings.route || '/', assetRoute || '');
            log.debug('> route=%s', name, route);
            app.use(route, express.static(asset.path, {
                maxAge: asset.maxAge
            }));
        });
    });

    app.use('/data', express.static(DataStorage.userDataDir));

    // Setup i18n (i18next)
    i18next
        .use(i18nextBackend)
        .use(i18nextHttpMiddleware.LanguageDetector)
        .init(settings.i18next);

    // app.use(i18nextHandle(i18next, {}));
    app.use(i18nextHttpMiddleware.handle(i18next));

    // Secure API Access
    app.use(urljoin(settings.route, 'api'), expressJwt({
        secret: config.get('secret'),
        algorithms: ['HS256'],
        credentialsRequired: true,
    }));

    app.use((err, req, res, next) => {
        let bypass = true;

        // Check whether the app is running in development mode
        bypass = bypass || (process.env.NODE_ENV === 'development');

        // Check if the provided credentials are correct
        const token = req.query && req.query.token;
        bypass = bypass || (token && verifyToken(token));

        // Check white list
        const whitelist = [
            // Also see "src/server/api/index.js"
            urljoin(settings.route, 'api/signin')
        ];
        bypass = bypass || _.some(whitelist, (p) => {
            return req.path.indexOf(p) === 0;
        });

        if (!bypass && err && (err.name === 'UnauthorizedError')) {
            const ipaddr = req.ip || req.connection.remoteAddress;
            const text = 'No Unauthorized Access';
            res.status(ERR_UNAUTHORIZED).end(text);
            log.warn(`ERR_UNAUTHORIZED: ipaddr=${ipaddr}, code="${err.code}", message="${err.message}"`);
            return;
        }

        next();
    });

    // register http service api
    registerApis(app);

    // Also see "src/app/app.js"
    app.use((req, res) => {
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        }
    });
    // page
    app.get(urljoin(settings.route, '/'), renderPage(DEFAULT_FILE, (req) => {
        const webroot = settings.assets.app.routes[0] || ''; // with trailing slash
        const lng = req.language;
        const t = req.t;

        return {
            webroot: webroot,
            lang: lng,
            title: `Snapmaker Luban ${settings.version}`,
            loading: t('loading')
        };
    }));

    // Error handling
    app.use((err, req, res) => {
        if (err) {
            log.error(err);
            res.status(500).send({ error: err.message });
        } else {
            res.status(404).send({ msg: 'Not found' });
        }
    });
    // app.use(errlog());
    // app.use(errclient({
    //     error: 'XHR error'
    // }));
    // app.use(errnotfound({
    //     view: path.join('common', '404.hogan'),
    //     error: 'Not found'
    // }));
    // app.use(errserver({
    //     view: path.join('common', '500.hogan'),
    //     error: 'Internal server error'
    // }));
    return app;
};

process.on('uncaughtException', (err) => {
    log.error('uncaught exception', err);
});

process.on('unhandledRejection', (reason, promise) => {
    log.error('unhandled rejection', promise, 'reason', reason);
});

export default createApplication;
