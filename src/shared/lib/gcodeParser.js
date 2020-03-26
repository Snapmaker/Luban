/* eslint no-bitwise: 0 */
/* eslint no-continue: 0 */
import events from 'events';
import fs from 'fs';
import timers from 'timers';
import stream, { Transform } from 'stream';

const noop = () => {};

const streamify = (text) => {
    const s = new stream.Readable();
    s.push(text);
    s.push(null);
    return s;
};

const containsLineEnd = (() => {
    const re = new RegExp(/.*(?:\r\n|\r|\n)/g);

    return (s => !!s.match(re));
})();

// @param {array} arr The array to iterate over.
// @param {object} opts The options object.
// @param {function} iteratee The iteratee invoked per element.
// @param {function} done The done invoked after the loop has finished.
const iterateArray = (arr = [], opts = {}, iteratee = noop, done = noop) => {
    if (typeof opts === 'function') {
        done = iteratee;
        iteratee = opts;
        opts = {};
    }

    opts.batchSize = opts.batchSize || 1;

    const loop = (i = 0) => {
        for (let count = 0; i < arr.length && count < opts.batchSize; ++i, ++count) {
            iteratee(arr[i], i, arr);
        }
        if (i < arr.length) {
            timers.setImmediate(() => loop(i));
            return;
        }
        done();
    };
    loop();
};

// @param {string} line The G-code line
const parseLine = (() => {
    // http://reprap.org/wiki/G-code#Special_fields
    // The checksum "cs" for a GCode string "cmd" (including its line number) is computed
    // by exor-ing the bytes in the string up to and not including the * character.
    const computeChecksum = (s) => {
        s = s || '';
        if (s.lastIndexOf('*') >= 0) {
            s = s.substr(0, s.lastIndexOf('*'));
        }

        let cs = 0;
        for (let i = 0; i < s.length; ++i) {
            const c = s[i].charCodeAt(0);
            cs ^= c;
        }
        return cs;
    };
    // http://linuxcnc.org/docs/html/gcode/overview.html#gcode:comments
    // Comments can be embedded in a line using parentheses () or for the remainder of a lineusing a semi-colon.
    // The semi-colon is not treated as the start of a comment when enclosed in parentheses.
    const stripComments = (() => {
        // eslint-disable-next-line no-useless-escape
        const re1 = new RegExp(/\s*\([^\)]*\)/g); // Remove anything inside the parentheses
        const re2 = new RegExp(/\s+;.*/g); // Remove anything after a semi-colon to the end of the line, including preceding spaces
        const re3 = new RegExp(/\s+/g);
        return (line => line.replace(re1, '').replace(re2, '').replace(re3, ''));
    })();
    // eslint-disable-next-line no-useless-escape
    const re = /(;.*)|(%.*)|({.*)|((?:\$\$)|(?:\$[a-zA-Z0-9#]*))|([a-zA-Z][0-9\+\-\.]+)|(\*[0-9]+)/igm;

    return (line, options) => {
        options = options || {};
        options.flatten = !!options.flatten;
        options.noParseLine = !!options.noParseLine;

        const result = {
            line: line
        };

        if (options.noParseLine) {
            return result;
        }

        result.words = [];

        let ln; // Line number
        let cs; // Checksum
        const words = stripComments(line).match(re) || [];

        for (let i = 0; i < words.length; ++i) {
            const word = words[i];
            const letter = word[0].toUpperCase();
            const argument = word.slice(1);

            // Parse % commands for bCNC and CNCjs
            // - %wait Wait until the planner queue is empty
            if (letter === '%') {
                result.cmds = (result.cmds || []).concat(line.trim());
                continue;
            }

            // Parse JSON commands for TinyG and g2core
            if (letter === '{') {
                result.cmds = (result.cmds || []).concat(line.trim());
                continue;
            }

            // Parse $ commands for Grbl
            // - $C Check gcode mode
            // - $H Run homing cycle
            if (letter === '$') {
                result.cmds = (result.cmds || []).concat(`${letter}${argument}`);
                continue;
            }

            // N: Line number
            if (letter === 'N' && typeof ln === 'undefined') {
                // Line (block) number in program
                ln = Number(argument);
                continue;
            }

            // *: Checksum
            if (letter === '*' && typeof cs === 'undefined') {
                cs = Number(argument);
                continue;
            }

            // ;: comments
            if (letter === ';') {
                result.cmds = (result.cmds || []).concat(line.trim());
                const split = line.split(':');
                if (options.flatten) {
                    result.words.push(split[0] + split[1]);
                } else {
                    result.words.push([split[0], split[1]]);
                }
                break;
            }

            let value = Number(argument);
            if (Number.isNaN(value)) {
                value = argument;
            }

            if (options.flatten) {
                result.words.push(letter + value);
            } else {
                result.words.push([letter, value]);
            }
        }

        // Line number
        (typeof (ln) !== 'undefined') && (result.ln = ln);

        // Checksum
        (typeof (cs) !== 'undefined') && (result.cs = cs);
        if (result.cs && (computeChecksum(line) !== result.cs)) {
            result.err = true; // checksum failed
        }

        return result;
    };
})();


const parseArraySync = (array, options) => {
    const { flatten = false, noParseLine = false } = { ...options };
    const results = [];
    const lines = array;

    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i].trim();
        if (line.length === 0) {
            continue;
        }
        const result = parseLine(line, {
            flatten,
            noParseLine
        });
        results.push(result);
    }

    return results;
};

const parseStringSync = (str, options) => {
    const { flatten = false, noParseLine = false } = { ...options };
    const results = [];
    const lines = str.split('\n');

    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i].trim();
        if (line.length === 0) {
            continue;
        }
        const result = parseLine(line, {
            flatten,
            noParseLine
        });
        results.push(result);
    }

    return results;
};


const parseFileSync = (file, options) => {
    return parseStringSync(fs.readFileSync(file, 'utf8'), options);
};


// @param {string} str The G-code text string
// @param {options} options The options object


class GCodeLineStream extends Transform {
    state = {
        lineCount: 0,
        lastChunkEndedWithCR: false
    };

    options = {
        batchSize: 1000,
        noParseLine: false
    };

    lineBuffer = '';

    re = new RegExp(/.*(?:\r\n|\r|\n)|.+$/g);

    // @param {object} [options] The options object
    // @param {number} [options.batchSize] The batch size.
    // @param {boolean} [options.flatten] True to flatten the array, false otherwise.
    // @param {boolean} [options.noParseLine] True to not parse line, false otherwise.
    constructor(options = {}) {
        super({ objectMode: true });

        this.options = {
            ...this.options,
            ...options
        };
    }

    _transform(chunk, encoding, next) {
        // decode binary chunks as UTF-8
        encoding = encoding || 'utf8';

        if (Buffer.isBuffer(chunk)) {
            if (encoding === 'buffer') {
                encoding = 'utf8';
            }
            chunk = chunk.toString(encoding);
        }

        this.lineBuffer += chunk;

        if (!containsLineEnd(chunk)) {
            next();
            return;
        }

        const lines = this.lineBuffer.match(this.re);
        if (!lines || lines.length === 0) {
            next();
            return;
        }

        // Do not split CRLF which spans chunks
        if (this.state.lastChunkEndedWithCR && lines[0] === '\n') {
            lines.shift();
        }

        this.state.lastChunkEndedWithCR = (this.lineBuffer[this.lineBuffer.length - 1] === '\r');

        if ((this.lineBuffer[this.lineBuffer.length - 1] === '\r')
            || (this.lineBuffer[this.lineBuffer.length - 1] === '\n')) {
            this.lineBuffer = '';
        } else {
            const line = lines.pop() || '';
            this.lineBuffer = line;
        }

        iterateArray(lines, { batchSize: this.options.batchSize }, (line) => {
            line = line.trim();
            if (line.length > 0) {
                const result = parseLine(line, {
                    flatten: this.options.flatten,
                    noParseLine: this.options.noParseLine
                });
                this.push(result);
            }
        }, next);
    }

    _flush(done) {
        if (this.lineBuffer) {
            const line = this.lineBuffer.trim();
            if (line.length > 0) {
                const result = parseLine(line, {
                    flatten: this.options.flatten,
                    noParseLine: this.options.noParseLine
                });
                this.push(result);
            }

            this.lineBuffer = '';
            this.state.lastChunkEndedWithCR = false;
        }

        done();
    }
}

// @param {object} streFam The G-code line stream
// @param {options} options The options object
// @param {function} callback The callback function
// eslint-disable-next-line no-shadow
const parseStream = (stream, options, callback = noop) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    const emitter = new events.EventEmitter();

    try {
        const results = [];
        stream
            .pipe(new GCodeLineStream(options))
            .on('data', (data) => {
                emitter.emit('data', data);
                results.push(data);
            })
            .on('end', () => {
                emitter.emit('end', results);
                callback && callback(null, results);
            })
            .on('error', callback);
    } catch (err) {
        callback(err);
    }

    return emitter;
};

// @param {string} file The G-code path name
// @param {options} options The options object
// @param {function} callback The callback function
const parseFile = (file, options, callback = noop) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    file = file || '';
    const s = fs.createReadStream(file, { encoding: 'utf8' });
    s.on('error', callback);
    return parseStream(s, options, callback);
};

// @param {string} str The G-code text string
// @param {options} options The options object
// @param {function} callback The callback function
const parseString = (str, options, callback = noop) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    return parseStream(streamify(str), options, callback);
};


export {
    GCodeLineStream,
    parseLine,
    parseStream,
    parseFile,
    parseFileSync,
    parseString,
    parseStringSync,
    parseArraySync
};
