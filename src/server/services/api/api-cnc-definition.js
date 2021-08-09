import fs from 'fs';
import path from 'path';
import { isNil } from 'lodash';
import { ERR_BAD_REQUEST, ERR_INTERNAL_SERVER_ERROR, CNC_CONFIG_SUBCATEGORY, CncSuffix } from '../../constants';
import DataStorage from '../../DataStorage';
import { cncUniformProfile } from '../../lib/profile/cnc-uniform-profile';

/**
 * Get definition
 */
export const getToolListDefinition = (req, res) => {
    const { definitionId } = req.params;
    if (!definitionId) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "definitionId" is required.'
        });
        return;
    }

    const filePath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, `${definitionId}${CncSuffix}`);

    const data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);
    res.send({ definition: json });
};

export const changeActiveToolListDefinition = (req, res) => {
    const { definitionId } = req.params;
    if (!definitionId) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "definitionId" is required.'
        });
        return;
    }

    const filePath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, `${definitionId}${CncSuffix}`);
    const activeFilePath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, `active${CncSuffix}`);
    const data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);
    fs.writeFile(activeFilePath, data, 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            res.send({ definition: json });
        }
    });
};

export const getToolDefinitions = (req, res) => {
    const configDir = `${DataStorage.configDir}/${CNC_CONFIG_SUBCATEGORY}`;
    const filenames = fs.readdirSync(configDir);

    // // Load pre-defined definitions first
    let definitions = [];

    for (const filename of filenames) {
        const definitionArray = cncUniformProfile(filename, configDir);
        if (!isNil(definitionArray)) {
            definitions = definitions.concat(definitionArray);
        }
    }
    res.send({ definitions });
};
export const getDefaultDefinitions = (req, res) => {
    const configDir = `${DataStorage.configDir}/default/${CNC_CONFIG_SUBCATEGORY}`;
    const filenames = fs.readdirSync(configDir);

    // // Load pre-defined definitions first
    let definitions = [];

    for (const filename of filenames) {
        const definitionArray = cncUniformProfile(filename, configDir);
        if (!isNil(definitionArray)) {
            definitions = definitions.concat(definitionArray);
        }
    }
    res.send({ definitions });
};
export const createToolListDefinition = (req, res) => {
    const { activeToolList } = req.body;
    const newActiveToolDefinition = JSON.parse(JSON.stringify(activeToolList));
    const definitionId = activeToolList.definitionId;
    const filename = `${definitionId}${CncSuffix}`;

    const destPath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, filename);

    fs.writeFile(destPath, JSON.stringify(newActiveToolDefinition, null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            res.send({ definition: newActiveToolDefinition });
        }
    });
};
export const removeToolListDefinition = (req, res) => {
    const { activeToolList } = req.body;
    const definitionId = activeToolList.definitionId;
    const filename = `${definitionId}${CncSuffix}`;
    const filePath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, filename);

    fs.unlink(filePath, (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            res.send({ status: 'ok' });
        }
    });
};

export const updateToolDefinition = (req, res) => {
    const { activeToolList } = req.body;
    const filePath = path.join(`${DataStorage.configDir}/${CNC_CONFIG_SUBCATEGORY}`, `${activeToolList.definitionId}${CncSuffix}`);
    fs.writeFile(filePath, JSON.stringify(activeToolList, null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            res.send({ status: 'ok' });
        }
    });
};

export const uploadToolDefinition = (req, res) => {
    const { uploadName, toolDefinitions } = req.body;
    const readFileSync = fs.readFileSync(`${DataStorage.tmpDir}/${uploadName}`, 'utf-8');
    const obj = JSON.parse(readFileSync);
    const newDefinitionId = uploadName.substr(0, uploadName.length - 9);
    obj.definitionId = newDefinitionId;
    if (!obj.settings) {
        const defaultToolList = toolDefinitions.find((d) => d.definitionId === 'DefaultCVbit');
        obj.settings = defaultToolList.settings;
    }

    if (!obj.category) {
        obj.category = newDefinitionId;
    }
    while (toolDefinitions.find(d => d.definitionId === obj.definitionId)) {
        obj.definitionId = `n${obj.definitionId}`;
    }
    while (toolDefinitions.find(d => d.category === obj.category)) {
        obj.category = `#${obj.category}`;
    }
    // try {
    const newFilePath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, `${obj.definitionId}${CncSuffix}`);
    fs.writeFile(newFilePath, JSON.stringify(obj, null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            res.send({ status: 'ok', definition: obj });
        }
    });
    // } catch (e) {
    //     res.status(ERR_INTERNAL_SERVER_ERROR).send({ err: e });
    // }
};
