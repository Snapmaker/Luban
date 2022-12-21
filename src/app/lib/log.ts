import log, { Logger as LogLevelLogger, LogLevelNames } from 'loglevel';


declare type LogLevel = LogLevelNames;

class Logger {
    private _logger: LogLevelLogger;

    public constructor(logger: LogLevelLogger) {
        this._logger = logger;
    }

    public debug(...msg: any[]): void {
        this._logger.debug(...msg);
    }

    public info(...msg: any[]): void {
        this._logger.info(...msg);
    }

    public warn(...msg: any[]): void {
        this._logger.warn(...msg);
    }

    public error(...msg: any[]): void {
        this._logger.error(...msg);
    }

    /**
     * Set log level
     *
     * @param level - trace, debug, info, warn, error
     */
    public setLevel(level: LogLevel): void {
        this._logger.setLevel(level);
    }
}

const rootLogger = new Logger(log);

const cachedLoggers = {};

export function getLogger(name: string): Logger {
    let logger = cachedLoggers[name];

    if (!logger) {
        logger = new Logger(log.getLogger(name));
        cachedLoggers[name] = logger;
    }

    return logger;
}

export default rootLogger;
