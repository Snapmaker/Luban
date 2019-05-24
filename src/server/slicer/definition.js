import fs from 'fs';
import path from 'path';
import includes from 'lodash/includes';
import DataStorage from '../DataStorage';


export function loadDefinitionsByType(type) {
    const predefined = [];
    let regex = null;
    switch (type) {
        case 'quality':
            regex = /^quality.([A-Za-z0-9_]+).def.json$/;
            predefined.push('quality.fast_print.def.json');
            predefined.push('quality.normal_quality.def.json');
            predefined.push('quality.high_quality.def.json');
            break;
        case 'material':
            regex = /^material.([A-Za-z0-9_]+).def.json$/;
            predefined.push('material.pla.def.json');
            predefined.push('material.abs.def.json');
            predefined.push('material.custom.def.json');
            break;
        default:
            break;
    }

    const configDir = DataStorage.configDir;
    const filenames = fs.readdirSync(configDir);

    // Load pre-defined definitions first
    const definitions = [];
    for (const filename of predefined) {
        if (includes(filenames, filename)) {
            const definition = loadDefinitionsByFilename(filename);
            definitions.push(definition);
        }
    }

    for (const filename of filenames) {
        if (!includes(predefined, filename) && regex.test(filename)) {
            const definition = loadDefinitionsByFilename(filename);
            definitions.push(definition);
        }
    }

    return definitions;
}

export function loadDefinitionsByFilename(filename) {
    const definitionId = filename.substr(0, filename.length - 9);

    const definitionLoader = new DefinitionLoader();
    definitionLoader.loadDefinition(definitionId);

    return definitionLoader.toObject();
}

const SETTING_FIELDS = [
    'label', 'description', 'type', 'options', 'unit', 'enabled', 'default_value', 'value',
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

    loadDefinition(definitionId) {
        if (!this.definitionId) {
            this.definitionId = definitionId;
        }

        const filePath = path.join(DataStorage.configDir, definitionId + '.def.json');

        const data = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(data);

        this.loadJSON(definitionId, json);
    }

    loadJSON(definitionId, json) {
        if (json.inherits) {
            this.loadDefinition(json.inherits);
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
            ownKeys: this.ownKeys
        };
    }

    fromObject(object) {
        this.definitionId = object.definitionId;
        this.name = object.name;
        this.inherits = object.inherits;
        this.ownKeys = object.ownKeys;
        this.settings = object.settings;
        this.metadata = object.metadata;
    }

    updateName(name) {
        this.name = name;
    }

    updateSettings(settings) {
        this.settings = {
            ...this.settings,
            ...settings
        };
    }
}
