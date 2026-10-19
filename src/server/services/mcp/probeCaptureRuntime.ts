import crypto from 'crypto';
import fs from 'fs';

import { captureFrame } from './camera';
import { ProbeCapturePlan } from './probeCapture';
import { probeFeedService } from './probeFeed';
import { programFramePath } from './programFrames';
import { awaitMachineSettled, checkProcedureStop, isProcedureAbort, sleep } from './probing';
import { getPositionSnapshot } from './tools/machine';

/** Called serially by a probe runner while contact remains expected, before retreat. */
export async function captureProbeSpot(plan: ProbeCapturePlan, tool: string, spot: string): Promise<object> {
    const startedAt = Date.now();
    const check = () => {
        checkProcedureStop();
        probeFeedService.assertNoOvertravel();
    };
    check();
    try {
        await awaitMachineSettled(`${tool}:capture:${spot}`, { timeoutMs: 5000 });
        await sleep(plan.settleMs);
        check();
        const settledAt = Date.now();
        let frame = await captureFrame();
        // A running MJPEG source can initially return a frame from before
        // arrival. Never label that old frame as the measured probe spot.
        while (frame.capturedAt < settledAt) {
            if (Date.now() - settledAt > 5000) { throw new Error('No fresh camera frame after arrival at probe spot.'); }
            await sleep(100);
            check();
            frame = await captureFrame();
        }
        check();
        const pose = getPositionSnapshot();
        const file = programFramePath(startedAt, tool, `${spot}_${crypto.randomBytes(4).toString('hex')}`);
        fs.writeFileSync(file, Buffer.from(frame.imageBase64, 'base64'));
        return {
            status: 'captured',
            frameId: frame.frameId,
            file,
            label: plan.label,
            spot,
            capturedAt: frame.capturedAt,
            machine: pose.machine,
            b: pose.b,
            reliability: pose.reliability,
            device: frame.device,
            provider: frame.provider,
            source: frame.source,
            mimeType: frame.mimeType,
            note: 'Stationary frame before probe retract; pose is the actual final pass, not the median contact. Read with get_frame {file}.',
        };
    } catch (err) {
        check();
        if (isProcedureAbort(err)) { throw err; }
        // A broken camera must not strand the probe in contact or discard
        // the measurement. The caller records this and performs its retreat.
        return { status: 'failed', spot, label: plan.label, error: (err as Error).message };
    }
}
