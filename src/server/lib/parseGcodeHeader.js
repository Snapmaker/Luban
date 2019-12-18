import ensureArray from 'ensure-array';
import fs from 'fs';
import { parseLine } from '../../shared/lib/gcodeParser';

const HEADTYPE_3DP = '3dp';
const HEADTYPE_LASER = 'laser';
const HEADTYPE_CNC = 'cnc';
const DEFAULT_WORK_SPEED = 1000;

const metaMap = {
    ';header_type': 'headType',
    ';file_total_lines': 'fileTotalLines',
    ';estimated_time(s)': 'estimatedTime',
    ';min_x(mm)': 'minX',
    ';max_x(mm)': 'maxX',
    ';min_y(mm)': 'minY',
    ';max_y(mm)': 'maxY',
    ';min_z(mm)': 'minZ',
    ';max_z(mm)': 'maxZ',
    ';nozzle_temperature(°C)': 'nozzleTemperature',
    ';build_plate_temperature(°C)': 'bedTemperature',
    ';work_speed(mm/minute)': 'workSpeed',
    ';jog_speed(mm/minute)': 'jogSpeed',
    ';power(%)': 'power'
};

function getHeadType(filename) {
    let headType = HEADTYPE_3DP;
    const suffix = filename.substring(filename.lastIndexOf('.') + 1, filename.length);
    switch (suffix) {
        case 'gcode':
            headType = HEADTYPE_3DP;
            break;
        case 'nc':
            headType = HEADTYPE_LASER;
            break;
        case 'cnc':
            headType = HEADTYPE_CNC;
            break;
        default:
            break;
    }
    return headType;
}

function getDistance(start, end) {
    let dx = 0;
    let dy = 0;
    let dz = 0;
    if (start.X && end.X) {
        dx = end.X - start.X;
    }
    if (start.Y && end.Y) {
        dy = end.Y - start.Y;
    }
    if (start.Z && end.Z) {
        dz = end.Z - start.Z;
    }
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}


function filter(meta) {
    for (const key of Object.keys(meta)) {
        if (meta[key] === Infinity
            || meta[key] === -Infinity
            || typeof meta[key] === 'undefined'
            || (typeof meta[key] === 'number' && Number.isNaN(meta[key]))) {
            delete meta[key];
        }
    }
}

function mergeMeta(initMeta, meta) {
    for (const key of Object.keys(metaMap)) {
        initMeta[key] || (initMeta[key] = meta[metaMap[key]]);
    }
}

const fromPairs = (pairs) => {
    let index = -1;
    const length = (!pairs) ? 0 : pairs.length;
    const result = {};

    while (++index < length) {
        const pair = pairs[index];
        result[pair[0]] = pair[1];
    }
    return result;
};

const partitionWordsByGroup = (words = []) => {
    const groups = [];

    for (let i = 0; i < words.length; ++i) {
        const word = words[i];
        const letter = word[0];

        if ((letter === 'G') || (letter === 'M')) {
            groups.push([word]);
        } else if (groups.length > 0) {
            groups[groups.length - 1].push(word);
        } else {
            groups.push([word]);
        }
    }
    return groups;
};

// const interpret = (() => {
//     let cmd = '';
//
//     return (line, callback) => {
//         const data = parseLine(line);
//         const groups = partitionWordsByGroup(ensureArray(data.words));
//
//         for (let i = 0; i < groups.length; ++i) {
//             const words = groups[i];
//             const word = words[0] || [];
//             const letter = word[0];
//             const arg = word[1];
//
//             if (letter === 'G' || letter === 'M') {
//                 cmd = letter + arg;
//                 const params = fromPairs(words.slice(1));
//                 callback(cmd, params);
//             } else {
//                 const params = fromPairs(words);
//                 callback(cmd, params);
//             }
//         }
//     };
// })();

const interpret = (() => {
    let cmd = '';

    return (line, callback) => {
        const data = parseLine(line);
        const groups = partitionWordsByGroup(ensureArray(data.words));

        for (let i = 0; i < groups.length; ++i) {
            const words = groups[i];
            const word = words[0] || [];
            const letter = word[0];
            const arg = word[1];

            if (letter === 'G' || letter === 'M') {
                cmd = letter + arg;
                const params = fromPairs(words.slice(1));
                callback(cmd, params);
            } else {
                const params = fromPairs(words);
                callback(cmd, params);
            }
        }
    };
})();

function parse(line, initMeta, meta, options, startGcodeStart) {
    interpret(line, (cmd, params) => {
        if (cmd === 'G0' || cmd === 'G1') {
            if (!options.lastParams) {
                options.lastParams = params;
                if (!params.F) {
                    params.F = DEFAULT_WORK_SPEED;
                }
            } else {
                if (!initMeta[';estimated_time(s)']) {
                    const distance = getDistance(options.lastParams, params);
                    if (!params.F) {
                        meta.estimatedTime += 60 * distance / options.lastParams.F;
                    } else {
                        meta.estimatedTime += 120 * distance / (params.F + options.lastParams.F);
                    }
                }
                options.lastParams = {
                    ...options.lastParams,
                    ...params
                };
            }
            if (!startGcodeStart && !initMeta[';min_x(mm)'] && cmd === 'G1') {
                if (params.X && params.X < meta.minX) {
                    meta.minX = params.X;
                }
                if (params.X && params.X > meta.maxX) {
                    meta.maxX = params.X;
                }
                if (params.Y && params.Y < meta.minY) {
                    meta.minY = params.Y;
                }
                if (params.Y && params.Y > meta.maxY) {
                    meta.maxY = params.Y;
                }
                if (params.Z && params.Z > meta.maxZ) {
                    meta.maxZ = params.Z;
                }
                if (params.Z && params.Z < meta.minZ) {
                    meta.minZ = params.Z;
                }
            }
            if (!startGcodeStart && !initMeta[';min_z(mm)'] && (cmd === 'G1' || cmd === 'G0')) {
                if (params.Z && params.Z > meta.maxZ) {
                    meta.maxZ = params.Z;
                }
                if (params.Z && params.Z < meta.minZ) {
                    meta.minZ = params.Z;
                }
            }
            if (!startGcodeStart && cmd === 'G0' && params.F) {
                if (!initMeta[';jog_speed(mm/minute)']) {
                    options.jogSpeedSum += params.F;
                    options.jogSpeedCount++;
                }
            }
            if (!startGcodeStart && cmd === 'G1' && params.F) {
                if (!initMeta[';work_speed(mm/minute)']) {
                    options.workSpeedSum += params.F;
                    options.workSpeedCount++;
                }
            }
            return;
        }
        if (meta.headType === HEADTYPE_3DP) {
            if (cmd === 'M109') {
                if (!initMeta[';nozzle_temperature(°C)']) {
                    if (!meta.nozzleTemperature) {
                        meta.nozzleTemperature = params.S;
                    }
                    return;
                }
            }
            if (cmd === 'M190') {
                if (!initMeta[';build_plate_temperature(°C)']) {
                    if (!meta.bedTemperature) {
                        meta.bedTemperature = params.S;
                    }
                }
            }
        } else if (meta.headType === HEADTYPE_LASER || meta.headType === HEADTYPE_CNC) {
            if (cmd === 'M3') {
                if (!initMeta[';power(%)']) {
                    if (!meta.power && params.P) {
                        meta.power = params.P;
                    }
                }
            }
        }
    });
}

function parseGcodeHeader(filename) {
    const initMeta = {
        ';header_type': null,
        ';file_total_lines': null,
        ';estimated_time(s)': null,
        ';min_x(mm)': null,
        ';max_x(mm)': null,
        ';min_y(mm)': null,
        ';max_y(mm)': null,
        ';min_z(mm)': null,
        ';max_z(mm)': null,
        ';nozzle_temperature(°C)': null,
        ';build_plate_temperature(°C)': null,
        ';work_speed(mm/minute)': null,
        ';jog_speed(mm/minute)': null,
        ';power(%)': null
    };


    const meta = {
        headType: '',
        fileTotalLines: 0,
        jogSpeed: 0,
        workSpeed: 0,
        estimatedTime: 0,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
        maxZ: Number.NEGATIVE_INFINITY,
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        minZ: Number.POSITIVE_INFINITY
    };
    const options = {
        jogSpeedSum: 0,
        workSpeedSum: 0,
        jogSpeedCount: 0,
        workSpeedCount: 0,
        lastParams: null
    };
    const header = [];
    let headerStart = false;
    let headerEnd = false;
    let startGcodeStart = false;

    meta.headType = getHeadType(filename);

    const gcodeLines = fs.readFileSync(filename, 'utf8').split('\n');

    meta.fileTotalLines = gcodeLines.length;
    let headerLength = 0;

    for (const line of gcodeLines) {
        if (line.indexOf(';Header Start') !== -1) {
            headerStart = true;
            headerLength = 2;
            continue;
        }
        if (line.indexOf(';Header End') !== -1) {
            headerEnd = true;
            continue;
        }
        if (headerStart && !headerEnd) {
            headerLength++;
        }
        if (line.indexOf(';Start GCode begin') !== -1) {
            startGcodeStart = true;
        }
        if (line.indexOf(';Start GCode end') !== -1) {
            startGcodeStart = false;
        }
        if (headerStart && !headerEnd) {
            header.push(line);
            continue;
        }
        if (headerStart && headerEnd && header.length > 0) {
            const headers = header.splice(0);
            for (const h of headers) {
                if (h.trim() === '') {
                    continue;
                }
                const key = h.split(':')[0].trim();
                const value = h.split(':')[1].trim();
                if (value.match(/^(-?\d+)(\.\d+)?$/)) {
                    initMeta[key] = parseFloat(value);
                } else {
                    initMeta[key] = value;
                }
            }
        }
        if (line.indexOf(';End GCode begin') !== -1) {
            break;
        }
        if (line.indexOf(';End GCode') !== -1) {
            break;
        }
        parse(line, initMeta, meta, options, startGcodeStart);
    }
    const { jogSpeedSum, workSpeedSum, jogSpeedCount, workSpeedCount } = options;
    meta.jogSpeed = Math.round(jogSpeedSum / jogSpeedCount / 100) * 100;
    meta.workSpeed = Math.round(workSpeedSum / workSpeedCount / 100) * 100;
    meta.estimatedTime = Math.round(meta.estimatedTime);

    mergeMeta(initMeta, meta);
    filter(initMeta);
    initMeta[';file_total_lines'] = meta.fileTotalLines - headerLength + Object.keys(initMeta).length + 2;

    return initMeta;
}


export default parseGcodeHeader;
