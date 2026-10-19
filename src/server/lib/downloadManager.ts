import fetch from 'node-fetch';
import fs from 'fs';
import logger from './logger';

const log = logger('lib:downloadManager');

// These downloads are optional extras - a CJK font, the camera calibration maps.
// Offline they used to reject with no catch and no timeout, leaving a floating
// rejection for the process-wide handler to pick up.
const DOWNLOAD_TIMEOUT = 15000;

class DownloadManager {
    public async download(url: string, savePath: string): Promise<boolean> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

        try {
            const res = await fetch(url, {
                headers: { 'Content-Type': 'application/octet-stream' },
                signal: controller.signal,
            });

            if (!res.ok) {
                log.warn(`Download failed (${res.status}): ${url}`);
                return false;
            }

            const buffer = await res.buffer();
            await fs.promises.writeFile(savePath, buffer, 'binary');
            return true;
        } catch (err) {
            log.warn(`Download failed: ${url} (${err && err.message ? err.message : err})`);
            return false;
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Download if file on target path not exists.
     *
     * Resolves either way - callers treat these as best-effort.
     */
    public async downloadIfNotExist(url: string, savePath: string): Promise<boolean> {
        if (fs.existsSync(savePath)) {
            return true;
        }

        return this.download(url, savePath);
    }
}

const downloadManager = new DownloadManager();

export default downloadManager;
