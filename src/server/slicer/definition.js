import fs from 'fs';
import path from 'path';
import { includes } from 'lodash';
import DataStorage from '../DataStorage';
import pkg from '../../package.json';
import logger from '../lib/logger';
import { ConfigV1Regex, ConfigV1Suffix } from '../constants';

const log = logger('definition');

const SETTING_FIELDS = [
    'label', 'description', 'type', 'options', 'unit', 'enabled', 'default_value', 'value', 'enabled',
    'min', 'max',
    // Snapmaker extended fields:
    'sm_value'
];

const DEFAULT_PREDEFINED = {
    'printing': [
        'quality.fast_print.def.json',
        'quality.normal_quality.def.json',
        'quality.high_quality.def.json',
        'material.pla.def.json',
        'material.abs.def.json',
        'material.petg.def.json'
    ],
    'cnc': [
        'tool.default_CVbit.def.json',
        'tool.default_FEM.def.json',
        'tool.default_MBEM.def.json',
        'tool.default_SGVbit.def.json'
    ],
    'laser': [
        'present.default_CUT.def.json',
        'present.default_HDFill.def.json',
        'present.default_SDFill.def.json',
        'present.default_PathEngrave.def.json',
        'basswood.cutting_1.5mm.def.json',
        'basswood.dot_filled_engraving.def.json',
        'black_acrylic.cutting_3mm.def.json',
        'mdf.dot_filled_engraving.def.json',
        'basswood.line_filled_engraving.def.json',
        'mdf.line_filled_engraving.def.json',
        'basswood.vector_engraving.def.json',
        'mdf.vector_engraving.def.json'
    ],
    '10w-laser': [
        'basswood.cutting_1.5mm.def.json',
        'basswood.cutting_3mm.def.json',
        'basswood.cutting_5mm.def.json',
        'basswood.cutting_8mm.def.json',
        'basswood.vector_engraving.def.json',
        'basswood.dot_filled_engraving.def.json',
        'basswood.line_filled_engraving.def.json',
        'black_acrylic.cutting_2mm.def.json',
        'black_acrylic.cutting_3mm.def.json',
        'black_acrylic.cutting_5mm.def.json',
        'black_anodized_aluminum.line_filled_engraving.def.json',
        'black_anodized_aluminum.vector_engraving.def.json',
        'cardstock.cutting_200g.def.json',
        'cardstock.cutting_300g.def.json',
        'cardstock.cutting_350g.def.json',
        'coated_paper.cutting_200g.def.json',
        'coated_paper.cutting_300g.def.json',
        'coated_paper.cutting_350g.def.json',
        'corrugated_paper.cutting_1.6mm.def.json',
        'corrugated_paper.cutting_3mm.def.json',
        'crazy_horse_leather.cutting_2mm.def.json',
        'crazy_horse_leather.dot_filled_engraving.def.json',
        'crazy_horse_leather.line_filled_engraving.def.json',
        'crazy_horse_leather.vector_engraving.def.json',
        'mdf.cutting_2mm.def.json',
        'mdf.dot_filled_engraving.def.json',
        'mdf.line_filled_engraving.def.json',
        'mdf.vector_engraving.def.json',
        'pinewood.cutting_4mm.def.json',
        'pinewood.cutting_8mm.def.json',
        'pinewood.dot_filled_engraving.def.json',
        'pinewood.line_filled_engraving.def.json',
        'vegetable_tanned_leather.cutting_1.5mm.def.json',
        'vegetable_tanned_leather.cutting_2mm.def.json',
        'vegetable_tanned_leather.dot_filled_engraving.def.json',
        'vegetable_tanned_leather.line_filled_engraving.def.json'
    ]
};

export class DefinitionLoader {
    definitionId = '';

    name = '';

    category = '';

    inherits = '';

    settings = {};

    ownKeys = new Set();

    metadata = {};

    loadDefinition(headType, definitionId, configPath) {
        if (!this.definitionId) {
            this.definitionId = definitionId;
        }
        const suffix = ConfigV1Suffix;
        const filePath = configPath ? path.join(`${DataStorage.configDir}/${headType}/${configPath}`,
            `${definitionId}${suffix}`)
            : path.join(`${DataStorage.configDir}/${headType}`, `${definitionId}${suffix}`);

        // in case of JSON parse error, set default json inherits from snapmaker2.def.json
        let json = {
            'name': 'Snapmaker Default',
            'version': 2,
            'inherits': 'snapmaker2'
        };
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            json = JSON.parse(data);
            this.loadJSON(headType, definitionId, json);
        } catch (e) {
            console.error(`JSON Syntax error of: ${definitionId}`);
        }
    }

    loadDefaultDefinition(headType, definitionId, configPath) {
        if (!this.definitionId) {
            this.definitionId = definitionId;
        }
        const suffix = ConfigV1Suffix;
        const filePath = configPath ? path.join(`${DataStorage.defaultConfigDir}/${headType}/${configPath}`,
            `${definitionId}${suffix}`)
            : path.join(`${DataStorage.defaultConfigDir}/${headType}`, `${definitionId}${suffix}`);

        // in case of JSON parse error, set default json inherits from snapmaker2.def.json
        let json = {
            'name': 'Snapmaker Default',
            'version': 2,
            'inherits': 'snapmaker2'
        };
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            json = JSON.parse(data);
            this.loadJSON(headType, definitionId, json);
        } catch (e) {
            console.error(`JSON Syntax error of: ${definitionId}`);
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
        if (json.category) {
            this.category = json.category;
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
            version: pkg.version,
            name: this.name,
            category: this.category,
            inherits: this.inherits,
            metadata: this.metadata,
            overrides
        };
    }

    toObject() {
        return {
            definitionId: this.definitionId,
            name: this.name,
            category: this.category,
            inherits: this.inherits,
            settings: this.settings,
            metadata: this.metadata,
            ownKeys: Array.from(this.ownKeys)
        };
    }

    fromObject(object) {
        this.definitionId = object.definitionId;
        this.name = object.name;
        this.category = object.category;
        this.inherits = object.inherits;
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

export function loadDefinitionLoaderByFilename(headType, filename, configPath, isDefault = false) {
    let definitionId = '';
    if (ConfigV1Regex.test(filename)) {
        definitionId = filename.substr(0, filename.length - 9);
    }
    const definitionLoader = new DefinitionLoader();
    if (isDefault) {
        definitionLoader.loadDefaultDefinition(headType, definitionId, configPath);
    } else {
        definitionLoader.loadDefinition(headType, definitionId, configPath);
    }

    return definitionLoader;
}

// TODO: merge 'loadMaterialDefinitions' and 'loadQualityDefinitions' function
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
    } else {
        return [];
    }
}

export function loadAllSeriesDefinitions(isDefault = false, headType, series = 'A150') {
    const _headType = (headType === 'laser' && includes(series, '10w')) ? '10w-laser' : headType;
    const predefined = DEFAULT_PREDEFINED[_headType];
    const definitions = [];

    const configDir = isDefault ? `${DataStorage.defaultConfigDir}/${headType}`
        : `${DataStorage.configDir}/${headType}`;
    const defaultFilenames = fs.readdirSync(`${configDir}/${series}`);

    if (isDefault) {
        for (const filename of predefined) {
            if (includes(defaultFilenames, filename)) {
                const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, series, isDefault);
                definitions.push(definitionLoader.toObject());
            }
        }
    } else {
        const defaultDefinitionLoader = loadDefinitionLoaderByFilename(headType, predefined[0], series);
        for (const filename of defaultFilenames) {
            if (ConfigV1Regex.test(filename)) {
                const definitionLoader = loadDefinitionLoaderByFilename(headType, filename, series, isDefault);
                if (defaultDefinitionLoader) {
                    const ownKeys = Array.from(defaultDefinitionLoader.ownKeys).filter(e => !definitionLoader.ownKeys.has(e));
                    if (ownKeys && ownKeys.length > 0) {
                        for (const ownKey of ownKeys) {
                            definitionLoader.ownKeys.add(ownKey);
                        }
                        writeDefinition(headType, filename, series, definitionLoader);
                    }
                }
                definitions.push(definitionLoader.toObject());
            }
        }
    }


    return definitions;
}
