import fontManager from '../../lib/FontManager';


// Get Host OS platform
export const getPlatform = (req, res) => {
    let platform = 'unknown';
    if (process.platform === 'darwin') {
        platform = 'darwin';
    } else if (process.platform === 'win32' && process.arch === 'x86') {
        platform = 'win32';
    } else if (process.platform === 'win32' && process.arch === 'x64') {
        platform = 'win64';
    } else if (process.platform === 'linux' && process.arch === 'x64') {
        platform = 'linux';
    }

    res.send({ platform });
};

export const getFonts = (req, res) => {
    // const fonts = fontManager.fonts

    const fontList = require('font-list');

    fontList.getFonts()
        .then(fonts => {
            fonts = fonts.filter(font => !!font)
                .map((font) => {
                    if (font[0] === '"') {
                        font = font.substr(1, font.length - 2);
                    }

                    return {
                        fontFamily: font,
                        fontSubfamily: '',
                        fullName: font,
                        displayName: font
                    };
                })
                .sort((a, b) => (a.fontFamily < b.fontFamily ? -1 : 1));

            res.send({
                fonts: fonts
            });
        })
        .catch(err => {
            console.log(err);
        });
};

export const uploadFont = (req, res) => {
    const fontFile = req.files.font;

    fontManager
        .addFontFile(fontFile.path)
        .then((font) => {
            res.send({
                font: {
                    fontFamily: font.names.fontFamily.en,
                    fontSubfamily: font.names.fontSubfamily.en,
                    fullName: font.names.fullName.en,
                    displayName: font.names.displayName.en
                }
            });
        });
};
