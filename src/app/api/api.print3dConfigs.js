import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import logger from '../lib/logger';
import {
    WEB_CURA_CONFIG_DIR
} from '../../web/constants/index';

const log = logger('api:print3dConfigs');

//    @type        @params                @return            @comment
//    create      [beanStr,[fileName]]    [err, beanStr]    two case：fileName in return is timestamp or 'forPrint.def.json'
//    update      [beanStr]               [err]
//    retrieve                            [err, beanArrStr]

// TODO: Use HTTP methods: POST PUT GET DELETE
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
        log.error('Unknown type ' + type);
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
    });
};
const handleUpdate = (req, res) => {
    let beanStr = req.body.beanStr;
    let bean = JSON.parse(beanStr);
    fs.writeFile(bean.filePath, JSON.stringify(bean.jsonObj, null, 2), 'utf8', (err) => {
        res.send({
            err: err
        });
    });
};
const handleRetrieve = (req, res) => {
    let beanArr = [];
    const configDir = WEB_CURA_CONFIG_DIR;

    // FIXME: use async method
    const fileNameArr = fs.readdirSync(configDir);
    for (let fileName of fileNameArr) {
        const filePath = path.join(configDir, fileName);
        //must be json file or "const jsonObj = JSON.parse(data)" will throw exception
        if (!fileName.endsWith('.json')) {
            continue;
        }
        if (_.includes(['fdmextruder.def.json', 'fdmprinter.def.json', 'snap3d_base.def.json', 'forPrint.def.json'], fileName)) {
            continue;
        }
        const isOfficial = fileName.endsWith('.custom.json');

        // FIXME: use async method
        const data = fs.readFileSync(filePath, 'utf8');
        const jsonObj = JSON.parse(data);
        beanArr.push({
            'jsonObj': jsonObj,
            'isOfficial': isOfficial,
            'filePath': filePath
        });
    }
    res.send({
        err: undefined,
        beanArrStr: JSON.stringify(beanArr)
    });
};

// @param filePath
const handleDelete = (req, res) => {
    let filePath = req.body.filePath;
    fs.unlink(filePath, (err) => {
        res.send({
            err: err
        });
    });
};

