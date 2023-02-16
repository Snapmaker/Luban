import Jimp from 'jimp';
import JPEG from 'jpeg-js';
import configure from '@jimp/custom';

import greyscale from './jimp-plugin-greyscale';
import halftone from './jimp-plugin-halftone';
import threshold from './jimp-plugin-threshold';
import alphaToWhite from './jimp-plugin-alphaToWhite';
import bw from './jimp-plugin-bw';

Jimp.decoders['image/jpeg'] = (data) => JPEG.decode(data, {
    maxMemoryUsageInMB: 6144,
    maxResolutionInMP: 600
});

configure({
    plugins: [
        greyscale,
        halftone,
        threshold,
        alphaToWhite,
        bw
    ]
}, Jimp);

// add jimp plugins here, write processor outside is not recommended
export default Jimp;
