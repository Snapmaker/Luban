import { parseFloats, cssColor2Hex, xformMultiply } from './Utils';


function parseDAttribute(value) {
    const items = [];

    const re = /([A-Za-z]|(-?[0-9]+\.?[0-9]*(e-?[0-9]*)?))/g;
    let m = re.exec(value);
    while (m) {
        const f = parseFloat(m[1]);
        if (Number.isNaN(f)) {
            // command
            items.push(m[1]);
        } else {
            // number
            items.push(f);
        }
        m = re.exec(value);
    }

    return items;
}

function parseCoordinate(value) {
    const re = /(-?[0-9]+\.?[0-9]*(e-?[0-9]*)?)(px|pt|pc|mm|cm|in|%|em|ex)?/;
    const m = re.exec(value);
    if (m) {
        const num = parseFloat(m[1]);
        const unit = m[3];
        const DPI = 72;
        switch (unit) {
            // Use DPI = 72 to calculate metrics
            case 'px':
                return num;
            case 'pt':
                return num / 72 * DPI;
            case 'pc':
                return num / 6 * DPI;

            // Map to mm metric
            case 'mm':
                return num;
            case 'cm':
                return num * 10;
            case 'in':
                return num * 25.4;

            // Not supported
            case 'em':
                console.warn('No supported unit em');
                // fontSize needed
                return num;
            case 'ex':
                console.warn('No supported unit ex');
                // fontSize needed
                return num;
            case '%':
                // origin and length needed
                console.warn('No supported unit %');
                return 0;
            default:
                return num;
        }
    }

    return 0;
}

function parseColor(value) {
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Content_type#Color
    // hex, rgb, color-keyword
    value = value.trim();

    if (value[0] === '#') {
        // hex
        if (value.length === 4) {
            let hexColor = '#';
            for (let i = 1; i < 4; i++) {
                hexColor += value[i] + value[i];
            }
            return hexColor;
        } else {
            return value;
        }
    }

    // RGB
    if (value.startsWith('rgb(')) {
        value = value.substr(4);
        const floats = parseFloats(value);
        if (value.indexOf('%') === -1) {
            if (floats.length === 3) {
                const hexValue = 0x1000000 + 0x10000 * floats[0] + 0x100 * floats[1] + floats[2];
                return '#' + Number(hexValue).toString(16).substr(1);
            }
        } else if (floats.length === 3) {
            // in percentage
            const hexValue = 0x1000000 + 0x10000 * (floats[0] / 100) * 255 + 0x100 * (floats[1] / 100) * 255 + (floats[2] / 100) * 255;
            return '#' + Number(hexValue).toString(16).substr(1);
        }
    }

    const cssColor = cssColor2Hex(value);
    if (cssColor) {
        return cssColor;
    }

    console.warn('Unsupported color: ', value);
    // TODO: rgba?, hsl?, url?
    return null;
}

function parsePaint(value) {
    // https://www.w3.org/TR/SVG/painting.html#SpecifyingPaint
    // <paint> = none | child | child(<integer>) | <color> | <url> [none | <color>]? | context-fill | context-stroke
    if (value === 'none') {
        return null;
    }

    // TODO
    if (value.startsWith('url')) {
        return null;
    }

    const color = parseColor(value);
    if (color) {
        return color;
    }

    // default value: black
    return '#000000';
}

function parseTransform(value) {
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform
    // <transform-list>
    // transform functions:
    // 1) matrix(a b c d e f)
    // 2) translate(x [y])
    // 3) scale(x [y])
    // 4) rotate(a [x y])
    // 5) skewX(a)
    // 6) skewY(a)

    const re = /([a-z]+)\s*\(([^)]*)\)/gi;

    const xform = [1, 0, 0, 1, 0, 0];

    let m = re.exec(value);
    while (m) {
        const func = m[1].toLowerCase();
        const params = parseFloats(m[2]);

        switch (func) {
            case 'matrix': {
                if (params.length === 6) {
                    xformMultiply(xform, params);
                }
                break;
            }
            case 'translate': {
                if (params.length === 1) {
                    params[1] = 0;
                }
                xformMultiply(xform, [1, 0, 0, 1, params[0], params[1]]);
                break;
            }
            case 'scale': {
                if (params.length === 1) {
                    params[1] = params[0];
                }
                xformMultiply(xform, [params[0], 0, 0, params[1], 0, 0]);
                break;
            }
            case 'rotate': {
                if (params.length === 1) {
                    params[1] = 0;
                    params[2] = 0;
                }
                const angle = params[0] * Math.PI / 180;
                xformMultiply(xform, [1, 0, 0, 1, params[1], params[2]]);
                xformMultiply(xform, [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]);
                xformMultiply(xform, [1, 0, 0, 1, -params[1], -params[2]]);
                break;
            }
            case 'skewx': {
                const angle = params[0] * Math.PI / 180;
                xformMultiply(xform, [1, 0, Math.tan(angle), 1, 0, 0]);
                break;
            }
            case 'skewy': {
                const angle = params[0] * Math.PI / 180;
                xformMultiply(xform, [1, Math.tan(angle), 0, 1, 0, 0]);
                break;
            }
            default: {
                console.warn(`Unknown transform function ${func}`);
                break;
            }
        }

        m = re.exec(value);
    }

    return xform;
}

class AttributesParser {
    constructor(parser) {
        this.parser = parser;
    }

    parse(node, inheritedAttributes) {
        // make a copy of parentAttributes
        const attributes = {
            ...inheritedAttributes,
            xform: [1, 0, 0, 1, 0, 0]
        };

        if (!node.$) {
            return attributes;
        }

        xformMultiply(attributes.xform, inheritedAttributes.xform);

        Object.keys(node.$).forEach((key) => {
            const value = node.$[key];
            this.parseAttribute(attributes, key, value);
        });

        return attributes;
    }

    parseAttribute(attributes, key, value) {
        switch (key) {
            case 'width':
            case 'height':
            case 'cx':
            case 'cy':
            case 'r':
            case 'rx':
            case 'ry':
            case 'x':
            case 'y':
            case 'x1':
            case 'y1':
            case 'x2':
            case 'y2': {
                if (value.endsWith('%')) {
                    // do nothing
                } else {
                    attributes[key] = parseCoordinate(value);
                }
                break;
            }
            case 'stroke-width': {
                attributes.strokeWidth = parseCoordinate(value);
                break;
            }
            case 'd': {
                attributes.d = parseDAttribute(value);
                break;
            }
            case 'color': {
                const color = parseColor(value);
                if (color && color !== 'inherit') {
                    attributes.color = color;
                }
                break;
            }
            case 'fill':
            case 'stroke': {
                const color = parsePaint(value);
                attributes[key] = color;
                break;
            }
            case 'transform': {
                const xform = parseTransform(value);
                xformMultiply(attributes.xform, xform);
                break;
            }
            case 'style': {
                const segments = value.split(';');
                for (const segment of segments) {
                    const kv = segment.split(':');
                    if (kv.length === 2) {
                        const k = kv[0].trim();
                        const v = kv[1].trim();
                        this.parseAttribute(attributes, k, v);
                    }
                }
                break;
            }
            case 'display': {
                if (value === 'none') {
                    attributes.visible = false;
                }
                break;
            }
            case 'visibility': {
                if (value !== 'inherit') {
                    attributes.visibility = (value === 'visible');
                }
                break;
            }
            case 'points': {
                attributes.points = parseFloats(value);
                break;
            }
            case 'viewBox': {
                attributes.viewBox = parseFloats(value);
                break;
            }
            default:
                break;
        }
    }
}

export default AttributesParser;
