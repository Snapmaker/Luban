import fs from 'fs';
import path from 'path';
import Jimp from 'jimp';
import convert from 'color-convert';
// import { Potrace } from 'potrace';
import SVGParser from './SVGParser';
import { APP_CACHE_IMAGE } from '../constants';
import { pathWithRandomSuffix } from './random-utils';

const BLACK = 360;
const colorTolerance = 20;

function imageBitSet(image, index, r, g, b, a) {
    g = (g === undefined) ? r : g;
    b = (b === undefined) ? r : b;
    a = (a === undefined) ? 255 : a;

    const data = image.bitmap.data;
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = a;
}

function imageBitRGB(image, index) {
    const data = image.bitmap.data;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    return [r, g, b];
}

function imageBitRGB2HSV(image, index) {
    const data = image.bitmap.data;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    return convert.rgb.hsv([r, g, b]);
}

function hueDiff(a, b) {
    return Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
}

/*
function hsvDiff(ha, sa, va, hb, sb, vb) {
    const dh = Math.min(Math.abs(ha - hb), 360 - Math.abs(ha, hb)) / 180.0;
    const ds = Math.abs(sa - sb) / 100.0;
    const dv = Math.abs(va - vb) / 100.0;
    return dh * dh + ds * ds + dv * dv;
}
*/

function isBlack(h, s, v, blackThreshold) {
    if (v <= blackThreshold) {
        return true;
    }
    if (s < 10) {
        return v <= 50;
    }
    return (h === 0 && s === 0);
}

function getArray2D(width, height, value) {
    const a = [];
    for (let i = 0; i < width; i++) {
        const sub = [];
        for (let j = 0; j < height; j++) {
            sub.push(value);
        }
        a.push(sub);
    }
    return a;
}

// opencv modules/imgproc/src/smooth.dispatch.cpp
function createGaussianKernel(n, sigma) {
    sigma = Math.max(sigma, 0);
    let sum = 0;
    const scale = -0.5 / (sigma * sigma);
    const n2 = Math.floor(n / 2);
    const kernel = [];
    for (let i = 0; i < n; i++) {
        const values = [];
        for (let j = 0; j < n; j++) {
            let d2 = (i - n2) * (i - n2) + (j - n2) * (j - n2);
            values.push(Math.exp(d2 * scale));
            sum += values[j];
        }
        kernel.push(values);
    }
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            kernel[i][j] /= sum;
        }
    }
    return kernel;
}

function sortHue(image, binarization, blackThreshold) {
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const hueCount = [];
    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            const index = j * width * 4 + i * 4;

            if (binarization.bitmap.data[index] === 0) {
                const [h, s, v] = imageBitRGB2HSV(image, index);
                if (isBlack(h, s, v, blackThreshold)) {
                    hueCount[BLACK] = (hueCount[BLACK] || 0) + 1;
                } else {
                    hueCount[h] = (hueCount[h] || 0) + 1;
                }
            }
        }
    }

    const hues = [];
    for (let i = 0; i <= 360; i++) {
        hues.push({
            hue: i,
            count: hueCount[i] || 0
        });
    }

    hues.sort((a, b) => (b.count - a.count));
    return hues;
}

function processSVG(svg) {
    const cachePrefix = pathWithRandomSuffix('');
    const cacheSuffix = 'svg';
    const filenames = [];
    let outputCount = 0;
    const boundingBox = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    };

    for (const shape of svg.shapes) {
        if (shape.visibility) {
            boundingBox.minX = Math.min(boundingBox.minX, shape.boundingBox.minX);
            boundingBox.maxX = Math.max(boundingBox.maxX, shape.boundingBox.maxX);
            boundingBox.minY = Math.min(boundingBox.minY, shape.boundingBox.minY);
            boundingBox.maxY = Math.max(boundingBox.maxY, shape.boundingBox.maxY);
        }
    }
    const width = boundingBox.maxX - boundingBox.minX;
    const height = boundingBox.maxY - boundingBox.minY;
    for (const shape of svg.shapes) {
        if (shape.visibility) {
            const svgCollection = {
                pathCollections: []
            };
            const pathCollection = {
                paths: shape.paths,
                color: shape.fill
            };
            svgCollection.pathCollections.push(pathCollection);
            filenames.push(`trace_${outputCount}${cachePrefix}.${cacheSuffix}`);
            fs.writeFileSync(`${APP_CACHE_IMAGE}/${filenames[outputCount++]}`, getSVG(width, height, svgCollection));
        }
    }
    return {
        filenames: filenames
    };
}

function getSVG(width, height, svgCollection) {
    return `<svg xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 ${width} ${height}"
        version="1.1">
        ${svgCollection.pathCollections.map(pathCollection => getPath(pathCollection))}
      </svg>`;
}

function getPath(pathCollection) {
    let pathExpression = '';

    for (const path of pathCollection.paths) {
        pathExpression += 'M';
        for (const point of path.points) {
            pathExpression += `${point[0]} ${point[1]} `;
        }
    }

    const color = `rgb(${pathCollection.color[0]}, ${pathCollection.color[1]}, ${pathCollection.color[2]})`;

    return `<path d="${pathExpression}" fill="${color}" fill-rule="evenodd" />`;
}

function getColors(hues, numberOfObjects) {
    const colors = [];
    colors.push(hues[0].hue);

    let i = 1;
    for (let k = 1; k < numberOfObjects; k++) {
        while (i < 360 && hues[i].count) {
            let flag = true;
            for (let j = 0; j < k; j++) {
                if (colors[j] !== BLACK && hues[i].hue !== BLACK) {
                    const hdiff = hueDiff(hues[i].hue, colors[j]);
                    if (hdiff <= colorTolerance) {
                        flag = false;
                        break;
                    }
                }
            }
            if (flag) {
                colors.push(hues[i].hue);
                i += 1;
                break;
            }
            i += 1;
        }
    }
    return colors;
}

function getMap(image, binarization, colors, blackThreshold, numberOfObjects) {
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    const dx = [-1, -1, -1, 0, 0, 1, 1, 1];
    const dy = [-1, 0, 1, -1, 1, -1, 0, 1];

    const map = getArray2D(width, height, -1);
    const dist = getArray2D(width, height, -1);

    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            const index = j * width * 4 + i * 4;

            if (binarization.bitmap.data[index] === 0) {
                const [h, s, v] = imageBitRGB2HSV(image, index);
                const black = isBlack(h, s, v, blackThreshold);

                for (let k = 0; k < numberOfObjects; k++) {
                    if (colors[k] === BLACK && black) {
                        map[i][j] = k;
                        break;
                    } else if (colors[k] !== BLACK && !black) {
                        const d = hueDiff(h, colors[k]);
                        if (d <= colorTolerance) {
                            if (map[i][j] === -1 || d < dist[i][j]) {
                                map[i][j] = k;
                                dist[i][j] = d;
                            }
                        }
                    }
                }
            }
        }
    }

    let interations = 0;
    while (interations < 8) {
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                if (map[i][j] !== -1) {
                    const count = { [map[i][j]]: 1 };
                    for (let d = 0; d < 8; d++) {
                        const i2 = i + dx[d];
                        const j2 = j + dy[d];
                        if (i2 >= 0 && i2 < width && j2 >= 0 && j2 < height) {
                            if (map[i2][j2] !== -1) {
                                count[map[i2][j2]] = (count[map[i2][j2]] || 0) + 1;
                            }
                        }
                    }
                    let selectedK = map[i][j];
                    for (let k = 0; k < numberOfObjects; k++) {
                        if (count[k] && (selectedK === -1 || count[k] > count[selectedK])) {
                            selectedK = k;
                        }
                    }
                    if (selectedK !== map[i][j]) {
                        map[i][j] = selectedK;
                    }
                }
            }
        }
        interations++;
    }
    return map;
}

async function trace(options) {
    const filename = options.filename;
    /*
    const params = {
        // threshold: options.threshold, // 160,
        // thV: options.thV,
        // uploadType: options.uploadType, // 'raster'
        turdSize: options.turdSize
    };
    */
    const blackThreshold = options.blackThreshold;
    const maskThreshold = (options.maskThreshold - 50) * 0.5;
    // const maskThreshold = options.maskThreshold;
    const numberOfObjects = options.objects;
    // svg
    if (path.extname(filename).toLowerCase() === '.svg') {
        const svgParser = new SVGParser();
        const svg = await svgParser.parseFile(`${APP_CACHE_IMAGE}/${filename}`);
        return processSVG(svg);
    }
    const image = await Jimp.read(`${APP_CACHE_IMAGE}/${filename}`);

    const width = image.bitmap.width;
    const height = image.bitmap.height;


    const kernel = createGaussianKernel(7, 1.5);
    const imageBlur = image.clone();
    imageBlur.convolute(kernel);
    const greyscaleBlur = imageBlur.clone().greyscale();
    // const imagePP = await preprocess2(image, thV);
    const greyscale = image.clone().greyscale();

    // Binarization
    const binarization = new Jimp(width, height);
    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            const index = j * width * 4 + i * 4;
            const value = greyscale.bitmap.data[index];
            const valueBlur = greyscaleBlur.bitmap.data[index];
            const valueDiff = value - valueBlur;
            if (valueDiff >= maskThreshold || greyscale.bitmap.data[index + 3] === 0) {
                imageBitSet(binarization, index, 255);
            } else {
                imageBitSet(binarization, index, 0);
            }
        }
    }

    const hues = sortHue(image, binarization, blackThreshold);
    const colors = getColors(hues, numberOfObjects);

    const outputImages = [];
    for (let k = 0; k < numberOfObjects; k++) {
        outputImages.push(new Jimp(width, height));
    }
    const map = getMap(image, binarization, colors, blackThreshold, numberOfObjects);

    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            const index = j * width * 4 + i * 4;
            const k = map[i][j];
            if (k !== -1) {
                const [r, g, b] = imageBitRGB(image, index);
                imageBitSet(outputImages[k], index, r, g, b);
            }
        }
    }

    const traceRasters = [];
    // const traceSVGs = [];
    // const uploadImages = [];
    return new Promise(resolve => {
        let writeCount = 0;
        for (let k = 0; k < numberOfObjects; k++) {
            const prefixRaster = pathWithRandomSuffix(`trace_raster_${k}`);
            const traceRaster = `${prefixRaster}.png`;
            traceRasters.push(traceRaster);
            outputImages[k].write(`${APP_CACHE_IMAGE}/${traceRaster}`, () => {
                writeCount++;
                if (writeCount === numberOfObjects) {
                    resolve({
                        filenames: traceRasters
                    });
                }
            });
        }
    });
}

export default trace;
