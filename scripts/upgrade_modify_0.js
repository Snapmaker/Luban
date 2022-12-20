const fs = require('fs');
const path = require('path');
const includes = require('lodash/includes');


function readItem(item) {
    const map = {};
    for (const [key, value] of Object.entries(item)) {
        if (value.type === 'mainCategory' || value.type === 'category') {

        } else {
            map[key] = value;
        }
        if (value.children) {
            const map2 = readItem(value.children);
            if (Object.keys(map2).length > 0) {
                for (const [key2, value2] of Object.entries(map2)) {
                    map[key2] = value2;
                }
            }
        }
    }
    return map;
}

function readFile(filePath) {
    if (filePath.indexOf('.def.json') === -1) {
        return;
    }

    console.log(`Checking file ${filePath}...`);
    const map = {};
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        json = JSON.parse(data);

        if (json.settings) {
            const map2 = readItem(json.settings);
            if (Object.keys(map2).length > 0) {
                for (const [key2, value2] of Object.entries(map2)) {
                    map[key2] = value2;
                }
            }
        }

        if (json.overrides) {
            const map2 = readItem(json.overrides);
            if (Object.keys(map2).length > 0) {
                for (const [key2, value2] of Object.entries(map2)) {
                    map[key2] = value2;
                }
            }
        }
    } catch (e) {
        console.error(e);
    }

    return map;
}

const configDir = path.resolve(__dirname, '../packages/luban-print-settings/resources/printing');
const standardConfigFile = path.join(configDir, 'fdmprinter.def.json');
const configFile = path.join(configDir, 'snapmaker_modify_0.def.json');

const allMap = readFile(standardConfigFile);
const ourMap = readFile(configFile);


console.log('Scanner keys...');

for (const key of Object.keys(ourMap)) {
    if (!allMap[key]) {
        console.log(`Found not existing key in fdmprinter.def.json: ${key}`);
    }
}

for (const key of Object.keys(allMap)) {
    if (!ourMap[key]) {
        // console.log(`New key in fdmprinter: ${key}`);
        const value = allMap[key];
        if (value.children) {
            delete value.children;
        }
        console.log(`"${key}": ${JSON.stringify(value, null, 4)},`)
    }
}
