import fs from 'fs';
import path from 'path';
import {
    WEB_CURA_CONFIG_DIR
} from '../../web/constants/index';

export const fetch = (req, res) => {
    const type = req.params.type;
    if (!type) {
        res.send({
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
        for (let fileName of allFileNames) {
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
        res.send({
            err: 'The "type" parameter must be one of "material/official/custom/adhesion_support"'
        });
        return;
    }
    let beanArr = [];
    for (let fileName of fileNames) {
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
        err: null,
        beanArrStr: JSON.stringify(beanArr)
    });
};

export const create = (req, res) => {
    let beanStr = req.body.beanStr;
    let bean = JSON.parse(beanStr);
    let newPath = path.join(path.dirname(bean.filePath), new Date().getTime() + '.custom.json');
    bean.filePath = newPath;
    fs.writeFile(newPath, JSON.stringify(bean.jsonObj, null, 2), 'utf8', (err) => {
        res.send({
            err: err,
            beanStr: JSON.stringify(bean)
        });
    });
};

export const update = (req, res) => {
    let beanStr = req.body.beanStr;
    let bean = JSON.parse(beanStr);
    fs.writeFile(bean.filePath, JSON.stringify(bean.jsonObj, null, 2), 'utf8', (err) => {
        res.send({
            err: err
        });
    });
};

export const __delete = (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(WEB_CURA_CONFIG_DIR, fileName);
    fs.unlink(filePath, (err) => {
        res.send({
            err: err
        });
    });
};
