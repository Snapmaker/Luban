import fs from 'fs';
import path from 'path';
import includes from 'lodash/includes';
import DataStorage from '../DataStorage';
import logger from '../lib/logger';
import { CncV1Regex, CncV2Regex } from '../constants';

const log = logger('definition');

const SETTING_FIELDS = [
    'label', 'description', 'type', 'options', 'unit', 'enabled', 'default_value', 'value', 'enabled',
    // Snapmaker extended fields:
    'sm_value'
];

export class DefinitionLoader {
    definitionId = '';

    name = '';

    inherits = '';

    settings = {};

    ownKeys = new Set();

    metadata = {};

    loadDefinition(headType, definitionId, configPath) {
        // console.log('loadDefinition', headType, definitionId, configPath);
        if (!this.definitionId) {
            this.definitionId = definitionId;
        }
        const filePath = configPath ? path.join(`${DataStorage.configDir}/${headType}/${configPath}`, `${definitionId}.def.json`)
            : path.join(`${DataStorage.configDir}/${headType}`, `${definitionId}.def.json`);
        // in case of JSON parse error, set default json inherits from snapmaker2.def.json
        let json = {
            'name': 'Snapmaker Default',
            'version': 2,
            'inherits': 'snapmaker2'
        };
        try {
            console.log('filePath', filePath);
            const data = fs.readFileSync(filePath, 'utf8');
            json = JSON.parse(data);
        } catch (e) {
            console.error(`JSON Syntax error of: ${definitionId}`);
        }

        this.loadJSON(headType, definitionId, json);
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

        // settings
        if (json.settings) {
            this.loadJSONSettings(definitionId, json.settings);
        }

        if (json.overrides) {
            this.loadJSONSettings(definitionId, json.overrides);
        }
    }

    loadJSONSettings(definitionId, json) {
        for (const key of Object.keys(json)) {
            const setting = json[key];

            if (setting.type !== 'category') {
                this.settings[key] = this.settings[key] || {};
                this.settings[key].from = definitionId;
                this.settings[key].isLeave = (setting.children === undefined);

                if (definitionId === this.definitionId && !this.ownKeys.has(key)) {
                    this.ownKeys.add(key);
                }

                for (const field of SETTING_FIELDS) {
                    if (setting[field] !== undefined) {
                        this.settings[key][field] = setting[field];
                    }
                }
            }
            if (setting.children) {
                this.loadJSONSettings(definitionId, setting.children);
            }
        }
    }

    toJSON() {
        const overrides = {};

        for (const key of this.ownKeys) {
            overrides[key] = {
                default_value: this.settings[key].default_value
            };
        }

        return {
            version: 1,
            name: this.name,
            inherits: this.inherits,
            metadata: this.metadata,
            overrides
        };
    }

    toObject() {
        return {
            definitionId: this.definitionId,
            name: this.name,
            inherits: this.inherits,
            settings: this.settings,
            metadata: this.metadata,
            ownKeys: Array.from(this.ownKeys)
        };
    }

    fromObject(object) {
        this.definitionId = object.definitionId;
        this.name = object.name;
        this.inherits = object.inherits;
        this.ownKeys = new Set(object.ownKeys);
        this.settings = object.settings;
        this.metadata = object.metadata;
    }

    updateName(name) {
        this.name = name;
    }

    updateSettings(settings) {
        for (const key of Object.keys(settings)) {
            this.ownKeys.add(key);
        }
        this.settings = {
            ...this.settings,
            ...settings
        };
    }
}

function writeDefinition(headType, filename, series, definitionLoader) {
    const filePath = path.join(DataStorage.configDir, headType, series, filename);
    fs.writeFile(filePath, JSON.stringify(definitionLoader.toJSON(), null, 2), 'utf8', (err) => {
        if (err) {
            log.error(`Failed to write definition: err=${JSON.stringify(err)}`);
        }
    });
}

export function loadDefinitionLoaderByFilename(headType, filename, configPath) {
    let definitionId = '';
    if (CncV1Regex.test(filename)) {
        definitionId = filename.substr(0, filename.length - 9);
    } else if (CncV2Regex.test(filename)) {
        definitionId = filename.substr(0, filename.length - 11);
    }
    const definitionLoader = new DefinitionLoader();
    definitionLoader.loadDefinition(headType, definitionId, configPath);

    return definitionLoader;
}

export function loadMaterialDefinitions(headType, configPath) {
    const predefined = [];

    const regex = /^material.([A-Za-z0-9_]+).def.json$/;
    const defaultDefinitionLoader = loadDefinitionLoaderByFilename(headType, 'material.pla.def.json', configPath);
    predefined.push('material.pla.def.json');
    predefined.push('material.abs.def.json');
    predefined.push('material.petg.def.json');

    const configDir = `${DataStorage.configDir}/${headType}`;
    const defaultFilenames = fs.readdirSync(`${configDir}/${configPath}`);

    // Load pre-defined definitions first
    const definitions = [];
    for (const filename of predefined) {
        if (includes(defaultFilenames, filename)) {
            const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, configPath);
            definitions.push(definitionLoader.toObject());
        }
    }

    for (const filename of defaultFilenames) {
        if (!includes(predefined, filename) && regex.test(filename)) {
            const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, configPath);
            if (defaultDefinitionLoader) {
                const ownKeys = Array.from(defaultDefinitionLoader.ownKeys).filter(e => !definitionLoader.ownKeys.has(e));
                if (ownKeys && ownKeys.length > 0) {
                    for (const ownKey of ownKeys) {
                        definitionLoader.ownKeys.add(ownKey);
                    }
                    writeDefinition(headType, filename, configPath, definitionLoader);
                }
            }
            definitions.push(definitionLoader.toObject());
        }
    }

    return definitions;
}

export function loadQualityDefinitions(headType, configPath) {
    const predefined = [];
    const regex = /^quality.([A-Za-z0-9_]+).def.json$/;
    const defaultDefinitionLoader = loadDefinitionLoaderByFilename(headType, 'quality.fast_print.def.json', configPath);
    predefined.push('quality.fast_print.def.json');
    predefined.push('quality.normal_quality.def.json');
    predefined.push('quality.high_quality.def.json');

    const configDir = `${DataStorage.configDir}/${headType}`;
    const defaultFilenames = fs.readdirSync(`${configDir}/${configPath}`);
    // Load pre-defined definitions first
    const definitions = [];
    for (const filename of predefined) {
        if (includes(defaultFilenames, filename)) {
            const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, configPath);
            definitions.push(definitionLoader.toObject());
        }
    }

    for (const filename of defaultFilenames) {
        if (!includes(predefined, filename) && regex.test(filename)) {
            const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, configPath);
            if (defaultDefinitionLoader) {
                const ownKeys = Array.from(defaultDefinitionLoader.ownKeys).filter(e => !definitionLoader.ownKeys.has(e));
                if (ownKeys && ownKeys.length > 0) {
                    for (const ownKey of ownKeys) {
                        definitionLoader.ownKeys.add(ownKey);
                    }
                    writeDefinition(headType, filename, configPath, definitionLoader);
                }
            }
            definitions.push(definitionLoader.toObject());
        }
    }

    return definitions;
}

export function loadDefinitionsByPrefixName(headType, prefix, configPath) {
    if (prefix === 'material') {
        return loadMaterialDefinitions(headType, configPath);
    } else if (prefix === 'quality') {
        return loadQualityDefinitions(headType, configPath);
    }
}

export function loadDefaultDefinitions(headType, series = 'A150') {
    const predefined = [];
    const definitions = [];
    predefined.push('quality.fast_print.def.json');
    predefined.push('quality.normal_quality.def.json');
    predefined.push('quality.high_quality.def.json');
    predefined.push('material.pla.def.json');
    predefined.push('material.abs.def.json');
    predefined.push('material.petg.def.json');

    const configDir = `${DataStorage.defaultConfigDir}/${headType}`;

    const defaultFilenames = fs.readdirSync(`${configDir}/${series}`);

    for (const filename of predefined) {
        if (includes(defaultFilenames, filename)) {
            const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, series);
            definitions.push(definitionLoader.toObject());
        }
    }

    return definitions;
}
