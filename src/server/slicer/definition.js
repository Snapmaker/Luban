import fs from 'fs';
import path from 'path';
import { includes, isNil, isUndefined, orderBy } from 'lodash';
import DataStorage from '../DataStorage';
import pkg from '../../package.json';
import logger from '../lib/logger';
import { ConfigV1Regex, ConfigV1Suffix } from '../constants';

const log = logger('service:definition');

const SETTING_FIELDS = [
    'label', 'description', 'type', 'options', 'unit', 'enabled', 'default_value', 'value', 'visible', 'calcu_value',
    'min', 'max', 'limit_to_extruder',
    // Snapmaker extended fields:
    'sm_value'
];
const allSettingNameWithType = {
    'material': new Set(),
    'quality': new Set()
};

allSettingNameWithType.quality.add('machine_nozzle_size');

allSettingNameWithType.quality.add('extruders_enabled_count');
allSettingNameWithType.material.add('extruders_enabled_count');

const materialRegex = /^material.*/;
const qualityRegex = /^quality.*/;

const DEFAULT_PREDEFINED_ID = {
    'printing': 'quality.fast_print.def.json',
    'cnc': 'tool.default_CVbit.def.json',
    'laser': 'present.default_CUT.def.json',
    '10w-laser': 'basswood.cutting_1.5mm.def.json'
};
const extruderProfileArr = new Set();

const materialProfileArr = new Set();

const qualityProfileArr = new Set();

const printingProfileLevel = {};

// [category: string]: Array<string>
// category -> category keys
const materialProfileLevel = {};

export class DefinitionLoader {
    definitionId = '';

    name = '';
    // default name key
    i18nName = '';

    category = '';
    // default category key
    i18nCategory = '';

    inherits = '';

    settings = {};

    ownKeys = new Set();

    metadata = {};

    isRecommended = false;

    /**
     * Load definition with ID {definitionId}.
     *
     * @param headType
     * @param definitionId
     * @param configPath
     */
    loadDefinition(headType, definitionId, configPath) {
        if (!this.definitionId) {
            this.definitionId = definitionId;
        }

        const suffix = ConfigV1Suffix;
        const filePath = configPath
            ? path.join(`${DataStorage.configDir}/${configPath}`, `${definitionId}${suffix}`)
            : path.join(`${DataStorage.configDir}/${headType}`, `${definitionId}${suffix}`);

        // in case of JSON parse error, set default json inherits from snapmaker2.def.json
        let json = {
            'name': 'Snapmaker Default',
            'version': pkg.version,
            'inherits': 'snapmaker2'
        };
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            json = JSON.parse(data);
            this.loadJSON(headType, definitionId, json);
            return true;
        } catch (e) {
            log.error(`Failed to read JSON file: ${filePath}`);
            log.error(e);
            return false;
        }
    }

    loadDefaultDefinition(headType, definitionId, configPath) {
        if (!this.definitionId) {
            this.definitionId = definitionId;
        }
        const suffix = ConfigV1Suffix;
        const filePath = configPath
            ? path.join(`${DataStorage.defaultConfigDir}/${configPath}`, `${definitionId}${suffix}`)
            : path.join(`${DataStorage.defaultConfigDir}/${headType}`, `${definitionId}${suffix}`);

        // in case of JSON parse error, set default json inherits from snapmaker2.def.json
        let json = {
            'name': 'Snapmaker Default',
            'version': pkg.version,
            'inherits': 'snapmaker2'
        };
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            json = JSON.parse(data);
            this.loadJSON(headType, definitionId, json);
            return true;
        } catch (e) {
            log.error(`Default JSON Syntax error of: ${definitionId}`);
            return false;
        }
    }

    loadJSON(headType, definitionId, json) {
        if (!this.definitionId) {
            this.definitionId = definitionId;
        }
        if (json.inherits) {
            this.loadDefinition(headType, json.inherits);
            this.inherits = json.inherits;
        }

        // metadata
        if (json.metadata) {
            this.metadata = json.metadata;
        }

        if (json.name) {
            this.name = json.name;
        }
        if (json.i18nName) {
            this.i18nName = json.i18nName;
        }
        if (json.category) {
            this.category = json.category;
        }
        if (json.i18nCategory) {
            this.i18nCategory = json.i18nCategory;
        }
        if (json.typeOfPrinting) {
            this.typeOfPrinting = json.typeOfPrinting;
        }
        if (json.qualityType) {
            this.qualityType = json.qualityType;
        }
        if (!isNil(json.isRecommended)) {
            this.isRecommended = json.isRecommended;
        }

        // settings
        if (json.settings) {
            this.loadJSONSettings(definitionId, json.settings);
        }

        if (json.overrides) {
            this.loadJSONSettings(definitionId, json.overrides);
        }
    }

    loadJSONSettings(definitionId, json, zIndex = -2, parentKey, _mainCategory, _smallCategory) {
        zIndex++;
        let mainCategory = _mainCategory;
        let smallCategory = _smallCategory;
        if (definitionId === 'snapmaker_modify_0') {
            for (const key of Object.keys(json)) {
                const setting = json[key];
                if (setting.type === 'mainCategory') {
                    mainCategory = key;
                } else if (setting.type === 'category') {
                    smallCategory = key;
                } else {
                    this.settings[key] = this.settings[key] || {};
                    this.settings[key].childKey = this.settings[key].childKey || [];
                    this.settings[key].from = definitionId;
                    this.settings[key].isLeave = (setting.children === undefined);
                    this.settings[key].filter = this.settings[key].filter ? this.settings[key].filter : (setting.filter || ['all']);

                    const isMesh = setting.settable_per_mesh || false;
                    const isExtruder = setting.settable_per_extruder || false;
                    this.settings[key].settable_per_extruder = this.settings[key].settable_per_extruder || isExtruder;
                    this.settings[key].settable_per_mesh = this.settings[key].settable_per_mesh || isMesh;

                    if (mainCategory === 'material' && zIndex === 1) {
                        materialProfileLevel[smallCategory] = materialProfileLevel[smallCategory] || [];
                        if (!includes(materialProfileLevel[smallCategory], key)) {
                            materialProfileLevel[smallCategory] = materialProfileLevel[smallCategory].concat(key);
                        }
                    } else if (mainCategory === 'quality' && zIndex === 1) {
                        printingProfileLevel[smallCategory] = printingProfileLevel[smallCategory] || [];
                        if (!includes(printingProfileLevel[smallCategory], key)) {
                            printingProfileLevel[smallCategory] = printingProfileLevel[smallCategory].concat(key);
                        }
                    }
                    if (parentKey && !includes(this.settings[parentKey].childKey, key)) {
                        this.settings[parentKey].childKey = this.settings[parentKey].childKey.concat(key);
                    }
                    if (definitionId === this.definitionId && !this.ownKeys.has(key)) {
                        this.ownKeys.add(key);
                    }

                    // read regular fields and overwrite
                    for (const field of SETTING_FIELDS) {
                        if (setting[field] !== undefined) {
                            this.settings[key][field] = setting[field];
                        }
                    }
                    if (mainCategory === 'quality') {
                        qualityProfileArr.add(key);
                        allSettingNameWithType[mainCategory].add(key);
                    }
                    if (mainCategory === 'material') {
                        materialProfileArr.add(key);
                        extruderProfileArr.add(key);
                        allSettingNameWithType[mainCategory].add(key);
                    }
                    // extruder parameters could come from both quality & material main categories
                    if (setting.settable_per_extruder) {
                        extruderProfileArr.add(key);
                    }
                    if (setting.limit_to_extruder) {
                        extruderProfileArr.add(key);
                    }
                    if (isUndefined(this.settings[key].zIndex)) {
                        this.settings[key].zIndex = zIndex;
                    }
                }

                if (setting.children) {
                    this.loadJSONSettings(
                        definitionId,
                        setting.children,
                        zIndex,
                        (setting.type === 'category' || setting.type === 'mainCategory') ? '' : key,
                        mainCategory,
                        smallCategory,
                    );
                }
            }
            zIndex--;
        } else {
            for (const key of Object.keys(json)) {
                const setting = json[key];
                if (setting.type !== 'category') {
                    this.settings[key] = this.settings[key] || {};
                    this.settings[key].from = definitionId;
                    this.settings[key].isLeave = (setting.children === undefined);

                    if (definitionId === 'fdmextruder') {
                        const isMesh = setting.settable_per_mesh || false;
                        const isExtruder = setting.settable_per_extruder || false;
                        this.settings[key].settable_per_extruder = this.settings[key].settable_per_extruder || isExtruder;
                        this.settings[key].settable_per_mesh = this.settings[key].settable_per_mesh || isMesh;
                    }

                    if (definitionId === this.definitionId && !this.ownKeys.has(key)) {
                        this.ownKeys.add(key);
                    }

                    for (const field of SETTING_FIELDS) {
                        if (setting[field] !== undefined) {
                            this.settings[key][field] = setting[field];
                        }
                    }

                    if (definitionId === 'fdmextruder') {
                        extruderProfileArr.add(key);
                    }
                }
                if (setting.children) {
                    this.loadJSONSettings(definitionId, setting.children);
                }
            }
        }
    }

    toJSON() {
        const overrides = {};
        if (materialRegex.test(this.definitionId)) {
            this.ownKeys = allSettingNameWithType.material;
        } else if (qualityRegex.test(this.definitionId)) {
            this.ownKeys = allSettingNameWithType.quality;
        }
        for (const key of this.ownKeys) {
            if (this.settings[key]) {
                overrides[key] = {
                    default_value: this.settings[key].default_value
                };
            }
        }

        return {
            version: pkg.version,
            name: this.name,
            category: this.category,
            i18nName: this.i18nName,
            i18nCategory: this.i18nCategory,
            typeOfPrinting: this.typeOfPrinting,
            qualityType: this.qualityType,
            isRecommended: this.isRecommended,
            inherits: this.inherits,
            metadata: this.metadata,
            overrides
        };
    }

    toObject() {
        return {
            definitionId: this.definitionId,
            name: this.name,
            i18nName: this.i18nName,
            isRecommended: this.isRecommended,
            category: this.category,
            i18nCategory: this.i18nCategory,
            inherits: this.inherits,
            settings: this.settings,
            metadata: this.metadata,
            typeOfPrinting: this.typeOfPrinting,
            qualityType: this.qualityType,
            ownKeys: Array.from(this.ownKeys),
        };
    }

    fromObject(object) {
        this.definitionId = object.definitionId;
        this.name = object.name;
        this.category = object.category;
        this.i18nCategory = object.i18nCategory;
        this.inherits = object.inherits;
        this.typeOfPrinting = object.typeOfPrinting;
        this.qualityType = object.qualityType;
        this.ownKeys = new Set(object.ownKeys);
        this.settings = object.settings;
        this.metadata = object.metadata;
    }

    updateName(name) {
        this.name = name;
    }

    updateCategory(category) {
        this.category = category;
    }

    updateI18nName(i18nName) {
        this.i18nName = i18nName;
    }

    updateI18nCategory(i18nCategory) {
        this.i18nCategory = i18nCategory;
    }

    updateSettings(settings, shouldAddOwnKeys = true) {
        if (shouldAddOwnKeys) {
            for (const key of Object.keys(settings)) {
                this.ownKeys.add(key);
            }
        }
        this.settings = {
            ...this.settings,
            ...settings
        };
    }
}

function writeDefinition(filename, configPath, definitionLoader) {
    const filePath = path.join(DataStorage.configDir, configPath, filename);
    fs.writeFile(filePath, JSON.stringify(definitionLoader.toJSON(), null, 2), 'utf8', (err) => {
        if (err) {
            log.error(`Failed to write definition: err=${JSON.stringify(err)}`);
        }
    });
}


/**
 * Load Definition by filename.
 *
 * TODO: Deal with load failure
 *
 * @param headType
 * @param filename
 * @param configPath
 * @param isDefault
 * @returns {DefinitionLoader}
 */
export function loadDefinitionLoaderByFilename(headType, filename, configPath, isDefault = false) {
    let definitionId = '';
    if (ConfigV1Regex.test(filename)) {
        definitionId = filename.substr(0, filename.length - 9);
    }
    const definitionLoader = new DefinitionLoader();
    if (isDefault) {
        const success = definitionLoader.loadDefaultDefinition(headType, definitionId, configPath);
        if (!success) {
            return null;
        }
    } else {
        const success = definitionLoader.loadDefinition(headType, definitionId, configPath);
        if (!success) {
            return null;
        }
    }

    return definitionLoader;
}

export function loadDefinitionsByRegex(headType, configPath, regex, defaultId) {
    const defaultDefinitionLoader = loadDefinitionLoaderByFilename(headType, defaultId, configPath);

    const configDir = path.join(DataStorage.configDir, configPath);

    if (!fs.existsSync(configDir)) {
        return [];
    }

    const filenames = fs.readdirSync(configDir);

    const definitions = [];
    for (const filename of filenames) {
        if (!regex.test(filename)) {
            continue;
        }

        const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, configPath);
        if (!definitionLoader) {
            continue;
        }

        // add own keys
        // Correct definition
        // TODO: Maybe add this to migration, not here...
        if (defaultDefinitionLoader && !definitionLoader.isRecommended && definitionLoader.name) {
            const ownKeys = Array.from(defaultDefinitionLoader.ownKeys).filter(e => !definitionLoader.ownKeys.has(e));
            if (ownKeys && ownKeys.length > 0) {
                for (const ownKey of ownKeys) {
                    definitionLoader.ownKeys.add(ownKey);
                }
                writeDefinition(filename, configPath, definitionLoader);
            }
        }

        definitions.push(definitionLoader.toObject());
    }

    if (headType === 'printing') {
        return orderBy(definitions, ['isRecommended', 'category'], ['asc', 'desc']);
    }
    return definitions;
}


export function loadDefinitionsByPrefixName(headType, prefix = 'material', configPath) {
    let defaultId;
    /* eslint-disable-next-line */
    const regex = new RegExp(`^${prefix}\.([A-Za-z0-9_]+)\.(([A-Za-z0-9_\.]+)?)def\.json$`);
    if (prefix === 'material') {
        defaultId = 'material.pla.def.json';
    } else if (prefix === 'quality') {
        defaultId = 'quality.fast_print.def.json';
    }
    return loadDefinitionsByRegex(headType, configPath, regex, defaultId);
}

export function loadAllSeriesDefinitions(isDefault = false, headType, configPath = 'A150') {
    // TODO: series name?
    const _headType = (headType === 'laser' && includes(configPath, '10w')) ? '10w-laser' : headType;
    const predefined = DEFAULT_PREDEFINED_ID[_headType];
    const definitions = [];

    const configDir = isDefault ? `${DataStorage.defaultConfigDir}/${configPath}` : `${DataStorage.configDir}/${configPath}`;
    let defaultFilenames = [];
    try {
        defaultFilenames = fs.readdirSync(configDir);
    } catch (e) {
        log.error(`Failed to load files in folder ${configDir}`);
        log.error(e);
    }

    if (isDefault) {
        for (const filename of defaultFilenames) {
            if (filename !== 'machine.def.json' && ConfigV1Regex.test(filename)) {
                const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, configPath, isDefault);
                definitions.push(definitionLoader.toObject());
            }
        }
    } else {
        const defaultDefinitionLoader = loadDefinitionLoaderByFilename(headType, predefined, configPath);
        for (const filename of defaultFilenames) {
            if (ConfigV1Regex.test(filename)) {
                try {
                    const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, configPath, isDefault);
                    if (!definitionLoader.isRecommended && defaultDefinitionLoader) {
                        const ownKeys = Array.from(defaultDefinitionLoader.ownKeys).filter(e => !definitionLoader.ownKeys.has(e));
                        if (ownKeys && ownKeys.length > 0) {
                            for (const ownKey of ownKeys) {
                                definitionLoader.ownKeys.add(ownKey);
                            }
                            writeDefinition(filename, configPath, definitionLoader);
                        }
                    }
                    definitions.push(definitionLoader.toObject());
                } catch (e) {
                    log.error(e);
                }
            }
        }
    }

    return definitions;
}

export function getParameterKeys() {
    return {
        qualityProfileArr: Array.from(qualityProfileArr),
        materialProfileArr: Array.from(materialProfileArr),
        extruderProfileArr: Array.from(extruderProfileArr),
        printingProfileLevel: printingProfileLevel,
        materialProfileLevel: materialProfileLevel,
    };
}
