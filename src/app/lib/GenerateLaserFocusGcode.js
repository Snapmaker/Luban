/**
 *  generate gcode line following
 *  0  -0.5  -1.0  -1.5  -2.0  -2.5
 * 「」 「」   「」  「」  「」   「」
 *     「」   「」  「」  「」   「」
 *     +0.5  +1.0  +1.5  +2.0  +2.5
 */
function generateLaserFocusGcode(power, workSpeed, jogSpeed) {
    const gcodes = [];

    // add comment
    gcodes.push(';Power: ' + power);
    gcodes.push(';Work Speed: ' + workSpeed);
    gcodes.push(';Jog Speed: ' + jogSpeed);

    gcodes.push('G90'); // absolute position
    gcodes.push('G21'); // set units to mm
    gcodes.push(`M3 S${power}`);
    gcodes.push('G0 X0 Y0');
    // const length = 2; // 2mm
    for (let i = -5; i <= 5; i++) {
        const z = 0.5 * i;
        const start = {
            x: i * 4,
            y: 0
        };
        const end = {
            x: i * 4 + 2,
            y: 2
        };

        gcodes.push(`G0 X${start.x} Y${start.y} Z${z} F${jogSpeed}`);
        gcodes.push('M3');
        gcodes.push(`G1 X${start.x} Y${end.y} F${workSpeed}`);
        gcodes.push(`G1 X${end.x} Y${end.y} F${workSpeed}`);
        gcodes.push(`G1 X${end.x} Y${start.y} F${workSpeed}`);
        gcodes.push(`G1 X${start.x} Y${start.y} F${workSpeed}`);
        gcodes.push('M5');
    }

    return gcodes.join('\n') + '\n';
}

export default generateLaserFocusGcode;
