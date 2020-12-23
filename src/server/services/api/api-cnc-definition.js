import fs from 'fs';
import path from 'path';
import { ERR_BAD_REQUEST, ERR_INTERNAL_SERVER_ERROR, CNC_CONFIG_SUBCATEGORY } from '../../constants';
import DataStorage from '../../DataStorage';


/**
 * Get definition
 */
export const getToolListDefinition = (req, res) => {
    const { definitionId } = req.params;
    const toolName = req.query.toolName;
    if (!definitionId) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "definitionId" is required.'
        });
        return;
    }

    const filePath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, `${definitionId}.def.json`);

    const data = fs.readFileSync(filePath, 'utf8');
    // try {
    const json = JSON.parse(data);
    let result;
    if (definitionId === 'active') {
        result = json;
    } else {
        const newDefinition = json.toolList.find((item) => item.toolName === toolName);
        newDefinition.definitionId = json.definitionId;
        result = newDefinition;
    }
    res.send({ definition: result });
    // } catch (e) {
    //     res.status(ERR_BAD_REQUEST).send({
    //         err: e
    //     });
    // }
};

export const changeActiveToolListDefinition = (req, res) => {
    const { definitionId } = req.params;
    const toolName = req.query.toolName;
    if (!definitionId) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "definitionId" is required.'
        });
        return;
    }

    const filePath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, `${definitionId}.def.json`);
    const activeFilePath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, 'active.def.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);
    const newDefinition = json.toolList.find((item) => item.toolName === toolName);
    newDefinition.definitionId = json.definitionId;
    fs.writeFile(activeFilePath, JSON.stringify(newDefinition, null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            res.send({ definition: newDefinition });
        }
    });
};

export const getToolDefinitions = (req, res) => {
    const regex = /([A-Za-z0-9_]+).def.json$/;

    const configDir = `${DataStorage.configDir}/${CNC_CONFIG_SUBCATEGORY}`;
    const filenames = fs.readdirSync(configDir);

    // // Load pre-defined definitions first
    const definitions = [];

    for (const filename of filenames) {
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
    const definitionId = activeToolCategory.definitionId;
    const filename = `${definitionId}.def.json`;

    const destPath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, filename);

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
    const definitionId = activeToolCategory.definitionId;
    const filename = `${definitionId}.def.json`;

    const destPath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, filename);
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
    const { definitionId } = req.body;

    const filePath = path.join(`${DataStorage.configDir}/${CNC_CONFIG_SUBCATEGORY}`, `${definitionId}.def.json`);
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
    const definitionId = activeToolCategory.definitionId;
    const filename = `${definitionId}.def.json`;

    const destPath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, filename);
    activeToolCategory.toolList = activeToolCategory.toolList.filter(d => d.toolName !== newActiveToolDefinition.toolName);

    fs.writeFile(destPath, JSON.stringify(activeToolCategory, null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            res.send({ definition: activeToolCategory });
        }
    });
};


export const updateToolDefinition = (req, res) => {
    const { activeToolCategory } = req.body;
    const filePath = path.join(`${DataStorage.configDir}/${CNC_CONFIG_SUBCATEGORY}`, `${activeToolCategory.definitionId}.def.json`);
    fs.writeFile(filePath, JSON.stringify(activeToolCategory, null, 2), 'utf8', (err) => {
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
    const filePath = uploadName;
    const readFileSync = fs.readFileSync(`${DataStorage.tmpDir}/${filePath}`, 'utf-8');
    const obj = JSON.parse(readFileSync);
    const newDefinitionId = uploadName.substr(0, uploadName.length - 9);
    obj.definitionId = newDefinitionId;
    // // TODO: if have't the 'toolList',should add default toolDefinition
    if (obj.toolList) {
        obj.toolList.forEach((item) => {
            item.definitionId = newDefinitionId;
        });
    } else {
        const defaultToolCategory = toolDefinitions.find((d) => d.definitionId === 'Default');
        obj.toolList = defaultToolCategory.toolList;
    }

    if (!obj.category) {
        obj.category = newDefinitionId;
    }
    while (toolDefinitions.find(d => d.category === obj.category)) {
        obj.category = `#${obj.category}`;
    }
    // try {
    const newFilePath = path.join(`${DataStorage.configDir}`, CNC_CONFIG_SUBCATEGORY, filePath);
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
