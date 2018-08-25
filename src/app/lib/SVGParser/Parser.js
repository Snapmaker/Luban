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

    parse(s) {
        return new Promise((resolve, reject) => {
            // keep the orders of children coz they can overlap each other
            const options = {
                explicitChildren: true,
                preserveChildrenOrder: true
            };
            xml2js.parseString(s, options, async (err, node) => {
                if (err) {
                    reject(err);
                    return;
                }

                // const initialCoordinate = null;
                const initialAttributes = {
                    fill: '#000000',
                    stroke: null,
                    strokeWidth: 1,
                    visibility: true,
                    xform: [1, 0, 0, 1, 0, 0]
                };
                resolve(await this.parseNode(node.svg, initialAttributes));
            });
        });
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
            for (let key of ['fill', 'stroke', 'strokeWidth', 'visibility', 'xform']) {
                attrs[key] = attributes[key];
            }

            node.$$.forEach((child) => {
                const shapes2 = this.parseNode(child, attrs);
                for (let shape of shapes2) {
                    shapes.push(shape);
                }
            });
        }

        return shapes;
    }
}

export default SVGParser;
