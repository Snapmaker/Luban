import winston from 'winston';

export const logger = winston.createLogger({
    level: 'silly',
    transports: [
        new winston.transports.Console({
            colorize: true,
            timestamp: true,
            handleExceptions: true,
            json: false
        })
    ]
});
