import fs from 'fs';
import _ from 'lodash';
import potrace from 'potrace';
import * as opentype from 'opentype.js';
import { pathWithRandomSuffix } from './random-utils';
import fontManager from './FontManager';
import logger from '../lib/logger';
import { APP_CACHE_IMAGE } from '../constants';

const log = logger('svg-convert');

const TEMPLATE = `<?xml version="1.0" encoding="utf-8"?>
<svg 
    version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0" y="0" width="<%= width %>" height="<%= height %>" 
    viewBox="<%= x0 %> <%= y0 %> <%= width %> <%= height %>"
>
  <%= path %>
</svg>
`;

const convertRasterToSvg = (options) => {
    const { filename, vectorThreshold, isInvert, turdSize } = options;
    log.info('convertRasterToSvg options: ' + JSON.stringify(options));
    const outputFilename = pathWithRandomSuffix(filename + '.svg');
    const modelPath = `${APP_CACHE_IMAGE}/${filename}`;
    const params = {
        threshold: vectorThreshold,
        color: 'black',
        background: 'white',
        blackOnWhite: !isInvert,
        turdSize: turdSize
    };

    return new Promise((resolve, reject) => {
        potrace.trace(`${modelPath}`, params, (err, svg) => {
            if (err) {
                reject(err);
                return;
            }
            const targetPath = `${APP_CACHE_IMAGE}/${outputFilename}`;
            fs.writeFile(targetPath, svg, () => {
                log.info('raster save svg -> ' + targetPath);
                resolve({
                    filename: outputFilename
                });
            });
        });
    });
};

const convertTextToSvg = (options) => {
    const { text, font, size, lineHeight, alignment, fillEnabled, fillDensity } = options;

    const outputFilename = pathWithRandomSuffix('text.svg');

    return fontManager
        .getFont(font)
        .then((font) => {
            const unitsPerEm = font.unitsPerEm;
            const descender = font.tables.os2.sTypoDescender;

            // big enough to being rendered clearly on canvas (still has space for improvements)
            const estimatedFontSize = Math.round(size / 72 * 25.4 * 10);

            const lines = text.split('\n');
            const numberOfLines = lines.length;

            const widths = [];
            let maxWidth = 0;
            for (const line of lines) {
                const p = font.getPath(line, 0, 0, estimatedFontSize);
                const bbox = p.getBoundingBox();
                widths.push(bbox.x2 - bbox.x1);
                maxWidth = Math.max(maxWidth, bbox.x2 - bbox.x1);
            }

            // we use descender line as the bottom of a line
            let y = (unitsPerEm * lineHeight + descender) * estimatedFontSize / unitsPerEm, x = 0;
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
                const p = font.getPath(line, x, y, estimatedFontSize);
                y += estimatedFontSize * lineHeight;
                fullPath.extend(p);
            }
            const boundingBox = fullPath.getBoundingBox();

            const width = boundingBox.x2 - boundingBox.x1;
            const height = estimatedFontSize * lineHeight * numberOfLines; // boundingBox.y2 - boundingBox.y1;

            fullPath.stroke = 'black';
            if (!fillEnabled || fillDensity === 0) {
                fullPath.fill = 'none';
            }

            const svgString = _.template(TEMPLATE)({
                path: fullPath.toSVG(),
                x0: boundingBox.x1,
                y0: 0,
                width: width,
                height: height
            });
            return new Promise((resolve, reject) => {
                const targetPath = `${APP_CACHE_IMAGE}/${outputFilename}`;
                fs.writeFile(targetPath, svgString, (err) => {
                    if (err) {
                        log.error(err);
                        reject(err);
                    } else {
                        log.info('text save svg -> ' + targetPath);
                        resolve({
                            filename: outputFilename,
                            width: width,
                            height: height
                        });
                    }
                });
            });
        });
};


export { convertRasterToSvg, convertTextToSvg };
