/**
 *  generate gcode line following
 *  0  -0.5  -1.0  -1.5  -2.0  -2.5
 * 「」 「」   「」  「」  「」   「」
 *     「」   「」  「」  「」   「」
 *     +0.5  +1.0  +1.5  +2.0  +2.5
 */
function generateLaserFocusGcode(power, workSpeed, jogSpeed) {
    const len = 4;
    const space = 2;
    const gcodes = [];

    // priority: P > S, for compatibility, use both P and S args.
    const powerStrength = Math.floor(power * 255 / 100);
    //power is 'power percent'
    const m3Command = `M3 P${power} S${powerStrength}`;

    gcodes.push(';powerPercent: ' + power);
    gcodes.push(';workSpeed: ' + workSpeed);
    gcodes.push(';jogSpeed: ' + jogSpeed);

    gcodes.push('G90'); // absolute position
    gcodes.push('G21'); // set units to mm
    gcodes.push(m3Command);
    gcodes.push('M5');
    gcodes.push('G0 X0 Y0');

    for (let i = 0; i < 6; i++) {
        const z = -i * 0.5;
        const p1 = {
            x: i * (len + space),
            y: len
        };
        const p2 = {
            x: p1.x + len,
            y: len
        };
        const p3 = {
            x: p2.x,
            y: 0
        };
        const p4 = {
            x: p1.x,
            y: 0
        };
        gcodes.push(`G0 X${p1.x} Y${p1.y} Z${z} F${jogSpeed}`);
        gcodes.push(m3Command);
        gcodes.push(`G1 X${p2.x} Y${p2.y} F${workSpeed}`);
        gcodes.push(`G1 X${p3.x} Y${p3.y}`);
        gcodes.push(`G1 X${p4.x} Y${p4.y}`);
        gcodes.push(`G1 X${p1.x} Y${p1.y}`);
        gcodes.push('M5');
    }

    for (let i = 1; i < 6; i++) {
        const z = i * 0.5;
        const p1 = {
            x: i * (len + space),
            y: -space
        };
        const p2 = {
            x: p1.x + len,
            y: -space
        };
        const p3 = {
            x: p2.x,
            y: -(space + len)
        };
        const p4 = {
            x: p1.x,
            y: -(space + len)
        };
        gcodes.push(`G0 X${p1.x} Y${p1.y} Z${z} F${jogSpeed}`);
        gcodes.push(m3Command);
        gcodes.push(`G1 X${p2.x} Y${p2.y} F${workSpeed}`);
        gcodes.push(`G1 X${p3.x} Y${p3.y}`);
        gcodes.push(`G1 X${p4.x} Y${p4.y}`);
        gcodes.push(`G1 X${p1.x} Y${p1.y}`);
        gcodes.push('M5');
    }
    // move to origin
    gcodes.push('G0 X0 Y0 Z0');

    const gcode = gcodes.join('\n') + '\n';
    return gcode;
}

export default generateLaserFocusGcode;
