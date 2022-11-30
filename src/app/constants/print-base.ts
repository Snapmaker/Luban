/**
 * Print Mode
 *
 * Modified version of Multi Nozzle Mode (M605)
 *
 * See also: https://marlinfw.org/docs/gcode/M605.html
 *
 *   M605 S<0|1|2|3> X<linear> R<temp>
 *
 * from:
 *   M605 S0: Full Control
 *   M605 S1: Auto-park
 *   M605 S2: Duplication Mode
 *
 * to:
 *
 *   M605 S0: Full Control Mode
 *   M605 S2: Duplication Mode
 *   M605 S3: Mirror Mode
 */
export enum PrintMode {
    Default = 0,
    IDEXAutoPark,
    IDEXDuplication,
    IDEXMirror,
    IDEXBackup,
}

