/**
 * Derive the laser on/off boolean (headStatus) from the numeric laser power.
 *
 * The Snapmaker 2.0 HTTP API (/api/v1/status) and the SACP subscriptions report only a numeric
 * `laserPower`; there is no boolean on/off field. Returning `undefined` when power is unknown lets
 * callers skip the update instead of forcing the toggle off (audit R9 / 01-F2).
 *
 * Plain .js (not .ts) so the tape test harness can require it under @babel/register, which in this
 * repo does not resolve .ts extensions. Imported by SstpHttpChannel.ts via allowJs.
 *
 * @param {number|undefined|null} laserPower
 * @returns {boolean|undefined}
 */
export function deriveHeadStatus(laserPower) {
    if (laserPower === undefined || laserPower === null) {
        return undefined;
    }
    return laserPower > 0;
}
