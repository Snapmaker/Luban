import fs from 'fs';
import path from 'path';
import { ERR_BAD_REQUEST, ERR_INTERNAL_SERVER_ERROR, DEFINITION_SNAPMAKER_EXTRUDER_0, DEFINITION_SNAPMAKER_EXTRUDER_1, DEFINITION_ACTIVE, DEFINITION_ACTIVE_FINAL, KEY_DEFAULT_CATEGORY_CUSTOM, KEY_DEFAULT_CATEGORY_DEFAULT } from '../../constants';
import { loadDefinitionsByPrefixName, loadAllSeriesDefinitions, DefinitionLoader } from '../../slicer';
import DataStorage from '../../DataStorage';
import logger from '../../lib/logger';

const log = logger('service:profile-definitions');

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
        DEFINITION_SNAPMAKER_EXTRUDER_0, DEFINITION_SNAPMAKER_EXTRUDER_1
    ].includes(definitionId);
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

    if (isPublicProfile(definitionId)) {
        definitionLoader.loadDefinition(headType, definitionId);
    } else {
        definitionLoader.loadDefinition(headType, definitionId, series);
    }
    res.send({ definition: definitionLoader.toObject() });
};


export const getDefinitionsByPrefixName = (req, res) => {
    // const definitions = loadMaterialDefinitions();
    const { headType, prefix, series } = req.params;
    const definitions = loadDefinitionsByPrefixName(headType, prefix, series);
    const filePath = path.join(`${DataStorage.tmpDir}`, 'jt.json');
    fs.writeFileSync(filePath, JSON.stringify(definitions[0]), 'utf-8');
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
    delete (definition.typeOfPrinting);
    definitionLoader.fromObject(definition);
    const series = isPublicProfile(definitionLoader.definitionId) ? '' : (req.body.series ?? '');

    const filePath = path.join(`${DataStorage.configDir}/${headType}/${series}`, `${definitionLoader.definitionId}.def.json`);
    const backupPath = path.join(`${DataStorage.activeConfigDir}/${headType}/${series}`, `${definitionLoader.definitionId}.def.json`);
    const data = JSON.stringify(definitionLoader.toJSON(), null, 2);
    if (!fs.existsSync(backupPath)) {
        try {
            await DataStorage.copyDirForInitSlicer({
                srcDir: DataStorage.configDir,
                dstDir: DataStorage.activeConfigDir,
                overwriteTag: true,
                inherit: true
            });
        } catch (e) {
            log.error('copyDirForInitSlicer', e.message);
        }
    }
    const callback = () => {
        const loader = new DefinitionLoader();
        loader.loadDefinition(headType, definitionLoader.definitionId, series);
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
    const { definitionId, headType } = req.params;
    const series = req.body.series;

    const filePath = path.join(`${DataStorage.configDir}/${headType}/${series}`, `${definitionId}.def.json`);
    const backupPath = path.join(`${DataStorage.activeConfigDir}/${headType}/${series}`, `${definitionId}.def.json`);
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
    const series = req.body.series;

    const definitionLoader = new DefinitionLoader();
    if (isPublicProfile(definitionId)) {
        definitionLoader.loadDefinition(headType, definitionId);
    } else {
        definitionLoader.loadDefinition(headType, definitionId, series);
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

    if (definition.settings) {
        definitionLoader.updateSettings(definition.settings);
    }

    let filePath = '';
    let activeRecoverPath = '';
    if (isPublicProfile(definitionId)) {
        filePath = path.join(`${DataStorage.configDir}/${headType}`, `${definitionId}.def.json`);
        activeRecoverPath = path.join(`${DataStorage.activeConfigDir}/${headType}`, `${definitionId}.def.json`);
    } else {
        filePath = path.join(`${DataStorage.configDir}/${headType}/${series}`, `${definitionId}.def.json`);
        activeRecoverPath = path.join(`${DataStorage.activeConfigDir}/${headType}/${series}`, `${definitionId}.def.json`);
    }
    if (!fs.existsSync(DataStorage.activeConfigDir)) {
        try {
            await DataStorage.copyDirForInitSlicer({
                srcDir: DataStorage.configDir,
                dstDir: DataStorage.activeConfigDir,
                overwriteTag: true,
                inherit: true
            });
        } catch (e) {
            log.error(e);
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
    const { definitionId, uploadName, series } = req.body;
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
        const filePath = path.join(`${DataStorage.configDir}/${headType}/${series}`, `${definitionId}.def.json`);
        const backupPath = path.join(`${DataStorage.activeConfigDir}/${headType}/${series}`, `${definitionId}.def.json`);
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
