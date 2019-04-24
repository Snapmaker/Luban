import BaseTagParser from './BaseTagParser';


class CircleTagParser extends BaseTagParser {
    parse(node, attributes) {
        this.initialize(attributes);

        const cx = attributes.cx || 0;
        const cy = attributes.cy || 0;
        const r = attributes.r || 0;

        if (r > 0) {
            this.moveTo(cx - r, cy);
            this.arcTo(cx - r, cy, r, r, 0, 0, 0, cx, cy + r);
            this.arcTo(cx, cy + r, r, r, 0, 0, 0, cx + r, cy);
            this.arcTo(cx + r, cy, r, r, 0, 0, 0, cx, cy - r);
            this.arcTo(cx, cy - r, r, r, 0, 0, 0, cx - r, cy);

            this.commitPath(true);
        }

        return this.createShape();
    }
}

export default CircleTagParser;
