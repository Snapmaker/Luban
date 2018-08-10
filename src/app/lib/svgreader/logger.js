import winston from 'winston';


const { combine, colorize, timestamp, printf } = winston.format;
export const logger = winston.createLogger({
    level: 'silly',
    transports: new winston.transports.Console({
        format: combine(
            colorize(),
            timestamp(),
            printf(log => `${log.timestamp} - ${log.level} ${log.message}`)
        ),
        handleExceptions: true
    })
});
