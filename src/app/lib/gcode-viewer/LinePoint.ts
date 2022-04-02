import { Color, Vector3 } from 'three';
import { GRAY_MODE_COLOR, TYPE_SETTINGS } from './constants';

export class LinePoint {
    public readonly point: Vector3

    public readonly radius: number

    public readonly color: Color

    public readonly extruder: number

    public readonly lineType: number

    public readonly layer: number

    constructor(point: Vector3, radius: number, color: Color = new Color('#29BEB0'), extruder: number = 0, type: string = 'TRAVEL',
        isGrayMode: boolean = false, isDual: boolean = false, extruderColors: string[] | undefined = undefined, layer: number = 0) {
        this.point = point;
        this.radius = radius;
        this.color = color;
        this.layer = layer;

        // const typeSetting = TYPE_SETTINGS[type];
        if (type === 'SKIRT') {
            type = 'SUPPORT';
        }
        if (type === 'TRAVEL') {
            this.radius /= 5;
        }
        if (isGrayMode) {
            this.color = new Color(GRAY_MODE_COLOR);
        } else if (isDual && extruderColors !== undefined) {
            this.color = new Color(extruderColors[extruder]); // TODO: debug
        } else {
            this.color = new Color(TYPE_SETTINGS[type].color);
        }

        this.extruder = extruder;
        this.lineType = TYPE_SETTINGS[type].typeCode;
    }
}
