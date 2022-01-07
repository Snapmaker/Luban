import request from 'superagent';

type IParam = { token: string, host: string, stop?: boolean }

let errorCount = 0;
const screenTimeout = 8 * 1000;
let timeoutHandle = null;
let intervalHandle = null;

const stopBeat = (msg?: string) => {
    clearInterval(intervalHandle);
    postMessage({ status: 'offline', msg });
};

onmessage = (event: MessageEvent<IParam>) => {
    const { token, host, stop } = event.data;

    if (stop && intervalHandle) {
        stopBeat();
        return;
    }

    function heartBeat() {
        const now = new Date().getTime();
        const api = `${host}/api/v1/status?token=${token}&${now}`;
        request
            .get(api)
            .timeout(3000)
            .end((err: Error, res) => {
                if (err) {
                    if (err.message.includes('Timeout')) {
                        timeoutHandle = setTimeout(() => {
                            stopBeat(err.message);
                        }, screenTimeout);
                    } else {
                        errorCount++;
                        if (errorCount >= 3) {
                            stopBeat(err.message);
                        }
                    }
                } else {
                    timeoutHandle = clearTimeout(timeoutHandle);
                    errorCount = 0;
                    postMessage({
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
    intervalHandle = setInterval(heartBeat, 1000);
};

export default {};
