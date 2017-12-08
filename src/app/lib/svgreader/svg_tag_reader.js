/* eslint-disable */
import { MatrixMult } from "./utility";
import { PathReader } from "./svg_path_reader";
import { AttributeReader} from "./svg_attribute_reader";
import { logger } from './logger';

export const TagReader = function (_tolerance2) {
    let processFields = ['g', 'path', 'polygon', 'polyline', 'rect', 'line', 'circle', 'ellipse', 'defs', 'style', 'image'];
    let attributeReader = AttributeReader();
    let pathReader = PathReader(_tolerance2);


    function hasValidStroke(node) {
        // https://www.w3.org/TR/SVG11/styling.html#SVGStylingProperties
        let display = node['display'];
        let visibility = node['visibility'];
        let strokeColor = node['stroke'];
        let strokeOpacity = node['stroke-opacity'];
        let color = node['color'];
        let opacity = node['opacity'];
        return display && display !== 'none' &&
            visibility && visibility !== 'hidden' && visibility !== 'collapse' &&
            strokeColor && strokeColor[0] === '#' &&
            strokeOpacity && strokeOpacity !== 0.0 &&
            color && color[0] === '#' &&
            opacity && opacity !== 0.0;
    }
    function g(node) {
        // http://www.w3.org/TR/SVG11/struct.html#Groups
        // has transform and style attributes
    }
    function path(node) {
        // http://www.w3.org/TR/SVG11/paths.html
        // has transform and style attributes
        if (hasValidStroke(node)) {
            let d = node["d"];
            pathReader.addPath(d, node);
        }
    }
    function polygon(node) {
        //  http://www.w3.org/TR/SVG11/shapes.html#PolygonElement
        if (hasValidStroke(node)) {
            let d = ['M'].concat(node['points']).concat(['z']);
            delete node['points'];
            pathReader.addPath(d, node);
        }
    }
    function polyline(node) {
        // http://www.w3.org/TR/SVG11/shapes.html#PolylineElement
        if (hasValidStroke(node)) {
            let d = ['M'].concat(node['points']);
            delete node['points'];
            pathReader.addPath(d, node);
        }
    }
    function rect(node) {
        // http://www.w3.org/TR/SVG11/shapes.html#RectElement
        // has transform and style attributes
        if (hasValidStroke(node)) {
            let w = node['width'] || 0;
            let h = node['height'] || 0;
            let x = node['x'] || 0;
            let y = node['y'] || 0;
            let rx = node['rx'];
            let ry = node['ry'];
            if (!rx && !ry) {
                let d = ['M', x, y, 'h', w, 'v', h, 'h', -w, 'z'];
                pathReader.addPath(d, node);
            } else {
                if (!rx) {
                    rx = ry;
                } else if (!ry) {
                    ry = rx;
                }
                if (rx > w / 2.0) {
                    rx = w / 2.0;
                }
                if (ry > h / 2.0) {
                    ry = h / 2.0;
                }
                if (rx < 0.0) {
                    rx = -rx;
                }
                if (ry < 0.0) {
                    ry = -ry;
                }

                let d = ['M', x + rx, y,
                    'h', w - 2 * rx,
                    'c', rx, 0.0, rx, ry, rx, ry,
                    'v', h - 2 * ry,
                    'c', 0.0, ry, -rx, ry, -rx, ry,
                    'h', -w + 2 * rx,
                    'c', -rx, 0.0, -rx, -ry, -rx, -ry,
                    'v', -h + 2 * ry,
                    'c', 0.0, 0.0, 0.0, -ry, rx, -ry,
                    'z'];
                pathReader.addPath(d, node);
            }
        }
    }
    function line(node) {
        // http://www.w3.org/TR/SVG11/shapes.html#LineElement
        if (hasValidStroke(node)) {
            let x1 = node['x1'] || 0.0;
            let y1 = node['y1'] || 0.0;
            let x2 = node['x2'] || 0.0;
            let y2 = node['y2'] || 0.0;
            let d = ['M', x1, y1, 'L', x2, y2];
            pathReader.addPath(d, node);
        }
    }
    function circle(node) {
        // http://www.w3.org/TR/SVG11/shapes.html#CircleElement
        if (hasValidStroke(node)) {
            let r = node['r'];
            let cx = node['cx'] || 0.0;
            let cy = node['cy'] || 0.0;
            if (r > 0.0) {
                let d = ['M', cx - r, cy,
                    'A', r, r, 0.0, 0.0, 0.0, cx, cy + r,
                    'A', r, r, 0.0, 0.0, 0.0, cx + r, cy,
                    'A', r, r, 0.0, 0.0, 0.0, cx, cy - r,
                    'A', r, r, 0.0, 0.0, 0.0, cx - r, cy,
                    'Z'];
                pathReader.addPath(d, node);
            }
        }
    }
    function ellipse(node) {
        if (hasValidStroke(node)) {
            let rx = node['rx'];
            let ry = node['ry'];
            let cx = node['cx'];
            let cy = node['cy'];
            if (rx > 0 && ry > 0) {
                let d = ['M', cx - rx, cy,
                    'A', rx, ry, 0.0, 0.0, 0.0, cx, cy + ry,
                    'A', rx, ry, 0.0, 0.0, 0.0, cx + rx, cy,
                    'A', rx, ry, 0.0, 0.0, 0.0, cx, cy - ry,
                    'A', rx, ry, 0.0, 0.0, 0.0, cx - rx, cy,
                    'Z'];
                pathReader.addPath(d, node);
            }
        }
    }
    function image(node) {
        // not supported
        logger.warn('"image" tag is not supported, ignored');
    }
    function defs(node) {
        // not supported
        // http://www.w3.org/TR/SVG11/struct.html#Head
        logger.warn('"defs" tag is not supported, ignored');
    }
    function style(node) {
        // not supported: embedded style sheets
        // http://www.w3.org/TR/SVG11/styling.html#StyleElement
        // instead presentation attributes and the 'style' attribute
        logger.warn('"style" tag is not supported, use presentation attributes or the style attribute instead');
    }

    let handler = {
        g: g,
        path: path,
        polygon: polygon,
        polyline: polyline,
        rect: rect,
        line: line,
        circle: circle,
        ellipse: ellipse,
        image: image,
        defs: defs,
        style: style
    };

    function readTag(field, tag, node) {

        for (let attr in tag.$) {
            attributeReader.readAttrib(node, attr, tag.$[attr]);
        }
        node['xformToWorld'] = MatrixMult(node['xformToWorld'], node['xform']);
        handler[field](node);
    }
    return {
        fields: processFields,
        readTag: readTag,
    }
};