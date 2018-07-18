import fs from 'fs';
import request from 'superagent';
import * as opentype from 'opentype.js';

const LOCAL_FONT_DIR = './fonts';
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

class FontManager {
    constructor() {
        this.fonts = [];
    }

    loadLocalFontDir(fontDir = LOCAL_FONT_DIR) {
        return new Promise((resolve, reject) => {
            fs.readdir(fontDir, (err, files) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(files);
            });
        }).then((files) => Promise.all(
            files.map((filename) => this.loadLocalFont(`${LOCAL_FONT_DIR}/${filename}`))
        )).then((fonts) => {
            this.fonts = fonts.filter(font => !!font);
            return this.fonts;
        });
    }

    loadLocalFont(path) {
        function patchFont(font) {
            if (!font.names.fontFamily) {
                font.names.fontFamily = font.names.fullName;
            }
        }
        return new Promise((resolve) => {
            opentype.load(path, (err, font) => {
                if (err) {
                    console.error(`Failed to parse file: ${path}`, String(err));
                    resolve(null);
                }
                patchFont(font);
                resolve(font);
            });
        });
    }

    getFontsInfos() {
        return this.fonts.map((font) => ({
            fontFamily: font.names.fontFamily.en,
            fontSubfamily: font.names.fontSubfamily.en,
            fullName: font.names.fullName.en
        })).sort();
    }

    searchLocalFont(family, subfamily) {
        for (let font of this.fonts) {
            if (font.names.fontFamily.en === family && font.names.fontSubfamily.en === subfamily) {
                return font;
            }
        }
        return null;
    }

    downloadFont(family) {
        // for download .woff font
        const userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0';
        const googleFontAPI = 'https://fonts.googleapis.com/css';

        return request
            .get(googleFontAPI, {
                family: String(family),
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
                const path = `${LOCAL_FONT_DIR}/${family}.woff`;
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
                return this.loadLocalFont(path);
            })
            .catch((err) => {
                console.error('request font failed', err);
            });
    }

    getFont(family, subfamily = 'Regular') {
        const localFont = this.searchLocalFont(family, subfamily);
        if (localFont) {
            return Promise.resolve(localFont);
        }

        // download
        console.log(`Downloading font <${family}>...`);
        return this.downloadFont(family) // subfamily is not supported (for now)
            .then((font) => {
                console.log(`Font <${family}> Downloaded`);
                this.fonts.push(font);
                return font;
            })
            .catch((err) => {
                console.error(err);
            });
    }
}

function ensureFontDir() {
    if (!fs.existsSync(LOCAL_FONT_DIR)) {
        fs.mkdirSync(LOCAL_FONT_DIR);
    }
}
ensureFontDir();

const fontManager = new FontManager();
fontManager
    .loadLocalFontDir()
    .then(() => {
        WEB_SAFE_FONTS.forEach((fontName) => {
            fontManager
                .getFont(fontName)
                .then((font) => {
                    console.log(`Hit Font <${fontName}>`);
                });
        });
    });

export default fontManager;
