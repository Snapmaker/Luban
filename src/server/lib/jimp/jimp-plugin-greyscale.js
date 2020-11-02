// fix greyscale

const EPS = 1e-6;
export default () => ({
    greyscale(cb) {
        this.scan(0, 0, this.bitmap.width, this.bitmap.height, (x, y, idx) => {
            const grey = parseInt(0.2126 * this.bitmap.data[idx] + 0.7152 * this.bitmap.data[idx + 1] + 0.0722 * this.bitmap.data[idx + 2] + EPS, 10);
            this.bitmap.data[idx] = grey;
            this.bitmap.data[idx + 1] = grey;
            this.bitmap.data[idx + 2] = grey;
        });

        if (cb) {
            return cb.call(this, null, this);
        } else {
            return this;
        }
    }
});
