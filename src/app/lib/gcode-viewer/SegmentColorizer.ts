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
    private readonly color;

    public constructor(color = new Color('#29BEB0')) {
        this.color = color;
    }

    public getColor(): Color {
        return this.color;
    }
}

export abstract class LutColorizer implements SegmentColorizer {
    protected readonly lut: Lut;

    public constructor(lut = new Lut('cooltowarm')) {
        this.lut = lut;
    }

    public abstract getColor(meta: SegmentMetadata): Color;
}

export class SpeedColorizer extends LutColorizer {
    public constructor(minSpeed: number, maxSpeed: number) {
        super();
        this.lut.setMin(minSpeed);
        this.lut.setMax(maxSpeed);
    }

    public getColor(meta: SegmentMetadata): Color {
        return this.lut.getColor(meta.speed);
    }
}

export class TempColorizer extends LutColorizer {
    public constructor(minTemp: number, maxTemp: number) {
        super();
        this.lut.setMin(minTemp);
        this.lut.setMax(maxTemp);
    }

    public getColor(meta: SegmentMetadata): Color {
        return this.lut.getColor(meta.temp);
    }
}
