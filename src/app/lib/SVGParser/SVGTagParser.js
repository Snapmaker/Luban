import { xformMultiply } from './Utils';
import BaseTagParser from './BaseTagParser';

class SVGTagParser extends BaseTagParser {
    initialize(attributes) {
        super.initialize(attributes);

        if (attributes.width && attributes.height && !attributes.viewBox) {
            attributes.viewBox = [0, 0, attributes.width, attributes.height];
        }

        if (attributes.width && !attributes.height) {
            const scale = attributes.width / attributes.viewBox[2];
            attributes.height = attributes.viewBox[3] * scale;
        }

        if (!attributes.width && attributes.height) {
            const scale = attributes.height / attributes.viewBox[3];
            attributes.width = attributes.viewBox[2] * scale;
        }

        if (!attributes.width && !attributes.height) {
            attributes.width = attributes.viewBox[2];
            attributes.height = attributes.viewBox[3];
        }
    }

    parse(node, attributes) {
        this.initialize(attributes);

        if (attributes.x) {
            xformMultiply(this.attributes.xform, [1, 0, 0, 1, attributes.x, 0]);
        }
        if (attributes.y) {
            xformMultiply(this.attributes.xform, [1, 0, 0, 1, 0, attributes.y]);
        }

        const scaleX = attributes.width / attributes.viewBox[2];
        const scaleY = attributes.height / attributes.viewBox[3];

        xformMultiply(this.attributes.xform, [scaleX, 0, 0, scaleY, 0, 0]);

        xformMultiply(this.attributes.xform, [1, 0, 0, 1, -attributes.viewBox[0], -attributes.viewBox[1]]);
    }
}

export default SVGTagParser;
