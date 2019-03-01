import fs from 'fs';
import path from 'path';
import includes from 'lodash/includes';


const CURA_CONFIG_DIR = '../CuraEngine/Config';

export function loadDefinitionsByType(type) {
    const predefined = [];
    let suffix = null;
    switch (type) {
        case 'quality':
            suffix = '.quality.def.json';
            predefined.push(`fast_print${suffix}`);
            predefined.push(`normal_quality${suffix}`);
            predefined.push(`high_quality${suffix}`);
            break;
        case 'material':
            suffix = '.material.def.json';
            predefined.push(`pla${suffix}`);
            predefined.push(`abs${suffix}`);
            predefined.push(`custom${suffix}`);
            break;
        default:
            break;
    }

    const filenames = fs.readdirSync(CURA_CONFIG_DIR);

    // Load pre-defined definitions first
    const definitions = [];
    for (const filename of predefined) {
        if (includes(filenames, filename)) {
            const definition = loadDefinitionsByFilename(filename);
            definitions.push(definition);
        }
    }

    for (const filename of filenames) {
        if (!includes(predefined, filename) && filename.endsWith(suffix)) {
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

const SETTING_FIELDS = ['label', 'description', 'type', 'options', 'unit', 'enabled', 'default_value'];

export class DefinitionLoader {
    definitionId = '';
    name = '';
    inherits = '';
    settings = {};
    ownKeys = new Set();

    loadDefinition(definitionId) {
        if (!this.definitionId) {
            this.definitionId = definitionId;
        }

        const filePath = path.join(CURA_CONFIG_DIR, definitionId + '.def.json');

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

            if (setting.children) {
                this.loadJSONSettings(definitionId, setting.children);
            } else {
                this.settings[key] = this.settings[key] || {};
                this.settings[key].from = definitionId;

                if (definitionId === this.definitionId && !this.ownKeys.has(key)) {
                    this.ownKeys.add(key);
                }

                for (const field of SETTING_FIELDS) {
                    if (setting[field] !== undefined) {
                        this.settings[key][field] = setting[field];
                    }
                }
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
            overrides
        };
    }

    toObject() {
        return {
            definitionId: this.definitionId,
            name: this.name,
            inherits: this.inherits,
            settings: this.settings,
            ownKeys: this.ownKeys
        };
    }

    fromObject(object) {
        this.definitionId = object.definitionId;
        this.name = object.name;
        this.inherits = object.inherits;
        this.ownKeys = object.ownKeys;
        this.settings = object.settings;
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
