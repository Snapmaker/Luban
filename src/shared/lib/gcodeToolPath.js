import Interpreter from './gcodeInterpreter';

// from in to mm
const in2mm = (val = 0) => val * 25.4;

// const TRAVEL = 'TRAVEL';
// const UNKNOWN = 'UNKNOWN';
const TYPE_CODES = {
    'WALL-INNER': 1,
    'WALL-OUTER': 2,
    SKIN: 3,
    SKIRT: 5,
    SUPPORT: 5,
    'SUPPORT-INTERFACE': 5,
    FILL: 6,
    TRAVEL: 7,
    UNKNOWN: 8
};

// noop
const noop = () => {};

const translatePosition = (position, newPosition, relative) => {
    relative = !!relative;
    newPosition = Number(newPosition);
    if (Number.isNaN(newPosition)) {
        return position;
    }
    return relative ? (position + newPosition) : newPosition;
};

class ToolPath {
    g92offset = {
        x: 0,
        y: 0,
        z: 0,
        b: 0
    };

    position = {
        x: 0,
        y: 0,
        z: 0,
        b: 0,
        e: 0,
        type: TYPE_CODES.UNKNOWN
    };

    modal = {
        // Motion Mode
        // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
        motion: 'G0',

        // Coordinate System Select
        // G54, G55, G56, G57, G58, G59
        wcs: 'G54',

        // Plane Select
        // G17: XY-plane, G18: ZX-plane, G19: YZ-plane
        plane: 'G17',

        // Units Mode
        // G20: Inches, G21: Millimeters
        units: 'G21',

        // Distance Mode
        // G90: Absolute, G91: Relative
        distance: 'G90',

        // Arc IJK distance mode
        arc: 'G91.1',

        // Feed Rate Mode
        // G93: Inverse time mode, G94: Units per minute mode, G95: Units per rev mode
        feedrate: 'G94',

        // Cutter Radius Compensation
        cutter: 'G40',

        // Tool Length Offset
        // G43.1, G49
        tlo: 'G49',

        // Program Mode
        // M0, M1, M2, M30
        program: 'M0',

        // Spingle State
        // M3, M4, M5
        spindle: 'M5',

        // Coolant State
        // M7, M8, M9
        coolant: 'M9', // 'M7', 'M8', 'M7,M8', or 'M9'

        // Tool Select
        tool: 0,

        gcodeType: 'end',

        layerHeight: 0.001,

        headerType: '',

        isRotate: false,

        diameter: 0
    };

    offsetG92 = (pos) => {
        return {
            x: pos.x + this.g92offset.x,
            y: pos.y + this.g92offset.y,
            z: pos.z + this.g92offset.z,
            b: pos.b + this.g92offset.b,
            type: pos.type
        };
    };

    offsetAddLine = (start, end) => {
        this.fn.addLine(this.modal, this.offsetG92(start), this.offsetG92(end));
    };

    offsetAddArcCurve = (start, end, center) => {
        this.fn.addArcCurve(this.modal, this.offsetG92(start), this.offsetG92(end), this.offsetG92(center));
    };

    commentHandlers = {
        ';TYPE': (params) => {
            const type = TYPE_CODES[params.trim()];
            if (type && this.position.type !== type) {
                this.position.type = type;
            }
        },

        ';Start GCode end': () => {
            if (this.modal.gcodeType !== 'start') {
                this.modal.gcodeType = 'start';
            }
        },

        ';End GCode begin': () => {
            if (this.modal.gcodeType !== 'end') {
                this.modal.gcodeType = 'end';
            }
        },

        ';Layer height': (params) => {
            const layerHeight = parseFloat(params);
            if (!Number.isNaN(layerHeight)) {
                this.modal.layerHeight = layerHeight;
            }
        },

        ';Header Start': () => {
            this.fn.addHeader({ headerStart: true });
        },

        ';renderMethod': (param) => {
            if (param !== undefined && param !== null) {
                this.fn.addHeader({ renderMethod: param });
            }
        },

        ';header_type': (param) => {
            if (param !== undefined && param !== null) {
                this.modal.headerType = param;
            }
        },

        ';is_rotate': (param) => {
            if (param !== undefined && param !== null) {
                this.modal.isRotate = param;
            }
        },

        ';diameter': (param) => {
            if (param !== undefined && param !== null) {
                this.modal.diameter = param;
            }
        }
    };

    handlers = {
        // G0: Rapid Linear Move
        'G0': (params) => {
            if (this.modal.motion !== 'G0') {
                this.setModal({ motion: 'G0' });
            }

            const v1 = {
                x: this.position.x,
                y: this.position.y,
                z: this.position.z,
                b: this.position.b
            };
            const v2 = {
                x: this.translateX(params.X),
                y: this.translateY(params.Y),
                z: this.translateZ(params.Z),
                b: this.translateB(params.B),
                type: this.translateType(params.E)
            };
            const targetPosition = { x: v2.x, y: v2.y, z: v2.z, b: v2.b, e: params.E };

            // if (v1.x !== v2.x || v1.y !== v2.y || v1.z !== v2.z) {
            this.offsetAddLine(v1, v2);
            // }

            // Update position
            this.setPosition(targetPosition.x, targetPosition.y, targetPosition.z, targetPosition.b, targetPosition.e);
        },
        // G1: Linear Move
        // Usage
        //   G1 Xnnn Ynnn Znnn Ennn Fnnn Snnn
        // Parameters
        //   Xnnn The position to move to on the X axis
        //   Ynnn The position to move to on the Y axis
        //   Znnn The position to move to on the Z axis
        //   Fnnn The feedrate per minute of the move between the starting point and ending point (if supplied)
        //   Snnn Flag to check if an endstop was hit (S1 to check, S0 to ignore, S2 see note, default is S0)
        // Examples
        //   G1 X12 (move to 12mm on the X axis)
        //   G1 F1500 (Set the feedrate to 1500mm/minute)
        //   G1 X90.6 Y13.8 E22.4 (Move to 90.6mm on the X axis and 13.8mm on the Y axis while extruding 22.4mm of material)
        //
        'G1': (params) => {
            if (this.modal.motion !== 'G1') {
                this.setModal({ motion: 'G1' });
            }

            const v1 = {
                x: this.position.x,
                y: this.position.y,
                z: this.position.z,
                b: this.position.b
            };
            const v2 = {
                x: this.translateX(params.X),
                y: this.translateY(params.Y),
                z: this.translateZ(params.Z),
                b: this.translateB(params.B),
                type: this.translateType(params.E)
            };
            const targetPosition = { x: v2.x, y: v2.y, z: v2.z, b: v2.b, e: params.E };

            // if (v1.x !== v2.x || v1.y !== v2.y || v1.z !== v2.z) {
            this.offsetAddLine(v1, v2);
            // }

            // Update position
            this.setPosition(targetPosition.x, targetPosition.y, targetPosition.z, targetPosition.b, targetPosition.e);
        },
        // G2 & G3: Controlled Arc Move
        // Usage
        //   G2 Xnnn Ynnn Innn Jnnn Ennn Fnnn (Clockwise Arc)
        //   G3 Xnnn Ynnn Innn Jnnn Ennn Fnnn (Counter-Clockwise Arc)
        // Parameters
        //   Xnnn The position to move to on the X axis
        //   Ynnn The position to move to on the Y axis
        //   Innn The point in X space from the current X position to maintain a constant distance from
        //   Jnnn The point in Y space from the current Y position to maintain a constant distance from
        //   Fnnn The feedrate per minute of the move between the starting point and ending point (if supplied)
        // Examples
        //   G2 X90.6 Y13.8 I5 J10 E22.4 (Move in a Clockwise arc from the current point to point (X=90.6,Y=13.8),
        //   with a center point at (X=current_X+5, Y=current_Y+10), extruding 22.4mm of material between starting and stopping)
        //   G3 X90.6 Y13.8 I5 J10 E22.4 (Move in a Counter-Clockwise arc from the current point to point (X=90.6,Y=13.8),
        //   with a center point at (X=current_X+5, Y=current_Y+10), extruding 22.4mm of material between starting and stopping)
        // Referring
        //   http://linuxcnc.org/docs/2.5/html/gcode/gcode.html#sec:G2-G3-Arc
        //   https://github.com/grbl/grbl/issues/236
        'G2': (params) => {
            if (this.modal.motion !== 'G2') {
                this.setModal({ motion: 'G2' });
            }

            const v1 = {
                x: this.position.x,
                y: this.position.y,
                z: this.position.z
            };
            const v2 = {
                x: this.translateX(params.X),
                y: this.translateY(params.Y),
                z: this.translateZ(params.Z)
            };
            const v0 = { // fixed point
                x: this.translateI(params.I),
                y: this.translateJ(params.J),
                z: this.translateK(params.K)
            };
            const isClockwise = true;
            const targetPosition = { x: v2.x, y: v2.y, z: v2.z };

            if (this.isXYPlane()) { // XY-plane
                [v1.x, v1.y, v1.z] = [v1.x, v1.y, v1.z];
                [v2.x, v2.y, v2.z] = [v2.x, v2.y, v2.z];
                [v0.x, v0.y, v0.z] = [v0.x, v0.y, v0.z];
            } else if (this.isZXPlane()) { // ZX-plane
                [v1.x, v1.y, v1.z] = [v1.z, v1.x, v1.y];
                [v2.x, v2.y, v2.z] = [v2.z, v2.x, v2.y];
                [v0.x, v0.y, v0.z] = [v0.z, v0.x, v0.y];
            } else if (this.isYZPlane()) { // YZ-plane
                [v1.x, v1.y, v1.z] = [v1.y, v1.z, v1.x];
                [v2.x, v2.y, v2.z] = [v2.y, v2.z, v2.x];
                [v0.x, v0.y, v0.z] = [v0.y, v0.z, v0.x];
            } else {
                // console.error('The plane mode is invalid', this.modal.plane);
                return;
            }

            if (params.R) {
                const radius = this.translateR(Number(params.R) || 0);
                const x = v2.x - v1.x;
                const y = v2.y - v1.y;
                const distance = Math.sqrt(x * x + y * y);
                let height = Math.sqrt(4 * radius * radius - x * x - y * y) / 2;

                if (isClockwise) {
                    height = -height;
                }
                if (radius < 0) {
                    height = -height;
                }

                const offsetX = x / 2 - y / distance * height;
                const offsetY = y / 2 + x / distance * height;

                v0.x = v1.x + offsetX;
                v0.y = v1.y + offsetY;
            }

            this.offsetAddArcCurve(v1, v2, v0);

            // Update position
            this.setPosition(targetPosition.x, targetPosition.y, targetPosition.z);
        },
        'G3': (params) => {
            if (this.modal.motion !== 'G3') {
                this.setModal({ motion: 'G3' });
            }

            const v1 = {
                x: this.position.x,
                y: this.position.y,
                z: this.position.z
            };
            const v2 = {
                x: this.translateX(params.X),
                y: this.translateY(params.Y),
                z: this.translateZ(params.Z)
            };
            const v0 = { // fixed point
                x: this.translateI(params.I),
                y: this.translateJ(params.J),
                z: this.translateK(params.K)
            };
            const isClockwise = false;
            const targetPosition = { x: v2.x, y: v2.y, z: v2.z };

            if (this.isXYPlane()) { // XY-plane
                [v1.x, v1.y, v1.z] = [v1.x, v1.y, v1.z];
                [v2.x, v2.y, v2.z] = [v2.x, v2.y, v2.z];
                [v0.x, v0.y, v0.z] = [v0.x, v0.y, v0.z];
            } else if (this.isZXPlane()) { // ZX-plane
                [v1.x, v1.y, v1.z] = [v1.z, v1.x, v1.y];
                [v2.x, v2.y, v2.z] = [v2.z, v2.x, v2.y];
                [v0.x, v0.y, v0.z] = [v0.z, v0.x, v0.y];
            } else if (this.isYZPlane()) { // YZ-plane
                [v1.x, v1.y, v1.z] = [v1.y, v1.z, v1.x];
                [v2.x, v2.y, v2.z] = [v2.y, v2.z, v2.x];
                [v0.x, v0.y, v0.z] = [v0.y, v0.z, v0.x];
            } else {
                // console.error('The plane mode is invalid', this.modal.plane);
                return;
            }

            if (params.R) {
                const radius = this.translateR(Number(params.R) || 0);
                const x = v2.x - v1.x;
                const y = v2.y - v1.y;
                const distance = Math.sqrt(x * x + y * y);
                let height = Math.sqrt(4 * radius * radius - x * x - y * y) / 2;

                if (isClockwise) {
                    height = -height;
                }
                if (radius < 0) {
                    height = -height;
                }

                const offsetX = x / 2 - y / distance * height;
                const offsetY = y / 2 + x / distance * height;

                v0.x = v1.x + offsetX;
                v0.y = v1.y + offsetY;
            }

            this.offsetAddArcCurve(v1, v2, v0);

            // Update position
            this.setPosition(targetPosition.x, targetPosition.y, targetPosition.z);
        },
        // G4: Dwell
        // Parameters
        //   Pnnn Time to wait, in milliseconds
        //   Snnn Time to wait, in seconds (Only on Marlin and Smoothie)
        // Example
        //   G4 P200
        'G4': () => {
        },
        // G10: Coordinate System Data Tool and Work Offset Tables
        'G10': () => {
        },
        // G17..19: Plane Selection
        // G17: XY (default)
        'G17': () => {
            if (this.modal.plane !== 'G17') {
                this.setModal({ plane: 'G17' });
            }
        },
        // G18: XZ
        'G18': () => {
            if (this.modal.plane !== 'G18') {
                this.setModal({ plane: 'G18' });
            }
        },
        // G19: YZ
        'G19': () => {
            if (this.modal.plane !== 'G19') {
                this.setModal({ plane: 'G19' });
            }
        },
        // G20: Use inches for length units
        'G20': () => {
            if (this.modal.units !== 'G20') {
                this.setModal({ units: 'G20' });
            }
        },
        // G21: Use millimeters for length units
        'G21': () => {
            if (this.modal.units !== 'G21') {
                this.setModal({ units: 'G21' });
            }
        },
        'G28': () => {
            // todo Confirm G28
            const v1 = {
                x: this.position.x,
                y: this.position.y,
                z: this.position.z
            };
            this.position.x = 0;
            this.position.y = 0;
            this.position.z = 0;
            const v2 = {
                x: this.position.x,
                y: this.position.y,
                z: this.position.z,
                type: TYPE_CODES.TRAVEL
            };
            this.offsetAddLine(v1, v2);
        },
        // G38.x: Straight Probe
        // G38.2: Probe toward workpiece, stop on contact, signal error if failure
        'G38.2': () => {
            if (this.modal.motion !== 'G38.2') {
                this.setModal({ motion: 'G38.2' });
            }
        },
        // G38.3: Probe toward workpiece, stop on contact
        'G38.3': () => {
            if (this.modal.motion !== 'G38.3') {
                this.setModal({ motion: 'G38.3' });
            }
        },
        // G38.4: Probe away from workpiece, stop on loss of contact, signal error if failure
        'G38.4': () => {
            if (this.modal.motion !== 'G38.4') {
                this.setModal({ motion: 'G38.4' });
            }
        },
        // G38.5: Probe away from workpiece, stop on loss of contact
        'G38.5': () => {
            if (this.modal.motion !== 'G38.5') {
                this.setModal({ motion: 'G38.5' });
            }
        },
        // G43.1: Tool Length Offset
        'G43.1': () => {
            if (this.modal.tlo !== 'G43.1') {
                this.setModal({ tlo: 'G43.1' });
            }
        },
        // G49: No Tool Length Offset
        'G49': () => {
            if (this.modal.tlo !== 'G49') {
                this.setModal({ tlo: 'G49' });
            }
        },
        // G54..59: Coordinate System Select
        'G54': () => {
            if (this.modal.wcs !== 'G54') {
                this.setModal({ wcs: 'G54' });
            }
        },
        'G55': () => {
            if (this.modal.wcs !== 'G55') {
                this.setModal({ wcs: 'G55' });
            }
        },
        'G56': () => {
            if (this.modal.wcs !== 'G56') {
                this.setModal({ wcs: 'G56' });
            }
        },
        'G57': () => {
            if (this.modal.wcs !== 'G57') {
                this.setModal({ wcs: 'G57' });
            }
        },
        'G58': () => {
            if (this.modal.wcs !== 'G58') {
                this.setModal({ wcs: 'G58' });
            }
        },
        'G59': () => {
            if (this.modal.wcs !== 'G59') {
                this.setModal({ wcs: 'G59' });
            }
        },
        // G80: Cancel Canned Cycle
        'G80': () => {
            if (this.modal.motion !== 'G80') {
                this.setModal({ motion: 'G80' });
            }
        },
        // G90: Set to Absolute Positioning
        // Example
        //   G90
        // All coordinates from now on are absolute relative to the origin of the machine.
        'G90': () => {
            if (this.modal.distance !== 'G90') {
                this.setModal({ distance: 'G90' });
            }
        },
        // G91: Set to Relative Positioning
        // Example
        //   G91
        // All coordinates from now on are relative to the last position.
        'G91': () => {
            if (this.modal.distance !== 'G91') {
                this.setModal({ distance: 'G91' });
            }
        },
        // G92: Set Position
        // Parameters
        //   This command can be used without any additional parameters.
        //   Xnnn new X axis position
        //   Ynnn new Y axis position
        //   Znnn new Z axis position
        // Example
        //   G92 X10
        // Allows programming of absolute zero point, by reseting the current position to the params specified.
        // This would set the machine's X coordinate to 10. No physical motion will occur.
        // A G92 without coordinates will reset all axes to zero.
        'G92': (params) => {
            // A G92 without coordinates will reset all axes to zero.
            if ((params.X === undefined) && (params.Y === undefined) && (params.Z === undefined)) {
                this.position.x += this.g92offset.x;
                this.g92offset.x = 0;
                this.position.y += this.g92offset.y;
                this.g92offset.y = 0;
                this.position.z += this.g92offset.z;
                this.g92offset.z = 0;
            } else {
                // The calls to translateX/Y/Z() below are necessary for inch/mm conversion
                // params.X/Y/Z must be interpreted as absolute positions, hence the "false"
                if (params.X !== undefined) {
                    const xmm = this.translateX(params.X, false);
                    this.g92offset.x += this.position.x - xmm;
                    this.position.x = xmm;
                }
                if (params.Y !== undefined) {
                    const ymm = this.translateY(params.Y, false);
                    this.g92offset.y += this.position.y - ymm;
                    this.position.y = ymm;
                }
                if (params.Z !== undefined) {
                    const zmm = this.translateX(params.Z, false);
                    this.g92offset.z += this.position.z - zmm;
                    this.position.z = zmm;
                }
            }
            if (params.E !== undefined) {
                this.position.e = params.E;
            }
        },
        // G92.1: Cancel G92 offsets
        // Parameters
        //   none
        'G92.1': () => {
            this.position.x += this.g92offset.x;
            this.g92offset.x = 0;
            this.position.y += this.g92offset.y;
            this.g92offset.y = 0;
            this.position.z += this.g92offset.z;
            this.g92offset.z = 0;
        },
        // G93: Inverse Time Mode
        // In inverse time feed rate mode, an F word means the move should be completed in
        // [one divided by the F number] minutes.
        // For example, if the F number is 2.0, the move should be completed in half a minute.
        'G93': () => {
            if (this.modal.feedmode !== 'G93') {
                this.setModal({ feedmode: 'G93' });
            }
        },
        // G94: Units per Minute Mode
        // In units per minute feed rate mode, an F word on the line is interpreted to mean the
        // controlled point should move at a certain number of inches per minute,
        // millimeters per minute or degrees per minute, depending upon what length units
        // are being used and which axis or axes are moving.
        'G94': () => {
            if (this.modal.feedmode !== 'G94') {
                this.setModal({ feedmode: 'G94' });
            }
        },
        // G94: Units per Revolution Mode
        // In units per rev feed rate mode, an F word on the line is interpreted to mean the
        // controlled point should move at a certain number of inches per spindle revolution,
        // millimeters per spindle revolution or degrees per spindle revolution, depending upon
        // what length units are being used and which axis or axes are moving.
        'G95': () => {
            if (this.modal.feedmode !== 'G95') {
                this.setModal({ feedmode: 'G95' });
            }
        },
        // M0: Program Pause
        'M0': () => {
            if (this.modal.program !== 'M0') {
                this.setModal({ program: 'M0' });
            }
        },
        // M1: Program Pause
        'M1': () => {
            if (this.modal.program !== 'M1') {
                this.setModal({ program: 'M1' });
            }
        },
        // M2: Program End
        'M2': () => {
            if (this.modal.program !== 'M2') {
                this.setModal({ program: 'M2' });
            }
        },
        // M30: Program End
        'M30': () => {
            if (this.modal.program !== 'M30') {
                this.setModal({ program: 'M30' });
            }
        },
        // Spindle Control
        // M3: Start the spindle turning clockwise at the currently programmed speed
        'M3': () => {
            if (this.modal.spindle !== 'M3') {
                this.setModal({ spindle: 'M3' });
            }
        },
        // M4: Start the spindle turning counterclockwise at the currently programmed speed
        'M4': () => {
            if (this.modal.spindle !== 'M4') {
                this.setModal({ spindle: 'M4' });
            }
        },
        // M5: Stop the spindle from turning
        'M5': () => {
            if (this.modal.spindle !== 'M5') {
                this.setModal({ spindle: 'M5' });
            }
        },
        // M6: Tool Change
        'M6': (params) => {
            if (params && params.T !== undefined) {
                this.setModal({ tool: params.T });
            }
        },
        // Coolant Control
        // M7: Turn mist coolant on
        'M7': () => {
            const coolants = this.modal.coolant.split(',');
            if (coolants.indexOf('M7') >= 0) {
                return;
            }

            this.setModal({
                coolant: coolants.indexOf('M8') >= 0 ? 'M7,M8' : 'M7'
            });
        },
        // M8: Turn flood coolant on
        'M8': () => {
            const coolants = this.modal.coolant.split(',');
            if (coolants.indexOf('M8') >= 0) {
                return;
            }

            this.setModal({
                coolant: coolants.indexOf('M7') >= 0 ? 'M7,M8' : 'M8'
            });
        },
        // M9: Turn all coolant off
        'M9': () => {
            if (this.modal.coolant !== 'M9') {
                this.setModal({ coolant: 'M9' });
            }
        },
        'T': (tool) => {
            if (tool !== undefined) {
                this.setModal({ tool: tool });
            }
        }
    };

    // @param {object} [options]
    // @param {object} [options.position]
    // @param {object} [options.modal]
    // @param {function} [options.addLine]
    // @param {function} [options.addArcCurve]
    constructor(options) {
        const {
            position,
            modal,
            addLine = noop,
            addArcCurve = noop,
            addHeader = noop
        } = { ...options };
        this.g92offset.x = 0;
        this.g92offset.y = 0;
        this.g92offset.z = 0;

        // Position
        if (position) {
            const { x, y, z } = { ...position };
            this.setPosition(x, y, z);
        }

        // Modal
        const nextModal = {};
        Object.keys({ ...modal }).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(this.modal, key)) {
                return;
            }
            nextModal[key] = modal[key];
        });
        this.setModal(nextModal);

        this.fn = { addLine, addArcCurve, addHeader };

        const toolpath = new Interpreter({ handlers: this.handlers, commentHandlers: this.commentHandlers });
        toolpath.getPosition = () => ({ ...this.position });
        toolpath.getModal = () => ({ ...this.modal });
        toolpath.setPosition = (...pos) => {
            return this.setPosition(...pos);
        };
        toolpath.setModal = (d) => {
            return this.setModal(d);
        };

        return toolpath;
    }

    setModal(modal) {
        this.modal = {
            ...this.modal,
            ...modal
        };
        return this.modal;
    }

    isMetricUnits() { // mm
        return this.modal.units === 'G21';
    }

    isImperialUnits() { // inches
        return this.modal.units === 'G20';
    }

    isAbsoluteDistance() {
        return this.modal.distance === 'G90';
    }

    isRelativeDistance() {
        return this.modal.distance === 'G91';
    }

    isXYPlane() {
        return this.modal.plane === 'G17';
    }

    isZXPlane() {
        return this.modal.plane === 'G18';
    }

    isYZPlane() {
        return this.modal.plane === 'G19';
    }

    setPosition(...pos) {
        if (typeof pos[0] === 'object') {
            const { x, y, z, b, e } = { ...pos[0] };
            this.position.x = (typeof x === 'number') ? x : this.position.x;
            this.position.y = (typeof y === 'number') ? y : this.position.y;
            this.position.z = (typeof z === 'number') ? z : this.position.z;
            this.position.b = (typeof b === 'number') ? b : this.position.b;
            this.position.e = (typeof e === 'number') ? e : this.position.e;
        } else {
            const [x, y, z, b, e] = pos;
            this.position.x = (typeof x === 'number') ? x : this.position.x;
            this.position.y = (typeof y === 'number') ? y : this.position.y;
            this.position.z = (typeof z === 'number') ? z : this.position.z;
            this.position.b = (typeof z === 'number') ? b : this.position.b;
            this.position.e = (typeof e === 'number') ? e : this.position.e;
        }
    }

    translateType(e) {
        const type = e === undefined || e < this.position.e ? TYPE_CODES.TRAVEL : this.position.type;
        return type;
    }


    translateX(x, relative) {
        if (x !== undefined) {
            x = this.isImperialUnits() ? in2mm(x) : x;
        }
        if (relative === undefined) {
            relative = this.isRelativeDistance();
        }
        return translatePosition(this.position.x, x, !!relative);
    }

    translateY(y, relative) {
        if (y !== undefined) {
            y = this.isImperialUnits() ? in2mm(y) : y;
        }
        if (relative === undefined) {
            relative = this.isRelativeDistance();
        }
        return translatePosition(this.position.y, y, !!relative);
    }

    translateZ(z, relative) {
        if (z !== undefined) {
            z = this.isImperialUnits() ? in2mm(z) : z;
        }
        if (relative === undefined) {
            relative = this.isRelativeDistance();
        }
        return translatePosition(this.position.z, z, !!relative);
    }

    translateB(b, relative) {
        if (b !== undefined) {
            b = this.isImperialUnits() ? in2mm(b) : b;
        }
        if (relative === undefined) {
            relative = this.isRelativeDistance();
        }
        return translatePosition(this.position.b, b, !!relative);
    }

    translateI(i) {
        return this.translateX(i, true);
    }

    translateJ(j) {
        return this.translateY(j, true);
    }

    translateK(k) {
        return this.translateZ(k, true);
    }

    translateR(r) {
        r = Number(r);
        if (Number.isNaN(r)) {
            return 0;
        }
        return this.isImperialUnits() ? in2mm(r) : r;
    }
}

export default ToolPath;
