import _ from 'lodash';
import xml2js from 'xml2js';
import * as opentype from 'opentype.js';
import svgPath from 'svgpath';
import BaseTagParser from './BaseTagParser';
import fontManager from '../FontManager';
import PathTagParser from './PathTagParser';
import AttributesParser from './AttributesParser';

const DEFAULT_MILLIMETER_PER_PIXEL = 25.4 / 72;
const TOLERANCE = 0.3 * DEFAULT_MILLIMETER_PER_PIXEL;
const TEMPLATE = `<g>
                    <%= path %>
                  </g>`;

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
        const root = await this.parseNode(element, parsedNode[element], initialAttributes);

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

    async parseNode(tag, node, parentAttributes) {
        // const tag = node['#name'];
        const shapes = [];
        if (node) {
            const attributes = this.attributeParser.parse(node, parentAttributes);

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
                        const childNode = await this.parseNode(variable, child, attributes);
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
        const baselineX = _.isUndefined(previousElementAttributes.positionX)
            ? previousElementAttributes.actualX : previousElementAttributes.positionX;
        const baselineY = _.isUndefined(previousElementAttributes.positionY)
            ? previousElementAttributes.actualY : previousElementAttributes.positionY;
        let positionX = 0;
        let positionY = 0;

        if (_.isUndefined(x)) {
            positionX = baselineX + dx;
        } else {
            positionX = actualX + dx;
        }

        if (_.isUndefined(y)) {
            positionY = baselineY + dy;
        } else {
            positionY = actualY + dy;
        }

        const result = {
            positionX,
            positionY
        };
        let addResult = {};
        if (!_.isUndefined(text)) {
            let fontObj = await fontManager.getFont(font);
            if (!fontObj) {
                fontObj = await fontManager.getFont('Arial');
            }
            const fullPath = new opentype.Path();
            // Calculate size and render SVG template

            const fontPath = fontManager.getPathOrDefault(fontObj, text, positionX, positionY, size);
            // fontPath = fontManager.getPathOrDefault(fontObj, text, positionX - fontPath.width / 2, positionY, size);

            fullPath.extend(fontPath.path);
            fullPath.stroke = 'black';
            const d = fullPath.toPathData();
            const newSvgPath = svgPath(d)
                .matrix(attributes.xform);

            if (this.attributes['text-anchor'] === 'middle') {
                newSvgPath.translate(-fontPath.width / 2, 0);
            } else if (this.attributes['text-anchor'] === 'end') {
                newSvgPath.translate(-fontPath.width, 0);
            }

            const newPath = newSvgPath.toString();

            const gString = _.template(TEMPLATE)({
                path: `<path d="${newPath}" stroke="black" stroke-width="1"/>`
            });
            addResult = await this.parseString(gString, 'g');
        }
        return {
            ...result,
            ...addResult
        };
    }
}

export default textParser;
