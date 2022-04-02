import {
    Vector3,
    LineCurve3, Color,
} from 'three';
import { LineTubeGeometry } from './LineTubeGeometry';
import { LinePoint } from './LinePoint';
import { SegmentColorizer, SimpleColorizer } from './SegmentColorizer';

export class GCodeParser {
    private combinedLines: LineTubeGeometry[] = []

    private gCode: string

    public startLayer: number | undefined = undefined

    public endLayer: number | undefined = undefined

    public showTypes: boolean[] = [true, true, true, true, true, true, false, true,
        true, true, true, true, true, true, false, true];

    public min?: Vector3

    public max?: Vector3

    public extruderColors: string[] = ['#FFFFFF', '#404040']

    private minTemp: number | undefined = undefined

    private maxTemp = 0

    private minSpeed: number | undefined = undefined

    private maxSpeed = 0

    private layerIndex: { start: number, end: number }[] = []

    private isGrayMode: boolean = false;

    private isDual: boolean = false;

    // Public configurations:

    /**
     * Width of travel-lines. Use 0 to hide them.
     *
     * @type number
     */
    public travelWidth: number = 0.01

    /**
     * Set any colorizer implementation to change the segment color based on the segment
     * metadata. Some default implementations are provided.
     *
     * @type SegmentColorizer
     */
    public colorizer: SegmentColorizer = new SimpleColorizer()

    /**
     * The number of radial segments per line.
     * Less (e.g. 3) provides faster rendering with less memory usage.
     * More (e.g. 8) provides a better look.
     *
     * @default 8
     * @type number
     */
    public radialSegments: number = 8

    /**
     * Internally the rendered object is split into several. This allows to reduce the
     * memory consumption while rendering.
     * You can set the number of points per object.
     * In most cases you can leave this at the default.
     *
     * @default 120000
     * @type number
     */
    public pointsPerObject: number = 120000

    /**
     * Creates a new GCode renderer for the given gcode.
     * It initializes the canvas to the given size and
     * uses the passed color as background.
     *
     * @param {string} gCode
     * @param {number} width
     * @param {number} height
     * @param {Color} background
     */
    constructor(gCode: string) {
        this.gCode = gCode;

        // Pre-calculate some min max values, needed for colorizing.
        this.calcMinMaxMetadata();
    }

    /**
     * This can be used to retrieve some min / max values which may
     * be needed as param for a colorizer.
     * @returns {{
     *         minTemp: number | undefined,
     *         maxTemp: number,
     *         minSpeed: number | undefined,
     *         maxSpeed: number
     *     }}
     */
    public getMinMaxValues() {
        return {
            minTemp: this.minTemp,
            maxTemp: this.maxTemp,
            minSpeed: this.minSpeed,
            maxSpeed: this.maxSpeed
        };
    }

    /**
     * Recalculate the bounding box with the new point.
     * @param {Vector3} newPoint
     */
    private calcMinMax(newPoint: Vector3) {
        if (this.min === undefined) {
            this.min = newPoint.clone();
        }
        if (this.max === undefined) {
            this.max = newPoint.clone();
        }

        if (newPoint.x > this.max.x) {
            this.max.x = newPoint.x;
        }
        if (newPoint.y > this.max.y) {
            this.max.y = newPoint.y;
        }
        if (newPoint.z > this.max.z) {
            this.max.z = newPoint.z;
        }

        if (newPoint.x < this.min.x) {
            this.min.x = newPoint.x;
        }
        if (newPoint.y < this.min.y) {
            this.min.y = newPoint.y;
        }
        if (newPoint.z < this.min.z) {
            this.min.z = newPoint.z;
        }
    }

    private parseValue(value?: string): number | undefined {
        if (!value) {
            return undefined;
        }
        return Number.parseFloat(value.substring(1));
    }

    /**
     * Pre-calculates the min max metadata which may be needed for the colorizers.
     */
    private calcMinMaxMetadata() {
        this.gCode.split('\n').forEach((line) => {
            if (line === undefined || line[0] === ';') {
                return;
            }

            const cmd = line.split(' ');
            if (cmd[0] === 'G0' || cmd[0] === 'G1') {
                // Feed rate -> speed
                const f = this.parseValue(cmd.find((v) => v[0] === 'F'));

                if (f === undefined) {
                    return;
                }

                if (f > this.maxSpeed) {
                    this.maxSpeed = f;
                }
                if (this.minSpeed === undefined || f < this.minSpeed) {
                    this.minSpeed = f;
                }
            } else if (cmd[0] === 'M104' || cmd[0] === 'M109') {
                // hot end temperature
                // M104 S205 ; set hot end temp
                // M109 S205 ; wait for hot end temp
                const hotendTemp = this.parseValue(cmd.find((v) => v[0] === 'S')) || 0;

                if (hotendTemp > this.maxTemp) {
                    this.maxTemp = hotendTemp;
                }
                if (this.minTemp === undefined || hotendTemp < this.minTemp) {
                    this.minTemp = hotendTemp;
                }
            }
        });
    }

    /**
     * Set the lines colors type
     */
    public async setColortypes(isGrayMode: boolean | undefined = undefined, isDual: boolean | undefined = undefined) {
        if (isGrayMode === undefined) {
            isGrayMode = this.isGrayMode;
        }
        if (isDual === undefined) {
            isDual = this.isDual;
        }
        if (this.isGrayMode === isGrayMode && this.isDual === isDual) {
            return;
        }
        this.isGrayMode = isGrayMode;
        this.isDual = isDual;
        let mode = 0;
        if (isDual) {
            mode = 1;
        }
        this.combinedLines.forEach(line => line.changeColorsMode(mode, this.extruderColors));
        this.slice();
    }

    /**
     * Reads the GCode and crates a mesh of it.
     */
    public async parse() {
        this.combinedLines = [];

        // Cache the start and end of each layer.
        // Note: This may not work properly in some cases where the nozzle moves back down mid-print.
        const layerPointsCache: Map<number, { start: number, end: number }> = new Map();

        // Remember which values are in relative-mode.
        const relative: {
            x: boolean,
            y: boolean,
            z: boolean,
            e: boolean
        } = {
            x: false, y: false, z: false, e: false
        };

        // Save some values
        const lastLastPoint: Vector3 = new Vector3(0, 0, 0);
        let lastPoint: Vector3 = new Vector3(0, 0, 0);
        let lastE = 0;
        let lastF = 0;
        // let hotendTemp = 0;

        // Retrieves a value taking into account possible relative values.
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const getValue = (cmd: string[], name: string, last: number, relative: boolean): number => {
            let val = this.parseValue(cmd.find((v) => v[0] === name));

            if (val !== undefined) {
                if (relative) {
                    val += last;
                }
            } else {
                val = last;
            }

            return val;
        };

        const lines: (string | undefined)[] = this.gCode.split('\n');
        // this.gCode = ''; // clear memory

        let type = 'TRAVEL';
        let extruder = 0;
        let layer = 0;

        let currentLayer = 0;
        let lastAddedLinePoint: LinePoint | undefined;
        const addLine = (newLine: LinePoint) => {
            if (newLine.lineType === 1) {
                console.log('newLine', newLine.lineType);
            }
            if (newLine.layer > currentLayer) {
                // end the old geometry and increase the counter
                for (let i = 0; i < 16; i++) {
                    this.combinedLines[currentLayer * 16 + i] && this.combinedLines[currentLayer * 16 + i].finish();
                }
                currentLayer = newLine.layer;
            }

            if (this.combinedLines[currentLayer * 16] === undefined) {
                for (let i = 0; i < 16; i++) {
                    this.combinedLines.push(new LineTubeGeometry(this.radialSegments));
                }
            }

            if (lastAddedLinePoint !== undefined) {
                // const startPoint = lastAddedLinePoint;
                const startPoint = new LinePoint(newLine.point, 0);
                this.combinedLines[currentLayer * 16 + newLine.extruder * 8 + (newLine.lineType - 1)].add(startPoint);
            }
            this.combinedLines[currentLayer * 16 + newLine.extruder * 8 + (newLine.lineType - 1)].add(newLine);

            lastAddedLinePoint = newLine;
        };

        lines.forEach((line, i) => {
            if (line === undefined) {
                return;
            }

            // Split off comments.
            const lineArray = line.split(';', 2);

            line = lineArray[0];

            if (lineArray[1]) {
                const notes = lineArray[1].split(':', 2);
                if (notes[0] === 'TYPE') {
                    type = notes[1].trim();
                }

                // Try to figure out the layer start and end points.
                if (notes[0] === 'LAYER') {
                    layer = Number(notes[1]);

                    let last = layerPointsCache.get(layer - 1);
                    let current = layerPointsCache.get(layer);

                    if (last === undefined) {
                        last = {
                            end: 0,
                            start: 0
                        };
                    }

                    if (current === undefined) {
                        current = {
                            end: 0,
                            start: 0
                        };
                    }

                    layerPointsCache.set(layer - 1, last);
                    layerPointsCache.set(layer, current);
                }
            }

            const cmd = line.split(' ');
            // A move command.
            if (cmd[0] === 'M104') {
                // M104 T0|1, change extruder
                const t = this.parseValue(cmd.find((v) => v[0] === 'T'));
                if (t !== undefined) {
                    extruder = t;
                }
            } else if (cmd[0] === 'G0' || cmd[0] === 'G1') {
                const x = getValue(cmd, 'X', lastPoint.x, relative.x);
                const y = getValue(cmd, 'Y', lastPoint.y, relative.y);
                const z = getValue(cmd, 'Z', lastPoint.z, relative.z);
                const e = getValue(cmd, 'E', lastE, relative.e);
                const f = this.parseValue(cmd.find((v) => v[0] === 'F')) || lastF;

                const newPoint = new Vector3(x, y, z);

                const curve = new LineCurve3(lastPoint, newPoint);
                const length = curve.getLength();

                if (length !== 0) {
                    let radius = (e - lastE) / length * 10;

                    if (radius === 0) {
                        radius = this.travelWidth;
                    } else {
                        // Update the bounding box.
                        this.calcMinMax(newPoint);
                    }

                    // Get the color for this line.
                    // const color = this.colorizer.getColor({
                    //     radius,
                    //     segmentStart: lastPoint,
                    //     segmentEnd: newPoint,
                    //     speed: f,
                    //     temp: hotendTemp
                    // });
                    const color = new Color('#FFFFFF');

                    // Insert the last point with the current radius.
                    // As the GCode contains the extrusion for the 'current' line,
                    // but the LinePoint contains the radius for the 'next' line
                    // we need to combine the last point with the current radius.
                    if (cmd[0] === 'G0') {
                        addLine(new LinePoint(lastPoint.clone(), radius, color, extruder, 'TRAVEL', this.isGrayMode, this.isDual, this.extruderColors, layer));
                    }
                    if (cmd[0] === 'G1') {
                        addLine(new LinePoint(lastPoint.clone(), radius, color, extruder, type, this.isGrayMode, this.isDual, this.extruderColors, layer));
                    }
                }

                // Save the data.
                lastLastPoint.copy(lastPoint);
                lastPoint.copy(newPoint);
                lastE = e;
                lastF = f;

                // Set a value directly.
            } else if (cmd[0] === 'G92') {
                // set state
                lastLastPoint.copy(lastPoint);
                let x = this.parseValue(cmd.find((v) => v[0] === 'X'));
                if (x === undefined) {
                    x = lastPoint.x;
                }
                let y = this.parseValue(cmd.find((v) => v[0] === 'Y'));
                if (y === undefined) {
                    y = lastPoint.y;
                }
                let z = this.parseValue(cmd.find((v) => v[0] === 'Z'));
                if (z === undefined) {
                    z = lastPoint.z;
                }
                lastPoint = new Vector3(
                    x,
                    y,
                    z
                );
                let e = this.parseValue(cmd.find((v) => v[0] === 'E'));
                if (e === undefined) {
                    e = lastE;
                }
                lastE = e;
                // Hot end temperature.
            }

            lines[i] = undefined;
        });

        // Finish last object
        for (let i = 0; i < 16; i++) {
            if (this.combinedLines[currentLayer * 16 + i]) {
                this.combinedLines[currentLayer * 16 + i].finish();
            }
        }
    }

    /**
     * Slices the rendered model based on the passed start and end point numbers.
     * (0, pointsCount()) renders everything
     *
     * Note: Currently negative values are not allowed.
     *
     * @param {number} start the starting segment
     * @param {number} end the ending segment (excluding)
     */
    public slice() {
        this.combinedLines.forEach(line => {
            line.slice();
        });
    }

    /**
     * disposes everything which is dispose able.
     * Call this always before destroying the instance.""
     */
    public dispose() {
        this.combinedLines.forEach(e => e.dispose());
    }

    /**
     * Get the amount of layers in the model.
     * This is an approximation which may be incorrect if the
     * nozzle moves downwards mid print.
     *
     * @returns {number}
     */
    public layerCount(): number {
        // the last layer contains only the start-point, not an end point. -> -1
        return this.layerIndex.length - 1 || 0;
    }

    /**
     * You can get the internal geometries generated from the gcode.
     * Use only if you know what you do.
     * @returns the internal generated geometries.
     */
    public getGeometries() {
        return this.combinedLines;
    }
}
