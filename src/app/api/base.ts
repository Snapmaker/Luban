import superagentUse from 'superagent-use';
import superagent from 'superagent';

import TaskQueue from './TaskQueue';
import { machineStore } from '../store/local-storage';
import ensureArray from '../lib/ensure-array';

const bearer = (request) => {
    const token = machineStore.get('session.token');
    if (token) {
        request.set('Authorization', `Bearer ${token}`);
    }
};

const noCache = (request) => {
    const now = Date.now();
    request.set('Cache-Control', 'no-cache');
    request.set('X-Requested-With', 'XMLHttpRequest');

    if (request.method === 'GET' || request.method === 'HEAD') {
        request._query = ensureArray(request._query);
        request._query.push(`_=${now}`);
    }
};

const request = superagentUse(superagent);
request.use(bearer);
request.use(noCache);



const taskQueue = new TaskQueue(4);

// Default API factory that performs the request, and then convert its result to `Promise`.
const defaultAPIFactory = (genRequest) => {
    return async (...args) => new Promise((resolve, reject) => {
        taskQueue.push(
            () => genRequest(...args),
            (response, cb) => {
                response.end((err, res) => {
                    if (err) {
                        reject(res);
                    } else {
                        resolve(res);
                    }
                    cb();
                });
            }
        );
    });
};

export {
    defaultAPIFactory,
    request,
};
