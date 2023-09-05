const { notarize } = require('@electron/notarize');

module.exports = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;

    if (electronPlatformName !== 'darwin') {
        return;
    }

    if (!process.env.CI) {
        return;
    }

    // Notarize only when running on Travis-CI and has a tag.
    console.log('Notarizing application...');

    const appName = context.packager.appInfo.productFilename;

    const teamId = 'CTHX7X38C3';
    const appleId = process.env.APPLEID;
    const appleIdPassword = process.env.APPLEIDPASS;

    await notarize({
        appPath: `${appOutDir}/${appName}.app`,
        appleId,
        appleIdPassword,
        teamId,
    });
};
