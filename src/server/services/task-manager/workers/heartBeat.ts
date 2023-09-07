import request from 'superagent';
import sendMessage from '../utils/sendMessage';
import logger from '../../../lib/logger';

const log = logger('service:worker:heartBeat');


type IParam = { token: string, host: string, stop?: boolean }

let errorCount = 0;
const screenTimeout = 8 * 1000;
let timeoutHandle = null;
let intervalHandle = null;

const stopBeat = (msg?: string, flag?: number) => {
    log.debug(`offline flag=${flag}`);
    clearInterval(intervalHandle);
    intervalHandle = null;
    sendMessage({ status: 'offline', msg });
};

let logCounter = 0;

const heartBeat = async (param: IParam) => {
    return new Promise((resolve) => {
        const { token, host, stop } = param;
        if (stop && intervalHandle) {
            resolve(stopBeat('', 1));
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
                        log.warn(`beat err=${err?.message}`);
                        if (err.message.includes('Timeout')) {
                            if (!timeoutHandle) {
                                timeoutHandle = setTimeout(() => {
                                    resolve(stopBeat(err.message, 2));
                                }, screenTimeout);
                            }
                        } else {
                            errorCount++;
                            if (errorCount >= 3) {
                                resolve(stopBeat(err.message, 3));
                            }
                        }
                    } else {
                        if (++logCounter % 10 === 0) {
                            log.info(`beat status=${res?.status}`);
                        }
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
        if (intervalHandle) {
            return;
        }
        beat();
        clearInterval(intervalHandle);
        intervalHandle = setInterval(beat, 2000);
    });
};

export default heartBeat;
