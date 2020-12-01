class GcodeGenerator {
    parseToolPathObjToGcode(toolPathObj, gcodeConfig) {
        if (!toolPathObj || !gcodeConfig) {
            return null;
        }
        const { headType } = toolPathObj;
        if (!['cnc', 'laser', '3dp'].includes(headType)) {
            return null;
        }

        let gcodeStr = '';
        if (headType === 'cnc') {
            gcodeStr = this.parseAsCNC(toolPathObj, gcodeConfig);
        } else if (headType === 'laser') {
            gcodeStr = this.parseAsLaser(toolPathObj, gcodeConfig);
        }
        return gcodeStr;
    }

    parseAsCNC(toolPathObj, gcodeConfig) {
        const { data, positionX, positionY, rotationB } = toolPathObj;
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
                    } else if (key === 'B') {
                        if (rotationB) {
                            value += rotationB;
                        }
                    }
                    if (key === 'X' || key === 'Y' || key === 'Z' || key === 'B') {
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
        return gcodeLines;
    }

    parseAsLaser(toolPathObj, gcodeConfig) {
        const { data, positionX, positionY, rotationB } = toolPathObj;
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
                    } else if (key === 'B' && !!rotationB) {
                        value += rotationB;
                    }
                    if (key === 'X' || key === 'Y' || key === 'Z' || key === 'B') {
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

        return this.processGcodeMultiPass(gcodeLines, gcodeConfig);
    }

    processGcodeMultiPass(gcodeLines, gcodeConfig) {
        const { multiPassEnabled, multiPasses, multiPassDepth } = gcodeConfig;
        if (multiPassEnabled) {
            let result = [];
            for (let i = 0; i < multiPasses; i++) {
                result.push(`; Laser multi-pass, pass ${i + 1} with Z = ${-i * multiPassDepth}`);
                // dropping z
                if (i !== 0) {
                    result.push('; Laser multi-pass: dropping z');
                    result.push('G91'); // relative positioning
                    result.push(`G0 Z-${multiPassDepth} F150`);
                    result.push('G90'); // absolute positioning
                }
                result = result.concat(gcodeLines);
            }

            // move back to work origin
            result.push('G91'); // relative
            result.push(`G0 Z${multiPassDepth * (multiPasses - 1)} F150`);
            result.push('G90'); // absolute
            gcodeLines = result;
        }
        return gcodeLines;
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
