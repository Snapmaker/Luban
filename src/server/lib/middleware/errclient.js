/**
 * errclient
 *
 * Examples:
 *
 *     app.use(middleware.errclient({ error: 'XHR error' }))
 *
 * Options:
 *
 *   - error    error message
 *
 * @param {Object} options
 * @return {Function}
 * @api public
 */

const errclient = (options) => {
    options = options || {};

    const error = options.error || '';

    return (err, req, res, next) => {
        if (req.xhr) {
            res.status(500).send({
                error: error
            });
            return;
        }

        next(err);
    };
};

module.exports = errclient;
