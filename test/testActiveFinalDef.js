import { test } from 'tape';
import path from 'path';
import { DefinitionLoader } from '../src/server/slicer/definition';
import DataStorage from '../src/server/DataStorage';

DataStorage.configDir = path.join(__dirname, '../output/src/server/userData/Config/');

test('default definition', (t) => {
    const activeDefinitionLoader = new DefinitionLoader();
    const serieses = [
        // 'Original'
        'A150'
        // 'A250',
        // 'A350'
    ];
    const defaultNames = [
        'quality.fast_print'
        // 'quality.high_quality',
        // 'quality.normal_quality'
    ];
    activeDefinitionLoader.loadDefinition('active_final');

    const results = [];

    for (const series of serieses) {
        for (const defaultName of defaultNames) {
            const defaultDefinitionLoader = new DefinitionLoader();
            defaultDefinitionLoader.loadDefinition(defaultName, series);
            let result = true;
            for (const ownKey of defaultDefinitionLoader.ownKeys) {
                if (ownKey === 'wall_line_count') {
                    continue;
                }
                if (typeof activeDefinitionLoader.settings[ownKey].default_value === 'number') {
                    if ((activeDefinitionLoader.settings[ownKey].default_value - defaultDefinitionLoader.settings[ownKey].default_value) >= 0.01) {
                        console.log(`${series}|${defaultName}|${ownKey}|${activeDefinitionLoader.settings[ownKey].default_value}|${defaultDefinitionLoader.settings[ownKey].default_value}`);
                        result = false;
                    }
                } else if (activeDefinitionLoader.settings[ownKey].default_value !== defaultDefinitionLoader.settings[ownKey].default_value) {
                    console.log(`${series}|${defaultName}|${ownKey}|${activeDefinitionLoader.settings[ownKey].default_value}|${defaultDefinitionLoader.settings[ownKey].default_value}`);
                    result = false;
                }
            }
            results.push(result);
            if (result) {
                console.log(`${series}|${defaultName}|${result}`);
            }
        }
    }

    if (!results.find(v => v === true)) {
        t.fail();
    }

    t.end();
});
