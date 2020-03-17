// Dependencies:
// * http://jquery.com/
// * https://github.com/mondalaci/positional-format.js
// $ bower install jquery positional-format.js
import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import DataStorage from '../../DataStorage';
import logger from './logger';

const log = logger('api:dxfToSvg');
/**
 * Convert DXF string to SVG format.
 * @param {string} dxfString The DXF string to be converted.
 * @returns {string|null} The converted SVG string or null if the conversion was unsuccessful.
 */
const TEMPLATE = `<?xml version="1.0" encoding="utf-8"?>
 <svg
     version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0" y="0" width="<%= width %>" height="<%= height %>"
     viewBox="<%= x0 %> <%= y0 %> <%= width %> <%= height %>"
 >
 `;


String.prototype.format = function (args) {
    let result = this;
    if (arguments.length > 0) {
        if (arguments.length == 1 && typeof (args) === 'object') {
            for (const key in args) {
                if (args[key] != undefined) {
                    var reg = new RegExp(`({${key}})`, 'g');
                    result = result.replace(reg, args[key]);
                }
            }
        } else {
            for (let i = 0; i < arguments.length; i++) {
                if (arguments[i] != undefined) {
                    // var reg = new RegExp("({[" + i + "]})", "g");//这个在索引大于9时会有问题
                    var reg = new RegExp(`({)${i}(})`, 'g');
                    result = result.replace(reg, arguments[i]);
                }
            }
        }
    }
    return result;
};
function readFile(originalPath) {
    return new Promise((resolve, reject) => {
        fs.readFile(originalPath, 'utf8', async (err, fileText) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(fileText);
        });
    }).catch((err) => {
        console.log(err);
    });
}
export const parseFile = async (originalPath) => {
    function dxfObjectToSvgSnippet(dxfObject) {
        function getLineSvg(x1, y1, x2, y2) {
            return '<path d="M{0},{1} {2},{3}"/>\n'.format(x1, y1, x2, y2);
        }

        function deg2rad(deg) {
            return deg * (Math.PI / 180);
        }

        switch (dxfObject.type) {
            case 'LINE':
                return getLineSvg(dxfObject.x, dxfObject.y, dxfObject.x1, dxfObject.y1);
            case 'CIRCLE':
                return '<circle cx="{0}" cy="{1}" r="{2}"/>\n'.format(dxfObject.x, dxfObject.y, dxfObject.r);
            case 'ARC':
                var x1 = dxfObject.x + dxfObject.r * Math.cos(deg2rad(dxfObject.a0));
                var y1 = dxfObject.y + dxfObject.r * Math.sin(deg2rad(dxfObject.a0));
                var x2 = dxfObject.x + dxfObject.r * Math.cos(deg2rad(dxfObject.a1));
                var y2 = dxfObject.y + dxfObject.r * Math.sin(deg2rad(dxfObject.a1));

                if (dxfObject.a1 < dxfObject.a0) {
                    dxfObject.a1 += 360;
                }
                var largeArcFlag = dxfObject.a1 - dxfObject.a0 > 180 ? 1 : 0;

                return '<path d="M{0},{1} A{2},{3} 0 {4},1 {5},{6}"/>\n'
                    .format(x1, y1, dxfObject.r, dxfObject.r, largeArcFlag, x2, y2);
            case 'LWPOLYLINE':
                var svgSnippet = '';
                var vertices = dxfObject.vertices;
                for (var i = 0; i < vertices.length - 1; i++) {
                    var vertice1 = vertices[i];
                    var vertice2 = vertices[i + 1];
                    svgSnippet += getLineSvg(vertice1.x, vertice1.y, vertice2.x, vertice2.y);
                }
                return svgSnippet;
            case 'SPLINE':
                var svgSnippet = '';
                var controlPoints = dxfObject.vertices.map((value) => { return [value.x, value.y]; });
                var knots = dxfObject.knots;
                var degree = dxfObject.degree;
                var vertices = [];
                for (let t = 0; t <= 100; t++) {
                    vertices.push(interpolate(t / 100, degree, controlPoints, knots));
                }
                for (var i = 0; i < vertices.length - 1; i++) {
                    var vertice1 = vertices[i];
                    var vertice2 = vertices[i + 1];
                    svgSnippet += getLineSvg(vertice1[0], vertice1[1], vertice2[0], vertice2[1]);
                }
                return svgSnippet;
        }
    }

    let dxfString = await readFile(originalPath);

    const groupCodes = {
        0: 'entityType',
        2: 'blockName',
        10: 'x',
        11: 'x1',
        20: 'y',
        21: 'y1',
        40: 'r',
        50: 'a0',
        51: 'a1',
        71: 'degree',
        72: 'numOfKnots',
        73: 'numOfControlPoints',
        74: 'numOfFitPoints'
    };

    const supportedEntities = [
        'LINE',
        'CIRCLE',
        'ARC',
        'LWPOLYLINE',
        'SPLINE'
    ];

    let counter = 0;
    let code = null;
    let isEntitiesSectionActive = false;
    let object = {};
    let svg = '';

    // Normalize platform-specific newlines.
    dxfString = dxfString.replace(/\r\n/g, '\n');
    dxfString = dxfString.replace(/\r/g, '\n');

    dxfString.split('\n').forEach((line) => {
        line = line.trim();

        if (counter++ % 2 === 0) {
            code = parseInt(line);
        } else {
            const value = line;
            const groupCode = groupCodes[code];
            if (groupCode === 'blockName' && value === 'ENTITIES') {
                isEntitiesSectionActive = true;
            } else if (isEntitiesSectionActive) {
                if (groupCode === 'entityType') { // New entity starts.
                    if (object.type) {
                        svg += dxfObjectToSvgSnippet(object);
                    }

                    object = supportedEntities.indexOf(value) > -1 ? { type: value } : {};

                    if (value === 'ENDSEC') {
                        isEntitiesSectionActive = false;
                    }
                } else if (object.type && typeof groupCode !== 'undefined') { // Known entity property recognized.
                    object[groupCode] = parseFloat(value);
                    if (object.type == 'SPLINE' && groupCode === 'r') {
                        if (!object.knots) {
                            object.knots = [];
                        }
                        object.knots.push(object.r);
                    }
                    if ((object.type == 'LWPOLYLINE' || object.type == 'SPLINE') && groupCode === 'y') {
                        if (!object.vertices) {
                            object.vertices = [];
                        }
                        object.vertices.push({ x: object.x, y: object.y });
                    }
                }
            }
        }
    });

    if (svg === '') {
        return null;
    }
    const strokeWidth = 0.2;
    const pixelToMillimeterConversionRatio = 3.543299873306695;
    const svgId = `svg${Math.round(Math.random() * Math.pow(10, 17))}`;
    svg = `<svg {0} version="1.1" xmlns="http://www.w3.org/2000/svg">\n${
        '<g transform="scale({0},-{0})" '.format(pixelToMillimeterConversionRatio)
    } style="stroke:black; stroke-width:${strokeWidth}; `
                    + `stroke-linecap:round; stroke-linejoin:round; fill:none">\n${
                        svg
                    }</g>\n`
          + '</svg>\n';
    const svgStr = `<svg viewBox="9.801018142700196 -79.35753021240234 53.5131332397461 43.83259887695313" version="1.1" xmlns="http://www.w3.org/2000/svg">
<g transform="scale(3.543299873306695,-3.543299873306695)"  style="stroke:black; stroke-width:0.2; stroke-linecap:round; stroke-linejoin:round; fill:none">
<path d="M17.840475,19.125596 17.840475,10.0541673"/>
<path d="M17.840475,10.0541673 3.855356999999999,10.0541673"/>
<path d="M3.855357,10.0541673 3.855357,19.125596"/>
<path d="M3.855357,19.125596 17.840475,19.125596"/>
<circle cx="8.353508476131452" cy="16.80906582273579" r="5.55921577175263"/>
</g>
</svg>`;
    fs.writeFile(originalPath.replace(/(dxf)$/, 'svg'), svgStr, (err) => {
        if (err) {
            log.error(err);
            reject(err);
        } else {
            console.log('successful>>>>>>>>>>>>>');
        }
    });
    return {
        outputString: svg,
        outputId: svgId
    };
    // let svgString = _.template(TEMPLATE)({
    //     x0: 500,
    //     y0: 0,
    //     width: 500,
    //     height: 500
    // });
    // svgString = `${svgString + svg}</svg>`;
    // const outputFilename = path.basename(originalPath).replace(/(dxf)$/, 'svg');
    // console.log(svgString, DataStorage.tmpDir, outputFilename);
    // return new Promise((resolve, reject) => {
    //     const targetPath = `E:/snapmakerks/Snapmakerjs/output/server/userData/Tmp/${outputFilename}`;
    //     fs.writeFile(targetPath, svgString, (err) => {
    //         if (err) {
    //             log.error(err);
    //             reject(err);
    //         } else {
    //             resolve({
    //                 originalName: outputFilename,
    //                 uploadName: outputFilename,
    //                 width: 500,
    //                 height: 500
    //             });
    //         }
    //     });
    // });
    // return svgString;
    // var strokeWidth = 0.2;
    // var pixelToMillimeterConversionRatio = 3.543299873306695;
    // var svgId = "svg" + Math.round(Math.random() * Math.pow(10, 17));
    // svg = '<svg {0} version="1.1" xmlns="http://www.w3.org/2000/svg">\n' +
    //       '<g transform="scale({0},-{0})" '.format(pixelToMillimeterConversionRatio) +
    //         ' style="stroke:black; stroke-width:' + strokeWidth + '; ' +
    //                 'stroke-linecap:round; stroke-linejoin:round; fill:none">\n' +
    //       svg +
    //       '</g>\n' +
    //       '</svg>\n';
    //
    // // The SVG has to be added to the DOM to be able to retrieve its bounding box.
    // $(svg.format('id="'+svgId+'"')).appendTo('body');
    // console.log("$('svg')[0]", $('svg')[0]);
    // var boundingBox = $('svg')[0].getBBox();
    // var viewBoxValue = '{0} {1} {2} {3}'.format(boundingBox.x-strokeWidth/2, boundingBox.y-strokeWidth/2,
    //                                             boundingBox.width+strokeWidth, boundingBox.height+strokeWidth);
    // $('#'+svgId).remove();
    //
    // return svg.format('viewBox="' + viewBoxValue + '"');
};
