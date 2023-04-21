const superagent = require('superagent');
const superagentUse = require('superagent-use');

const agent = superagentUse(superagent);
const addPrefix = (prefix) => {
    return function (request) {
        if (request.url[0] === '/') {
            request.url = prefix + request.url;
        }

        return request;
    };
};
agent.use(addPrefix('http://45.79.80.155:8100'));


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
            console.log('get case list:', result);
            res.status(200).send({
                ...result.body
            });
        }).catch((err) => {
            console.log('get case list err:', err);
        });
}
