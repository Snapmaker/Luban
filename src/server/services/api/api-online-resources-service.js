import superagent from 'superagent';
import superagentUse from 'superagent-use';
import logger from '../../lib/logger';

// let domain = 'http://localhost:8100';
let domain = 'https://api.snapmaker.com';
if (process.env.NODE_ENV === 'production') {
    domain = 'https://api.snapmaker.com';
}

const log = logger('api:commands');

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


export function getCaseList(req, res) {
    agent.get('/api/resource/sample/list/client')
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
        }).catch((err) => {
            log.error('get case list err:', JSON.stringify(err));
        });
}


export function getSvgShapeList(req, res) {
    agent.get('/api/resource/svg-shape-library/client/list')
        .query({
            page: 1,
            pageSize: 10,
            ...req.query
        })
        .then((result) => {
            res.status(200).send({
                ...result.body
            });
        }).catch((err) => {
            log.error(`get svg shape libray list  with query: ${JSON.stringify(req.query)}, err:`, JSON.stringify(err));
        });
}


export function getSvgShapeLabelList(req, res) {
    agent.get('/api/resource/svg-shape-library/client/label/list')
        .query({
            page: 1,
            pageSize: 10,
            ...req.query
        })
        .then((result) => {
            res.status(200).send({
                ...result.body
            });
        }).catch((err) => {
            log.error(`get svg shape libray list  with query: ${JSON.stringify(req.query)}, err:`, JSON.stringify(err));
        });
}


export function getInformationFlowData(req, res) {
    const { lang } = req.query;
    agent.get(`/v1/luban-information-flow?lang=${lang}`)
        .then((result) => {
            res.status(200).send({
                ...result.body
            });
        }).catch((err) => {
            log.error('get information flow err:', JSON.stringify(err));
        });
}
