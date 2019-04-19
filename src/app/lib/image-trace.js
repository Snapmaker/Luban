import fs from 'fs';
import assert from 'assert';
import Jimp from 'jimp';
import convert from 'color-convert';
import { Potrace } from 'potrace';
import SVGParser from './SVGParser';
import { APP_CACHE_IMAGE } from '../constants';
import { pathWithRandomSuffix } from './random-utils';

const options = {
    colorTolerance: 30
};

function isPointInsidePath(point, path) {
    let inside = false;
    for (let i = 0, len = path.points.length - 1; i < len; i++) {
        const p = path.points[i];
        const q = path.points[i + 1];

        if ((p[1] > point[1]) !== (q[1] > point[1]) &&
            point[0] < p[0] + (q[0] - p[0]) * (point[1] - p[1]) / (q[1] - p[1])) {
            inside = !inside;
        }
    }
    return inside;
}

function preprocess(filename, options) {
    const filenamePreprocessed = pathWithRandomSuffix(filename);
    return Jimp
        .read(`${APP_CACHE_IMAGE}/${filename}`)
        .then(img => new Promise(resolve => {
            img
                .scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
                    let t1 = new Array(3);
                    let t2 = new Array(3);
                    t1 = convert.rgb.hsv([img.bitmap.data[idx], img.bitmap.data[idx + 1], img.bitmap.data[idx + 2]]);
                    if (t1[2] > options.thV) {
                        t1[2] = 100;
                    }
                    t2 = convert.hsv.rgb(t1);
                    [img.bitmap.data[idx], img.bitmap.data[idx + 1], img.bitmap.data[idx + 2]] = t2;
                })
                .write(`${APP_CACHE_IMAGE}/${filenamePreprocessed}`, () => {
                    resolve({
                        filenamePreprocessed: filenamePreprocessed
                    });
                });
        }));
}

function process(image, svg) {
    assert(svg.shapes.length === 1);

    const shape = svg.shapes[0];
    const numberOfPaths = shape.paths.length;

    const outerPathMap = new Array(numberOfPaths);
    const isPaired = new Array(numberOfPaths);

    const pathGroups = [];
    let pairingFlag = true;

    const bitmap = image.bitmap;
    const colorBg = [0, 0, 0, 0];
    const colors = [];
    // convert to multiple SVG files
    const isGrouped = new Array(pathGroups.length);
    const filenames = [];
    const cachePrefix = pathWithRandomSuffix('_');
    const cacheSuffix = 'svg';
    // const svgCollections = [];

    let outputCount = 0;
    for (let i = 0; i < numberOfPaths; i++) {
        outerPathMap[i] = new Array(numberOfPaths);
        isPaired[i] = false;
    }

    for (let i = 0; i < numberOfPaths; i++) {
        const path = shape.paths[i];

        for (let j = 0; j < numberOfPaths; j++) {
            if (i === j) {
                continue;
            }

            const path2 = shape.paths[j];
            if (path2.closed && isPointInsidePath(path.points[0], path2)) {
                outerPathMap[i][j] = 1;
            }
        }
    }

    while (pairingFlag) {
        pairingFlag = false;

        for (let i = 0; i < numberOfPaths; i++) {
            if (isPaired[i]) {
                continue;
            }

            let selected = -1;
            for (let j = 0; j < numberOfPaths; j++) {
                if (!isPaired[j] && outerPathMap[i][j]) {
                    if (selected === -1) {
                        selected = j;
                    } else {
                        selected = -1;
                        break;
                    }
                }
            }

            if (selected !== -1) {
                isPaired[i] = true;
                isPaired[selected] = true;
                pathGroups.push([selected, i]);
                pairingFlag = true;
            }
        }
    }

    for (let i = 0; i < numberOfPaths; i++) {
        if (!isPaired[i]) {
            pathGroups.push([i]);
        }
    }

    for (let x = 0; x < image.bitmap.width; x++) {
        for (let y = 0; y < image.bitmap.height; y++) {
            const index = y * bitmap.width * 4 + x * 4;

            for (let k = 0; k < 4; k++) {
                colorBg[k] += bitmap.data[index + k];
            }
        }
    }
    for (let k = 0; k < 4; k++) {
        colorBg[k] = Math.round(colorBg[k] / image.bitmap.width / image.bitmap.height);
    }

    for (const pathGroup of pathGroups) {
        let colorSum = [0, 0, 0, 0];
        let colorCount = 0;

        const path = shape.paths[pathGroup[0]];

        for (const point of path.points) {
            const x = Math.round(point[0]);
            const y = Math.round(point[1]);

            const index = y * bitmap.width * 4 + x * 4;
            for (let k = 0; k < 4; k++) {
                colorSum[k] += bitmap.data[index + k];
            }
            colorCount += 1;
        }

        for (let i = 0; i < 4; i++) {
            colorSum[i] = Math.round(colorSum[i] / colorCount) * 2 - colorBg[i];
        }
        // console.log(colorSum);
        colors.push(colorSum);
    }

    for (let i = 0; i < pathGroups.length; i++) {
        if (isGrouped[i]) {
            continue;
        }

        const svgCollection = {
            pathCollections: []
        };

        isGrouped[i] = true;
        const pathGroup = pathGroups[i];
        const pathCollection = {
            paths: [],
            color: colors[i]
        };
        for (const j of pathGroup) {
            pathCollection.paths.push(shape.paths[j]);
        }
        svgCollection.pathCollections.push(pathCollection);

        for (let j = i + 1; j < pathGroups.length; j++) {
            if (isGrouped[j]) {
                continue;
            }
            let flag = true;
            for (let k = 0; k < 4; k++) {
                if (Math.abs(colors[j][0] - colors[i][0]) > options.colorTolerance) {
                    flag = false;
                    break;
                }
            }

            if (flag) {
                isGrouped[j] = true;
                const pathGroup = pathGroups[j];
                const pathCollection = {
                    paths: [],
                    color: colors[j]
                };
                for (const l of pathGroup) {
                    pathCollection.paths.push(shape.paths[l]);
                }
                svgCollection.pathCollections.push(pathCollection);
            }
        }
        // svgCollections.push(svgCollection);
        if (svgCollection.pathCollections) {
            filenames.push(`trace_${i}${cachePrefix}.${cacheSuffix}`);
            fs.writeFileSync(`${APP_CACHE_IMAGE}/${filenames[outputCount++]}`, getSVG(bitmap.width, bitmap.height, svgCollection));
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

function trace(options) {
    const filename = options.filename;
    const params = {
        // fillStrategy: potrace.FILL_MEAN,
        turdSize: options.turdSize, // 20 speckles
        threshold: options.threshold, // 160,
        thV: options.thV // 33
    };
    console.log('trace options ', options);
    console.log('trace params', params);

    const potrace = new Potrace(params);
    return new Promise(async (resolve, reject) => {
        const { filenamePreprocessed } = await preprocess(filename, params);
        potrace.loadImage(`${APP_CACHE_IMAGE}/${filenamePreprocessed}`, async (err) => {
            if (err) {
                reject(err);
                return;
            }
            const svgString = potrace.getSVG();
            fs.writeFileSync(`${APP_CACHE_IMAGE}/trace_potrace.svg`, svgString);

            const svgParser = new SVGParser();
            const svg = await svgParser.parse(svgString);

            Jimp
                .read(`${APP_CACHE_IMAGE}/${filenamePreprocessed}`)
                .then(img => {
                    resolve(process(img, svg));
                });
        });
    });
}

export default trace;
