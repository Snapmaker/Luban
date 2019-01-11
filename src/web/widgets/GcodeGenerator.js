class GcodeGenerator {
    parseToolPathObjToGcode(toolPathObj, gcodeConfig) {
        if (!toolPathObj || !gcodeConfig) {
            return null;
        }
        const { type } = toolPathObj;
        if (!['cnc', 'laser', '3dp'].includes(type)) {
            return null;
        }

        let gcodeStr = '';
        if (type === 'cnc') {
            gcodeStr = this.parseAsCNC(toolPathObj, gcodeConfig);
        } else if (type === 'laser') {
            gcodeStr = this.parseAsLaser(toolPathObj, gcodeConfig);
        }
        return gcodeStr;
    }

    parseAsCNC(toolPathObj, gcodeConfig) {
        // todo: add 'translateX, translateY'
        const { data } = toolPathObj;
        const gcodeConfigKeys = Object.keys(gcodeConfig);
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
                } else if (gcodeConfigKeys.includes(item[key])) {
                    const paramValue = gcodeConfig[item[key]];
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

    parseAsLaser(toolPathObj, gcodeConfig) {
        const { data, translateX, translateY } = toolPathObj;
        // process "jogSpeed, workSpeed..."
        const gcodeConfigKeys = Object.keys(gcodeConfig);
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
                } else if (gcodeConfigKeys.includes(item[key])) {
                    const paramValue = gcodeConfig[item[key]];
                    cmds.push(key + paramValue);
                } else {
                    let value = item[key];
                    if (key === 'X' && !!translateX) {
                        value += translateX;
                    } else if (key === 'Y' && !!translateY) {
                        value += translateY;
                    }
                    cmds.push(key + value);
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

        // process "multi-pass, fix-power"
        gcodeStr = this.processGcodeMultiPass(gcodeStr, gcodeConfig);
        gcodeStr = this.processGcodeForFixedPower(gcodeStr, gcodeConfig);

        return gcodeStr;
    }

    processGcodeMultiPass(gcodeStr, gcodeConfig) {
        const { multiPassEnabled, multiPasses, multiPassDepth } = gcodeConfig;
        if (multiPassEnabled) {
            let result = '';
            for (let i = 0; i < multiPasses; i++) {
                result += `; Laser multi-pass, pass ${i + 1} with Z = ${-i * multiPassDepth}\n`;
                // dropping z
                if (i !== 0) {
                    result += '; Laser multi-pass: dropping z\n';
                    result += 'G91\n'; // relative positioning
                    result += `G0 Z-${multiPassDepth} F150\n`;
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

    processGcodeForFixedPower(gcodeStr, gcodeConfig) {
        const { fixedPowerEnabled, fixedPower } = gcodeConfig;
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
