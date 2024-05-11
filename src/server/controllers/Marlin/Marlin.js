import events from 'events';
import get from 'lodash/get';
import isEqual from 'lodash/isEqual';
import isUndefined from 'lodash/isUndefined';
import set from 'lodash/set';
import semver from 'semver';

import {
    L20WLaserToolModule,
    L2WLaserToolModule,
    L40WLaserToolModule,
    highPower10WLaserToolHead,
    highPower200WCNCToolHead,
    standardLaserToolHead
} from '../../../app/machines/snapmaker-2-toolheads';
import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
} from '../constants';

// http://stackoverflow.com/questions/10454518/javascript-how-to-retrieve-the-number-of-decimals-of-a-string-number
function decimalPlaces(num) {
    const match = (String(num)).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    if (!match) {
        return 0;
    }
    return Math.max(
        0,
        // Number of digits right of decimal point.
        (match[1] ? match[1].length : 0)
        // Adjust for scientific notation.
        - (match[2] ? +match[2] : 0)
    );
}


/**
 * Reply parser for tool head type (M1006)
 *
 * For details see [Snapmaker-GD32Base](https://snapmaker2.atlassian.net/wiki/spaces/SNAP/pages/3440681/Snapmaker-GD32Base).
 * Examples:
 *  'Firmware Version: Snapmaker-Base-2.2'
 *  'Firmware Version: Snapmaker-Base-2.4-beta'
 *  'Firmware Version: Snapmaker-Base-2.4-alpha3'
 */
class MarlinReplyParserFirmwareVersion {
    static parse(line) {
        const r = line.match(/^Firmware Version: (.*)-([0-9.]+(-(alpha|beta)[1-9]?)?)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserFirmwareVersion,
            payload: {
                version: semver.coerce(r[2])
            }
        };
    }
}

/**
 * Marlin SM2-1.2.1.0
 * Marlin SM2-1.2.1.0-alpha1
 * Marlin SM2-1.2.1.0-beta2
 */
class MarlinReplyParserSeries {
    static parse(line) {
        const r = line.match(/^Marlin (.*)-([0-9.]+(-(alpha|beta|Alpha|Beta)[1-9]?)?)$/);
        if (!r) {
            return null;
        }

        return {
            type: MarlinReplyParserSeries,
            payload: {
                series: r[1],
                version: semver.coerce(r[2]).version
            }
        };
    }
}

/**
 * Machine Size: L
 */
class MarlinReplyParserSeriesSize {
    static parse(line) {
        const r = line.match(/^Machine Size: (.*)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserSeriesSize,
            payload: {
                seriesSize: r[1].trim()
            }
        };
    }
}

class MarlinReplyParserHeadStatus {
    static parse(line) {
        const r = line.match(/^Current Status: (ON|OFF)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserHeadStatus,
            payload: {
                headStatus: r[1] === 'ON'
            }
        };
    }
}

class MarlinReplyParserHeadPower {
    static parse(line) {
        const r = line.match(/^Current Power: (.*)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserHeadPower,
            payload: {
                headPower: parseFloat(r[1])
            }
        };
    }
}

class MarlinReplyParserFocusHeight {
    static parse(line) {
        const r = line.match(/^Focus Height: (.*)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserFocusHeight,
            payload: {
                zFocus: parseFloat(r[1])
            }
        };
    }
}

//  Enclosure STOP
class MarlinReplyParserEmergencyStop {
    static parse(line) {
        const r = line.match(/;Locked UART/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserEmergencyStop,
            payload: {
                releaseDate: r[2]
            }
        };
    }
}

// Emergency STOP Button
class MarlinReplyParserEmergencyStopButton {
    static parse(line) {
        // line message: 'emergency stop state'
        const r = line.match(/^emergency stop state(.+)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserEmergencyStopButton,
            payload: {
                releaseDate: r[1]
            }
        };
    }
}

class MarlinReplyParserReleaseDate {
    static parse(line) {
        const r = line.match(/^Release Date: (.*)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserReleaseDate,
            payload: {
                releaseDate: r[2]
            }
        };
    }
}


class MarlinReplyParserToolHead {
    static parse(line) {
        const r = line.match(/^Tool Head: ([a-zA-Z0-9 ]+)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserToolHead,
            payload: {
                headType: r[1]
            }
        };
    }
}

class MarlinReplyParserZAxisModule {
    static parse(line) {
        const r = line.match(/M1025 X[0-9.]+ Y[0-9.]+ Z([0-9.]+)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserZAxisModule,
            payload: {
                zAxisModuleLength: r[1]
            }
        };
    }
}

class MarlinReplyParserEnclosure {
    static parse(line) {
        const r = line.match(/^Enclosure: (On|Off)$/);
        if (!r) {
            return null;
        }

        return {
            type: MarlinReplyParserEnclosure,
            payload: {
                enclosureDoorDetection: r[1] === 'On'
            }
        };
    }
}

class MarlinReplyParserEnclosureOnline {
    static parse(line) {
        const r = line.match(/^Enclosure online: (On|Off)$/);
        if (!r) {
            return null;
        }

        return {
            type: MarlinReplyParserEnclosureOnline,
            payload: {
                enclosureOnline: r[1] === 'On'
            }
        };
    }
}

class MarlinReplyParserEnclosureDoor {
    static parse(line) {
        const r = line.match(/^Enclosure door: (Open|Closed)$/);
        if (!r) {
            return null;
        }

        return {
            type: MarlinReplyParserEnclosureDoor,
            payload: {
                enclosureDoor: r[1] === 'Open'
            }
        };
    }
}
class MarlinReplyParserEnclosureLightPower {
    static parse(line) {
        const r = line.match(/^Enclosure light power: (0|100)$/);

        if (!r) {
            return null;
        }

        return {
            type: MarlinReplyParserEnclosureLightPower,
            payload: {
                enclosureLight: Number(r[1])
            }
        };
    }
}

class MarlinReplyParserEnclosureFanPower {
    static parse(line) {
        const r = line.match(/^Enclosure fan power: (0|100)$/);
        if (!r) {
            return null;
        }

        return {
            type: MarlinReplyParserEnclosureFanPower,
            payload: {
                enclosureFan: Number(r[1])
            }
        };
    }
}

class MarlinReplyParserPurifierNotEnabled {
    static parse(line) {
        const r0 = line.match(/^Purifier err code:0X2$/);
        const r1 = line.match(/^Purifier extand power err$/);
        if (r0 || r1) {
            return {
                type: MarlinReplyParserPurifierNotEnabled
            };
        } else {
            return null;
        }
    }
}

class MarlinReplyParserPurifierOffline {
    static parse(line) {
        const r0 = line.match(/^echo:Unknown command: "M1011"$/);
        const r1 = line.match(/^Purifier is not exist\.$/);
        if (r0 || r1) {
            return {
                type: MarlinReplyParserPurifierOffline
            };
        } else {
            return null;
        }
    }
}

class MarlinReplyParserPurifierFanWork {
    static parse(line) {
        const r = line.match(/^Purifier Fan work: (0|1)$/);
        if (!r) {
            return null;
        }

        return {
            type: MarlinReplyParserPurifierFanWork,
            payload: {
                airPurifierSwitch: r[1] === '1'
            }
        };
    }
}

class MarlinReplyParserPurifierFanSpeed {
    static parse(line) {
        const r = line.match(/^Purifier Fan gears: ([0-3])$/);
        /*
            the number [0-3] means fan speed level
            0: close
            1: low
            2: medium
            3: high
         */
        if (!r) {
            return null;
        }

        return {
            type: MarlinReplyParserPurifierFanSpeed,
            payload: {
                airPurifierFanSpeed: Number(r[1])
            }
        };
    }
}

class MarlinReplyParserPurifierLifetime {
    static parse(line) {
        const r = line.match(/^Purifier Filter lifetime:(.*)$/);
        if (!r) {
            return null;
        }
        let lifetimeState;
        switch (r[1]) {
            case 'normal':
                lifetimeState = 2;
                break;
            case 'medium':
                lifetimeState = 1;
                break;
            case 'low':
                lifetimeState = 0;
                break;
            default:
                lifetimeState = undefined;
        }

        return {
            type: MarlinReplyParserPurifierLifetime,
            payload: {
                airPurifierFilterHealth: lifetimeState
            }
        };
    }
}

class MarlinReplyParserEmergencyStopIsOnline {
    static parse(line) {
        const r = line.match(/^Emergency stop: (On|Off)$/);
        if (!r) {
            return null;
        }

        return {
            type: MarlinReplyParserEmergencyStopIsOnline,
            payload: {
                emergencyStopOnline: r[1] === 'On'
            }
        };
    }
}
class MarlinReplyParserGetPurifierOthers {
    static parse(line) {
        const r = line.match(/^Purifier Fan (.*)$/);
        if (!r) {
            return null;
        }
        return {
            type: MarlinReplyParserGetPurifierOthers,
            payload: {}
        };
    }
}

class MarlinLineParserResultStart {
    // start
    static parse(line) {
        const r = line.match(/^start$/);
        if (!r) {
            return null;
        }

        const payload = {};

        return {
            type: MarlinLineParserResultStart,
            payload: payload
        };
    }
}


class MarlinLineParserResultPosition {
    // X:0.00 Y:0.00 Z:0.00 E:0.00 B:0.00 Count X:0 Y:0 Z:0
    static parse(line) {
        const r = line.match(/^(?:(?:X|Y|Z|E|B):[0-9.-]+\s+)+/i);
        if (!r) {
            return null;
        }

        const payload = {
            pos: {}
        };
        const pattern = /((X|Y|Z|E|B):[0-9.-]+)+/gi;
        const params = r[0].match(pattern);

        for (const param of params) {
            const nv = param.match(/^(.+):(.+)/);
            if (nv) {
                const axis = nv[1].toLowerCase();
                const pos = nv[2];
                const digits = decimalPlaces(pos);
                payload.pos[axis] = Number(pos).toFixed(digits);
            }
        }

        if (isUndefined(payload.pos.b)) {
            payload.pos.isFourAxis = false;
        } else {
            payload.pos.isFourAxis = true;
        }

        return {
            type: MarlinLineParserResultPosition,
            payload: payload
        };
    }
}

class MarlinLineParserResultOk {
    // ok
    static parse(line) {
        const r = line.match(/^ok($| [0-9]+$)/);
        if (!r) {
            return null;
        }

        const payload = {};

        return {
            type: MarlinLineParserResultOk,
            payload: payload
        };
    }
}

class MarlinLineParserResultEcho {
    // echo:
    static parse(line) {
        const r = line.match(/^echo:\s*(.+)$/i);
        if (!r) {
            return null;
        }

        const payload = {
            message: r[1]
        };

        return {
            type: MarlinLineParserResultEcho,
            payload: payload
        };
    }
}

class MarlinLineParserResultError {
    // Error:Printer halted. kill() called!
    static parse(line) {
        const r = line.match(/^Error:\s*(.+)$/i);
        if (!r) {
            return null;
        }

        const payload = {
            message: r[1]
        };

        return {
            type: MarlinLineParserResultError,
            payload: payload
        };
    }
}

class MarlinLineParserResultOkTemperature {
    static parse(line) {
        const re = /ok (T):([0-9.-]+) *\/([0-9.-]+).*(B):([0-9.-]+) *\/([0-9.-]+)/g;
        const r = re.exec(line);
        if (!r) {
            return null;
        }
        const payload = {
            temperature: {}
        };


        const params = [[r[1], r[2], r[3]], [r[4], r[5], r[6]]];
        for (const param of params) {
            // const nv = param.match(/^(.+):(.+)/);
            // if (nv) {
            const axis = param[0].toLowerCase();
            const pos = param[1];
            const posTarget = param[2];
            const digits = decimalPlaces(pos);
            const digitsTarget = decimalPlaces(posTarget);
            payload.temperature[axis] = Number(pos).toFixed(digits);
            payload.temperature[`${axis}Target`] = Number(posTarget).toFixed(digitsTarget);
        }
        return {
            type: MarlinLineParserResultOkTemperature,
            payload: payload
        };
    }
}

class MarlinLineParserResultTemperature {
    static parse(line) {
        const re = /(T):([0-9.-]+) *\/([0-9.-]+).*(B):([0-9.-]+) *\/([0-9.-]+)/g;
        const r = re.exec(line);
        if (!r) {
            return null;
        }
        const payload = {
            temperature: {}
        };

        const params = [[r[1], r[2], r[3]], [r[4], r[5], r[6]]];
        for (const param of params) {
            // const nv = param.match(/^(.+):(.+)/);
            // if (nv) {
            const axis = param[0].toLowerCase();
            const pos = param[1];
            const posTarget = param[2];
            const digits = decimalPlaces(pos);
            const digitsTarget = decimalPlaces(posTarget);
            payload.temperature[axis] = Number(pos).toFixed(digits);
            payload.temperature[`${axis}Target`] = Number(posTarget).toFixed(digitsTarget);
        }
        return {
            type: MarlinLineParserResultTemperature,
            payload: payload
        };
    }
}

class MarlinParserSelectedOrigin {
    static parse(line) {
        const r = line.match(/^Selected origin num: (.*)$/);
        if (!r) {
            return null;
        }
        const payload = {
            message: r[1]
        };

        return {
            type: MarlinParserSelectedOrigin,
            payload: payload
        };
    }
}


class MarlinParserSelectedCurrent {
    static parse(line) {
        const r = line.match(/^Selected == Current: (.*)$/);
        if (!r) {
            return null;
        }
        const payload = {
            message: r[1]
        };

        return {
            type: MarlinParserSelectedCurrent,
            payload: payload
        };
    }
}

class MarlinParserOriginOffset {
    static parse(line) {
        const r = line.match(/^Origin offset ([XYZB]): (.*)$/);
        if (!r) {
            return null;
        }

        const key = r[1].toLowerCase();
        const data = parseFloat(r[2]);
        const originOffset = {};
        originOffset[key] = data;

        return {
            type: MarlinParserOriginOffset,
            payload: {
                originOffset
            }
        };
    }
}

class MarlinParserHomeState {
    static parse(line) {
        const r = line.match(/^Homed: (.*)$/);
        if (!r) {
            return null;
        }
        let isHomed = null;
        if (r[1] === 'YES') {
            isHomed = true;
        } else if (r[1] === 'NO') {
            isHomed = false;
        }

        return {
            type: MarlinParserHomeState,
            payload: {
                isHomed
            }
        };
    }
}

class MarlinParserLaser10WErrorState {
    static parse(line) {
        // security_state: 2, temp……
        const r1 = line.match(/^security_state: ([0-9]),.*$/);
        // Laser 10w security state: 0x02
        const r2 = line.match(/^Laser 10w security state: 0x([0-9]+).*$/);
        if (!r1 && !r2) {
            return null;
        }
        const securityState = (r1 && r1[1]) || (r2 && r2[1]);
        return {
            type: MarlinParserLaser10WErrorState,
            payload: {
                laser10WErrorState: parseInt(securityState, 10)
            }
        };
    }
}

class MarlinReplyParserCNCRPM {
    static parse(line) {
        const r1 = line.match(/^rpm: ([0-9]+).*$/);
        const r2 = line.match(/^M_I: ([0-9]+).*$/);
        const r3 = line.match(/^M_TEMP: ([0-9]+).*$/);
        const r4 = line.match(/^ctr mode:.*$/);
        const r5 = line.match(/^cur_power: ([0-9]+).*$/);
        const r6 = line.match(/^run status:.*$/);
        const r7 = line.match(/^last error:.*$/);
        const M1006UnneedMsg = r1 || r2 || r3 || r4 || r5 || r6 || r7;


        const macth1 = line.match(/^cur_rpm: ([0-9]+) target_rpm: ([0-9]+).*$/);
        const macth2 = line.match(/^RPM: ([0-9]+).*$/);
        if (!macth1 && !M1006UnneedMsg && !macth2) {
            return null;
        }

        if (macth1) {
            return {
                type: MarlinReplyParserCNCRPM,
                payload: {
                    currRpm: parseInt(macth1[1], 10),
                    targetRpm: parseInt(macth1[2], 10)
                }
            };
        } else if (macth2) {
            return {
                type: MarlinReplyParserCNCRPM,
                payload: {
                    currRpm: parseInt(macth2[1], 10),
                }
            };
        } else {
            return { type: MarlinReplyParserCNCRPM };
        }
    }
}

class MarlinKitsParser {
    static parse(line) {
        const match = line.match(/^kits: (.*)$/);
        if (!match) return null;
        return {
            type: MarlinKitsParser,
            payload: {
                kit: match[1],
            }
        };
    }
}

class MarlinGetCrossHairOffset {
    static parse(line) {
        const match = line.match(/^Get CrossLightOffset X: (.*), Y: (.*)$/);
        if (!match) return null;
        const x = match[1];
        const y = match[2];
        console.log('-------', x, y, 'end');

        return {
            type: MarlinGetCrossHairOffset,
            payload: {
                crossHairOffset: {
                    x,
                    y,
                }
            }
        };
    }
}

class MarlinLineParser {
    parse(line) {
        const parsers = [
            // ok
            MarlinLineParserResultOk,

            // cnc emergency stop when enclosure open
            MarlinReplyParserEmergencyStop,

            // cnc rpm
            MarlinReplyParserCNCRPM,

            // emergency stop button
            MarlinReplyParserEmergencyStopButton,
            MarlinReplyParserEmergencyStopIsOnline,

            // New Parsers (follow headType `MarlinReplyParserXXX`)
            // M1005
            MarlinReplyParserFirmwareVersion,

            // Marlin SM2-1.2.1.0
            MarlinReplyParserSeries,

            // Machine Size: L
            MarlinReplyParserSeriesSize,

            MarlinReplyParserReleaseDate,
            // M1006
            MarlinReplyParserToolHead,
            // M1025
            MarlinReplyParserZAxisModule,
            // M1010
            MarlinReplyParserEnclosure,
            MarlinReplyParserEnclosureOnline,
            MarlinReplyParserEnclosureDoor,
            MarlinReplyParserEnclosureFanPower,
            MarlinReplyParserEnclosureLightPower,
            // M1011
            MarlinReplyParserPurifierNotEnabled,
            MarlinReplyParserPurifierOffline,
            // MarlinReplyParserPurifierPower,
            MarlinReplyParserPurifierFanWork,
            MarlinReplyParserPurifierFanSpeed,
            MarlinReplyParserPurifierLifetime,
            MarlinReplyParserGetPurifierOthers,

            // start
            MarlinLineParserResultStart,

            // X:0.00 Y:0.00 Z:0.00 E:0.00 Count X:0 Y:0 Z:0
            MarlinLineParserResultPosition,

            // echo:
            MarlinLineParserResultEcho,

            // Error:Printer halted. kill() called!
            MarlinLineParserResultError,

            MarlinLineParserResultOkTemperature,
            // ok T:293.0 /0.0 B:25.9 /0.0 B@:0 @:0
            MarlinLineParserResultTemperature,
            // Homed: YES
            MarlinParserHomeState,

            // laser 10w error state
            MarlinParserLaser10WErrorState,

            MarlinParserOriginOffset,

            MarlinParserSelectedCurrent,

            MarlinParserSelectedOrigin,
            // M1006
            MarlinReplyParserFocusHeight,

            MarlinReplyParserHeadPower,

            MarlinReplyParserHeadStatus,

            // M1005
            MarlinKitsParser,

            MarlinGetCrossHairOffset
        ];

        for (const parser of parsers) {
            // let result = null;
            // if (parser === MarlinReplyParserPurifierNotEnabled) {
            //     result = parser.parse(line, settings);
            // } else {
            //     result = parser.parse(line);
            // }
            const result = parser.parse(line);
            if (result) {
                set(result, 'payload.raw', line);
                return result;
            }
        }

        return {
            type: null,
            payload: {
                raw: line
            }
        };
    }
}

class Marlin extends events.EventEmitter {
    state = {
        series: '',
        seriesSize: '',
        // firmware version
        version: '1.0.0',
        // tool head type
        headType: '',
        toolHead: '',
        pos: {
            x: '0.000',
            y: '0.000',
            z: '0.000',
            e: '0.000',
            isFourAxis: false
        },
        modal: {
            motion: 'G0', // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
            units: 'G21', // G20: Inches, G21: Millimeters
            distance: 'G90', // G90: Absolute, G91: Relative
            feedrate: 'G94', // G93: Inverse time mode, G94: Units per minute
            spindle: 'M5' // M3: Spindle (cw), M4: Spindle (ccw), M5: Spindle off
        },
        speedFactor: 100,
        extruderFactor: 100,
        temperature: {
            b: '0.0',
            bTarget: '0.0',
            t: '0.0',
            tTarget: '0.0'
        },
        spindle: 0, // Related to M3, M4, M5
        jogSpeed: 0, // G0
        workSpeed: 0, // G1
        headStatus: false,
        // Head Power (in percentage, an integer between 0~100)
        headPower: 0,
        gcodeFile: null,
        updateFile: null,
        calibrationMargin: 0,
        updateProgress: 0,
        updateCount: 0,
        firmwareVersion: '',
        moduleID: 0,
        moduleVersion: '',
        machineSetting: {},
        zFocus: 0,
        gcodeHeader: 0,
        isHomed: null,

        // 0 byte: state
        // 1 byte: temperature error
        // 2 byte: angel error
        laser10WErrorState: 0,

        originOffset: {
            x: 0,
            y: 0,
            z: 0
        },
        zAxisModule: 0, // 0: standard module, 1: extension module
        hexModeEnabled: false,
        isScreenProtocol: false,


        // quick_change_kit
        // reinforcement_kit
        kits: []
    };

    settings = {
        // whether enclosure is turned on
        enclosure: false,
        enclosureDoor: false,
        enclosureOnline: false,
        enclosureLight: 0,
        enclosureFan: 0,

        airPurifier: false,
        airPurifierSwitch: false,
        airPurifierFanSpeed: 3,
        airPurifierFilterHealth: 2,
        airPurifierHasPower: true,

        emergencyStopOnline: false
    };

    parser = new MarlinLineParser();

    // packetManager = new PacketManager();

    setState(state) {
        const nextState = { ...this.state, ...state };

        if (!isEqual(this.state, nextState)) {
            this.state = nextState;
        }
    }

    set(settings) {
        const nextSettings = { ...this.settings, ...settings };

        if (!isEqual(this.settings, nextSettings)) {
            this.settings = nextSettings;
        }
    }

    parse(data) {
        data = (String(data)).replace(/\s+$/, '');
        if (!data) {
            return;
        }

        this.emit('raw', { raw: data });

        const result = this.parser.parse(data) || {};
        const { type, payload } = result;

        if (type === MarlinReplyParserFirmwareVersion) {
            this.setState({ version: payload.version });
            this.emit('firmware', payload);
        } else if (type === MarlinReplyParserSeries) {
            this.setState({ series: payload.series, version: payload.version });
            this.emit('series', payload);
        } else if (type === MarlinReplyParserSeriesSize) {
            this.setState({ seriesSize: payload.seriesSize });
            this.emit('series', payload);
        } else if (type === MarlinReplyParserReleaseDate) {
            this.emit('firmware', payload);
        } else if (type === MarlinReplyParserToolHead) {
            const newState = {};
            switch (payload.headType) {
                case 'LASER':
                    newState.headType = HEAD_LASER;
                    newState.toolHead = standardLaserToolHead.identifier;
                    break;
                case '10W LASER':
                    newState.headType = HEAD_LASER;
                    newState.toolHead = highPower10WLaserToolHead.identifier;
                    break;
                case '20W LASER':
                    newState.headType = HEAD_LASER;
                    newState.toolHead = L20WLaserToolModule.identifier;
                    break;
                case '40W LASER':
                    newState.headType = HEAD_LASER;
                    newState.toolHead = L40WLaserToolModule.identifier;
                    break;
                case '2W RED LASER':
                    newState.headType = HEAD_LASER;
                    newState.toolHead = L2WLaserToolModule.identifier;
                    break;
                case '3DP':
                    newState.headType = HEAD_PRINTING;
                    break;
                case 'CNC':
                    newState.headType = HEAD_CNC;
                    break;
                case '200W CNC':
                    newState.headType = HEAD_CNC;
                    newState.toolHead = highPower200WCNCToolHead.identifier;
                    break;
                default:
                    newState.headType = payload.headType;
                    break;
            }
            if (this.state.headType !== payload.headType) {
                this.setState({
                    headType: newState.headType,
                    toolHead: newState.toolHead
                });
            }
            this.emit('headType', payload);
        } else if (type === MarlinReplyParserZAxisModule) {
            // 1: 221.00, 0: 128.00
            const zAxisModule = (payload.zAxisModuleLength > 200 ? 1 : 0);
            if (this.settings.zAxisModule !== zAxisModule) {
                this.setState({ zAxisModule: zAxisModule });
            }
        } else if (type === MarlinReplyParserFocusHeight) {
            if (this.state.zFocus !== payload.zFocus) {
                this.setState({ zFocus: payload.zFocus });
            }
            this.emit('focusHeight', payload);
        } else if (type === MarlinReplyParserHeadPower) {
            if (this.state.headPower !== payload.headPower) {
                this.setState({ headPower: payload.headPower });
            }
            this.emit('headPower', payload);
        } else if (type === MarlinReplyParserHeadStatus) {
            if (this.state.headStatus !== payload.headStatus) {
                this.setState({ headStatus: payload.headStatus });
            }
            this.emit('headStatus', payload);
        } else if (type === MarlinReplyParserEnclosureLightPower) {
            if (this.settings.enclosureLight !== payload.enclosureLight) {
                this.set({ enclosureLight: payload.enclosureLight });
            }
            this.emit('enclosure', payload);
        } else if (type === MarlinReplyParserEnclosureFanPower) {
            if (this.settings.enclosureFan !== payload.enclosureFan) {
                this.set({ enclosureFan: payload.enclosureFan });
            }
            this.emit('enclosure', payload);
        } else if (type === MarlinReplyParserEnclosure) {
            if (this.settings.enclosureDoorDetection !== payload.enclosureDoorDetection) {
                this.set({ enclosureDoorDetection: payload.enclosureDoorDetection });
            }
            this.emit('enclosure', payload);
        } else if (type === MarlinReplyParserEnclosureOnline) {
            if (this.settings.enclosureOnline !== payload.enclosureOnline) {
                this.set({ enclosureOnline: payload.enclosureOnline });
            }
            this.emit('enclosure', payload);
        } else if (type === MarlinReplyParserEnclosureDoor) {
            if (this.settings.enclosureDoor !== payload.enclosureDoor) {
                this.set({ enclosureDoor: payload.enclosureDoor });
            }
            this.emit('enclosure', payload);
        } else if (type === MarlinReplyParserPurifierNotEnabled) {
            // this.set({ airPurifier: false });
            // if (payload.airPurifierHasPower === undefined) {
            //     this.set({ airPurifier: payload.airPurifier, airPurifierHasPower: true });
            // } else {
            //     this.set({ airPurifierHasPower: payload.airPurifierHasPower });
            // }
            this.set({ airPurifierHasPower: false });
        } else if (type === MarlinReplyParserPurifierOffline) {
            this.set({ airPurifier: false });
        } else if (type === MarlinReplyParserPurifierFanWork) {
            if (this.settings.airPurifierHasPower === false) {
                this.set({ airPurifierHasPower: true });
            }
            if (this.settings.airPurifier !== (payload.airPurifierSwitch !== undefined)) {
                this.set({ airPurifier: (payload.airPurifierSwitch !== undefined) });
            }
            if (this.settings.airPurifierSwitch !== payload.airPurifierSwitch) {
                this.set({ airPurifierSwitch: payload.airPurifierSwitch });
            }
            this.emit('purifier', payload);
        } else if (type === MarlinReplyParserPurifierFanSpeed) {
            if (this.settings.airPurifierFanSpeed !== payload.airPurifierFanSpeed) {
                this.set({ airPurifierFanSpeed: payload.airPurifierFanSpeed });
            }
            this.emit('purifier', payload);
        } else if (type === MarlinReplyParserPurifierLifetime) {
            if (this.settings.airPurifierFilterHealth !== payload.airPurifierFilterHealth) {
                this.set({ airPurifierFilterHealth: payload.airPurifierFilterHealth });
            }
            this.emit('purifier', payload);
        } else if (type === MarlinReplyParserGetPurifierOthers) {
            this.emit('purifier', payload);
        } else if (type === MarlinLineParserResultStart) {
            this.emit('start', payload);
        } else if (type === MarlinReplyParserEmergencyStop) {
            this.emit('cnc:stop', payload);
        } else if (type === MarlinReplyParserEmergencyStopButton) {
            this.emit('emergencyStop', payload);
        } else if (type === MarlinReplyParserEmergencyStopIsOnline) {
            this.set({ emergencyStopOnline: payload.emergencyStopOnline });
        } else if (type === MarlinParserOriginOffset) {
            this.setState({
                originOffset: {
                    ...this.state.originOffset,
                    ...payload.originOffset
                }
            });
            this.emit('originOffset', payload);
        } else if (type === MarlinLineParserResultPosition) {
            const nextState = {
                ...this.state,
                pos: {
                    ...this.state.pos,
                    ...payload.pos
                }
            };

            if (!isEqual(this.state.pos, nextState.pos)) {
                this.state = nextState; // enforce change
            }
            this.emit('pos', payload);
        } else if (type === MarlinLineParserResultOk) {
            this.emit('ok', payload);
        } else if (type === MarlinLineParserResultError) {
            this.emit('error', payload);
        } else if (type === MarlinLineParserResultEcho) {
            this.emit('echo', payload);
        } else if (type === MarlinLineParserResultTemperature) {
            // For firmware version < 2.4, we use temperature to determine head type
            this.setState({ temperature: payload.temperature });
            this.emit('temperature', payload);
        } else if (type === MarlinLineParserResultOkTemperature) {
            this.setState({ temperature: payload.temperature });
            this.emit('temperature', payload);
            this.emit('ok');
        } else if (type === MarlinParserHomeState) {
            this.setState({ isHomed: payload.isHomed });
            this.emit('home', payload);
        } else if (type === MarlinParserLaser10WErrorState) {
            this.setState({ laser10WErrorState: payload.laser10WErrorState });
            this.emit('laser10w:state', payload);
        } else if (type === MarlinParserSelectedOrigin) {
            this.emit('selected', payload);
        } else if (type === MarlinParserSelectedCurrent) {
            this.emit('selected', payload);
        } else if (type === MarlinReplyParserCNCRPM) {
            if (typeof payload.currRpm !== 'undefined') {
                this.setState({
                    cncCurrentSpindleSpeed: payload.currRpm,
                    cncTargetSpindleSpeed: payload.targetRpm
                });
                this.emit('cnc:highpower', payload);
            }
        } else if (type === MarlinKitsParser) {
            if (typeof payload.kit !== 'undefined') {
                this.emit('kits', { kits: payload.kit.split(' ') });
            }
        } else if (type === MarlinGetCrossHairOffset) {
            this.setState({
                crosshairOffset: payload.crossHairOffset,
            });
            console.log('crosshairOffset', payload.crossHairOffset);
            this.emit('get:crosshairOffset', payload);
        } else if (data.length > 0) {
            this.emit('others', payload);
        }
    }

    getPosition(state = this.state) {
        return get(state, 'pos', {});
    }

    getModal(state = this.state) {
        return get(state, 'modal', {});
    }
}

export {
    MarlinLineParser,
    MarlinLineParserResultEcho,
    MarlinLineParserResultError,
    MarlinLineParserResultOk,
    MarlinLineParserResultOkTemperature,
    MarlinLineParserResultPosition,
    MarlinLineParserResultStart,
    MarlinLineParserResultTemperature,
    MarlinParserHomeState
};
export default Marlin;
