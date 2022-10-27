import log4js, { configure } from 'log4js';
import { join } from 'path';
import mkdirp from 'mkdirp';

const getUserDataDir = () => {
    const dir = process?.env?.userDataDir || global?.luban?.userDataDir;
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
            type: 'console'

        },
        DAILYFILE: fileConfigs('luban'),
        heartBeat: {
            category: 'heartBeat',
            ...fileConfigs('heartBeat')
        },
        errorFile: fileConfigs('errors'),
        errors: {
            type: 'logLevelFilter',
            level: 'ERROR',
            appender: 'errorFile'
        }
    },
    categories: {
        default: {
            appenders: [
                'DAILYFILE',
                'console',
                'errors'
            ],
            level: 'DEBUG'
        },
        heartBeat: { appenders: ['heartBeat'], level: 'DEBUG' },
        http: { appenders: ['DAILYFILE'], level: 'debug' },
    }
});

const logger = (namespace) => {
    return log4js.getLogger(namespace);
};

export default logger;
