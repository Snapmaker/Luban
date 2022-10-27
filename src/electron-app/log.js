import log4js, { configure } from 'log4js';
import { join } from 'path';
import mkdirp from 'mkdirp';
import { app } from 'electron';
import pkg from '../package.json';

const getUserDataDir = () => {
    const dir = app.getPath('userData');
    mkdirp.sync(dir, './Logs');
    return dir;
};

const fileConfigs = (fileName) => {
    return {
        type: 'dateFile',
        filename: process.env.NODE_ENV === 'development' ? join(process.cwd(), `./logs/${fileName}.log`) : join(getUserDataDir(), `./Logs/${fileName}.log`),
        pattern: '.yyyy-MM-dd',
        alwaysIncludePattern: false,
        numBackups: 7,
        keepFileExt: true
    };
};

configure({
    appenders: {
        console: {
            type: 'console',
        },
        DAILYFILE: fileConfigs('main')
    },
    categories: {
        default: {
            appenders: [
                'DAILYFILE',
                'console'
            ],
            level: 'DEBUG'
        }
    }
});

const log = (namespace = `${pkg.version}`) => {
    return log4js.getLogger(namespace);
};

export default log;
