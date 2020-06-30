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
// TODO: General tolerance does not work well if original drawing is small,
//  the tolerance should be calculated base on scale of image.
const TOLERANCE = 0.08 / DEFAULT_MILLIMETER_PER_PIXEL;


class SVGParser {
    constructor() {
        this.attributeParser = new AttributesParser(this);
        this.tagParses = {
            'circle': new CircleTagParser(TOLERANCE),
            'ellipse': new EllipseTagParser(TOLERANCE),
            'line': new LineTagParser(TOLERANCE),
            'path': new PathTagParser(TOLERANCE),
            'polygon': new PolygonTagParser(TOLERANCE),
            'polyline': new PolylineTagParser(TOLERANCE),
            'rect': new RectTagParser(TOLERANCE)
        };
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
            viewBox: root.attributes.viewBox,
            width: root.attributes.width,
            height: root.attributes.height
        };
    }

    parseNode(node, parentAttributes) {
        const tag = node['#name'];
        const attributes = this.attributeParser.parse(node, parentAttributes);

        const shapes = [];

        switch (tag) {
            // graphics elements
            case 'circle': {
                shapes.push(this.tagParses.circle.parse(node, attributes));
                break;
            }
            case 'ellipse': {
                shapes.push(this.tagParses.ellipse.parse(node, attributes));
                break;
            }
            case 'line': {
                shapes.push(this.tagParses.line.parse(node, attributes));
                break;
            }
            case 'path': {
                shapes.push(this.tagParses.path.parse(node, attributes));
                break;
            }
            case 'polygon': {
                shapes.push(this.tagParses.polygon.parse(node, attributes));
                break;
            }
            case 'polyline': {
                shapes.push(this.tagParses.polyline.parse(node, attributes));
                break;
            }
            case 'rect': {
                shapes.push(this.tagParses.rect.parse(node, attributes));
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
            node.$$.forEach((child) => {
                const childNode = this.parseNode(child, attributes);
                for (const shape of childNode.shapes) {
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
