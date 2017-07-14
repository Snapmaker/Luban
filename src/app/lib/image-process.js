import Jimp from 'jimp';
import path from 'path';

var bit = function (x) {
    if (x >= 128) {
        return 255;
    } else {
        return 0;
    }
};

var normailize = function (x) {
    if (x < 0) {
        return 0;
    } else if (x > 255) {
        return 255;
    }
    return x;
};



function process(param, cb) {
    let filename = path.basename(param.originSrc);
    const {imageWidth, imageHeight, whiteClip} = param;

    Jimp.read(`../web/images/${filename}`, function (err, lena) {
        if (err) {
            throw err;
        }
        let salt = Math.random();
        //lenna.resize(394, 304)
        lena.resize(parseFloat(imageWidth), parseFloat(imageHeight))
            .brightness((param.brightness - 50.0) / 50)
            .contrast((param.contrast - 50.0) / 50)
            .quality(100)
            .greyscale()
            .scan(0, 0, lena.bitmap.width, lena.bitmap.height, function (x, y, idx) {
                for (let k = 0; k < 3; ++k) {
                    if (this.bitmap.data[idx + k] >= whiteClip) {
                        this.bitmap.data[idx + k] = 255;
                    }
                }
            })
            .scan(0, 0, lena.bitmap.width, lena.bitmap.height, function (x, y, idx) {
                let length = this.bitmap.data.length;
                for (let k = 0; k < 3; ++k) {
                    let _idx = idx + k;
                    var origin = this.bitmap.data[_idx];
                    this.bitmap.data[idx + k] = bit(origin);

                    var err = -this.bitmap.data[_idx] + origin;
                    //console.log(err);

                    if (x + 1 < this.bitmap.width) {
                        this.bitmap.data[_idx + 4] = normailize(this.bitmap.data[_idx + 4] + err * 7.0 / 16);
                    }
                    if (x - 1 >= 0 && y + 1 < this.bitmap.height) {
                        this.bitmap.data[_idx + this.bitmap.width * 4 - 4] = normailize(
                            this.bitmap.data[_idx + this.bitmap.width * 4 - 4] + err * 3.0 / 16);
                    }
                    if (y + 1 < this.bitmap.height) {
                        this.bitmap.data[_idx + this.bitmap.width * 4] = normailize(
                            this.bitmap.data[_idx + this.bitmap.width * 4] + err * 5.0 / 16);
                    }
                    if (x + 1 < this.bitmap.width && y + 1 < this.bitmap.height) {
                        this.bitmap.data[_idx + this.bitmap.width * 4 + 4] = normailize(
                            this.bitmap.data[_idx + this.bitmap.width * 4 + 4] + err * 1.0 / 16);
                    }

                }
            })
            .write(`../web/images/test-${salt}.png`, function() {
                cb(salt);
            });
    });
}

export default process;