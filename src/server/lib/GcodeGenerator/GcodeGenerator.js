import { HEAD_CNC, HEAD_LASER, HEAD_PRINTING } from '../../constants';

class GcodeGenerator {
    parseToolPathObjToGcode(toolPathObj, gcodeConfig) {
        if (!toolPathObj || !gcodeConfig) {
            return null;
        }
        const { headType } = toolPathObj;
        if (![HEAD_PRINTING, HEAD_LASER, HEAD_CNC].includes(headType)) {
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

    parseAsGrblLaser(toolPathObj, gcodeConfig) {
        const { data, positionX = 0, positionY = 0, rotationB = 0 } = toolPathObj;
        const gcodeLines = [];
        const floatFixed3 = (n) => {
            return parseFloat(n.toFixed(3));
        };
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            let cmd = '';
            let line = '';

            if (item.G !== undefined) {
                cmd = `G${item.G}`;
                line = `${cmd} `;
                if ([0, 1, 2, 3, 92].includes(item.G)) {
                    item.X !== undefined && (line += `X${floatFixed3(item.X + positionX)}`);
                    item.Y !== undefined && (line += `Y${floatFixed3(item.Y + positionY)}`);
                    // item.Z !== undefined && (line += `Z${item.Z}`);
                    item.B !== undefined && (line += `B${floatFixed3(item.B + rotationB)}`);
                    item.F !== undefined && (line += `F${floatFixed3(item.F)}`);
                    item.S !== undefined && (line += `S${floatFixed3(item.S * 1000 / 255)}`);
                } else if ([4].includes(item.G)) {
                    // Marlin G4 P:milliseconds S:seconds
                    // Grbl G4 S:milliseconds P:seconds
                    item.P !== undefined && (line += `P${floatFixed3(item.P) / 1000}`);
                    item.S !== undefined && (line += `P${floatFixed3(item.S)}`);
                }
            } else if (item.M !== undefined) {
                cmd = `M${item.M}`;
                line += `${cmd} `;

                if ([3, 4, 5].includes(item.M)) {
                    if (item.S !== undefined) {
                        line += `S${floatFixed3(item.S * 1000 / 255)}`;
                    } else if (item.P !== undefined) {
                        line += `S${floatFixed3(item.P * 10)}`;
                    }
                } else if ([2000].includes(item.M)) {
                    item.W !== undefined && (line += `W${item.W}`);
                    item.L !== undefined && (line += `L${item.L}`);
                    item.P !== undefined && (line += `P${item.P}`);
                }
            }

            if (item.C !== undefined) {
                line += item.C;
            }
            gcodeLines.push(line);
        }

        return this.processGcodeGrblMultiPass(gcodeLines, gcodeConfig);
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
        const { pathType, initialHeightOffset = 0, multiPassEnabled, multiPasses, multiPassDepth } = gcodeConfig;
        if (multiPassEnabled && multiPasses > 0) {
            let result = [];
            if (pathType === 'path' && initialHeightOffset) {
                result.push('G91'); // relative positioning
                result.push(`G0 Z${initialHeightOffset} F150`);
                result.push('G90'); // absolute positioning
            }
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
            result.push(`G0 Z${multiPassDepth * (multiPasses - 1) - initialHeightOffset} F150`);
            result.push('G90'); // absolute
            gcodeLines = result;
        } else {
            let result = [];
            if (pathType === 'path' && initialHeightOffset) {
                result.push('G91'); // relative positioning
                result.push(`G0 Z${initialHeightOffset} F150`);
                result.push('G90'); // absolute positioning
            }
            result = result.concat(gcodeLines);
            gcodeLines = result;
        }
        return gcodeLines;
    }

    processGcodeGrblMultiPass(gcodeLines, gcodeConfig) {
        const { multiPassEnabled, multiPasses, multiPassDepth } = gcodeConfig;
        if (multiPassEnabled && multiPasses > 0) {
            let result = [];
            for (let i = 0; i < multiPasses; i++) {
                result.push(`; Laser multi-pass, pass ${i + 1} with Z = ${-i * multiPassDepth}`);
                // dropping z
                if (i !== 0) {
                    result.push('; Laser multi-pass: dropping z');
                    result.push('G91'); // relative positioning
                    result.push('G90'); // absolute positioning
                }
                result = result.concat(gcodeLines);
            }

            // move back to work origin
            result.push('G91'); // relative
            result.push('G90'); // absolute
            gcodeLines = result;
        } else {
            let result = [];
            result = result.concat(gcodeLines);
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
