import jwt from 'jsonwebtoken';
import fs from 'fs';
// import bcrypt from 'bcrypt-nodejs';
import castArray from 'lodash/castArray';
import isPlainObject from 'lodash/isPlainObject';
import find from 'lodash/find';
// import some from 'lodash/some';
import { v4 as uuid } from 'uuid';
import settings from '../../config/settings';
import logger from '../../lib/logger';
import config from '../configstore';
// import { getPagingRange } from './paging';
import {
    // ERR_BAD_REQUEST,
    ERR_UNAUTHORIZED,
    // ERR_NOT_FOUND,
    // ERR_CONFLICT,
    // ERR_PRECONDITION_FAILED,
    ERR_INTERNAL_SERVER_ERROR
} from '../../constants';
import DataStorage from '../../DataStorage';
import pkg from '../../../package.json';

const log = logger('api:users');
const CONFIG_KEY = 'users';

// Generate access token
// https://github.com/auth0/node-jsonwebtoken#jwtsignpayload-secretorprivatekey-options-callback
// Note. Do not use password and other sensitive fields in the payload
const generateAccessToken = (payload, secret = settings.secret) => {
    const token = jwt.sign(payload, secret, {
        expiresIn: settings.accessTokenLifetime
    });

    return token;
};

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

        // Defaults to true
        if (record.enabled === undefined) {
            record.enabled = true;
        }
    }

    if (shouldUpdate) {
        log.debug(`update sanitized records: ${JSON.stringify(records)}`);

        // Pass `{ silent changes }` will suppress the change event
        config.set(CONFIG_KEY, records, { silent: true });
    }

    return records;
};

export const signin = (req, res) => {
    // TODO: Skip authentication
    // const { token = '', name = '', password = '' } = { ...req.body };
    const { token = '' } = { ...req.body };
    const users = getSanitizedRecords();
    const enabledUsers = users.filter(user => {
        return user.enabled;
    });
    let sceneJson = '';
    try {
        sceneJson = fs.readFileSync(`${DataStorage.scenesDir}/scene.json`, 'utf8');
    } catch (e) {
        log.error(e);
    }
    if (enabledUsers.length === 0) {
        const user = { id: '', name: '' };
        const payload = { ...user };
        const accessToken = generateAccessToken(payload, settings.secret); // generate access token
        res.send({
            enabled: false, // session is disabled
            token: accessToken,
            sceneJson,
            userId: config.get('gaUserId'),
            name: user.name // empty name
        });
        return;
    }

    if (!token) {
        // TODO: Skip authentication
        const user = enabledUsers[0];
        /*
        const user = find(enabledUsers, { name: name });
        const valid = user && bcrypt.compareSync(password, user.password);
        if (!valid) {
            res.status(ERR_UNAUTHORIZED).send({
                msg: 'Authentication failed'
            });
            return;
        }
        */

        const payload = {
            id: user.id,
            name: user.name
        };
        const accessToken = generateAccessToken(payload, settings.secret); // generate access token
        res.send({
            enabled: true, // session is enabled
            token: accessToken, // new token
            sceneJson,
            userId: config.get('gaUserId'),
            name: user.name
        });
        return;
    }

    jwt.verify(token, settings.secret, (err, user) => {
        if (err) {
            log.error(err);
            res.status(ERR_INTERNAL_SERVER_ERROR).send({
                msg: 'Internal server error'
            });
            return;
        }

        const iat = new Date(user.iat * 1000).toISOString();
        const exp = new Date(user.exp * 1000).toISOString();
        log.debug(`jwt.verify: id=${user.id}, name="${user.name}", iat=${iat}, exp=${exp}`);

        user = find(enabledUsers, { id: user.id, name: user.name });
        if (!user) {
            res.status(ERR_UNAUTHORIZED).send({
                msg: 'Authentication failed'
            });
            return;
        }

        res.send({
            enabled: true, // session is enabled
            token: token, // old token
            name: user.name
        });
    });
};

// export const fetch = (req, res) => {
//     const records = getSanitizedRecords();
//     const { paging = true, page = 1, pageLength = 10 } = req.query;
//     const totalRecords = records.length;
//     const [begin, end] = getPagingRange({ page, pageLength, totalRecords });
//     const pagedRecords = paging ? records.slice(begin, end) : records;

//     res.send({
//         pagination: {
//             page: Number(page),
//             pageLength: Number(pageLength),
//             totalRecords: Number(totalRecords)
//         },
//         records: pagedRecords.map(record => {
//             const { id, mtime, enabled, name } = { ...record };
//             return { id, mtime, enabled, name };
//         })
//     });
// };

// // export const create = (req, res) => {
// //     const {
// //         enabled = true,
// //         name = '',
// //         password = ''
// //     } = { ...req.body };

// //     if (!name) {
// //         res.status(ERR_BAD_REQUEST).send({
// //             msg: 'The "name" parameter must not be empty'
// //         });
// //         return;
// //     }

// //     if (!password) {
// //         res.status(ERR_BAD_REQUEST).send({
// //             msg: 'The "password" parameter must not be empty'
// //         });
// //         return;
// //     }

// //     const records = getSanitizedRecords();
// //     if (find(records, { name: name })) {
// //         res.status(ERR_CONFLICT).send({
// //             msg: 'The specified user already exists'
// //         });
// //         return;
// //     }

// //     try {
// //         const salt = bcrypt.genSaltSync();
// //         const hash = bcrypt.hashSync(password.trim(), salt);
// //         const records2 = getSanitizedRecords();
// //         const record = {
// //             id: uuid(),
// //             mtime: new Date().getTime(),
// //             enabled: enabled,
// //             name: name,
// //             password: hash
// //         };

// //         records2.push(record);
// //         config.set(CONFIG_KEY, records2);

// //         res.send({ id: record.id, mtime: record.mtime });
// //     } catch (err) {
// //         res.status(ERR_INTERNAL_SERVER_ERROR).send({
// //             msg: `Failed to save ${JSON.stringify(settings.rcfile)}`
// //         });
// //     }
// // };

// // export const read = (req, res) => {
// //     const id = req.params.id;
// //     const records = getSanitizedRecords();
// //     const record = find(records, { id: id });

// //     if (!record) {
// //         res.status(ERR_NOT_FOUND).send({
// //             msg: 'Not found'
// //         });
// //         return;
// //     }

// //     const { mtime, enabled, name } = { ...record };
// //     res.send({ id, mtime, enabled, name });
// // };

// // export const update = (req, res) => {
// //     const id = req.params.id;
// //     const records = getSanitizedRecords();
// //     const record = find(records, { id: id });

// //     if (!record) {
// //         res.status(ERR_NOT_FOUND).send({
// //             msg: 'Not found'
// //         });
// //         return;
// //     }

// //     const {
// //         enabled = record.enabled,
// //         name = record.name,
// //         oldPassword = '',
// //         newPassword = ''
// //     } = { ...req.body };
// //     const willChangePassword = oldPassword && newPassword;

// //     // Skip validation for "enabled" and "name"

// //     if (willChangePassword && !bcrypt.compareSync(oldPassword, record.password)) {
// //         res.status(ERR_PRECONDITION_FAILED).send({
// //             msg: 'Incorrect password'
// //         });
// //         return;
// //     }

// //     const inuse = (r) => {
// //         return r.id !== id && r.name === name;
// //     };
// //     if (some(records, inuse)) {
// //         res.status(ERR_CONFLICT).send({
// //             msg: 'The specified user already exists'
// //         });
// //         return;
// //     }

// //     try {
// //         record.mtime = new Date().getTime();
// //         record.enabled = Boolean(enabled);
// //         record.name = String(name || '');

// //         if (willChangePassword) {
// //             const salt = bcrypt.genSaltSync();
// //             const hash = bcrypt.hashSync(newPassword.trim(), salt);
// //             record.password = hash;
// //         }

// //         config.set(CONFIG_KEY, records);

// //         res.send({ id: record.id, mtime: record.mtime });
// //     } catch (err) {
// //         res.status(ERR_INTERNAL_SERVER_ERROR).send({
// //             msg: `Failed to save ${JSON.stringify(settings.rcfile)}`
// //         });
// //     }
// // };

/*
export const __delete = (req, res) => {
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

        res.send({ id: record.id });
    } catch (err) {
        res.status(ERR_INTERNAL_SERVER_ERROR).send({
            msg: `Failed to save ${JSON.stringify(settings.rcfile)}`
        });
    }
};
*/

export const resetConfig = async (req, res) => {
    try {
        await DataStorage.clearAll();
        await DataStorage.init(true);
        res.status(200).send({
            msg: 'Reset user config successfully'
        });
    } catch (e) {
        log.error(e);
        res.status(500).send({
            msg: 'Failed to reset user config'
        });
    }
};

export const resetPrintConfig = async (req, res) => {
    try {
        // Yes actually we reset all configurations
        await DataStorage.clearAll();
        await DataStorage.init(true);
        res.status(200).send({
            msg: 'Reset user config successfully'
        });
    } catch (e) {
        log.error(e);
        res.status(500).send({
            msg: 'Failed to reset user config'
        });
    }
};

export const longTermBackupConfig = async (req, res) => {
    try {
        const version = pkg.version;
        await DataStorage.createLongTermRecover(version, version, true);
        res.status(200).send({
            msg: 'Backup config successfully'
        });
    } catch (e) {
        log.error(e);
        res.status(500).send({
            msg: 'Backup config failed'
        });
    }
};

export const checkNewUser = async (req, res) => {
    try {
        const isNewUser = config.get('isNewUser');
        res.status(200).send({
            isNewUser
        });
    } catch (e) {
        log.error(e);
        res.status(500).send({
            isNewUser: true
        });
    }
};
