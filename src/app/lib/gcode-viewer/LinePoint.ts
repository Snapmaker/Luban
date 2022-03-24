import { Color, Vector3 } from 'three';
import { TYPE_SETTINGS } from './constants';
import { VisibleType } from './parser';

export class LinePoint {
    public readonly point: Vector3

    public readonly radius: number

    public readonly color: Color

    public readonly extruder: number

    public readonly type: string

    constructor(point: Vector3, radius: number, color: Color = new Color('#29BEB0'), extruder: number = 0, type: string = 'TRAVEL', visibleTypes: VisibleType) {
        this.point = point;
        this.radius = radius;
        this.color = color;

        // const typeSetting = TYPE_SETTINGS[type];
        if (type === 'TRAVEL') {
            this.radius /= 5;
        }
        if (!visibleTypes[type]) {
            this.radius = 0;
        }
        this.color = new Color(TYPE_SETTINGS[type].color);

        this.extruder = extruder;
        this.type = type;
    }
}
