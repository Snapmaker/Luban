import fetch from 'node-fetch';
import fs from 'fs';

class DownloadManager {
    public async download(url: string, savePath: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fetch(url, {
                headers: { 'Content-Type': 'application/octet-stream' },
            })
                .then(res => res.buffer())
                .then(_ => {
                    fs.writeFile(savePath, _, 'binary', (err) => {
                        if (err) {
                            reject();
                        } else {
                            resolve();
                        }
                    });
                });
        });
    }

    /**
     * Download if file on target path not exists.
     */
    public async downloadIfNotExist(url: string, savePath: string): Promise<void> {
        if (fs.existsSync(savePath)) {
            return;
        }

        await this.download(url, savePath);
    }
}

const downloadManager = new DownloadManager();

export default downloadManager;
