import fs from 'fs';
import path from 'path';
import { ERR_BAD_REQUEST, ERR_INTERNAL_SERVER_ERROR } from '../../constants';
import { loadDefinitionsByPrefixName, loadAllSeriesDefinitions, DefinitionLoader } from '../../slicer';
import DataStorage from '../../DataStorage';

/**
 * Get raw definition which is unparsed and override.
 */
export const getRawDefinition = (req, res) => {
    const { definitionId, headType } = req.params;
    const series = req.query.series;
    if (!definitionId) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "definitionId" is required.'
        });
        return;
    }

    const filename = `${definitionId}.def.json`;
    const configDir = `${DataStorage.configDir}/${headType}/${series}/${filename}`;
    const readFileSync = fs.readFileSync(configDir);
    const parse = JSON.parse(readFileSync);
    res.send({ filename: filename, definition: parse });
};

export const getDefinition = (req, res) => {
    const { definitionId, headType } = req.params;
    const series = req.query.series;
    if (!definitionId) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "definitionId" is required.'
        });
        return;
    }

    const definitionLoader = new DefinitionLoader();

    definitionLoader.loadDefinition(headType, definitionId, series);

    res.send({ definition: definitionLoader.toObject() });
};


export const getDefinitionsByPrefixName = (req, res) => {
    // const definitions = loadMaterialDefinitions();
    const { headType, prefix, series } = req.params;
    const definitions = loadDefinitionsByPrefixName(headType, prefix, series);
    res.send({ definitions });
};


export const getDefaultDefinitions = (req, res) => {
    const { series, headType } = req.params;
    const definitions = loadAllSeriesDefinitions(true, headType, series);
    res.send({ definitions });
};


export const getConfigDefinitions = (req, res) => {
    const { series, headType } = req.params;
    const definitions = loadAllSeriesDefinitions(false, headType, series);
    res.send({ definitions });
};

export const createDefinition = (req, res) => {
    const { headType } = req.params;
    const { definition } = req.body;

    const definitionLoader = new DefinitionLoader();
    definitionLoader.fromObject(definition);
    const series = req.body.series ?? '';

    const filePath = path.join(`${DataStorage.configDir}/${headType}/${series}`, `${definitionLoader.definitionId}.def.json`);
    fs.writeFile(filePath, JSON.stringify(definitionLoader.toJSON(), null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            const loader = new DefinitionLoader();
            loader.loadDefinition(headType, definitionLoader.definitionId, series);
            res.send({ definition: loader.toObject() });
        }
    });
};

export const createTmpDefinition = (req, res) => {
    const { definition, filename } = req.body;

    const definitionLoader = new DefinitionLoader();
    definitionLoader.fromObject(definition);

    const uploadName = `${filename ?? definitionLoader.definitionId}.def.json`;
    const filePath = path.join(`${DataStorage.tmpDir}`, uploadName);
    fs.writeFile(filePath, JSON.stringify(definitionLoader.toJSON(), null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            res.send({
                uploadName: uploadName
            });
        }
    });
};

export const removeDefinition = (req, res) => {
    const { definitionId, headType } = req.params;
    const series = req.body.series;

    const filePath = path.join(`${DataStorage.configDir}/${headType}/${series}`, `${definitionId}.def.json`);
    fs.unlink(filePath, (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            res.send({ status: 'ok' });
        }
    });
};

export const updateDefinition = (req, res) => {
    const { definitionId, headType } = req.params;
    const series = req.body.series;

    const definitionLoader = new DefinitionLoader();
    definitionLoader.loadDefinition(headType, definitionId, series);

    const { definition } = req.body;

    if (definition.name) {
        definitionLoader.updateName(definition.name);
    }
    if (definition.category) {
        definitionLoader.updateCategory(definition.category);
    }

    if (definition.settings) {
        definitionLoader.updateSettings(definition.settings);
    }

    const filePath = path.join(`${DataStorage.configDir}/${headType}/${series}`, `${definitionId}.def.json`);
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
    const { headType } = req.params;
    const { definitionId, uploadName, series } = req.body;
    const readFileSync = fs.readFileSync(`${DataStorage.tmpDir}/${uploadName}`, 'utf-8');
    let obj;
    try {
        obj = JSON.parse(readFileSync);
    } catch (e) {
        obj = {};
    }

    if (!obj.inherits || !fs.existsSync(`${DataStorage.configDir}/${headType}/${obj.inherits}.json`)) {
        obj.inherits = 'snapmaker2';
    }
    if (!obj.category) {
        obj.category = 'Custom';
    }

    if (!obj.metadata) {
        obj.metadata = {};
    }
    obj.metadata.readonly = false;

    const definitionLoader = new DefinitionLoader();
    try {
        definitionLoader.loadJSON(headType, definitionId, obj);
        const filePath = path.join(`${DataStorage.configDir}/${headType}/${series}`, `${definitionId}.def.json`);
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
