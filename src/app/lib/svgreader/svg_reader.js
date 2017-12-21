/* eslint-disable */
import {MatrixApply, ParseFloats, ParseScalar, VertexScale} from "./utility";
import { logger } from './logger';
import { TagReader } from "./svg_tag_reader";
import array from 'ensure-array';
import _ from 'lodash';


export const SvgReader = function (_tolerance, _target_size, _svgRoot) {
    let tolerance = _tolerance;
    let targetSize = _target_size;
    let px2mm = null;
    let boundarys = {};

    let vbX = null;
    let vbY = null;
    let vbW = null;
    let vbH = null;
    let width = null;
    let height = null;
    let widthUnit = null;
    let heightUnit = null;
    let unit = null;
    let vb = null;



    if (!_svgRoot.svg) {
        logger.error("Invalid file, no 'svg' tag found");
        return;
    }

    let svgRoot = _svgRoot.svg;



    if (!px2mm) {
        let widthStr = svgRoot.$['width'];
        let heightStr = svgRoot.$['height'];
        if (widthStr && heightStr) {
            [width, widthUnit] = ParseScalar(widthStr);
            [height, heightUnit] = ParseScalar(heightStr);

            if (widthUnit !== heightUnit) {
                logger.error('Conflicting units found.');
            }
            unit = widthUnit;
            logger.info(`SVG w,h (unit) is ${width} ${height} ${unit}`);
        }

        vb = svgRoot.$['viewBox'];
        if (vb) {
            [vbX, vbY, vbW, vbH] = ParseFloats(vb);
            logger.info(`SVG viewBox (${vbX}, ${vbY}, ${vbW}, ${vbH})`);
        }
    }

    // 4. Get px2mm by ratio of svg size to target size
    if (!px2mm && width && height) {
        if (vb) {
            width = vbW;
        }
        px2mm = targetSize[0] / width;
        logger.info('px2mm by targetSize/pageSize ratio');
    }

    if (!px2mm) {
        if ((width && height) || vb) {
            if (!width || !height) {
                width = vbW;
                height = vbH;
            }
            if (!vb) {
                vbX = 0;
                vbY = 0;
                vbW = width;
                vbH = height;
            }

            px2mm = width / vbW;

            if (unit === 'mm') {
                logger.info('px2mm by svg mm unit');
            } else if (unit === 'in') {
                px2mm *= 25.4;
                logger.info('px2mm by svg inch unit');
            } else if (unit === 'cm') {
                px2mm *= 10;
                logger.info('px2m by svg cm unit');
            } else if ((unit === 'px') || unit === '') {
                // no physsical units in file
                // we have to interpret user(px) units
                // 3. For some apps we can make a good guess.

                // TODO
            } else {
                logger.error('SVG with unsupported unit.');
                px2mm = null;
            }
        }
    }



    // 5. Fall back on px unit DPIs, default value
    if (!px2mm) {
        logger.warn('Failed to determine physical dimensions -> defaulting to 96dpi.');
        px2mm = 25.4 / 96.0;
    }


    let tx = vbX || 0;
    let ty = vbY || 0;

    // adjust tolerances to px units
    let tolerance2_px = Math.pow(tolerance / px2mm, 2);
    let tagReader = TagReader(tolerance2_px);


    function parseChildren(domNode, parentNode) {
        for (let field of tagReader.fields) {
            if (domNode[field]) {
                array(domNode[field]).forEach((x) => {
                    // 1. setup a new node and inherit from parent
                    let node = {
                        'paths': [],
                        'xform': [1, 0, 0, 1, 0, 0],
                        'xformToWorld': parentNode['xformToWorld'],
                        'display': parentNode['display'],
                        'visibility': parentNode['visibility'],
                        'fill': parentNode['fill'],
                        'stroke': parentNode['stroke'],
                        'color': parentNode['color'],
                        'fill-opacity': parentNode['fill-opacity'],
                        'stroke-opacity': parentNode['stroke-opacity'],
                        'opacity': parentNode['opacity']
                    };

                    // 2. parse child with current attributes and transformation
                    tagReader.readTag(field, x, node);

                    // console.log(JSON.stringify(node, null, '\t'));

                    // 3. compile boundarys  + unit conversions
                    if (node['paths']) {
                        for (let i = 0; i < node['paths'].length; ++i) {
                            let path = node['paths'][i];

                            // 3a. convert to world coordinates and them to mm unit
                            for (let j = 0; j < path.length; ++j) {
                                let vert = path[j];
                                MatrixApply(node['xformToWorld'], vert);
                                VertexScale(vert, px2mm);
                            }

                            // 3b. sort output by color
                            let hexColor = node['stroke'];
                            if (_.includes(Object.keys(boundarys), hexColor)) {
                                boundarys[hexColor].push(path);
                            } else {
                                boundarys[hexColor] = [path];
                            }
                        }
                    }

                    parseChildren(x, node);
                });

            }
        }

    }

    function parse() {
        //console.log(node.svg);

        let node = {
            'xformToWorld': [1, 0, 0, 1, tx, ty],
            'display': 'visible',
            'visibility': 'visible',
            'fill': '#000000',
            'stroke': '#000000',
            'color': '#000000',
            'fill-opacity': 1.0,
            'stroke-opacity': 1.0,
            'opacity': 1.0
        };
        parseChildren(svgRoot, node);
        // console.log(JSON.stringify(boundarys, null, '\t'));
    }
    return {
        parse: parse,
        boundarys: boundarys
    }
};