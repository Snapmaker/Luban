import { Vector3 } from 'three';
import { GRAY_MODE_COLOR, TYPE_SETTINGS } from './constants';

export class LinePoint {
    public readonly point: Vector3

    public readonly radius: number

    public readonly color: number[]

    public readonly color1: number[]

    public readonly extruder: number

    public readonly lineType: number

    public readonly layer: number

    public readonly type: string

    constructor(point: Vector3, radius: number, extruder: number = 0, type: string = 'TRAVEL',
        isGrayMode: boolean = false, extruderColors: { toolColor0: string, toolColor1: string } = { toolColor0: '#FFFFFF', toolColor1: '#000000' }, layer: number = 0) {
        this.point = point;
        this.radius = radius;
        this.layer = layer;
        this.type = type;
        this.extruder = extruder;

        // const typeSetting = TYPE_SETTINGS[type];
        if (type === 'SKIRT') {
            type = 'SUPPORT';
        }
        if (type === 'TRAVEL') {
            this.radius /= 5;
        }
        let { toolColor0, toolColor1 } = extruderColors;
        if (isGrayMode) {
            toolColor0 = GRAY_MODE_COLOR;
            toolColor1 = GRAY_MODE_COLOR;
        } else if (extruderColors) {
            toolColor0 = extruderColors?.toolColor0;
            toolColor1 = extruderColors?.toolColor1;
        }

        let r0: number, b0: number, g0: number, r1: number, b1: number, g1: number;
        if (toolColor0.length === 7) {
            r0 = parseInt(toolColor0.substring(1, 3), 16);
            g0 = parseInt(toolColor0.substring(3, 5), 16);
            b0 = parseInt(toolColor0.substring(5), 16);
        } else {
            r0 = 255;
            b0 = 255;
            g0 = 255;
        }
        if (toolColor1.length === 7) {
            r1 = parseInt(toolColor1.substring(1, 3), 16);
            g1 = parseInt(toolColor1.substring(3, 5), 16);
            b1 = parseInt(toolColor1.substring(5), 16);
        } else {
            r1 = 0;
            b1 = 0;
            g1 = 0;
        }
        const typeSetting = TYPE_SETTINGS[type];
        this.color = [
            typeSetting.rgb[0],
            typeSetting.rgb[1],
            typeSetting.rgb[2]
        ];
        this.color1 = extruder === 0 ? [r0, g0, b0] : [r1, g1, b1];

        this.lineType = TYPE_SETTINGS[type].typeCode;
    }
}
