import fs from 'fs';
import path from 'path';
import logger from '../lib/logger';
import {
    WEB_CURA_CONFIG_DIR
} from '../../web/constants/index';

const log = logger('api:print3dConfigs');

//    @type        @params                @return            @comment
//    create      [beanStr,[fileName]]    [err, beanStr]    two case：fileName in return is timestamp or 'forPrint.def.json'
//    update      [beanStr]               [err]
//    retrieve                            [err, beanArrStr]
//    delete      [filePath]              [err]

export const set = (req, res) => {
    const type = req.body.type || '';
    if (type === 'create') {
        handleCreate(req, res);
    } else if (type === 'update') {
        handleUpdate(req, res);
    } else if (type === 'retrieve') {
        handleRetrieve(req, res);
    } else if (type === 'delete') {
        handleDelete(req, res);
    } else {
        log.error('Unknow type ' + type);
    }
};
const strEndWith = (originStr, endStr) => {
    if (originStr === null || originStr === undefined || originStr.trim().length === 0) {
        return false;
    }
    if (endStr === null || endStr === undefined || endStr.trim().length === 0) {
        return false;
    }
    if (endStr.length > originStr.length) {
        return false;
    }
    if (originStr.substring(originStr.length - endStr.length) === endStr) {
        return true;
    } else {
        return false;
    }
};
const handleCreate = (req, res) => {
    let beanStr = req.body.beanStr;
    let bean = JSON.parse(beanStr);
    let newPath = path.join(path.dirname(bean.filePath), new Date().getTime() + '.custom.json');
    if (req.body.fileName) {
        newPath = path.join(path.dirname(bean.filePath), req.body.fileName);
    }
    bean.filePath = newPath;
    fs.writeFile(newPath, JSON.stringify(bean.jsonObj, null, 2), 'utf8', (err) => {
        res.send({
            err: err,
            beanStr: JSON.stringify(bean)
        });
        res.end();
    });
};
const handleUpdate = (req, res) => {
    let beanStr = req.body.beanStr;
    let bean = JSON.parse(beanStr);
    fs.writeFile(bean.filePath, JSON.stringify(bean.jsonObj, null, 2), 'utf8', (err) => {
        res.send({
            err: err
        });
        res.end();
    });
};
const handleRetrieve = (req, res) => {
    let beanArr = [];
    let configDir = `${WEB_CURA_CONFIG_DIR}`;
    let fileNameArr = fs.readdirSync(configDir);
    for (let fileName of fileNameArr) {
        let filePath = path.join(configDir, fileName);
        if (strEndWith(filePath, '.custom.json')) {
            let data = fs.readFileSync(filePath, 'utf8');
            let jsonObj = JSON.parse(data);
            let isOfficial = false;
            // beanArr.push(new Print3dConfigBean(jsonObj, isOfficial, filePath));
            beanArr.push({
                'jsonObj': jsonObj,
                'isOfficial': isOfficial,
                'filePath': filePath
            });
        } else if (strEndWith(filePath, '.def.json')) {
            if (path.basename(filePath) !== 'fdmextruder.def.json'
                && path.basename(filePath) !== 'fdmprinter.def.json'
                && path.basename(filePath) !== 'snap3d_base.def.json'
                && path.basename(filePath) !== 'forPrint.def.json') {
                let data = fs.readFileSync(filePath, 'utf8');
                let jsonObj = JSON.parse(data);
                let isOfficial = true;
                // beanArr.push(new Print3dConfigBean(jsonObj, isOfficial, filePath));
                beanArr.push({
                    'jsonObj': jsonObj,
                    'isOfficial': isOfficial,
                    'filePath': filePath
                });
            }
        }
    }
    res.send({
        err: undefined,
        beanArrStr: JSON.stringify(beanArr)
    });
    res.end();
};
const handleDelete = (req, res) => {
    let filePath = req.body.filePath;
    fs.unlink(filePath, (err) => {
        res.send({
            err: err
        });
        res.end();
    });
};

