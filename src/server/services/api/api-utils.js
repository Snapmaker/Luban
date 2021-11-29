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
    let fonts = fontManager.systemFonts;

    fonts = fonts.filter(font => !!font.family)
        .map((font) => {
            if (font.family[0] === '"') {
                font.family = font.family.substr(1, font.family.length - 2);
            }
            return {
                ...font,
                fontFamily: font.family,
                fontSubfamily: '',
                fullName: font.family,
                displayName: font.family
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
