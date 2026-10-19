// Tip-centre contacts from the QuadEink pocket, pass 2 (job f84f2a263333,
// 2026-09-21, B180, machine frame, toolhead Z 203.4, 1.25 mm tip). Each lobe
// run is ORDERED along the wall: the long wall (lw, +X or -X marches) into
// the lobe fan (marches at 7.5 deg steps) into the end wall (ew, -Y
// marches). Plate (6)'s lobes are irregular rounds - a circle fits them
// poorly (rms ~0.5 mm) - which is exactly why they are the test case.
// Generated from scratchpad/pocket_pass2_result.json (group lobe_px / lobe_mx).

export const LOBE_PX_RUN = [
    { x: 196.85, y: 161 },
    { x: 196.85, y: 160 },
    { x: 196.85, y: 159 },
    { x: 196.85, y: 158 },
    { x: 196.85, y: 157 },
    { x: 196.85, y: 156 },
    { x: 196.95, y: 155 },
    { x: 196.85, y: 154.05 },
    { x: 196.749, y: 152.635 },
    { x: 195.992, y: 151.372 },
    { x: 194.431, y: 150.553 },
    { x: 193.492, y: 149.729 },
    { x: 193.428, y: 148.351 },
    { x: 192.798, y: 147.252 },
    { x: 191.807, y: 146.483 },
    { x: 190.6, y: 146.084 },
    { x: 189.316, y: 146.037 },
    { x: 188.132, y: 146.098 },
    { x: 187.055, y: 146.033 },
    { x: 186, y: 145.95 },
    { x: 185, y: 145.95 },
    { x: 184, y: 145.95 },
    { x: 183, y: 145.85 },
    { x: 182, y: 145.85 },
    { x: 181, y: 145.85 },
    { x: 180, y: 145.85 },
    { x: 179, y: 145.85 },
    { x: 178, y: 145.85 },
];

export const LOBE_MX_RUN = [
    { x: 142.65, y: 161 },
    { x: 142.75, y: 160 },
    { x: 142.75, y: 159 },
    { x: 142.75, y: 158 },
    { x: 142.75, y: 157 },
    { x: 142.75, y: 156 },
    { x: 142.85, y: 155 },
    { x: 142.95, y: 154.05 },
    { x: 143.332, y: 152.748 },
    { x: 144.024, y: 151.591 },
    { x: 145.173, y: 150.722 },
    { x: 146.677, y: 150.28 },
    { x: 147.11, y: 149.376 },
    { x: 147.453, y: 148.303 },
    { x: 147.921, y: 147.167 },
    { x: 148.77, y: 146.381 },
    { x: 149.884, y: 146.037 },
    { x: 151.042, y: 146.001 },
    { x: 152.132, y: 145.934 },
    { x: 153.2, y: 145.95 },
    { x: 154.2, y: 145.85 },
    { x: 155.2, y: 145.85 },
    { x: 156.2, y: 145.85 },
    { x: 157.2, y: 145.85 },
    { x: 158.2, y: 145.85 },
    { x: 159.2, y: 145.85 },
    { x: 160.2, y: 145.85 },
    { x: 161.2, y: 145.85 },
];

/**
 * The chuck-end +X corner from the same job, model frame: a straight long wall, then the wall
 * curves gently (r ~9) and finally tightly (the last four points fit r 3.86, max resid 0.05).
 */
export const CHUCK_PX_CORNER_RUN = [
    { x: -46.3, y: -28.35 }, { x: -47.3, y: -28.35 }, { x: -48.3, y: -28.35 }, { x: -49.3, y: -28.35 },
    { x: -50.3, y: -28.25 }, { x: -51.3, y: -28.12 }, { x: -52.3, y: -27.82 }, { x: -53.3, y: -27.38 }, { x: -54.3, y: -26.22 },
];
