class GcodeGenerator {
    constructor() {
        this.gcodeLines = [];
        // from toolPathObj
        this.metadata = {};
        this.params = {};
    }

    parseToolPathObjToGcode(toolPathObj) {
        if (!toolPathObj) {
            return null;
        }
        const { type } = toolPathObj.metadata;
        if (!['cnc', 'laser', '3dp'].includes(type)) {
            return null;
        }

        let gcodeStr = '';
        if (type === 'cnc') {
            gcodeStr = this.parseAsCNC(toolPathObj);
        } else if (type === 'laser') {
            gcodeStr = this.parseAsLaser(toolPathObj);
        }
        return gcodeStr;
    }

    parseAsCNC(toolPathObj) {
        const { data, params } = toolPathObj;
        const paramsKeys = Object.keys(params);
        const gcodeLines = [];
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            let line = '';
            let cmds = [];
            let comment = null;
            Object.keys(item).forEach((key) => {
                // C: comment  N: empty line
                if (['C', 'N'].includes(key)) {
                    comment = item[key];
                } else if (paramsKeys.includes(item[key])) {
                    const paramValue = params[item[key]];
                    cmds.push(key + paramValue);
                } else {
                    cmds.push(key + item[key]);
                }
            });
            if (cmds.length > 0) {
                line = cmds.join(' ');
            }
            if (comment) {
                line += comment;
            }
            gcodeLines.push(line);
        }
        return gcodeLines.join('\n') + '\n';
    }

    parseAsLaser(toolPathObj) {
        const { data, params, translation } = toolPathObj;
        const { x, y, z } = translation;
        // process "jogSpeed, workSpeed..."
        const paramsKeys = Object.keys(params);
        const gcodeLines = [];
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            let line = '';
            let cmds = [];
            let comment = null;
            Object.keys(item).forEach((key) => {
                // C: comment  N: empty line
                if (['C', 'N'].includes(key)) {
                    comment = item[key];
                } else if (paramsKeys.includes(item[key])) {
                    const paramValue = params[item[key]];
                    cmds.push(key + paramValue);
                } else {
                    let value = item[key];
                    if (key === 'X' && !!x) {
                        value += x;
                    } else if (key === 'Y' && !!y) {
                        value += y;
                    } else if (key === 'Z' && !!z) {
                        value += z;
                    }
                    if (key === 'X' || key === 'Y' || key === 'Z') {
                        cmds.push(key + value.toFixed(2)); // restrict precision
                    } else {
                        cmds.push(key + value); // restrict precision
                    }
                }
            });
            if (cmds.length > 0) {
                line = cmds.join(' ');
            }
            if (comment) {
                line += comment;
            }
            gcodeLines.push(line);
        }

        let gcodeStr = gcodeLines.join('\n') + '\n';

        const {
            fixedPowerEnabled = false,
            fixedPower = 100,
            multiPass = {
                enabled: false,
                passes: 2,
                depth: 1
            }
        } = params;

        gcodeStr = this.processGcodeMultiPass(gcodeStr, multiPass);
        gcodeStr = this.processGcodeForFixedPower(gcodeStr, fixedPowerEnabled, fixedPower);
        return gcodeStr;
    }

    processGcodeMultiPass(gcodeStr, multiPass) {
        const { enabled, passes, depth } = multiPass;
        if (enabled) {
            let result = '';
            for (let i = 0; i < passes; i++) {
                result += `; Laser multi-pass, pass ${i + 1} with Z = ${-i * depth}\n`;
                // dropping z
                if (i !== 0) {
                    result += '; Laser multi-pass: dropping z\n';
                    result += 'G91\n'; // relative positioning
                    result += `G0 Z-${depth} F150\n`;
                    result += 'G90\n'; // absolute positioning
                }
                result += gcodeStr + '\n';
            }

            // move back to work origin
            result += 'G0 Z0\n';
            gcodeStr = result;
        }
        return gcodeStr;
    }

    processGcodeForFixedPower(gcodeStr, fixedPowerEnabled, fixedPower) {
        if (fixedPowerEnabled) {
            const powerStrength = Math.floor(fixedPower * 255 / 100);
            const fixedPowerGcode = [
                '; Laser: setting power',
                `M3 P${fixedPower} S${powerStrength}`,
                'G4 P1',
                'M5'
            ].join('\n') + '\n\n';
            gcodeStr = fixedPowerGcode + gcodeStr;
        }
        return gcodeStr;
    }
}

export default GcodeGenerator;
