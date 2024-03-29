import find from 'lodash/find';
import castArray from 'lodash/castArray';
import isPlainObject from 'lodash/isPlainObject';
import { v4 as uuid } from 'uuid';
import settings from '../../config/settings';
import logger from '../../lib/logger';
import config from '../configstore';
import { getPagingRange } from './paging';
import {
    ERR_BAD_REQUEST,
    ERR_NOT_FOUND,
    ERR_INTERNAL_SERVER_ERROR
} from '../../constants';

const log = logger('api:macros');
const CONFIG_KEY = 'macros';

const getSanitizedRecords = () => {
    const records = castArray(config.get(CONFIG_KEY, []));

    let shouldUpdate = false;
    for (let i = 0; i < records.length; ++i) {
        if (!isPlainObject(records[i])) {
            records[i] = {};
        }

        const record = records[i];

        if (!record.id) {
            record.id = uuid();
            shouldUpdate = true;
        }
    }

    if (shouldUpdate) {
        log.debug(`update sanitized records: ${JSON.stringify(records)}`);

        // Pass `{ silent changes }` will suppress the change event
        config.set(CONFIG_KEY, records, { silent: true });
    }

    return records;
};

export const fetch = (req, res) => {
    const records = getSanitizedRecords();
    const { paging = false, page = 1, pageLength = 10 } = req.query;
    const totalRecords = records.length;
    const [begin, end] = getPagingRange({ page, pageLength, totalRecords });
    const pagedRecords = paging ? records.slice(begin, end) : records;
    res.send({
        pagination: {
            page: Number(page),
            pageLength: Number(pageLength),
            totalRecords: Number(totalRecords)
        },
        records: pagedRecords.map(record => {
            const { id, mtime, name, content, repeat, isDefault } = { ...record };
            return { id, mtime, name, content, repeat, isDefault };
        })
    });
};

export const create = (req, res) => {
    const { name, content, repeat, isDefault = false } = { ...req.body };

    if (!name) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'The "name" parameter must not be empty'
        });
        return;
    }

    if (!content) {
        res.status(ERR_BAD_REQUEST).send({
            msg: 'The "content" parameter must not be empty'
        });
        return;
    }

    try {
        const records = getSanitizedRecords();
        const record = {
            id: uuid(),
            mtime: new Date().getTime(),
            name,
            content,
            repeat,
            isDefault
        };

        records.push(record);
        config.set(CONFIG_KEY, records);

        res.send({ err: null });
    } catch (err) {
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: `Failed to save ${JSON.stringify(settings.rcfile)}`
        });
    }
};

export const read = (req, res) => {
    const id = req.params.id;
    const records = getSanitizedRecords();
    const record = find(records, { id: id });

    if (!record) {
        res.status(ERR_NOT_FOUND).send({
            msg: 'Not found'
        });
        return;
    }

    const { mtime, name, content, repeat, isDefault } = { ...record };
    res.send({ id, mtime, name, content, repeat, isDefault });
};

export const update = (req, res) => {
    const id = req.params.id;
    const records = getSanitizedRecords();
    const record = find(records, { id: id });

    if (!record) {
        res.status(ERR_NOT_FOUND).send({
            msg: 'Not found'
        });
        return;
    }

    const {
        name = record.name,
        content = record.content,
        repeat = record.repeat
    } = { ...req.body };

    try {
        record.mtime = new Date().getTime();
        record.name = String(name || '');
        record.content = String(content || '');
        record.repeat = repeat || 0;

        config.set(CONFIG_KEY, records);

        res.send({ err: null });
    } catch (err) {
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: `Failed to save ${JSON.stringify(settings.rcfile)}`
        });
    }
};

export const remove = (req, res) => {
    const id = req.params.id;
    const records = getSanitizedRecords();
    const record = find(records, { id: id });

    if (!record) {
        res.status(ERR_NOT_FOUND).send({
            msg: 'Not found'
        });
        return;
    }

    try {
        const filteredRecords = records.filter(r => {
            return r.id !== id;
        });
        config.set(CONFIG_KEY, filteredRecords);

        res.send({ err: null });
    } catch (err) {
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: `Failed to save ${JSON.stringify(settings.rcfile)}`
        });
    }
};
