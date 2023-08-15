import libFontManager from 'font-scanner';
import fs from 'fs';
import includes from 'lodash/includes';
import log from 'loglevel';
import mv from 'mv';
import * as opentype from 'opentype.js';
import path from 'path';
import request from 'superagent';


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

export const DEFAULT_FONT_NAME = 'NotoSansSC-Regular.otf';

function patchFont(font, displayName = '') {
    if (!font.names.fontFamily) {
        font.names.fontFamily = font.names.fullName;
    }
    font.names.displayName = {
        en: displayName || font.names.fontFamily.en
    };
}

class FontManager {
    fontDir;

    constructor() {
        this.fonts = [];
        // preload fonts config
        this.systemFonts = [];
        this.loadDefaultFont();
        libFontManager.getAvailableFontsSync()
            .forEach((font) => {
                if (path.extname(font.path)
                    .toLocaleLowerCase() !== '.ttc'
                    && this.systemFonts.findIndex(i => i.family === font.family) < 0) {
                    this.systemFonts.push(font);
                }
            });
    }

    async loadDefaultFont() {
        if (this.defaultFont) {
            return;
        }
        let fontDir;
        if (process.env.fontDir) {
            fontDir = process.env.fontDir;
        } else if (this.fontDir) {
            fontDir = this.fontDir;
        }
        if (!fontDir) {
            return;
        }
        const dir = `${fontDir}/${DEFAULT_FONT_NAME}`;
        try {
            this.defaultFont = opentype.loadSync(dir);
        } catch (e) {
            log.error(e);
        }
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
        this.fonts.forEach((font) => {
            if (this.systemFonts.findIndex(i => i.family === font?.names?.fontFamily?.en) < 0) {
                const newFont = {
                    family: font.names.fontFamily.en,
                    fontSubfamily: font.names.fontSubfamily.en,
                    style: font.names.fontSubfamily.en,
                    fullName: font.names.fullName.en,
                    displayName: font.names.displayName.en
                };
                this.systemFonts.push(newFont);
            }
        });
        return fonts;
    }

    loadLocalFont(filePath, displayName = '') {
        return new Promise((resolve) => {
            opentype.load(filePath, (err, font) => {
                if (err) {
                    log.error(`Failed to parse file: ${filePath}`, String(err));
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
            if (font?.names) {
                const fontFamilies = [font.names.fontFamily.en, font.names.displayName.en];
                if (includes(fontFamilies, family) && (!subfamily || font.names.fontSubfamily.en === subfamily)) {
                    return font;
                }
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
                const filePath = `${this.fontDir}/${family}.woff`;
                request
                    .get(url)
                    .pipe(fs.createWriteStream(filePath), null)
                    .on('finish', () => {
                        resolve(path);
                    })
                    .on('error', (err) => {
                        reject(err);
                    });
            }))
            .then((filePath) => {
                return this.loadLocalFont(filePath, family);
            })
            .catch((err) => {
                log.error('request font failed', err);
            });
    }

    getFont(family, subfamily = null, style) {
        const localFont = this.searchLocalFont(family, subfamily);
        if (localFont) {
            return Promise.resolve(localFont);
        }

        let fontConfig = this.systemFonts.find(f => {
            if (style) {
                return f.family === family && f.style === style;
            } else {
                return f.family === family;
            }
        });

        if (!fontConfig || !fontConfig.path) {
            // fontConfig = this.systemFonts.find(f => f.family === 'Arial');
            fontConfig = this.systemFonts[0];
            family = fontConfig?.family;
            if (!fontConfig || !fontConfig.path) {
                throw new Error('No Font Found!');
            }
        }

        return this.loadLocalFont(fontConfig.path, family) // subfamily is not supported (for now)
            .then((font) => {
                log.debug(`Font <${family}> loadded`);
                if (this.fonts) {
                    this.fonts.push(font);
                }
                return font;
            })
            .catch((err) => {
                log.error(err);
            });
    }

    getPathOrDefault(font, text, positionX, positionY, size) {
        this.loadDefaultFont();
        let index = 0;
        let width = 0;
        let diffWidth = 0;
        const fullPath = new opentype.Path();

        font.forEachGlyph(text, positionX, positionY, size, {}, (glyph, gX, gY, gFontSize) => {
            let glyphPath;
            const glyphWidth = 1 / font.unitsPerEm * gFontSize * glyph.advanceWidth;

            width += glyphWidth;

            if (glyph.index === 0 && this.defaultFont) {
                glyph = this.defaultFont.charToGlyph(text[index]);

                const newWidth = 1 / this.defaultFont.unitsPerEm * gFontSize * glyph.advanceWidth;

                glyphPath = glyph.getPath(gX + diffWidth, gY, gFontSize, {}, this.defaultFont);

                diffWidth += newWidth - glyphWidth;
                width += newWidth - glyphWidth;
            } else {
                glyphPath = glyph.getPath(gX + diffWidth, gY, gFontSize, {}, font);
            }
            fullPath.extend(glyphPath);
            index++;
        });

        return {
            path: fullPath,
            width: width
        };
    }
}

const fontManager = new FontManager();

export async function initFonts(fontDir) {
    fontManager.setFontDir(fontDir);
    await fontManager.loadLocalFontDir();
}

export default fontManager;
