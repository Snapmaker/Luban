import fs from 'fs';
import path from 'path';
import { isNil, includes } from 'lodash';
import { CncSuffix, CncV1Regex, CnCV2Regex } from '../../constants';


const defaultToolListNames = [
    'Carving V-bit',
    'Flat End Mill',
    'Ball End Mill',
    'Straight Groove V-bit'
];
const defaultParameters = {
    diameter: {
        default_value: 0.2,
        type: 'float',
        min: 0.1,
        max: 10,
        unit: 'mm',
        label: 'Cutting Diameter'
    },
    angle: {
        default_value: 30,
        type: 'float',
        min: 1,
        max: 180,
        unit: '°',
        label: 'Point Angle'
    },
    shaft_diameter: {
        default_value: 3.175,
        type: 'float',
        min: 0.1,
        max: 10,
        unit: 'mm',
        label: 'Shank Diameter'
    },
    jog_speed: {
        default_value: 1500,
        type: 'float',
        min: 1,
        max: 6000,
        unit: 'mm/min',
        label: 'Jog Speed',
        description: 'Determines how fast the tool moves when it’s not carving.'
    },
    work_speed: {
        default_value: 300,
        type: 'float',
        min: 1,
        max: 6000,
        unit: 'mm/min',
        label: 'Work Speed',
        description: 'Determines how fast the tool moves on the material.'
    },
    plunge_speed: {
        default_value: 300,
        type: 'float',
        min: 0.1,
        max: 1000,
        unit: 'mm/min',
        label: 'Plunge Speed',
        description: 'Determines how fast the tool feeds into the material.'
    },
    step_down: {
        default_value: 0.5,
        type: 'float',
        min: 0.01,
        unit: 'mm',
        label: 'Stepdown',
        description: 'Enter the depth of each carving step.'
    },
    step_over: {
        default_value: 0.25,
        type: 'float',
        min: 0.01,
        unit: 'mm',
        label: 'Stepover',
        description: 'Set the space between parallel toolpaths.'
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
    // return new Promise(async (resolve) => {
    let json;
    if (CncV1Regex.test(filename) && filename.substr(0, filename.length - 9) !== 'active') {
        const filePath = path.join(configDir, filename);
        const data = fs.readFileSync(filePath, 'utf8');
        json = JSON.parse(data);
        const definitions = [];
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
                    const newName = `Old${json.definitionId}${item.name}`;
                    newDefinition.definitionId = newName;
                    newDefinition.settings = addNewParameter(newDefinition?.settings);
                    fs.writeFileSync(path.join(configDir, `${newName}${CncSuffix}`), JSON.stringify(newDefinition));
                    // JSON.stringify
                    definitions.push(newDefinition);
                }
            });
            fs.unlinkSync(filePath);
        }
        return definitions;
    }

    if (CnCV2Regex.test(filename) && filename.substr(0, filename.length - CncSuffix.length) !== 'active') {
        const filePath = path.join(configDir, filename);
        const data = fs.readFileSync(filePath, 'utf8');
        json = JSON.parse(data);
        json.settings = addNewParameter(json?.settings);
        fs.writeFileSync(filePath, JSON.stringify(json));
        return [json];
    }
    return [];
    // });
};
