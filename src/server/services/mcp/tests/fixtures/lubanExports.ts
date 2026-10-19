// Luban export shapes for the machine-aware validator suites (#265 WP3).
//
// The header lines are the exact strings generateGcode.js writes (key, colon,
// space, value, in its order); the bodies follow GcodeGenerator.js: the GRBL
// (Ray) generator runs words together (`G1 X10Y20F3000S500`), the Marlin one
// spaces them and writes `M3 P<percent> S<0-255>` for a fixed-power laser.

export interface HeaderFields {
    headType: 'laser' | 'cnc' | '3dp';
    toolHead: string;
    machine: string;
    gcodeFlavor: 'marlin' | 'grbl';
    renderMethod?: 'line' | 'point';
    maxPower: number;
    isRotate?: boolean;
}

/** The `;Header Start` .. `;Header End` block generateGcode.js writes (thumbnail included, as for every machine but the Ray). */
export function lubanHeader(f: HeaderFields): string {
    const lines = [
        ';Header Start',
        `;header_type: ${f.headType}`,
        `;tool_head: ${f.toolHead}`,
        `;machine: ${f.machine}`,
        `;gcode_flavor: ${f.gcodeFlavor}`,
        `;renderMethod: ${f.renderMethod || 'line'}`,
        `;max_power: ${f.maxPower}`,
        ';file_total_lines: 40',
        ';estimated_time(s): 61.2',
        `;is_rotate: ${f.isRotate === true}`,
        ';diameter: 0',
        ';max_x(mm): 40',
        ';max_y(mm): 40',
        ';max_z(mm): 0',
        ';max_b(mm): 0',
        ';min_x(mm): 10',
        ';min_y(mm): 10',
        ';min_b(mm): 0',
        ';min_z(mm): 0',
        ';work_speed(mm/minute): 1500',
        ';jog_speed(mm/minute): 3000',
        ';power(%): 0',
        ';work_size_x: 600',
        ';work_size_y: 400',
        ';origin: bottom-left',
    ];
    if (f.machine !== 'Ray') {
        lines.push(';thumbnail: data:image/png;base64,iVBORw0KGgo=');
    }
    lines.push(';Header End', ';Snapmaker Luban 4.15.0', ';Sun Oct 19 2026 1:2:3', '');
    return lines.join('\n');
}

/** A Ray laser export: GRBL compact words, S on the 0-1000 scale. */
export function rayExport(over: Partial<HeaderFields> = {}, s = 500): string {
    return lubanHeader({ headType: 'laser', toolHead: '20W Laser Module', machine: 'Ray', gcodeFlavor: 'grbl', maxPower: 1000, ...over })
        + [
            'G90',
            'G0 X10Y10F3000',
            `M3 S${s}`,
            `G1 X40Y10F1500S${s}`,
            'G1 X40Y40',
            'G1 X10Y40',
            'G1 X10Y10',
            'M5 ',
            'G0 X0Y0F3000',
        ].join('\n');
}

/** An Original laser export: Marlin spaced words, the fixed-power `M3 P.. S..` preamble. */
export const ORIGINAL_LASER_EXPORT = lubanHeader({ headType: 'laser', toolHead: 'levelOneLaserToolheadForOriginal', machine: 'Original', gcodeFlavor: 'marlin', maxPower: 127.5 })
    + [
        '; Laser: setting power',
        'M3 P50 S127',
        'G4 P1',
        'M5',
        '',
        'G90',
        'G0 X10.00 Y10.00 F3000',
        'M3',
        'G1 X40.00 Y10.00 F1500',
        'G1 X40.00 Y40.00',
        'M5',
    ].join('\n');

/**
 * An A350 CNC export as the operator stages them: Luban header, arcs (G2/G3
 * are 'unverified' in the SM2 reference), a plane select (unlisted), the 200 W
 * spindle at S rpm. Submitted with frame: "work".
 */
export function a350CncExport(machine = 'Snapmaker 2.0 A350', isRotate = false): string {
    return lubanHeader({ headType: 'cnc', toolHead: 'standardCNCToolheadForSM2', machine, gcodeFlavor: 'marlin', maxPower: 255, isRotate })
        + [
            'G90',
            'G17',
            'G0 Z10 F1500',
            'M3 S12000',
            'G0 X10 Y10',
            'G1 Z-1 F300',
            'G1 X40 Y10 F600',
            'G2 X40 Y40 I0 J15',
            'G3 X10 Y40 I-15 J0',
            'G1 X10 Y10',
            'G0 Z10',
            'M5',
        ].join('\n');
}
