import jpeg from 'jpeg-js';

import { McpToolError } from './registry';

// Zero-mean normalized cross-correlation template matching between two
// cached frames. Replaces hand-estimated pixel coordinates - the dominant
// error source in live calibration sessions - with a measurement. Pure JS
// on jpeg-js (already a dependency); a 41px patch over a 120px radius is
// well under a second.

interface GrayImage {
    width: number;
    height: number;
    data: Float32Array;
}

export function decodeToGray(jpg: Buffer): GrayImage {
    const decoded = jpeg.decode(jpg, { useTArray: true, maxMemoryUsageInMB: 64 });
    const { width, height } = decoded;
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const o = i * 4;
        gray[i] = 0.299 * decoded.data[o] + 0.587 * decoded.data[o + 1] + 0.114 * decoded.data[o + 2];
    }
    return { width, height, data: gray };
}

function patchStats(img: GrayImage, cx: number, cy: number, half: number): { mean: number; norm: number } | null {
    let sum = 0;
    const n = (2 * half + 1) ** 2;
    for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
            sum += img.data[(cy + dy) * img.width + (cx + dx)];
        }
    }
    const mean = sum / n;
    let sq = 0;
    for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
            const v = img.data[(cy + dy) * img.width + (cx + dx)] - mean;
            sq += v * v;
        }
    }
    const norm = Math.sqrt(sq);
    return norm < 1e-6 ? null : { mean, norm };
}

export interface TrackResult {
    matchedPoint: { u: number; v: number };
    du: number;
    dv: number;
    score: number;
    secondPeakGap: number;
    chosenBy: 'score' | 'expectation';
    distanceFromExpected: number | null;
    rawBest: { u: number; v: number; score: number } | null;
    warnings: string[];
}

/**
 * Locate the patch around (u, v) of the template image inside the search
 * image, scanning a square window of the given radius around the same
 * coordinates. Returns the best match with its NCC score and the gap to the
 * best score found outside the peak's immediate neighbourhood (a small gap
 * means a repetitive scene - a grid - where the wrong intersection can win).
 */
export function trackFeature(
    template: GrayImage,
    search: GrayImage,
    u: number,
    v: number,
    patchSize: number,
    searchRadius: number,
    expected?: { du: number; dv: number }
): TrackResult {
    const half = Math.floor(patchSize / 2);
    const warnings: string[] = [];

    if (u - half < 0 || v - half < 0 || u + half >= template.width || v + half >= template.height) {
        throw new McpToolError(`The ${patchSize}px patch around (${u}, ${v}) does not fit inside the `
            + `${template.width}x${template.height} template frame.`);
    }
    const tStats = patchStats(template, u, v, half);
    if (!tStats) {
        throw new McpToolError('The template patch is featureless (uniform brightness); pick a point '
            + 'on a corner or line intersection.');
    }
    const tPatch = new Float32Array((2 * half + 1) ** 2);
    let k = 0;
    for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
            tPatch[k++] = template.data[(v + dy) * template.width + (u + dx)] - tStats.mean;
        }
    }

    const uMin = Math.max(half, u - searchRadius);
    const uMax = Math.min(search.width - 1 - half, u + searchRadius);
    const vMin = Math.max(half, v - searchRadius);
    const vMax = Math.min(search.height - 1 - half, v + searchRadius);
    if (uMin > uMax || vMin > vMax) {
        throw new McpToolError('The search window falls entirely outside the search frame.');
    }
    if (uMin > u - searchRadius || uMax < u + searchRadius || vMin > v - searchRadius || vMax < v + searchRadius) {
        warnings.push('Search window was clamped by the frame edge; the true match may lie outside it.');
    }

    let best = -2;
    let bestU = u;
    let bestV = v;
    const scores: number[][] = [];
    for (let sv = vMin; sv <= vMax; sv++) {
        const row: number[] = [];
        for (let su = uMin; su <= uMax; su++) {
            const sStats = patchStats(search, su, sv, half);
            if (!sStats) {
                row.push(-2);
                continue;
            }
            let dot = 0;
            let i = 0;
            for (let dy = -half; dy <= half; dy++) {
                for (let dx = -half; dx <= half; dx++) {
                    dot += tPatch[i++] * (search.data[(sv + dy) * search.width + (su + dx)] - sStats.mean);
                }
            }
            const score = dot / (tStats.norm * sStats.norm);
            row.push(score);
            if (score > best) {
                best = score;
                bestU = su;
                bestV = sv;
            }
        }
        scores.push(row);
    }

    // Best score outside the peak's 2-patch neighbourhood: on a repetitive
    // grid the runner-up intersection scores nearly as high, and a small gap
    // says "do not trust this match blindly".
    let second = -2;
    const exclusion = 2 * half + 1;
    for (let sv = vMin; sv <= vMax; sv++) {
        for (let su = uMin; su <= uMax; su++) {
            if (Math.abs(su - bestU) <= exclusion && Math.abs(sv - bestV) <= exclusion) {
                continue;
            }
            const score = scores[sv - vMin][su - uMin];
            if (score > second) {
                second = score;
            }
        }
    }

    // Expectation tie-breaking (#52): on a repetitive grid several
    // intersections score within noise of each other and the raw best can be
    // the wrong one. Given an expected shift (from the running Jacobian),
    // choose the near-best candidate closest to it instead - and always say
    // which rule chose.
    const rawBest = { u: bestU, v: bestV, score: best };
    let chosenBy: 'score' | 'expectation' = 'score';
    let distanceFromExpected: number | null = null;
    if (expected && best > -1) {
        const eu = u + expected.du;
        const ev = v + expected.dv;
        const threshold = best - 0.08;
        let candU = bestU;
        let candV = bestV;
        let candScore = best;
        let candDist = Math.hypot(bestU - eu, bestV - ev);
        for (let sv = vMin; sv <= vMax; sv++) {
            for (let su = uMin; su <= uMax; su++) {
                const score = scores[sv - vMin][su - uMin];
                if (score < threshold) {
                    continue;
                }
                const dist = Math.hypot(su - eu, sv - ev);
                if (dist < candDist) {
                    candDist = dist;
                    candU = su;
                    candV = sv;
                    candScore = score;
                }
            }
        }
        distanceFromExpected = candDist;
        if (candU !== bestU || candV !== bestV) {
            chosenBy = 'expectation';
            warnings.push(`Expectation override: the raw best match at (${bestU}, ${bestV}) `
                + `(NCC ${best.toFixed(2)}) was replaced by a near-best candidate at (${candU}, ${candV}) `
                + `(NCC ${candScore.toFixed(2)}) closer to the expected shift - typical on repetitive `
                + 'grids. If the expectation itself is suspect, re-run without expected_shift.');
            bestU = candU;
            bestV = candV;
            best = candScore;
        }
    }

    if (best < 0.5) {
        warnings.push(`Low match confidence (NCC ${best.toFixed(2)}); the feature may have left the frame `
            + 'or changed appearance (lighting, focus, Z change).');
    }
    const gap = second <= -2 ? 1 : best - second;
    if (gap < 0.1 && best >= 0.5) {
        warnings.push(`Ambiguous match: the runner-up scores nearly as high (gap ${gap.toFixed(2)}) - `
            + 'typical of a repetitive grid. Verify against a larger patch or a distinctive feature.');
    }

    return {
        matchedPoint: { u: bestU, v: bestV },
        du: bestU - u,
        dv: bestV - v,
        score: best,
        secondPeakGap: gap,
        chosenBy,
        distanceFromExpected,
        rawBest: chosenBy === 'expectation' ? rawBest : null,
        warnings,
    };
}
