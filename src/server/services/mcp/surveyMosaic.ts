// A camera survey's geometry: how far apart the waypoints may be before the
// frames stop overlapping, and where each frame lands in one machine-
// coordinate picture.
//
// "Seamless" is a relationship between the grid pitch and the field of view,
// and until the camera model existed nothing knew the field of view - so the
// pitch was a number somebody picked. With a model it falls out.
//
// Pure: no server imports, unit-tested in tests/surveyMosaic.test.ts.

export interface FramePlacement {
    /** Machine XY of the frame centre, on the plane the mosaic is computed for. */
    centre: { x: number; y: number };
    widthMm: number;
    heightMm: number;
}

export const MIN_PITCH_MM = 5;
export const MAX_PITCH_MM = 160;

/**
 * The largest pitch that still leaves `overlap` of each frame shared with its
 * neighbour. Overlap is what a mosaic is stitched on and what its seams are
 * checked with, so zero overlap is not a survey, it is a contact sheet.
 */
export function pitchForOverlap(fovWidthMm: number, fovHeightMm: number, overlap: number): { x: number; y: number } {
    const keep = Math.min(Math.max(1 - overlap, 0.05), 1);
    const clamp = (mm: number) => Math.min(Math.max(Number((mm * keep).toFixed(1)), MIN_PITCH_MM), MAX_PITCH_MM);
    return { x: clamp(fovWidthMm), y: clamp(fovHeightMm) };
}

export interface MosaicLayout {
    /** Machine-coordinate bounding box the mosaic covers. */
    bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
    widthPx: number;
    heightPx: number;
    mmPerPixel: number;
    /**
     * Mosaic pixel -> machine XY. Machine Y runs UP the picture, so the affine
     * flips it: reading a feature's position off the mosaic is then a lookup,
     * not an inference.
     */
    affine: { x0: number; y0: number; mmPerPx: number; yFlipped: true };
}

export const MAX_MOSAIC_PX = 4000;

/** The canvas that holds every frame placed at its machine coordinates. */
export function planMosaic(frames: FramePlacement[], mmPerPixel: number): MosaicLayout | null {
    if (!frames.length || !(mmPerPixel > 0)) {
        return null;
    }
    const bounds = {
        xMin: Math.min(...frames.map((f) => f.centre.x - (f.widthMm / 2))),
        xMax: Math.max(...frames.map((f) => f.centre.x + (f.widthMm / 2))),
        yMin: Math.min(...frames.map((f) => f.centre.y - (f.heightMm / 2))),
        yMax: Math.max(...frames.map((f) => f.centre.y + (f.heightMm / 2))),
    };
    // One pass to see whether the canvas would be enormous, then coarsen
    // rather than refusing: a whole-bed mosaic at full frame resolution is
    // hundreds of megapixels and nobody needs that to find a hole.
    const spanX = bounds.xMax - bounds.xMin;
    const spanY = bounds.yMax - bounds.yMin;
    const scale = Math.max(1, spanX / (MAX_MOSAIC_PX * mmPerPixel), spanY / (MAX_MOSAIC_PX * mmPerPixel));
    const mmPerPx = mmPerPixel * scale;
    return {
        bounds,
        widthPx: Math.max(1, Math.ceil(spanX / mmPerPx)),
        heightPx: Math.max(1, Math.ceil(spanY / mmPerPx)),
        mmPerPixel: Number(mmPerPx.toFixed(5)),
        affine: { x0: bounds.xMin, y0: bounds.yMax, mmPerPx: Number(mmPerPx.toFixed(5)), yFlipped: true },
    };
}

/** Machine XY of a mosaic pixel, through the layout's own affine. */
export function mosaicPixelToMachine(layout: MosaicLayout, u: number, v: number): { x: number; y: number } {
    return {
        x: layout.affine.x0 + (u * layout.affine.mmPerPx),
        y: layout.affine.y0 - (v * layout.affine.mmPerPx),
    };
}

/** Where a machine XY lands in the mosaic. */
export function machineToMosaicPixel(layout: MosaicLayout, x: number, y: number): { u: number; v: number } {
    return {
        u: (x - layout.affine.x0) / layout.affine.mmPerPx,
        v: (layout.affine.y0 - y) / layout.affine.mmPerPx,
    };
}

export interface SeamCheck {
    /** Frames whose footprints overlap, and by how much. */
    pairs: number;
    overlapFraction: number;
}

/**
 * How much of the grid actually overlaps. A survey whose frames do not touch
 * cannot be stitched and cannot detect a knocked camera either - the seams
 * ARE the drift check, so their absence is worth reporting.
 */
export function seamCoverage(frames: FramePlacement[]): SeamCheck {
    let pairs = 0;
    let shared = 0;
    let total = 0;
    for (let i = 0; i < frames.length; i++) {
        for (let j = i + 1; j < frames.length; j++) {
            const a = frames[i];
            const b = frames[j];
            const dx = Math.abs(a.centre.x - b.centre.x);
            const dy = Math.abs(a.centre.y - b.centre.y);
            const overlapX = Math.max(0, ((a.widthMm + b.widthMm) / 2) - dx);
            const overlapY = Math.max(0, ((a.heightMm + b.heightMm) / 2) - dy);
            if (overlapX > 0 && overlapY > 0) {
                pairs += 1;
                shared += overlapX * overlapY;
                total += Math.min(a.widthMm * a.heightMm, b.widthMm * b.heightMm);
            }
        }
    }
    return { pairs, overlapFraction: total > 0 ? Number((shared / total).toFixed(3)) : 0 };
}

export interface SeamStats {
    /** Mosaic pixels two frames both claimed. */
    pixels: number;
    /** Mean |a - b| over those pixels, 0-255. */
    meanAbsDiff: number;
    /** Mean (a - b): a pure exposure difference between frames shows up here. */
    meanSignedDiff: number;
}

export interface SeamJudgement {
    /** What is left after the exposure difference is taken out: real disagreement. */
    structuralDiff: number;
    /** Enough shared pixels to mean anything. */
    conclusive: boolean;
    drifted: boolean;
    note: string;
}

/** Below this the frames are telling the same story; above it they are not. */
export const SEAM_STRUCTURAL_LIMIT = 25;
/** Fewer shared pixels than this and the number is noise, not evidence. */
export const SEAM_MIN_PIXELS = 5000;

/**
 * Whether the overlaps agree.
 *
 * The seams ARE the drift check: two frames that saw the same ground from
 * different poses should land on the same mosaic pixels, so if they disagree
 * the model no longer describes the camera - it was knocked, re-aimed or
 * swapped. An overall brightness difference is not disagreement (auto-exposure
 * does that between any two frames), so it is subtracted before judging.
 */
export function judgeSeams(stats: SeamStats): SeamJudgement {
    const structural = Math.max(0, stats.meanAbsDiff - Math.abs(stats.meanSignedDiff));
    const conclusive = stats.pixels >= SEAM_MIN_PIXELS;
    const drifted = conclusive && structural > SEAM_STRUCTURAL_LIMIT;
    if (!conclusive) {
        return {
            structuralDiff: Number(structural.toFixed(2)),
            conclusive: false,
            drifted: false,
            note: `Only ${stats.pixels} overlapping pixels: too little shared ground to say whether the model still `
                + 'describes the camera. Survey with a larger overlap_fraction if you want the seams to check it.',
        };
    }
    return {
        structuralDiff: Number(structural.toFixed(2)),
        conclusive: true,
        drifted,
        note: drifted
            ? `Frames disagree by ${structural.toFixed(1)} grey levels where they overlap, beyond the `
                + `${SEAM_STRUCTURAL_LIMIT} expected from noise and exposure. The same ground is landing in different `
                + 'places, so the camera has most likely been knocked or re-aimed since the model was solved. The '
                + 'model is marked unverified: re-run verify_camera_model, and camera_bootstrap if that fails.'
            : `Overlapping frames agree to ${structural.toFixed(1)} grey levels - the model still places them on top `
                + 'of each other, which is the best evidence available that the camera has not moved.',
    };
}
