#!/bin/env node

// const { src, dest } = require('gulp');
// const config = {
//     'src': [
//         // 'src/server/**/*.html',
//         // 'src/server/**/*.hbs',
//         // 'src/server/**/*.js',
//         // 'src/server/**/*.jsx',
//         // // Use ! to filter out files or directories
//         // '!src/server/i18n/**',
//         // '!**/node_modules/**',
//         //
//         // 'src/app/**/*.js',
//         // 'src/app/**/*.jsx',
//         // 'resources/CuraEngine/Config/*.json',
//         // // Use ! to filter out files or directories
//         // '!src/app/{vendor,i18n}/**'
//     ],
//     'dest': './test/'
// };
// src(config.src)
//     .pipe(changed(config.dest))
//     .pipe(dest(config.dest));


const fs = require('fs');
const path = require('path');

const I18N_DIR = path.resolve(__dirname, '../src/app/resources/i18n');
const LANGUAGES = ['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'ru', 'uk', 'zh-cn'];
const lang = 'en';
const langDir = `${I18N_DIR}/${lang}`;

const i18nFile = `${langDir}/resource.json`;
const translates = require(i18nFile);
const translateMap = {};
// Setup TranslateMap
Object.entries(translates).forEach(([key, value]) => {
    const pack = translateMap[key] ? translateMap[key] : {};
    if (!translateMap[key]) {
        translateMap[key] = pack;
        translateMap[key].newKeys = [];
    }
    pack[lang] = value;
});

// swapKeys
const RESERVED_WORDS = ['.', ',', '?', '\'', '+', '-', '(', ')', '{', '}', '[', ']'];
function swapKeys(str, keys, path) {
    Object.keys(keys).forEach((key) => {
        const fileName = 'key';

        let regStr = key;
        RESERVED_WORDS.forEach((word) => {
            const reg = new RegExp(`\\${word}`, 'g');
            regStr = regStr.replace(reg, `\\${word}`);
        });
        const newRegExp = new RegExp(`i18n\\.\\_\\('${regStr}'\\)`, 'g');

        const endBit = path.indexOf('.js');

        const newStr = str.replace( newRegExp, `i18n._('${fileName}_${path.substring(11, endBit)}_${key}')`)
        if (str !== newStr) {
            translateMap[key].newKeys.push(`${fileName}_${path.substring(11, endBit)}_${key}`);
        }
        str = newStr;
    });
    return str;
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
                file = swapKeys(file, translateMap, filePath);
                fs.writeFile(filePath, file, () => {});
            }
        });
    } catch (e) {
        return;
    }
}

dfsChangeFiles('../src', '');

// change keys table

LANGUAGES.forEach((language) => {
    const langDir = `${I18N_DIR}/${language}/resource.json`;

    const file = fs.readFileSync(langDir, 'utf-8');
    const fileJson = JSON.parse(file);

    Object.keys(translateMap).forEach((key) => {
        const value = translateMap[key];
        let newValue = fileJson[key];
        if (newValue === "") {
            newValue = key;
        }
        delete fileJson[key];
        if (value.newKeys.length > 0) {
            value.newKeys.forEach((newKey) => {
                fileJson[newKey] = newValue;
            });
        } else {
            fileJson[key] = newValue;
        }
    })

    // const newFile = fileJson.toString();
    fs.writeFile(langDir, JSON.stringify(fileJson, null, 4), () => {});
});

console.log('done');
