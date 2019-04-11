import fs from 'fs';
import assert from 'assert';
import Jimp from 'jimp';
import { Potrace } from 'potrace';
import SVGParser from './SVGParser';
import { APP_CACHE_IMAGE } from '../constants';
// import { pathWithRandomSuffix } from './random-utils';

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

function process(image, svg) {
    assert(svg.shapes.length === 1);

    const shape = svg.shapes[0];
    const numberOfPaths = shape.paths.length;

    console.log('paths', numberOfPaths);
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
    const cachePrefix = '_cache_trace_ouput_';
    const cacheSuffix = '.svg';
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
            filenames.push(`${APP_CACHE_IMAGE}/${cachePrefix}${i}${cacheSuffix}`);
            fs.writeFileSync(filenames[outputCount++], getSVG(bitmap.width, bitmap.height, svgCollection));
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

function trace(modelInfo) {
    const { filename } = modelInfo.source;
    // const { invertGreyscale, bwThreshold, density } = modelInfo.config;

    // const outputFilename = pathWithRandomSuffix(filename);

    const options = {
        // fillStrategy: potrace.FILL_MEAN,
        turdSize: 20, // speckles
        threshold: 160
    };

    const potrace = new Potrace(options);
    return new Promise((resolve, reject) => {
        potrace.loadImage(`${APP_CACHE_IMAGE}/${filename}`, async (err) => {
            if (err) {
                reject(err);
                return;
            }
            const svgString = potrace.getSVG();
            fs.writeFileSync(`${APP_CACHE_IMAGE}/_cache_potrace.svg`, svgString);

            const svgParser = new SVGParser();
            const svg = await svgParser.parse(svgString);

            const image = await Jimp.read(`${APP_CACHE_IMAGE}/${filename}`);
            resolve(process(image, svg));
        });
    });
}

export default trace;
