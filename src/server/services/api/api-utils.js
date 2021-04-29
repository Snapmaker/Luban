import fontManager from '../../../shared/lib/FontManager';


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
    let fonts = [];

    fontManager.systemFonts.forEach((font) => {
        if (font.path.toLocaleLowerCase().indexOf('.ttc') < 0
            && fonts.findIndex(i => i === font.family) < 0) {
            fonts.push(font.family);
        }
    });

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
};

// deprecated, use system fonts instead
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
