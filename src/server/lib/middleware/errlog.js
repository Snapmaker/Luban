/**
 * errlog:
 *
 *   Write request and error information to stderr, loggly, or similar services.
 *
 * Examples:
 *
 *   app.use(middleware.errlog())
 *
 * @return {Function}
 * @api public
 */
import logger from '../logger';

const log = logger('errlog');

const errlog = () => {
    return (err, req, res, next) => {
        log.error(err.stack);
        next(err);
    };
};

module.exports = errlog;
