import BaseTagParser from './BaseTagParser';


class LineTagParser extends BaseTagParser {
    parse(node, attributes) {
        this.initialize(attributes);

        const x1 = attributes.x1 || 0;
        const y1 = attributes.y1 || 0;
        const x2 = attributes.x2 || 0;
        const y2 = attributes.y2 || 0;

        this.moveTo(x1, y1);
        this.lineTo(x2, y2);

        this.commitPath(false);

        return this.createShape();
    }
}

export default LineTagParser;
