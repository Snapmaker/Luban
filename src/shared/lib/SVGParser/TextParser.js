import _ from 'lodash';
import xml2js from 'xml2js';
import * as opentype from 'opentype.js';
import BaseTagParser from './BaseTagParser';
import fontManager from '../FontManager';
import PathTagParser from './PathTagParser';
import AttributesParser from './AttributesParser';


const DEFAULT_MILLIMETER_PER_PIXEL = 25.4 / 72;
const TOLERANCE = 0.3 * DEFAULT_MILLIMETER_PER_PIXEL;

class textParser extends BaseTagParser {
    constructor() {
        super();
        this.attributeParser = new AttributesParser(this);
    }

    async parseString(s, element = 'svg') {
        const node = await this.readString(s);
        return this.parseObject(node, element);
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

    dragTextPathToParent(parent) {
        const textElement = parent.text;
        if (textElement) {
            if (!Array.isArray(parent.path)) {
                parent.path = [];
            }
            textElement.forEach((item) => {
                for (const variable of Object.keys(item)) {
                    if (variable === 'path' && Array.isArray(item[variable])) {
                        for (const shape of item[variable]) {
                            parent.path.push(shape);
                        }
                    }
                }
            });
            delete parent.text;
        }
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
        const parsedNode = _.cloneDeep(node);
        const root = await this.parseNode(element, parsedNode[element], parsedNode, initialAttributes);
        parsedNode.svg = root.parsedSvg;

        this.dragTextPathToParent(root.parsedSvg);

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
        const shapes = [];
        if (node) {
            let isText = false;
            if (tag === 'text' || tag === 'tspan') {
                isText = true;
            }
            const attributes = this.attributeParser.parse(node, parentAttributes, isText);

            let shouldParseChildren = true;
            switch (tag) {
                case 'path': {
                    const tagParses = new PathTagParser(TOLERANCE);
                    shapes.push(tagParses.parse(node, attributes));
                    break;
                }
                case '-':
                case 'g':
                case 'd':
                case '$': {
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

    async parse(node, attributes, previousElementAttributes) {
        this.initialize(attributes);
        const font = attributes.fontFamily || 'Arial';
        const size = attributes.fontSize;
        const text = attributes._;
        const actualX = _.isUndefined(attributes.actualX) ? 0 : attributes.actualX;
        const actualY = _.isUndefined(attributes.actualY) ? 0 : attributes.actualY;
        const dx = _.isUndefined(attributes.dx) ? 0 : attributes.dx;
        const dy = _.isUndefined(attributes.dy) ? 0 : attributes.dy;
        const x = attributes.x;
        const y = attributes.y;
        const boundingBox = _.isUndefined(previousElementAttributes.textBoundingBox)
            ? {
                'minX': 0,
                'maxX': 0,
                'minY': 0,
                'maxY': 0
            } : previousElementAttributes.textBoundingBox;
        let positionX = 0;
        let positionY = 0;

        if (_.isUndefined(x)) {
            positionX = boundingBox.maxX - boundingBox.minX + dx;
        } else if (!_.isUndefined(x)) {
            positionX = actualX + dx;
        }

        if (_.isUndefined(y)) {
            positionY = boundingBox.maxY - boundingBox.minY + dy;
        } else {
            positionY = actualY + dy;
        }

        let result = {};
        if (!_.isUndefined(text)) {
            const fontObj = await fontManager.getFont(font);

            const fullPath = new opentype.Path();
            // Calculate size and render SVG template
            const p = fontObj.getPath(text, positionX, positionY, Math.floor(size));
            fullPath.extend(p);
            fullPath.stroke = 'black';

            // const boundingBox = fullPath.getBoundingBox();
            // const svgParser = new SVGParser();

            const svgString = fullPath.toSVG();
            result = await this.parseString(svgString, 'path');
        }
        return result;
    }
}

export default textParser;
