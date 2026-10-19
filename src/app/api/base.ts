import superagentUse from 'superagent-use';
import superagent from 'superagent';

import TaskQueue from './TaskQueue';
import { machineStore } from '../store/local-storage';
import ensureArray from '../lib/ensure-array';
import { getBackendOrigin, whenBackendOrigin } from '../lib/backend-origin';

const bearer = (request) => {
    const token = machineStore.get('session.token');
    if (token) {
        request.set('Authorization', `Bearer ${token}`);
    }
};

// Relative URLs only resolve while the page is served from the backend. Once it
// is loaded off disk they need the origin spelling out.
const backendOrigin = (request) => {
    const origin = getBackendOrigin();
    if (origin && typeof request.url === 'string' && request.url.charAt(0) === '/') {
        request.url = origin + request.url;
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
request.use(backendOrigin);
request.use(noCache);



const taskQueue = new TaskQueue(4);

// Default API factory that performs the request, and then convert its result to `Promise`.
const defaultAPIFactory = (genRequest) => {
    return async (...args) => {
        // The window is up before the server is, and components start calling
        // the API as soon as they mount. Hold each call until we know where the
        // backend is, or it resolves against the luban:// handler instead.
        await whenBackendOrigin();

        return new Promise((resolve, reject) => {
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
};

export {
    defaultAPIFactory,
    request,
};
