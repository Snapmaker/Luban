import fs from 'fs';
import path from 'path';
import { isNil, includes } from 'lodash';
import { ConfigV1Suffix, ConfigV1Regex, ConfigV2Regex, ConfigV2Suffix } from '../../constants';


const defaultToolListNames = [
    'Carving V-bit',
    'Flat End Mill',
    'Ball End Mill',
    'Straight Groove V-bit'
];
const defaultParameters = {
    toolType: {
        default_value: 'vbit',
        type: 'input',
        description: 'Set the tool type',
        lable: 'Tool Type'
    },
    diameter: {
        default_value: 0.2,
        type: 'float',
        min: 0.1,
        max: 10,
        unit: 'mm',
        description: 'Set the diameter of the carving tool.',
        label: 'Cutting Diameter'
    },
    angle: {
        default_value: 30,
        type: 'float',
        min: 1,
        max: 180,
        unit: '°',
        description: 'Set the point angle of the carving tool.',
        label: 'Point Angle'
    },
    shaft_diameter: {
        default_value: 3.175,
        type: 'float',
        min: 0.1,
        max: 10,
        unit: 'mm',
        description: 'Set the shank diameter of the carving tool.',
        label: 'Shank Diameter'
    },
    jog_speed: {
        default_value: 1500,
        type: 'float',
        min: 1,
        max: 6000,
        unit: 'mm/min',
        label: 'Jog Speed',
        description: 'Set the speed at which the toolhead moves on the material when it is not engraving or cutting.'
    },
    work_speed: {
        default_value: 300,
        type: 'float',
        min: 1,
        max: 6000,
        unit: 'mm/min',
        label: 'Work Speed',
        description: 'Set the speed at which the tool moves on the material when it is carving.'
    },
    plunge_speed: {
        default_value: 300,
        type: 'float',
        min: 0.1,
        max: 1000,
        unit: 'mm/min',
        label: 'Plunge Speed',
        description: 'Set the speed at which the tool is driven down into the material.'
    },
    step_down: {
        default_value: 0.5,
        type: 'float',
        min: 0.01,
        unit: 'mm',
        label: 'Stepdown',
        description: 'Set the distance along the Z axis per step that the tool is plunged into the material.'
    },
    step_over: {
        default_value: 0.25,
        type: 'float',
        min: 0.01,
        unit: 'mm',
        label: 'Stepover',
        description: 'Set the space between parallel toolpaths.'
    },
    tool_extension_enabled: {
        default_value: true,
        type: 'enum',
        label: 'Tool Limiting',
        description: 'Limit tool location by object boundary \n - Tangent to Boundary:  Tool is located inside the machining  boundary \n - Past Boundary: tool can exceed machining boundary',
        options: {
            'false': 'Tangent to Boundary',
            'true': 'Past Boundary'
        }
    }
};
export const addNewParameter = (settings) => {
    if (isNil(settings)) {
        settings = {};
    }
    const allSettingsParameters = Object.keys(settings);
    Object.keys(defaultParameters).forEach((parameter) => {
        if (!includes(allSettingsParameters, parameter)) {
            settings[parameter] = defaultParameters[parameter];
        }
    });
    return settings;
};

export const cncUniformProfile = (filename, configDir) => {
    if (ConfigV1Regex.test(filename) && filename.substr(0, filename.length - 9) !== 'active') {
        const filePath = path.join(configDir, filename);
        const data = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(data);
        if (json.toolList && isNil(json.settings)) {
            const toolLists = json.toolList;
            const shouldCheckName = json?.definitionId === 'Default';
            toolLists.forEach((item) => {
                let shouldCoverDefinition = false;
                if (shouldCheckName && item.name && !includes(defaultToolListNames, item.name)) {
                    shouldCoverDefinition = true;
                } else if (!shouldCheckName && item.name) {
                    shouldCoverDefinition = true;
                }
                if (shouldCoverDefinition) {
                    const newDefinition = {};
                    newDefinition.category = json.category;
                    newDefinition.version = json.version;
                    newDefinition.name = item.name;
                    newDefinition.settings = item.config;
                    newDefinition.inherits = 'snapmaker2';
                    const newName = `${json.definitionId}${item.name}`;
                    newDefinition.settings = addNewParameter(newDefinition?.settings);
                    fs.writeFileSync(path.join(configDir, `${newName}${ConfigV1Suffix}`), JSON.stringify(newDefinition));
                }
            });
            fs.unlinkSync(filePath);
        }
    }
    if (ConfigV2Regex.test(filename) && filename.substr(0, filename.length - ConfigV2Suffix.length) !== 'active') {
        const filePath = path.join(configDir, filename);
        const data = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(data);
        json.inherits = 'snapmaker2';
        if (json.settings && json.settings.diameter) {
            if (!json.i18nCategory && ['Default Material', 'Acrylic', 'Epoxy Tooling Board'].includes(json.category)) {
                json.i18nCategory = `key-default_category-${json.category}`;
            }
            if (!json.i18nName && json.name) {
                if (json.name === 'Flat End Mill') {
                    json.i18nName = `key-default_name-${json.name} 1.5`;
                } else {
                    json.i18nName = `key-default_name-${json.name}`;
                }
            }
            fs.writeFileSync(filePath, JSON.stringify(json));
        } else {
            fs.unlinkSync(filePath);
        }
    }
};
