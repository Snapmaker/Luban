import util from 'util';
import winston from 'winston';
import isElectron from 'is-electron';
import * as fs from 'fs-extra';
import settings from '../config/settings';

const FILE_MAX_SIZE = 1024 * 1024 * 10;

const loggers = new Map();

const getLogDir = () => {
    let logDir: string;
    if (global.luban && global.luban.userDataDir) {
        if (isElectron()) {
            logDir = `${global.luban.userDataDir}/Logs`;
        } else {
            logDir = './Logs';
        }
    } else if (process && process.env && process.env.logDir) {
        logDir = process.env.logDir;
    }
    if (!logDir) {
        return null;
    }
    try {
        fs.ensureDirSync(logDir);
    } catch (e) {
        console.log(e);
    }
    return logDir;
};

const cleanLogFile = (filename) => {
    const logDir = getLogDir();
    if (!logDir) {
        return;
    }
    const logPath = `${logDir}/${filename}.log`;
    try {
        if (fs.statSync(logPath).size > FILE_MAX_SIZE) {
            fs.writeFileSync(logPath, '');
        }
    } catch (e) {
        console.log(e);
    }
};

// https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
const getStackTrace = () => {
    const obj: { stack?: string } = {};
    Error.captureStackTrace(obj, getStackTrace);
    return (obj.stack || '').split('\n');
};

const VERBOSITY_MAX = 3; // -vvv

const { combine, colorize, timestamp, printf } = winston.format;

// https://github.com/winstonjs/winston/blob/master/README.md#creating-your-own-logger
const createLogger = (filename: string) => {
    const logDir = getLogDir();
    if (!logDir) {
        return winston.createLogger({
            exitOnError: false,
            level: settings.winston.level,
            silent: false,
            transports: [
                new winston.transports.Console({
                    format: combine(
                        colorize(),
                        timestamp(),
                        printf(log => `${log.timestamp} - ${log.level} ${log.message}`)
                    ),
                    handleExceptions: true
                })
            ]
        });
    } else {
        return winston.createLogger({
            exitOnError: false,
            level: settings.winston.level,
            silent: false,
            transports: [
                new winston.transports.Console({
                    format: combine(
                        colorize(),
                        timestamp(),
                        printf(log => `${log.timestamp} - ${log.level} ${log.message}`)
                    ),
                    handleExceptions: true
                }),
                new winston.transports.File({
                    filename: `${logDir}/${filename}.log`,
                    format: combine(
                        timestamp(),
                        printf(log => `${log.timestamp} - ${log.level} ${log.message}`)
                    ),
                    handleExceptions: true
                })
            ]
        });
    }
};


// https://github.com/winstonjs/winston/blob/master/README.md#logging-levels
// npm logging levels are prioritized from 0 to 5 (highest to lowest):
const levels = [
    'error', // 0
    'warn', // 1
    'info', // 2
    'verbose', // 3
    'debug', // 4
    'silly' // 5
];


type Level = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';

export default (namespace = '', filename = 'server') => {
    namespace = String(namespace);

    if (loggers[filename]) {
        return loggers[filename];
    }

    cleanLogFile(filename);

    const logger = createLogger(filename);

    const result = levels.reduce((acc, level) => {
        acc[level] = (...args) => {
            if ((settings.verbosity >= VERBOSITY_MAX) && (level !== 'silly')) {
                args = args.concat(getStackTrace()[2]);
            }
            return (namespace.length > 0)
                ? logger[level](`${namespace} ${util.format(...args)}`)
                : logger[level](util.format(...args));
        };
        return acc;
    }, {}) as { [key in Level]: (log: string) => void };

    loggers[filename] = result;
    return result;
};
