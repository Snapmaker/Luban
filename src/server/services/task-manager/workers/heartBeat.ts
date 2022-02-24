import request from 'superagent';
import sendMessage from '../utils/sendMessage';

type IParam = { token: string, host: string, stop?: boolean }

let errorCount = 0;
const screenTimeout = 8 * 1000;
let timeoutHandle = null;
let intervalHandle = null;

const stopBeat = (msg?: string) => {
    clearInterval(intervalHandle);
    sendMessage({ status: 'offline', msg });
};

const heartBeat = (param: IParam) => {
    return new Promise((resolve) => {
        const { token, host, stop } = param;
        if (stop && intervalHandle) {
            resolve(stopBeat());
            return;
        }

        function beat() {
            const now = new Date().getTime();
            const api = `${host}/api/v1/status?token=${token}&${now}`;
            request
                .get(api)
                .timeout(3000)
                .end((err: Error, res) => {
                    if (err) {
                        if (err.message.includes('Timeout')) {
                            timeoutHandle = setTimeout(() => {
                                resolve(stopBeat(err.message));
                            }, screenTimeout);
                        } else {
                            errorCount++;
                            if (errorCount >= 3) {
                                resolve(stopBeat(err.message));
                            }
                        }
                    } else {
                        timeoutHandle = clearTimeout(timeoutHandle);
                        errorCount = 0;
                        sendMessage({
                            status: 'online',
                            err,
                            res: {
                                text: res.text,
                                body: res.body,
                                status: res.status,
                            }
                        });
                    }
                });
        }
        intervalHandle = setInterval(beat, 1000);
    });
};

export default heartBeat;
