import { expose } from 'threads/worker';

const methods = require
    .context('../../workers', false, /\.(t|j)s/)
    .keys()
    .reduce((prev, key) => {
        key = key.replace('./', '');
        const [name] = key.split('.');
        // eslint-disable-next-line import/no-dynamic-require
        prev[name] = require(`../../workers/${key}`).default;
        return prev;
    }, {});
expose(methods);
