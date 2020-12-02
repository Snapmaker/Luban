/**
 * Normalizer
 *
 * @param anchor
 *
 * TODO: document
 */
export default class Normalizer {
    constructor(anchor, minX, maxX, minY, maxY, scale, translate = { x: 0, y: 0 }) {
        this.anchor = anchor;
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
        this.scale = scale;
        this.translate = translate;
    }

    x(x) {
        let res = x;
        if (this.anchor.endsWith('Left')) {
            res -= this.minX;
        } else if (this.anchor.endsWith('Right')) {
            res -= this.maxX;
        } else {
            res -= (this.minX + this.maxX) * 0.5;
        }
        return Math.round((res * this.scale.x + this.translate.x) * 100) / 100;
    }

    y(y) {
        let res = y;
        if (this.anchor.startsWith('Bottom')) {
            res -= this.minY;
        } else if (this.anchor.startsWith('Top')) {
            res -= this.maxY;
        } else {
            res -= (this.minY + this.maxY) * 0.5;
        }
        return Math.round((res * this.scale.y + this.translate.y) * 100) / 100;
    }
}
