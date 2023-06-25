import os from 'os';
import path from 'path';

const maxAge = 0;

export default {
    verbosity: 1,
    api_server: 'http://127.0.0.1:8009',
    route: '/', // with trailing slash
    assets: {
        // app
        app: {
            routes: [
                '', // empty path
                '/worker',
            ],
            path: path.resolve(__dirname, '..', '..', 'app'),
            maxAge: maxAge
        }
    },
    backend: {
        enable: true,
        host: 'localhost',
        port: 80,
        route: 'api/'
    },
    cluster: {
        // note. node-inspector cannot debug child (forked) process
        enable: false,
        maxWorkers: os.cpus().length || 1
    },
    winston: {
        // https://github.com/winstonjs/winston#logging-levels
        level: 'silly'
    }
};
