import fs from 'fs';
import path from 'path';
import {
    ERR_BAD_REQUEST,
    ERR_INTERNAL_SERVER_ERROR
} from '../constants';

const WEB_CURA_CONFIG_DIR = '../CuraEngine/Config';


export const fetch = (req, res) => {
    const type = req.params.type;
    if (!type) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'The "type" parameter must not be empty'
        });
        return;
    }
    let fileNames = [];
    const configDir = WEB_CURA_CONFIG_DIR;
    switch (type.toLowerCase()) {
        case 'material':
            fileNames = ['material_PLA.def.json', 'material_ABS.def.json', 'material_CUSTOM.def.json', 'material_for_print.def.json'];
            break;
        case 'official':
            fileNames = ['fast_print.official.json', 'normal_quality.official.json', 'high_quality.official.json'];
            break;
        case 'custom': {
            const allFileNames = fs.readdirSync(configDir);
            for (const fileName of allFileNames) {
                if (fileName.endsWith('.custom.json')) {
                    fileNames.push(fileName);
                }
            }
        }
            break;
        case 'adhesion_support':
            fileNames = ['adhesion_support.def.json'];
            break;
        default:
            res.status(ERR_BAD_REQUEST).send({
                err: 'The "type" parameter must be one of "material/official/custom/adhesion_support"'
            });
            return;
    }
    const beanArr = [];
    for (const fileName of fileNames) {
        const filePath = path.join(configDir, fileName);
        // FIXME: use async method
        const data = fs.readFileSync(filePath, 'utf8');
        const jsonObj = JSON.parse(data);
        beanArr.push({
            'jsonObj': jsonObj,
            'filePath': filePath
        });
    }
    res.send({
        beanArrStr: JSON.stringify(beanArr)
    });
};

export const create = (req, res) => {
    let beanStr = req.body.beanStr;
    let bean = JSON.parse(beanStr);
    let newPath = path.join(path.dirname(bean.filePath), new Date().getTime() + '.custom.json');
    bean.filePath = newPath;
    fs.writeFile(newPath, JSON.stringify(bean.jsonObj, null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            res.send({
                beanStr: JSON.stringify(bean)
            });
        }
    });
};

export const update = (req, res) => {
    const beanStr = req.body.beanStr;
    const bean = JSON.parse(beanStr);
    fs.writeFile(bean.filePath, JSON.stringify(bean.jsonObj, null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            res.send({ status: 'ok' });
        }
    });
};

export const deleteConfigFile = (req, res) => {
    const { filePath } = { ...req.body };
    fs.unlink(filePath, (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            res.send({ status: 'ok' });
        }
    });
};
