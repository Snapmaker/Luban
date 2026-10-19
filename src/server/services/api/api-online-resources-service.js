import superagent from 'superagent';
import superagentUse from 'superagent-use';
import logger from '../../lib/logger';

// let domain = 'http://localhost:8100';
let domain = 'https://api.snapmaker.com';
if (process.env.NODE_ENV === 'production') {
    domain = 'https://api.snapmaker.com';
}

const log = logger('api:commands');

// Offline, or behind a VPN with no route to api.snapmaker.com, an unbounded
// request leaves the renderer's XHR open until the socket gives up. Fail fast
// and answer instead: the caller can render an offline state, but only if it
// is told.
const RESPONSE_TIMEOUT = 5000;
const DEADLINE_TIMEOUT = 10000;

const agent = superagentUse(superagent);
const addPrefix = (prefix) => {
    return function (request) {
        if (request.url[0] === '/') {
            request.url = prefix + request.url;
        }

        return request;
    };
};
agent.use(addPrefix(domain));

const withTimeout = (request) => request.timeout({
    response: RESPONSE_TIMEOUT,
    deadline: DEADLINE_TIMEOUT,
});

// Every one of these used to log and return, leaving the response open.
const failed = (res, what, err) => {
    log.error(`${what} failed:`, err && err.message ? err.message : JSON.stringify(err));

    if (res.headersSent) {
        return;
    }

    res.status(503).send({
        error: what,
        offline: true,
        message: 'Snapmaker online resources are unreachable.',
    });
};

export function getCaseList(req, res) {
    withTimeout(agent.get('/api/resource/sample/list/client'))
        .query({
            page: 1,
            pageSize: 10,
            type: [0, 1, 2, 3, 4],
            softWareId: 1,
            ...req.query
        })
        .then((result) => {
            res.status(200).send({
                ...result.body
            });
        }).catch((err) => failed(res, 'get case list', err));
}


export function getSvgShapeList(req, res) {
    withTimeout(agent.get('/api/resource/svg-shape-library/client/list'))
        .query({
            page: 1,
            pageSize: 10,
            ...req.query
        })
        .then((result) => {
            res.status(200).send({
                ...result.body
            });
        }).catch((err) => failed(res, 'get svg shape library list', err));
}


export function getSvgShapeLabelList(req, res) {
    withTimeout(agent.get('/api/resource/svg-shape-library/client/label/list'))
        .query({
            page: 1,
            pageSize: 10,
            ...req.query
        })
        .then((result) => {
            res.status(200).send({
                ...result.body
            });
        }).catch((err) => failed(res, 'get svg shape label list', err));
}


export function getInformationFlowData(req, res) {
    const { lang } = req.query;
    withTimeout(agent.get(`/v1/luban-information-flow?lang=${lang}`))
        .then((result) => {
            res.status(200).send({
                ...result.body
            });
        }).catch((err) => failed(res, 'get information flow', err));
}

export function getUserInfoData(req, res) {
    const userDomain = 'https://account.snapmaker.com';
    const { token } = req.query;

    // Set per request. This used to agent.use() a new Authorization plugin on
    // every call, which accumulated on the shared agent and leaked whichever
    // token was set last into unrelated requests.
    withTimeout(agent.get(`${userDomain}/api/common/accounts/current`))
        .set('Authorization', `Bearer ${token}`)
        .then((result) => {
            res.status(200).send({
                ...result.body
            });
        }).catch((err) => failed(res, 'get user info', err));
}
