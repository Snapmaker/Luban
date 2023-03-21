import * as fs from 'fs-extra';
import path from 'path';
import {
    DEFINITION_ACTIVE,
    DEFINITION_ACTIVE_FINAL,
    DEFINITION_SNAPMAKER_EXTRUDER_0,
    DEFINITION_SNAPMAKER_EXTRUDER_1,
    ERR_BAD_REQUEST,
    ERR_INTERNAL_SERVER_ERROR,
    ERR_NOT_FOUND,
    HEAD_PRINTING,
    KEY_DEFAULT_CATEGORY_CUSTOM,
    KEY_DEFAULT_CATEGORY_DEFAULT
} from '../../constants';
import { getParameterKeys } from '../../slicer/definition';
import { DefinitionLoader, loadAllSeriesDefinitions, loadDefinitionsByPrefixName } from '../../slicer';
import DataStorage from '../../DataStorage';
import logger from '../../lib/logger';

const log = logger('service:profile-definitions');

/**
 * Get raw definition which is unparsed and override.
 */
export const getRawDefinition = (req, res) => {
    const { definitionId } = req.params;
    const configPath = req.query.configPath;
    if (!definitionId) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "definitionId" is required.'
        });
        return;
    }

    const filename = `${definitionId}.def.json`;
    const configDir = `${DataStorage.configDir}/${configPath}/${filename}`;
    try {
        const readFileSync = fs.readFileSync(configDir);
        const parse = JSON.parse(readFileSync);
        res.send({ filename: filename, definition: parse });
    } catch (e) {
        log.error(e);
        res.status(ERR_INTERNAL_SERVER_ERROR).send({ msg: e.message });
    }
};

const isPublicProfile = (definitionId) => {
    return [
        DEFINITION_ACTIVE,
        DEFINITION_ACTIVE_FINAL,
        DEFINITION_SNAPMAKER_EXTRUDER_0,
        DEFINITION_SNAPMAKER_EXTRUDER_1,
    ].includes(definitionId);
};

export const getDefinition = (req, res) => {
    const { definitionId, headType } = req.params;
    const configPath = req.query.configPath;
    if (!definitionId) {
        res.status(ERR_BAD_REQUEST).send({
            err: 'Parameter "definitionId" is required.'
        });
        return;
    }

    const definitionLoader = new DefinitionLoader();

    let loadSuccess = false;
    if (isPublicProfile(definitionId)) {
        loadSuccess = definitionLoader.loadDefinition(headType, definitionId);
    } else {
        loadSuccess = definitionLoader.loadDefinition(headType, definitionId, configPath);
    }

    if (loadSuccess) {
        res.send({ definition: definitionLoader.toObject() });
    } else {
        res.status(ERR_NOT_FOUND).send({ msg: 'Definition not found.' });
    }
};


export const getDefinitionsByPrefixName = (req, res) => {
    const { headType, prefix } = req.params;
    const { configPath } = req.query;
    const definitions = loadDefinitionsByPrefixName(headType, prefix, configPath);
    res.send({ definitions });
};


export const getDefaultDefinitions = (req, res) => {
    const { headType } = req.params;
    const { configPath } = req.query;
    const definitions = loadAllSeriesDefinitions(true, headType, configPath);
    res.send({ definitions });
};


export const getConfigDefinitions = (req, res) => {
    const { headType } = req.params;
    const { configPath } = req.query;
    const definitions = loadAllSeriesDefinitions(false, headType, configPath);
    res.send({ definitions });
};

const fsWriteFile = (filePath, data, res, callback) => {
    fs.writeFile(filePath, data, 'utf8', (err) => {
        if (err) {
            log.error(err);
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            callback();
        }
    });
};
export const createDefinition = async (req, res) => {
    const { headType } = req.params;
    const { definition } = req.body;

    const definitionLoader = new DefinitionLoader();
    definitionLoader.fromObject(definition);
    const configPath = isPublicProfile(definitionLoader.definitionId) ? headType : (req.body.configPath ?? '');

    const filePath = path.join(`${DataStorage.configDir}/${configPath}`, `${definitionLoader.definitionId}.def.json`);
    const backupPath = path.join(`${DataStorage.activeConfigDir}/${configPath}`, `${definitionLoader.definitionId}.def.json`);
    const data = JSON.stringify(definitionLoader.toJSON(), null, 2);
    if (!fs.existsSync(backupPath)) {
        try {
            await fs.copy(DataStorage.configDir, DataStorage.activeConfigDir);
        } catch (e) {
            log.error(e);
            log.error(`Failed to backup config files: ${DataStorage.configDir} to ${DataStorage.activeConfigDir}`);
        }
    }
    const callback = () => {
        const loader = new DefinitionLoader();
        loader.loadDefinition(headType, definitionLoader.definitionId, configPath);
        // res.send({ definition: loader.toObject() });
        fsWriteFile(backupPath, data, res, (err) => {
            if (err) {
                return res.send({ definition: loader.toObject(), msg: 'Back up failed!' });
            } else {
                return res.send({ definition: loader.toObject(), msg: 'Back up success!' });
            }
        });
    };
    fsWriteFile(filePath, data, res, callback);
};


export const updateDefaultDefinition = (req, res) => {
    const { definitionId, headType } = req.params;
    const configPath = req.body.configPath;

    const definitionLoader = new DefinitionLoader();
    if (isPublicProfile(definitionId)) {
        definitionLoader.loadDefaultDefinition(headType, definitionId);
    } else {
        definitionLoader.loadDefaultDefinition(headType, definitionId, configPath);
    }
    const { definition } = req.body;

    // Remove for 3d printing profile
    if (definition.settings) {
        if (headType !== HEAD_PRINTING) {
            definitionLoader.updateSettings(definition.settings);
        } else {
            definitionLoader.updateSettings(definition.settings, false);
        }
    }

    let filePath = '';
    if (isPublicProfile(definitionId)) {
        filePath = path.join(`${DataStorage.defaultConfigDir}/${headType}`, `${definitionId}.def.json`);
    } else {
        filePath = path.join(`${DataStorage.defaultConfigDir}/${configPath}`, `${definitionId}.def.json`);
    }
    const data = JSON.stringify(definitionLoader.toJSON(), null, 2);
    fs.writeFile(filePath, data, 'utf8', (err) => {
        if (err) {
            log.error(err);
            res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            res.send({ status: 'ok', msg: 'Update success!' });
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
            log.error(err);
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
    const { definitionId } = req.params;
    const configPath = req.body.configPath;

    const filePath = path.join(`${DataStorage.configDir}/${configPath}`, `${definitionId}.def.json`);
    const backupPath = path.join(`${DataStorage.activeConfigDir}/${configPath}`, `${definitionId}.def.json`);
    fs.unlink(filePath, (err) => {
        if (err) {
            log.error(err);
            return res.status(ERR_INTERNAL_SERVER_ERROR).send({ err });
        } else {
            fs.unlink(backupPath, (unlinkErr) => {
                if (unlinkErr) {
                    log.error(unlinkErr);
                    return res.send({ status: 'ok', msg: 'Back up Remove failed!' });
                } else {
                    return res.send({ status: 'ok', msg: 'Back up Remove success!' });
                }
            });
            return null;
        }
    });
};

export const updateDefinition = async (req, res) => {
    const { definitionId, headType } = req.params;
    const configPath = req.body.configPath;

    const definitionLoader = new DefinitionLoader();
    if (isPublicProfile(definitionId)) {
        definitionLoader.loadDefinition(headType, definitionId);
    } else {
        definitionLoader.loadDefinition(headType, definitionId, configPath);
    }

    const { definition } = req.body;
    if (definition.name) {
        definitionLoader.updateName(definition.name);
    }

    // Because importing a custom profile does not need to support multiple languages. Therefore, relevant reset should be supported

    if (definition.category !== undefined) {
        definitionLoader.updateCategory(definition.category);
    }

    if (definition.i18nCategory !== undefined) {
        definitionLoader.updateI18nCategory(definition.i18nCategory);
    }

    if (definition.i18nName !== undefined) {
        definitionLoader.updateI18nName(definition.i18nName);
    }

    // Remove for 3d printing profile
    if (definition.settings) {
        definitionLoader.updateSettings(definition.settings);
    }

    let filePath = '';
    let activeRecoverPath = '';
    if (isPublicProfile(definitionId)) {
        filePath = path.join(`${DataStorage.configDir}/${headType}`, `${definitionId}.def.json`);
        activeRecoverPath = path.join(`${DataStorage.activeConfigDir}/${headType}`, `${definitionId}.def.json`);
    } else {
        filePath = path.join(`${DataStorage.configDir}/${configPath}`, `${definitionId}.def.json`);
        activeRecoverPath = path.join(`${DataStorage.activeConfigDir}/${configPath}`, `${definitionId}.def.json`);
    }
    if (!fs.existsSync(DataStorage.activeConfigDir)) {
        try {
            await fs.copy(DataStorage.configDir, DataStorage.activeConfigDir);
        } catch (e) {
            log.error(e);
            log.error(`Failed to backup config files: ${DataStorage.configDir} to ${DataStorage.activeConfigDir}`);
        }
    }

    const data = JSON.stringify(definitionLoader.toJSON(), null, 2);
    const callback = () => {
        fsWriteFile(activeRecoverPath, data, res, (err) => {
            if (err) {
                return res.send({ status: 'ok', msg: 'Back up failed!' });
            } else {
                return res.send({ status: 'ok', msg: 'Back up success!' });
            }
        });
    };
    fsWriteFile(filePath, data, res, callback);
};


const isSourceFormDefault = (obj) => {
    return obj.i18nCategory
        && obj.i18nCategory !== KEY_DEFAULT_CATEGORY_CUSTOM
        && obj.i18nCategory !== KEY_DEFAULT_CATEGORY_DEFAULT;
};

export const uploadDefinition = (req, res) => {
    const { headType } = req.params;
    const { definitionId, uploadName, configPath } = req.body;
    const readFileSync = fs.readFileSync(`${DataStorage.tmpDir}/${uploadName}`, 'utf-8');
    let obj;
    try {
        obj = JSON.parse(readFileSync);
        // Compatible with profiles exported from older versions
        if (!isSourceFormDefault(obj)) {
            obj.category = '';
            obj.i18nCategory = '';
            obj.i18nName = '';
        }
    } catch (e) {
        obj = {};
    }

    if (!obj.inherits || !fs.existsSync(`${DataStorage.configDir}/${headType}/${obj.inherits}.json`)) {
        obj.inherits = 'snapmaker2';
    }

    if (!obj.metadata) {
        obj.metadata = {};
    }
    obj.metadata.readonly = false;

    const definitionLoader = new DefinitionLoader();
    try {
        definitionLoader.loadJSON(headType, definitionId, obj);
        const filePath = path.join(`${DataStorage.configDir}/${configPath}`, `${definitionId}.def.json`);
        const backupPath = path.join(`${DataStorage.activeConfigDir}/${configPath}`, `${definitionId}.def.json`);
        const data = JSON.stringify(definitionLoader.toJSON(), null, 2);
        const callback = () => {
            fsWriteFile(backupPath, data, res, (err) => {
                if (err) {
                    return res.send({ status: 'ok', definition: definitionLoader.toObject(), msg: 'Backup failed!' });
                } else {
                    return res.send({ status: 'ok', definition: definitionLoader.toObject(), msg: 'Back up success!' });
                }
            });
        };
        fsWriteFile(filePath, data, res, callback);
    } catch (e) {
        res.status(ERR_INTERNAL_SERVER_ERROR).send({ err: e });
    }
};

export const getPresetParameterKeys = (req, res) => {
    const data = getParameterKeys();
    res.send(data);
};


export const getParameterDoc = (req, res) => {
    try {
        const lang = req.query.lang;
        const { category, key } = req.params;

        const langDir = lang.toUpperCase() === 'ZH-CN' ? 'CN' : lang.toUpperCase();

        const fileRelativePath = `${langDir}/${category}/${key}.md`;
        const filePath = `${DataStorage.getParameterDocumentDir()}/${fileRelativePath}`;

        let content;
        if (fs.existsSync(filePath)) {
            content = fs.readFileSync(`${filePath}`, 'utf-8');
        } else if (lang !== 'en') {
            log.info(`Request: "${fileRelativePath}"\nNo documentation was found for the user's language ${lang}. An English version was given.`);

            const filePathEN = `${DataStorage.getParameterDocumentDir()}/EN/${category}/${key}.md`;
            content = fs.readFileSync(filePathEN, 'utf-8');
        }

        res.status(200).send({
            content: content,
            imagePath: `${DataStorage.getParameterDocumentDir()}/`
        });
    } catch (e) {
        log.error(e);

        res.status(500).send({
            msg: 'No such path',
        });
    }
};
