/* eslint import/no-unresolved: 0 */
import 'babel-polyfill';
import { app, Menu } from 'electron';
import mkdirp from 'mkdirp';
import WindowManager from './electron-app/WindowManager';
import getMenuTemplate from './electron-app/Menu';
import cnc from './cnc';
import pkg from './package.json';

// The selection menu
const selectionMenu = Menu.buildFromTemplate([
    { role: 'copy' }
]);

// The input menu
const inputMenu = Menu.buildFromTemplate([
    { role: 'copy' },
    { role: 'paste' }
]);

let windowManager = null;

const main = () => {
    // https://github.com/electron/electron/blob/master/docs/api/app.md#apprequestsingleinstancelock
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
        app.quit();
        return;
    }

    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (!windowManager) {
            return;
        }

        const myWindow = windowManager.getWindow();
        if (myWindow) {
            if (myWindow.isMinimized()) {
                myWindow.restore();
            }
            myWindow.focus();
        }
    });


    // Create the user data directory if it does not exist
    const userData = app.getPath('userData');
    mkdirp.sync(userData);

    // Allow max 4G memory usage
    if (process.arch === 'x64') {
        app.commandLine.appendSwitch('--js-flags', '--max-old-space-size=4096');
    }

    app.commandLine.appendSwitch('ignore-gpu-blacklist');
    app.on('ready', async () => {
        try {
            const data = await cnc();

            const { address, port, routes } = { ...data };

            // Menu
            const template = getMenuTemplate({ address, port, routes });
            const menu = Menu.buildFromTemplate(template);
            Menu.setApplicationMenu(menu);

            // Window
            const url = `http://${address}:${port}`;

            windowManager = new WindowManager();
            const window = windowManager.openWindow(url, {
                width: 1280,
                height: 768,
                title: `${pkg.name} ${pkg.version}`
            });

            // https://github.com/electron/electron/issues/4068#issuecomment-274159726
            window.webContents.on('context-menu', (event, props) => {
                const { selectionText, isEditable } = props;

                if (isEditable) {
                    // Shows an input menu if editable
                    inputMenu.popup(window);
                } else if (selectionText && String(selectionText).trim() !== '') {
                    selectionMenu.popup(window);
                }
            });
        } catch (err) {
            console.error('Error: ', err);
        }
    });
};

main();
