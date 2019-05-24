import path from 'path';
import fs from 'fs';
import mv from 'mv';
import includes from 'lodash/includes';
import request from 'superagent';
import * as opentype from 'opentype.js';
import logger from './logger';


const log = logger('lib:FontManager');

/*
const WEB_SAFE_FONTS = [
    // serif
    'Georgia',
    'Times New Roman',
    'Times',

    // sans-serif
    // 'Arial',
    'Arial Black',
    'Helvetica',
    'Impact',
    'Verdana',

    // monospace
    'Courier',
    'Courier New',

    // cursive
    'Comic Sans MS'
];
*/

function patchFont(font, displayName = '') {
    if (!font.names.fontFamily) {
        font.names.fontFamily = font.names.fullName;
    }
    font.names.displayName = {
        en: displayName || font.names.fontFamily.en
    };
}

class FontManager {
    constructor() {
        this.fontDir = './userData/fonts';
        this.fonts = [];
    }

    setFontDir(fontDir) {
        this.fontDir = fontDir;
    }

    async loadLocalFontDir() {
        const filenames = await new Promise((resolve, reject) => {
            fs.readdir(this.fontDir, (err, files) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(files);
            });
        });

        const promises = filenames.map((filename) => {
            const displayName = path.parse(filename).name;
            return this.loadLocalFont(`${this.fontDir}/${filename}`, displayName);
        });
        const fonts = (await Promise.all(promises)).filter(font => !!font);

        this.fonts = fonts;
        return fonts;
    }

    loadLocalFont(path, displayName = '') {
        return new Promise((resolve) => {
            opentype.load(path, (err, font) => {
                if (err) {
                    log.error(`Failed to parse file: ${path}`, String(err));
                    resolve(null);
                    return;
                }
                patchFont(font, displayName);
                resolve(font);
            });
        });
    }

    searchLocalFont(family, subfamily) {
        for (const font of this.fonts) {
            const fontFamilies = [font.names.fontFamily.en, font.names.displayName.en];
            if (includes(fontFamilies, family) && (!subfamily || font.names.fontSubfamily.en === subfamily)) {
                return font;
            }
        }
        return null;
    }

    addFontFile(fontPath) {
        return new Promise((resolve, reject) => {
            opentype.load(fontPath, (err, font) => {
                if (err) {
                    log.error(`Failed to parse file: ${path}`, String(err));
                    reject(new Error(err));
                    return;
                }
                patchFont(font);

                const ext = path.extname(fontPath);
                const destPath = `${this.fontDir}/${font.names.fontFamily.en}${ext}`;
                mv(fontPath, destPath, () => {
                    this.fonts.push(font);
                    resolve(font);
                });
            });
        });
    }

    downloadFont(family) {
        // for download .woff font
        const userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0';
        const googleFontAPI = 'https://fonts.googleapis.com/css';

        return request
            .get(googleFontAPI, {
                family: family,
                subset: 'latin'
            })
            .set('User-Agent', userAgent)
            .then((res) => {
                if (res.status === 400) {
                    throw new Error(`Font not found ${family}`);
                }
                const pattern = /https:\/\/[^)]+/;
                const m = res.text.match(pattern);
                if (!m) {
                    throw new Error('Google Font API request not matched');
                }
                return m[0];
            })
            .then((url) => new Promise((resolve, reject) => {
                const path = `${this.fontDir}/${family}.woff`;
                request
                    .get(url)
                    .pipe(fs.createWriteStream(path), null)
                    .on('finish', () => {
                        resolve(path);
                    })
                    .on('error', (err) => {
                        reject(err);
                    });
            }))
            .then((path) => {
                return this.loadLocalFont(path, family);
            })
            .catch((err) => {
                log.error('request font failed', err);
            });
    }

    getFont(family, subfamily = null) {
        const localFont = this.searchLocalFont(family, subfamily);
        if (localFont) {
            return Promise.resolve(localFont);
        }

        // download
        log.debug(`Downloading font <${family}>...`);
        return this.downloadFont(family) // subfamily is not supported (for now)
            .then((font) => {
                log.debug(`Font <${family}> Downloaded`);
                this.fonts.push(font);
                return font;
            })
            .catch((err) => {
                log.error(err);
            });
    }
}

export async function initFonts(fontDir) {
    fontManager.setFontDir(fontDir);
    await fontManager.loadLocalFontDir();
}

const fontManager = new FontManager();

export default fontManager;
