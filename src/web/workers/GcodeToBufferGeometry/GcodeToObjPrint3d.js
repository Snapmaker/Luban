import isEmpty from 'lodash/isEmpty';
import noop from 'lodash/noop';

const KW_TYPE = ';TYPE:';
const KW_LAYER_HEIGHT = ';Layer height:';
const KW_LAYER = ';LAYER:';

const BOUNDS_START_MARK = ';Start GCode end';
const BOUNDS_END_MARK = ';End GCode begin';

const TRAVEL = 'TRAVEL';
const UNKNOWN = 'UNKNOWN';
const TYPE_CODES = {
    'WALL-INNER': 1,
    'WALL-OUTER': 2,
    SKIN: 3,
    SKIRT: 4,
    SUPPORT: 5,
    'SUPPORT-INTERFACE': 5,
    FILL: 6,
    TRAVEL: 7,
    UNKNOWN: 8
};

const COORDINATE = {
    Absolute: 'Absolute',
    Relative: 'Relative'
};

const UNIT = {
    Inch: 'Inch',
    Millimeter: 'Millimeter'
};

/**
 * convert gcode to js object
 */
class GcodeToObjPrint3d {
    init() {
        this.state = {
            x: undefined,
            y: undefined,
            z: undefined,
            e: undefined,
            type: UNKNOWN
        };

        this.shouldUpdateBounds = false;
        this.bounds = {
            minX: Number.MAX_VALUE,
            maxX: Number.MIN_VALUE,
            minY: Number.MAX_VALUE,
            maxY: Number.MIN_VALUE,
            minZ: Number.MAX_VALUE,
            maxZ: Number.MIN_VALUE
        };

        this.layerHeight = 0;
        this.layerCount = 0;
        this.points = [];

        // default is (millimeter & absolute)
        this.unit = UNIT.Millimeter;
        this.coordinate = COORDINATE.Absolute;
    }

    parse(gcode, onParsed = noop, onProgress = noop, onError = noop) {
        if (isEmpty(gcode)) {
            onError(new Error('gcode is empty'));
            return;
        }

        this.init();
        const lines = gcode.split('\n');
        let progress = 0;

        const linesLength = lines.length;
        for (let i = 0, l = lines.length; i < l; i++) {
            this.parseLine(lines[i].trim());
            const curProgress = i / linesLength;
            if ((curProgress - progress > 0.01)) {
                progress = curProgress;
                onProgress(progress);
            }
        }
        onProgress(1);

        const result = {
            layerHeight: this.layerHeight,
            layerCount: this.layerCount,
            unit: this.unit,
            coordinate: this.coordinate,
            bounds: this.bounds,
            typeCodes: TYPE_CODES,
            order: ['x', 'y', 'z', 'typeCode'],
            points: this.points
        };
        onParsed(result);
    }

    parseLine(line) {
        // 1. ignore empty string
        if (line.length === 0) {
            return;
        }

        // 2. filter key word
        if (line.startsWith(KW_TYPE)) {
            this.state.type = line.substring(KW_TYPE.length).trim();
        } else if (line.startsWith(KW_LAYER)) {
            // this.layerIndex = parseInt (line.substring(KW_LAYER.length));
        } else if (line.startsWith(KW_LAYER_HEIGHT)) {
            this.layerHeight = parseFloat(line.substring(KW_LAYER_HEIGHT.length));
        } else if (line.startsWith(BOUNDS_START_MARK)) {
            this.shouldUpdateBounds = true;
        } else if (line.startsWith(BOUNDS_END_MARK)) {
            this.shouldUpdateBounds = false;
        }

        // 3. ignore comments
        if (line.indexOf(';') !== -1) {
            line = line.split(';')[0].trim();
        }

        const tokens = line.split(' '); // G1,F1080,X91.083,Y66.177,E936.7791
        const cmd = tokens[0].toUpperCase(); // G0 or G1 or G92 or M107

        switch (cmd) {
            case 'G28':
                this.parseG28(line);
                break;
            case 'G0':
            case 'G1':
                this.parseG0G1(line);
                break;
            case 'G2':
            case 'G3':
                // G2/G3 - Arc Movement ( G2 clock wise and G3 counter clock wise )
                // log.warn('GcodeParser: Arc command not supported');
                break;
            case 'G90':
                // todo：relative & absolute
                // G90: Set to absolute positioning
                this.coordinate = COORDINATE.Absolute;
                break;
            case 'G91':
                // G91: Set to relative positioning
                this.coordinate = COORDINATE.Relative;
                break;
            case 'G92':
                // G92: Set position to x,y,z,e
                this.parseG92(line);
                break;
            default:
                break;
        }
    }

    parseG28(line) {
        this.state.x = 0;
        this.state.y = 0;
        this.state.z = 0;
        this.points.push([0, 0, 0, TYPE_CODES[TRAVEL]]);
        // todo: handle 'G28 X'
    }

    parseG92(line) {
        const tokens = line.split(' ');
        const args = {};
        tokens.splice(0, 1);
        tokens.forEach((token) => {
            if (token[0] !== undefined) {
                const key = token[0].toLowerCase(); // G/M
                const value = parseFloat(token.substring(1));
                args[key] = value;
            }
        });
        // for example:
        // G1 E20
        // G92 E0
        // G1 E2
        if (args.e !== undefined) {
            this.state.e = args.e;
        }
        // todo: set X/Y/Z
    }

    parseG0G1(line) {
        // line: G1 F900 X52.302 Y55.864 E0.05975
        // todo: case: G1 X20Y20
        const tokens = line.split(' ');
        const args = {};
        tokens.splice(0, 1);
        tokens.forEach((token) => {
            if (token[0] !== undefined) {
                const key = token[0].toLowerCase(); // G/M
                const value = parseFloat(token.substring(1));
                args[key] = value; // {"f":990,"x":39.106,"y":73.464,"e":556.07107}
            }
        });

        // update e no matter position changed
        // no E means travel
        // E is less than last, means retract, now treat as travel
        let type = this.state.type;
        if (args.e === undefined) {
            type = TRAVEL;
        } else {
            type = (args.e < this.state.e) ? TRAVEL : type;
            this.state.e = args.e;
        }

        // one of x/y/z changed means a new point
        // attention: 0 is different undefined
        if (args.x !== undefined ||
            args.y !== undefined ||
            args.z !== undefined) {
            const newPosition = {
                x: (args.x === undefined ? this.state.x : args.x),
                y: (args.y === undefined ? this.state.y : args.y),
                z: (args.z === undefined ? this.state.z : args.z)
            };

            // position changed: push & update bounds
            if (newPosition.x !== this.state.x ||
                newPosition.y !== this.state.y ||
                newPosition.z !== this.state.z) {
                this.points.push([
                    newPosition.x,
                    newPosition.y,
                    newPosition.z,
                    TYPE_CODES[type]
                ]);

                this.state.x = newPosition.x;
                this.state.y = newPosition.y;
                this.state.z = newPosition.z;

                if (this.shouldUpdateBounds) {
                    this.bounds.minX = Math.min(this.state.x, this.bounds.minX);
                    this.bounds.minY = Math.min(this.state.y, this.bounds.minY);
                    this.bounds.minZ = Math.min(this.state.z, this.bounds.minZ);

                    this.bounds.maxX = Math.max(this.state.x, this.bounds.maxX);
                    this.bounds.maxY = Math.max(this.state.y, this.bounds.maxY);
                    this.bounds.maxZ = Math.max(this.state.z, this.bounds.maxZ);
                }
            }
        }
    }
}

export default GcodeToObjPrint3d;
