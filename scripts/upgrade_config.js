const fs = require('fs');
const path = require('path');
const includes = require('lodash/includes');


const configDir = path.resolve(__dirname, '../packages/luban-print-settings/resources/printing');

const removedKeys = [
    "travel_compensate_overlapping_walls_enabled",
    "travel_compensate_overlapping_walls_0_enabled",
    "travel_compensate_overlapping_walls_x_enabled",
    "fill_perimeter_gaps",
    "filter_out_tiny_gaps",
    "wall_min_flow",
    "wall_min_flow_retract",
    "speed_equalize_flow_max",
    "speed_equalize_flow_enabled",
];

const migrateKeys = [
    // "outer_inset_first",
];
const migrateMap = {
    // "outer_inset_first": {
    //     key: "inset_direction",
    //     default_value: "inside_out",
    // }
};


function checkItem(item) {
    for (const [key, value] of Object.entries(item)) {
        if (includes(removedKeys, key)) {
            console.log('remove key', key);
            delete item[key];
        }

        if (includes(migrateKeys, key)) {
            console.log('migrate key', key);
            const newKeyInfo = migrateMap[key];

            item[newKeyInfo.key] = {
                default_value: newKeyInfo.default_value,
            };

            delete item[key];
        }

        if (value.children && value.children.length > 0) {
            checkItem(value.children);
        }
    }
 }


function checkFile(filePath) {
    if (filePath.indexOf('.def.json') === -1) {
        return;
    }

    console.log(`Checking file ${filePath}...`);
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        json = JSON.parse(data);

        if (json.settings) {
            checkItem(json.settings);
        }

        if (json.overrides) {
            checkItem(json.overrides);
        }

        fs.writeFileSync(filePath, JSON.stringify(json, null, 4));

    } catch (e) {
        console.error(e);
    }
}

function checkDir(dirPath) {
    const filenames = fs.readdirSync(dirPath);

    console.log(`Checking directory ${dirPath}...`);

    for (const filename of filenames) {
        if (filename === 'fdmprinter.def.json') {
            continue;
        }
        if (filename === 'fdmextruder.def.json') {
            continue;
        }
        const filePath = path.join(dirPath, filename);

        const stats = fs.lstatSync(filePath);

        if (stats.isFile()) {
            checkFile(filePath);
        } else {
            checkDir(filePath);
        }
    }
}

checkDir(configDir);
