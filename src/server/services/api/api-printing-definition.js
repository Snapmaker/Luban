import fs from 'fs';
import path from 'path';
import { ERR_BAD_REQUEST, ERR_INTERNAL_SERVER_ERROR } from '../../constants';
import { loadQualityDefinitions, loadMaterialDefinitions, loadDefaultDefinitions, DefinitionLoader } from '../../slicer';
import DataStorage from '../../DataStorage';

const isDefaultQualityDefinition = (definitionId) => {
    return definitionId.indexOf('quality') !== -1
     && (definitionId.indexOf('fast_print') !== -1
     || definitionId.indexOf('high_quality') !== -1
     || definitionId.indexOf('normal_quality') !== -1
     );
};

/**
 * Get raw definition which is unparsed and override.
 */
export const getRawDefinition = (req, res) => {
    const { definitionId } = req.params;
    const series = isDefaultQualityDefinition(definitionId) ? req.query.series : '';
    if (!definitionId) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "definitionId" is required.'
        });
        return;
    }

    const filename = `${definitionId}.def.json`;
    const configDir = `${DataStorage.configDir}/${series}/${filename}`;
    const readFileSync = fs.readFileSync(configDir);
    const parse = JSON.parse(readFileSync);
    res.send({ filename: filename, definition: parse });
};

export const getDefinition = (req, res) => {
    const { definitionId } = req.params;
    const series = isDefaultQualityDefinition(definitionId) ? req.params.series : '';
    if (!definitionId) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "definitionId" is required.'
        });
        return;
    }

    const definitionLoader = new DefinitionLoader();
    definitionLoader.loadDefinition(definitionId, series);

    res.send({ definition: definitionLoader.toObject() });
};

export const getMaterialDefinitions = (req, res) => {
    const definitions = loadMaterialDefinitions();
    res.send({ definitions });
};

export const getQualityDefinitions = (req, res) => {
    const { series } = req.params;
    const definitions = loadQualityDefinitions(series);
    res.send({ definitions });
};

export const getDefaultDefinitions = (req, res) => {
    const { series } = req.params;
    const definitions = loadDefaultDefinitions(series);
    res.send({ definitions });
};

export const createDefinition = (req, res) => {
    const { definition } = req.body;
    const series = isDefaultQualityDefinition(definition.definitionId) ? req.body.series : '';

    const definitionLoader = new DefinitionLoader();
    definitionLoader.fromObject(definition);

    const filePath = path.join(`${DataStorage.configDir}/${series}`, `${definitionLoader.definitionId}.def.json`);
    fs.writeFile(filePath, JSON.stringify(definitionLoader.toJSON(), null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            const loader = new DefinitionLoader();
            loader.loadDefinition(definitionLoader.definitionId, series);
            res.send({ definition: loader.toObject() });
        }
    });
};

export const removeDefinition = (req, res) => {
    const { definitionId } = req.params;
    const series = isDefaultQualityDefinition(definitionId) ? req.body.series : '';

    const filePath = path.join(`${DataStorage.configDir}/${series}`, `${definitionId}.def.json`);
    fs.unlink(filePath, (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            res.send({ status: 'ok' });
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
