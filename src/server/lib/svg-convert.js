import fs from 'fs';
import _ from 'lodash';
import potrace from 'potrace';
import * as opentype from 'opentype.js';
import { pathWithRandomSuffix } from './random-utils';
// import fontManager from './FontManager';
import logger from './logger';
import SVGParser from '../../shared/lib/SVGParser';
import fontManager from '../../shared/lib/FontManager';
import { svgToString } from '../../shared/lib/SVGParser/SvgToString';

const log = logger('svg-convert');

const TEMPLATE = `<?xml version="1.0" encoding="utf-8"?>
<svg
    version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0" y="0" preserveAspectRatio="none"
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
        if (!(/parsed\.svg$/i.test(uploadName))) {
            const newUploadName = uploadName.replace(/\.svg$/i, 'parsed.svg');
            const uploadPath = `${process.env.Tmpdir}/${newUploadName}`;
            if (fs.existsSync(uploadPath)) {
                return Promise.resolve({
                    filename: newUploadName
                });
            }
            return Promise.resolve({
                filename: uploadName
            });
        } else {
            return Promise.resolve({
                filename: uploadName
            });
        }
    }
    const outputFilename = pathWithRandomSuffix(`${uploadName}.svg`);
    const modelPath = `${process.env.Tmpdir}/${uploadName}`;
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
            const targetPath = `${process.env.Tmpdir}/${outputFilename}`;
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
    const { text, 'font-size': fontSize, 'line-height': lineHeight, 'font-family': fontFamily, style, name, alignment } = options;
    const uploadName = pathWithRandomSuffix(name).replace(/\.svg$/i, 'parsed.svg');

    const fontObj = await fontManager.getFont(fontFamily, null, style);
    const unitsPerEm = fontObj.unitsPerEm;
    // https://docs.microsoft.com/en-us/typography/opentype/spec/os2#stypoascender
    // TODO: The USE_TYPO_METRICS flag (bit 7) of the fsSelection field is used to choose between using sTypo* values or usWin* values for default line metrics.
    // See fsSelection for additional details.
    const descender = _.isNil(fontObj?.tables?.os2?.sTypoDescender) ? fontObj?.descender : (fontObj?.tables?.os2?.sTypoDescender || 0);
    const ascender = _.isNil(fontObj?.tables?.os2?.sTypoAscender) ? fontObj?.ascender : (fontObj?.tables?.os2?.sTypoAscender || 0);
    const sTypoLineGap = fontObj?.tables?.os2?.sTypoLineGap || 0;
    // Big enough to being rendered clearly on canvas (still has space for improvements)
    const realUnitsPerEm = (ascender - descender + sTypoLineGap) > unitsPerEm ? (ascender - descender + sTypoLineGap) : unitsPerEm;
    const estimatedFontSize = (fontSize / 72 * 25.4 * 10) * (realUnitsPerEm) / unitsPerEm;

    const lines = text.split('\n');
    const numberOfLines = lines.length;

    const widths = [];
    let maxWidth = 0;
    for (const line of lines) {
        const { path: p } = fontManager.getPathOrDefault(fontObj, line, 0, 0, estimatedFontSize);
        const bbox = p.getBoundingBox();
        widths.push(bbox.x2 - bbox.x1);
        maxWidth = Math.max(maxWidth, bbox.x2 - bbox.x1);
    }

    // We use descender line as the bottom of a line, first line with lineHeight = 1
    let y = (ascender - descender + sTypoLineGap) > unitsPerEm ? estimatedFontSize
            : (realUnitsPerEm + descender) / realUnitsPerEm * estimatedFontSize, x = 0;
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
        const { path: p } = fontManager.getPathOrDefault(fontObj, line, x, y, estimatedFontSize);

        y += estimatedFontSize * lineHeight;
        fullPath.extend(p);
    }
    fullPath.stroke = 'black';

    // Calculate size and render SVG template
    const boundingBox = fullPath.getBoundingBox();
    const width = boundingBox.x2 - boundingBox.x1;
    // const height = estimatedFontSize + estimatedFontSize * lineHeight * (numberOfLines - 1);
    const height = boundingBox.y2 - boundingBox.y1;

    const svgString = _.template(TEMPLATE)({
        path: fullPath.toSVG(),
        x0: boundingBox.x1,
        y0: boundingBox.y1,
        width: width,
        height: height
    });
    // const svgParser = new SVGParser();
    // // Don't delete, for debugging
    // // const targetPath1 = `${process.env.Tmpdir}/${uploadName}_new.svg`;
    // // fs.writeFileSync(targetPath1, svgString);
    // const result = await svgParser.parse(svgString);
    // unionShapes(result.shapes);

    return new Promise((resolve, reject) => {
        const targetPath = `${process.env.Tmpdir}/${uploadName}`;
        fs.writeFile(targetPath, svgString, (err) => {
            if (err) {
                log.error(err);
                reject(err);
            } else {
                resolve({
                    originalName: name,
                    uploadName: uploadName,
                    family: fontObj?.names?.fontFamily?.en,
                    sourceWidth: width,
                    sourceHeight: height
                });
            }
        });
    });
};

// just process one line text, multi-line text can be transfered to text elements in front end
const convertOneLineTextToSvg = async (options) => {
    const { text, font, name, size, x, y, bbox } = options;
    const uploadName = pathWithRandomSuffix(name);
    const fontObj = await fontManager.getFont(font);
    const fullPath = new opentype.Path();
    const { path: p } = fontManager.getPathOrDefault(fontObj, text, x, y, Math.floor(size));
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
        const targetPath = `${process.env.Tmpdir}/${uploadName}`;
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
