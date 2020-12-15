import fs from 'fs';
import path from 'path';
import { ERR_BAD_REQUEST, ERR_INTERNAL_SERVER_ERROR } from '../../constants';
import DataStorage from '../../DataStorage';
// import { timestamp } from '../../../shared/lib/random-utils';

const cncConfig = 'cncConfig';

const isDefaultToolDefinition = (definitionName) => {
    return definitionName.indexOf('quality') !== -1
     && (definitionName.indexOf('fast_print') !== -1
     || definitionName.indexOf('high_quality') !== -1
     || definitionName.indexOf('normal_quality') !== -1
     );
};

/**
 * Get definition
 */
export const getToolListDefinition = (req, res) => {
    const { category } = req.params;
    const definitionId = req.query.definitionId;
    if (!category) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "category" is required.'
        });
        return;
    }

    const filePath = path.join(`${DataStorage.configDir}`, cncConfig, `${category}.def.json`);

    const data = fs.readFileSync(filePath, 'utf8');
    // try {
    const json = JSON.parse(data);
    let result;
    if (category === 'active') {
        result = json;
        console.log('active', result);
    } else {
        const newDefinition = json.toolList.find((item) => item.toolName === definitionId);
        newDefinition.category = json.category;
        result = newDefinition;
        console.log('filePath', category, newDefinition, filePath, result);
    }
    res.send({ definition: result });
    // } catch (e) {
    //     res.status(ERR_BAD_REQUEST).send({
    //         err: e
    //     });
    // }
};

export const getToolDefinitions = (req, res) => {
    const regex = /([A-Za-z0-9_]+).def.json$/;

    const configDir = `${DataStorage.configDir}/cncConfig`;
    const filenames = fs.readdirSync(configDir);

    // // Load pre-defined definitions first
    const definitions = [];

    for (const filename of filenames) {
        console.log('filename.substr(0, filename.length - 9)', filename.substr(0, filename.length - 9));
        if (regex.test(filename) && filename.substr(0, filename.length - 9) !== 'active') {
            const filePath = path.join(configDir, filename);
            const data = fs.readFileSync(filePath, 'utf8');
            const json = JSON.parse(data);
            definitions.push(json);
        }
    }
    res.send({ definitions });
};
export const createToolCategoryDefinition = (req, res) => {
    const { activeToolCategory } = req.body;
    const category = activeToolCategory.category;
    // const newCategoryPrefix = `${category}${timestamp()}`;
    const filename = `${category}.def.json`;

    const destPath = path.join(`${DataStorage.configDir}`, cncConfig, filename);

    console.log('createToolDefinition', destPath, activeToolCategory);
    fs.writeFile(destPath, JSON.stringify(activeToolCategory, null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            res.send({ definition: activeToolCategory });
        }
    });
};
export const createToolListDefinition = (req, res) => {
    const { activeToolCategory, activeToolList } = req.body;
    const newActiveToolDefinition = JSON.parse(JSON.stringify(activeToolList));
    const category = activeToolCategory.category;
    const filename = `${category}.def.json`;
    console.log('newActiveToolDefinition', newActiveToolDefinition);

    const destPath = path.join(`${DataStorage.configDir}`, cncConfig, filename);
    activeToolCategory.toolList.push(newActiveToolDefinition);

    fs.writeFile(destPath, JSON.stringify(activeToolCategory, null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            res.send({ definition: activeToolCategory });
        }
    });
};

export const removeToolCategoryDefinition = (req, res) => {
    const { category } = req.params;

    const filePath = path.join(`${DataStorage.configDir}/${cncConfig}`, `${category}.def.json`);
    console.log('removeToolCategoryDefinition', category, filePath);
    fs.unlink(filePath, (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            res.send({ status: 'ok' });
        }
    });
};
export const removeToolListDefinition = (req, res) => {
    const { activeToolCategory, activeToolList } = req.body;
    const newActiveToolDefinition = JSON.parse(JSON.stringify(activeToolList));
    const category = activeToolCategory.category;
    const filename = `${category}.def.json`;

    const destPath = path.join(`${DataStorage.configDir}`, cncConfig, filename);
    activeToolCategory.toolList = activeToolCategory.toolList.filter(d => d.toolName !== newActiveToolDefinition.toolName);
    console.log('removeToolListDefinition', activeToolCategory);

    fs.writeFile(destPath, JSON.stringify(activeToolCategory, null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            res.send({ definition: activeToolCategory });
        }
    });
};


export const updateDefinition = (req, res) => {
    const { definitionId } = req.params;
    const series = isDefaultQualityDefinition(definitionId) ? req.body.series : '';

    const definitionLoader = new DefinitionLoader();
    definitionLoader.loadDefinition(definitionId, series);

    const { definition } = req.body;

    if (definition.name) {
        definitionLoader.updateName(definition.name);
    }

    if (definition.settings) {
        definitionLoader.updateSettings(definition.settings);
    }

    const filePath = path.join(`${DataStorage.configDir}/${series}`, `${definitionId}.def.json`);
    fs.writeFile(filePath, JSON.stringify(definitionLoader.toJSON(), null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            res.send({ status: 'ok' });
        }
    });
};

export const uploadDefinition = (req, res) => {
    const { definitionId, tmpPath } = req.body;
    const readFileSync = fs.readFileSync(`${DataStorage.tmpDir}/${tmpPath}`, 'utf-8');
    const obj = JSON.parse(readFileSync);

    if (!obj.inherits) {
        obj.inherits = 'fdmprinter';
    }

    if (!obj.metadata) {
        obj.metadata = {};
    }
    obj.metadata.readonly = false;

    const definitionLoader = new DefinitionLoader();
    try {
        definitionLoader.loadJSON(definitionId, obj);
        const filePath = path.join(`${DataStorage.configDir}`, `${definitionId}.def.json`);
        fs.writeFile(filePath, JSON.stringify(definitionLoader.toJSON(), null, 2), 'utf8', (err) => {
            if (err) {
                res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
            } else {
                res.send({ status: 'ok', definition: definitionLoader.toObject() });
            }
        });
    } catch (e) {
        res.status(ERR_INTERNAL_SERVER_ERROR).send({ err: e });
    }
};
