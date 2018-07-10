import fs from 'fs';
import * as opentype from 'opentype.js';


class FontManager {
    constructor() {
        this.fontDir = './fonts';
        this.scanFlag = false;
        this.fonts = [];

        this.ensureFontDir();
    }

    ensureFontDir() {
        if (!fs.existsSync(this.fontDir)) {
            fs.mkdirSync(this.fontDir);
            // FIXME: debug on my Machine, will be replaced by web downloaded fonts
            fs.copyFile(
                '/Users/parachvte/Documents/snapmaker/exp-font2svg/DroidSans.woff',
                `${this.fontDir}/DroidSans.woff`,
                () => {
                    console.log('copy done');
                }
            );
        }
        return this.fontDir;
    }

    scanFontDir() {
        if (this.scanFlag) {
            return Promise.resolve(this.fonts);
        }
        return new Promise((resolve, reject) => {
            fs.readdir(this.fontDir, (err, files) => {
                if (err) {
                    reject(err);
                    return;
                }
                for (let filename of files) {
                    const url = `${this.fontDir}/${filename}`;
                    try {
                        const font = opentype.loadSync(url);
                        const fontObject = {
                            fontFamily: font.names.fontFamily.en,
                            fontSubfamily: font.names.fontSubfamily.en,
                            fullName: font.names.fullName.en,
                            path: filename
                        };
                        this.fonts.push(fontObject);
                    } catch (e) {
                        console.error(`Failed to parse file: ${filename}`, e);
                    }
                }
                resolve(this.fonts);
                this.scanFlag = true;
            });
        });
    }

    getFonts() {
        if (this.fonts.length > 0) {
            return Promise.resolve(this.fonts);
        }
        return this.scanFontDir();
    }

    loadFont(family, subfamily = 'Regular') {
        return this.scanFontDir()
            .then((fonts) => new Promise((resolve, reject) => {
                let selectedFontObject;
                for (let fontObject of fonts) {
                    if (fontObject.fontFamily === family && fontObject.fontSubfamily === subfamily) {
                        selectedFontObject = fontObject;
                        break;
                    }
                }
                if (!selectedFontObject) {
                    reject(new Error(`No such font: ${family} ${subfamily}`));
                    return;
                }
                const path = `${this.fontDir}/${selectedFontObject.path}`;
                opentype.load(path, (err, font) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(font);
                });
            }));
    }
}

const fontManager = new FontManager();

export default fontManager;
