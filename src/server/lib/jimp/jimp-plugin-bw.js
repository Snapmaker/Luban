import { isNodePattern, throwError } from '@jimp/utils';

/**
 * Applies a bwThreshold  to a greyscale image.
  * @param {number} options object
 *  threshold: A number auto limited between 0 - 255. value > threshold => 255, else 0
 *  autoGreyscale: (optional) A boolean whether to apply greyscale beforehand (default true)
 * @param {function} cb (optional) a callback for when complete
 * @return {this} this for chaining of methods
 */
export default () => ({
    bw(threshold, cb) {
        if (typeof threshold !== 'number') {
            return throwError.call(this, 'threshold must be a number', cb);
        }

        threshold = this.constructor.limit255(threshold);

        this.scan(0, 0, this.bitmap.width, this.bitmap.height, (x, y, idx) => {
            const value = this.bitmap.data[idx] < threshold ? 0 : 255;
            this.bitmap.data[idx] = value;
            this.bitmap.data[idx + 1] = value;
            this.bitmap.data[idx + 2] = value;
        });

        if (isNodePattern(cb)) {
            cb.call(this, null, this);
        }

        return this;
    }
});
