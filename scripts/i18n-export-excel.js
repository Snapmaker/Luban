#!/bin/env node

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const XLSX = require('xlsx');


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
const LANGUAGES = ['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'ru', 'uk', 'zh-CN'];

const translateMap = {};
for (const lang of LANGUAGES) {
    logger.info(`Dealing with ${lang}...`);

    const langDir = `${I18N_DIR}/${lang}`;

    if (!fs.existsSync(langDir)) {
        logger.error(`${lang} directory doesn't exist!`);
        continue;
    }

    const i18nFile = `${langDir}/resource.json`;

    /* eslint-disable */
    const translates = require(i18nFile);
    /* eslint-enable */

    Object.entries(translates).forEach(([key, value]) => {
        const pack = translateMap[key] ? translateMap[key] : {};

        if (!translateMap[key]) {
            translateMap[key] = pack;
        }

        pack[lang] = value;
    });
}

// Output
const worksheetData = [];
worksheetData.push(['Original'].concat(LANGUAGES));

Object.keys(translateMap).sort().forEach((key) => {
    const pack = translateMap[key];
    worksheetData.push([key].concat(LANGUAGES.map((lang) => pack[lang])));
});

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Translates');

XLSX.writeFile(workbook, `Translates-${+new Date()}.xlsx`);
