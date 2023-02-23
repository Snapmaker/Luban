#!/bin/env node
// Usage: node scripts/i18n-import-cura-translations.js ~/Documents/snapmaker/Cura-3.4.1/i18n

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const PO = require('pofile');


const { combine, colorize, timestamp, printf } = winston.format;
const logger = winston.createLogger({
    transports: new winston.transports.Console({
        format: combine(
            colorize(),
            timestamp(),
            printf(log => `${log.timestamp} - ${log.level} ${log.message}`)
        ),
        handleExceptions: true
    })
});

const I18N_DIR = path.resolve(__dirname, '../src/app/resources/i18n');

if (process.argv.length !== 3) {
    logger.error('node i18n-import-cura-translations.js {Cura i18n folder}');
    return;
}

const curaI18nDir = process.argv[2];
logger.info(`Use Cura i18n folder: ${curaI18nDir}`);


const languageMappings = {
    'de': 'de_DE',
    // 'en': 'en_US',
    'es': 'es_ES',
    'fr': 'fr_FR',
    'ja': 'ja_JP',
    'ko': 'ko_KR',
    'it': 'it_IT',
    'ru': 'ru_RU',
    'uk': null,
    'zh-CN': 'zh_CN',
};

Object.keys(languageMappings).forEach((lang) => {
    const langDir = `${I18N_DIR}/${lang}`;
    const langFile = `${langDir}/resource.json`;
    const translates = JSON.parse(fs.readFileSync(langFile).toString());

    const curaLang = languageMappings[lang];
    if (!curaLang) {
        return;
    }

    const curaLangDir = `${curaI18nDir}/${curaLang}`;
    const printerConfigFile = `${curaLangDir}/fdmprinter.def.json.po`;
    const po = PO.parse(fs.readFileSync(printerConfigFile).toString());

    for (const item of po.items) {
        if (translates[item.msgid] === '') {
            console.log(typeof item.msgstr[0]);
            console.log(`[${lang}] ${item.msgid} -> ${item.msgstr[0]}`);
            translates[item.msgid] = item.msgstr[0];
        }
    }

    fs.writeFileSync(langFile, JSON.stringify(translates, null, 4), 'utf-8');
});
