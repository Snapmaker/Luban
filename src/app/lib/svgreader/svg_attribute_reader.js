/* eslint-disable */
import {MatrixMult, ParseFloats} from "./utility";
import _ from 'lodash';
import {logger} from './logger';
import { Rgb2Hex, NormalizeHex, Css3Names2Hex } from "./webcolor";

export const AttributeReader = function () {

    let processFields = ['id', 'transform', 'style', 'opacity', 'display', 'visibility', 'fill',
        'stroke', 'color', 'fill-opacity', 'stroke-opacity', 'width', 'height', 'd', 'x', 'y', 'points',
        'x', 'y', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'r', 'cx', 'cy'];

    const DEG_TO_RAD = Math.PI / 180;
    const RAD_TO_DEG = 180 / Math.PI;

    function stringAttrib(node, attr, value) {
        if (value !== 'inherit') {
            node[attr] = value;
        }
    }
    function transformAttrib(node, attr, value) {
        // http://www.w3.org/TR/SVG11/coords.html#EstablishingANewUserSpace
        const re = /([a-z]+)\s*\(([^)]*)\)/gi;
        let xforms = [];

        let m = re.exec(value);
        while (m) {
            let xformKind = m[1].toLowerCase();
            let params = ParseFloats(m[2]);

            if (xformKind === 'translate') {
                if (params.length === 1) {
                    xforms.push([1, 0, 0, 0, params[0], params[0]]);
                } else if (params.length === 2) {
                    xforms.push([1, 0, 0, 1, params[0], params[1]]);
                } else {
                    logger.warn('translate skipped; invalid num of params');
                }
            } else if (xformKind === 'rotate') {
                if (params.length === 3) {
                    let angle = params[0] * DEG_TO_RAD;
                    xforms.push([1, 0, 0, 1, params[1], params[2]]);
                    xforms.push([Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]);
                    xforms.push([1, 0, 0, 1, -params[1], -params[2]]);
                } else if (params.length === 1) {
                    let angle = params[0] * DEG_TO_RAD;
                    xforms.push([Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]);
                } else {
                    logger.warn('rotate skipped; invalid num of params');
                }
            } else if (xformKind === 'scale') {
                if (params.length === 1) {
                    xforms.push([params[0], 0, 0, params[0], 0, 0]);
                } else if (params.length === 2) {
                    xforms.push([params[0], 0, 0, params[1], 0, 0]);
                } else {
                    logger.warn('scale skipped; invalide num of params');
                }
            } else if (xformKind === 'matrix') {
                if (params.length === 6) {
                    xforms.push(params);
                } else {
                    logger.warn('matrix skipped; invalid num of params');
                }
            } else if (xformKind === 'skewx') {
                if (params.length === 1) {
                    let angle = params[0] * DEG_TO_RAD;
                    xforms.push([1, 0, Math.atan(angle), 1, 0, 0]);
                } else {
                    logger.warn('skewX skipped; invalid num of params');
                }
            } else if (xformKind === 'skewy') {
                if (params.length === 1) {
                    let angle = params[1] * DEG_TO_RAD;
                    xforms.push([1, Math.atan(angle), 0, 1, 0, 0]);
                } else {
                    logger.warn('skewY skipped; invalid num of params');
                }
            }

            let xformCombined = [1, 0, 0, 1, 0, 0];
            for (let i = 0; i < xforms.length; ++i) {
                xformCombined = MatrixMult(xformCombined, xforms[i]);
            }

            node['xform'] = xformCombined;

            m = re.exec(value);
        }
    }
    function styleAttrib(node, attr, value) {
        let segs = value.split(';');
        for (let i = 0; i < segs.length; ++i) {
            let kv = segs[i].split(':');

            if (kv.length === 2) {
                let k = kv[0].trim();
                let v = kv[1].trim();
                readAttrib(node, k, v);
            }
        }
    }
    function opacityAttrib(node, attr, value) {
        let float = parseFloat(value);
        if (isNaN(float)) {
            logger.warn('invalid opacity, default to 1.0');
            node[attr] = 1.0;
        } else {
            node[attr] = Math.min(1.0, Math.max(0.0, float));
        }
    }
    function parseColor(_value) {
        // Parse a color definition
        // Returns a color in hex format, 'inherit', or 'none'.
        // 'none' means that the geometry is not to be rendered.
        // See: http://www.w3.org/TR/SVG11/painting.html#SpecifyingPaint
        // http://www.w3.org/TR/SVG11/color.html
        // http://www.w3.org/TR/2008/REC-CSS2-20080411/syndata.html#color-units
        let value = _value.trim();

        if (value[0] === '#') {
            return NormalizeHex(value.substr(1));
        } else if (value.startsWith('rgba')) {
            let floats = ParseFloats(value.substr(5));
            if (floats.length === 4) {
                logger.warn('opacity in rgba is ignored, use stroke-opacity/fill-opacity instead');
                return Rgb2Hex(floats.slice(0,3));
            }
        } else if (value.startsWith('rgb')) {
            let floats = ParseFloats(value.substr(4));
            if (floats.length === 3) {
                return Rgb2Hex(floats);
            }
        } else if (value === 'none') {
            // 'none' means the geometry is not to be filled or stroked
            // http://www.w3.org/TR/SVG11/painting.html#SpecifyingPaint
            return 'none';
        } else if (value.startsWith('hsl')) {
            logger.warn('hsl/hsla color spaces are not supported');
        } else if (value.startsWith('url')) {
            logger.warn('defs are not suppported');
        } else if (Css3Names2Hex(value)) {
            return Css3Names2Hex(value);
        } else if (_.includes(['currentColor', 'inherit'], value)) {
            return 'inherit';
        } else {
            logger.warn(`invalid color, skipped: ${value}`);
            return 'inherit';
        }
    }
    function colorAttrib(node, attr, value) {
        let col = parseColor(value);
        if (col !== 'inherit') {
            node[attr] = col;
        }
    }
    function parseUnit(value) {
        const re = /(-?[0-9]+\.?[0-9]*(e-?[0-9]*)?)(cm|mm|pt|pc|in|%|em|ex)?/g;
        let m = re.exec(value);
        if (m) {
            let num = parseFloat(m[1]);
            let unit = m[3];
            if (!unit) {
                return num;
            } else if (unit === 'cm') {

            }
        }
    }
    function dimensionAttrib(node, attr, value) {
        node[attr] = parseUnit(value);
    }
    function dAttrib(node, attr, value) {
        let results = [];

        const re = /([A-Za-z]|(-?[0-9]+\.?[0-9]*(e-?[0-9]*)?))/g;
        let m = re.exec(value);;
        while (m) {
            let float = parseFloat(m[1]);
            if (isNaN(float)) {
                results.push(m[1])
            } else {
                results.push(float);
            }
            m = re.exec(value);
        }
        node[attr] = results;
    }
    function pointsAttrib(node, attr, value) {
        let floats = ParseFloats(value);
        if (floats.length % 2 === 0) {
            node[attr] = floats;
        } else {
            logger.error('odd number of vertice')
        }
    }

    let handler = {
        'id': stringAttrib,
        'transform': transformAttrib,
        'style': styleAttrib,
        'opacity': opacityAttrib,
        'visibility': stringAttrib,
        'fill': colorAttrib,
        'stroke': colorAttrib,
        'color': colorAttrib,
        'fill-opacity': opacityAttrib,
        'stroke-opacity': opacityAttrib,
        'width': dimensionAttrib,
        'height': dimensionAttrib,
        'd': dAttrib,
        'points': pointsAttrib,
        'x': dimensionAttrib,
        'y': dimensionAttrib,
        'rx': dimensionAttrib,
        'ry': dimensionAttrib,
        'x1': dimensionAttrib,
        'y1': dimensionAttrib,
        'x2': dimensionAttrib,
        'y2': dimensionAttrib,
        'r': dimensionAttrib,
        'cx': dimensionAttrib,
        'cy': dimensionAttrib
    };

    function  readAttrib(node, attr, value) {
        if (_.includes(Object.keys(handler), attr)) {
            handler[attr](node, attr, value);
        } else {
            // console.error(`${attr} is not exist`);
        }
    }

    return {
        readAttrib: readAttrib
    }
};