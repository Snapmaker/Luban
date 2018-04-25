import isEqual from 'lodash/isEqual';
import get from 'lodash/get';
import set from 'lodash/set';
import events from 'events';
import semver from 'semver';
import { HEAD_TYPE_3DP, HEAD_TYPE_LASER, HEAD_TYPE_CNC } from './constants';

// http://stackoverflow.com/questions/10454518/javascript-how-to-retrieve-the-number-of-decimals-of-a-string-number
function decimalPlaces(num) {
    const match = ('' + num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
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
        const r = line.match(/^Firmware Version: (.*)-([0-9\.]+(-(alpha|beta)[1-9]?)?)$/);
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

class MarlinLineParser {
    parse(line) {
        const parsers = [
            // New Parsers (follow pattern `MarlinReplyParserXXX`)
            // M1005
            MarlinReplyParserFirmwareVersion,
            MarlinReplyParserReleaseDate,
            // M1006
            MarlinReplyParserToolHead,

            // start
            MarlinLineParserResultStart,

            // X:0.00 Y:0.00 Z:0.00 E:0.00 Count X:0 Y:0 Z:0
            MarlinLineParserResultPosition,

            // ok
            MarlinLineParserResultOk,

            // echo:
            MarlinLineParserResultEcho,

            // Error:Printer halted. kill() called!
            MarlinLineParserResultError,

            MarlinLineParserResultOkTemperature,
            // ok T:293.0 /0.0 B:25.9 /0.0 B@:0 @:0
            MarlinLineParserResultTemperature
        ];

        for (let parser of parsers) {
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
    // X:0.00 Y:0.00 Z:0.00 E:0.00 Count X:0 Y:0 Z:0
    static parse(line) {
        const r = line.match(/^(?:(?:X|Y|Z|E):[0-9\.\-]+\s+)+/i);
        if (!r) {
            return null;
        }

        const payload = {
            pos: {}
        };
        const pattern = /((X|Y|Z|E):[0-9\.\-]+)+/gi;
        const params = r[0].match(pattern);

        for (let param of params) {
            const nv = param.match(/^(.+):(.+)/);
            if (nv) {
                const axis = nv[1].toLowerCase();
                const pos = nv[2];
                const digits = decimalPlaces(pos);
                payload.pos[axis] = Number(pos).toFixed(digits);
            }
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
        const r = line.match(/^ok$/);
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
        const re = /ok (T:[0-9\.\-]+).*(B:[0-9\.\-]+)/g;
        const r = re.exec(line);
        if (!r) {
            return null;
        }
        const payload = {
            temperature: {}
        };

        const params = [r[1], r[2]];
        for (let param of params) {
            const nv = param.match(/^(.+):(.+)/);
            if (nv) {
                const axis = nv[1].toLowerCase();
                const pos = nv[2];
                const digits = decimalPlaces(pos);
                payload.temperature[axis] = Number(pos).toFixed(digits);
            }
        }
        return {
            type: MarlinLineParserResultOkTemperature,
            payload: payload
        };
    }
}

class MarlinLineParserResultTemperature {
    static parse(line) {
        const re = /(T:[0-9\.\-]+).*(B:[0-9\.\-]+)/g;
        const r = re.exec(line);
        if (!r) {
            return null;
        }
        const payload = {
            temperature: {}
        };

        const params = [r[1], r[2]];
        for (let param of params) {
            const nv = param.match(/^(.+):(.+)/);
            if (nv) {
                const axis = nv[1].toLowerCase();
                const pos = nv[2];
                const digits = decimalPlaces(pos);
                payload.temperature[axis] = Number(pos).toFixed(digits);
            }
        }
        return {
            type: MarlinLineParserResultTemperature,
            payload: payload
        };
    }
}


class Marlin extends events.EventEmitter {
    state = {
        // firmware version
        version: '1.0.0',
        // tool head type
        headType: '',
        pos: {
            x: '0.000',
            y: '0.000',
            z: '0.000',
            e: '0.000'
        },
        ovF: 100,
        ovS: 100,
        temperature: {
            b: '0.0',
            t: '0.0'
        },
        jogSpeed: 0,
        workSpeed: 0,
        headStatus: 'off',
        // Head Power (in percentage, an integer between 0~100)
        headPower: 0
    };
    settings = {
    };

    parser = new MarlinLineParser();

    setState(state) {
        const nextState = { ...this.state, ...state };

        if (!isEqual(this.state, nextState)) {
            this.state = nextState;
        }
    }

    parse(data) {
        data = ('' + data).replace(/\s+$/, '');
        if (!data) {
            return;
        }

        this.emit('raw', { raw: data });

        const result = this.parser.parse(data) || {};
        const { type, payload } = result;

        if (type === MarlinReplyParserFirmwareVersion) {
            this.setState({ version: payload.version });
            this.emit('firmware', payload);
        } else if (type === MarlinReplyParserReleaseDate) {
            this.emit('firmware', payload);
        } else if (type === MarlinReplyParserToolHead) {
            if (this.state.headType !== payload.headType) {
                this.setState({ headType: payload.headType });
            }
            this.emit('headType', payload);
        } else if (type === MarlinLineParserResultStart) {
            this.emit('start', payload);
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
        } else if (type === MarlinLineParserResultTemperature ||
             type === MarlinLineParserResultOkTemperature) {
            // For firmware version < 2.4, we use temperature to determine head type
            if (semver.lt(this.state.version, '2.4.0') && !this.state.headType) {
                if (payload.temperature.t <= 275) {
                    this.state.headType = HEAD_TYPE_3DP;
                } else if (payload.temperature.t <= 400) {
                    this.state.headType = HEAD_TYPE_LASER;
                } else {
                    this.state.headType = HEAD_TYPE_CNC;
                }
                // just regard this M105 command as a M1005 request
                this.emit('firmware', { version: this.state.version, ...payload });
            } else {
                this.setState({ temperature: payload.temperature });
                this.emit('temperature', payload);
                if (type === MarlinLineParserResultOkTemperature) {
                    this.emit('ok', payload);
                }
            }
        } else if (data.length > 0) {
            this.emit('others', payload);
        }
    }

    getPosition(state = this.state) {
        return get(state, 'pos', {});
    }
}

export {
    MarlinLineParser,
    MarlinLineParserResultStart,
    MarlinLineParserResultPosition,
    MarlinLineParserResultOk,
    MarlinLineParserResultEcho,
    MarlinLineParserResultError,
    MarlinLineParserResultTemperature,
    MarlinLineParserResultOkTemperature
};
export default Marlin;
