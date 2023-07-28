// fix greyscale

const EPS = 1e-6;

const getGrey = (algorithm, R, G, B) => {
    let grey;
    if (algorithm === 'Luster') {
        grey = (Math.max(R, G, B) + Math.min(R, G, B)) * 0.5;
    } else if (algorithm === 'Luminance') {
        grey = 0.3 * R + 0.59 * G + 0.11 * B;
    } else {
        grey = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    }
    return parseInt(grey + EPS, 10);
};

export default () => ({
    greyscale(algorithm, cb) {
        this.scan(0, 0, this.bitmap.width, this.bitmap.height, (x, y, idx) => {
            // const grey = parseInt(0.2126 * this.bitmap.data[idx] + 0.7152 * this.bitmap.data[idx + 1] + 0.0722 * this.bitmap.data[idx + 2] + EPS, 10);
            const grey = getGrey(algorithm, this.bitmap.data[idx], this.bitmap.data[idx + 1], this.bitmap.data[idx + 2]);
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
