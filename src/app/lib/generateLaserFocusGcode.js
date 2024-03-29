
function generateSqaure(point, length) {
    const res = [];
    res.push(point);
    res.push({ x: point.x, y: point.y + length });
    res.push({ x: point.x + length, y: point.y + length });
    res.push({ x: point.x + length, y: point.y });
    return res;
}
/**
 *  generate gcode line following
 *  0  -0.5  -1.0  -1.5  -2.0  -2.5
 * 「」 「」   「」  「」  「」   「」
 *     「」   「」  「」  「」   「」
 *     +0.5  +1.0  +1.5  +2.0  +2.5
 */
function generateLaserFocusGcode(power, workSpeed, jogSpeed) {
    const squareLength = 4;
    const squareSpace = 2;
    const gcodeArray = [];

    // power in percentage
    // priority: P > S, for compatibility, use both P and S args.
    const powerStrength = Math.floor(power * 255 / 100);

    gcodeArray.push(';Laser Focus Test G-code');
    gcodeArray.push(`;powerPercent: ${power}`);
    gcodeArray.push(`;workSpeed: ${workSpeed}`);
    gcodeArray.push(`;jogSpeed: ${jogSpeed}`);

    gcodeArray.push('G90'); // absolute position
    gcodeArray.push('G21'); // set units to mm

    gcodeArray.push(`G0 F${jogSpeed}`);
    gcodeArray.push(`G1 F${workSpeed}`);
    gcodeArray.push('G0 X0 Y0');
    // set M3 power
    gcodeArray.push(`M3 P${power} S${powerStrength}`);
    gcodeArray.push('M5');

    for (let i = 0; i < 6; i++) {
        const z = -i * 0.5;
        const p0 = {
            x: i * (squareLength + squareSpace),
            y: 0
        };
        const square = generateSqaure(p0, squareLength);

        gcodeArray.push(`G0 X${p0.x} Y${p0.y} Z${z}`);
        gcodeArray.push('M3');
        for (let j = 0; j < 4; j++) {
            const p = square[(j + 1) % 4];
            gcodeArray.push(`G1 X${p.x} Y${p.y}`);
        }
        gcodeArray.push('M5');
    }

    for (let i = 1; i < 6; i++) {
        const z = i * 0.5;
        const p0 = {
            x: i * (squareLength + squareSpace),
            y: -(squareSpace + squareLength)
        };
        const square = generateSqaure(p0, squareLength);

        gcodeArray.push(`G0 X${p0.x} Y${p0.y} Z${z}`);
        gcodeArray.push('M3');
        for (let j = 0; j < 4; j++) {
            const p = square[(j + 1) % 4];
            gcodeArray.push(`G1 X${p.x} Y${p.y}`);
        }
        gcodeArray.push('M5');
    }
    // move to origin
    gcodeArray.push('G0 X0 Y0 Z0');
    gcodeArray.push('\n');

    return gcodeArray.join('\n');
}

export default generateLaserFocusGcode;
