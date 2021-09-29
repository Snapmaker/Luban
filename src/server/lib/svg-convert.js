import fs from 'fs';
import _ from 'lodash';
import potrace from 'potrace';
import * as opentype from 'opentype.js';
import { pathWithRandomSuffix } from './random-utils';
// import fontManager from './FontManager';
import logger from './logger';
import SVGParser from '../../shared/lib/SVGParser';
import fontManager from '../../shared/lib/FontManager';
import DataStorage from '../DataStorage';
import { svgToString } from '../../shared/lib/SVGParser/SvgToString';

const log = logger('svg-convert');

const TEMPLATE = `<?xml version="1.0" encoding="utf-8"?>
<svg
    version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0" y="0" width="<%= width %>" height="<%= height %>"
    viewBox="<%= x0 %> <%= y0 %> <%= width %> <%= height %>"
>
  <%= path %>
</svg>
`;


/**
 * @param options
 *      - uploadName
 *      - vectorThreshold
 *      - invert
 *      - turdSize
 *
 * @returns {Promise<any>}
 */
const convertRasterToSvg = (options) => {
    const { uploadName, vectorThreshold, invert, turdSize } = options;
    // svg may get here, return the original file
    if (/\.svg$/i.test(uploadName)) {
        return Promise.resolve({
            filename: /parsed\.svg$/i.test(uploadName) ? uploadName : uploadName.replace(/\.svg$/i, 'parsed.svg')
        });
    }
    const outputFilename = pathWithRandomSuffix(`${uploadName}.svg`);
    const modelPath = `${DataStorage.tmpDir}/${uploadName}`;
    const params = {
        threshold: vectorThreshold,
        color: 'black',
        background: 'transparent',
        blackOnWhite: !invert,
        turdSize: turdSize
    };

    return new Promise((resolve, reject) => {
        potrace.trace(`${modelPath}`, params, async (err, svgStr) => {
            if (err) {
                reject(err);
                return;
            }
            const targetPath = `${DataStorage.tmpDir}/${outputFilename}`;
            const svgParser = new SVGParser();

            const result = await svgParser.parse(svgStr);
            const { width, height } = result;

            fs.writeFile(targetPath, svgToString(result), () => {
                resolve({
                    // filename: outputFilename,
                    originalName: outputFilename,
                    filename: outputFilename,
                    width: width,
                    height: height
                });
            });
        });
    });
};

const convertTextToSvg = async (options) => {
    const { text, 'font-size': fontSize, 'line-height': lineHeight, 'font-family': fontFamily, name, alignment } = options;
    const uploadName = pathWithRandomSuffix(name).replace(/\.svg$/i, 'parsed.svg');

    const fontObj = await fontManager.getFont(fontFamily);
    const unitsPerEm = fontObj.unitsPerEm;
    const descender = fontObj.tables.os2.sTypoDescender;

    // Big enough to being rendered clearly on canvas (still has space for improvements)
    const estimatedFontSize = Math.round(fontSize / 72 * 25.4 * 10);

    const lines = text.split('\n');
    const numberOfLines = lines.length;

    const widths = [];
    let maxWidth = 0;
    for (const line of lines) {
        const p = fontObj.getPath(line, 0, 0, estimatedFontSize);
        const bbox = p.getBoundingBox();
        widths.push(bbox.x2 - bbox.x1);
        maxWidth = Math.max(maxWidth, bbox.x2 - bbox.x1);
    }

    // We use descender line as the bottom of a line, first line with lineHeight = 1
    let y = (unitsPerEm + descender) * estimatedFontSize / unitsPerEm, x = 0;
    const fullPath = new opentype.Path();
    for (let i = 0; i < numberOfLines; i++) {
        const line = lines[i];
        const width = widths[i];
        if (alignment === 'left') {
            x = 0;
        } else if (alignment === 'middle') {
            x = (maxWidth - width) / 2;
        } else {
            x = maxWidth - width;
        }
        const p = fontObj.getPath(line, x, y, estimatedFontSize);
        y += estimatedFontSize * lineHeight;
        fullPath.extend(p);
    }
    fullPath.stroke = 'black';
    // if (!fillEnabled || fillDensity === 0) {
    //     fullPath.fill = 'none';
    // }

    // Calculate size and render SVG template
    const boundingBox = fullPath.getBoundingBox();
    const width = boundingBox.x2 - boundingBox.x1;
    const height = estimatedFontSize + estimatedFontSize * lineHeight * (numberOfLines - 1);

    const svgString = _.template(TEMPLATE)({
        path: fullPath.toSVG(),
        x0: boundingBox.x1,
        y0: 0,
        width: width,
        height: height
    });
    return new Promise((resolve, reject) => {
        const targetPath = `${DataStorage.tmpDir}/${uploadName}`;
        fs.writeFile(targetPath, svgString, (err) => {
            if (err) {
                log.error(err);
                reject(err);
            } else {
                resolve({
                    originalName: name,
                    uploadName: uploadName,
                    width: width,
                    height: height
                });
            }
        });
    });
};

// just process one line text, multi-line text can be transfered to text elements in front end
const convertOneLineTextToSvg = async (options) => {
    // const { text, font, name, size, lineHeight, alignment } = options;
    const { text, font, name, size, x, y, bbox } = options;
    const uploadName = pathWithRandomSuffix(name);
    const fontObj = await fontManager.getFont(font);
    const fullPath = new opentype.Path();
    const p = fontObj.getPath(text, x, y, Math.floor(size));
    fullPath.extend(p);
    fullPath.stroke = 'black';
    const svgString = _.template(TEMPLATE)({
        path: fullPath.toSVG(),
        x0: bbox.x,
        y0: bbox.y,
        width: bbox.width,
        height: bbox.height
    });
    return new Promise((resolve, reject) => {
        const targetPath = `${DataStorage.tmpDir}/${uploadName}`;
        fs.writeFile(targetPath, svgString, (err) => {
            if (err) {
                log.error(err);
                reject(err);
            } else {
                resolve({
                    originalName: name,
                    uploadName: uploadName,
                    width: bbox.width,
                    height: bbox.height
                });
            }
        });
    });
};


export { convertRasterToSvg, convertTextToSvg, convertOneLineTextToSvg };
