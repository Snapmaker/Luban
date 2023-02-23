#!/bin/env node

const path = require('path');
const fs = require('fs');
const winston = require('winston');
const XLSX = require('xlsx');

function getLogger() {
    const { combine, colorize, timestamp, printf } = winston.format;
    return winston.createLogger({
        transports: new winston.transports.Console({
            format: combine(
                colorize(),
                timestamp(),
                printf(log => `${log.timestamp} - ${log.level} ${log.message}`)
            ),
            handleExceptions: true
        })
    });
}


const logger = getLogger();
const I18N_DIR = path.resolve(__dirname, '../src/app/resources/i18n');


function getInputFile() {
    if (process.argv.length !== 3) {
        process.abort();
    }
    return process.argv[2];
}

function fillIn(translations, lang) {
    const i18nFile = path.resolve(I18N_DIR, lang, 'resource.json');

    const t = JSON.parse(fs.readFileSync(i18nFile, 'utf-8'));

    Object.keys(translations).forEach((key) => {
        const value = translations[key];

        if (t[key] !== undefined) {
            if (t[key] !== value) {
                if (t[key] !== '') {
                    logger.info(`Change [${key}], [${t[key]}] -> [${value}]`);
                }
                t[key] = value;
            }
        }
    });

    fs.writeFile(i18nFile, JSON.stringify(t, null, 4), () => {});
}

function main() {
    const inputFile = getInputFile();

    const workbook = XLSX.readFile(inputFile);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const col2lang = {
        B: ['German', 'de'],
        C: ['English', 'en'],
        D: ['Spanish', 'es'],
        E: ['French', 'fr'],
        F: ['Italian', 'it'],
        G: ['Japanese', 'ja'],
        H: ['Korean', 'ko'],
        I: ['Russian', 'ru'],
        J: ['Ukrainian', 'uk'],
        K: ['Chinese', 'zh-CN']
    };

    Object.keys(col2lang).forEach((col) => {
        const item = col2lang[col];

        const cellTitle = worksheet[`${col}1`].v;
        if (cellTitle !== item[1]) {
            logger.error(':(');
            return;
        }

        logger.info(`importing ${item[1]} to ${item[1]}`);

        const translations = {};
        for (let i = 2; ; i++) {
            const cell = worksheet[`A${i}`];
            if (cell === undefined) {
                break;
            }
            const key = worksheet[`A${i}`].v.trim();
            try {
                const value = worksheet[col + i].v.trim();

                translations[key] = value;
            } catch (err) {
                logger.error(`missing col ${col + i}`);
            }
        }

        fillIn(translations, item[1]);
    });
    console.log(worksheet.B1.v);
}

main();

logger.info('Done.');

// node scripts/i18n-import-excel.js {excel}
