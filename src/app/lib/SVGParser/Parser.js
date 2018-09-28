import fs from 'fs';
import xml2js from 'xml2js';
import AttributesParser from './AttributesParser';
import SVGTagParser from './SVGTagParser';
import DefsTagParser from './DefsTagParser';
import CircleTagParser from './CircleTagParser';
import EllipseTagParser from './EllipseTagParser';
import LineTagParser from './LineTagParser';
import PathTagParser from './PathTagParser';
import PolygonTagParser from './PolygonTagParser';
import PolylineTagParser from './PolylineTagParser';
import RectTagParser from './RectTagParser';

// const DEFAULT_DPI = 72;
const DEFAULT_MILLIMETER_PER_PIXEL = 25.4 / 72;
const TOLERANCE = 0.08 / DEFAULT_MILLIMETER_PER_PIXEL;


class SVGParser {
    constructor() {
        this.attributeParser = new AttributesParser(this);
        // this.image = {
        //     shapes: []
        // };
    }

    readFile(path) {
        return new Promise((resolve, reject) => {
            fs.readFile(path, 'utf8', async (err, xml) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(await this.readString(xml));
            });
        });
    }

    readString(s) {
        return new Promise((resolve, reject) => {
            // keep the orders of children coz they can overlap each other
            const options = {
                explicitChildren: true,
                preserveChildrenOrder: true
            };
            xml2js.parseString(s, options, (err, node) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(node);
                }
            });
        });
    }

    async parse(s) {
        const node = await this.readString(s);
        return this.parseObject(node);
    }

    async parseFile(path) {
        const node = await this.readFile(path);
        return this.parseObject(node);
    }

    async parseObject(node) {
        const initialAttributes = {
            fill: '#000000',
            stroke: null,
            strokeWidth: 1,
            visibility: true,
            xform: [1, 0, 0, 1, 0, 0]
        };

        const root = await this.parseNode(node.svg, initialAttributes);

        const boundingBox = {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity
        };

        for (const shape of root.shapes) {
            if (shape.visibility) {
                boundingBox.minX = Math.min(boundingBox.minX, shape.boundingBox.minX);
                boundingBox.maxX = Math.max(boundingBox.maxX, shape.boundingBox.maxX);
                boundingBox.minY = Math.min(boundingBox.minY, shape.boundingBox.minY);
                boundingBox.maxY = Math.max(boundingBox.maxY, shape.boundingBox.maxY);
            }
        }

        return {
            shapes: root.shapes,
            boundingBox: boundingBox,
            width: root.attributes.width,
            height: root.attributes.height
        };
    }

    parseNode(node, inheritedAttributes) {
        const tag = node['#name'];
        const attributes = this.attributeParser.parse(node, inheritedAttributes);

        const shapes = [];

        switch (tag) {
            // graphics elements
            case 'circle': {
                const tagParser = new CircleTagParser(TOLERANCE);
                shapes.push(tagParser.parse(node, attributes));
                break;
            }
            case 'ellipse': {
                const tagParser = new EllipseTagParser(TOLERANCE);
                shapes.push(tagParser.parse(node, attributes));
                break;
            }
            case 'line': {
                const tagParser = new LineTagParser(TOLERANCE);
                shapes.push(tagParser.parse(node, attributes));
                break;
            }
            case 'path': {
                const tagParser = new PathTagParser(TOLERANCE);
                shapes.push(tagParser.parse(node, attributes));
                break;
            }
            case 'polygon': {
                const tagParser = new PolygonTagParser(TOLERANCE);
                shapes.push(tagParser.parse(node, attributes));
                break;
            }
            case 'polyline': {
                const tagParser = new PolylineTagParser(TOLERANCE);
                shapes.push(tagParser.parse(node, attributes));
                break;
            }
            case 'rect': {
                const tagParser = new RectTagParser(TOLERANCE);
                shapes.push(tagParser.parse(node, attributes));
                break;
            }

            // container elements
            case 'svg': {
                const tagParser = new SVGTagParser(this);
                tagParser.parse(node, attributes);
                break;
            }
            case 'defs': {
                const tagParser = new DefsTagParser(this);
                tagParser.parse(node, attributes);
                break;
            }
            default:
                break;
        }

        // parse children
        if (node.$$) {
            const attrs = {};
            for (const key of ['fill', 'stroke', 'strokeWidth', 'visibility', 'xform']) {
                attrs[key] = attributes[key];
            }

            node.$$.forEach((child) => {
                const node = this.parseNode(child, attrs);
                for (const shape of node.shapes) {
                    shapes.push(shape);
                }
            });
        }

        return {
            attributes,
            shapes
        };
    }
}

export default SVGParser;
