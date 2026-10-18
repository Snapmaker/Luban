// The `;Header Start` .. `;Header End` block Luban writes at the top of every
// laser / CNC / printing export (multi-machine overhaul, tyeth/Luban#265, WP3).
//
// The writers are src/server/services/task-manager/workers/generateGcode.js
// (laser and CNC: `;header_type: laser|cnc`, `;tool_head:`, `;machine: <machine
// identifier>`, `;gcode_flavor: marlin|grbl`, `;renderMethod: line|point`,
// `;max_power:`, `;is_rotate: true|false`, ...) and src/server/slicer/
// post-processor.ts (printing: `;header_type: 3dp`, `;machine:`). Luban reads
// it back in src/server/lib/parseGcodeHeader.js: each line inside the block is
// split at its FIRST colon, the key keeps its leading `;`, and a value that is
// a plain number becomes a number. This parser does the same with the same
// key strings, so a header compared here is the header Luban wrote.
//
// Only the FIRST block counts: generateGcode.js writes small extra blocks
// (`;renderMethod:` and `;max_power:` only) between toolpaths, and those are
// collected separately as `renderMethods`. The thumbnail (a data URL that can be
// hundreds of KB) is never copied into the result.
//
// Pure: no server imports, unit-tested in tests/gcodeHeader.test.ts.

export interface GcodeHeader {
    /** `;machine:` - the Luban machineIdentifier the file was generated for ('Ray', 'Snapmaker 2.0 A350', 'Original'). */
    machine: string | null;
    /** `;header_type:` - 'laser' | 'cnc' | '3dp' as Luban writes it. */
    headerType: string | null;
    /** `;tool_head:` - the toolhead identifier. */
    toolHead: string | null;
    /** `;gcode_flavor:` - 'marlin' | 'grbl'. Luban writes 'marlin' when the machine names none. */
    gcodeFlavor: string | null;
    /** `;is_rotate:` - true for a rotary (4-axis) job; null when absent or not 'true'/'false'. */
    isRotate: boolean | null;
    /** `;max_power:` - fixed power on the flavour's S scale (1000 grbl, 255 marlin). */
    maxPower: number | null;
    /** `;renderMethod:` of the first block - 'point' for greyscale-dot (raster) jobs, 'line' otherwise. */
    renderMethod: string | null;
    /** Every `;renderMethod:` in the file (the first block and each per-toolpath block), in order. */
    renderMethods: string[];
    /** `;diameter:` - rotary stock diameter. */
    diameter: number | null;
    /** `;origin:` - the job origin mode Luban wrote. */
    origin: string | null;
    /** 1-based lines of the first block's Start and End markers. */
    startLine: number;
    endLine: number;
}

const START = ';Header Start';
const END = ';Header End';
const RENDER_METHOD = ';renderMethod';
const NUMBER_RE = /^(-?\d+)(\.\d+)?$/;

/** One header line as parseGcodeHeader.js reads it: key up to the first colon (with its ';'), value after. */
export function parseHeaderLine(line: string): { key: string; value: string | number } | null {
    if (line.trim() === '') {
        return null;
    }
    const sep = line.indexOf(':');
    if (sep === -1) {
        return null;
    }
    const key = line.substr(0, sep).trim();
    const raw = line.substr(sep + 1).trim();
    return { key, value: NUMBER_RE.test(raw) ? parseFloat(raw) : raw };
}

function text(value: string | number | undefined): string | null {
    if (value === undefined || value === '' || value === 'undefined' || value === 'null') {
        return null;
    }
    return String(value);
}

function number(value: string | number | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * The Luban header of `gcode`, or null when the file has none - no
 * `;Header Start`, or a Start never closed by `;Header End` (a hand-written
 * file that borrowed the marker is not a Luban export, and a truncated block
 * says nothing reliable).
 */
export function parseGcodeHeader(gcode: string): GcodeHeader | null {
    const lines = gcode.split(/\r?\n/);
    let start = -1;
    let end = -1;
    for (let i = 0; i < lines.length; i++) {
        if (start === -1) {
            if (lines[i].indexOf(START) !== -1) {
                start = i;
            }
        } else if (lines[i].indexOf(END) !== -1) {
            end = i;
            break;
        }
    }
    if (start === -1 || end === -1) {
        return null;
    }
    const meta: { [key: string]: string | number } = {};
    for (let i = start + 1; i < end; i++) {
        const pair = parseHeaderLine(lines[i]);
        if (pair && !(pair.key in meta)) {
            meta[pair.key] = pair.value;
        }
    }
    // Later per-toolpath blocks carry their own renderMethod.
    const renderMethods: string[] = [];
    let inBlock = false;
    for (const line of lines) {
        if (line.indexOf(START) !== -1) {
            inBlock = true;
        } else if (line.indexOf(END) !== -1) {
            inBlock = false;
        } else if (inBlock) {
            const pair = parseHeaderLine(line);
            if (pair && pair.key === RENDER_METHOD && text(pair.value) !== null) {
                renderMethods.push(String(pair.value));
            }
        }
    }
    const rotate = text(meta[';is_rotate']);
    let isRotate: boolean | null = null;
    if (rotate === 'true') {
        isRotate = true;
    } else if (rotate === 'false') {
        isRotate = false;
    }
    return {
        machine: text(meta[';machine']),
        headerType: text(meta[';header_type']),
        toolHead: text(meta[';tool_head']),
        gcodeFlavor: text(meta[';gcode_flavor']),
        isRotate,
        maxPower: number(meta[';max_power']),
        renderMethod: text(meta[RENDER_METHOD]),
        renderMethods,
        diameter: number(meta[';diameter']),
        origin: text(meta[';origin']),
        startLine: start + 1,
        endLine: end + 1,
    };
}
