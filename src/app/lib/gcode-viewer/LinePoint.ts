import { Color, Vector3 } from 'three';

export class LinePoint {
    public readonly point: Vector3

    public readonly radius: number

    public readonly color: Color

    constructor(point: Vector3, radius: number, color: Color = new Color('#29BEB0')) {
        this.point = point;
        this.radius = radius;
        this.color = color;
    }
}
