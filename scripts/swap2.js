const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const I18N_DIR = path.resolve(__dirname, '../src/app/resources/i18n');
const LANGUAGES = ['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'ru', 'uk', 'zh-CN'];
const lang = 'en';
const langDir = `${I18N_DIR}/${lang}`;

const i18nFile = `${langDir}/resource.json`;
const translates = require(i18nFile);
const translateMap = {};

// Setup TranslateMap
// Object.entries(translates).forEach(([key, value]) => {
//     const pack = translateMap[key] ? translateMap[key] : {};
//     if (!translateMap[key]) {
//         translateMap[key] = pack;
//         translateMap[key].newKeys = [];
//     }
//     pack[lang] = value;
// });

// Setup new change file
const workbook = XLSX.readFile('luban_key_10081030_20211028_translated_input.xlsx');
const sheets = workbook.Sheets[workbook.SheetNames[0]];
const changes = [];

function setChanges() {
    for (let i = 2; i < 1200; i++) {
        if (!sheets[`A${i}`]) {
            break;
        }
        if (!sheets[`B${i}`]) {
            continue;
        }
        changes.push({
            oldKey: sheets[`A${i}`].v,
            newKey: sheets[`B${i}`].v
        });
        // if (!sheets[`A${i}`]) {
        //     // 替换前缀
        //     if (sheets[`B${i}`]) {
        //         changes.push({
        //             oldKey: sheets[`C${i}`].v,
        //             newKey: `key-${sheets[`B${i}`].v}-${sheets[`E${i}`].v}`
        //         });
        //     }
        // } else if (sheets[`A${i}`].v === '未使用') {
        //     changes.push({
        //         oldKey: sheets[`C${i}`].v,
        //         newKey: `key-unused-${sheets[`E${i}`].v}`
        //     });
        // } else if (sheets[`A${i}`].v === '直接替换') {
        //     changes.push({
        //         oldKey: sheets[`C${i}`].v,
        //         newKey: `key-${sheets[`B${i}`].v}`
        //     });
        // }
    }
}

// swap keys
function swapKeys(str, keys) {
    let newStr = str;
    keys.forEach((key) => {
        while (newStr.indexOf(`i18n._('${key.oldKey}'`) > -1) {
            console.log('kv', `i18n._('${key.oldKey}'`, `i18n._('${key.newKey}'`, newStr.indexOf(key.oldKey));
            newStr = newStr.replace(`i18n._('${key.oldKey}'`, `i18n._('${key.newKey}'`);
        }
    });
    return newStr;
}

// file
function dfsChangeFiles(path, fullPath) {
    if (path === 'resources') {
        // TODO
        // not to open resources files
        return;
    }
    try {
        const newPath = `${fullPath}${path}/`;
        const fileNames = fs.readdirSync(newPath);
        fileNames.forEach((dir) => {
            dfsChangeFiles(dir, newPath);
            if (dir.indexOf('.js') > -1) { // .js, .jsx
                const filePath = `${newPath}${dir}`;
                let file = fs.readFileSync(filePath, 'utf-8');
                file = swapKeys(file, changes);
                fs.writeFile(filePath, file, () => {});
            }
        });
    } catch (e) {
        return;
    }
}

function changeResourcesKeys() {
    LANGUAGES.forEach((language) => {
        const langDir = `${I18N_DIR}/${language}/resource.json`;

        const file = fs.readFileSync(langDir, 'utf-8');
        const fileJson = JSON.parse(file);

        changes.forEach((key) => {
            const {oldKey, newKey} = key;
            const newValue = fileJson[oldKey];
            console.log('key', oldKey, newKey);
            delete fileJson[oldKey];
            if (newValue) {
                fileJson[newKey] = newValue;
            }
        })

        // const newFile = fileJson.toString();
        fs.writeFile(langDir, JSON.stringify(fileJson, null, 4), () => {
        });
    });
}

function main() {
    setChanges();
    dfsChangeFiles('../src', '');
    changeResourcesKeys();
}

main();
console.log('done');
