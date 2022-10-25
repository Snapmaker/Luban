import fetch from 'node-fetch';
import fs from 'fs';

class DownloadManager {
    public async downlaod(url: string, savePath: string) {
        return new Promise<void>((resolve, reject) => {
            if (fs.existsSync(savePath)) {
                resolve();
                return;
            }
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
}

const downloadManager = new DownloadManager();

export default downloadManager;
