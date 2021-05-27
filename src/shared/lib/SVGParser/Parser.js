import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import { cloneDeep } from 'lodash';
import AttributesParser from './AttributesParser';
import SVGTagParser from './SVGTagParser';
// import DefsTagParser from './DefsTagParser';
import CircleTagParser from './CircleTagParser';
import EllipseTagParser from './EllipseTagParser';
import LineTagParser from './LineTagParser';
import PathTagParser from './PathTagParser';
import PolygonTagParser from './PolygonTagParser';
import PolylineTagParser from './PolylineTagParser';
import RectTagParser from './RectTagParser';
import TextParser from './TextParser';

// const DEFAULT_DPI = 72;
const DEFAULT_MILLIMETER_PER_PIXEL = 25.4 / 72;
// TODO: General tolerance does not work well if original drawing is small,
//  the tolerance should be calculated base on scale of image.
// change the default PIXEL to make sure TOLERANCE close to 0.1mm
const TOLERANCE = 0.3 * DEFAULT_MILLIMETER_PER_PIXEL;
let parentTextAttributes = '';

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
        this.previousElementAttributes = {
            actualX: 0,
            actualY: 0
        };
        // this.image = {
        //     shapes: []
        // };
    }

    readFile(filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', async (err, xml) => {
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
            const builder = new xml2js.Builder();
            let result = builder.buildObject(newNode);
            /* eslint no-useless-escape: "error"*/
            result = result.replace(/^<\?xml.+\?>/, '');
            const newUploadName = filePath.replace(/\.svg$/, 'parsed.svg');
            fs.writeFile(newUploadName, result, (error) => {
                if (error) reject(error);
                resolve(newUploadName);
            });
        });
    }

    async parse(s, element = 'svg') {
        const node = await this.readString(s);
        return this.parseObject(node, element);
    }


    async parseFile(filePath) {
        const node = await this.readFile(filePath);
        const result = await this.parseObject(node);
        const newUploadName = await this.generateString(result.parsedNode, filePath);
        result.uploadName = path.basename(newUploadName);
        return result;
    }

    dragTextPathToParent(parent) {
        const textElement = parent.text || parent.tspan;
        const gElement = parent.g;
        let gArray = [];
        if (textElement) {
            textElement.forEach((item) => {
                for (const variable of Object.keys(item)) {
                    if (variable === 'g' && Array.isArray(item[variable])) {
                        for (const shape of item[variable]) {
                            gArray.push(shape);
                        }
                    }
                    if (variable === 'tspan') {
                        const childPaths = this.dragTextPathToParent(item);
                        gArray = gArray.concat(childPaths);
                    }
                }
            });
            delete parent.text;
        } else if (gElement) {
            gElement.forEach((item) => {
                const childPaths = this.dragTextPathToParent(item);
                gArray = gArray.concat(childPaths);
            });
        }
        return gArray;
    }


    async parseObject(node, element = 'svg') {
        const initialAttributes = {
            fill: '#000000',
            stroke: null,
            strokeWidth: 1,
            fontSize: 16,
            // fontFamily: 'auto',
            actualX: 0,
            actualY: 0,
            visibility: true,
            xform: [1, 0, 0, 1, 0, 0]
        };
        const parsedNode = cloneDeep(node);
        const root = await this.parseNode(element, parsedNode[element], parsedNode, initialAttributes);
        const newSvg = root.parsedSvg;
        const gArray = this.dragTextPathToParent(newSvg);
        if (newSvg.g && Array.isArray(newSvg.g)) {
            newSvg.g = newSvg.g.concat(gArray);
        } else {
            newSvg.g = gArray;
        }
        parsedNode.svg = newSvg;


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

    async parseNode(tag, node, parent, parentAttributes) {
        // const tag = node['#name'];
        let shapes = [];
        if (node) {
            const attributes = this.attributeParser.parse(node, parentAttributes, tag);

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
                case 'text': {
                    const textParser = new TextParser(this);
                    const textObject = await textParser.parse(node, attributes, this.previousElementAttributes, true);
                    if (textObject.shapes) {
                        shapes = shapes.concat(textObject.shapes);
                        attributes.positionX = textObject.positionX;
                        attributes.positionY = textObject.positionY;
                        if (Array.isArray(parent.g)) {
                            parent.g.push(textObject.parsedNode.g);
                        } else {
                            const gArray = [];
                            gArray.push(textObject.parsedNode.g);
                            parent.g = gArray;
                        }
                    }
                    if (textObject.textAttributes) {
                        attributes.textAttributes = textObject.textAttributes;
                        parentTextAttributes = textObject.textAttributes;
                    }
                    this.previousElementAttributes = attributes;
                    break;
                }
                case 'tspan': {
                    const textParser = new TextParser(this);
                    const textObject = await textParser.parse(node, attributes, this.previousElementAttributes, false);
                    if (textObject.shapes) {
                        shapes = shapes.concat(textObject.shapes);
                        attributes.positionX = textObject.positionX;
                        attributes.positionY = textObject.positionY;
                        if (Array.isArray(parent.g)) {
                            parent.g.push(textObject.parsedNode.g);
                        } else {
                            const gArray = [];
                            gArray.push(textObject.parsedNode.g);
                            parent.g = gArray;
                        }
                    }
                    if (parentTextAttributes) {
                        attributes.textAttributes = parentTextAttributes;
                    }
                    this.previousElementAttributes = attributes;
                    break;
                }
                // container elements
                case 'svg': {
                    const tagParser = new SVGTagParser(this);
                    tagParser.parse(node, attributes);
                    break;
                }
                case '-':
                case 'g':
                case 'd':
                case 'title':
                case '$': {
                    break;
                }
                // case 'defs': {
                //     const tagParser = new DefsTagParser(this);
                //     tagParser.parse(node, attributes);
                //     break;
                // }
                default:
                    shouldParseChildren = false;
                    break;
            }
            // parse childrend
            // eslint-disable-next-line guard-for-in
            for (const variable of Object.keys(node)) {
                if (shouldParseChildren && Array.isArray(node[variable])) {
                    for (let i = 0; i < node[variable].length; i++) {
                        const child = node[variable][i];
                        const childNode = await this.parseNode(variable, child, node, attributes);
                        for (const shape of childNode.shapes) {
                            shapes.push(shape);
                        }
                    }
                } else if (node && !shouldParseChildren) {
                    if (Object.prototype.toString.call(node) === '[object Object]') {
                        delete node[variable];
                    }
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
