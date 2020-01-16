class GcodeGenerator {
    parseToolPathObjToGcode(toolPathObj, gcodeConfig) {
        if (!toolPathObj || !gcodeConfig) {
            return null;
        }
        const { headerType } = toolPathObj;
        if (!['cnc', 'laser', '3dp'].includes(headerType)) {
            return null;
        }

        let gcodeStr = '';
        if (headerType === 'cnc') {
            gcodeStr = this.parseAsCNC(toolPathObj, gcodeConfig);
        } else if (headerType === 'laser') {
            gcodeStr = this.parseAsLaser(toolPathObj, gcodeConfig);
        }
        return gcodeStr;
    }

    parseAsCNC(toolPathObj, gcodeConfig) {
        const { data, positionX, positionY } = toolPathObj;
        const gcodeConfigKeys = Object.keys(gcodeConfig);
        const gcodeLines = [];
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            let line = '';
            const cmds = [];
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
                    if (key === 'X' && !!positionX) {
                        value += positionX;
                    } else if (key === 'Y' && !!positionY) {
                        value += positionY;
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
        return `${gcodeLines.join('\n')}\n`;
    }

    parseAsLaser(toolPathObj, gcodeConfig) {
        const { data, positionX, positionY } = toolPathObj;
        // process "jogSpeed, workSpeed..."
        const gcodeConfigKeys = Object.keys(gcodeConfig);
        const gcodeLines = [];
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            let line = '';
            const cmds = [];
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
                    if (key === 'X' && !!positionX) {
                        value += positionX;
                    } else if (key === 'Y' && !!positionY) {
                        value += positionY;
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

        let gcodeStr = `${gcodeLines.join('\n')}\n`;

        // process "multi-pass, fix-power"
        gcodeStr = this.processGcodeMultiPass(gcodeStr, gcodeConfig);
        // gcodeStr = this.processGcodeForFixedPower(gcodeStr, gcodeConfig);

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
                result += `${gcodeStr}\n`;
            }

            // move back to work origin
            result += 'G91\n'; // relative
            result += `G0 Z${multiPassDepth * (multiPasses - 1)} F150\n`;
            result += 'G90\n'; // absolute
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
            ].join('\n');
            gcodeStr = `${fixedPowerGcode}\n\n${gcodeStr}`;
        }
        return gcodeStr;
    }
}

export default GcodeGenerator;
