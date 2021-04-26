import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import { cloneDeep } from 'lodash';
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
// change the default PIXEL to make sure TOLERANCE close to 0.1mm
const TOLERANCE = 0.3 * DEFAULT_MILLIMETER_PER_PIXEL;

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
                explicitChildren: false,
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

    generateString(newNode, filePath) {
        return new Promise((resolve, reject) => {
            // keep the orders of children coz they can overlap each other
            const options = {
                explicitChildren: true,
                preserveChildrenOrder: true
            };
            const builder = new xml2js.Builder();
            let result = builder.buildObject(newNode);
            result = result.replace(/^\<\?xml.+\?\>/, '');
            const newUploadName = filePath.replace(/\.svg$/, 'parsed.svg');
            fs.writeFile(newUploadName, result, (error) => {
                if (error) throw error;
                resolve(newUploadName);
            });
        });
    }

    async parse(s) {
        const node = await this.readString(s);
        return this.parseObject(node);
    }

    async parseFile(filePath) {
        const node = await this.readFile(filePath);
        // return this.parseObject(node);
        const result = await this.parseObject(node);
        const newUploadName = await this.generateString(result.parsedNode, filePath);
        result.uploadName = path.basename(newUploadName);
        return result;
    }

    async parseObject(node) {
        const initialAttributes = {
            fill: '#000000',
            stroke: null,
            strokeWidth: 1,
            visibility: true,
            xform: [1, 0, 0, 1, 0, 0]
        };

        const parsedNode = cloneDeep(node);
        const root = await this.parseNode('svg', parsedNode.svg, parsedNode, initialAttributes);
        parsedNode.svg = root.parsedSvg;

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
            parsedNode: parsedNode,
            viewBox: root.attributes.viewBox,
            width: root.attributes.width,
            height: root.attributes.height
        };
    }

    parseNode(tag, node, parent, parentAttributes) {
        // const tag = node['#name'];
        const shapes = [];
        if (node) {
            const attributes = this.attributeParser.parse(node, parentAttributes);

            let shouldParseChildren = true;
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
                case '$': {
                    break;
                }
                // case 'defs': {
                //     const tagParser = new DefsTagParser(this);
                //     tagParser.parse(node, attributes);
                //     break;
                // }
                case 'pattern': {
                    shouldParseChildren = false;
                    break;
                }
                default:
                    shouldParseChildren = false;
                    break;
            }
            // parse childrend
            for (const variable in node) {
                // 'mask'
                if (shouldParseChildren && Array.isArray(node[variable])) {
                    node[variable].forEach((child) => {
                        const childNode = this.parseNode(variable, child, node, attributes);
                        for (const shape of childNode.shapes) {
                            shapes.push(shape);
                        }
                    });
                } else if (node && variable !== '$' && !shouldParseChildren) {
                    delete node[variable];
                }
            }
            return {
                attributes,
                shapes,
                parsedSvg: node
            };
        } else {
            return {
                attributes: parentAttributes,
                shapes,
                parsedSvg: node
            };
        }
    }
}

export default SVGParser;
