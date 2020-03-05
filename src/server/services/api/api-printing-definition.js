import fs from 'fs';
import path from 'path';
import { ERR_BAD_REQUEST, ERR_INTERNAL_SERVER_ERROR } from '../../constants';
import { loadQualityDefinitions, loadMaterialDefinitions, DefinitionLoader } from '../../slicer';
import DataStorage from '../../DataStorage';

const isQualityDefinition = (definitionId) => {
    return definitionId.indexOf('quality') !== -1;
};

export const getDefinition = (req, res) => {
    const { definitionId } = req.params;
    const series = isQualityDefinition(definitionId) ? req.body.series : '';
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

export const createDefinition = (req, res) => {
    const { definition } = req.body;
    const series = isQualityDefinition(definition.definitionId) ? req.body.series : '';

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
    const series = isQualityDefinition(definitionId) ? req.body.series : '';

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
    const series = isQualityDefinition(definitionId) ? req.body.series : '';

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
