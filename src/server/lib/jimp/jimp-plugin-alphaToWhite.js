import { isNodePattern } from '@jimp/utils';

/**
 * justify opacity to img, just like put img before white paper
 * @param {function} cb (optional) a callback for when complete
 * @return {this} this for chaining of methods
 */
export default () => ({
    alphaToWhite(cb) {
        this.scan(0, 0, this.bitmap.width, this.bitmap.height, (x, y, idx) => {
            const opacity = 1 - this.bitmap.data[idx + 3] / 255;
            for (let i = 0; i < 3; i++) {
                this.bitmap.data[idx + i] += (255 - this.bitmap.data[idx + i]) * opacity;
            }

            this.bitmap.data[idx + 3] = 255;
        });

        if (isNodePattern(cb)) {
            cb.call(this, null, this);
        }

        return this;
    }
});
