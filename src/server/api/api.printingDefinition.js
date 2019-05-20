import fs from 'fs';
import path from 'path';
import includes from 'lodash/includes';
import {
    ERR_BAD_REQUEST,
    ERR_INTERNAL_SERVER_ERROR,
    CURA_ENGINE_CONFIG_LINUX,
    CURA_ENGINE_CONFIG_WIN
} from '../constants';
import { loadDefinitionsByType, DefinitionLoader } from '../slicer';

let curaConfigDir = '';
if (process.platform === 'win32') {
    curaConfigDir = CURA_ENGINE_CONFIG_WIN;
} else if (process.platform === 'linux') {
    curaConfigDir = CURA_ENGINE_CONFIG_LINUX;
} else {
    curaConfigDir = '../CuraEngine/Config';
}
const CURA_CONFIG_DIR = curaConfigDir;
// const CURA_CONFIG_DIR = '../CuraEngine/Config';

export const getDefinition = (req, res) => {
    const { definitionId } = req.params;
    if (!definitionId) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "definitionId" is required.'
        });
        return;
    }

    const definitionLoader = new DefinitionLoader();
    definitionLoader.loadDefinition(definitionId);

    res.send({ definition: definitionLoader.toObject() });
};

export const getDefinitionsByType = (req, res) => {
    const { type } = req.params;
    if (!type) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "type" is required.'
        });
        return;
    }
    if (!includes(['quality', 'material'], type)) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "type" is invalid.'
        });
        return;
    }

    const definitions = loadDefinitionsByType(type);

    res.send({ definitions });
};

export const createDefinition = (req, res) => {
    const definition = req.body;

    const definitionLoader = new DefinitionLoader();
    definitionLoader.fromObject(definition);

    const filePath = path.join(CURA_CONFIG_DIR, definitionLoader.definitionId + '.def.json');
    fs.writeFile(filePath, JSON.stringify(definitionLoader.toJSON(), null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            const loader = new DefinitionLoader();
            loader.loadDefinition(definitionLoader.definitionId);
            res.send({ definition: loader.toObject() });
        }
    });
};

export const removeDefinition = (req, res) => {
    const { definitionId } = req.params;

    const filePath = path.join(CURA_CONFIG_DIR, definitionId + '.def.json');
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

    const definitionLoader = new DefinitionLoader();
    definitionLoader.loadDefinition(definitionId);

    const definition = req.body;

    if (definition.name) {
        definitionLoader.updateName(definition.name);
    }

    if (definition.settings) {
        definitionLoader.updateSettings(definition.settings);
    }

    const filePath = path.join(CURA_CONFIG_DIR, definitionId + '.def.json');
    fs.writeFile(filePath, JSON.stringify(definitionLoader.toJSON(), null, 2), 'utf8', (err) => {
        if (err) {
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            // load definition using new loader to avoid potential settings override issues
            res.send({ status: 'ok' });
        }
    });
};
