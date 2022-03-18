import { Color, Vector3 } from 'three';
import { Lut } from 'three/examples/jsm/math/Lut';

export interface SegmentMetadata {
    segmentStart: Vector3
    segmentEnd: Vector3
    radius: number
    temp: number
    speed: number

    // TODO: Linetype based on comments in gcode
}

export interface SegmentColorizer {
    getColor(meta: SegmentMetadata): Color
}

export class SimpleColorizer implements SegmentColorizer {
    private readonly color

    constructor(color = new Color('#29BEB0')) {
        this.color = color;
    }

    getColor(): Color {
        return this.color;
    }
}

export abstract class LutColorizer implements SegmentColorizer {
    protected readonly lut: Lut

    constructor(lut = new Lut('cooltowarm')) {
        this.lut = lut;
    }

    abstract getColor(meta: SegmentMetadata): Color;
}

export class SpeedColorizer extends LutColorizer {
    constructor(minSpeed: number, maxSpeed: number) {
        super();
        this.lut.setMin(minSpeed);
        this.lut.setMax(maxSpeed);
    }

    getColor(meta: SegmentMetadata): Color {
        return this.lut.getColor(meta.speed);
    }
}

export class TempColorizer extends LutColorizer {
    constructor(minTemp: number, maxTemp: number) {
        super();
        this.lut.setMin(minTemp);
        this.lut.setMax(maxTemp);
    }

    getColor(meta: SegmentMetadata): Color {
        return this.lut.getColor(meta.temp);
    }
}
