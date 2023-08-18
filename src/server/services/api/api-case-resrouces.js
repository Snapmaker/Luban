import superagent from 'superagent';
import superagentUse from 'superagent-use';
import logger from '../../lib/logger';

const log = logger('api:commands');

const agent = superagentUse(superagent);
const addPrefix = (prefix) => {
    return (request) => {
        if (request.url[0] === '/') {
            request.url = prefix + request.url;
        }

        return request;
    };
};
agent.use(addPrefix('https://api.snapmaker.com'));


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
