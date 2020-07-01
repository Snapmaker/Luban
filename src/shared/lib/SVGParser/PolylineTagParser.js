import BaseTagParser from './BaseTagParser';


class PolylineTagParser extends BaseTagParser {
    parse(node, attributes) {
        this.initialize(attributes);

        const points = attributes.points || 0;

        for (let i = 0, l = points.length; i < l; i += 2) {
            const x = points[i];
            const y = points[i + 1];
            if (i === 0) {
                this.moveTo(x, y);
            } else {
                this.lineTo(x, y);
            }
        }

        this.commitPath(!!attributes.fill);

        return this.createShape();
    }
}

export default PolylineTagParser;
