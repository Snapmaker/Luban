import BaseTagParser from './BaseTagParser';


class EllipseTagParser extends BaseTagParser {
    parse(node, attributes) {
        this.initialize(attributes);

        const cx = attributes.cx || 0;
        const cy = attributes.cy || 0;
        const rx = attributes.rx || 0;
        const ry = attributes.ry || 0;

        if (rx > 0 && ry > 0) {
            this.moveTo(cx - rx, cy);
            this.arcTo(cx - rx, cy, rx, ry, 0, 0, 0, cx, cy + ry);
            this.arcTo(cx, cy + ry, rx, ry, 0, 0, 0, cx + rx, cy);
            this.arcTo(cx + rx, cy, rx, ry, 0, 0, 0, cx, cy - ry);
            this.arcTo(cx, cy - ry, rx, ry, 0, 0, 0, cx - rx, cy);

            this.commitPath(true);
        }

        return this.createShape();
    }
}

export default EllipseTagParser;
