import fs from 'fs';
import { cloneDeep, isNil } from 'lodash';
import log from 'loglevel';
import path from 'path';
import xml2js from 'xml2js';
import AttributesParser from './AttributesParser';
// import DefsTagParser from './DefsTagParser';
import CircleTagParser from './CircleTagParser';
import { SVG_ATTR_HREF, SVG_ATTR_ID, SVG_ATTR_TRANSFORM, SVG_TAG_SVG, SVG_TAG_USE, XLINK_HREF } from './constants';
import EllipseTagParser from './EllipseTagParser';
import LineTagParser from './LineTagParser';
import PathTagParser from './PathTagParser';
import PolygonTagParser from './PolygonTagParser';
import PolylineTagParser from './PolylineTagParser';
import RectTagParser from './RectTagParser';
import SVGTagParser from './SVGTagParser';
import TextParser from './TextParser';
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
        this.previousElementAttributes = {
            actualX: 0,
            actualY: 0
        };
        this.defs = {
        };
    }

    readFile(filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', async (err, xml) => {
                if (err) {
                    reject(err);
                    return;
                }
                try {
                    resolve(await this.readString(xml));
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    readString(s) {
        return new Promise((resolve, reject) => {
            /*
                Remove some xml namespace attributes which cannot be parsed by xml2js.
                <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [
                    <!ENTITY ns_flows "http://ns.adobe.com/Flows/1.0/">
                    <!ENTITY ns_extend "http://ns.adobe.com/Extensibility/1.0/">
                    <!ENTITY ns_ai "http://ns.adobe.com/AdobeIllustrator/10.0/">
                    <!ENTITY ns_graphs "http://ns.adobe.com/Graphs/1.0/">
                    <!ENTITY ns_vars "http://ns.adobe.com/Variables/1.0/">
                    <!ENTITY ns_imrep "http://ns.adobe.com/ImageReplacement/1.0/">
                    <!ENTITY ns_sfw "http://ns.adobe.com/SaveForWeb/1.0/">
                    <!ENTITY ns_custom "http://ns.adobe.com/GenericCustomNamespace/1.0/">
                    <!ENTITY ns_adobe_xpath "http://ns.adobe.com/XPath/1.0/">
                ]>
                <svg version="1.1" id="artwork" xmlns:x="&ns_extend;" xmlns:i="&ns_ai;" xmlns:graph="&ns_graphs;">
            */
            s = s.replace(/xmlns:.+="&.+;"/ig, '');
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
            const newUploadName = filePath.replace(/\.svg$/i, 'parsed.svg');
            fs.writeFile(newUploadName, result, (error) => {
                if (error) reject(error);
                resolve(newUploadName);
            });
        });
    }

    async parse(s, element = SVG_TAG_SVG) {
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
        }
        if (gElement) {
            gElement.forEach((item) => {
                const childPaths = this.dragTextPathToParent(item);
                gArray = gArray.concat(childPaths);
            });
        }
        return gArray;
    }


    async parseObject(node, element = SVG_TAG_SVG) {
        const initialAttributes = {
            fill: 'none',
            stroke: '#000000',
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
        if (element === SVG_TAG_SVG) {
            newSvg.$.preserveAspectRatio = 'none';
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

        // Use actual bounding box
        // FIXME: Revert to use original attributes, cuz image size should be change on frontend too
        // const width = boundingBox.maxX - boundingBox.minX;
        // const height = boundingBox.maxY - boundingBox.minY;
        // const viewBox = [boundingBox.minX, boundingBox.minY, width, height];
        // const widthRatio = root.attributes.viewBox[2] / root.attributes.width;
        // const heightRatio = root.attributes.viewBox[3] / root.attributes.height;

        return {
            shapes: root.shapes,
            boundingBox: boundingBox,
            parsedNode: parsedNode,
            viewBox: root.attributes.viewBox,
            width: root.attributes.width,
            height: root.attributes.height,
            // viewBox,
            // width: width / widthRatio,
            // height: height / heightRatio, // root.attributes.height,
        };
    }

    // tag, currentNode ,parentNode, attributes
    parseUseStructure(tag, node, parent, attributes) {
        if (node) {
            if (tag === SVG_TAG_USE) {
                let url, shadowNode, x, y;
                if (XLINK_HREF in attributes) url = attributes[XLINK_HREF];
                if (SVG_ATTR_HREF in attributes) url = attributes[SVG_ATTR_HREF];
                if (!isNil(url)) {
                    let transform = false;
                    if (!isNil(attributes.x)) {
                        x = attributes.x;
                        transform = true;
                    }
                    if (!isNil(attributes.y)) {
                        y = attributes.y;
                        transform = true;
                    }
                    if (this.defs[url]) {
                        const shadowTag = this.defs[url].shadowTag;
                        shadowNode = this.defs[url].shadowNode;
                        if (transform) {
                            if (!shadowNode.$) {
                                shadowNode.$ = {};
                            }
                            if (shadowNode.$[SVG_ATTR_TRANSFORM]) {
                                shadowNode.$[
                                    SVG_ATTR_TRANSFORM
                                ] += ` translate(${x}, ${y})`;
                            } else {
                                shadowNode.$[SVG_ATTR_TRANSFORM] = `translate(${x}, ${y})`;
                            }
                        }

                        if (parent[shadowTag] && Array.isArray(parent[shadowTag])) {
                            parent[shadowTag].push(shadowNode);
                        } else {
                            parent[shadowTag] = [shadowNode];
                        }
                    } else {
                        log.warn(`def which id is ${url} doesn't exist`);
                    }
                }
            }
            // If we have an ID, we save the node.
            if (SVG_ATTR_ID in attributes) {
                this.defs[attributes[SVG_ATTR_ID]] = {
                    shadowTag: tag,
                    shadowNode: node
                };
            }
        }
    }

    async parseNode(tag, node, parent, parentAttributes) {
        // const tag = node['#name'];
        let shapes = [];

        if (node) {
            const attributes = this.attributeParser.parse(node, parentAttributes, tag);
            this.parseUseStructure(tag, node, parent, attributes);

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
                    this.previousElementAttributes = attributes;
                    break;
                }
                // container elements
                case SVG_TAG_SVG: {
                    const tagParser = new SVGTagParser(this);
                    if (attributes.viewBox) {
                        node.$.viewBox = attributes.viewBox.join(' ');
                    } else {
                        node.$.viewBox = `0 0 ${attributes.width} ${attributes.height}`;
                    }
                    tagParser.parse(node, attributes);
                    break;
                }
                case '-':
                case 'g':
                case 'd':
                case 'title':
                case 'switch':
                case '$': {
                    break;
                }
                case 'defs': {
                    break;
                }
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
