import * as fs from 'fs-extra';
import jpeg from 'jpeg-js';

import { CameraModel } from './cameraModel';
import { machineToPixel } from './cameraGeometry';
import { FramePlacement, MosaicLayout, SeamStats, mosaicPixelToMachine, planMosaic } from './surveyMosaic';

// Composing a survey's frames into ONE picture indexed in machine
// coordinates.
//
// The point is not prettiness. Once every frame is placed where the model says
// it belongs, "the hole is at mosaic pixel (u, v) on plane Z" is a lookup
// through the index's own affine, not an inference from a single frame and a
// remembered scale - which is what the 2026-09-19 session was reduced to.
//
// Each frame is drawn by INVERSE mapping over its own footprint: for every
// mosaic pixel it could cover, ask the model which of its pixels that machine
// point projects to. That is hole-free where a forward splat would leave gaps,
// and it costs the mosaic's area rather than the product of frames and pixels.
//
// Seams are not blended away. A hard edge at the right coordinates is the
// whole value, and where two frames disagree that disagreement is evidence
// about the camera (surveySeams.ts), not something to smooth over.

export interface SurveyFrame {
    file: string;
    machine: { x: number; y: number; z: number };
}

export interface RenderedMosaic {
    layout: MosaicLayout;
    /** Per frame, the mosaic pixel box it was drawn into. */
    placements: Array<{ file: string; u0: number; v0: number; u1: number; v1: number }>;
    /** Mosaic pixels that no frame covered. */
    uncoveredFraction: number;
    /** How much the frames disagreed where they overlapped - the drift check. */
    seams: SeamStats;
}

interface DecodedFrame {
    file: string;
    machine: { x: number; y: number; z: number };
    width: number;
    height: number;
    data: Buffer | Uint8Array;
}

function decode(file: string): DecodedFrame | null {
    try {
        const raw = fs.readFileSync(file);
        const image = jpeg.decode(raw, { useTArray: true, maxMemoryUsageInMB: 256 });
        return { file, machine: { x: 0, y: 0, z: 0 }, width: image.width, height: image.height, data: image.data };
    } catch (err) {
        return null;
    }
}

function projectPixelToPlane(
    model: CameraModel,
    toolhead: { x: number; y: number; z: number },
    pixel: { u: number; v: number },
    planeZ: number
): { x: number; y: number } {
    const { fx, fy, cx, cy } = model.intrinsics;
    const r = model.extrinsics.rotation;
    const d = { x: (pixel.u - cx) / fx, y: (pixel.v - cy) / fy, z: 1 };
    const dir = {
        x: (r[0][0] * d.x) + (r[0][1] * d.y) + (r[0][2] * d.z),
        y: (r[1][0] * d.x) + (r[1][1] * d.y) + (r[1][2] * d.z),
        z: (r[2][0] * d.x) + (r[2][1] * d.y) + (r[2][2] * d.z),
    };
    const centre = {
        x: toolhead.x + model.extrinsics.offset.x,
        y: toolhead.y + model.extrinsics.offset.y,
        z: toolhead.z + model.extrinsics.offset.z,
    };
    if (Math.abs(dir.z) < 1e-9) {
        throw new Error('ray parallel to the plane');
    }
    const t = (planeZ - centre.z) / dir.z;
    if (t <= 0) {
        throw new Error('plane behind the camera');
    }
    return { x: centre.x + (dir.x * t), y: centre.y + (dir.y * t) };
}

/**
 * Where each frame's footprint lands on the plane, from the model. A frame
 * whose corners cannot be projected (behind the camera, a plane it cannot
 * see) is left out rather than placed somewhere plausible.
 */
export function framePlacements(
    model: CameraModel,
    frames: SurveyFrame[],
    planeZ: number
): Array<{ frame: SurveyFrame; placement: FramePlacement }> {
    const out: Array<{ frame: SurveyFrame; placement: FramePlacement }> = [];
    for (const frame of frames) {
        try {
            // The frame centre's ray, and the footprint around it: both come
            // from the same model, so the centre is where the model says the
            // toolhead is looking, not where the toolhead is.
            const corners = [
                { u: 0, v: 0 },
                { u: model.fingerprint.width, v: 0 },
                { u: 0, v: model.fingerprint.height },
                { u: model.fingerprint.width, v: model.fingerprint.height },
            ].map((pixel) => projectPixelToPlane(model, frame.machine, pixel, planeZ));
            const xs = corners.map((c) => c.x);
            const ys = corners.map((c) => c.y);
            out.push({
                frame,
                placement: {
                    centre: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 },
                    widthMm: Math.max(...xs) - Math.min(...xs),
                    heightMm: Math.max(...ys) - Math.min(...ys),
                },
            });
        } catch (err) {
            // Not placeable: skipped, and the caller sees it in the count.
        }
    }
    return out;
}


/**
 * Draw the frames into one machine-coordinate picture and write it as a JPEG.
 * Returns the layout, which is what the index records: with it, a mosaic pixel
 * and a plane are a machine coordinate.
 */
export function renderMosaic(
    model: CameraModel,
    frames: SurveyFrame[],
    planeZ: number,
    outPath: string
): RenderedMosaic | null {
    const placed = framePlacements(model, frames, planeZ);
    if (!placed.length) {
        return null;
    }
    const mmPerPixel = Math.min(...placed.map((p) => p.placement.widthMm / model.fingerprint.width));
    const layout = planMosaic(placed.map((p) => p.placement), mmPerPixel);
    if (!layout) {
        return null;
    }

    const pixels = new Uint8Array(layout.widthPx * layout.heightPx * 4);
    const covered = new Uint8Array(layout.widthPx * layout.heightPx);
    const placements: RenderedMosaic['placements'] = [];
    // Where a second frame claims a pixel the first already drew, the two are
    // looking at the same ground from different poses. Comparing them costs
    // nothing here and is the only free evidence about whether the model still
    // describes the camera.
    let seamPixels = 0;
    let seamAbs = 0;
    let seamSigned = 0;

    for (const { frame, placement } of placed) {
        const decoded = decode(frame.file);
        if (!decoded) {
            continue;
        }
        const u0 = Math.max(0, Math.floor((placement.centre.x - (placement.widthMm / 2) - layout.bounds.xMin) / layout.mmPerPixel));
        const u1 = Math.min(layout.widthPx - 1, Math.ceil((placement.centre.x + (placement.widthMm / 2) - layout.bounds.xMin) / layout.mmPerPixel));
        const v0 = Math.max(0, Math.floor((layout.bounds.yMax - placement.centre.y - (placement.heightMm / 2)) / layout.mmPerPixel));
        const v1 = Math.min(layout.heightPx - 1, Math.ceil((layout.bounds.yMax - placement.centre.y + (placement.heightMm / 2)) / layout.mmPerPixel));
        placements.push({ file: frame.file, u0, v0, u1, v1 });

        for (let v = v0; v <= v1; v++) {
            for (let u = u0; u <= u1; u++) {
                const machine = mosaicPixelToMachine(layout, u + 0.5, v + 0.5);
                let source;
                try {
                    source = machineToPixel(model, frame.machine, { x: machine.x, y: machine.y, z: planeZ });
                } catch (err) {
                    continue;
                }
                if (source.behind) {
                    continue;
                }
                const su = Math.round(source.u);
                const sv = Math.round(source.v);
                if (su < 0 || sv < 0 || su >= decoded.width || sv >= decoded.height) {
                    continue;
                }
                const target = ((v * layout.widthPx) + u) * 4;
                const from = ((sv * decoded.width) + su) * 4;
                // First frame wins: a hard seam at the right coordinates says
                // more than an average of two disagreeing views. But measure
                // the disagreement on the way past.
                if (covered[(v * layout.widthPx) + u]) {
                    const existing = (pixels[target] + pixels[target + 1] + pixels[target + 2]) / 3;
                    const incoming = (decoded.data[from] + decoded.data[from + 1] + decoded.data[from + 2]) / 3;
                    seamPixels += 1;
                    seamAbs += Math.abs(existing - incoming);
                    seamSigned += existing - incoming;
                    continue;
                }
                pixels[target] = decoded.data[from];
                pixels[target + 1] = decoded.data[from + 1];
                pixels[target + 2] = decoded.data[from + 2];
                pixels[target + 3] = 255;
                covered[(v * layout.widthPx) + u] = 1;
            }
        }
    }

    const encoded = jpeg.encode({ data: Buffer.from(pixels), width: layout.widthPx, height: layout.heightPx }, 85);
    fs.writeFileSync(outPath, encoded.data);

    let uncovered = 0;
    for (let i = 0; i < covered.length; i++) {
        if (!covered[i]) {
            uncovered += 1;
        }
    }
    return {
        layout,
        placements,
        uncoveredFraction: Number((uncovered / covered.length).toFixed(4)),
        seams: {
            pixels: seamPixels,
            meanAbsDiff: seamPixels ? Number((seamAbs / seamPixels).toFixed(2)) : 0,
            meanSignedDiff: seamPixels ? Number((seamSigned / seamPixels).toFixed(2)) : 0,
        },
    };
}
