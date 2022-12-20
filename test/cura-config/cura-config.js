import path from 'path';
import _ from 'lodash';
import fs from 'fs';
import { DefinitionLoader } from '../../src/server/slicer/definition';
import DataStorage from '../../src/server/DataStorage';

DataStorage.configDir = './packages/luban-print-settings/resources/';
const resourcePath = './packages/luban-print-settings/resources/';
const curaConfigPath = './test/cura-config/';

function readDefinition(definitionId) {
    const definitionLoader = new DefinitionLoader();
    definitionLoader.loadDefinition(definitionId);
    return definitionLoader;
}

function readOldConfig() {
    const qualityConfig = readDefinition('quality.fast_print');
    const normalConfig = readDefinition('quality.normal_quality');
    const highConfig = readDefinition('quality.high_quality');
    const ownKeys = qualityConfig.ownKeys;
    for (const entry of normalConfig.ownKeys) {
        ownKeys.add(entry);
    }
    for (const entry of highConfig.ownKeys) {
        ownKeys.add(entry);
    }
    return Array.from(ownKeys);
}

function readToolPathSetting() {
    const filePath = path.join(curaConfigPath, 'ToolPathSettingForSnapjs.txt');
    const data = fs.readFileSync(filePath, 'utf8');
    const strings = data.split('\n');
    const config = {};
    let key = '';
    for (const string of strings) {
        const strings1 = string.split('\t');
        if (strings1.length === 1 && strings1[0].trim() !== '') {
            key = strings1[0].toLowerCase();
            config[key] = [];
        } else if (strings1.length === 4) {
            if (strings1[1] === strings1[2] && strings1[2] === strings1[3]) {
                config[key].push({
                    label: strings1[0],
                    isEqual: true,
                    v1: strings1[1],
                    v2: strings1[2],
                    v3: strings1[3]
                });
            } else {
                config[key].push({
                    label: strings1[0],
                    isEqual: false,
                    v1: strings1[1],
                    v2: strings1[2],
                    v3: strings1[3]
                });
            }
        } else {
            console.log(string);
        }
    }
    return config;
}

function getSettings(settings, label) {
    for (const key of Object.keys(settings)) {
        const setting = settings[key];
        setting.key = key;
        if (setting.label.toLowerCase() === label) {
            return setting;
        }
    }
    return null;
}

function saveNewConfig(definitionId, newConfig) {
    const filePath = path.join(resourcePath, `${definitionId}.def.json`);
    const readFileSync = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(readFileSync);

    fs.writeFileSync(`${curaConfigPath}${definitionId}.def.json`, JSON.stringify(_.merge(config, newConfig)));
}

function generateOverridesConfig() {
    const definitionLoader = readDefinition('fdmprinter');
    const ownKeys = readOldConfig();
    const settings = definitionLoader.settings;
    const config = readToolPathSetting();
    const snapConfig = { overrides: {} };
    const fastConfig = { overrides: {} };
    const normalConfig = { overrides: {} };
    const highConfig = { overrides: {} };
    for (const key of Object.keys(config)) {
        snapConfig.overrides[key] = { type: 'category', children: {} };
        fastConfig.overrides[key] = { type: 'category', children: {} };
        normalConfig.overrides[key] = { type: 'category', children: {} };
        highConfig.overrides[key] = { type: 'category', children: {} };
        for (const value of config[key]) {
            const setting = getSettings(settings, value.label);
            if (!setting) {
                console.log(value);
                continue;
            }
            const type = typeof setting.default_value;
            if (value.isEqual && !_.includes(ownKeys, setting.key)) {
                if (`${setting.default_value}` !== `${value.v1}`) {
                    snapConfig.overrides[key].children[setting.key] = { label: setting.label };
                    if (type === 'string') {
                        snapConfig.overrides[key].children[setting.key].default_value = value.v1;
                    } else if (type === 'number') {
                        snapConfig.overrides[key].children[setting.key].default_value = parseFloat(value.v1);
                    } else if (type === 'boolean') {
                        snapConfig.overrides[key].children[setting.key].default_value = value.v1 === '✔';
                    } else {
                        console.log('type error', type);
                    }
                }
            } else {
                fastConfig.overrides[key].children[setting.key] = { label: setting.label };
                normalConfig.overrides[key].children[setting.key] = { label: setting.label };
                highConfig.overrides[key].children[setting.key] = { label: setting.label };
                if (type === 'string') {
                    fastConfig.overrides[key].children[setting.key].default_value = value.v1;
                    normalConfig.overrides[key].children[setting.key].default_value = value.v2;
                    highConfig.overrides[key].children[setting.key].default_value = value.v3;
                } else if (type === 'number') {
                    fastConfig.overrides[key].children[setting.key].default_value = parseFloat(value.v1);
                    normalConfig.overrides[key].children[setting.key].default_value = parseFloat(value.v2);
                    highConfig.overrides[key].children[setting.key].default_value = parseFloat(value.v3);
                } else if (type === 'boolean') {
                    fastConfig.overrides[key].children[setting.key].default_value = value.v1 === '✔';
                    normalConfig.overrides[key].children[setting.key].default_value = value.v2 === '✔';
                    highConfig.overrides[key].children[setting.key].default_value = value.v3 === '✔';
                } else {
                    console.log('type error', type);
                }
            }
        }
    }
    saveNewConfig('snapmaker', snapConfig);
    saveNewConfig('quality.fast_print', fastConfig);
    saveNewConfig('quality.normal_quality', normalConfig);
    saveNewConfig('quality.high_quality', highConfig);
}
generateOverridesConfig();
