import request from 'superagent';
import sendMessage from '../utils/sendMessage';
import logger from '../../../lib/logger';
import { httpEvidence } from '../../machine/connectionDiagnosticState';

const log = logger('service:worker:heartBeat');


type IParam = { token: string, host: string, stop?: boolean }

let errorCount = 0;
const screenTimeout = 8 * 1000;
let timeoutHandle = null;
let intervalHandle = null;

const stopBeat = (_msg?: string, flag?: number) => {
    log.debug(`offline flag=${flag}`);
    clearInterval(intervalHandle);
    intervalHandle = null;
    const reason = { 1: 'stop_requested', 2: 'status_timeout', 3: 'repeated_status_errors' }[flag] || 'unknown';
    sendMessage({ status: 'offline', reason });
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
            sendMessage({ status: 'poll-start' });
            const api = `${host}/api/v1/status?token=${token}&${now}`;
            request
                .get(api)
                .timeout(3000)
                .end((err: Error, res) => {
                    if (err) {
                        const evidence = httpEvidence(err, res);
                        log.warn(`beat failed status=${evidence.httpStatus || 'none'} code=${evidence.errorCode || 'unknown'}`);
                        sendMessage({ status: 'poll-error', ...evidence, durationMs: Date.now() - now });
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
                            durationMs: Date.now() - now,
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
