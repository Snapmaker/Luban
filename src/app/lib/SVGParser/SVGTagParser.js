import { xformMultiply } from './Utils';
import BaseTagParser from './BaseTagParser';

class SVGTagParser extends BaseTagParser {
    initialize(attributes) {
        super.initialize(attributes);

        if (attributes.width && attributes.height && !attributes.viewBox) {
            attributes.viewBox = [0, 0, attributes.width, attributes.height];
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

        let scaleX = 1;
        let scaleY = 1;

        if (attributes.width && attributes.height) {
            scaleX = attributes.width / attributes.viewBox[2];
            scaleY = attributes.height / attributes.viewBox[3];
        } else if (attributes.width) {
            scaleX = attributes.width / attributes.viewBox[2];
            scaleY = scaleX;
        } else if (attributes.height) {
            scaleY = attributes.height / attributes.viewBox[3];
            scaleX = scaleY;
        }

        xformMultiply(this.attributes.xform, [scaleX, 0, 0, scaleY, 0, 0]);

        xformMultiply(this.attributes.xform, [1, 0, 0, 1, -attributes.viewBox[0], -attributes.viewBox[1]]);
    }
}

export default SVGTagParser;
