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


const algorithms = {
    Atkinson: [
        [0, 0, 1 / 8, 1 / 8],
        [1 / 8, 1 / 8, 1 / 8, 0],
        [0, 1 / 8, 0, 0]
    ],
    Burks: [
        [0, 0, 0, 8 / 32, 4 / 32],
        [2 / 32, 4 / 32, 8 / 32, 4 / 32, 2 / 32]
    ],
    FloyedSteinburg: [
        [0, 0, 7 / 16],
        [3 / 16, 5 / 16, 1 / 16]
    ],
    JarvisJudiceNinke: [
        [0, 0, 0, 7 / 18, 5 / 48],
        [3 / 48, 5 / 48, 7 / 48, 5 / 48, 3 / 48],
        [1 / 48, 3 / 48, 5 / 48, 3 / 48, 1 / 48]
    ],
    Sierra2: [
        [0, 0, 0, 4 / 16, 3 / 16],
        [1 / 16, 2 / 16, 3 / 16, 2 / 16, 1 / 16]
    ],
    Sierra3: [
        [0, 0, 0, 5 / 32, 3 / 32],
        [2 / 32, 4 / 32, 5 / 32, 4 / 32, 2 / 32],
        [0, 2 / 32, 3 / 32, 2 / 32, 0]
    ],
    SierraLite: [
        [0, 0, 2 / 4],
        [1 / 4, 1 / 4, 0]
    ],
    Stucki: [
        [0, 0, 0, 8 / 42, 4 / 42],
        [2 / 42, 4 / 42, 8 / 42, 4 / 42, 2 / 42],
        [1 / 42, 2 / 42, 4 / 42, 2 / 42, 1 / 42]
    ]
};


function process(param, cb) {
    let filename = path.basename(param.originSrc);
    const { imageWidth, imageHeight, whiteClip, algorithm } = param;

    const matrix = algorithms[algorithm];
    const _matrixHeight = matrix.length;
    const _matrixWidth = matrix[0].length;


    let _startingOffset = 0;
    for (let k = 1; k < _matrixWidth; k++) {
        if (matrix[0][k] > 0) {
            _startingOffset = k - 1;
            break;
        }
    }

    Jimp.read(`../web/images/${filename}`, (err, lena) => {
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
            .scan(0, 0, lena.bitmap.width, lena.bitmap.height, (x, y, idx) => {
                for (let k = 0; k < 3; ++k) {
                    if (this.bitmap.data[idx + k] >= whiteClip) {
                        this.bitmap.data[idx + k] = 255;
                    }
                }
            })
            .scan(0, 0, lena.bitmap.width, lena.bitmap.height, (x, y, idx) => {
                for (let k = 0; k < 3; ++k) {
                    let _idx = idx + k;
                    var origin = this.bitmap.data[_idx];
                    this.bitmap.data[_idx] = bit(origin);

                    var err = -this.bitmap.data[_idx] + origin;
                    //console.log(err);

                    for (let i = 0; i < _matrixWidth; i++) {
                        for (let j = 0; j < _matrixHeight; j++) {
                            if (matrix[j][i] > 0) {
                                let _x = x + i - _startingOffset;
                                let _y = y + j;

                                if (_x >= 0 && _x < this.bitmap.width && _y < this.bitmap.height) {
                                    let _idx2 = _idx + (_x - x) * 4 + (_y - y) * this.bitmap.width * 4;
                                    this.bitmap.data[_idx2] = normailize(this.bitmap.data[_idx2] + matrix[j][i] * err);
                                }
                            }
                        }
                    }
                }
            })
            .write(`../web/images/test-${salt}.png`, () => {
                cb(salt);
            });
    });
}

export default process;
