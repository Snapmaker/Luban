const { execFileSync } = require('child_process');
const { notarize } = require('@electron/notarize');

module.exports = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;

    if (electronPlatformName !== 'darwin') {
        return;
    }

    if (!process.env.CI) {
        return;
    }

    const appName = context.packager.appInfo.productFilename;
    const appPath = `${appOutDir}/${appName}.app`;

    // Forks build without a Developer ID: electron-builder skipped signing
    // (electron-builder.sh unsets the empty CSC_* secrets), but a completely
    // unsigned app is killed on launch by Apple Silicon. Ad-hoc sign so the
    // dmg/zip run on both Intel and arm64; being un-notarized, the first
    // launch still needs Gatekeeper's one-time "Open Anyway" (right-click ->
    // Open on macOS <= 14, System Settings -> Privacy & Security on 15+) -
    // no terminal required.
    if (!process.env.CSC_LINK) {
        console.log('Ad-hoc signing (no signing certificate configured)...');
        execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
    }

    // Forks also skip notarization: no Apple credentials, no crash.
    if (!process.env.APPLEID || !process.env.APPLEIDPASS || !process.env.TEAMID) {
        console.log('Skipping notarization: Apple signing credentials are not configured.');
        return;
    }

    console.log('Notarizing application...');

    const teamId = process.env.TEAMID;
    const appleId = process.env.APPLEID;
    const appleIdPassword = process.env.APPLEIDPASS;

    await notarize({
        appPath,
        appleId,
        appleIdPassword,
        teamId,
    });
};
