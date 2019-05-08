/**
 * Normalizer
 *
 * @param anchor
 *
 * TODO: document
 */
export default class Normalizer {
    constructor(anchor, minX, maxX, minY, maxY, scale) {
        this.anchor = anchor;
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
        this.scale = scale;
    }

    x(x) {
        if (this.anchor.endsWith('Left')) {
            x -= this.minX;
        } else if (this.anchor.endsWith('Right')) {
            x -= this.maxX;
        } else {
            x -= (this.minX + this.maxX) * 0.5;
        }
        return Number((x * this.scale.x).toFixed(2));
    }

    y(y) {
        if (this.anchor.startsWith('Bottom')) {
            y -= this.minY;
        } else if (this.anchor.startsWith('Top')) {
            y -= this.maxY;
        } else {
            y -= (this.minY + this.maxY) * 0.5;
        }
        return Number((y * this.scale.y).toFixed(2));
    }
}
