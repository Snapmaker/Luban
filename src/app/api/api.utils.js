import fontManager from '../lib/FontManager';


// Get Host OS platform
export const getPlatform = (req, res) => {
    let platform = 'unknown';
    if (process.platform === 'darwin') {
        platform = 'darwin';
    } else if (process.platform === 'win32') {
        if (process.arch === 'x64') {
            platform = 'win64';
        } else if (process.arch === 'ia32') {
            platform = 'win32';
        }
    } else if (process.platform === 'linux' && process.arch === 'x64') {
        platform = 'linux';
    }

    res.send({ platform });
};

export const getFonts = (req, res) => {
    fontManager.getFonts();
};
